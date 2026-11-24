import {HttpRequestError} from "./backend-security.js";
import {requireShiftCreditPlanningAccess, ShiftCreditPlanningContext} from
  "./shift-credit-planning-context.js";
import {parseShiftPlanningMaintenanceState} from "./shift-planning-wire.js";
import {Firestore} from "firebase-admin/firestore";
import {
  buildShiftPlanningRequestContext,
  parseShiftPlanningRequestContextInput,
  ShiftPlanningRequestContext,
  ShiftPlanningRequestContextInput,
} from "./shift-planning-request-context.js";

/**
 * Reads the canonical private maintenance state without mutating or exposing
 * it, and projects only the epoch/active revision needed by a v2 request.
 * @param {Firestore} firestore Admin SDK Firestore instance.
 * @return {object} Read-only planning-request context repository.
 */
export const createFirestoreShiftPlanningRequestContextRepository = (
  firestore: Firestore,
) => ({
  resolve: async (
    value: ShiftPlanningRequestContextInput,
    creditPlanning?: ShiftCreditPlanningContext,
  ): Promise<ShiftPlanningRequestContext> => {
    const input = parseShiftPlanningRequestContextInput(value);
    return firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(firestore.doc(
        `${input.environment}/plus-collections/shiftPlanningState/current`));
      const state = snapshot.data();
      try {
        return buildShiftPlanningRequestContext(input, state);
      } catch (error) {
        if (!(error instanceof HttpRequestError) ||
            error.code !== "shift_planning_maintenance" ||
            !creditPlanning?.operationalReady) throw error;
      }
      // Shared planning must bind a fresh preview to the closed epoch.
      // The admin receives only the same two preconditions as in open mode.
      await requireShiftCreditPlanningAccess({firestore, transaction,
        environment: input.environment, creditPlanning});
      const closed = parseShiftPlanningMaintenanceState(state);
      return {...input, expectedWriteEpoch: closed.writeEpoch,
        expectedActiveRevision: closed.activeRevision};
    }, {readOnly: true});
  },
});
