import {createHash} from "node:crypto";
import {Timestamp} from "@google-cloud/firestore";
import {
  AuthType,
  onDocumentWrittenWithAuthContext,
} from "firebase-functions/v2/firestore";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {
  ShiftPlanningPublicEventAuditInput,
  ShiftPlanningPersistedPublicEventAudit,
} from "./shift-planning-firestore-public-event-audit.js";
import {
  classifyShiftPlanningPublicWriteEvent,
} from "./shift-planning-public-event-contract.js";
import {
  parseShiftPlanningPublicEventRetentionPolicy,
} from "./shift-planning-public-event-retention.js";
import {
  ShiftPlanningOperationalLogger,
} from "./shift-planning-operational-log.js";
import {ShiftPlanningEnvironment} from "./shift-planning-wire.js";

/**
 * Splits retryable audit work from non-idempotent ordinary row effects.
 * Unproven markers never reach the ordinary writer. Marked deletes need
 * authority even though the ordinary writer has no delete effects.
 * @param {object} input Raw event snapshots, before legacy projection decoding.
 * @return {boolean} Whether the dedicated audit trigger owns this event.
 */
export const requiresShiftPlanningPublicEventAudit = (input: {
  targetPath: string;
  before: unknown | null;
  after: unknown | null;
}): boolean => {
  if (input.after === null && typeof input.before === "object" &&
    input.before !== null && "lastBackendMutation" in input.before) return true;
  try {
    return classifyShiftPlanningPublicWriteEvent({
      ...input, operation: null,
    }).kind !== "ordinary";
  } catch (error) {
    if (!(error instanceof ShiftPlanningError)) throw error;
    return true;
  }
};

/**
 * Requires an explicit policy for exactly one environment. Empty, malformed or
 * detached policies fail closed; ordinary events never need this configuration.
 * @param {ShiftPlanningEnvironment} environment Event path environment.
 * @param {object} variables Runtime environment, read when handling the event.
 * @return {object} Validated digest-bound retention policy.
 */
export const readShiftPlanningPublicEventPolicy = (
  environment: ShiftPlanningEnvironment,
  variables: Readonly<Record<string, string | undefined>>,
) => {
  const key = "SHIFT_PLANNING_PUBLIC_EVENT_RETENTION_POLICY_" +
    environment.toUpperCase();
  try {
    const raw = variables[key];
    if (!raw || raw.length > 4096) throw new Error("Missing policy.");
    return parseShiftPlanningPublicEventRetentionPolicy(JSON.parse(raw));
  } catch {
    throw new ShiftPlanningError(
      "invalid_planning_publication_contract",
      "An explicit valid public-event retention policy is required.",
    );
  }
};

/**
 * Retries only governed public-event audit work, never ordinary Sheets/FCM.
 * Persistence precedes rejection diagnostics. A structured error log is an
 * operator-alert integration signal, not acknowledgement of alert delivery.
 * @param {object} dependencies Existing authority, durable audit and log sink.
 * @return {object} Authenticated retry-enabled Firestore function.
 */
export const createShiftPlanningPublicEventTrigger = (dependencies: {
  authorize(
    environment: ShiftPlanningEnvironment, authType: AuthType, authId?: string,
  ): Promise<boolean>;
  audit(input: ShiftPlanningPublicEventAuditInput):
    Promise<ShiftPlanningPersistedPublicEventAudit>;
  logger: Pick<ShiftPlanningOperationalLogger, "error">;
}) => onDocumentWrittenWithAuthContext({
  document: "{env}/plus-collections/shifts/{shiftId}",
  retry: true,
}, async (event) => {
  const environment = event.params.env;
  if (environment !== "develop" && environment !== "production") return;
  const targetPath = `${environment}/plus-collections/shifts/` +
    event.params.shiftId;
  const before = event.data?.before;
  const after = event.data?.after;
  const snapshots = {
    targetPath,
    before: before?.exists ? before.data() : null,
    after: after?.exists ? after.data() : null,
  };
  if (!requiresShiftPlanningPublicEventAudit(snapshots)) return;
  const logData = {
    component: "shift_planning_public_event", environment,
    eventCorrelationId: createHash("sha256").update(event.id).digest("hex"),
  };
  try {
    if (!await dependencies.authorize(
      environment, event.authType, event.authId,
    )) return;
    const millis = Date.parse(event.time);
    if (!before || !after || before.ref.path !== targetPath ||
      after.ref.path !== targetPath || !event.id || !Number.isFinite(millis)) {
      throw new ShiftPlanningError(
        "invalid_planning_publication_contract",
        "Public CloudEvent identity or snapshots are invalid.",
      );
    }
    const result = await dependencies.audit({
      ...snapshots, eventId: event.id, eventTime: Timestamp.fromMillis(millis),
    });
    if (result.outcome.kind === "failClosed") {
      dependencies.logger.error("Shift planning public event rejected", {
        ...logData, failureCode: result.outcome.failureCode,
        persistence: result.persistence, alertRequired: true,
      });
    }
  } catch (error) {
    dependencies.logger.error("Shift planning public event audit failed", {
      ...logData, retryRequired: true,
    });
    throw error;
  }
});
