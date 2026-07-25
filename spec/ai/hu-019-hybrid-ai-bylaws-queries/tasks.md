# Tasks - HU-019 (Grounded on-device bylaws queries)

## 1. Preparation
- [x] Reopen issue and approve no-cloud/PDF-only fallback.
- [x] Record architecture and provider constraints in ADR-0006.
- [x] Generate schema-v2 article index with page provenance.
- [x] Enrich canonical questions with expected evidence and safety facts.
- [x] Prove article retrieval RED/GREEN on both platforms.

## 2. Android implementation
- [x] Remove cloud endpoint and gateway wiring.
- [x] Implement deterministic article retrieval.
- [x] Integrate ML Kit Prompt only in develop/debug.
- [x] Implement capability/download/PDF-only states.
- [x] Keep citations and exact excerpts visible outside develop.

## 3. iOS implementation
- [x] Remove cloud endpoint and gateway wiring.
- [x] Implement deterministic article retrieval.
- [x] Integrate Foundation Models with Spanish input/evidence and active Spanish or English output gates.
- [x] Keep the composer available with distinct unrelated, insufficient-evidence, and generation-failure guidance.
- [x] Cancel replaced, cleared, and abandoned generation tasks.
- [x] Keep citations and exact excerpts visible outside develop.

## 4. Backend / privacy
- [x] Prove no inference request leaves either app.
- [x] Remove obsolete bylaws cloud configuration.
- [x] Keep the canonical PDF bundled; no Firebase Storage dependency.

## 5. Testing
- [x] Execute parser/index and canonical retrieval tests.
- [x] Execute iOS unit/build/preview validations.
- [x] Execute Android unit/lint/device UI validations.
- [ ] Validate PDF-only behavior on unsupported physical Android and iOS devices.
- [ ] Evaluate supported Apple model families with canonical and adversarial prompts.
- [ ] Evaluate supported Gemini Nano families in develop.

## 6. Documentation
- [x] Update requirements and ADR in English and Spanish.
- [x] Keep linked issue evidence current.
- [x] Document the temporary Android Release and develop language/error-state parity gaps.

## 7. Closure
- [x] Reopen and update linked issue.
- [ ] Complete DoD checklist in spec.md.
- [x] Attach automated test evidence and functional validation output.
- [ ] Create PR and link it to issue #20.

## Automated evidence (2026-07-25)

- Canonical parser/index: 6/6 tests; Android/iOS/canonical JSON files are byte-identical.
- Android: 138/138 debug unit tests, lint, Release compilation, and 11/11 bylaws state tests pass.
- Android Release compile/runtime classpaths contain no `genai-prompt`; the dependency is Debug-only.
- Android instrumentation passes 13/13 tests on both Pixel 8 Pro API 35 and Pixel 9 Pro XL API 37
  emulators. The connected Xiaomi API 34 still rejects installation with `INSTALL_FAILED_USER_RESTRICTED`.
- iOS: `Reguerta-Develop` builds through Xcode MCP; 39/39 bylaws-specific tests pass and there are no
  Navigator issues in the touched bylaws files.
- Full iOS suite runs still expose intermittent failures outside HU-019; the two failures in the root
  run passed on immediate isolated rerun. SwiftLint reports 0 serious violations and 5 unrelated warnings.
- iOS previews render local and PDF-only states, a six-line query, the longest real article, and the
  real PDF at Large, XX Large, XXX Large, AX5, and compact landscape sizes.
- Independent iOS architecture and SwiftUI/accessibility reaudits report no open findings.
