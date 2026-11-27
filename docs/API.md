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

## Experimental host integration (research branch)

`resolveSourceRange(source, span)` maps explicit UTF-16, codepoint or UTF-8 half-open offsets to the exact original string, rejects invalid grapheme boundaries and verifies the substring. Never use offsets into normalized or concatenated model input.

`protectEntitySpans(document, {snapshotId, spans})` adds protection to an authoritative partition, never authorizes new prose. A stale or invalid batch throws atomically; callers must fail closed and not analyze the unrefined map. Host must verify live snapshot identity. Entity detection completeness is not guaranteed.

`createContextualProvider({infer, languages})` accepts a trusted host-configured inference callback receiving admitted prose and AbortSignal. It returns structured candidates (unit, start, end, original, replacement, category). Invalid batches are rejected. This is an integration contract, not a bundled model or privacy sandbox. The host must qualify locality, semantic safety and model assets. No automatic model download or dependency added. All suggestions remain review-only.

### Local generation bridge (experimental)

`createLocalGenerationProvider({generator,languages})` uses an already initialized Transformers.js-compatible chat pipeline, with bounded deterministic generation and strict JSON source edits. Only admitted prose is sent to the host callable. Missing, ambiguous or overlapping anchors, nonlocal rewrites, selected contract and polarity changes, and nonminimal spelling edits are rejected. The direct contextual provider now uses the same conservative policy; style and terminology rewrites are rejected. This is not semantic equivalence, automatic model loading, a privacy sandbox, or evidence of actual model accuracy. Host owns verified offline assets, runtime, network policy, worker termination and model qualification. See https://huggingface.co/docs/transformers.js/en/api/pipelines . Five grouped adapter checks were exercised with simulated generation outputs; real-model inference was not exercised.

### Explicit Transformers.js lifecycle (experimental)

`createTransformersProvider` connects the existing generation bridge to an isolated host-provided Transformers.js runtime. It requires `allowLocalModels=true`, `allowRemoteModels=false`, a local model identifier, and explicit asset provisioning. It requests `local_files_only:true`. WebGPU is the default; WASM fallback occurs only if explicitly enabled and has a separate precision setting. Runtime globals are not modified. Generation is single-flight, cooperatively interruptible when the runtime supports it, and disposed explicitly. The host must enforce offline network policy, verified local WASM/model assets, cold-load deadlines, worker termination and resource budgets. A model or its runtime is not bundled.

Example (host must provision a compatible model under its localModelPath first):

```js
import * as runtime from '@huggingface/transformers';
import {createEngine,createTransformersProvider} from 'procurement-writing-engine';
runtime.env.allowRemoteModels=false;
runtime.env.allowLocalModels=true;
runtime.env.localModelPath='/models/';
// Host also configures local WASM assets and enforces network isolation.
const neural=await createTransformersProvider({
  runtime,model:'pwe/qwen-text',device:'webgpu',dtype:'q4',fallbackToWasm:true
});
const text='Please chek the quotation.';
try{
  const report=await createEngine([neural.provider]).analyze({
    text,snapshotId:'synthetic',regions:[{start:0,end:text.length,kind:'prose',language:'en'}]
  });
  console.log(report);
}finally{await neural.dispose();}
```

Candidate model: https://huggingface.co/onnx-community/Qwen3.5-0.8B-Text-ONNX . Runtime version, exact model revision, files, license, precision, Persian/English accuracy and WebGPU/WASM performance require independent qualification. The adapter tests use simulated model output, not real inference. See https://huggingface.co/docs/transformers.js/en/api/env and https://huggingface.co/docs/transformers.js/api/generation/stopping_criteria .
