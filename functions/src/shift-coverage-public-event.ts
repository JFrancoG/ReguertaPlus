import {Firestore, Timestamp} from "@google-cloud/firestore";
import {AppEnvironment, HttpRequestError} from "./backend-security.js";
import {createShiftPlanningDigest as digest} from "./shift-planning-digest.js";
import {encodeShiftPlanningFirestoreValue,
  parseShiftPlanningPublicShiftDocument} from
  "./shift-planning-publication-contract.js";
import {coverageId, parseShiftCoverageCommand} from "./shift-coverage.js";

type Data = Record<string, unknown>;
export type CoveragePublicEventDescriptor = {
  schemaVersion: 1; environment: AppEnvironment; targetPath: string;
  beforeRevision: number; afterRevision: number;
  beforeDigest: string; afterDigest: string; eventDigest: string;
};
export type CoveragePublicEventBinding = CoveragePublicEventDescriptor & {
  operationId: string; effectsDigest: string;
};
type Evidence = {value: unknown; createTime?: Timestamp};
const fail = (): never => {
  throw new HttpRequestError(409, "coverage_public_event_evidence_invalid",
    "Coverage public-write ownership could not be verified");
};
const record = (value: unknown): Data => {
  if (!value || typeof value !== "object" ||
      Object.getPrototypeOf(value) !== Object.prototype) return fail();
  return value as Data;
};
const encodedDigest = (value: unknown) => digest(
  encodeShiftPlanningFirestoreValue(value, "coverage public event", new Set()));
const sameTime = (a?: Timestamp, b?: Timestamp) =>
  a instanceof Timestamp && b instanceof Timestamp &&
    a.seconds === b.seconds && a.nanoseconds === b.nanoseconds;
const digestPattern = /^shift-planning:v1:sha256:[a-f0-9]{64}$/;

/**
 * Describe an effective coverage UPDATE without modifying planner provenance.
 * The complete canonical documents include timestamps and the retained marker;
 * assignment, helper and completion writes are equally represented here.
 * Legacy documents and non-incrementing ordinary writes have no such claim.
 * @param {object} input Event snapshots or the command's exact before/after.
 * @return {object|null} Stable body identity, independent of its commit time.
 */
export const describeCoveragePublicEvent = (input: {
  targetPath: string; before: unknown | null; after: unknown | null;
}): CoveragePublicEventDescriptor | null => {
  const environment = input.targetPath.split("/")[0];
  if (environment !== "develop" && environment !== "production") return fail();
  if (!input.before || !input.after ||
      typeof input.before !== "object" || typeof input.after !== "object" ||
      !("planningSchemaVersion" in input.before) ||
      !("planningSchemaVersion" in input.after)) return null;
  const before = parseShiftPlanningPublicShiftDocument({
    targetPath: input.targetPath, value: input.before});
  const after = parseShiftPlanningPublicShiftDocument({
    targetPath: input.targetPath, value: input.after});
  if (after.documentRevision !== before.documentRevision + 1 ||
      encodedDigest(before.lastBackendMutation) !==
        encodedDigest(after.lastBackendMutation)) return null;
  const core = {schemaVersion: 1 as const,
    environment: environment as AppEnvironment,
    targetPath: input.targetPath, beforeRevision: before.documentRevision,
    afterRevision: after.documentRevision, beforeDigest: encodedDigest(before),
    afterDigest: encodedDigest(after)};
  return {...core, eventDigest: digest(core)};
};

export const coveragePublicEventBindingId = (
  value: CoveragePublicEventDescriptor,
): string => value.eventDigest.slice("shift-planning:v1:sha256:".length);

/**
 * Historical ownership never depends on today's case, activation gate or
 * mutable worker status. Its three documents must have been CREATED at the
 * public UPDATE's exact commit time. Equal bodies from a later reapply are not
 * owned. Evidence is retained indefinitely in this version: deleting it can
 * reopen ordinary effects. No cleanup/TTL is authorized by this contract.
 * @param {object} input Exact event and private evidence snapshots.
 * @return {string} Exclusive owner; partial evidence fails closed.
 */
