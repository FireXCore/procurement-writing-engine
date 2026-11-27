"""Research-only column projection. Refuse whole-file downloads."""
import io
import json
import re
import sys
import hashlib
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
MANIFEST = json.loads((ROOT / "full-source.json").read_text(encoding="utf-8"))
BASE = "https://huggingface.co"
MAX_READ = MANIFEST["maxReadBytes"]
MAX_TOTAL = MANIFEST["maxTransferBytes"]
MAX_ROWS = MANIFEST["maxRows"]

class Budget:
    def __init__(self, cap):
        self.cap = cap
        self.used = 0
        self.lock = threading.Lock()

    def reserve(self, size):
        with self.lock:
            if size < 0 or self.used + size > self.cap:
                raise ValueError("Transfer budget exceeded")
            self.used += size

def safe_response(response):
    p = urlparse(response.geturl())
    if p.scheme != "https" or not p.hostname or p.username or p.password:
        raise ValueError("Unsafe response URL")

def get_inventory():
    url = f"{BASE}/api/datasets/{MANIFEST['dataset']}/tree/{MANIFEST['revision']}/{MANIFEST['directory']}?recursive=false&limit=100"
    with urlopen(Request(url, headers={"Accept": "application/json"}), timeout=45) as r:
        safe_response(r)
        if r.status != 200 or r.headers.get("Link") and 'rel="next"' in r.headers["Link"]:
            raise ValueError("Inventory unavailable or paginated")
        data = r.read(2_000_001)
    if len(data) > 2_000_000:
        raise ValueError("Inventory too large")
    rows = json.loads(data)
    if not isinstance(rows, list):
        raise ValueError("Invalid inventory")
    files = []
    for row in rows:
        path = row.get("path", "")
        match = re.fullmatch(r"dataset/dataset_part_(\d{3})\.parquet", path)
        if not match or row.get("type") != "file":
            raise ValueError("Unexpected inventory entry")
        size = row.get("size")
        oid = row.get("oid", "")
        lfs = row.get("lfs") or {}
        digest = lfs.get("oid", "")
        if not isinstance(size, int) or not 1_000_000 < size < 1_000_000_000:
            raise ValueError("Unexpected shard size")
        if not re.fullmatch(r"[0-9a-f]{40}", oid) or not re.fullmatch(r"[0-9a-f]{64}", digest):
            raise ValueError("Missing immutable shard identifiers")
        files.append({"part": int(match[1]), "path": path, "size": size, "oid": oid, "lfsSha256": digest})
    files.sort(key=lambda f: f["part"])
    if not 60 <= len(files) <= 100 or [f["part"] for f in files] != list(range(1, len(files)+1)):
        raise ValueError("Unexpected shard inventory")
    return files

class RangeFile(io.RawIOBase):
    def __init__(self, url, size, budget, opener=urlopen):
        super().__init__()
        self.url, self.size, self.budget, self.opener = url, size, budget, opener
        self.pos = 0
        self.requests = 0

    def readable(self): return True
    def seekable(self): return True
    def tell(self): return self.pos

    def seek(self, offset, whence=io.SEEK_SET):
        if whence not in (io.SEEK_SET, io.SEEK_CUR, io.SEEK_END):
            raise ValueError("Invalid seek")
        pos = offset + (self.pos if whence == io.SEEK_CUR else self.size if whence == io.SEEK_END else 0)
        if not 0 <= pos <= self.size:
            raise ValueError("Invalid seek offset")
        self.pos = pos
        return pos

    def read(self, n=-1):
        if self.closed:
            raise ValueError("Closed range file")
        if n < 0:
            raise ValueError("Unbounded read forbidden")
        n = min(n, self.size - self.pos)
        if not n: return b""
        if n > MAX_READ:
            raise ValueError("Oversized range read forbidden")
        start, end = self.pos, self.pos+n-1
        self.budget.reserve(n)
        self.requests += 1
        if self.requests > 2048:
            raise ValueError("Too many range requests")
        request = Request(self.url, headers={"Range": f"bytes={start}-{end}", "Accept-Encoding": "identity"})
        with self.opener(request, timeout=45) as response:
            safe_response(response)
            if response.status != 206 or response.headers.get("Content-Range") != f"bytes {start}-{end}/{self.size}":
                raise ValueError("Server did not honor exact byte range")
            if response.headers.get("Content-Encoding", "identity") != "identity":
                raise ValueError("Unexpected content encoding")
            data = response.read(n+1)
        if len(data) != n:
            raise ValueError("Incorrect range response length")
        self.pos += n
        return data

    def readinto(self, b):
        data = self.read(len(b))
        b[:len(data)] = data
        return len(data)

