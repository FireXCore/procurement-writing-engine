# Third-party software and standards

The integration code is independently authored. No upstream source trees, proprietary procurement data, dictionaries, models or WASM binaries are redistributed in this repository. Optional upstream packages/binaries remain under their respective licenses. Preserve their copyright notices and license/NOTICE obligations when distributing installed packages, binaries, or bundled assets; examine dependency and data licenses separately.

| Component | Observed license | Reviewed baseline | Use |
|---|---|---|---|
| [Harper](https://github.com/Automattic/harper) | Apache-2.0 | v3.2.0 | `harper.js`, explicit local WASM, English |
| [Virastar](https://github.com/brothersincode/virastar) | MIT | v0.22.1 | Persian orthography with restricted options |
| [Virastar TS](https://github.com/nekofar/virastar) | Apache-2.0 | 69e5e6832a514e06ade468373c1b4924d19c4efb | Optional experimental adapter, no automatic dependency |
| [Textlint](https://github.com/textlint/textlint) | MIT | v16.1.3 | Kernel and plaintext plugin |
| [Vale](https://github.com/vale-cli/vale) | MIT | v3.28.1 | External executable, repository-owned terminology rules |
| [LanguageTool](https://github.com/languagetool-org/languagetool) | LGPL-2.1 (source headers also allow later versions in relevant files) | 8db66a4d2e7bd629f4697b07d43727b281ee5322 | Optional independent loopback service, not bundled or relicensed |
| [STE100 checker](https://github.com/swarooppatilx/ste100) | MIT at repository level | v0.1.1 | Optional external executable, advisory only |

The official ASD-STE100 standard, its dictionary and related trademarks are separate from the checker repository's code license. Do not republish its vocabulary tables, claim certified conformance, or imply endorsement. The STE100 checker requires spaCy and an installed `en_core_web_sm` model; their licenses and distribution terms must be reviewed before deployment. No LLM is required by this integration, but a statistical language model is needed for that optional checker.

Do not treat this list as a complete transitive software bill of materials or legal approval. Release requires exact dependency locks, vulnerability review, SBOM and third-party notice verification for the actual distributed artifact.
