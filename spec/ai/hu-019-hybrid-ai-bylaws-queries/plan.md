# Plan - HU-019 (Grounded on-device bylaws queries)

## 1. Technical approach

Build a deterministic article retriever shared in behavior across platforms,
then allow a capability-gated on-device model to summarize only the selected
evidence. The canonical PDF and exact excerpt remain the authority. There is no
cloud inference path.

## 2. Layer impact
- UI: capability, preparation, local generation, evidence, and PDF-only states.
- Domain: article/evidence/citation values and deterministic retrieval policy.
- Data: bundled schema-v2 index and platform on-device model adapters.
- Backend: no changes; remove bylaws cloud endpoint wiring.
- Docs: ADR, requirements, spec/tasks, and issue evidence.

## 3. Platform-specific changes
### Android
- Compile ML Kit Prompt only in develop/debug while provider terms are unresolved.
- Map `AVAILABLE`, `DOWNLOADABLE`, `DOWNLOADING`, and `UNAVAILABLE` explicitly.
- Keep Release and unsupported devices PDF-only.
- Show model/retrieval diagnostics only in develop.

### iOS
- Check Foundation Models availability plus Spanish input/evidence and active Spanish or English output locale support.
- Use a fresh, cancellable session with static instructions and deterministic sampling.
- Distinguish clearly unrelated input, insufficient evidence, generation failure, and actual model unavailability.
- Keep generated summaries subordinate to exact article evidence.

### Functions/Backend
- Remove/ignore inference endpoint configuration; no function is required.

## 4. Test strategy
- Parser/index tests for articles 1-22, page ranges, and synchronized assets.
- Retrieval tests for the canonical questions plus unknown and adversarial input.
- State tests for capability, preparation, cancellation, insufficient evidence,
  unrelated input, refusal, generation failure, and output language.
- UI tests proving the composer is absent in PDF-only state and evidence is
  visible outside develop.
- Manual prompt evaluation per supported Apple/Gemini Nano model family.

## 5. Rollout and functional validation
- Validate both apps in develop before any production rollout.
- Restrict Android Prompt evaluation builds to confirmed testers aged 18 or older.
- Verify airplane-mode generation after required models are downloaded.
- Verify unsupported physical devices expose only the embedded PDF.
- Revisit Android production only after provider terms and audience eligibility permit it.

## 6. Phased implementation sequence
### Phase 1 - Grounding
- Replace page chunks with a versioned article index and canonical expected results.
- Implement and test deterministic retrieval on both platforms.

### Phase 2 - Capability-gated generation
- Implement Foundation Models on iOS.
- Implement ML Kit Prompt in Android develop/debug only.
- Implement PDF-only, preparation, evidence, error, and cancellation states.

### Phase 3 - Evaluation and closure
- Execute platform test/lint/build suites and unsupported-device checks.
- Run the canonical prompt evaluation on compatible hardware.
- Perform independent iOS architecture and SwiftUI/accessibility audits.
- Update issue evidence and completion checklists.

## 7. Technical risks and mitigation
- Risk: plausible but unsupported generated prose.
  - Mitigation: deterministic support threshold, exact evidence, fixed citations, and recurring evaluations.
- Risk: platform behavior drift.
  - Mitigation: shared canonical dataset and parity checklist.
- Risk: provider/API eligibility changes.
  - Mitigation: capability adapters and explicit Android release gate.
