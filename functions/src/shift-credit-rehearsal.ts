import {SHIFT_PLANNING_FIRESTORE_TRANSACTION_WRITE_LIMIT} from
  "./shift-planning-bundle.js";
import {Firestore, Transaction} from "@google-cloud/firestore";
import {createShiftPlanningDigest as digest} from "./shift-planning-digest.js";
import {captureShiftPlanningWriterAuthority} from
  "./shift-planning-writer-authority.js";
import {encodeShiftPlanningFirestoreValue,
  parseShiftPlanningPublicShiftDocument} from
  "./shift-planning-publication-contract.js";
import {parseShiftRotationAggregateWire} from "./shift-planning-wire.js";
import {addBusinessDays} from "./shift-planning-calendar.js";
import {coverageId, coverageMember, rejectCoverage} from "./shift-coverage.js";
import {parseShiftCoverageCredit, planShiftCreditUnit} from
  "./shift-credit-unit.js";

const root = "develop/plus-collections";
type Intent = {schemaVersion: 1; environment: "develop"; planId: string;
  type: "delivery" | "market"; scheduledDate: string};

const parseIntent = (value: unknown): Intent => {
  const body = value as Intent | undefined;
  if (!body || body.schemaVersion !== 1 || body.environment !== "develop" ||
      !["delivery", "market"].includes(body.type) ||
      typeof body.scheduledDate !== "string" ||
      Object.keys(body).sort().join() !==
        "environment,planId,scheduledDate,schemaVersion,type") {
    return rejectCoverage("invalid_credit_plan_command");
  }
  const scheduledDate = addBusinessDays(body.scheduledDate, 0);
  if (scheduledDate !== body.scheduledDate) {
    return rejectCoverage("invalid_credit_plan_command");
  }
  return {schemaVersion: 1, environment: "develop",
    planId: coverageId(body.planId),
    type: body.type, scheduledDate};
};

/**
 * Local transaction rehearsal, absent from production entrypoints.
 * It activates a private physical-unit record alongside canonical cursor/credit
 * changes in the fixed emulator. It does NOT publish a HU-082 seasonal bundle,
 * public shifts, Sheets or notifications. Live credit activation stays shut.
 * @param {Firestore} db Client owned by the guarded provisional coverage store.
 * @param {Function} nowMillis Trusted rehearsal clock.
 * @return {object} Preview, stage and atomic local activation operations.
 */
