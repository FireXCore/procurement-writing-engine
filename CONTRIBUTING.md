# Contributing

Procurement Writing Engine welcomes independent bug reports, test cases, provider adapters and documentation. Use **synthetic data only**. Do not share real customer records, quotations, purchase orders, supplier details or confidential identifiers.

## Development

Node.js 22.12+ and npm are required. Run `npm ci --ignore-scripts` against the committed lockfile. For an initial source bundle without a lockfile, see the maintainer bootstrap in [RELEASE.md](docs/RELEASE.md). Use `npm run verify` with a local Chromium-based browser (`PWE_CHROME` if needed). The core suite runs with no dependency installation (`npm run check`, `npm test`).

- Preserve the host-owned complete region map and review-only contract.
- Add a regression test for each changed adapter contract or rule. Verify exact source offsets, grapheme boundaries, malformed output and protected ranges.
- Prefer upstream API composition over modifying upstream parsers. Pin reviewed releases, retain license obligations, and update `THIRD_PARTY.md` and the lockfile.
- No network, telemetry, model download, or automatic mutation in the default browser profile. External service changes require explicit security review.
- Keep pull requests focused. Include synthetic reproduction steps, test results and known limitations. CI passing is not proof of semantic correctness.

Security reports belong in private vulnerability reporting, not public issues. See [SECURITY.md](SECURITY.md).
