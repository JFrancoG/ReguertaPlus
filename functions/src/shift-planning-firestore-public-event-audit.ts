import {Firestore, Timestamp} from "@google-cloud/firestore";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {
  ShiftPlanningBackendMutationMarker,
  parseShiftPlanningActivationOperationTerminal,
  parseShiftPlanningBackendMutationMarker,
  parseShiftPlanningPublicShiftDocument,
} from "./shift-planning-publication-contract.js";
import {
  createShiftPlanningControlledPublicEventDecision,
  parseShiftPlanningControlledMutationOperationTerminal,
} from "./shift-planning-public-event-contract.js";
import {
  parseShiftPlanningRecoveryOperationTerminal,
} from "./shift-planning-inverse-materializer.js";
import {
  ShiftPlanningPublicEventProducerOutcome,
  ShiftPlanningPublicEventOperationRetention,
  ShiftPlanningPublicEventRetentionPolicy,
  createShiftPlanningRejectedPublicEventAudit,
  parseShiftPlanningPublicEventLedger,
  parseShiftPlanningPublicEventOperationRetention,
  parseShiftPlanningPublicEventRetentionPolicy,
  produceShiftPlanningPublicEventAudit,
  shiftPlanningPublicEventLedgerPath,
  shiftPlanningPublicEventOperationRetentionPath,
} from "./shift-planning-public-event-retention.js";

export type ShiftPlanningPublicEventAuditInput = {
  eventId: string;
  eventTime: Timestamp;
  targetPath: string;
  before: unknown | null;
  after: unknown | null;
};

export type ShiftPlanningPersistedPublicEventAudit = {
  outcome: ShiftPlanningPublicEventProducerOutcome;
  persistence: "notRequired" | "created" | "replayed";
};

const marker = (
  document: unknown,
): ShiftPlanningBackendMutationMarker | null => {
  if (typeof document !== "object" || document === null ||
      !("lastBackendMutation" in document)) return null;
  return parseShiftPlanningBackendMutationMarker(document.lastBackendMutation);
};

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null && key in value ?
    Reflect.get(value, key) : undefined;

const identifier = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);

const failReplay = (): never => {
  throw new ShiftPlanningError(
    "invalid_planning_publication_contract",
    "Public event ledger does not match the immutable event decision.",
  );
};

const knownDeleteAuthority = (
  value: unknown,
  beforeMarker: ShiftPlanningBackendMutationMarker,
  targetPath: string,
): boolean => {
  if (beforeMarker.targetPath !== targetPath) return false;
  if (field(value, "operationKind") === "activationRecovery") {
    parseShiftPlanningRecoveryOperationTerminal(value);
    return true;
  }
  const operation = field(value, "operationKind") === "activation" ?
    parseShiftPlanningActivationOperationTerminal(value) :
    parseShiftPlanningControlledMutationOperationTerminal(value);
  const kind = operation.operationKind === "activation" ?
    "activation" : operation.kind;
  return beforeMarker.kind === kind &&
    beforeMarker.operationId === operation.operationId &&
    beforeMarker.operationIntentDigest === operation.operationIntentDigest &&
    beforeMarker.bundleRevision === operation.bundleRevision &&
    beforeMarker.bundleDigest === operation.bundleDigest &&
    beforeMarker.writeEpoch === operation.writeEpoch &&
    operation.publicMutations.some((binding) =>
      binding.targetPath === beforeMarker.targetPath &&
      binding.documentRevision === beforeMarker.documentRevision &&
      binding.payloadDigest === beforeMarker.payloadDigest);
};

/**
 * Persists controlled/rejected decisions before callers acknowledge delivery.
 * The caller supplies stable CloudEvent time and an explicit retention policy;
 * SDK failures reject the call and must remain retryable at the trigger.
 * The caller receives alertRequired as a signal, not proof of alert delivery.
 * Recovery updates remain rejected until their exact before-image contract is
 * integrated. This adapter neither creates retention nor cleans up terminals.
 * A recovery delete whose registry was lost cannot recover its old ledger ID;
 * it records an alertable rejection. Retaining those terminals is mandatory.
 * @param {Firestore} firestore Environment-scoped authority and ledger store.
 * @param {ShiftPlanningPublicEventRetentionPolicy} policy Configured policy.
 * @return {object} Transactional public-event audit adapter.
 */
