import {DocumentSnapshot, Timestamp, Transaction} from
  "@google-cloud/firestore";
import type {sheets_v4 as SheetsV4} from "googleapis";
import {coverageId, coverageMember, rejectCoverage} from "./shift-coverage.js";
import {coverageSheetRow, ShiftCoverageEffects} from
  "./shift-coverage-effects.js";
import {CoverageSubmission} from "./shift-coverage-effects-worker.js";
import {releaseCoverageInbox} from "./shift-coverage-inbox.js";
import {createProvisionalCreditFirestore} from "./shift-credit-publication.js";
import {createShiftPlanningDigest as digest} from "./shift-planning-digest.js";
import {ShiftPlanningClosedBarrierScope,
  verifyShiftPlanningIntakeBarrierEvidence} from
  "./shift-planning-intake-barrier.js";
import {createTrustedShiftPlanningIntakeBarrierAdapter,
  ShiftPlanningTrustedIntakeBarrierControlPlane,
  ShiftPlanningIntakeBarrierFailureClosurePersistence} from
  "./shift-planning-trusted-intake-barrier-adapter.js";
import {parseShiftPlanningMaintenanceState} from "./shift-planning-wire.js";
import {parseShiftPlanningPublicShiftDocument} from
  "./shift-planning-publication-contract.js";
import {ShiftSheetsConfig} from "./shift-sheets-config.js";
import {createShiftSheetsAdapter} from "./shift-sheets.js";

const version = (doc: DocumentSnapshot) => [doc.ref.path,
  doc.updateTime?.seconds ?? null, doc.updateTime?.nanoseconds ?? null];

/**
 * Fixed-demo operator recovery, behind HU-082's held, verified writer barrier.
 * Authorizations are backend-owned children of the effect, bound to the exact
 * source versions and administrator. No endpoint mints them from client input.
 * Sheets is read-only; current verified effects release inbox atomically, while
 * obsolete effects retire without an old notice. A mismatched projection keeps
 * its reservation. Interrupted sends become unknown, never safe-to-resend.
 * The injected control plane must drain coverage workers too; elapsed time or
 * closed Firestore maintenance alone is not evidence of external quiescence.
 * @param {object} input Local workbook, trusted controls, journal and clock.
 * @return {object} Inspect, reconcile an allowlisted operation or close.
 */
