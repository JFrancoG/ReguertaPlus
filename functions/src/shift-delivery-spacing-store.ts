import {Firestore, Transaction} from "@google-cloud/firestore";
import {coverageId, coverageMember, rejectCoverage} from "./shift-coverage.js";
import {requireRegisteredProvisionalCreditFirestore} from
  "./shift-credit-publication.js";
import {DeliverySpacingSource, deliverySpacingAuthorityDigest,
  parseDeliverySpacingSource} from "./shift-delivery-spacing.js";
import {addBusinessDays} from "./shift-planning-calendar.js";
import {SHIFT_PLANNING_FIRESTORE_TRANSACTION_WRITE_LIMIT} from
  "./shift-planning-bundle.js";
import {createShiftPlanningDigest as digest} from "./shift-planning-digest.js";
import {parseShiftPlanningPublicShiftDocument} from
  "./shift-planning-publication-contract.js";
import {parseShiftPlanningMaintenanceState,
  parseShiftRotationAggregateWire} from
  "./shift-planning-wire.js";

const root = "develop/plus-collections";
const version = "hu089-delivery-spacing-v1" as const;
type Data = Record<string, unknown>;
type Approval = Omit<DeliverySpacingSource["exceptions"][number], "authorized">;
type Intent = {schemaVersion: 1; environment: "develop"; operationId: string;
  planningRequestId: string; userId: string; previousDate: string;
  previousRoundNumber: number; date: string; roundNumber: number;
  reason: string};

const pairId = (value: Pick<Intent, "planningRequestId" | "userId" |
  "previousDate" | "previousRoundNumber" | "date" | "roundNumber">) =>
  digest([value.planningRequestId, value.userId, value.previousDate,
    value.previousRoundNumber, value.date, value.roundNumber])
    .slice("shift-planning:v1:sha256:".length);

const parseIntent = (value: unknown): Intent => {
  const body = value as Intent | undefined;
  if (!body || Object.getPrototypeOf(body) !== Object.prototype ||
      Object.keys(body).sort().join() !== "date,environment,operationId," +
        "planningRequestId,previousDate,previousRoundNumber,reason," +
        "roundNumber,schemaVersion,userId" || body.schemaVersion !== 1 ||
      body.environment !== "develop" || typeof body.previousDate !== "string" ||
      typeof body.date !== "string" || typeof body.reason !== "string" ||
      !body.reason.trim() || body.reason.length > 500 ||
      !Number.isSafeInteger(body.previousRoundNumber) ||
      body.previousRoundNumber < 1 || !Number.isSafeInteger(body.roundNumber) ||
      body.roundNumber <= body.previousRoundNumber) {
    return rejectCoverage("invalid_delivery_spacing_command");
  }
  const previousDate = addBusinessDays(body.previousDate, 0);
  const date = addBusinessDays(body.date, 0);
  if (previousDate >= date || addBusinessDays(previousDate, 70) <= date) {
    return rejectCoverage("delivery_spacing_exception_not_required");
  }
  return {...body, previousDate, date, reason: body.reason.trim(),
    operationId: coverageId(body.operationId),
    planningRequestId: coverageId(body.planningRequestId),
    userId: coverageId(body.userId)};
};

const parseApproval = (value: unknown): Approval => {
  const approval = value as Approval | undefined;
  if (!approval || Object.keys(approval).sort().join() !==
      "approvedAtMillis,approvedByUserId,authorityDigest,date,id,operationId," +
        "planningRequestId,previousDate,previousRoundNumber,reason," +
        "roundNumber,userId" || typeof approval.authorityDigest !== "string") {
    return rejectCoverage("invalid_delivery_spacing_exception");
  }
  parseDeliverySpacingSource({version,
    authorityDigest: approval.authorityDigest, history: [],
    exceptions: [{...approval, authorized: true}]});
  if (approval.id !== pairId(approval)) {
    return rejectCoverage("invalid_delivery_spacing_exception");
  }
  return structuredClone(approval);
};

const readApproval = (id: string, data: Data | undefined): Approval => {
  if (!data || Object.keys(data).sort().join() !== "digest,value" ||
      data.digest !== digest(data.value)) {
    return rejectCoverage("invalid_delivery_spacing_exception");
  }
  const approval = parseApproval(data.value);
  if (approval.id !== id) {
    return rejectCoverage("invalid_delivery_spacing_exception");
  }
  return approval;
};

