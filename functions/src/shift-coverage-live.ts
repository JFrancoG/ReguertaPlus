import {Firestore, Transaction} from "@google-cloud/firestore";
import {AppEnvironment, HttpRequestError, VerifiedIdentity} from
  "./backend-security.js";
import {administerCoverageDelivery, CoverageDeliveryPort,
  parseCoverageDeliveryRequest} from
  "./shift-coverage-delivery-administration.js";
import {requireCoverageParticipants, type ShiftCoverageStoreContext} from
  "./shift-coverage-store-context.js";
import {readShiftCoverageActor} from "./shift-coverage-access.js";
import {parseShiftAdministrationCommand} from
  "./shift-coverage-administration.js";
import {createShiftCoverageStore} from "./shift-coverage-store.js";
import {DRAND_QUICKNET} from "./shift-coverage-drand.js";
import {readShiftCoverageActivation} from "./shift-coverage-activation.js";
import {createShiftCreditPlanningContext} from
  "./shift-credit-planning-context.js";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {parseShiftPlanningMaintenanceState} from "./shift-planning-wire.js";

export type ShiftCoverageAccess = {
  schemaVersion: 1;
  environment: AppEnvironment;
  memberId: string;
  enabled: boolean;
  policyRevision: string | null;
};

const unavailable = (): never => {
  throw new HttpRequestError(409, "coverage_unavailable",
    "Shift coverage is unavailable");
};

/**
 * Prepare the real SDK path without authorizing activation. The caller owns the
 * Firebase clients; this service never creates or terminates an SDK instance.
 * Operational readiness is a trusted composition decision, independent of the
 * ratified environment-bound policy. The index composition keeps it off
 * until the shared writers and effect consumers are ready.
 * @param {object} input Shared Admin SDK authority and operational admission.
 * @return {object} Authenticated access and the existing transactional store.
 */
export const createFirestoreShiftCoverageService = (input: {
  firestore: Firestore;
  environment: AppEnvironment;
  operationalReady: boolean;
  participants?: ReadonlySet<string>;
  nowMillis: () => number;
  beaconFetcher?: typeof fetch;
  effectDeliveryFor?: (context: ShiftCoverageStoreContext) =>
    CoverageDeliveryPort;
}) => {
  if (!["develop", "production"].includes(input.environment)) {
    return unavailable();
  }
  const {firestore, environment} = input;
  const root = `${environment}/plus-collections`;
  const creditPlanning = createShiftCreditPlanningContext({firestore,
    environment, operationalReady: input.operationalReady});
  // Spacing approvals bind the current write epoch. Entering maintenance
  // advances it, so admins can review and approve pairs in that same epoch.
  type Access = "ordinary" | "reviewSpacing";
  const readActivation = async (transaction: Transaction,
    admin: boolean, access: Access) => {
    if (!input.operationalReady) return null;
    const maintenance = await transaction.get(firestore.doc(
      `${root}/shiftPlanningState/current`));
    try {
      const state = parseShiftPlanningMaintenanceState(maintenance.data());
      if (!state.activeRevision || !state.activeDigest ||
          (state.maintenanceStatus === "closed" &&
            !(admin && access === "reviewSpacing"))) return null;
    } catch (error) {
      if (!(error instanceof ShiftPlanningError)) throw error;
      return null;
    }
    return readShiftCoverageActivation(firestore, transaction, environment);
  };
  const readContext = (identity: VerifiedIdentity, access: Access) =>
    firestore.runTransaction(async (transaction) => {
      const actor = await readShiftCoverageActor(
        firestore, transaction, identity, environment);
      const admitted = !input.participants ||
        input.participants.has(actor.memberId);
      return {actor, activation: admitted ?
        await readActivation(transaction, actor.admin, access) : null};
    });
  const contextFor = async (identity: VerifiedIdentity, access: Access) => {
    const context = await readContext(identity, access);
    const captured = context.activation ?? unavailable();
    const requireReady = async (transaction: Transaction) => {
      const actor = await readShiftCoverageActor(
        firestore, transaction, identity, environment);
      if (actor.memberId !== context.actor.memberId ||
          actor.admin !== context.actor.admin ||
          actor.eligible !== context.actor.eligible) {
        throw new HttpRequestError(409, "coverage_session_changed",
          "The linked account changed; refresh shift coverage");
      }
      requireCoverageParticipants(input.participants, [actor.memberId]);
      const current = await readActivation(transaction, actor.admin, access);
      if (!current || current.digest !== captured.digest) unavailable();
    };
    const scope = {environment, creditPlanning, requireReady,
      participants: input.participants};
    return {scope, policy: captured.policy, admin: context.actor.admin};
  };
  const storeFor = async (identity: VerifiedIdentity,
    access: Access = "ordinary", adminTarget?: string) => {
    const {scope, policy, admin} = await contextFor(identity, access);
    if (adminTarget !== undefined) {
      if (!admin) {
        throw new HttpRequestError(403, "coverage_actor_forbidden", "Denied");
      }
      requireCoverageParticipants(input.participants, [adminTarget]);
    }
    return createShiftCoverageStore({firestore, nowMillis: input.nowMillis,
      maximumOfferWindowMillis: policy.maximumOfferWindowMillis,
      selectionPolicy: {version: "hu089-provisional-v1"},
      beaconPolicy: DRAND_QUICKNET, beaconFetcher: input.beaconFetcher,
      context: scope});
  };
  return {
    async resolveAccess(
      identity: VerifiedIdentity,
    ): Promise<ShiftCoverageAccess> {
      const context = await readContext(identity, "reviewSpacing");
      return {schemaVersion: 1, environment,
        memberId: context.actor.memberId, enabled: Boolean(context.activation),
        policyRevision: context.activation?.policy.policyRevision ?? null};
    },
    async readClient(value: unknown, identity: VerifiedIdentity) {
      const store = await storeFor(identity, "reviewSpacing");
      return store.readClient(value, identity);
    },
    async execute(value: unknown, identity: VerifiedIdentity) {
      return (await storeFor(identity)).execute(value, identity);
    },
    async administerDelivery(value: unknown, identity: VerifiedIdentity) {
      const request = parseCoverageDeliveryRequest(value);
      const {scope, admin} = await contextFor(identity, "ordinary");
      if (!admin) {
        throw new HttpRequestError(403, "coverage_actor_forbidden", "Denied");
      }
      const delivery = input.effectDeliveryFor?.(scope) ?? unavailable();
      return administerCoverageDelivery({firestore, context: scope, identity,
        request, delivery});
    },
    async readAdministration(value: unknown, identity: VerifiedIdentity) {
      const store = await storeFor(identity, "reviewSpacing");
      return store.readAdministration(value, identity);
    },
    async executeAdministration(value: unknown, identity: VerifiedIdentity) {
      const command = parseShiftAdministrationCommand(value);
      const store = await storeFor(identity,
        command.action === "authorizeDeliverySpacingException" ?
          "reviewSpacing" : "ordinary", command.userId);
      return store.executeAdministration(command, identity);
    },
  };
};