export const createProvisionalCoverageRecovery = (input: {
  config: ShiftSheetsConfig;
  sheets: Pick<SheetsV4.Resource$Spreadsheets, "get">;
  controlPlane: ShiftPlanningTrustedIntakeBarrierControlPlane;
  failurePersistence: ShiftPlanningIntakeBarrierFailureClosurePersistence;
  nowMillis(): number;
}) => {
  if (input.config.environment !== "develop" ||
    input.config.workbookId !== "coverage-rehearsal-book") {
    return rejectCoverage("coverage_effects_local_workbook_required");
  }
  const db = createProvisionalCreditFirestore();
  const root = "develop/plus-collections";
  const effectRef = (id: string) =>
    db.doc(`${root}/shiftCoverageEffects/${id}`);
  const reservation = db.doc(`${root}/shiftCoverageProjectionState/workbook`);
  const barrier = createTrustedShiftPlanningIntakeBarrierAdapter(input);
  const adapter = createShiftSheetsAdapter({config: input.config,
    sheets: {get: input.sheets.get.bind(input.sheets),
      batchUpdate: async () => {
        throw new Error("Coverage recovery cannot mutate Sheets");
      }}});
  const load = async (
    tx: Transaction, operationId: string, actorId: string,
  ) => {
    const [effect, receipt, maintenance, lock] = await tx.getAll(
      effectRef(operationId),
      db.doc(`${root}/shiftCoverageOperations/${operationId}`),
      db.doc(`${root}/shiftPlanningState/current`), reservation);
    const [users, shifts, pushes] = await Promise.all([
      tx.get(db.collection(`${root}/users`).limit(501)),
      tx.get(db.collection(`${root}/shifts`).limit(501)),
      tx.get(effectRef(operationId).collection("pushes").limit(501)),
    ]);
    if ([users, shifts, pushes].some((s) => s.size > 500)) {
      return rejectCoverage("coverage_recovery_source_limit");
    }
    const actor = users.docs.find((doc) => doc.id === actorId);
    if (!actor || !coverageMember(actor.data()).admin) {
      return rejectCoverage("coverage_admin_required");
    }
    const record = effect.data();
    const value = record?.value as ShiftCoverageEffects | undefined;
    if (!value) return rejectCoverage("coverage_effects_missing");
    const {effectsDigest, ...core} = value;
    if (value.operationId !== operationId || value.environment !== "develop" ||
      value.schemaVersion !== 1 || digest(core) !== effectsDigest ||
      receipt.data()?.effectsDigest !== effectsDigest ||
      !["pending", "completed", "retired"].includes(record?.state)) {
      return rejectCoverage("coverage_effects_changed");
    }
    const current = await tx.get(db.doc(
      `${root}/shiftCoverageCases/${value.caseId}`));
    if (!current.exists || digest(current.data()?.value) !==
      current.data()?.digest) return rejectCoverage("coverage_effects_changed");
    const submission = record?.submission as CoverageSubmission | undefined;
    if (submission && (digest(submission) !== record?.submissionDigest ||
      submission.operationId !== operationId ||
      digest(submission.rows) !== digest(value.changes.map((c) => c.after)))) {
      return rejectCoverage("coverage_effects_changed");
    }
    for (const push of pushes.docs) {
      const data = push.data();
      const terminal = data.state !== "submitting";
      if (record?.state !== "completed" ||
        !record?.deliveredTo?.includes(push.id) ||
        !value.notifications.some((n) => n.userId === push.id &&
          n.push.data.eventId === data.eventId) ||
        typeof data.attemptId !== "string" || !data.attemptId.trim() ||
        !(data.startedAt instanceof Timestamp) ||
        data.startedAt.toMillis() > input.nowMillis() ||
        !["submitting", "accepted", "failed", "unknown"].includes(data.state) ||
        (terminal && (!(data.completedAt instanceof Timestamp) ||
          data.completedAt.toMillis() < data.startedAt.toMillis() ||
          data.completedAt.toMillis() > input.nowMillis() ||
          data.result?.outcome !== data.state)) ||
        (!terminal && (data.result !== undefined ||
          data.completedAt !== undefined))) {
        return rejectCoverage("coverage_recovery_push_changed");
      }
    }
    const snapshots = [effect, receipt, maintenance, lock, current,
      ...users.docs, ...shifts.docs, ...pushes.docs];
    return {effect, record, value, submission, current, users, shifts, pushes,
      maintenance: parseShiftPlanningMaintenanceState(maintenance.data()),
      lock, evidenceDigest: digest(snapshots.map(version))};
  };
  const authorize = (
    source: Awaited<ReturnType<typeof load>>,
    authorization: Record<string, unknown>, actorId: string,
  ) => {
    if (Object.keys(authorization).sort().join() !==
      ["schemaVersion", "actorId", "evidenceDigest", "scope"].sort().join() ||
      authorization.schemaVersion !== 1 || authorization.actorId !== actorId ||
      authorization.evidenceDigest !== source.evidenceDigest) {
      return rejectCoverage("coverage_recovery_authorization_changed");
    }
    const scope = authorization.scope as ShiftPlanningClosedBarrierScope;
    const state = source.maintenance;
    if (!scope || scope.environment !== "develop" ||
      scope.expectedWorkbookFileId !== input.config.workbookId ||
      scope.expectedAuthoritativeDigest !== source.evidenceDigest ||
      state.maintenanceStatus !== "closed" ||
      state.stateRevision !== scope.expectedStateRevision ||
      state.writeEpoch !== scope.expectedWriteEpoch ||
      state.activeRevision !== scope.expectedActiveRevision ||
      state.activeDigest !== scope.expectedActiveDigest) {
      return rejectCoverage("coverage_recovery_maintenance_changed");
    }
    return scope;
  };
  return {
    close: () => db.terminate(),
    async inspect(operationId: string, actorId: string) {
      const source = await db.runTransaction((tx) =>
        load(tx, coverageId(operationId), coverageId(actorId)));
      return {evidenceDigest: source.evidenceDigest,
        maintenance: source.maintenance, state: source.record?.state};
    },
    async reconcile(operationIdValue: string, recoveryIdValue: string,
      actorIdValue: string) {
      const operationId = coverageId(operationIdValue);
      const recoveryId = coverageId(recoveryIdValue);
      const actorId = coverageId(actorIdValue);
      const authRef = effectRef(operationId)
        .collection("recoveryAuthorizations").doc(recoveryId);
      const resultRef = effectRef(operationId).collection("recoveries")
        .doc(recoveryId);
      const initial = await db.runTransaction(async (tx) => {
        const [auth, result] = await tx.getAll(authRef, resultRef);
        const source = await load(tx, operationId, actorId);
        if (!auth.exists || auth.data()?.actorId !== actorId) {
          return rejectCoverage("coverage_recovery_authorization_required");
        }
        const authorization = auth.data() as Record<string, unknown>;
        const authorizationDigest = digest(authorization);
        if (result.exists && result.data()?.authorizationDigest !==
          authorizationDigest) {
          return rejectCoverage("coverage_recovery_authorization_changed");
        }
        const scope = result.exists ? authorization.scope as
          ShiftPlanningClosedBarrierScope : authorize(source, authorization,
          actorId);
        return {source, authorization, authorizationDigest, scope,
          result: result.data()};
      });
      if (await input.failurePersistence.readExistingFailure({
        environment: "develop", transitionId: initial.scope.transitionId,
      })) return rejectCoverage("coverage_recovery_barrier_failed");
      if (initial.result) return {...initial.result, replayed: true};
      return barrier.withClosedIntakeBarrier(initial.scope,
        async (evidence) => {
          // The verifier takes the exact maintenance binding; inventory fields
          // belong to the enclosing trusted barrier scope, already validated.
          const request = {...initial.scope};
          Reflect.deleteProperty(request, "writerInventoryRevision");
          Reflect.deleteProperty(request, "writerInventoryDigest");
          const verify = () => verifyShiftPlanningIntakeBarrierEvidence(
            evidence, request, input.nowMillis());
          const verified = verify();
          const source = initial.source;
          const projection = source.record?.state === "pending" &&
            source.submission ? await adapter.inspect(source.submission) : null;
          if (source.record?.state === "pending" &&
            source.value.changes.length &&
            (!source.submission || projection?.kind !== "verified")) {
            return rejectCoverage("coverage_effects_readback_required");
          }
          return db.runTransaction(async (tx) => {
            const [auth, result] = await tx.getAll(authRef, resultRef);
            const fresh = await load(tx, operationId, actorId);
            if (!auth.exists || digest(auth.data()) !==
              initial.authorizationDigest) {
              return rejectCoverage("coverage_recovery_authorization_changed");
            }
            if (result.exists) {
              if (result.data()?.authorizationDigest !==
                initial.authorizationDigest) {
                return rejectCoverage(
                  "coverage_recovery_authorization_changed");
              }
              return {...result.data(), replayed: true};
            }
            authorize(fresh, initial.authorization, actorId);
            verify();
            const now = input.nowMillis();
            let state = fresh.record?.state as string;
            let deliveredTo: string[] = fresh.record?.deliveredTo ?? [];
            if (state === "pending") {
              for (const change of fresh.value.changes) {
                const doc = fresh.shifts.docs.find((d) =>
                  d.id === change.after.id);
                if (!doc || digest(coverageSheetRow(doc.id,
                  parseShiftPlanningPublicShiftDocument({
                    targetPath: doc.ref.path,
                    value: doc.data()}))) !== digest(change.after)) {
                  return rejectCoverage("coverage_effects_source_changed");
                }
              }
              if (fresh.value.changes.length &&
                fresh.lock.data()?.operationId !== operationId) {
                return rejectCoverage("coverage_effects_workbook_reserved");
              }
              const obsolete = fresh.current.data()?.digest !==
                fresh.value.caseDigest ||
                (fresh.value.action.startsWith("offer") &&
                  fresh.current.data()?.value.offer?.expiresAtMillis <= now);
              state = obsolete ? "retired" : "completed";
              deliveredTo = obsolete ? [] : releaseCoverageInbox({db, tx,
                value: fresh.value, users: fresh.users, now});
              tx.update(fresh.effect.ref, {state, projection, deliveredTo,
                completedAt: Timestamp.fromMillis(now), recoveryId});
              if (fresh.lock.data()?.operationId === operationId) {
                tx.delete(reservation);
              }
            }
            const pushes = fresh.pushes.docs.map((doc) => {
              const data = doc.data();
              if (data.state === "submitting") {
                tx.update(doc.ref, {state: "unknown", recoveryId,
                  result: {outcome: "unknown",
                    failureCode: "coverage_submission_interrupted"},
                  completedAt: Timestamp.fromMillis(now)});
              }
              return {memberId: doc.id, eventId: data.eventId,
                attemptId: data.attemptId,
                disposition: data.state === "submitting" ?
                  "unknown" : data.state};
            });
            const recovery = {schemaVersion: 1,
              operationId, recoveryId, actorId,
              authorizationDigest: initial.authorizationDigest,
              evidenceDigest: fresh.evidenceDigest,
              barrier: verified.barrier, state, projection, pushes,
              unsubmittedMemberIds: deliveredTo
                .filter((id) => !fresh.pushes.docs.some((p) =>
                  p.id === id)),
              completedAtMillis: now};
            tx.create(resultRef, recovery);
            return {...recovery, replayed: false};
          });
        });
    },
  };
};