const captureSource = async (input: {
  firestore: Firestore; transaction: Transaction; authorityDigest: string;
  excludedPaths?: ReadonlySet<string>;
}): Promise<DeliverySpacingSource> => {
  requireRegisteredProvisionalCreditFirestore(input.firestore);
  const maximumRows = 1000 + (input.excludedPaths?.size ?? 0);
  const shifts = await input.transaction.get(input.firestore.collection(
    `${root}/shifts`).where("type", "==", "delivery").limit(maximumRows + 1));
  if (shifts.size > maximumRows) {
    return rejectCoverage("delivery_spacing_source_limit");
  }
  const history = shifts.docs.flatMap((doc) => {
    const shift = parseShiftPlanningPublicShiftDocument({
      targetPath: doc.ref.path, value: doc.data()});
    if (!shift.rotationOwnerUserId || !shift.roundNumber) {
      return rejectCoverage("delivery_spacing_history_missing");
    }
    if (input.excludedPaths?.has(doc.ref.path)) return [];
    const date = shift.date.toDate().toISOString().slice(0, 10);
    return [{shiftId: doc.id, date,
      userId: shift.rotationOwnerUserId, roundNumber: shift.roundNumber}];
  }).sort((a, b) => a.date.localeCompare(b.date) ||
    a.shiftId.localeCompare(b.shiftId));
  const records = await input.transaction.get(input.firestore.collection(
    `${root}/shiftDeliverySpacingExceptions`)
    .where("value.authorityDigest", "==", input.authorityDigest)
    .orderBy("__name__").limit(251));
  if (records.size > 250) {
    return rejectCoverage("delivery_spacing_source_limit");
  }
  const exceptions: DeliverySpacingSource["exceptions"] = [];
  const administrators = new Map<string, boolean>();
  for (const doc of records.docs) {
    const approval = readApproval(doc.id, doc.data());
    if (!administrators.has(approval.approvedByUserId)) {
      const actor = await input.transaction.get(input.firestore.doc(
        `${root}/users/${approval.approvedByUserId}`));
      administrators.set(approval.approvedByUserId,
        actor.exists && coverageMember(actor.data()).admin);
    }
    exceptions.push({...approval,
      authorized: administrators.get(approval.approvedByUserId) ?? false});
  }
  return parseDeliverySpacingSource({version,
    authorityDigest: input.authorityDigest, history, exceptions});
};

/**
 * Bind all ordinary published owners and current-authority approvals, including
 * approvals for other requests. Substitution assignees and helpers do not enter
 * ordinary history. Authorization is observed again on every transaction retry.
 * @param {object} input Registered emulator and planning transaction authority.
 * @return {Promise<DeliverySpacingSource>} Immutable governed evidence.
 */
export const captureDeliverySpacingSource = (input: {
  firestore: Firestore; transaction: Transaction; authorityDigest: string;
}): Promise<DeliverySpacingSource> => captureSource(input);

/**
 * Compare the captured source and current forward authority before publication.
 * Inverse callers first validate their own public rows against the artifact and
 * mutation markers. Only their newly created exact paths may be omitted; a
 * preexisting predecessor remains ordinary history even if its helper changed.
 * The captured authority digest is intentional because inverse runs after the
 * publication has advanced the canonical authority.
 * @param {object} input Transaction, source and verified own public paths.
 */
export const assertDeliverySpacingSource = async (input: {
  firestore: Firestore; transaction: Transaction; source: DeliverySpacingSource;
  ownPublishedPaths?: readonly string[];
}): Promise<void> => {
  requireRegisteredProvisionalCreditFirestore(input.firestore);
  const source = parseDeliverySpacingSource(input.source);
  if (input.ownPublishedPaths === undefined) {
    const [maintenance, rotation] = await input.transaction.getAll(
      input.firestore.doc(`${root}/shiftPlanningState/current`),
      input.firestore.doc(`${root}/shiftRotations/delivery`));
    const state = parseShiftPlanningMaintenanceState(maintenance.data());
    const delivery = parseShiftRotationAggregateWire(rotation.data(),
      "delivery");
    if (delivery.activeRevision !== state.activeRevision ||
        delivery.activeDigest !== state.activeDigest ||
        deliverySpacingAuthorityDigest(state, delivery) !==
          source.authorityDigest) {
      return rejectCoverage("delivery_spacing_authority_changed");
    }
  }
  if ((input.ownPublishedPaths?.length ?? 0) >
      SHIFT_PLANNING_FIRESTORE_TRANSACTION_WRITE_LIMIT) {
    return rejectCoverage("invalid_delivery_spacing_inverse_paths");
  }
  const originalPaths = new Set(source.history.map((item) =>
    `${root}/shifts/${item.shiftId}`));
  const excludedPaths = new Set<string>();
  for (const path of input.ownPublishedPaths ?? []) {
    if (!path.startsWith(`${root}/shifts/`) ||
        path.slice(`${root}/shifts/`.length).includes("/")) {
      return rejectCoverage("invalid_delivery_spacing_inverse_paths");
    }
    coverageId(path.slice(`${root}/shifts/`.length));
    if (!originalPaths.has(path)) excludedPaths.add(path);
  }
  const current = await captureSource({...input,
    authorityDigest: source.authorityDigest, excludedPaths});
  if (digest(current) !== digest(source)) {
    return rejectCoverage("delivery_spacing_source_changed");
  }
};

