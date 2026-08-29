export type ShiftPlanningExternalWriterFence = {
  beforeMutation: () => Promise<void>;
  finish: () => Promise<void>;
};

/**
 * Captures one immutable authority for a sequence of external mutations.
 * The same value is revalidated before every mutation and after the final one;
 * this detects drift but cannot make an external service transactional.
 * @param {object} dependencies Authority capture and revalidation ports.
 * @return {Promise<ShiftPlanningExternalWriterFence>} Operation-level fence.
 */
export const createShiftPlanningExternalWriterFence = async<Authority>(
  dependencies: {
    capture: () => Promise<Authority>;
    revalidate: (captured: Authority) => Promise<void>;
  },
): Promise<ShiftPlanningExternalWriterFence> => {
  const captured = await dependencies.capture();
  const revalidate = () => dependencies.revalidate(captured);
  return {
    beforeMutation: revalidate,
    finish: revalidate,
  };
};

/**
 * Executes one external mutation only after its operation authority is current.
 * @param {ShiftPlanningExternalWriterFence} fence Captured operation fence.
 * @param {Function} mutation External side effect to authorize.
 * @return {Promise<Result>} The external mutation result.
 */
export const runShiftPlanningExternalWriterMutation = async<Result>(
  fence: ShiftPlanningExternalWriterFence,
  mutation: () => Promise<Result>,
): Promise<Result> => {
  await fence.beforeMutation();
  return mutation();
};
