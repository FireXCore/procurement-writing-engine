# Local verification evidence

2026-11-24 — Linux, Node.js 22.16.0. All input data was synthetic.

| Check | Result |
|---|---|
| Syntax across src, test, examples, scripts and demo | PASS |
| Core and transport Node tests | 26 pass, 0 fail, 0 skipped |
| Property-style protected range scenarios | 150 generated cases in the existing suite |
| TypeScript declaration consumer contract (available local `tsc`) | PASS |
| npm pack dry run | PASS |
| Existing engine/provider source compared to original candidate | Identical bytes |
| Local HTTP and process transport | PASS with synthetic fixtures, not actual external engines |
| npm lock generation / pinned dependency installation | NOT RUN — registry unavailable in authoring environment |
| Actual Harper/Virastar/Textlint execution and built Chromium demo | NOT RUN — require installed upstream dependencies |
| Optional real Vale, STE100, LanguageTool and experimental TS adapter | NOT RUN |
| Windows publishing script and GitHub Actions | NOT RUN — no authenticated GitHub CLI or new repository in authoring environment |
| GitHub public repo / release / npm publication / deployment | NOT PERFORMED |

The included publishing script is intended to create a real lock and gate public alpha publication on actual local and GitHub CI. No synthetic or dry-run check substitutes for these gates. The optional service/production qualification remains separate. No actual private procurement records are included.
