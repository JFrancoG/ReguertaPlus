# [HU-019] On-device grounded bylaws queries

## Summary

As a member I want fast bylaws answers so that I can resolve questions quickly.

## Links
- Spec: spec/ai/hu-019-hybrid-ai-bylaws-queries/spec.md
- Plan: spec/ai/hu-019-hybrid-ai-bylaws-queries/plan.md
- Tasks: spec/ai/hu-019-hybrid-ai-bylaws-queries/tasks.md

## Acceptance criteria

- [x] The local index is segmented by article/final provision with article and physical PDF-page provenance.
- [x] Retrieval deterministically includes the expected articles in the top three for canonical Spanish questions.
- [x] iOS uses Foundation Models only when the on-device model is available and supports `es_ES` plus the active Spanish or English output locale.
- [x] Android develop/debug uses ML Kit Prompt only when AICore reports `AVAILABLE`; `DOWNLOADABLE` offers explicit preparation.
- [x] Android Release remains PDF-only until the provider API and audience terms are production-eligible.
- [ ] Android Prompt evaluation builds are distributed only to confirmed testers aged 18 or older.
- [x] The model summarizes only retrieved excerpts; support status and citations are deterministic.
- [x] Every published answer shows a labelled local summary, article/pages, exact source excerpt, and PDF access.
- [x] Unsupported device, unrelated input, insufficient evidence, refusal, cancellation, or generation error publishes no answer; only model unavailability leaves the PDF-only path on iOS, while content failures keep distinct retry guidance and PDF access.
- [x] No question, excerpt, answer, or diagnostic is sent to cloud inference.
- [x] Model identifiers, scores, token counts, and failure diagnostics are develop-only.
- [x] Unit/state/device UI tests cover retrieval, capability, fallback, evidence visibility, and cancellation.
- [ ] Compatible physical devices pass the Spanish canonical and adversarial evaluation set.

## Agreed implementation direction
- PDF access is permanent and is the only fallback.
- Questions and canonical evidence remain in Spanish; iOS summaries follow the active Spanish or English app language.
- Generated prose is labelled as a summary and never replaces exact evidence.
- Model identifiers, scores, token counts, and routing diagnostics are develop-only.
- Android's temporary Release gap is documented in ADR-0006.
- Android develop Prompt testing is restricted to confirmed adult testers.

## Scope
### In Scope
- Implement the grounded local path and PDF-only fallback for RF-IA-01.
- Add canonical retrieval and prompt-evaluation coverage.

### Out of Scope
- Cloud inference and backend endpoints.
- Firebase develop app registration and App Distribution.
- Enabling Android generation in production before a new provider-term review.

## Implementation checklist
- [x] Android
- [x] iOS
- [x] Remove obsolete cloud wiring
- [ ] Testing
- [x] Documentation

## Automated evidence (2026-07-25)

- Canonical parser/index: 6/6 tests; Android/iOS/canonical JSON files are byte-identical.
- Android: 138/138 debug unit tests, lint, Release compilation, and 11/11 bylaws state tests pass.
- Android Release compile/runtime classpaths contain no `genai-prompt`; it is Debug-only.
- Android instrumentation passes 13/13 tests on both Pixel 8 Pro API 35 and Pixel 9 Pro XL API 37
  emulators. The connected Xiaomi API 34 still rejects installation with `INSTALL_FAILED_USER_RESTRICTED`.
- iOS: `Reguerta-Develop` builds through Xcode MCP; 39/39 bylaws-specific tests pass and there are no
  Navigator issues in the touched bylaws files.
- Full iOS suite runs still expose intermittent failures outside HU-019; the two failures in the root
  run passed on immediate isolated rerun. SwiftLint reports 0 serious violations and 5 unrelated warnings.
- iOS previews render local and PDF-only states, a six-line query, the longest real article, and the
  real PDF at Large, XX Large, XXX Large, AX5, and compact landscape sizes.
- Independent iOS architecture and SwiftUI/accessibility reaudits report no open findings.

## Suggested labels
- type:feature
- area:ai
- platform:cross
- priority:P3
