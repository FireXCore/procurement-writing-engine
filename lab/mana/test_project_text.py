import io
import unittest
from project_text import RangeFile, Budget

class Response:
    def __init__(self, status=206, content_range="bytes 2-4/10", data=b"abc"):
        self.status=status
        self.headers={"Content-Range":content_range}
        self.data=io.BytesIO(data)
    def geturl(self):return "https://huggingface.co/test"
    def read(self,n):return self.data.read(n)
    def __enter__(self):return self
    def __exit__(self,*args):pass

class TestRange(unittest.TestCase):
    def test_exact_range(self):
        b=Budget(5)
        def opener(req,timeout):
            self.assertEqual(req.get_header("Range"),"bytes=2-4")
            return Response()
        f=RangeFile("https://huggingface.co/test",10,b,opener)
        f.seek(2);self.assertEqual(f.read(3),b"abc")
        self.assertEqual(f.tell(),5);self.assertEqual(b.used,3)
        with self.assertRaises(ValueError):f.read(3)
    def test_refuse_full_response_before_body(self):
        for status,header,data in [(200,"",b"abc"),(206,"bytes 0-2/10",b"abc"),(206,"bytes 2-4/10",b"ab")]:
            f=RangeFile("https://huggingface.co/test",10,Budget(10),lambda *a,**k:Response(status,header,data))
            f.seek(2)
            with self.assertRaises(ValueError):f.read(3)
        with self.assertRaises(ValueError):f.read()
        with self.assertRaises(ValueError):f.seek(-1)
if __name__=="__main__":unittest.main()
