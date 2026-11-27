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

## Cascade decision and initial statistical evidence

Verified d5bebfe: all seven standard checks plus FAspell successful. Human Cascade top1 1706, top4 2583, gold controls 72, P95 2.090 ms; veto identical counts. OCR Cascade top1 36, top4 101, controls 20, P95 107.12 ms. Keep PWE default; do not promote cascade until safety/latency improve. ManaTTS original dataset authors state CC0 (https://aclanthology.org/2025.naacl-long.464/). Pinned official 50-row metadata sample only, git blob and byte count checked by runner. Extract HIGH-quality transcript, not ASR hypothesis/audio; deterministic filename-prefix split (not assumed to be article identifiers) and normalized text dedup. Output bounded unigram/bigram counts, not raw sentences. Bigram counts generated but not consumed by current ranking API. Compare unigram evidence on same FAspell development set; sample is too small to establish improvement. Full corpus text-only projection, exact source revision/hash inventory and independent holdout pending. No SDK dependencies or release.

## Full corpus projection experiment
7401dc4 human sample-frequency top1 1547 vs 1532, top4 2346 vs 2345; 55 gold-control edits unchanged; OCR 28/87 vs 25/85, 16 controls unchanged. WebKit clean English fixture returned partial without diagnostic details in assertion. Add details to failure message; no retries or acceptance relaxation. Full original ManaTTS pinned to 698f7f7bfe7a8fc665e9c4c0ca9eea7e0d49f64f (CC0). The research runner enumerates immutable shard metadata, projects only file name/transcript/match quality with PyArrow, rejects full-file HTTP responses, bounds each range to 2 MiB and total requested data to 128 MiB. Footer reads may include incidental bytes; audio columns never selected or decoded. Inventory records LFS identifiers but full object SHA-256 cannot be recomputed without reading whole objects; projection hashes and pinned revision provide provenance, not whole-file verification. No raw corpus is uploaded; only derived evidence and aggregate reports. Exact source group semantics and corpus overlap remain unverified; development comparison not blind validation. PyArrow is lab-only, exact version, wheel integrity not yet locked. Full corpus completion and measured ranking improvement require CI. No SDK/demo changes or release.
