import {
  DocumentReference,
  DocumentSnapshot,
  FieldPath,
  Firestore,
  QueryDocumentSnapshot,
  Timestamp,
  Transaction,
} from "@google-cloud/firestore";
import {ShiftPlanningError} from "./shift-planning-contract.js";
import {
  validateShiftPlanningNotificationCurrentSource,
} from "./shift-planning-firestore-notification-source.js";
import {SHIFT_PLANNING_MAX_DEVICES_PER_USER} from
  "./shift-planning-member-revision.js";
import {
  ShiftPlanningClaimedNotificationDispatchAttempt,
  ShiftPlanningGenericPush,
  ShiftPlanningNotificationDispatchAttempt,
  ShiftPlanningNotificationDispatchState,
  ShiftPlanningNotificationDispatchToken,
  ShiftPlanningSubmittingNotificationDispatchAttempt,
  ShiftPlanningTerminalNotificationDispatchAttempt,
  createShiftPlanningClaimedNotificationAttempt,
  genericShiftPlanningPush,
  notificationDispatchToken,
  parseShiftPlanningNotificationDispatchAttempt,
  parseShiftPlanningNotificationDispatchState,
  requireNotificationDispatchToken,
  startShiftPlanningAuthenticatedSubmission,
  terminalizeShiftPlanningNotificationAttempt,
} from "./shift-planning-notification-dispatch.js";
import {
  ShiftPlanningNotificationResourceFence,
  createShiftPlanningNotificationResourceFences,
  parseShiftPlanningNotificationResourceFence,
  sameShiftPlanningNotificationResourceFence,
  shiftPlanningNotificationAttemptCanReleaseResourceFences,
  shiftPlanningNotificationResourceFenceId,
  shiftPlanningNotificationResourceFenceIsActive,
} from "./shift-planning-notification-resource-fence.js";
import {
  createShiftPlanningNotificationReleaseArtifacts,
  parseShiftPlanningHeldNotificationIntent,
  sameShiftPlanningNotificationValue,
} from "./shift-planning-notification-release.js";
import {
  ShiftPlanningCompletedSyncCommand,
  parseShiftPlanningPersistedSyncCommand,
} from "./shift-planning-sync-command.js";
import {
  ShiftPlanningEnvironment,
} from "./shift-planning-wire.js";

export type ShiftPlanningNotificationDispatchClaimResult =
  | {
    kind: "claimed" | "replayed";
    attempt: ShiftPlanningClaimedNotificationDispatchAttempt;
    token: ShiftPlanningNotificationDispatchToken;
  }
  | {
    kind: "busy";
    retryAt: Timestamp;
  }
  | {
    kind: "terminalReplay";
    attempt: ShiftPlanningTerminalNotificationDispatchAttempt;
  };

export type ShiftPlanningNotificationSubmissionAuthorization = {
  attempt: ShiftPlanningSubmittingNotificationDispatchAttempt;
  token: ShiftPlanningNotificationDispatchToken;
  push: ShiftPlanningGenericPush;
  targets: {
    firebaseInstallationIds: readonly string[];
    fcmTokens: readonly string[];
  };
};

export type ShiftPlanningNotificationDispatchCompletionResult = {
  kind: "committed" | "terminalReplay";
  attempt: ShiftPlanningTerminalNotificationDispatchAttempt;
};

type ReleaseContext = {
  intent: ReturnType<typeof parseShiftPlanningHeldNotificationIntent>;
  root: string;
  eventId: string;
};

type DispatchReferences = {
  state: DocumentReference;
  attempts: (attemptId: string) => DocumentReference;
};

type ResourceFenceEntry = {
  reference: DocumentReference;
  expected: ShiftPlanningNotificationResourceFence;
  persisted: ShiftPlanningNotificationResourceFence | null;
};

const failDispatch = (message: string): never => {
  throw new ShiftPlanningError("invalid_planning_transaction", message);
};

const requireEnvironment = (value: unknown): ShiftPlanningEnvironment => {
  if (value !== "develop" && value !== "production") {
    return failDispatch("Notification dispatch environment is invalid.");
  }
  return value;
};

const requireIdentifier = (value: unknown, name: string): string => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  ) {
    return failDispatch(`${name} is not a valid identifier.`);
  }
  return value;
};

