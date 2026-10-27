import {Firestore} from "@google-cloud/firestore";
import {HttpRequestError, VerifiedIdentity} from "./backend-security.js";
import {readShiftCoverageActor} from "./shift-coverage-access.js";
import {coverageId, rejectCoverage,
  SHIFT_COVERAGE_POLICY_REVISION} from "./shift-coverage.js";
import {createShiftMembershipReconciliation} from
  "./shift-membership-reconciliation.js";
import {readMembershipAdministration} from
  "./shift-coverage-membership-administration.js";
import {createDeliverySpacingAdministration} from
  "./shift-delivery-spacing-store.js";
import {assertSpacingAdministrationContext, readSpacingAdministration} from
  "./shift-coverage-spacing-administration.js";
import {requireProvisionalCreditPublication} from
  "./shift-credit-publication.js";
import {addBusinessDays} from "./shift-planning-calendar.js";

type Base = {schemaVersion: 1; environment: "develop"; operationId: string;
  userId: string; expectedContextDigest: string};
export type ShiftAdministrationCommand = Base & (
  {action: "reconcileMembership"; expectedRevision: number;
    permanentDepartureReason?: string} |
  {action: "authorizeDeliverySpacingException"; proposalId: string;
    planningRequestId: string; previousDate: string;
    previousRoundNumber: number; date: string; roundNumber: number;
    reason: string});

const exact = (value: unknown, keys: string) => Boolean(value &&
  typeof value === "object" &&
  Object.getPrototypeOf(value) === Object.prototype &&
  Object.keys(value).sort().join() === keys);
const reason = (value: unknown) => {
  if (typeof value !== "string" || !value.trim() || value.length > 500) {
    return rejectCoverage("invalid_administration_command");
  }
  return value;
};

export const parseShiftAdministrationQuery = (value: unknown) => {
  const body = value as Record<string, unknown>;
  if (!exact(body, "action,environment,schemaVersion") ||
      body.schemaVersion !== 1 || body.environment !== "develop" ||
      body.action !== "administration") {
    return rejectCoverage("invalid_administration_query");
  }
  return {schemaVersion: 1, environment: "develop", action: "administration"};
};

export const parseShiftAdministrationCommand = (
  value: unknown,
): ShiftAdministrationCommand => {
  const body = value as ShiftAdministrationCommand;
  if (!body || body.schemaVersion !== 1 || body.environment !== "develop" ||
      typeof body.expectedContextDigest !== "string" ||
      !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(
        body.expectedContextDigest)) {
    return rejectCoverage("invalid_administration_command");
  }
  [body.operationId, body.userId].forEach(coverageId);
  if (body.action === "reconcileMembership") {
    const keys = "action,environment,expectedContextDigest,expectedRevision," +
      "operationId," + (body.permanentDepartureReason !== undefined ?
      "permanentDepartureReason," : "") + "schemaVersion,userId";
    if (!exact(body, keys) ||
        !Number.isSafeInteger(body.expectedRevision) ||
        body.expectedRevision < 0 ||
        body.expectedRevision >= Number.MAX_SAFE_INTEGER) {
      return rejectCoverage("invalid_administration_command");
    }
    if (body.permanentDepartureReason !== undefined) {
      reason(body.permanentDepartureReason);
    }
    return {...body};
  }
  if (body.action !== "authorizeDeliverySpacingException" || !exact(body,
    "action,date,environment,expectedContextDigest,operationId," +
      "planningRequestId,previousDate,previousRoundNumber,proposalId,reason," +
      "roundNumber,schemaVersion,userId") ||
      !Number.isSafeInteger(body.previousRoundNumber) ||
      body.previousRoundNumber < 1 || !Number.isSafeInteger(body.roundNumber) ||
      body.roundNumber <= body.previousRoundNumber ||
      body.roundNumber >= Number.MAX_SAFE_INTEGER ||
      typeof body.previousDate !== "string" || typeof body.date !== "string" ||
      addBusinessDays(body.previousDate, 0) !== body.previousDate ||
      addBusinessDays(body.date, 0) !== body.date ||
      body.previousDate >= body.date ||
      addBusinessDays(body.previousDate, 70) <= body.date) {
    return rejectCoverage("invalid_administration_command");
  }
  [body.planningRequestId, body.proposalId].forEach(coverageId);
  reason(body.reason);
  return {...body};
};

