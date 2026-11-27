# Technical decision: real-error qualification first

Status: implementation / diagnostic comparison, not release approval.

Baseline is eaadc7046d14103c7de65f19f3ede5e864c8322e (all seven CI gates passed). Preserve offline SDK, host-authoritative protected regions, review-only proposals and existing regression gates. No replacement of the current engine without a measured improvement.

## Stage 1: FAspell

Original human and OCR inputs are pinned by exact byte count and SHA-256 from the Persian Lexicon evaluation lock. Download occurs only in an isolated qualification job, not SDK/demo or installation. No raw data is committed, included in npm, or uploaded as artifacts. The HF mirror attributes CC BY 4.0 to Behrang QasemiZadeh; the original repository was not accessible during review, so verify its terms before any redistribution. Source and attribution are included in aggregate report.

The parser measures only distinct, normalized simple Persian single-token pairs (1–24 letters); reports unchanged, normalization-equivalent, boundary/ZWNJ, unsupported and duplicate exclusions. Short words are retained so abstention is visible. Human and OCR sets are reported separately. No test targets enter candidate generation, frequency data, or overrides. Existing public dictionary overlap is unknown.

Compare actual PWE Lilak lexical provider vs nspell 2.1.5 on the identical dictionary-fa 2.0.0 asset. nspell is research-only, with exact direct and transitive versions in isolated manifest; generated lock archived for audit; not yet a reproducible release lock. Both comparators return at most four eligible candidates. Measure top1, top4, abstention, paired gold control edits, paired success, partial cases, setup and paired-call latency. Gold controls are not independently certified in all contexts. These are word-level comparison metrics, not general linguistic accuracy. A passing job is execution success, not quality approval.

## Stage 2: evidence and alternatives

Verify ManaTTS text-only source provenance and rights; freeze revision and disjoint train/validation/test splits; build bounded unigram and adjacent-word evidence; compare against no-frequency baseline. Never use evaluation pairs as ranking training data. Add SymSpell and full Hunspell/WASM comparators only after checking Unicode, memory, runtime and licensing. Use a separate worker for untrusted/slow providers. No runtime dependency added until measured acceptance. Keep modern neural models optional and out of core.

## Release decision

No Alpha 8 publication or production deployment for this change. Next gate: obtain real report; investigate missed and false suggestions; assess browser memory and latency before choosing any new dependency. Existing thresholds remain mandatory. No invented progress percentage.
