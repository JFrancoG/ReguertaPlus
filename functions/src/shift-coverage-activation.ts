import type {Firestore, Transaction} from "@google-cloud/firestore";
import type {AppEnvironment} from "./backend-security.js";
import {readVerifiedShiftCoverageBootstrap} from
  "./shift-coverage-bootstrap-firestore.js";
import {parseShiftCoverageActivation} from "./shift-coverage-store-context.js";
import {createShiftPlanningDigest} from "./shift-planning-digest.js";

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
