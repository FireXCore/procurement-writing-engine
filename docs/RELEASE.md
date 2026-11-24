# Alpha release workflow

The source bundle is not a published release. The existing public FireXCore repository uses the CI workflow below to publish the alpha.6 prerelease only after all required jobs succeed. The Windows bootstrap script is historical and requires private package metadata; do not run it for alpha.6 or later. Use CI instead. The maintainer script creates a **private staging repository first**, tests the actual locked JS packages, checks security and package manifests, waits for GitHub CI for the exact commit, creates a GitHub prerelease, and finally changes repository visibility to public. It never publishes to npm, never force-pushes, and never changes another repository.

## Historical Windows maintainer bootstrap (not for alpha.6)

Prerequisites: Git, GitHub CLI authenticated to the intended owner, Node.js >=22.12, npm, and installed Chrome/Edge (or `PWE_CHROME` with an explicit path). Registry and GitHub access required. Git user identity must already be configured. Extract outside another Git checkout and inspect all source before publishing.

```powershell
gh auth login
# Run from the extracted project directory.
.\publish.ps1 -Owner FireXCore -PublicAlpha
```

The first execution generates a genuine npm lockfile, then uses `npm ci --ignore-scripts`. Direct upstream and tool versions are pinned. The lock is checked for exact direct versions, registry integrity metadata and unexpected package content. A high-severity npm audit failure, browser failure or any failed GitHub CI job prevents the initial public transition. CI tests Node 22/24 on Linux and Windows, real upstream JS integration, the built demo in Chromium, and package metadata. The POSIX-only synthetic executable test is explicitly skipped on Windows.

Review the resolved dependency tree and its licenses. The GitHub prerelease is an alpha source/tarball with no bundled third-party libraries, WASM, dictionary, or models. SBOM and SHA-256 checksum accompany the release. The script cannot provide a legal opinion or audit every transitive package. If any step fails, inspect the precise error before resuming. A collision or existing tag is a hard stop; no existing repo or tag is overwritten. If the final visibility step fails after a private release is made, inspect the private release and use GitHub settings to change visibility when satisfied. GitHub may require additional OAuth scopes or organization approval.

## Development checks

```sh
npm ci --ignore-scripts
npm run verify
npm audit --audit-level=high
npm run release:check
```

`npm run check` and `npm test` are dependency-free. `npm run verify` additionally requires the lock-resolved upstream packages, TypeScript, Vite, and installed Chromium. Real upstream/browser CI is a required alpha publication gate, not claimed to have run in the offline authoring environment.

## Optional services and production gates

Vale v3.28.1, STE100 v0.1.1 (spaCy and reviewed `en_core_web_sm` model), LanguageTool (review and pin a release independently), and experimental Virastar TS are **not** required for the browser alpha. They remain disabled/optional, separately qualified with real binaries and synthetic text. Configure absolute `PWE_VALE` / `PWE_STE100` and loopback `PWE_LT_ENDPOINT`, run `npm run test:services`. These tests fail if prerequisites are missing, not silently skip. Review license, runtime provenance, sandboxing and logging policy. Do not use unreviewed engines or binaries in production.

Production requires a versioned synthetic domain evaluation corpus, accepted accuracy and latency thresholds, actual Chromium/Firefox worker and CSP acceptance, no external traffic, and real authenticated host isolation. The host owns a complete region map and permission/session/record/edit-epoch checks. No public issue, artifact or CI log may contain actual procurement data. No automatic Apply, production integration or deployment is authorized by the alpha release. See [SECURITY.md](../SECURITY.md) and [THIRD_PARTY.md](../THIRD_PARTY.md).

## Existing public repository release automation

The CI workflow's final job is restricted to the canonical repository, main, a successful push or explicit workflow dispatch, and the explicit alpha.6 version. It checks the current main SHA, refuses existing tags, generates a tarball and checksum, downloads the dependency inventory from the same CI run, and creates a GitHub prerelease. This CI job does not publish to npm or deploy externally. The release job alone has contents-write permission. No release is created if a required upstream, browser, audit or contract job fails.

## Public npm distribution

Alpha.6 changes packaging metadata only; the tested alpha.5 engine is unchanged. Never replace the existing alpha.5 artifact. After the alpha.6 GitHub release passes CI, download the tarball and SHA256SUMS.txt from that release and verify its SHA-256. For a new package, the maintainer must authenticate to npm (2FA enabled) and publish the exact verified tarball with `npm publish ./procurement-writing-engine-0.1.0-alpha.6.tgz --access public --tag alpha --ignore-scripts` or stage and approve it with npm CLI 11.15+; never share credentials. After the package exists, configure a GitHub Actions trusted publisher: owner FireXCore, repository procurement-writing-engine, filename npm-publish.yml, allowed action stage publish. Run the workflow manually on main; it refuses a commit without a matching GitHub release tag. Review and approve staged versions in npmjs.com with 2FA. No permanent token, automatic Apply, stable tag or production deployment.