const requireSnapshot = (
  snapshot: DocumentSnapshot,
  name: string,
): QueryDocumentSnapshot => {
  if (!snapshot.exists) return failDispatch(`${name} does not exist.`);
  return snapshot as QueryDocumentSnapshot;
};

const completedSync = (
  snapshot: DocumentSnapshot,
  type: "delivery" | "market",
): ShiftPlanningCompletedSyncCommand => {
  const command = parseShiftPlanningPersistedSyncCommand(
    requireSnapshot(snapshot, `${type} sync command`).data(),
  );
  if (command.state !== "completed") {
    return failDispatch(`${type} sync command has no read-back.`);
  }
  return command;
};

const dispatchReferences = (
  intentReference: DocumentReference,
): DispatchReferences => ({
  state: intentReference.collection("dispatchState").doc("current"),
  attempts: (attemptId) =>
    intentReference.collection("dispatchAttempts").doc(attemptId),
});

const resourceFenceEntries = (input: {
  firestore: Firestore;
  root: string;
  attempt: ShiftPlanningClaimedNotificationDispatchAttempt |
    ShiftPlanningSubmittingNotificationDispatchAttempt;
  recipientUserId: string;
  shiftId: string;
}): Omit<ResourceFenceEntry, "persisted">[] =>
  createShiftPlanningNotificationResourceFences(input).map((expected) => ({
    reference: input.firestore.doc(
      `${input.root}/shiftPlanningNotificationFences/` +
        shiftPlanningNotificationResourceFenceId(
          expected.scope,
          expected.resourceId,
        ),
    ),
    expected,
  }));

const readResourceFenceEntries = async (input: {
  transaction: Transaction;
  entries: readonly Omit<ResourceFenceEntry, "persisted">[];
}): Promise<ResourceFenceEntry[]> => {
  const snapshots = await input.transaction.getAll(
    ...input.entries.map(({reference}) => reference),
  );
  return input.entries.map((entry, index) => ({
    ...entry,
    persisted: snapshots[index].exists ?
      parseShiftPlanningNotificationResourceFence(snapshots[index].data()) :
      null,
  }));
};

const ownsResourceFence = (entry: ResourceFenceEntry): boolean =>
  entry.persisted !== null &&
  sameShiftPlanningNotificationResourceFence(
    entry.persisted,
    entry.expected,
  );

const requireActiveResourceFences = (
  entries: readonly ResourceFenceEntry[],
  now: Timestamp,
): void => {
  if (
    entries.some((entry) =>
      !ownsResourceFence(entry) ||
      !shiftPlanningNotificationResourceFenceIsActive(
        entry.persisted as ShiftPlanningNotificationResourceFence,
        now,
      ))
  ) {
    failDispatch("Notification resource fence no longer owns submission.");
  }
};

const deleteOwnedResourceFences = (
  transaction: Transaction,
  entries: readonly ResourceFenceEntry[],
): void => {
  entries.filter(ownsResourceFence).forEach(({reference}) => {
    transaction.delete(reference);
  });
};

const initialState = (
  intentId: string,
  eventId: string,
): ShiftPlanningNotificationDispatchState => ({
  schemaVersion: 1,
  operationKind: "notificationDispatchState",
  intentId,
  eventId,
  attemptCount: 0,
  lastLeaseEpoch: 0,
  activeLease: null,
});

const requireStateBinding = (
  state: ShiftPlanningNotificationDispatchState,
  context: ReleaseContext,
): void => {
  if (
    state.intentId !== context.intent.intentId ||
    state.eventId !== context.eventId
  ) {
    failDispatch("Notification dispatch state belongs to another release.");
  }
};

const sameAttemptLease = (
  attempt: ShiftPlanningNotificationDispatchAttempt,
  state: ShiftPlanningNotificationDispatchState,
): boolean => state.activeLease !== null &&
  state.activeLease.attemptId === attempt.attemptId &&
  state.activeLease.workerId === attempt.lease.workerId &&
  state.activeLease.epoch === attempt.lease.epoch &&
  state.activeLease.acquiredAt.isEqual(attempt.lease.acquiredAt) &&
  state.activeLease.expiresAt.isEqual(attempt.lease.expiresAt);

