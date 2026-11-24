import {DocumentReference, DocumentSnapshot, Transaction} from
  "@google-cloud/firestore";
import {coverageMember, rejectCoverage} from "./shift-coverage.js";

export type EligibilityTime = {seconds: number; nanoseconds: number};
const transitionIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Exclusion = "excusedDeparture" | "excusedIneligible";
type ReconciledPeriod = {eligible: boolean; observedAtMillis: number;
  eligibilityChangedAt?: EligibilityTime};

export const membershipEligibilityRef = (member: DocumentReference) => {
  const dataset = member.parent.parent;
  if (!dataset) return rejectCoverage("invalid_membership_source");
  return dataset.collection("shiftMembershipState").doc(member.id)
    .collection("source").doc("eligibility");
};

export const isEligibilityTime = (value: unknown): value is EligibilityTime => {
  const time = value as EligibilityTime | null;
  return Boolean(time && Object.keys(time).sort().join() ===
    "nanoseconds,seconds" && Number.isInteger(time.seconds) &&
    time.seconds >= 0 && time.seconds <= 253402300799 &&
    Number.isInteger(time.nanoseconds) && time.nanoseconds >= 0 &&
    time.nanoseconds < 1_000_000_000);
};

export const eligibilityTimeMillis = (time: EligibilityTime): number =>
  time.seconds * 1000 + Math.floor(time.nanoseconds / 1_000_000);

export const compareEligibilityTimes = (
  a: EligibilityTime, b: EligibilityTime,
): number => a.seconds - b.seconds || a.nanoseconds - b.nanoseconds;

/**
 * The member writer commits this private document only when the eligibility
 * period changes. Its Firestore version retains the exact commit even after a
 * profile edit. For a legacy user, creation is proof only while pristine or
 * when that same creation has already been attested.
 * @param {DocumentSnapshot} member Current canonical user.
 * @param {DocumentSnapshot} evidence Private transition in the same snapshot.
 * @param {EligibilityTime} previous Previously attested time.
 * @return {EligibilityTime|undefined} Exact commit time, if proven.
 */
export const readMemberEligibilityTime = (
  member: DocumentSnapshot, evidence: DocumentSnapshot,
  previous?: EligibilityTime,
): EligibilityTime | undefined => {
  if (!member.exists) return undefined;
  const created = member.createTime;
  const updated = member.updateTime;
  if (!created || !updated) {
    return rejectCoverage("invalid_membership_eligibility_time");
  }
  let time = created;
  if (evidence.exists) {
    const record = evidence.data();
    const transition = evidence.updateTime;
    if (!record || !transition ||
        typeof record.transitionId !== "string" ||
        !transitionIdPattern.test(record.transitionId) ||
        record.eligible !== coverageMember(member.data()).eligible ||
        !["eligible,transitionId", "eligible,previousExclusion,transitionId"]
          .includes(Object.keys(record).sort().join()) ||
        (record.previousExclusion !== undefined && (!record.eligible ||
          !["excusedDeparture", "excusedIneligible"].includes(
            record.previousExclusion))) ||
        compareEligibilityTimes(transition, created) < 0 ||
        compareEligibilityTimes(transition, updated) > 0) {
      return rejectCoverage("invalid_membership_eligibility_time");
    }
    time = transition;
  } else if (compareEligibilityTimes(created, updated) !== 0 &&
      !(previous && compareEligibilityTimes(created, previous) === 0)) {
    return undefined;
  }
  const result = {seconds: time.seconds, nanoseconds: time.nanoseconds};
  if (!isEligibilityTime(result)) {
    return rejectCoverage("invalid_membership_eligibility_time");
  }
  return result;
};

// Legacy baselines recorded the cohort without individual transition dates.
// The transaction version distinguishes later changes even in the same ms.
const periodAdvanced = (
  current: EligibilityTime, previous: ReconciledPeriod,
  observedVersion?: EligibilityTime,
): boolean => {
  const last = previous.eligibilityChangedAt ?? observedVersion;
  return last ? compareEligibilityTimes(current, last) > 0 :
    eligibilityTimeMillis(current) > previous.observedAtMillis;
};

export const reconcileEligibilityPeriod = (
  member: DocumentSnapshot, evidence: DocumentSnapshot, eligible: boolean,
  previous: ReconciledPeriod | null,
  observedVersion: EligibilityTime | undefined, now: number,
): {effectiveTime?: EligibilityTime; returnExclusion?: Exclusion} => {
  const prior = previous?.eligibilityChangedAt;
  const effectiveTime = readMemberEligibilityTime(member, evidence, prior);
  if (effectiveTime && eligibilityTimeMillis(effectiveTime) > now) {
    return rejectCoverage("invalid_membership_eligibility_time");
  }
  if (member.exists && prior && (!effectiveTime ||
      compareEligibilityTimes(effectiveTime, prior) < 0 ||
      (eligible !== previous.eligible &&
        compareEligibilityTimes(effectiveTime, prior) === 0))) {
    return rejectCoverage("membership_eligibility_time_required");
  }
  if (!effectiveTime || !eligible || (previous && (!previous.eligible ||
      !periodAdvanced(effectiveTime, previous, observedVersion)))) {
    return {effectiveTime};
  }
  const reason = evidence.data()?.previousExclusion as Exclusion | undefined;
  if (reason) return {effectiveTime, returnExclusion: reason};
  if (!previous) return {effectiveTime};
  if (member.createTime &&
      compareEligibilityTimes(member.createTime, effectiveTime) === 0) {
    return {effectiveTime, returnExclusion: "excusedDeparture"};
  }
  return rejectCoverage("membership_exclusion_evidence_required");
};

export const assertReconciledMembershipEligibilityTime = (
  member: DocumentSnapshot, evidence: DocumentSnapshot, state: ReconciledPeriod,
  observedVersion?: EligibilityTime,
): void => {
  const prior = state.eligibilityChangedAt;
  const current = readMemberEligibilityTime(member, evidence, prior);
  const eligible = member.exists && coverageMember(member.data()).eligible;
  if (eligible !== state.eligible ||
      (prior && (!current || compareEligibilityTimes(prior, current) !== 0)) ||
      (!prior && current && periodAdvanced(current, state, observedVersion))) {
    return rejectCoverage("membership_source_not_reconciled");
  }
};

/**
 * A new eligibility record can precede a member's first reconciliation.
 * @param {Transaction} transaction Transaction capturing the planning source.
 * @param {DocumentSnapshot[]} users Members from the roster already read.
 * @param {ReadonlySet<string>} reconciledMembers Verified membership records.
 * @param {ReadonlySet<string>} cohort Members already in the planning cohort.
 */
export const assertNoUnreconciledMembershipEntries = async (
  transaction: Transaction, users: readonly DocumentSnapshot[],
  reconciledMembers: ReadonlySet<string>, cohort: ReadonlySet<string>,
): Promise<void> => {
  const untracked = users.filter((user) =>
    !reconciledMembers.has(user.id) && user.get("isActive") === true);
  if (!untracked.length) return;
  const evidence = await transaction.getAll(...untracked.map((user) =>
    membershipEligibilityRef(user.ref)));
  untracked.forEach((user, index) => {
    const source = evidence[index];
    if (!source.exists) return;
    readMemberEligibilityTime(user, source);
    if (source.get("eligible") && (!cohort.has(user.id) ||
        source.get("previousExclusion"))) {
      return rejectCoverage("membership_source_not_reconciled");
    }
  });
};
