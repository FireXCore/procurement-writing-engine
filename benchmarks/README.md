# PWE routing benchmark — research baseline

Run from repository root with Node 22+:

```sh
node benchmarks/routing.mjs
node benchmarks/routing.mjs --gate
```

10,200 deterministic synthetic cases: ten typo-bearing sentences, 34 entities, five wrappers and six placements. Labels are derived from the template, not the parser. The benchmark reports whether the known typo reaches the correct language provider, the known entity is excluded from prose, and both hold together. An entirely skipped document protects entities but fails joint success. The normal mode is observational for known baseline misses and fails on partition/eligibility/locked-field violations; strict gate mode deliberately fails on any joint miss. No dependencies or provider calls. This is not a test of spelling accuracy, semantic preservation, latency, a hidden holdout or generalization. The saved baseline was evaluated against main ae0ece880d2c8bf8ffdb4b5e88d1c25cef1c96f4 using the same classifier and harness function in an isolated JavaScript evaluation; the standalone Node CLI and CI remain to be verified. Future changes must compare to baseline by category and add independent held-out cases not visible during tuning. No changes to SDK, dependencies, package version or production.
