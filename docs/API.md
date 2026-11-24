# API reference

ESM entry points: `procurement-writing-engine` for browser-safe provider composition; `procurement-writing-engine/node` for explicit local process and loopback HTTP transports. See `src/index.d.mts` and `src/node/index.d.mts` for the exact typed contract.

`createEngine(providers)` returns a single-flight engine. `analyze(document, {signal})` returns an immutable analysis. Provide the exact `text`, an opaque `snapshotId`, and contiguous nonoverlapping `regions` covering the whole input. Each region is half-open UTF-16 and classified `protected` or `prose` with `language: 'en' | 'fa'`. The map is a host responsibility, not an authorization credential.

Findings expose `provider`, `rule`, `category`, `start`, `end`, `original`, optional `replacement`, and plain-text `message`. Never interpret messages as HTML. `apply` is always false. `complete` refers to admitted checks, `partial` indicates reduced coverage, `blocked` means admission failed or the engine is retired, `busy` rejects overlapping calls, and `cancelled` carries no findings. Do not reuse a retired engine. Dispose provider resources and terminate a worker when context changes.

## Factories

- `createHarper({binary, worker, dialect})` returns `{provider, dispose}`; explicit local WASM required.
- `createVirastar()` creates the restricted Persian normalizer. `experimentalVirastarAdapter(instance)` is an alternative, advisory-only adapter.
- `createTextlint(rules)` uses the plaintext plugin and host-reviewed rule modules. `procurementDeliveryRule` is a sample advisory, not a due-date calculator.
- `createVale({executable, config})` and `createSTE100({executable})` are Node-only and require absolute trusted local paths.
- `createLocalLanguageTool({endpoint})` accepts an explicit IPv4 loopback HTTP `/v2/check` endpoint. Never enable remote fallback.
- Lower-level adapters accept trusted upstream objects/callbacks and do not sandbox those providers.

Do not pass arbitrary paths, providers or rules supplied by users. Never display a stale report: verify live source, scope, record, field, permissions and edit revision in the host.

`procurementPolicyRules` is the reviewed English procurement policy pack (deadline clarity plus narrow subject/verb agreement). `procurementAgreementRule` is individually selectable. The grammar coverage is deliberately restricted; it is not a general parser. Alternatives at identical offsets/provider/rule preserve provider ordering, with a reviewed vocabulary preference in the Harper adapter. Rejected findings now include bounded `rejected-finding` diagnostics. All regions still require host authority.

Alpha.3 `normalizerAdapter` may emit multiple independent, nonoverlapping word/phrase patches from a single normalization. The adapter verifies that they reconstruct the exact normalized source and rejects the normalization if any patch violates the existing range/replacement/budget constraints. Do not assume one finding per field. Experimental Virastar remains advisory only. No new public mutation API.

Alpha.4 `createVirastar()` composes upstream cleanup with an explicit local formal-adverb allowlist for missing tanwin (not a Virastar feature). `normalizerAdapter` and the experimental fork are unchanged. No broad diacritic normalization is enabled. All proposals pass the existing bounded diff and engine validation.
