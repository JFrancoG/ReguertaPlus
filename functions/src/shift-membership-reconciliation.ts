import {SHIFT_PLANNING_FIRESTORE_TRANSACTION_WRITE_LIMIT} from
  "./shift-planning-bundle.js";
import {Firestore, Transaction} from "@google-cloud/firestore";
import {createShiftPlanningDigest as digest} from "./shift-planning-digest.js";
import {coverageId, coverageMember, rejectCoverage,
  SHIFT_COVERAGE_POLICY_REVISION} from "./shift-coverage.js";
import {CoverageReserve} from "./shift-coverage-selection.js";
import {buildShiftCoverageOpening} from "./shift-coverage-opening.js";
import {parseShiftPlanningPublicShiftDocument} from
  "./shift-planning-publication-contract.js";
import {parseShiftRotationAggregateWire} from "./shift-planning-wire.js";
import {captureShiftPlanningWriterAuthority} from
  "./shift-planning-writer-authority.js";

const root = "develop/plus-collections";
const types = ["delivery", "market"] as const;
const hash = (values: string[]) => digest(values).split(":").at(-1) as string;
type Intent = {schemaVersion: 1; environment: "develop"; operationId: string;
  userId: string; expectedRevision: number};
export type MemberSource = {isActive: boolean; roles: string[];
  isCommonPurchaseManager: boolean} | null;
export type MembershipState = {
  schemaVersion: 1; policyRevision: typeof SHIFT_COVERAGE_POLICY_REVISION;
  userId: string; revision: number; source: MemberSource; eligible: boolean;
  observedAtMillis: number; pendingQueueTransition: boolean;
  admissionAfterRound: {delivery: number; market: number};
  admissionRequired?: {delivery: boolean; market: boolean};
};

export const readShiftMembershipState = (
  data: Record<string, unknown> | undefined, userId: string,
): MembershipState | null => {
  if (!data) return null;
  const state = data.value as MembershipState;
  if (!state || data.digest !== digest(state) || state.userId !== userId ||
      state.schemaVersion !== 1 ||
      state.policyRevision !== SHIFT_COVERAGE_POLICY_REVISION ||
      !Number.isSafeInteger(state.revision) || state.revision < 1 ||
      state.revision >= Number.MAX_SAFE_INTEGER ||
      !Number.isSafeInteger(state.observedAtMillis) ||
      state.observedAtMillis < 0 ||
      typeof state.pendingQueueTransition !== "boolean" ||
      (state.admissionRequired !== undefined && (!state.admissionRequired ||
        Object.keys(state.admissionRequired).sort().join() !==
          "delivery,market" ||
        types.some((type) => typeof state.admissionRequired?.[type] !==
          "boolean"))) ||
      state.eligible !== (state.source ?
        coverageMember(state.source).eligible : false) ||
      !types.every((type) => Number.isSafeInteger(
        state.admissionAfterRound?.[type]) &&
        state.admissionAfterRound[type] >= 0)) {
    return rejectCoverage("invalid_shift_membership_state");
  }
  return state;
};

/**
 * Until whole-unit queue transitions are implemented, a reconciled departure or
 * re-entry must not become plannable merely because the current roster matches
 * its old cohort again. Reuse this fence at source capture and activation.
 * @param {Firestore} db Fixed provisional emulator client.
 * @param {Transaction} transaction Planning source transaction.
 */
export const assertNoPendingShiftMembership = async (
  db: Firestore, transaction: Transaction,
): Promise<void> => {
  const states = await transaction.get(db.collection(
    `${root}/shiftMembershipState`).limit(251));
  if (states.size > 250) return rejectCoverage("membership_source_limit");
  for (const doc of states.docs) {
    if (readShiftMembershipState(doc.data(), doc.id)?.pendingQueueTransition) {
      return rejectCoverage("membership_queue_transition_pending");
    }
  }
};

/**
 * One member, both reserve pools and every affected published future position
 * reconcile atomically. Only the fixed-emulator store composes this adapter.
 * Existing cohort members start as a baseline, not a new join.
 * Re-entry resets FIFO time; cohort inclusion does not end reserve status.
 * Queue edits/tombstones wait for whole-unit publication, never applied
 * independently. Receipts retain exact source time, actor and changes.
 * @param {Firestore} db Fixed provisional emulator client.
 * @param {Function} clock Trusted clock, reevaluated on transaction retries.
 * @return {object} Administrative reconciliation command.
 */
