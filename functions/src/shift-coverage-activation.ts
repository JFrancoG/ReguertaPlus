import type {Firestore, Transaction} from "@google-cloud/firestore";
import type {AppEnvironment} from "./backend-security.js";
import {readVerifiedShiftCoverageBootstrap} from
  "./shift-coverage-bootstrap-firestore.js";
import {parseShiftCoverageActivation} from "./shift-coverage-store-context.js";
import {createShiftPlanningDigest} from "./shift-planning-digest.js";

/**
 * Read the same reviewed member IDs used for the Develop journey Rules.
 * Empty, invalid or duplicate lists keep HTTP and both workers closed.
 * @param {object} settings Configuration of the deployed function.
 * @return {object} Server-only participants and environment admission.
 */
export const createDevelopCoverageAdmission = (
  settings: NodeJS.ProcessEnv = process.env,
) => {
  const participants = new Set<string>();
  if (settings.SHIFT_COVERAGE_DEVELOP_ENABLED === "true") {
    try {
      const ids: unknown = JSON.parse(settings.SHIFT_COVERAGE_DEVELOP_MEMBERS ??
        "null");
      if (Array.isArray(ids) && new Set(ids).size === ids.length &&
          ids.every((id) => typeof id === "string" &&
            /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(id))) {
        for (const id of ids) participants.add(id);
      }
    } catch {
      // Invalid deployment configuration leaves the participant set empty.
    }
  }
  return {participants, allows: (environment: AppEnvironment) =>
    environment === "develop" && participants.size > 0};
};

/**
 * Bind planning and coverage commands to the same private policy and receipt.
 * Each caller checks the maintenance state appropriate to its own operation.
 * @param {Firestore} firestore Server-owned client.
 * @param {Transaction} transaction Current attempt.
 * @param {string} environment Server-resolved environment.
 * @return {Promise<object|null>} Ratified policy with its bootstrap identity.
 */
export const readShiftCoverageActivation = async (
  firestore: Firestore, transaction: Transaction, environment: AppEnvironment,
) => {
  const root = `${environment}/plus-collections`;
  const source = (await transaction.get(firestore.doc(
    `${root}/shiftPlanningState/sourcePolicy`))).data();
  const policy = parseShiftCoverageActivation(source?.coverage, environment);
  if (!policy?.enabled || source?.environment !== environment ||
      source.creditLedger?.enabled !== true ||
      source.creditLedger.policyRevision !== policy.policyRevision ||
      source.deliverySpacing?.version !== "hu089-delivery-spacing-v1") {
    return null;
  }
  const initialization = await readVerifiedShiftCoverageBootstrap(
    firestore, transaction, environment);
  if (!initialization) return null;
  return {policy, digest: createShiftPlanningDigest({policy,
    initializationReceiptDigest: initialization.receiptDigest})};
};
