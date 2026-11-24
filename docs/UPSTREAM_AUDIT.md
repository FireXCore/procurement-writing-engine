# Upstream architecture and compatibility review — 2026-11-24

## Scope and method

Repository metadata and recursive trees for seven projects were inspected. Tree sizes (all entries, including directories and assets): Harper 2,393; STE100 57; Vale 2,234; LanguageTool 5,266; Textlint 2,129; Virastar JS 29; Virastar TS 117. Relevant source interfaces, implementation sections, selected tests and package manifests were retrieved from GitHub, with the release-tag contracts cross-checked where available. This is a focused integration review, **not** a completed line-by-line security audit of every upstream file, rule, model, or transitive dependency. No upstream source was vendored. The following links identify the observed source, not a claim that every upstream behavior has been proven.

## Harper — primary English engine

- Reviewed baseline: [`master` 2026-11-23](https://github.com/Automattic/harper/tree/eeaf0d208e56bf55ea1720833177d9451316b4cf); [release v3.3.0](https://github.com/Automattic/harper/releases/tag/v3.3.0).
- [JS manifest](https://github.com/Automattic/harper/blob/eeaf0d208e56bf55ea1720833177d9451316b4cf/packages/harper.js/package.json), [Linter contract](https://github.com/Automattic/harper/blob/v3.3.0/packages/harper.js/src/Linter.ts), [LocalLinter](https://github.com/Automattic/harper/blob/eeaf0d208e56bf55ea1720833177d9451316b4cf/packages/harper.js/src/LocalLinter.ts), [WorkerLinter](https://github.com/Automattic/harper/blob/eeaf0d208e56bf55ea1720833177d9451316b4cf/packages/harper.js/src/WorkerLinter/index.ts), [WASM bindings](https://github.com/Automattic/harper/blob/v3.3.0/harper-wasm/src/lib.rs), [tests](https://github.com/Automattic/harper/blob/eeaf0d208e56bf55ea1720833177d9451316b4cf/packages/harper.js/src/Linter.test.ts), [inline binary](https://github.com/Automattic/harper/blob/eeaf0d208e56bf55ea1720833177d9451316b4cf/packages/harper.js/src/binaries/binaryInlined.ts).
- `organizedLints` provides source rule IDs; bindings expose span, original problem text, message and suggestion kind. The WASM layer converts Unicode character offsets to JS UTF-16. Replace/remove/insert-after differ; convert to a source-anchored proposal and release wrappers. Never call upstream `applySuggestion` (which records usage statistics). The caller must explicitly dispose the linter. Do not load the WASM until enabled by the host.
- Decision: integrate the real library through a lazy adapter, not port Rust rules.

## Virastar JS — primary Persian orthography

- [Manifest](https://github.com/brothersincode/virastar/blob/76dc6ea0e73555eb522795702bf14b4a351b4ffc/package.json), [README options](https://github.com/brothersincode/virastar/blob/76dc6ea0e73555eb522795702bf14b4a351b4ffc/README.md), [released implementation v0.22.1](https://github.com/brothersincode/virastar/blob/v0.22.1/lib/virastar.js).
- Default transformations include English/Arabic digit conversion, date reordering, numeral separator replacement, HTML entity decoding and punctuation/dash changes. These are unsafe defaults for procurement. Explicitly disable all nonrequired transformations; allow only selected Persian glyph/prefix/suffix operations in approved Persian prose. Convert the returned string into one minimal grapheme-aligned review proposal, not an entire field rewrite. A normalizer is not a grammar checker.
- Decision: use stable JS package; real upstream acceptance still required.

## Virastar TS — alternative only

- [README](https://github.com/nekofar/virastar/blob/69e5e6832a514e06ade468373c1b4924d19c4efb/README.md), [manifest](https://github.com/nekofar/virastar/blob/69e5e6832a514e06ade468373c1b4924d19c4efb/package.json).
- Project explicitly identifies itself as experimental; API is `virastar().process(text)`, not a drop-in substitute for JS Virastar. No release was returned by GitHub's latest-release endpoint. Include an optional adapter for a host-owned instance, advisory-only; do not install by default or combine both normalizers on the same text. No real TS package acceptance performed.

## Textlint — reviewed procurement policy packs

- [Kernel v16.1.3](https://github.com/textlint/textlint/blob/v16.1.3/packages/@textlint/kernel/src/textlint-kernel.ts), [interface](https://github.com/textlint/textlint/blob/356769ed579b998d73d05a4a55767dae15fdd288/packages/@textlint/kernel/src/textlint-kernel-interface.ts), [message ranges](https://github.com/textlint/textlint/blob/v16.1.3/packages/@textlint/types/src/Message/TextlintResult.ts), [plaintext plugin](https://github.com/textlint/textlint/blob/356769ed579b998d73d05a4a55767dae15fdd288/packages/@textlint/textlint-plugin-text/src/index.ts), [rule context](https://github.com/textlint/textlint/blob/v16.1.3/packages/@textlint/types/src/Rule/TextlintBaseRuleContext.ts), [rule error details](https://github.com/textlint/textlint/blob/356769ed579b998d73d05a4a55767dae15fdd288/packages/@textlint/types/src/Rule/TextlintRuleError.ts).
- `lintText` requires explicit plugin/rule configuration; it is not itself an English grammar engine. `fix.range` is distinct from issue `range` and deprecated point `index`. Use explicit source ranges only. Call `lintText`, not `fixText`. Include a small advisory delivery-clarity policy, not a new grammar engine. Production rule packs must be approved per document type and locale.

## Vale — document/terminology checks

- [JSON renderer](https://github.com/vale-cli/vale/blob/749876705d8efade3cc745d83a07996ec7a75e3a/cmd/vale/json.go), [alert contract v3.28.1](https://github.com/vale-cli/vale/blob/v3.28.1/internal/core/alert.go), [CLI flags](https://github.com/vale-cli/vale/blob/749876705d8efade3cc745d83a07996ec7a75e3a/cmd/vale/flag.go), [docs](https://docs.vale.sh/).
- JSON maps each source document to alerts with `Line`, `Match`, `Span`, `Check`, `Message`. Columns can vary with parser and encoding. Accept only unique exact match on the specified line; never global or fuzzy search. Keep advisories. Run optional installed binary with owned config and stdin, not a new Go port or per-keystroke server request. The included sample policy is intentionally small.

## LanguageTool — optional independent language service

- [Persian language module](https://github.com/languagetool-org/languagetool/blob/8db66a4d2e7bd629f4697b07d43727b281ee5322/languagetool-language-modules/fa/src/main/java/org/languagetool/language/Persian.java), [server route](https://github.com/languagetool-org/languagetool/blob/8db66a4d2e7bd629f4697b07d43727b281ee5322/languagetool-server/src/main/java/org/languagetool/server/ApiV2.java), [HTTP API contract](https://languagetool.org/http-api/swagger-ui/), [self-host guide](https://dev.languagetool.org/http-server).
- Persian includes whitespace, repetition, coherence and replacement rules, not proof of full Persian grammar coverage. API `matches` supplies `offset`, `length`, context, rule and replacements. Validate context against original. Do not send actual customer text to the public API. Loopback service only, disabled unless configured. Treat server, dictionaries and optional external service features as separately reviewed dependencies. Exact deployed version remains a qualification gate.

## STE100 checker — optional technical-English advisory

- [Release v0.1.1](https://github.com/swarooppatilx/ste100/releases/tag/v0.1.1), [manifest](https://github.com/swarooppatilx/ste100/blob/6bbed1e639411ea10df9aa3f0ca166289102ba7b/pyproject.toml), [CLI](https://github.com/swarooppatilx/ste100/blob/6bbed1e639411ea10df9aa3f0ca166289102ba7b/src/cli.py), [engine](https://github.com/swarooppatilx/ste100/blob/6bbed1e639411ea10df9aa3f0ca166289102ba7b/src/engine.py), [report](https://github.com/swarooppatilx/ste100/blob/v0.1.1/src/report.py), [spaCy pipeline](https://github.com/swarooppatilx/ste100/blob/6bbed1e639411ea10df9aa3f0ca166289102ba7b/src/pipeline.py), [dictionary](https://github.com/swarooppatilx/ste100/blob/6bbed1e639411ea10df9aa3f0ca166289102ba7b/src/dictionary.py).
- Python report offsets are code points; convert to UTF-16 and verify reported `text` exactly. Suggestions may be explanations, not literal replacements; keep advisory only. Requires installed spaCy `en_core_web_sm`, so this optional path is not model-free in the statistical NLP sense. No claim of ASD-STE100 certification; no standard vocabulary/data copied.

## Architectural decision

A single modular library orchestrates adapters. Browser profile: Harper + Virastar, optional reviewed Textlint policy. Server/document QA profile: Vale and optional LanguageTool/STE100. Enable one primary grammar provider for a given locale by default; extra providers are deliberate audit profiles, not an unconditional cascade. Preserve each finding's source; conflicting suggestions are not automatically combined. No LLM, no auto-apply, no proprietary code or data.