export const createFirestoreShiftPlanningPublicEventAudit = (
  firestore: Firestore,
  policy: ShiftPlanningPublicEventRetentionPolicy,
) => {
  const configuredPolicy = parseShiftPlanningPublicEventRetentionPolicy(policy);
  return {
    async audit(
      input: ShiftPlanningPublicEventAuditInput,
    ): Promise<ShiftPlanningPersistedPublicEventAudit> {
      return firestore.runTransaction<ShiftPlanningPersistedPublicEventAudit>(
        async (transaction) => {
          const unboundInput = {
            ...input,
            operation: null,
            retention: null,
            policy: configuredPolicy,
          };
          const unbound = produceShiftPlanningPublicEventAudit(unboundInput);
          if (unbound.kind === "ordinary" && input.after !== null) {
            return {outcome: unbound, persistence: "notRequired"};
          }
          const environment = input.targetPath.split("/")[0];
          if (environment !== "develop" && environment !== "production") {
            return failReplay();
          }
          const rejectionInput = {
            eventId: input.eventId,
            eventTime: input.eventTime,
            targetPath: input.targetPath,
            mutationKind: input.after === null ? "delete" as const :
              input.before === null ? "create" as const : "update" as const,
            policy: configuredPolicy,
          };
          const rejected = createShiftPlanningRejectedPublicEventAudit(
            rejectionInput,
          );
          const rejectedReference = firestore.doc(
            shiftPlanningPublicEventLedgerPath({
              environment, eventDigest: rejected.eventDigest,
            }),
          );
          const retainedRejection = await transaction.get(rejectedReference);
          if (retainedRejection.exists) {
            const ledger = parseShiftPlanningPublicEventLedger(
              retainedRejection.data(),
            );
            const outcome = createShiftPlanningRejectedPublicEventAudit({
              ...rejectionInput,
              policy: parseShiftPlanningPublicEventRetentionPolicy({
                schemaVersion: ledger.schemaVersion,
                policyRevision: ledger.policyRevision,
                maximumDeliveryRetryHorizonMillis:
                  ledger.maximumDeliveryRetryHorizonMillis,
                safetyMarginMillis: ledger.safetyMarginMillis,
                policyDigest: ledger.policyDigest,
              }),
            });
            if (ledger.ledgerDigest !== outcome.ledger.ledgerDigest) {
              return failReplay();
            }
            return {outcome, persistence: "replayed"};
          }
          const reject = (): ShiftPlanningPersistedPublicEventAudit => {
            transaction.create(rejectedReference, rejected.ledger);
            return {outcome: rejected, persistence: "created"};
          };
          const readOperation = async (operationId: string) => {
            const snapshot = await transaction.get(firestore.doc(
              `${environment}/plus-collections/shiftPlanningOperations/` +
              operationId,
            ));
            return snapshot.exists ? snapshot.data() ?? null : null;
          };
          let beforeMarker: ShiftPlanningBackendMutationMarker | null = null;
          let afterMarker: ShiftPlanningBackendMutationMarker | null = null;
          try {
            beforeMarker = marker(input.before);
            afterMarker = marker(input.after);
          } catch (error) {
            if (!(error instanceof ShiftPlanningError)) throw error;
            return reject();
          }
          if (afterMarker !== null) {
            const decision = createShiftPlanningControlledPublicEventDecision({
              operationKind: afterMarker.kind,
              mutationKind: input.before === null ? "create" : "update",
              operationId: afterMarker.operationId,
              operationIntentDigest: afterMarker.operationIntentDigest,
              targetPath: input.targetPath, beforeMarker, afterMarker,
            });
            const existing = await transaction.get(firestore.doc(
              shiftPlanningPublicEventLedgerPath({
                environment, eventDigest: decision.eventDigest,
              }),
            ));
            if (existing.exists) {
              const ledger = parseShiftPlanningPublicEventLedger(
                existing.data(),
              );
              parseShiftPlanningPublicShiftDocument({
                targetPath: input.targetPath,
                value: input.after,
                expectedOperationIntentDigest: decision.operationIntentDigest,
              });
              if (ledger.outcome !== "controlledNoOp" ||
                  ledger.targetPath !== decision.targetPath ||
                  ledger.mutationKind !== decision.mutationKind ||
                  ledger.controlledOperationKind !== decision.operationKind ||
                  ledger.operationId !== decision.operationId ||
                  ledger.operationIntentDigest !==
                    decision.operationIntentDigest ||
                  ledger.eventDigest !== decision.eventDigest ||
                  input.eventTime.toMillis() > ledger.retainUntil.toMillis()) {
                return failReplay();
              }
              return {
                outcome: {
                  kind: "controlledNoOp", decision, ledger,
                  alertRequired: false, legacySideEffectsAllowed: false,
                },
                persistence: "replayed",
              };
            }
          }
          const beforeOperation = beforeMarker === null ? null :
            await readOperation(beforeMarker.operationId);
          if (input.after === null && beforeMarker !== null) {
            try {
              if (!knownDeleteAuthority(
                beforeOperation, beforeMarker, input.targetPath,
              )) {
                return reject();
              }
            } catch (error) {
              if (!(error instanceof ShiftPlanningError)) throw error;
              return reject();
            }
          }
          const isRecovery = field(beforeOperation, "operationKind") ===
          "activationRecovery";
          // Restoring an old marker must not masquerade as its old activation.
          const operation = input.after === null || isRecovery ?
            beforeOperation :
            afterMarker === null ? null :
              await readOperation(afterMarker.operationId);
          const operationId = isRecovery ?
            field(operation, "recoveryOperationId") : afterMarker?.operationId;
          let retention: ShiftPlanningPublicEventOperationRetention | null =
            null;
          if (identifier(operationId)) {
            const snapshot = await transaction.get(firestore.doc(
              shiftPlanningPublicEventOperationRetentionPath({
                environment, operationId,
              }),
            ));
            if (snapshot.exists) {
              try {
                retention = parseShiftPlanningPublicEventOperationRetention(
                  snapshot.data(),
                );
              } catch (error) {
                if (!(error instanceof ShiftPlanningError)) throw error;
              // Invalid authority remains a rejected event in the producer.
              }
            }
          }
          const boundInput = {...unboundInput, operation, retention};
          const outcome = produceShiftPlanningPublicEventAudit(boundInput);
          if (outcome.kind === "ordinary") {
            return {outcome, persistence: "notRequired"};
          }
          const reference = firestore.doc(shiftPlanningPublicEventLedgerPath({
            environment, eventDigest: outcome.ledger.eventDigest,
          }));
          const existing = await transaction.get(reference);
          if (!existing.exists) {
            transaction.create(reference, outcome.ledger);
            return {outcome, persistence: "created"};
          }
          const retained = parseShiftPlanningPublicEventLedger(existing.data());
          if (retained.ledgerDigest !== outcome.ledger.ledgerDigest) {
            return failReplay();
          }
          return {outcome, persistence: "replayed"};
        },
      );
    },
  };
};
