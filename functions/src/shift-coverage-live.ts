import {Firestore, Transaction} from "@google-cloud/firestore";
import {AppEnvironment, HttpRequestError, VerifiedIdentity} from
  "./backend-security.js";
import {readShiftCoverageActor} from "./shift-coverage-access.js";
import {createShiftCoverageStore} from "./shift-coverage-store.js";
import {parseShiftCoverageActivation} from "./shift-coverage-store-context.js";
import {createShiftPlanningDigest as digest} from "./shift-planning-digest.js";
import {captureShiftPlanningWriterAuthority} from
  "./shift-planning-writer-authority.js";

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
 * until external effect ownership, leases, intake and real entropy are wired.
 * @param {object} input Shared Admin SDK authority and operational admission.
 * @return {object} Authenticated access and the existing transactional store.
 */
export const createFirestoreShiftCoverageService = (input: {
  firestore: Firestore;
  environment: AppEnvironment;
  operationalReady: boolean;
  nowMillis: () => number;
}) => {
  if (!["develop", "production"].includes(input.environment)) {
    return unavailable();
  }
  const {firestore, environment} = input;
  const root = `${environment}/plus-collections`;
  const readActivation = async (transaction: Transaction) => {
    if (!input.operationalReady) return null;
    const [source, maintenance] = await transaction.getAll(
      firestore.doc(`${root}/shiftPlanningState/sourcePolicy`),
      firestore.doc(`${root}/shiftPlanningState/current`));
    const sourcePolicy = source.data();
    const policy = parseShiftCoverageActivation(
      sourcePolicy?.coverage, environment);
    if (!policy?.enabled || sourcePolicy?.environment !== environment ||
        sourcePolicy.creditLedger?.enabled !== true ||
        sourcePolicy.creditLedger?.policyRevision !== policy.policyRevision ||
        sourcePolicy.deliverySpacing?.version !==
          "hu089-delivery-spacing-v1") return null;
    try {
      const authority = captureShiftPlanningWriterAuthority(maintenance.data());
      if (!authority?.activeRevision || !authority.activeDigest) return null;
    } catch (error) {
      if (!(error instanceof HttpRequestError)) throw error;
      return null;
    }
    return {policy, digest: digest(policy)};
  };
  const readContext = (identity: VerifiedIdentity) =>
    firestore.runTransaction(async (transaction) => {
      const actor = await readShiftCoverageActor(
        firestore, transaction, identity, environment);
      return {actor, activation: await readActivation(transaction)};
    });
  const storeFor = async (identity: VerifiedIdentity) => {
    const context = await readContext(identity);
    const captured = context.activation ?? unavailable();
    return createShiftCoverageStore({firestore, nowMillis: input.nowMillis,
      maximumOfferWindowMillis: captured.policy.maximumOfferWindowMillis,
      selectionPolicy: {version: "hu089-provisional-v1"},
      context: {environment, requireReady: async (transaction) => {
        const actor = await readShiftCoverageActor(
          firestore, transaction, identity, environment);
        if (actor.memberId !== context.actor.memberId ||
            actor.admin !== context.actor.admin ||
            actor.eligible !== context.actor.eligible) {
          throw new HttpRequestError(409, "coverage_session_changed",
            "The linked account changed; refresh shift coverage");
        }
        const current = await readActivation(transaction);
        if (!current || current.digest !== captured.digest) unavailable();
      }}});
  };
  return {
    async resolveAccess(
      identity: VerifiedIdentity,
    ): Promise<ShiftCoverageAccess> {
      const context = await readContext(identity);
      return {schemaVersion: 1, environment,
        memberId: context.actor.memberId, enabled: Boolean(context.activation),
        policyRevision: context.activation?.policy.policyRevision ?? null};
    },
    async readClient(value: unknown, identity: VerifiedIdentity) {
      return (await storeFor(identity)).readClient(value, identity);
    },
    async execute(value: unknown, identity: VerifiedIdentity) {
      return (await storeFor(identity)).execute(value, identity);
    },
    async readAdministration(value: unknown, identity: VerifiedIdentity) {
      return (await storeFor(identity)).readAdministration(value, identity);
    },
    async executeAdministration(value: unknown, identity: VerifiedIdentity) {
      return (await storeFor(identity)).executeAdministration(value, identity);
    },
  };
};