export const createShiftCreditRehearsal = (
  db: Firestore,
  nowMillis: () => number,
) => {
  if (process.env.GCLOUD_PROJECT !== "demo-reguerta-hu084-coverage" ||
      process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8798") {
    return rejectCoverage("coverage_provisional_emulator_required");
  }
  const ref = (collection: string, id: string) =>
    db.doc(`${root}/${collection}/${id}`);
  const authorize = async (transaction: Transaction, actorId: string) => {
    const [user, state] = await transaction.getAll(
      ref("users", coverageId(actorId)), ref("shiftPlanningState", "current"));
    if (!coverageMember(user.data()).admin) {
      return rejectCoverage("coverage_actor_forbidden");
    }
    const authority = captureShiftPlanningWriterAuthority(state.data());
    if (!authority) return rejectCoverage("coverage_authority_required");
    return authority;
  };
  const capture = async (transaction: Transaction, intent: Intent,
    authority: NonNullable<ReturnType<
      typeof captureShiftPlanningWriterAuthority>>) => {
    const now = nowMillis();
    const dateMillis = Date.parse(`${intent.scheduledDate}T12:00:00Z`);
    if (!Number.isSafeInteger(now) || now < 0 || dateMillis <= now) {
      return rejectCoverage("credit_plan_date_unavailable");
    }
    const unitId = `${intent.type}_${intent.scheduledDate}`;
    const [rotationDoc, ledgerDoc, occupied] = await transaction.getAll(
      ref("shiftRotations", intent.type),
      ref("shiftCoverageLedgerState", intent.type),
      ref("shiftCoverageCreditUnits", unitId));
    if (occupied.exists) return rejectCoverage("credit_unit_occupied");
    const rotation = parseShiftRotationAggregateWire(
      rotationDoc.data(), intent.type);
    if (rotation.releaseLease || rotation.activeRevision !==
        authority.activeRevision || rotation.activeDigest !==
        authority.activeDigest) {
      return rejectCoverage("credit_rotation_authority_changed");
    }
    const ledgerRevision = ledgerDoc.data()?.revision ?? 0;
    if (!Number.isSafeInteger(ledgerRevision) || ledgerRevision < 0 ||
        ledgerRevision >= Number.MAX_SAFE_INTEGER ||
        rotation.stateRevision >= Number.MAX_SAFE_INTEGER) {
      return rejectCoverage("invalid_credit_plan_revision");
    }
    const sources = [];
    for (const name of ["shiftCoverageCredits", "shiftCoverageMemberClaims",
      "users", "shifts"]) {
      const collection = db.collection(`${root}/${name}`);
      const query = name === "users" || name === "shifts" ? collection :
        collection.where("type", "==", intent.type);
      const snapshot = await transaction.get(query.limit(1001));
      if (snapshot.size > 1000) return rejectCoverage("credit_source_limit");
      sources.push(snapshot.docs);
    }
    const [creditDocs, claimDocs, users, shiftDocs] = sources;
    const credits = creditDocs.map((item) => {
      const credit = parseShiftCoverageCredit(item.data());
      if (credit.id !== item.id || credit.earnedAtMillis > now) {
        return rejectCoverage("invalid_coverage_credit");
      }
      return credit;
    });
    if (credits.length && (!ledgerDoc.exists || ledgerRevision === 0)) {
      return rejectCoverage("invalid_credit_plan_revision");
    }
    const cohort = new Set(rotation.cursor.cohortUserIds);
    for (const id of cohort) {
      const member = users.find((user) => user.id === id);
      if (!coverageMember(member?.data()).eligible) {
        return rejectCoverage("credit_cohort_ineligible");
      }
    }
    for (const credit of credits.filter((item) => item.state === "pending")) {
      const expectedId = digest([intent.type, credit.userId])
        .slice("shift-planning:v1:sha256:".length);
      const claim = claimDocs.find((item) => item.id === expectedId)?.data();
      if (!claim || claim.caseId !== credit.id ||
          claim.userId !== credit.userId || claim.state !== "creditPending") {
        return rejectCoverage("credit_claim_changed");
      }
    }
    const shifts = shiftDocs.filter((item) => item.data().type === intent.type)
      .map((item) => parseShiftPlanningPublicShiftDocument({
        targetPath: item.ref.path, value: item.data()}))
      .sort((a, b) => a.date.toMillis() - b.date.toMillis());
    const publicId = `shift_${intent.type}_` +
      intent.scheduledDate.replace(/-/g, "");
    if (shiftDocs.some((item) => item.id === publicId)) {
      return rejectCoverage("credit_unit_already_public");
    }
    const previous = shifts.filter((item) => item.date.toMillis() < dateMillis)
      .at(-1);
    const next = shifts.find((item) => item.date.toMillis() > dateMillis);
    if (intent.type === "delivery" && (!previous || !next)) {
      return rejectCoverage("credit_delivery_neighbors_required");
    }
    const frozenThroughRound = Math.max(
      rotation.cohortFrozen ? rotation.cursor.roundNumber : 0,
      ...shifts.flatMap((item) => item.type === "delivery" ?
        [item.roundNumber ?? 0] :
        item.rotationPositions?.map((position) => position.roundNumber) ?? []),
    );
    const unit = planShiftCreditUnit({rotation: rotation.cursor, credits,
      frozenThroughRound, adjacentDeliveryUserIds: intent.type === "delivery" ?
        [previous?.assignedUserIds[0] ?? "",
          next?.assignedUserIds[0] ?? ""] : []});
    const sourceDigest = digest(encodeShiftPlanningFirestoreValue({
      authority, rotation: rotationDoc.data(), ledger: ledgerDoc.data() ?? null,
      sources: sources.map((items) => items.map((item) =>
        ({id: item.id, value: item.data()})))},
    "credit rehearsal source", new Set()));
    const deliveryProjection = intent.type === "delivery" ? {
      helperUserId: next?.assignedUserIds[0],
      predecessorDocumentRevision: previous?.documentRevision,
      predecessorCompletion: previous?.completion,
      predecessorHelperUpdate: previous?.completion.state === "uncompleted" ?
        unit.assignments[0].rotationOwnerUserId : null,
    } : null;
    // Required neighbors supply the immutable delivery projection.
    const proposal = {...intent, sourceDigest, unit,
      deliveryProjection: deliveryProjection ?
        encodeShiftPlanningFirestoreValue(deliveryProjection,
          "credit delivery projection", new Set()) : null};
    return {proposal, planDigest: digest(proposal), rotation, ledgerRevision,
      creditDocs, unitId, now};
  };
  const prepare = async (value: unknown, actorId: string, stage: boolean) => {
    const intent = parseIntent(value);
    return db.runTransaction(async (transaction) => {
      const authority = await authorize(transaction, actorId);
      const target = ref("shiftCoverageCreditPlans", intent.planId);
      const existing = await transaction.get(target);
      if (stage && existing.exists) {
        const stored = existing.data();
        if (stored?.intentDigest !== digest(intent) ||
            digest(stored.proposal) !== stored.planDigest ||
            !["staged", "activatedLocal"].includes(stored.status)) {
          return rejectCoverage("credit_plan_identity_conflict");
        }
        return {proposal: stored.proposal, planDigest: stored.planDigest,
          replayed: true};
      }
      const source = await capture(transaction, intent, authority);
      if (stage) {
        transaction.create(target, {intentDigest: digest(intent),
          proposal: source.proposal, planDigest: source.planDigest,
          stagedByUserId: actorId, status: "staged"});
      }
      return {proposal: source.proposal, planDigest: source.planDigest,
        replayed: false};
    });
  };
  return {
    previewCreditUnit: (value: unknown, actorId: string) =>
      prepare(value, actorId, false),
    stageCreditUnit: (value: unknown, actorId: string) =>
      prepare(value, actorId, true),
    async activateCreditUnit(value: unknown, actorId: string) {
      const body = value as {planId: string; planDigest: string} | undefined;
      if (!body || Object.keys(body).sort().join() !== "planDigest,planId" ||
          typeof body.planDigest !== "string") {
        return rejectCoverage("invalid_credit_plan_command");
      }
      const planId = coverageId(body.planId);
      return db.runTransaction(async (transaction) => {
        const authority = await authorize(transaction, actorId);
        const target = ref("shiftCoverageCreditPlans", planId);
        const snapshot = await transaction.get(target);
        const stored = snapshot.data();
        if (!stored || stored.planDigest !== body.planDigest ||
            digest(stored.proposal) !== body.planDigest ||
            stored.proposal.planId !== planId) {
          return rejectCoverage("credit_plan_digest_changed");
        }
        if (stored.status === "activatedLocal") {
          return {unit: stored.proposal.unit, replayed: true};
        }
        if (stored.status !== "staged") {
          return rejectCoverage("credit_plan_state_changed");
        }
        const intent = parseIntent({schemaVersion: 1, environment: "develop",
          planId, type: stored.proposal.type,
          scheduledDate: stored.proposal.scheduledDate});
        const source = await capture(transaction, intent, authority);
        if (source.planDigest !== body.planDigest) {
          return rejectCoverage("credit_plan_source_changed");
        }
        const unit = source.proposal.unit;
        const writeCount = 3 + unit.consumedCreditIds.length * 2 +
          (unit.consumedCreditIds.length ? 1 : 0);
        if (writeCount > SHIFT_PLANNING_FIRESTORE_TRANSACTION_WRITE_LIMIT) {
          return rejectCoverage("credit_unit_oversize");
        }
        const frozen = unit.nextRotation.nextMemberIndex !== 0;
        const rotation = parseShiftRotationAggregateWire({...source.rotation,
          cursor: unit.nextRotation,
          stateRevision: source.rotation.stateRevision + 1,
          cohortFrozen: frozen,
          frozenCohortUserIds: frozen ? unit.nextRotation.cohortUserIds : [],
          lastIdempotencyKey: planId}, intent.type);
        const consumed = unit.consumedCreditIds.map((id) => {
          const document = source.creditDocs.find((item) => item.id === id);
          if (!document) return rejectCoverage("credit_plan_source_changed");
          return {document, credit: parseShiftCoverageCredit(document.data())};
        });
        // All source reads, full-unit feasibility and CAS precede writes.
        transaction.set(ref("shiftRotations", intent.type), rotation);
        for (const {document, credit} of consumed) {
          transaction.update(document.ref, {state: "consumed",
            consumedByPlanId: planId, consumedAtMillis: source.now});
          transaction.delete(ref("shiftCoverageMemberClaims",
            digest([intent.type, credit.userId])
              .slice("shift-planning:v1:sha256:".length)));
        }
        if (unit.consumedCreditIds.length) {
          transaction.set(ref("shiftCoverageLedgerState", intent.type),
            {revision: source.ledgerRevision + 1});
        }
        transaction.create(ref("shiftCoverageCreditUnits", source.unitId),
          {planId, scheduledDate: intent.scheduledDate, unit,
            deliveryProjection: source.proposal.deliveryProjection,
            scope: "localRehearsal", activatedAtMillis: source.now});
        transaction.update(target, {status: "activatedLocal",
          activatedByUserId: actorId, activatedAtMillis: source.now});
        return {unit, replayed: false};
      });
    },
  };
};
