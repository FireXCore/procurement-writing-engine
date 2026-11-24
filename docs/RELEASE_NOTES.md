# Procurement Writing Engine 0.1.0-alpha.4

Fix the human-reported formal Persian spelling omission لطفا → لطفاً. The default Virastar adapter composes a small exact-word local formal-writing allowlist with upstream normalization, without changing upstream options. Already marked and unrelated words remain unchanged by the new policy. All Alpha.3 regressions remain required, including protected ranges, independent patches and isolated RTL/LTR display.

GitHub prerelease only; npm publication remains disabled pending final acceptance. No general Persian spelling/diacritization guarantee, no automatic Apply, no new dependency, no production qualification.