const requireReleaseContext = async (input: {
  firestore: Firestore;
  transaction: Transaction;
  environment: ShiftPlanningEnvironment;
  intentId: string;
}): Promise<ReleaseContext> => {
  const root = `${input.environment}/plus-collections`;
  const intentReference = input.firestore.doc(
    `${root}/shiftPlanningNotificationIntents/${input.intentId}`,
  );
  const intentSnapshot = await input.transaction.get(intentReference);
  const intent = parseShiftPlanningHeldNotificationIntent(
    requireSnapshot(intentSnapshot, "held notification intent").data(),
  );
  if (intent.intentId !== input.intentId) {
    return failDispatch("Notification intent path and payload differ.");
  }
  const eventId = intent.intentId;
  const [
    receiptSnapshot,
    eventSnapshot,
    inboxSnapshot,
    deliverySyncSnapshot,
    marketSyncSnapshot,
  ] = await input.transaction.getAll(
    intentReference.collection("releases").doc("canonical"),
    input.firestore.doc(`${root}/notificationEvents/${eventId}`),
    input.firestore.doc(
      `${root}/users/${intent.recipientUserId}/notificationInbox/${eventId}`,
    ),
    input.firestore.doc(
      `${root}/shiftPlanningSyncCommands/${intent.bundleRevision}-delivery`,
    ),
    input.firestore.doc(
      `${root}/shiftPlanningSyncCommands/${intent.bundleRevision}-market`,
    ),
  );
  const releasedAt = receiptSnapshot.get("releasedAt");
  if (!(releasedAt instanceof Timestamp)) {
    return failDispatch("Notification release receipt is missing.");
  }
  const artifacts = createShiftPlanningNotificationReleaseArtifacts({
    intent,
    deliverySync: completedSync(deliverySyncSnapshot, "delivery"),
    marketSync: completedSync(marketSyncSnapshot, "market"),
    releasedAt,
  });
  if (
    !sameShiftPlanningNotificationValue(
      receiptSnapshot.data(),
      artifacts.receipt,
    ) ||
    !sameShiftPlanningNotificationValue(
      eventSnapshot.data(),
      artifacts.event,
    ) ||
    !sameShiftPlanningNotificationValue(inboxSnapshot.data(), artifacts.inbox)
  ) {
    return failDispatch("Notification release artifacts have drifted.");
  }
  return {intent, root, eventId};
};

const readCurrentValidation = async (input: {
  firestore: Firestore;
  transaction: Transaction;
  context: ReleaseContext;
}) => {
  const {root, intent} = input.context;
  const [maintenanceSnapshot, shiftSnapshot, memberSnapshot] =
    await input.transaction.getAll(
      input.firestore.doc(`${root}/shiftPlanningState/current`),
      input.firestore.doc(`${root}/shifts/${intent.shiftId}`),
      input.firestore.doc(`${root}/users/${intent.recipientUserId}`),
    );
  const devicesSnapshot = await input.transaction.get(
    input.firestore.collection(
      `${root}/users/${intent.recipientUserId}/devices`,
    ).orderBy(FieldPath.documentId()).limit(
      SHIFT_PLANNING_MAX_DEVICES_PER_USER + 1,
    ),
  );
  if (devicesSnapshot.size > SHIFT_PLANNING_MAX_DEVICES_PER_USER) {
    return failDispatch("Notification destinations exceed their read limit.");
  }
  return validateShiftPlanningNotificationCurrentSource({
    root,
    intent,
    maintenanceSnapshot,
    shiftSnapshot,
    memberSnapshot,
    devices: devicesSnapshot.docs,
  });
};

const requireActiveAttempt = (
  attempt: ShiftPlanningNotificationDispatchAttempt,
  state: ShiftPlanningNotificationDispatchState,
  token: ShiftPlanningNotificationDispatchToken,
) => {
  if (attempt.state === "terminal") {
    return failDispatch("Notification dispatch attempt is already terminal.");
  }
  requireNotificationDispatchToken(attempt, token);
  if (!sameAttemptLease(attempt, state)) {
    return failDispatch("Notification dispatch lease is no longer active.");
  }
  return attempt;
};

/**
 * Persists the local notification dispatch fence and append-only attempt set.
 * No method invokes FCM; transport integration remains a later explicit cut.
 * @param {Firestore} firestore Pinned Firestore authority or emulator.
 * @param {Function} clock Trusted callback clock.
 * @return {object} Explicit dispatch lifecycle repository.
 */
