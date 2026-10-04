import {rejectCoverage} from "./shift-coverage.js";

export const COVERAGE_DAY_MILLIS = 24 * 60 * 60 * 1000;
export type CoverageTimedPhase = "reserve" | "volunteers" | "drawRequired" |
  "draw" | "adminRequired";
export type CoverageTiming = {
  openedAtMillis: number;
  scheduledAtMillis: number;
  mode: "normal" | "urgent" | "adminOnly";
  phaseStartedAtMillis: number;
  phaseClosesAtMillis: number;
};

const time = (value: number) => Number.isSafeInteger(value) && value >= 0;
const durations = (mode: CoverageTiming["mode"]) =>
  mode === "normal" ? [2, 7, 2, 3] : [1, 2, 1, 1];
const phaseIndex = (phase: CoverageTimedPhase) =>
  phase === "reserve" ? 0 : phase === "volunteers" ? 1 :
    phase === "adminRequired" ? 3 : 2;

/**
 * Classify once at case opening. Delayed selection must not reset urgency.
 * @param {number} openedAtMillis Persisted case opening time.
 * @param {number} scheduledAtMillis Authoritative shift start.
 * @return {CoverageTiming} Initial phase deadline, in elapsed 24-hour days.
 */
export const createCoverageTiming = (
  openedAtMillis: number, scheduledAtMillis: number,
): CoverageTiming => {
  if (!time(openedAtMillis) || !time(scheduledAtMillis) ||
      scheduledAtMillis <= openedAtMillis) {
    return rejectCoverage("invalid_coverage_timing");
  }
  const remaining = scheduledAtMillis - openedAtMillis;
  const mode = remaining < 5 * COVERAGE_DAY_MILLIS ? "adminOnly" :
    remaining < 14 * COVERAGE_DAY_MILLIS ? "urgent" : "normal";
  const initial: CoverageTiming = {openedAtMillis, scheduledAtMillis, mode,
    phaseStartedAtMillis: openedAtMillis,
    phaseClosesAtMillis: scheduledAtMillis};
  return enterCoverageTimedPhase(initial,
    mode === "adminOnly" ? "adminRequired" : "reserve", openedAtMillis);
};

/**
 * Bound each whole phase and reserve time for all downstream phases. Candidate
 * changes never call this function for the same phase. Late workers enter the
 * next phase at the expired deadline, not at their later execution time.
 * @param {CoverageTiming} timing Persisted case timing.
 * @param {CoverageTimedPhase} phase The new phase.
 * @param {number} startedAtMillis Actual early transition or expired deadline.
 * @return {CoverageTiming} New timing with unchanged opening and urgency class.
 */
export const enterCoverageTimedPhase = (
  timing: CoverageTiming, phase: CoverageTimedPhase, startedAtMillis: number,
): CoverageTiming => {
  const index = phaseIndex(phase);
  const days = durations(timing.mode);
  const latestEnd = timing.scheduledAtMillis -
    days.slice(index + 1).reduce((sum, value) => sum + value, 0) *
      COVERAGE_DAY_MILLIS;
  const allowance = days[index] * COVERAGE_DAY_MILLIS;
  const phaseClosesAtMillis = timing.mode === "adminOnly" ?
    timing.scheduledAtMillis :
    startedAtMillis + Math.min(allowance, latestEnd - startedAtMillis);
  if (!time(startedAtMillis) || startedAtMillis < timing.openedAtMillis ||
      !time(phaseClosesAtMillis) || phaseClosesAtMillis < startedAtMillis ||
      (timing.mode === "adminOnly" && phase !== "adminRequired")) {
    return rejectCoverage("invalid_coverage_timing");
  }
  return {...timing, phaseStartedAtMillis: startedAtMillis,
    phaseClosesAtMillis};
};

export const validateCoverageTiming = (
  timing: CoverageTiming | undefined, phase: CoverageTimedPhase,
): CoverageTiming => {
  if (!timing) return rejectCoverage("invalid_coverage_timing");
  const initial = createCoverageTiming(timing.openedAtMillis,
    timing.scheduledAtMillis);
  const expected = enterCoverageTimedPhase(initial, phase,
    timing.phaseStartedAtMillis);
  if (timing.mode !== initial.mode ||
      timing.phaseClosesAtMillis !== expected.phaseClosesAtMillis) {
    return rejectCoverage("invalid_coverage_timing");
  }
  return {...timing};
};
