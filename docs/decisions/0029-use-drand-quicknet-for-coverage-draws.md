# ADR-0029 · Use drand Quicknet for coverage draws

## Status

Selected for the HU-084 implementation candidate on 21 November 2026. Shared environment activation remains pending. [Assembly rule D09](../../spec/shifts/hu-084-stable-shift-coverage-and-credits/ratification.md)

## Decision

After reserves and volunteers are exhausted, the backend freezes the candidates, their exclusions and the shift context. The same Firestore transaction records the Quicknet chain, verification key, future round and scheduled publication time. The backend picks the first round scheduled at least five minutes after its clock reading. Before revealing the result it verifies that Firestore actually recorded the commitment before that round became public. [Commit and reveal](../../functions/src/shift-coverage-store.ts)

Quicknet publishes a threshold BLS signature for each numbered round. The backend requests only the committed chain and round. It checks the signature against the pinned key and checks that its SHA-256 digest matches the published randomness. The existing ranking algorithm then uses that randomness and the commitment to order the eligible participants. The evidence and ordered list stay with the case. A refusal advances the list and each offer still requires acceptance. The relay receives only public chain and round identifiers. [Quicknet parameters](https://docs.drand.love/blog/2023/10/16/quicknet-is-live/) · [Protocol](https://docs.drand.love/docs/specification/) · [Verifier](../../functions/src/shift-coverage-drand.ts)

## Outages and recovery

The first failed verification records the incident and queues one generic notification for the administrator making the request. An administrator can open the case and check the same round again while its phase remains open. The provider request runs outside Firestore transactions. Before recording its result the backend rechecks authorization, revision, shift and commitment. If the next eligible public round falls outside the draw window, administration takes over without creating a commitment. A commitment that reached Firestore late also goes directly to administrative resolution. The original case retains its evidence on cancellation and reopening. [Local acceptance](../../spec/shifts/hu-084-stable-shift-coverage-and-credits/review.md#d09-public-draw-on-21-november-2026)

The draw relies on the Quicknet threshold participants to keep a future signature unpredictable. The relay can delay or withhold a response. A chain or key change requires a reviewed provider update and preserves the original verification parameters of existing draws.