export const createFirestoreShiftPlanningNotificationDispatchRepository = (
  firestore: Firestore,
  clock: () => Timestamp = () => Timestamp.now(),
) => ({
  async claim(input: {
    environment: ShiftPlanningEnvironment;
    intentId: string;
    workerId: string;
    attemptId: string;
  }): Promise<ShiftPlanningNotificationDispatchClaimResult> {
    const environment = requireEnvironment(input.environment);
    const intentId = requireIdentifier(input.intentId, "dispatch intentId");
    const workerId = requireIdentifier(input.workerId, "dispatch workerId");
    const attemptId = requireIdentifier(input.attemptId, "dispatch attemptId");
    return firestore.runTransaction(async (transaction) => {
      const context = await requireReleaseContext({
        firestore,
        transaction,
        environment,
        intentId,
      });
      const intentReference = firestore.doc(
        `${context.root}/shiftPlanningNotificationIntents/${intentId}`,
      );
      const references = dispatchReferences(intentReference);
      const [stateSnapshot, requestedAttemptSnapshot] =
        await transaction.getAll(
          references.state,
          references.attempts(attemptId),
        );
      const state = stateSnapshot.exists ?
        parseShiftPlanningNotificationDispatchState(stateSnapshot.data()) :
        initialState(intentId, context.eventId);
      requireStateBinding(state, context);
      const now = clock();
      if (requestedAttemptSnapshot.exists) {
        const existing = parseShiftPlanningNotificationDispatchAttempt(
          requestedAttemptSnapshot.data(),
        );
        if (
          existing.intentId !== intentId ||
          existing.eventId !== context.eventId
        ) {
          return failDispatch("Dispatch attempt path and payload differ.");
        }
        if (existing.state === "terminal") {
          return {kind: "terminalReplay", attempt: existing};
        }
        if (
          sameAttemptLease(existing, state) &&
          now.toMillis() < existing.lease.expiresAt.toMillis()
        ) {
          if (existing.state !== "claimed") {
            return failDispatch("Submitting attempt cannot replay a claim.");
          }
          return {
            kind: "replayed",
            attempt: existing,
            token: notificationDispatchToken(existing),
          };
        }
        return failDispatch("Dispatch retry requires a fresh attemptId.");
      }
      let expiredAttempt: ShiftPlanningTerminalNotificationDispatchAttempt |
        null = null;
      if (state.activeLease !== null) {
        const activeSnapshot = await transaction.get(
          references.attempts(state.activeLease.attemptId),
        );
        const active = parseShiftPlanningNotificationDispatchAttempt(
          requireSnapshot(activeSnapshot, "active dispatch attempt").data(),
        );
        if (!sameAttemptLease(active, state) || active.state === "terminal") {
          return failDispatch("Active dispatch lease evidence has drifted.");
        }
        if (now.toMillis() < active.lease.expiresAt.toMillis()) {
          return {kind: "busy", retryAt: active.lease.expiresAt};
        }
        expiredAttempt = terminalizeShiftPlanningNotificationAttempt({
          attempt: active,
          completedAt: now,
          outcome: active.state === "claimed" ? "failed" : "unknown",
          failureCode: active.state === "claimed" ?
            "lease_expired_before_submission" : "submission_lease_expired",
          acceptedTargetCount: 0,
        });
      }
      const validation = await readCurrentValidation({
        firestore,
        transaction,
        context,
      });
      const attempt = createShiftPlanningClaimedNotificationAttempt({
        intentId,
        eventId: context.eventId,
        attemptId,
        workerId,
        attemptOrdinal: state.attemptCount + 1,
        acquiredAt: now,
        validation,
      });
      const resourceFences = await readResourceFenceEntries({
        transaction,
        entries: resourceFenceEntries({
          firestore,
          root: context.root,
          attempt,
          recipientUserId: context.intent.recipientUserId,
          shiftId: context.intent.shiftId,
        }),
      });
      const activeResourceFences = resourceFences.filter(({persisted}) =>
        persisted !== null &&
        shiftPlanningNotificationResourceFenceIsActive(persisted, now),
      );
      if (activeResourceFences.length > 0) {
        const retryAt = activeResourceFences.reduce(
          (latest, {persisted}) =>
            (persisted as ShiftPlanningNotificationResourceFence).expiresAt
              .toMillis() > latest.toMillis() ?
              (persisted as ShiftPlanningNotificationResourceFence).expiresAt :
              latest,
          (activeResourceFences[0].persisted as
            ShiftPlanningNotificationResourceFence).expiresAt,
        );
        return {kind: "busy", retryAt};
      }
      const nextState: ShiftPlanningNotificationDispatchState = {
        ...state,
        attemptCount: attempt.attemptOrdinal,
        lastLeaseEpoch: attempt.lease.epoch,
        activeLease: attempt.lease,
      };
      if (expiredAttempt !== null) {
        transaction.set(
          references.attempts(expiredAttempt.attemptId),
          expiredAttempt,
        );
      }
      transaction.create(references.attempts(attemptId), attempt);
      transaction.set(references.state, nextState);
      resourceFences.forEach(({reference, expected}) => {
        transaction.set(reference, expected);
      });
      return {
        kind: "claimed",
        attempt,
        token: notificationDispatchToken(attempt),
      };
    });
  },

  async authorizeAuthenticatedSubmission(input: {
    environment: ShiftPlanningEnvironment;
    token: ShiftPlanningNotificationDispatchToken;
  }): Promise<ShiftPlanningNotificationSubmissionAuthorization> {
    const environment = requireEnvironment(input.environment);
    return firestore.runTransaction(async (transaction) => {
      const context = await requireReleaseContext({
        firestore,
        transaction,
        environment,
        intentId: input.token.intentId,
      });
      const intentReference = firestore.doc(
        `${context.root}/shiftPlanningNotificationIntents/` +
          context.intent.intentId,
      );
      const references = dispatchReferences(intentReference);
      const [stateSnapshot, attemptSnapshot] = await transaction.getAll(
        references.state,
        references.attempts(input.token.attemptId),
      );
      const state = parseShiftPlanningNotificationDispatchState(
        requireSnapshot(stateSnapshot, "dispatch state").data(),
      );
      requireStateBinding(state, context);
      const current = requireActiveAttempt(
        parseShiftPlanningNotificationDispatchAttempt(
          requireSnapshot(attemptSnapshot, "dispatch attempt").data(),
        ),
        state,
        input.token,
      );
      if (current.state !== "claimed") {
        return failDispatch("Notification attempt already began submission.");
      }
      const now = clock();
      if (now.toMillis() >= current.lease.expiresAt.toMillis()) {
        return failDispatch("Notification dispatch lease expired.");
      }
      const validation = await readCurrentValidation({
        firestore,
        transaction,
        context,
      });
      const messagingTargetCount =
        validation.messagingTargets.firebaseInstallationIds.length +
        validation.messagingTargets.fcmTokens.length;
      if (
        validation.validationDigest !== current.validation.validationDigest ||
        messagingTargetCount !== current.validation.messagingTargetCount
      ) {
        return failDispatch("Notification dispatch validation drifted.");
      }
      const resourceFences = await readResourceFenceEntries({
        transaction,
        entries: resourceFenceEntries({
          firestore,
          root: context.root,
          attempt: current,
          recipientUserId: context.intent.recipientUserId,
          shiftId: context.intent.shiftId,
        }),
      });
      requireActiveResourceFences(resourceFences, now);
      const submitting = startShiftPlanningAuthenticatedSubmission({
        attempt: current,
        startedAt: now,
      });
      transaction.set(references.attempts(current.attemptId), submitting);
      return {
        attempt: submitting,
        token: notificationDispatchToken(submitting),
        push: genericShiftPlanningPush(context.eventId),
        targets: validation.messagingTargets,
      };
    });
  },

  async failBeforeSubmission(input: {
    environment: ShiftPlanningEnvironment;
    token: ShiftPlanningNotificationDispatchToken;
    failureCode: string;
  }): Promise<ShiftPlanningNotificationDispatchCompletionResult> {
    const environment = requireEnvironment(input.environment);
    const failureCode = requireIdentifier(
      input.failureCode,
      "dispatch failureCode",
    );
    return firestore.runTransaction(async (transaction) => {
      const root = `${environment}/plus-collections`;
      const intentReference = firestore.doc(
        `${root}/shiftPlanningNotificationIntents/${input.token.intentId}`,
      );
      const references = dispatchReferences(intentReference);
      const [stateSnapshot, attemptSnapshot, intentSnapshot] =
        await transaction.getAll(
          references.state,
          references.attempts(input.token.attemptId),
          intentReference,
        );
      const attempt = parseShiftPlanningNotificationDispatchAttempt(
        requireSnapshot(attemptSnapshot, "dispatch attempt").data(),
      );
      if (attempt.state === "terminal") {
        return {kind: "terminalReplay", attempt};
      }
      const state = parseShiftPlanningNotificationDispatchState(
        requireSnapshot(stateSnapshot, "dispatch state").data(),
      );
      const active = requireActiveAttempt(attempt, state, input.token);
      if (active.state !== "claimed") {
        return failDispatch("Started submission cannot fail as unsubmitted.");
      }
      const intent = parseShiftPlanningHeldNotificationIntent(
        requireSnapshot(intentSnapshot, "held notification intent").data(),
      );
      const resourceFences = await readResourceFenceEntries({
        transaction,
        entries: resourceFenceEntries({
          firestore,
          root,
          attempt: active,
          recipientUserId: intent.recipientUserId,
          shiftId: intent.shiftId,
        }),
      });
      const terminal = terminalizeShiftPlanningNotificationAttempt({
        attempt: active,
        completedAt: clock(),
        outcome: "failed",
        failureCode,
        acceptedTargetCount: 0,
      });
      transaction.set(references.attempts(active.attemptId), terminal);
      transaction.set(references.state, {...state, activeLease: null});
      deleteOwnedResourceFences(transaction, resourceFences);
      return {kind: "committed", attempt: terminal};
    });
  },

  async completeSubmission(input: {
    environment: ShiftPlanningEnvironment;
    token: ShiftPlanningNotificationDispatchToken;
    result:
      | {outcome: "accepted"; acceptedTargetCount: number}
      | {outcome: "failed" | "unknown"; failureCode: string};
  }): Promise<ShiftPlanningNotificationDispatchCompletionResult> {
    const environment = requireEnvironment(input.environment);
    return firestore.runTransaction(async (transaction) => {
      const root = `${environment}/plus-collections`;
      const intentReference = firestore.doc(
        `${root}/shiftPlanningNotificationIntents/${input.token.intentId}`,
      );
      const references = dispatchReferences(intentReference);
      const [stateSnapshot, attemptSnapshot, intentSnapshot] =
        await transaction.getAll(
          references.state,
          references.attempts(input.token.attemptId),
          intentReference,
        );
      const attempt = parseShiftPlanningNotificationDispatchAttempt(
        requireSnapshot(attemptSnapshot, "dispatch attempt").data(),
      );
      if (attempt.state === "terminal") {
        return {kind: "terminalReplay", attempt};
      }
      const state = parseShiftPlanningNotificationDispatchState(
        requireSnapshot(stateSnapshot, "dispatch state").data(),
      );
      const active = requireActiveAttempt(attempt, state, input.token);
      if (active.state !== "submitting") {
        return failDispatch("Notification submission did not start.");
      }
      const intent = parseShiftPlanningHeldNotificationIntent(
        requireSnapshot(intentSnapshot, "held notification intent").data(),
      );
      const resourceFences = await readResourceFenceEntries({
        transaction,
        entries: resourceFenceEntries({
          firestore,
          root,
          attempt: active,
          recipientUserId: intent.recipientUserId,
          shiftId: intent.shiftId,
        }),
      });
      const completedAt = clock();
      if (completedAt.toMillis() < active.lease.expiresAt.toMillis()) {
        requireActiveResourceFences(resourceFences, completedAt);
      }
      let failureCode: string | null;
      let acceptedTargetCount: number;
      if (input.result.outcome === "accepted") {
        failureCode = null;
        acceptedTargetCount = input.result.acceptedTargetCount;
      } else {
        failureCode = input.result.failureCode;
        acceptedTargetCount = 0;
      }
      const terminal = terminalizeShiftPlanningNotificationAttempt({
        attempt: active,
        completedAt,
        outcome: input.result.outcome,
        failureCode,
        acceptedTargetCount,
      });
      transaction.set(references.attempts(active.attemptId), terminal);
      transaction.set(references.state, {...state, activeLease: null});
      if (shiftPlanningNotificationAttemptCanReleaseResourceFences(terminal)) {
        deleteOwnedResourceFences(transaction, resourceFences);
      }
      return {kind: "committed", attempt: terminal};
    });
  },
});
