# PWE routing benchmark — research baseline

Run from repository root with Node 22+:

```sh
node benchmarks/routing.mjs
node benchmarks/routing.mjs --gate
```

10,200 deterministic synthetic cases: ten typo-bearing sentences, 34 entities, five wrappers and six placements. Labels are derived from the template, not the parser. The benchmark reports whether the known typo reaches the correct language provider, the known entity is excluded from prose, and both hold together. An entirely skipped document protects entities but fails joint success. The normal mode is observational for known baseline misses and fails on partition/eligibility/locked-field violations; strict gate mode deliberately fails on any joint miss. No dependencies or provider calls. This is not a test of spelling accuracy, semantic preservation, latency, a hidden holdout or generalization. The saved baseline was evaluated against main ae0ece880d2c8bf8ffdb4b5e88d1c25cef1c96f4 using the same classifier and harness function in an isolated JavaScript evaluation; the standalone Node CLI and CI remain to be verified. Future changes must compare to baseline by category and add independent held-out cases not visible during tuning. No changes to SDK, dependencies, package version or production.

## Research prototype: local token quarantine

Run `node benchmarks/compare-routing.mjs`. Compare original routing, independent experimental token quarantine, and explicit synthetic host literals. No change to the SDK or demo. The same development corpus is used, so results are not independent generalization evidence. Unrecognized tokens are isolated conservatively; known host terms only are protected by literal matching, not NLP. Unknown brands, adjacent punctuation, sentence context, bidi controls, and adversarial offsets require separate holdout evaluation. UAX #29 revision 49 (2026-09-01): https://www.unicode.org/reports/tr29/tr29-49.html. Candidate next-stage research: https://huggingface.co/onnx-community/gliner2-multi-v1-agent-ONNX (multilingual ONNX entity extraction; exact original offsets and offline weights must be qualified before integration). No model is installed.

### Post-prototype challenge

`node benchmarks/challenge-routing.mjs` measures 22 additional cases without a host catalog; `--gate` requires all to pass. Intentional abstention on the bidi-control case counts as correct. This set was assembled after the prototype, but is now public and must not be presented as a hidden holdout. Failures are retained rather than hidden by loosening protection. The saved report is an isolated JS evaluation; Node CLI and CI require separate verification.