/**
 * Compose administrative reads and existing lifecycle/spacing writers locally.
 * Context checks share each writer's transaction; replay rechecks live identity
 * and roles but returns the original receipt without requiring a stale preview.
 * No user activation, assignment publication or queue mutation is added here.
 * @param {Firestore} db Registered fixed-demo database.
 * @param {Function} clock Trusted clock.
 * @param {boolean} enabled Explicit HU-089 policy selection.
 * @return {object} Actor-bound projections and minimal acknowledgements.
 */
export const createShiftCoverageAdministration = (
  db: Firestore, clock: () => number, enabled: boolean,
) => {
  const requireEnvironment = () => {
    requireProvisionalCreditPublication("develop");
    if (!enabled) return rejectCoverage("administration_policy_unavailable");
  };
  const now = () => {
    const value = clock();
    if (!Number.isSafeInteger(value) || value < 0) {
      return rejectCoverage("invalid_coverage_clock");
    }
    return value;
  };
  return {
    async read(value: unknown, identity: VerifiedIdentity) {
      requireEnvironment();
      parseShiftAdministrationQuery(value);
      return db.runTransaction(async (transaction) => {
        const actor = await readShiftCoverageActor(db, transaction, identity);
        if (!actor.admin) {
          throw new HttpRequestError(403, "coverage_actor_forbidden", "Denied");
        }
        const serverTimeMillis = now();
        return {schemaVersion: 1, environment: "develop",
          memberId: actor.memberId, isAdmin: true, serverTimeMillis,
          policyRevision: SHIFT_COVERAGE_POLICY_REVISION,
          ...await readMembershipAdministration(db, transaction,
            serverTimeMillis),
          ...await readSpacingAdministration(db, transaction,
            serverTimeMillis)};
      });
    },
    async execute(value: unknown, identity: VerifiedIdentity) {
      requireEnvironment();
      const command = parseShiftAdministrationCommand(value);
      const {action, expectedContextDigest, ...intent} = command;
      const base = {schemaVersion: 1, environment: "develop",
        operationId: command.operationId, action, userId: command.userId};
      if (command.action === "reconcileMembership") {
        const result = await createShiftMembershipReconciliation(db,
          clock, true).reconcileMembership(intent, identity, {
          contextDigest: expectedContextDigest,
          verify: async (transaction) => {
            const current = await readMembershipAdministration(db,
              transaction, now());
            const member = current.members.find((item) =>
              item.userId === command.userId);
            if (!member || member.contextDigest !== expectedContextDigest) {
              return rejectCoverage("administration_context_changed");
            }
          },
        });
        return {...base, replayed: result.replayed,
          membershipRevision: result.result.state.revision,
          exceptionId: null};
      }
      const spacingIntent = {schemaVersion: command.schemaVersion,
        environment: command.environment, operationId: command.operationId,
        planningRequestId: command.planningRequestId, userId: command.userId,
        previousDate: command.previousDate,
        previousRoundNumber: command.previousRoundNumber,
        date: command.date, roundNumber: command.roundNumber,
        reason: command.reason};
      const result = await createDeliverySpacingAdministration(db,
        clock).authorizeDeliverySpacingException(spacingIntent, identity, {
        contextDigest: expectedContextDigest,
        verify: (transaction) => assertSpacingAdministrationContext(db,
          transaction, now(), command),
      });
      return {...base, replayed: result.replayed,
        membershipRevision: null, exceptionId: result.result.id};
    },
  };
};
