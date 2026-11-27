# Technical decision: real-error qualification first

Status: implementation / diagnostic comparison, not release approval.

Baseline is eaadc7046d14103c7de65f19f3ede5e864c8322e (all seven CI gates passed). Preserve offline SDK, host-authoritative protected regions, review-only proposals and existing regression gates. No replacement of the current engine without a measured improvement.

## Stage 1: FAspell

Original human and OCR inputs are pinned by exact byte count and SHA-256 from the Persian Lexicon evaluation lock. Download occurs only in an isolated qualification job, not SDK/demo or installation. No raw data is committed, included in npm, or uploaded as artifacts. The HF mirror attributes CC BY 4.0 to Behrang QasemiZadeh; the original repository was not accessible during review, so verify its terms before any redistribution. Source and attribution are included in aggregate report.

The parser measures only distinct, normalized simple Persian single-token pairs (1–24 letters); reports unchanged, normalization-equivalent, boundary/ZWNJ, unsupported and duplicate exclusions. Short words are retained so abstention is visible. Human and OCR sets are reported separately. No test targets enter candidate generation, frequency data, or overrides. Existing public dictionary overlap is unknown.

Compare actual PWE Lilak lexical provider vs nspell 2.1.5 on the identical dictionary-fa 2.0.0 asset. nspell is research-only, with exact direct and transitive versions in isolated manifest; exact integrity lock recovered from initial CI artifact and committed; isolated npm ci. Both comparators return at most four eligible candidates. Measure top1, top4, abstention, paired gold control edits, paired success, partial cases, setup and paired-call latency. Gold controls are not independently certified in all contexts. These are word-level comparison metrics, not general linguistic accuracy. A passing job is execution success, not quality approval.

## Stage 2: evidence and alternatives

Verify ManaTTS text-only source provenance and rights; freeze revision and disjoint train/validation/test splits; build bounded unigram and adjacent-word evidence; compare against no-frequency baseline. Never use evaluation pairs as ranking training data. Add SymSpell and full Hunspell/WASM comparators only after checking Unicode, memory, runtime and licensing. Use a separate worker for untrusted/slow providers. No runtime dependency added until measured acceptance. Keep modern neural models optional and out of core.

## Release decision

No Alpha 8 publication or production deployment for this change. Next gate: obtain real report; investigate missed and false suggestions; assess browser memory and latency before choosing any new dependency. Existing thresholds remain mandatory. No invented progress percentage.

Initial CI passed dependency installation, audit, download and SHA verification but failed strict TSV schema/count parsing. Support CSV quoting, blank records and CR line endings; retain locked row counts and log only structural diagnostics. No quality result yet.

## Measured baseline — d176458

Human 3,633 distinct eligible pairs: PWE top1 1,532, top4 2,345, gold controls with edits 55, abstained 929, P95 pair latency 0.459 ms; nspell top1 1,699, top4 2,557, controls 76, abstained 305, P95 2.381 ms. OCR 550 pairs: PWE top1 25, top4 85, controls 16; nspell top1 59, top4 123, controls 27. Both zero partial. PWE has lower gold-control suggestion counts and latency, nspell has higher exact-target recall. Do not replace core.

Two diagnostic cascade variants: retain primary proposals and fill only absent candidates with nspell, or additionally veto primary proposals when nspell accepts source. Both preserve primary short-word abstention and existing root, alias and suffix source evidence; reject fallback candidates outside bounded OSA distance 2 or not accepted by nspell. No new runtime dependency. This is a development comparison, not a blind holdout. Isolated word-level measurements cannot certify document-level or mobile performance. Aggregate paired-control edits and runtime must be considered before promotion. No raw benchmark text is exported.
