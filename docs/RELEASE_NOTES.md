# Procurement Writing Engine 0.1.0-alpha.1

An experimental open-source integration layer for writing assistance in procurement and technical commercial prose. No large language model is required by the default profile. The library composes reviewed upstream interfaces rather than replacing their linguistic engines.

- English (Harper) and Persian orthography (Virastar).
- Organization-owned policies via Textlint; optional Vale, STE100 and self-hosted LanguageTool adapters.
- Explicit host-provided regions, source-anchored proposals and no automatic Apply.
- Local browser worker demonstration and reproducible CI gates.

**Release scope:** alpha source and npm-installable tarball distributed through GitHub Releases, not the npm registry. CI verifies locked JS upstream integration, Chromium smoke and core contracts before publication. The optional external services, experimental Virastar TS, domain corpus quality, host authorization/tenant boundaries and production performance remain separate acceptance gates. Do not use real procurement data until these gates pass. Third-party packages are not bundled in the library tarball.

Verify the downloaded tarball using `SHA256SUMS.txt`. The CycloneDX file inventories the resolved development dependency set. This is not a security certification.
