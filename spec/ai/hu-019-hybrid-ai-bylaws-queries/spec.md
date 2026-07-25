# HU-019 - Grounded on-device bylaws queries

## Metadata
- issue_id: #20
- priority: P3
- platform: both
- status: in-progress

## Context and problem

The existing page-level lexical search does not provide concise or reliably
grounded answers. The replacement must keep the question and bylaws text on
device, expose exact evidence, and degrade to the bundled PDF instead of
silently using cloud inference.

## User story

As a member I want fast bylaws answers so that I can resolve questions quickly.

## Scope

### In Scope
- Versioned article-level index for the Spanish bylaws.
- Deterministic top-three article retrieval with physical PDF-page provenance.
- On-device summarization in the active app language on capable iOS devices, with Spanish questions and evidence.
- On-device Spanish summarization in Android develop/debug on capable AICore devices.
- PDF-only experience when the local model is unavailable, with contextual retry guidance for content and generation failures.
- Canonical retrieval and prompt evaluation dataset.

### Out of Scope
- Cloud inference or upload of questions, excerpts, answers, or diagnostics.
- Android production generation while ML Kit Prompt remains ineligible under current provider terms.
- Legal interpretation or automated decisions about member rights.
- Firebase develop app registration and App Distribution setup.

## Linked functional requirements

- RF-IA-01

## Acceptance criteria

- The bundled canonical PDF is always accessible.
- The index contains unique articles 1 through 22 with valid physical PDF page ranges.
- Retrieval deterministically includes the expected articles in the top three for the canonical Spanish questions.
- A model receives only the question and retrieved excerpts; it never selects its own citations.
- Every published answer shows a clearly labelled local summary, article/page citations, the exact source excerpt, and PDF access.
- Unrelated input, insufficient evidence, model unavailability, unsupported input/output locale, refusal, guardrail, cancellation, or generation error publishes no answer.
- Model unavailability leaves the PDF-only path; unrelated input, insufficient evidence, and generation failure have distinct contextual messages while the composer and PDF access remain available.
- No question, excerpt, answer, or diagnostic is sent to cloud inference.
- Model/routing diagnostics are hidden in production.
- iOS enables generation only when Foundation Models is available and supports both `es_ES` for the question/evidence and the active Spanish or English output locale.
- Android enables generation only in develop/debug and only when ML Kit Prompt reports `AVAILABLE`; Release is PDF-only until the provider gate is revisited.
- Android develop distribution enables Prompt only for confirmed adult testers.

## Dependencies

- Base references: docs-es/requirements/requisitos-mvp-reguerta-v1.md.
- Functional references: docs-es/requirements/historias-usuario-mvp-reguerta-v1.md.
- Data references: docs-es/requirements/firestore-estructura-mvp-propuesta-v1.md.
- ADR-0006 defines the grounding, privacy, capability, and provider-term boundaries.
- The canonical source is `data/source/reguerta-estatutos.pdf`.

## Risks

- Generated summaries can misstate governance rules.
  - Mitigation: deterministic evidence, exact excerpts, explicit non-authoritative labelling, and no answer without sufficient support.
- Model behavior can change with OS/model updates.
  - Mitigation: canonical prompt evaluation per supported model family.
- Many devices do not support local generation.
  - Mitigation: PDF-first design with capability checks before exposing the composer.
- Android provider terms currently block release use and may exclude the association's audience.
  - Mitigation: compile/invoke Prompt only in develop/debug until a new eligibility review.

## Definition of Done (DoD)

- [ ] Story acceptance criteria validated.
- [x] Implementation aligned with linked RFs and ADR-0006.
- [x] Android/iOS parity reviewed or temporary gap documented.
- [ ] Agreed tests executed.
- [x] Technical/functional documentation updated.
- [x] Issue reopened and linked.
- [ ] PR linked.

## Validation notes

- The previous hybrid implementation evidence does not close this revised story.
- Simulator/unit validation can prove retrieval, state, cancellation, and fallback behavior.
- Foundation Models output still requires an Apple Intelligence-capable physical device.
- Android generation requires a supported AICore/Gemini Nano device; the connected Xiaomi validates only the PDF-only path.
