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
  ): Promise<ShiftPlanningRequestContext> => {
    const input = parseShiftPlanningRequestContextInput(value);
    const snapshot = await firestore.doc(
      `${input.environment}/plus-collections/shiftPlanningState/current`,
    ).get();
    return buildShiftPlanningRequestContext(input, snapshot.data());
  },
});