# Never coerce missing or non-string fields to a valid transcript. Exclusions
# are accounted independently from the downstream alignment-quality filter.
def project_row(item, columns):
    id_, text, quality = (item[c] for c in columns)
    if not isinstance(id_, str) or not re.fullmatch(r"[0-9]{1,8}-[0-9]{1,8}\.wav", id_):
        return None, "invalid-id"
    if quality not in ("HIGH", "MIDDLE", "REJECT"):
        return None, "invalid-quality"
    if quality != "HIGH":
        return {"id":id_,"text":"","quality":quality}, None
    if not isinstance(text, str) or not text.strip() or len(text)>2000:
        return None, "invalid-high-transcript"
    return {"id":id_,"text":text,"quality":quality}, None

def project(shard, budget):
    import pyarrow as pa
    import pyarrow.parquet as pq
    url = f"{BASE}/datasets/{MANIFEST['dataset']}/resolve/{MANIFEST['revision']}/{shard['path']}"
    with RangeFile(url, shard["size"], budget) as source:
        with pa.PythonFile(source, mode="r") as stream:
            reader = pq.ParquetFile(stream, pre_buffer=False)
            columns = MANIFEST["columns"]
            if not all(c in reader.schema_arrow.names for c in columns):
                raise ValueError("Unexpected Parquet schema")
            if not 1 <= reader.metadata.num_rows <= MAX_ROWS:
                raise ValueError("Unexpected shard rows")
            rows, excluded = [], {}
            for batch in reader.iter_batches(batch_size=512, columns=columns, use_threads=False):
                if batch.schema.names != columns:
                    raise ValueError("Projection mismatch")
                for item in batch.to_pylist():
                    row, reason = project_row(item,columns)
                    if reason:
                        excluded[reason] = excluded.get(reason,0)+1
                    else:
                        rows.append(row)
            if len(rows)+sum(excluded.values()) != reader.metadata.num_rows:
                raise ValueError("Incomplete shard projection")
            payload = json.dumps(rows, ensure_ascii=False, sort_keys=True, separators=(",",":")).encode("utf-8")
            return rows, {"part":shard["part"],"rows":len(rows),"inputRows":reader.metadata.num_rows,"excluded":excluded,"projectionSha256":hashlib.sha256(payload).hexdigest(),"requests":source.requests}

def main(output):
    files = get_inventory()
    budget = Budget(MAX_TOTAL)
    rows, projected = [], []
    with ThreadPoolExecutor(max_workers=4) as pool:
        for records, info in pool.map(lambda shard: project(shard,budget), files):
            rows.extend(records)
            projected.append(info)
            if len(rows)>MAX_ROWS: raise ValueError("Too many corpus rows")
            print("MANA_PROJECTED", json.dumps(info), flush=True)
    input_rows = sum(p["inputRows"] for p in projected)
    excluded_rows = input_rows - len(rows)
    if not 50000 <= input_rows <= MAX_ROWS:
        raise ValueError("Full corpus row count implausible")
    if excluded_rows > input_rows * .05:
        raise ValueError("More than 5% malformed metadata; do not promote this corpus")
    payload = {"source":MANIFEST,"inventory":files,"projections":projected,"reservedTransferBytes":budget.used,"rows":rows}
    path = Path(output)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    tmp.replace(path)
    print("MANA_FULL_PROJECTED",json.dumps({"shards":len(files),"inputRows":input_rows,"excludedRows":excluded_rows,"rows":len(rows),"reservedTransferBytes":budget.used}))

if __name__ == "__main__":
    if len(sys.argv)!=2: raise SystemExit("Explicit temporary output required")
    main(sys.argv[1])
