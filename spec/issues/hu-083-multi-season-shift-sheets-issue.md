# [HU-083] Multi-season shift Sheets and develop repair

## Tracking

- GitHub issue: #267
- URL: https://github.com/JFrancoG/ReguertaPlus/issues/267
- State: DRAFT / blocked by HU-082
- Planning branch: `codex/hu-082-shift-operations-planning`
- Implementation branch: not created
- Depends on: HU-082 / #266
- Extends: HU-020 / #19 (adapter/tooling here; conditional develop apply and all
  production acceptance are explicitly assigned below)

## Summary

Keep one stable workbook per environment and use seasonal tabs as projections of
the continuous Firestore rotations. Replace fixed-range/whole-tab behavior with
idempotent discovery, creation, merge, bounded import, and routed export. Audit
the develop test data and repair it only if the live trigger-safety gate passes;
otherwise deliver the zero-write plan/digest and exact HU-085 materialization
handoff. Then pass verified code and evidence to production activation #269.

Both environment paths share the same Firebase project-wide Functions revisions
and Firestore Rules. New code is therefore proven locally/in emulators. Any live
develop repair is a direct, bounded, digest-bound script operation compatible
with the current deployed contract; HU-083 deploys no shared Function or Rule.

## Workbook decision

- Rename the stable workbook if desired; its shared link/ID remains valid.
- Do not create a new workbook every season by default.
- Create/merge seasonal tabs automatically from actual shift dates.
- Firestore owns the queue; Sheet edits may not move its cursor.
- Any imported/manual delivery-lead change validates distinct adjacent leads plus
  predecessor/current/successor completion/revisions across tabs. It recomputes only
  an uncompleted predecessor's planned helper; completed actual helper history and
  rotation ownership remain immutable.

## Links

- Spec: `spec/shifts/hu-083-multi-season-shift-sheets/spec.md`
- Plan: `spec/shifts/hu-083-multi-season-shift-sheets/plan.md`
- Tasks: `spec/shifts/hu-083-multi-season-shift-sheets/tasks.md`
- ADR: `docs/decisions/0013-model-shifts-as-continuous-rotations-with-seasonal-projections.md`

## Delivery gate

- [ ] HU-082 and ADR-0013 integrated.
- [ ] Multi-season adapter and migration tests green.
- [ ] Local/emulator request, adapter, and notification contract green.
- [ ] Compatible direct-script develop audit, dry-run, repair, read-back, and
  forward/inverse commit rehearsal in an isolated restored clone green before live
  apply, or apply is explicitly deferred to HU-085 with live
  baseline unchanged and equivalent emulator/read-back/recovery evidence.
- [ ] A live develop apply inventories and recoverably fences/drains every Firestore/
  workbook writer, immediately rehashes both stores, uses per-document update-time
  CAS plus per-batch workbook revision/digest checks, and retains the fence through
  read-back/rollback rehearsal. If that bounded multi-store fence cannot be proved,
  the only allowed branch is zero-write deferral to HU-085.
- [ ] The writer gate includes My Drive owner feasibility, transitive group/domain/
  DWD/Workspace authority, and pending offline edits; any unprovable path forces
  zero-write deferral.
- [ ] The direct script has a named, timeboxed, keyless repair principal/workload in
  the manifest, exact develop targets/actions plus app guards, explicit database-
  scoped IAM blast radius, sole-writer proof, terminal revocation, and audit read-back.
  Any project-wide/production fence or unisolated authority forces HU-085 deferral.
- [ ] A separate keyless evidence auditor captures exact develop Firestore/workbook
  backups with read/export-only source access and create-only encrypted, ACL- and
  retention-bound evidence output, then is revoked/read back before apply.
- [ ] Safe apply records an immutable two-type post-repair baseline revision/
  digest; deferred apply records the expected digest/materialization manifest and
  writes no live baseline. A successful live apply ends in the repaired state; the
  inverse is not applied live merely as a rehearsal.
- [ ] Audit resolves each type's HU-082 bootstrap source/order/round/cursor and the
  delivery predecessor-helper constraint, or requires an explicit approved mapping;
  apply/deferred handoff persists/materializes that exact mapping and digest.
- [ ] No shared-project Functions/Rules deploy or live planning notification.
- [ ] HU-085 receives the integrated code and complete non-secret develop
  evidence; its deferred branch receives only manifests/dry-runs, never the HU-083
  principal/credential, and no production mutation occurs in HU-083.

## Suggested labels

- `type:feature`
- `area:shifts`
- `platform:backend`
- `priority:P1`