/**
 * Record one exact force-majeure approval through the trusted local store.
 * Actor identity is supplied by composition, never accepted in the command.
 * This prepares planning input while maintenance may be closed; it changes no
 * public assignment, queue position, date, credit or maintenance state.
 * @param {Firestore} db Registered fixed-emulator client.
 * @param {Function} clock Trusted clock, reevaluated on transaction retries.
 * @return {object} Actor-bound administrative command with immutable receipts.
 */
export const createDeliverySpacingAdministration = (
  db: Firestore, clock: () => number,
) => {
  requireRegisteredProvisionalCreditFirestore(db);
  const ref = (collection: string, id: string) =>
    db.doc(`${root}/${collection}/${id}`);
  return {
    async authorizeDeliverySpacingException(value: unknown,
      actorMemberId: string) {
      const intent = parseIntent(value);
      const actorId = coverageId(actorMemberId);
      const commandDigest = digest({intent, actorId});
      const id = pairId(intent);
      return db.runTransaction(async (transaction) => {
        requireRegisteredProvisionalCreditFirestore(db);
        const now = clock();
        if (!Number.isSafeInteger(now) || now < 0) {
          return rejectCoverage("invalid_coverage_clock");
        }
        const approvalRef = ref("shiftDeliverySpacingExceptions", id);
        const receiptRef = ref("shiftDeliverySpacingOperations",
          intent.operationId);
        const [actor, member, maintenance, rotation, approval, receipt] =
          await transaction.getAll(ref("users", actorId),
            ref("users", intent.userId), ref("shiftPlanningState", "current"),
            ref("shiftRotations", "delivery"), approvalRef, receiptRef);
        if (!actor.exists || !coverageMember(actor.data()).admin) {
          return rejectCoverage("coverage_actor_forbidden");
        }
        if (!member.exists || !coverageMember(member.data()).eligible) {
          return rejectCoverage("delivery_spacing_member_ineligible");
        }
        const state = parseShiftPlanningMaintenanceState(maintenance.data());
        const delivery = parseShiftRotationAggregateWire(rotation.data(),
          "delivery");
        if (delivery.activeRevision !== state.activeRevision ||
            delivery.activeDigest !== state.activeDigest) {
          return rejectCoverage("delivery_spacing_authority_changed");
        }
        const authorityDigest = deliverySpacingAuthorityDigest(state, delivery);
        if (receipt.exists) {
          const stored = receipt.data();
          if (!stored || stored.commandDigest !== commandDigest ||
              stored.actorMemberId !== actorId ||
              digest(stored.command) !== digest(intent)) {
            return rejectCoverage("delivery_spacing_operation_conflict");
          }
          const result = parseApproval(stored.result);
          if (result.id !== id || result.operationId !== intent.operationId ||
              result.approvedByUserId !== actorId || !approval.exists ||
              digest(readApproval(approval.id, approval.data())) !==
                digest(result)) {
            return rejectCoverage("delivery_spacing_operation_conflict");
          }
          return {result, replayed: true};
        }
        if (approval.exists) {
          readApproval(approval.id, approval.data());
          return rejectCoverage("delivery_spacing_pair_already_authorized");
        }
        if (Date.parse(`${intent.date}T00:00:00.000Z`) <= now) {
          return rejectCoverage("delivery_spacing_date_unavailable");
        }
        const result: Approval = parseApproval({id,
          operationId: intent.operationId,
          planningRequestId: intent.planningRequestId, userId: intent.userId,
          previousDate: intent.previousDate,
          previousRoundNumber: intent.previousRoundNumber, date: intent.date,
          roundNumber: intent.roundNumber, reason: intent.reason,
          approvedByUserId: actorId, approvedAtMillis: now, authorityDigest});
        transaction.create(approvalRef,
          {value: result, digest: digest(result)});
        transaction.create(receiptRef, {commandDigest, command: intent,
          actorMemberId: actorId, result});
        return {result, replayed: false};
      });
    },
  };
};
