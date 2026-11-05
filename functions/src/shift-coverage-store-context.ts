import type {Transaction} from "@google-cloud/firestore";
import type {AppEnvironment} from "./backend-security.js";
import {SHIFT_COVERAGE_POLICY_REVISION} from "./shift-coverage.js";

export type ShiftCoverageActivation = {
  enabled: boolean;
  environment: AppEnvironment;
  policyRevision: typeof SHIFT_COVERAGE_POLICY_REVISION;
  ratificationReference: string;
  maximumOfferWindowMillis: number;
};

/**
 * Missing or malformed private activation input never grants availability.
 * @param {unknown} value Exact private activation record.
 * @param {string} environment Server-resolved scope.
 * @return {object|null} Supported activation record, otherwise closed.
 */
export const parseShiftCoverageActivation = (
  value: unknown, environment: AppEnvironment,
): ShiftCoverageActivation | null => {
  const policy = value as ShiftCoverageActivation | undefined;
  if (!policy || typeof policy !== "object" ||
      Object.getPrototypeOf(policy) !== Object.prototype ||
      Object.keys(policy).sort().join() !== "enabled,environment," +
        "maximumOfferWindowMillis,policyRevision,ratificationReference" ||
      typeof policy.enabled !== "boolean" ||
      policy.environment !== environment ||
      policy.policyRevision !== SHIFT_COVERAGE_POLICY_REVISION ||
      typeof policy.ratificationReference !== "string" ||
      !policy.ratificationReference.trim() ||
      policy.ratificationReference.length > 500 ||
      !Number.isSafeInteger(policy.maximumOfferWindowMillis) ||
      policy.maximumOfferWindowMillis <= 0) {
    return null;
  }
  return {...policy};
};

/**
 * Trusted server composition binds one environment and checks readiness inside
 * Every transaction, including receipt replay, checks this trusted scope.
 */
export type ShiftCoverageStoreContext = {
  environment: AppEnvironment;
  requireReady: (transaction: Transaction) => Promise<void>;
};
