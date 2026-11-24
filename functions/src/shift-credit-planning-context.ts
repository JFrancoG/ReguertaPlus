import {Firestore, Transaction} from "@google-cloud/firestore";
import type {AppEnvironment} from "./backend-security.js";
import {readShiftCoverageActivation} from "./shift-coverage-activation.js";
import {rejectCoverage} from "./shift-coverage.js";

const provisionalDatabases = new WeakSet<Firestore>();

export const requireProvisionalCreditPublication = (environment: string) => {
  if (environment !== "develop" ||
      process.env.GCLOUD_PROJECT !== "demo-reguerta-hu084-coverage" ||
      process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8798") {
    return rejectCoverage("coverage_provisional_emulator_required");
  }
};

export const createProvisionalCreditFirestore = (): Firestore => {
  requireProvisionalCreditPublication("develop");
  const db = new Firestore({projectId: "demo-reguerta-hu084-coverage",
    host: "127.0.0.1:8798", ssl: false});
  provisionalDatabases.add(db);
  return db;
};

export const isRegisteredProvisionalCreditFirestore = (db: Firestore) =>
  provisionalDatabases.has(db);

export const requireRegisteredProvisionalCreditFirestore = (
  db: Firestore, environment = "develop",
) => {
  requireProvisionalCreditPublication(environment);
  if (!isRegisteredProvisionalCreditFirestore(db)) {
    return rejectCoverage("coverage_provisional_emulator_required");
  }
};

export type ShiftCreditPlanningContext = Readonly<{
  firestore: Firestore; environment: AppEnvironment; operationalReady: boolean;
}>;
const registeredContexts = new WeakSet<ShiftCreditPlanningContext>();

export const createShiftCreditPlanningContext = (
  input: ShiftCreditPlanningContext,
): ShiftCreditPlanningContext => {
  if (!["develop", "production"].includes(input.environment)) {
    return rejectCoverage("coverage_unavailable");
  }
  const {firestore, environment, operationalReady} = input;
  const context = Object.freeze({firestore, environment, operationalReady});
  registeredContexts.add(context);
  return context;
};

export type ShiftCreditPlanningAccess = {
  firestore: Firestore; transaction: Transaction;
  environment?: AppEnvironment; creditPlanning?: ShiftCreditPlanningContext;
};

const requireMatchingContext = (input: ShiftCreditPlanningAccess) => {
  const context = input.creditPlanning;
  if (!context || !registeredContexts.has(context) ||
      input.environment !== context.environment ||
      input.firestore !== context.firestore) {
    return rejectCoverage("coverage_unavailable");
  }
  return context;
};

export const requireOrdinaryShiftCreditPlan = async (
  input: ShiftCreditPlanningAccess,
) => {
  if (!input.creditPlanning) return;
  const context = requireMatchingContext(input);
  const root = `${context.environment}/plus-collections`;
  const ref = context.firestore.doc(`${root}/shiftPlanningState/sourcePolicy`);
  const policy = (await input.transaction.get(ref)).data();
  // A partially enabled policy also forbids an older ordinary bundle. Its
  // replacement must first pass full shared admission, including bootstrap.
  if (policy?.coverage?.enabled === true ||
      policy?.creditLedger?.enabled === true ||
      policy?.deliverySpacing !== undefined) {
    return rejectCoverage("credit_plan_source_changed");
  }
};

/**
 * The planner owns its maintenance barrier. Its coverage authority binds the
 * SDK, environment and ratified initialization for this transaction attempt.
 * Re-read on each invocation because the SDK may reuse the transaction object
 * after a contention retry.
 * @param {object} input Trusted SDK and scope for this attempt.
 * @return {Promise<string|undefined>} Shared activation digest, or local mode.
 */
export const requireShiftCreditPlanningAccess = async (
  input: ShiftCreditPlanningAccess,
): Promise<string | undefined> => {
  const context = input.creditPlanning;
  if (!context) {
    requireRegisteredProvisionalCreditFirestore(
      input.firestore, input.environment);
    return undefined;
  }
  requireMatchingContext(input);
  if (context.operationalReady !== true) {
    return rejectCoverage("coverage_unavailable");
  }
  const activation = await readShiftCoverageActivation(
    context.firestore, input.transaction, context.environment);
  return activation?.digest ?? rejectCoverage("coverage_unavailable");
};
