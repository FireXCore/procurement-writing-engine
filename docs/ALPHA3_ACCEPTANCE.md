# Alpha.3 acceptance

Scope: independent Persian correction display, automatic language UX, and isolated identifier-shaped demo spans. All earlier Alpha.2 cases remain regression requirements.

- Two separate half-space corrections, three adjacent/separated glyph corrections, exact normalized reconstruction, repeated words, whitespace and grapheme alignment.
- Reject unsafe output, unexpected line break changes, excessive edit counts or matrix size.
- Isolated uppercase alphanumeric identifiers with separators are protected, and neighboring eligible prose can be reviewed. Explicitly label inferred ranges.
- Lowercase or mixed-case ambiguous codes, embedded email-like tokens, underscores and mixed-script ambiguity remain excluded; no general production parser is claimed.
- Chromium checks direction isolation, separate messages, no language buttons, exact source preservation, cancellation, invalidation and no external traffic.
- SDK requires authoritative host regions; no automatic apply or changes to authorization.
- npm/other registry publication remains blocked pending human acceptance. Optional real services and broad independent language/industrial corpus qualification are out of scope.

See the GitHub CI run for actual execution results.
