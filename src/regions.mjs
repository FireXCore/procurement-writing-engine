const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const technical = /[\p{N}\p{Cc}\p{Cf}]/u;
const badControl = /[\p{Cc}\p{Cf}]/u;
const dangerous = /[<>@#=\/\\|_%$€£¥]/u;
const latin = /\p{Script=Latin}/u;
const arabic = /\p{Script=Arabic}/u;
const zwnj = /\u200c/g;
export const LIMITS = Object.freeze({ text: 16000, regions: 256, region: 2000, providers: 8, findings: 200, edits: 256, message: 400, providerFindings: 100, calls: 64, elapsedMs: 30000, providerMs: 15000 });

export function boundaries(text) {
  return new Set([...segmenter.segment(text)].map(x => x.index).concat(text.length));
}

// A host-supplied complete region partition is mandatory. No heuristic can establish authority.
export function validateDocument(doc) {
  if (!doc || typeof doc.text !== 'string' || !doc.text.isWellFormed() || doc.text.length > LIMITS.text ||
      typeof doc.snapshotId !== 'string' || !doc.snapshotId || doc.snapshotId.length > 128 ||
      !Array.isArray(doc.regions) || doc.regions.length > LIMITS.regions) return false;
  const b = boundaries(doc.text);
  let end = 0;
  for (const r of doc.regions) {
    if (!r || !Number.isSafeInteger(r.start) || !Number.isSafeInteger(r.end) ||
        r.start !== end || r.end <= r.start || !b.has(r.start) || !b.has(r.end) ||
        !['prose', 'protected'].includes(r.kind)) return false;
    if (r.kind === 'prose' && (!['en', 'fa'].includes(r.language) || r.end - r.start > LIMITS.region)) return false;
    end = r.end;
  }
  return end === doc.text.length;
}

// Defense in depth: skip whole prose regions containing obvious technical or mixed-script data.
// These checks are deliberately conservative; they are not a procurement parser or proof of safety.
export function eligible(text, language) {
  const flat = text.replace(zwnj, '');
  if (!text.trim() || technical.test(flat.replace(/[\r\n\t]/g, '')) || dangerous.test(flat) ||
      /[\p{L}][\p{L}\p{M}]*[-‐‑–—][\p{L}]/u.test(flat) || /\b[A-Z]{2,}\b/.test(flat)) return false;
  return language === 'en' ? latin.test(flat) && !arabic.test(flat) : arabic.test(flat) && !latin.test(flat);
}

export function validRange(text, start, end, b = boundaries(text)) {
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && end >= start &&
    end <= text.length && b.has(start) && b.has(end);
}

// Only contiguous, bounded, source-anchored proposals. Preserve numeric/technical data,
// line breaks and control characters; never permit a new code or markup-like token.
export function validReplacement(original, replacement, language) {
  if (typeof replacement !== 'string' || !replacement.isWellFormed() || original === replacement ||
      original.length > LIMITS.edits || replacement.length > LIMITS.edits ||
      (!original && !replacement)) return false;
  for (const t of [original, replacement]) {
    const clean = t.replace(zwnj, '');
    if (badControl.test(clean) || /\p{N}/u.test(clean) || dangerous.test(clean) ||
        /\b[A-Z]{2,}\b/.test(clean) || /[\p{L}][\p{L}\p{M}]*[-‐‑–—][\p{L}]/u.test(clean)) return false;
    if (language === 'fa' ? latin.test(clean) : arabic.test(clean)) return false;
  }
  return true;
}

// Python uses code points; JS uses UTF-16. Reject offsets outside the actual string.
export function codePointOffset(text, index) {
  if (!Number.isSafeInteger(index) || index < 0) return -1;
  let pos = 0, count = 0;
  for (const c of text) {
    if (count === index) return pos;
    count++; pos += c.length;
  }
  return count === index ? pos : -1;
}

// Derive one minimal contiguous grapheme-aligned proposal from a normalizer's result.
// Never implement linguistic rules here, nor perform an automatic whole-document rewrite.
export function contiguousDiff(source, target) {
  if (typeof target !== 'string' || source === target || target.length > LIMITS.region * 2) return null;
  const a = [...segmenter.segment(source)], b = [...segmenter.segment(target)];
  let left = 0, right = 0;
  while (left < Math.min(a.length, b.length) && a[left].segment === b[left].segment) left++;
  while (right < Math.min(a.length, b.length) - left && a[a.length-1-right].segment === b[b.length-1-right].segment) right++;
  const start = a[left]?.index ?? source.length;
  const end = a[a.length-right]?.index ?? source.length;
  const bs = b[left]?.index ?? target.length;
  const be = b[b.length-right]?.index ?? target.length;
  return { start, end, original: source.slice(start,end), replacement: target.slice(bs,be) };
}