export const classifyCoveragePublicEventEvidence = (input: {
  descriptor: CoveragePublicEventDescriptor; afterUpdateTime: Timestamp;
  binding: Evidence | null; receipt: Evidence | null; effect: Evidence | null;
  orphanClaims?: readonly Evidence[];
}): "ordinary" | "coverage" => {
  if (!sameTime(input.binding?.createTime, input.afterUpdateTime)) {
    if (input.orphanClaims?.some((claim) =>
      sameTime(claim.createTime, input.afterUpdateTime))) return fail();
    return "ordinary";
  }
  const binding = record(input.binding?.value);
  if (Object.keys(binding).sort().join() !==
      "afterDigest,afterRevision,beforeDigest,beforeRevision,effectsDigest," +
        "environment,eventDigest,operationId,schemaVersion,targetPath" ||
      digest({...input.descriptor, operationId: binding.operationId,
        effectsDigest: binding.effectsDigest}) !== digest(binding) ||
      typeof binding.effectsDigest !== "string" ||
      !digestPattern.test(binding.effectsDigest) ||
      !sameTime(input.receipt?.createTime, input.afterUpdateTime) ||
      !sameTime(input.effect?.createTime, input.afterUpdateTime)) return fail();
  const operationId = coverageId(binding.operationId);
  const receipt = record(input.receipt?.value);
  const effect = record(input.effect?.value);
  const value = record(effect.value);
  const {effectsDigest, ...core} = value;
  const command = parseShiftCoverageCommand(receipt.command);
  const actorId = coverageId(receipt.actorMemberId);
  if (receipt.authUid !== undefined &&
      (typeof receipt.authUid !== "string" || !receipt.authUid ||
      receipt.authUid.length > 128 || receipt.authUid.includes("/"))) {
    return fail();
  }
  const authBinding = receipt.authUid === undefined ? {} :
    {authUid: receipt.authUid};
  const result = record(receipt.result);
  const ids = receipt.publicEventDigests;
  if (!Array.isArray(ids) || ids.some((id) =>
    typeof id !== "string" || !digestPattern.test(id)) ||
    new Set(ids).size !== ids.length ||
    !ids.includes(input.descriptor.eventDigest) ||
    digest(ids) !== digest(effect.publicEventDigests) ||
    receipt.commandDigest !== digest({actorId, command, ...authBinding}) ||
    command.operationId !== operationId ||
    command.environment !== input.descriptor.environment ||
    value.schemaVersion !== 1 || value.operationId !== operationId ||
    value.environment !== input.descriptor.environment ||
    value.caseId !== command.caseId || value.caseId !== result.id ||
    value.caseRevision !== result.revision ||
    result.environment !== input.descriptor.environment ||
    value.caseDigest !== digest(result) ||
    effectsDigest !== digest(core) ||
    binding.effectsDigest !== effectsDigest ||
    receipt.effectsDigest !== effectsDigest) return fail();
  return "coverage";
};

/**
 * Inspect immutable ownership before any ordinary Sheets/notification work.
 * Both existing outbox and receipt claims detect a missing sidecar. A total
 * administrative deletion of ALL evidence is indistinguishable from ordinary;
 * Backend-only rules and indefinite retention are therefore part of authority.
 * No current-case read, global gate or Google/FCM call belongs in this seam.
 * @param {Firestore} db Environment-scoped backend client.
 * @param {object} input Authorized CloudEvent snapshots and commit metadata.
 * @return {Promise<string>} Historical exclusive owner or a fail-closed error.
 */
export const readCoveragePublicEventOwnership = async (
  db: Firestore,
  input: {targetPath: string; before: unknown | null; after: unknown | null;
    afterUpdateTime?: Timestamp},
): Promise<"ordinary" | "coverage"> => {
  const descriptor = describeCoveragePublicEvent(input);
  if (!descriptor) return "ordinary";
  if (!(input.afterUpdateTime instanceof Timestamp)) return fail();
  const root = `${descriptor.environment}/plus-collections`;
  return db.runTransaction(async (tx) => {
    const binding = await tx.get(db.doc(`${root}/shiftCoveragePublicWrites/` +
      coveragePublicEventBindingId(descriptor)));
    if (sameTime(binding.createTime, input.afterUpdateTime)) {
      const operationId = coverageId(binding.data()?.operationId);
      const [receipt, effect] = await tx.getAll(
        db.doc(`${root}/shiftCoverageOperations/${operationId}`),
        db.doc(`${root}/shiftCoverageEffects/${operationId}`));
      return classifyCoveragePublicEventEvidence({descriptor,
        afterUpdateTime: input.afterUpdateTime as Timestamp,
        binding: {value: binding.data(), createTime: binding.createTime},
        receipt: {value: receipt.data(), createTime: receipt.createTime},
        effect: {value: effect.data(), createTime: effect.createTime}});
    }
    const claims = [];
    for (const collection of ["shiftCoverageEffects",
      "shiftCoverageOperations"]) {
      const found = await tx.get(db.collection(`${root}/${collection}`)
        .where("publicEventDigests", "array-contains", descriptor.eventDigest)
        .limit(2));
      // One body transition can have only one immutable sidecar per namespace.
      if (found.size > 1) return fail();
      claims.push(...found.docs.map((doc) =>
        ({value: doc.data(), createTime: doc.createTime})));
    }
    return classifyCoveragePublicEventEvidence({descriptor,
      afterUpdateTime: input.afterUpdateTime as Timestamp,
      binding: binding.exists ? {value: binding.data(),
        createTime: binding.createTime} : null,
      receipt: null, effect: null, orphanClaims: claims});
  });
};
