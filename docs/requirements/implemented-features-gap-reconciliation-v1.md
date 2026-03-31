# Implemented Features Reconciliation (Android+iOS vs MVP Docs) v1

Date: 2026-03-07
Scope: Extracted from currently implemented Android/iOS apps and compared against current MVP requirements/spec artifacts.

## 1. Sources reviewed

- `/Users/jesusf/Documents/APPs/Reguerta/features-implementadas-android.md`
- `/Users/jesusf/Documents/APPs/Reguerta/features-implementadas-ios.md`
- Current canonical docs in `docs/requirements` and `spec`.

## 2. Already covered in current docs

- Auth + whitelist/authorization flow and role-based access.
- Weekly order windows, blocked day, previous-week order view, commitments.
- Producer received-orders views (by product/by member).
- Product CRUD baseline with stock controls.
- Admin user management and role safeguards.
- Push notifications and reminders.
- Device registry and last active device pointer:
  - `users/{userId}/devices/{deviceId}`
  - `users.lastDeviceId`

## 3. Missing feature essence not yet formalized

| Candidate ID | Essence to preserve | Seen in app(s) | Proposed target docs |
|---|---|---|---|
| CAND-APP-01 | Remote startup/version control with forced and optional update modes | Android+iOS | `mvp-requirements`, `user-stories`, notification/app startup specs |
| CAND-APP-02 | Critical-data freshness gate before entering `My order`, with timeout/retry UX | Android+iOS | `mvp-requirements`, `user-stories`, ordering specs |
| CAND-APP-03 | Session/token refresh lifecycle and explicit session-expired UX | Android+iOS | `mvp-requirements`, auth/app startup stories/specs |
| CAND-APP-04 | Foreground-triggered selective synchronization with throttling/TTL | Android+iOS | `mvp-requirements` + Firestore structure notes |
| CAND-CAT-01 | Product image pipeline (pick, crop/resize, upload to Storage, URL persistence) | Android+iOS | catalog requirements/stories/specs |
| CAND-CAT-02 | Producer bulk availability toggle (all available / all unavailable, vacation mode style) | iOS (explicit), Android (adjacent settings intent) | catalog requirements/stories/specs |
| CAND-ENV-01 | Runtime environment strategy beyond reviewer (`local`/`develop`/`production`) | iOS (explicit), Android (build-based develop/production) | non-functional + operations docs |
| CAND-DATA-01 | Remote per-collection timestamps used as sync contract | Android+iOS | Firestore structure/ops docs |

## 4. Conflicts detected

- Unauthorized user behavior differs:
  - Current iOS: can force logout.
  - Current target docs: stay signed-in in restricted mode until admin authorization.
- Hard delete still exists in current apps for some entities:
  - Current target docs: logical delete/deactivate (`archive`/`baja`) is preferred.
- Status naming mismatch across legacy and new contract:
  - Legacy Spanish values appear in multiple app flows.
  - Canonical Firestore contract now defines English enum values.
- Feature exposure mismatch:
  - News/settings/orders placeholders exist in code but are not fully exposed as functional modules.

## 5. Decision questions to close before full propagation

1. Should `CAND-APP-01` (forced/optional remote update control) be a formal MVP requirement?
2. Should `CAND-APP-02` freshness gate for `My order` remain mandatory in MVP UX?
3. Should we keep unauthorized handling as restricted mode (no logout), and deprecate logout-on-unauthorized behavior?
4. Should we formalize producer bulk availability toggle (`CAND-CAT-02`) in MVP?
5. Should product image handling (`CAND-CAT-01`) be explicit MVP scope or implementation detail?
6. Should `local` runtime environment support stay in scope, or keep only `develop`/`production` (+ reviewer override)?
7. Should timestamp-based sync orchestration (`CAND-DATA-01`) be part of requirements, or remain internal technical strategy?

## 6. Next step after answers

After answers to Section 5, propagate final decisions consistently to:

- `docs/requirements/*`
- `docs-es/requirements/*`
- impacted `spec/*`
- issue markdown artifacts (and GitHub issues where applicable).

## 7. Resolution log

Resolved on 2026-03-07:
- Q1: Option A
- Q2: Option A
- Q3: Option A
- Q4: Option A

Clarification added on 2026-03-30:
- Q3 remains resolved as restricted mode (no forced logout for unauthorized users).
- Detailed unauthorized-home UX, disabled module behavior, and sign-out affordance are tracked separately in HU-038 to avoid mixing them with session-expiry work from HU-023.
- Q5: Option A
- Q6: Option A
- Q7: Option A

Resolution summary:
- All seven candidate areas are accepted for formal MVP documentation and implementation tracking.

## 8. Propagation status

Propagation completed on 2026-03-07:
- Requirements updated with RF-APP-01..RF-APP-05 and RF-CAT-07..RF-CAT-08.
- User stories HU-021..HU-025 moved from candidate to active scope.
- Firestore contracts updated for environment-scoped startup/sync config.
- Spec-driven artifacts added for HU-021..HU-025 (EN) with issue markdown and GitHub issues.
