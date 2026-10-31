import {createProvisionalCreditFirestore,
  requireProvisionalCreditPublication} from "./shift-credit-publication.js";
import {createShiftCreditRehearsal} from "./shift-credit-rehearsal.js";
import {createShiftCoverageStore} from "./shift-coverage-store.js";
import {rejectCoverage} from "./shift-coverage.js";
import {parseCoverageSelectionPolicy} from "./shift-coverage-selection.js";
import {parseCoverageBeaconPolicy} from "./shift-coverage-draw.js";

/**
 * Own the fixed-demo SDK client around the shared coverage implementation.
 * Environment, project and ports remain non-configurable for native rehearsals.
 * @param {object} options Explicit provisional policy and trusted clock.
 * @return {object} Local store with cleanup of its owned client.
 */
export const createProvisionalShiftCoverageStore = (
  options: Omit<Parameters<typeof createShiftCoverageStore>[0],
    "firestore" | "context">,
) => {
  requireProvisionalCreditPublication("develop");
  if (!Number.isSafeInteger(options.maximumOfferWindowMillis) ||
      options.maximumOfferWindowMillis <= 0) {
    return rejectCoverage("coverage_provisional_emulator_required");
  }
  const selectionPolicy = options.selectionPolicy ?
    parseCoverageSelectionPolicy(options.selectionPolicy) : undefined;
  const beaconPolicy = options.beaconPolicy ?
    parseCoverageBeaconPolicy(options.beaconPolicy) : undefined;
  const db = createProvisionalCreditFirestore();
  const store = createShiftCoverageStore({firestore: db,
    nowMillis: options.nowMillis,
    maximumOfferWindowMillis: options.maximumOfferWindowMillis,
    selectionPolicy, beaconPolicy});
  const requireDevelop = (value: unknown) => {
    if ((value as {environment?: string})?.environment !== "develop") {
      return rejectCoverage("invalid_coverage_environment");
    }
  };
  return {...store, ...createShiftCreditRehearsal(db, options.nowMillis),
    execute: (value: unknown,
      identity: Parameters<typeof store.execute>[1]) => {
      requireDevelop(value);
      return store.execute(value, identity);
    },
    close: () => db.terminate()};
};
