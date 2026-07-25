# ADR-0006: Ground Bylaws Answers On Device

## Status

Accepted

## Date

2026-07-24

## Context

HU-019 originally described a local-first assistant that escalated complex
questions to a cloud model. The shipped implementation did not run a local
language model: it ranked whole PDF pages lexically, returned long excerpts,
and retained an optional anonymous cloud endpoint. This produced weak matches,
made the answer mode misleading, and exposed a path for sending a member's
question and document context off device.

The bylaws are a short, stable Spanish document: 13 physical PDF pages and 22
articles. A full-document prompt still exceeds the practical context budget of
some on-device models and does not make citations trustworthy. Bylaws answers
can also affect members' understanding of rights, duties, and association
governance, so generated text must never be presented as the source of truth.

iOS 26 provides the Foundation Models framework only when Apple Intelligence
and a supported Spanish locale are available. Android's ML Kit Prompt API can
use Gemini Nano through AICore on a limited set of devices. The current Prompt
artifact is labelled beta; the additional terms prohibit production use of
services labelled Preview, Experimental Access, or a similar designation, and
also prohibit clients likely to be accessed by people under 18. Pending written
provider clarification, this project conservatively treats beta as a similar
prerelease designation.

## Decision Drivers

- Keep questions and bylaws content on the device.
- Provide verifiable article and PDF-page provenance.
- Avoid a cloud dependency, credentials, cost, and network failure mode.
- Degrade predictably on unsupported hardware.
- Keep generated prose subordinate to the canonical PDF text.
- Preserve Android and iOS user-visible parity where platform terms allow it.

## Considered Options

### Full-document on-device prompt

Rejected because the complete extracted document does not fit every target
model context and a model-generated citation is not verifiable.

### Ship a custom Android model with LiteRT

Deferred for the MVP. It would avoid the ML Kit audience terms, but makes the
app responsible for a large model download, hardware acceleration,
compatibility across the API 29 device range, updates, and per-model quality
evaluation. It remains a candidate if a sufficiently small Spanish model can
meet the canonical suite on representative low- and mid-range devices.

### Deterministic retrieval with cloud generation

Rejected because it sends the question and retrieved bylaws text off device,
adds operational cost, and contradicts the approved PDF-only fallback.

### Deterministic extractive search only

Retained as the grounding layer. On its own it is reliable but does not provide
the concise, natural-language explanation requested for capable devices.

### Grounded, capability-gated on-device generation

Selected. Deterministic retrieval selects the relevant articles first. The
local model may summarize only those excerpts. The application, not the model,
owns citations and support status.

## Decision

Build a versioned local index with one chunk per article, optional final
provisions, physical PDF page ranges, and deterministic Spanish search aliases.
For every question, a pure retriever selects at most three chunks. If retrieval
does not establish sufficient support, the application does not invoke a model
or publish an answer.

On supported iOS devices, use `SystemLanguageModel.default` only when its
availability is ready and it supports both `es_ES` for the Spanish question
and evidence and the active Spanish or English output locale. Create a fresh
`LanguageModelSession` for each question with static instructions, keep user
input out of instructions, explicitly require the active app language for the
summary, use deterministic sampling, and handle refusals, guardrails,
unsupported language, cancellation, and context errors as unavailable-answer
outcomes.

Retrieve before classifying scope. If retrieval produces no evidence, classify
only unequivocally unrelated questions as out of scope; treat ambiguous or
bylaws-related questions as insufficiently supported. These two outcomes and a
generation failure have distinct localized guidance and do not disable the
composer. Only actual model or locale unavailability switches iOS to PDF-only.

On Android develop/debug builds, use ML Kit Prompt only after
`Generation.getClient().checkStatus()` reports `AVAILABLE`. A
`DOWNLOADABLE` state may offer an explicit preparation action. Other states
keep the question composer hidden. The adapter checks the prompt token budget,
uses only retrieved excerpts, and rejects empty or unsupported output. Any
develop distribution that enables this adapter is restricted to known adult
testers who have accepted the provider terms.

Android release builds do not include or invoke the prerelease Prompt service.
They remain PDF-only until the API is production-eligible and the association
confirms that its audience satisfies the provider's age terms. This is an
explicit temporary parity gap, not a cloud fallback.

Every published result shows:

- a clearly labelled generated summary;
- deterministic article and physical PDF-page citations;
- the exact retrieved source excerpt;
- permanent access to the bundled PDF;
- guidance that the PDF text prevails.

Model identifiers, retrieval scores, token counts, and failure diagnostics are
visible only in develop builds. No question, excerpt, answer, or diagnostic is
sent to a cloud inference service. Questions and canonical evidence remain in
Spanish. On iOS, the generated summary follows the active Spanish or English
app language, while official titles and excerpts remain in their original
Spanish.

## Consequences

### Positive

- Questions and generation remain local.
- Users can verify every answer against exact source text and the PDF.
- English UI users receive an English summary without translating or replacing
  the canonical Spanish evidence.
- Unsupported devices have a simple, honest PDF-only experience.
- The same article index and canonical evaluation set serve Android and iOS.
- Cloud endpoint configuration and anonymous inference paths can be removed.

### Negative

- Local Q&A is unavailable on many current devices.
- Android production initially has less functionality than capable iOS
  devices because of provider terms.
- Android develop still returns Spanish summaries and falls back after content
  failures; matching the iOS language and contextual-error behavior remains a
  temporary parity gap.
- Generated summaries can still be inaccurate and therefore require explicit
  labelling, exact evidence, and recurring evaluation.
- Model availability and output can change after operating-system or model
  updates.

## Validation and Exit Criteria

- Unit tests must prove expected top-three retrieval for the canonical Spanish
  question set and cover out-of-scope and adversarial prompts.
- State tests must prove that unavailable models, insufficient evidence,
  refusals, generation errors, and cancellation never publish an answer or
  call a cloud service.
- Each supported Apple model family must pass manual prompt evaluation on an
  Apple Intelligence device before release.
- Android develop must be evaluated on each supported Gemini Nano family.
- Android develop testers who can access Prompt must be confirmed as 18 or older.
- Enabling Android local Q&A in release requires a new review of current API
  status, terms, audience eligibility, and the Spanish evaluation suite.

## References

- [Apple Foundation Models safety guidance](https://developer.apple.com/documentation/foundationmodels/improving-the-safety-of-generative-model-output)
- [Apple Foundation Models acceptable use requirements](https://developer.apple.com/apple-intelligence/acceptable-use-requirements-for-the-foundation-models-framework/)
- [ML Kit Prompt API](https://developers.google.com/ml-kit/genai/prompt/android/get-started)
- [ML Kit GenAI additional terms](https://developers.google.com/ml-kit/genai-terms)
- [Android AI solution guide, including custom LiteRT models](https://developer.android.com/ai/overview)
