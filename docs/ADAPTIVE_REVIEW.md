# Adaptive review and host Persian lexicon (experimental SDK)

Independently authored implementation based on architectural inspection, not copied upstream code or redistributed language data:

- [NeveshtYar spell engine](https://github.com/FarsioIR/NeveshtYar/blob/main/spell_correction.js), blob ad35252d9f54117cbf91b09c377ef2f749b765a7: bounded one-edit candidate enumeration, exact lexical membership and cache. Its dictionaries, normalization, morphology and calibration are separate work.
- [TypeAssist Engine](https://github.com/mkovich/TypeAssist/blob/main/src/Engine/Engine.cs): explicit rejected corrections and bounded learning. PWE deliberately does not learn from raw typing or blacklist a source word permanently.
- [WriteRight merger](https://github.com/iamadarsha/WriteRight/blob/main/src/engine/suggestion-merger.ts), blob 39fb1a3d75f43718b619b2d4c8e231d82abf973d: deduplication. PWE preserves overlapping and advisory findings instead of selecting a single winner.
- [SpellChecker ranker](https://github.com/sanskarIN/SpellChecker/blob/main/lib/core/spell_suggestion_ranker.dart), blob c79e190b21a20098b7ea30d05303386e73c5c2d6: deterministic ordering of eligible candidates.

`createAdaptiveReview()` accepts an already validated host document and engine report. It validates source anchoring and region eligibility again, groups exact spans/categories, deduplicates identical replacements with provenance, and allows one explicit spelling vote per issue per session. Old sessions are invalidated on a new review. Preferences never generate, apply, hide, or authorize edits. Scores are preference weights, not linguistic probabilities. A profile contains exact single-word source/replacement pairs and bounded counts; it can contain sensitive words. Host must obtain consent, isolate user/vendor scopes and protect persistence. Demo is opt-in, in-memory only and clears on reload/disable. No document text or snapshots in profile.

`createPersianLexiconProvider({words})` accepts a bounded array of host-owned simple Persian words. It enumerates single edits on unknown eligible words, skips ZWNJ/diacritics and returns bounded review-only suggestions. No dictionary or frequency corpus is bundled; there is no claim of general Persian spelling accuracy, name recognition or morphology. Use only trusted, licensed dictionaries and authoritative protected regions; do not enable by default without independent validation.

```js
import {createAdaptiveReview,createPersianLexiconProvider,createEngine} from 'procurement-writing-engine';
const prefs=createAdaptiveReview();
const lexicon=createPersianLexiconProvider({words:['مشخصات','ارسال','کنید']});
const engine=createEngine([lexicon]);
// document must be a valid host-authoritative snapshot.
const report=await engine.analyze(document);
const review=prefs.prepare(document,report);
// on explicit user feedback only: review.record(groupIndex,candidateIndex,'prefer');
// host may persist prefs.exportProfile() only with appropriate consent and isolation.
```

Limitations: no persistent demo store, no full lexicon integration, no GEC tagger, no semantic NER, no hidden holdout qualification. Research branch only.