export const createShiftMembershipReconciliation = (
  db: Firestore, clock: () => number,
) => ({
  async reconcileMembership(value: unknown, actorMemberId: string) {
    const intent = value as Intent | undefined;
    if (!intent || intent.schemaVersion !== 1 ||
        intent.environment !== "develop" ||
        Object.keys(intent).sort().join() !==
        "environment,expectedRevision,operationId,schemaVersion,userId" ||
        !Number.isSafeInteger(intent.expectedRevision) ||
        intent.expectedRevision < 0 ||
        intent.expectedRevision >= Number.MAX_SAFE_INTEGER) {
      return rejectCoverage("invalid_membership_command");
    }
    const actorId = coverageId(actorMemberId);
    const userId = coverageId(intent.userId);
    const operationId = coverageId(intent.operationId);
    const commandDigest = digest({intent, actorId});
    const ref = (collection: string, id: string) =>
      db.doc(`${root}/${collection}/${id}`);
    return db.runTransaction(async (transaction) => {
      const now = clock();
      if (!Number.isSafeInteger(now) || now < 0) {
        return rejectCoverage("invalid_coverage_clock");
      }
      const stateRef = ref("shiftMembershipState", userId);
      const receiptRef = ref("shiftMembershipOperations", operationId);
      const [actor, member, stateDoc, receipt, maintenance, ...rotationDocs] =
        await transaction.getAll(ref("users", actorId), ref("users", userId),
          stateRef, receiptRef, ref("shiftPlanningState", "current"),
          ...types.map((type) => ref("shiftRotations", type)));
      if (!coverageMember(actor.data()).admin) {
        return rejectCoverage("coverage_actor_forbidden");
      }
      const authority = captureShiftPlanningWriterAuthority(maintenance.data());
      if (!authority) return rejectCoverage("coverage_authority_required");
      if (receipt.exists) {
        if (receipt.data()?.commandDigest !== commandDigest) {
          return rejectCoverage("membership_operation_conflict");
        }
        return {result: receipt.data()?.result, replayed: true};
      }
      const previous = readShiftMembershipState(stateDoc.data(), userId);
      if ((previous?.revision ?? 0) !== intent.expectedRevision) {
        return rejectCoverage("membership_revision_conflict");
      }
      if (previous?.pendingQueueTransition && !previous.admissionRequired) {
        return rejectCoverage("membership_admission_evidence_required");
      }
      if (previous && now < previous.observedAtMillis) {
        return rejectCoverage("invalid_coverage_clock");
      }
      const memberValue = member.data();
      const eligible = member.exists ? coverageMember(memberValue).eligible :
        false;
      const source: MemberSource = memberValue ? {
        isActive: memberValue.isActive,
        roles: [...new Set<string>(memberValue.roles.map((role: string) =>
          role.trim().toLowerCase()))].sort(),
        isCommonPurchaseManager: memberValue.isCommonPurchaseManager,
      } : null;
      const changed = !previous || digest(previous.source) !== digest(source);
      const reason = !source ? "member_missing" : !source.isActive ?
        "member_inactive" : !eligible ? "real_producer" :
          previous && !previous.eligible ? "eligibility_restored" :
            !previous ? "initial_observation" : "eligibility_source_changed";
      const rotations = rotationDocs.map((doc, index) =>
        parseShiftRotationAggregateWire(doc.data(), types[index]));
      if (rotations.some((rotation) =>
        rotation.activeRevision !== authority.activeRevision ||
        rotation.activeDigest !== authority.activeDigest)) {
        return rejectCoverage("membership_rotation_changed");
      }
      const shifts = await transaction.get(db.collection(`${root}/shifts`)
        .limit(1001));
      if (shifts.size > 1000) return rejectCoverage("membership_source_limit");
      const publicShifts = shifts.docs.map((doc) => ({id: doc.id,
        shift: parseShiftPlanningPublicShiftDocument({
          targetPath: doc.ref.path, value: doc.data()}),
      }));
      const reserves = await transaction.getAll(...types.map((type) =>
        ref("shiftCoverageReserves", hash([type, userId]))));
      const reserveChanges: {before: CoverageReserve | null;
        after: CoverageReserve}[] = [];
      const admissionAfterRound = {delivery: 0, market: 0};
      const admissionRequired = {...previous?.admissionRequired ??
        {delivery: false, market: false}};
      let pending = previous?.pendingQueueTransition ?? false;
      for (const [index, type] of types.entries()) {
        const rotation = rotations[index];
        const inCohort = rotation.cursor.cohortUserIds.includes(userId);
        const entering = eligible &&
          (previous ? !previous.eligible : !inCohort);
        admissionRequired[type] ||= entering;
        pending ||= entering || (!eligible && inCohort) ||
          Boolean(previous?.eligible && !eligible);
        admissionAfterRound[type] = Math.max(
          previous?.admissionAfterRound[type] ?? 0,
          rotation.cursor.roundNumber - (rotation.cohortFrozen ? 0 : 1),
          ...publicShifts.filter((item) => item.shift.type === type)
            .flatMap(({shift}) => shift.rotationPositions?.map((position) =>
              position.roundNumber) ?? [shift.roundNumber ?? 0]));
        const old = reserves[index].data() as CoverageReserve | undefined;
        if (old && (old.userId !== userId || old.type !== type ||
            typeof old.active !== "boolean" ||
            !Number.isSafeInteger(old.revision) || old.revision < 1 ||
            old.revision >= Number.MAX_SAFE_INTEGER ||
            !Number.isSafeInteger(old.enteredAtMillis) ||
            old.enteredAtMillis < 0 || old.enteredAtMillis > now)) {
          return rejectCoverage("invalid_coverage_reserve");
        }
        if (entering || (old?.active && !eligible)) {
          reserveChanges.push({before: old ?? null, after: {userId, type,
            active: eligible, enteredAtMillis: entering ? now :
              (old?.enteredAtMillis ?? now),
            revision: (old?.revision ?? 0) + 1}});
        }
      }
      const next: MembershipState = {schemaVersion: 1,
        policyRevision: SHIFT_COVERAGE_POLICY_REVISION, userId,
        revision: (previous?.revision ?? 0) + (changed ? 1 : 0), source,
        eligible, observedAtMillis: changed ? now :
          (previous?.observedAtMillis ?? now), pendingQueueTransition: pending,
        admissionAfterRound, admissionRequired};
      const affected = eligible ? [] : publicShifts.filter(({shift}) =>
        shift.assignedUserIds.includes(userId) && shift.date.toMillis() > now &&
        shift.completion.state === "uncompleted");
      const slots = affected.length ? await transaction.getAll(
        ...affected.map(({id, shift}) => ref("shiftCoverageSlots", hash([id,
          String(shift.assignedUserIds.indexOf(userId))])))) : [];
      const occupied = slots.filter((slot) => slot.exists);
      const existingCases = occupied.length ? await transaction.getAll(
        ...occupied.map((slot) => ref("shiftCoverageCases",
          coverageId(slot.data()?.caseId)))) : [];
      const openings = [];
      const coverage = [];
      for (const [index, item] of affected.entries()) {
        const {id, shift} = item;
        const positionIndex = shift.assignedUserIds.indexOf(userId);
        if (shift.status === "swap_pending") {
          coverage.push({shiftId: id, status: "swap_pending", caseId: null});
          continue;
        }
        if (shift.writeEpoch !== authority.writeEpoch ||
            shift.bundleRevision !== authority.activeRevision ||
            shift.bundleDigest !== authority.activeDigest) {
          return rejectCoverage("coverage_shift_changed");
        }
        if (slots[index].exists) {
          const existing = existingCases.find((doc) =>
            doc.id === slots[index].data()?.caseId)?.data();
          if (!existing || existing.digest !== digest(existing.value) ||
              existing.value.shiftId !== id ||
              existing.value.positionIndex !== positionIndex ||
              digest(existing.authority) !== digest(authority)) {
            return rejectCoverage("invalid_coverage_case");
          }
          coverage.push({shiftId: id, status: "existing_case",
            caseId: coverageId(slots[index].data()?.caseId)});
          continue;
        }
        const caseId = hash(["membership", operationId, id,
          String(positionIndex)]);
        const value = buildShiftCoverageOpening({caseId, shiftId: id, shift,
          positionIndex, actorId, reason, now});
        openings.push({caseId, value, slotRef: slots[index].ref});
        coverage.push({shiftId: id, status: "opened", caseId});
      }
      const stateChanged = !previous || digest(previous) !== digest(next);
      if (stateChanged && !changed) {
        next.revision += 1;
        next.observedAtMillis = now;
      }
      if (next.revision >= Number.MAX_SAFE_INTEGER) {
        return rejectCoverage("invalid_shift_membership_state");
      }
      // Reconcile atomically, including unexpectedly large schedules.
      const writeCount = openings.length * 2 + reserveChanges.length + 1 +
        Number(stateChanged);
      if (writeCount > SHIFT_PLANNING_FIRESTORE_TRANSACTION_WRITE_LIMIT) {
        return rejectCoverage("membership_transaction_oversize");
      }
      const result = {state: next, coverage};
      const audit = {commandDigest, intent, actorMemberId: actorId, reason,
        observedAtMillis: now, sourceUpdateTime: member.updateTime ? {
          seconds: member.updateTime.seconds,
          nanoseconds: member.updateTime.nanoseconds} : null,
        authority, previous, result, reserveChanges};
      if (Buffer.byteLength(JSON.stringify(audit)) > 900_000) {
        return rejectCoverage("membership_transaction_oversize");
      }
      if (stateChanged) {
        transaction.set(stateRef,
          {value: next, digest: digest(next)});
      }
      for (const {after} of reserveChanges) {
        transaction.set(
          ref("shiftCoverageReserves", hash([after.type, userId])), after);
      }
      for (const opening of openings) {
        transaction.create(ref("shiftCoverageCases", opening.caseId),
          {value: opening.value, digest: digest(opening.value), authority});
        transaction.create(opening.slotRef, {caseId: opening.caseId});
      }
      transaction.create(receiptRef, audit);
      return {result, replayed: false};
    });
  },
});
