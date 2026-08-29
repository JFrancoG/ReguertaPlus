import {
  DocumentSnapshot,
  Firestore,
  Timestamp,
} from "firebase-admin/firestore";
import {
  HttpRequestError,
  isAdminMember,
  resolveLinkedMember,
} from "./backend-security.js";
import {
  DeliveryCalendarMutationContextInput,
  DeliveryCalendarMutationInput,
  DeliveryCalendarOverrideValue,
  buildDeliveryCalendarOverride,
  createDeliveryCalendarCommandDigest,
  createDeliveryCalendarOverrideDigest,
  parseDeliveryCalendarMutationContextInput,
  parseDeliveryCalendarMutationInput,
} from "./delivery-calendar-command.js";
import {
  ShiftPlanningWriterAuthority,
  assertShiftPlanningWriterAuthorityInTransaction,
  captureShiftPlanningWriterAuthority,
} from "./shift-planning-writer-authority.js";

type UnknownRecord = Record<string, unknown>;

export type DeliveryCalendarMutationContext = {
  schemaVersion: 1;
  environment: "develop" | "production";
  weekKey: string;
  planningAuthority: ShiftPlanningWriterAuthority;
  overrideDigest: string | null;
};

export type DeliveryCalendarMutationResult = {
  schemaVersion: 1;
  environment: "develop" | "production";
  operationId: string;
  action: "upsert" | "delete";
  weekKey: string;
  commandDigest: string;
  planningAuthority: ShiftPlanningWriterAuthority;
  priorOverrideDigest: string | null;
  overrideDigest: string | null;
  override: DeliveryCalendarOverrideValue | null;
  replayed: boolean;
};

type StoredReceipt = Omit<DeliveryCalendarMutationResult, "replayed"> & {
  actorMemberId: string;
};

const receiptFields = [
  "schemaVersion",
  "operationKind",
  "environment",
  "operationId",
  "action",
  "weekKey",
  "commandDigest",
  "actorMemberId",
  "planningAuthority",
  "priorOverrideDigest",
  "overrideDigest",
  "override",
  "committedAt",
] as const;

const failConflict = (code: string, message: string): never => {
  throw new HttpRequestError(409, code, message);
};

const failReceipt = (): never => failConflict(
  "invalid_delivery_calendar_receipt",
  "Delivery calendar receipt is invalid",
);

const asRecord = (value: unknown): UnknownRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value) ?
    value as UnknownRecord : {};

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const digestPattern = /^delivery-calendar:v1:sha256:[a-f0-9]{64}$/;

const requireStoredIdentifier = (value: unknown): string => {
  if (typeof value !== "string" || !identifierPattern.test(value)) {
    return failReceipt();
  }
  return value;
};

const requireDocumentId = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 1_500 ||
    value.includes("/")
  ) {
    return failReceipt();
  }
  return value;
};

const requireStoredDigest = (value: unknown): string | null => {
  if (value === null) return null;
  if (typeof value !== "string" || !digestPattern.test(value)) {
    return failReceipt();
  }
  return value;
};

const timestampMillis = (value: unknown): number => {
  if (!(value instanceof Timestamp)) {
    return failConflict(
      "invalid_delivery_calendar_override",
      "Delivery calendar override is invalid",
    );
  }
  return value.toMillis();
};

const safeMillis = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return failReceipt();
  }
  return value as number;
};

const parseOverrideRecord = (
  value: unknown,
): DeliveryCalendarOverrideValue => {
  const override = asRecord(value);
  const expected = [
    "weekKey",
    "deliveryDateMillis",
    "ordersBlockedDateMillis",
    "ordersOpenAtMillis",
    "ordersCloseAtMillis",
    "updatedBy",
    "updatedAtMillis",
  ];
  const actual = Object.keys(override);
  if (
    actual.length !== expected.length ||
    actual.some((key) => !expected.includes(key))
  ) {
    return failReceipt();
  }
  return {
    weekKey: requireStoredIdentifier(override.weekKey),
    deliveryDateMillis: safeMillis(override.deliveryDateMillis),
    ordersBlockedDateMillis: safeMillis(override.ordersBlockedDateMillis),
    ordersOpenAtMillis: safeMillis(override.ordersOpenAtMillis),
    ordersCloseAtMillis: safeMillis(override.ordersCloseAtMillis),
    updatedBy: requireDocumentId(override.updatedBy),
    updatedAtMillis: safeMillis(override.updatedAtMillis),
  };
};

const overrideFromSnapshot = (
  snapshot: DocumentSnapshot,
): DeliveryCalendarOverrideValue | null => {
  if (!snapshot.exists) return null;
  const value = asRecord(snapshot.data());
  const weekKey = requireStoredIdentifier(value.weekKey);
  if (weekKey !== snapshot.id) {
    return failConflict(
      "invalid_delivery_calendar_override",
      "Delivery calendar override is invalid",
    );
  }
  return {
    weekKey,
    deliveryDateMillis: timestampMillis(value.deliveryDate),
    ordersBlockedDateMillis: timestampMillis(value.ordersBlockedDate),
    ordersOpenAtMillis: timestampMillis(value.ordersOpenAt),
    ordersCloseAtMillis: timestampMillis(value.ordersCloseAt),
    updatedBy: requireDocumentId(value.updatedBy),
    updatedAtMillis: timestampMillis(value.updatedAt),
  };
};

const parseStoredReceipt = (value: unknown): StoredReceipt => {
  const receipt = asRecord(value);
  const actual = Object.keys(receipt);
  if (
    actual.length !== receiptFields.length ||
    actual.some((key) => !receiptFields.includes(
      key as typeof receiptFields[number],
    )) ||
    receipt.schemaVersion !== 1 ||
    receipt.operationKind !== "deliveryCalendarMutation" ||
    (receipt.environment !== "develop" &&
      receipt.environment !== "production") ||
    (receipt.action !== "upsert" && receipt.action !== "delete") ||
    !(receipt.committedAt instanceof Timestamp)
  ) {
    return failReceipt();
  }
  const override = receipt.override === null ?
    null : parseOverrideRecord(receipt.override);
  if ((receipt.action === "upsert") !== (override !== null)) {
    return failReceipt();
  }
  let parsedCommand: DeliveryCalendarMutationInput;
  try {
    parsedCommand = parseDeliveryCalendarMutationInput({
      schemaVersion: 1,
      environment: receipt.environment,
      operationId: receipt.operationId,
      action: receipt.action,
      weekKey: receipt.weekKey,
      expectedPlanningAuthority: receipt.planningAuthority,
      expectedOverrideDigest: receipt.priorOverrideDigest,
      ...(receipt.action === "upsert" ? {
        deliveryWeekday: inferWeekday(override),
      } : {}),
    });
  } catch {
    return failReceipt();
  }
  const commandDigest = requireStoredDigest(receipt.commandDigest) ??
    failReceipt();
  const overrideDigest = requireStoredDigest(receipt.overrideDigest);
  if (
    commandDigest !== createDeliveryCalendarCommandDigest(parsedCommand) ||
    (
      override !== null &&
      (
        override.weekKey !== parsedCommand.weekKey ||
        override.updatedAtMillis !== receipt.committedAt.toMillis() ||
        overrideDigest !== createDeliveryCalendarOverrideDigest(override) ||
        JSON.stringify(override) !== JSON.stringify(
          buildDeliveryCalendarOverride({
            weekKey: parsedCommand.weekKey,
            deliveryWeekday: inferWeekday(override),
            actorMemberId: override.updatedBy,
            updatedAtMillis: override.updatedAtMillis,
          }),
        )
      )
    ) ||
    (override === null && overrideDigest !== null)
  ) {
    return failReceipt();
  }
  return {
    schemaVersion: 1,
    environment: parsedCommand.environment,
    operationId: parsedCommand.operationId,
    action: parsedCommand.action,
    weekKey: parsedCommand.weekKey,
    commandDigest,
    actorMemberId: requireDocumentId(receipt.actorMemberId),
    planningAuthority: parsedCommand.expectedPlanningAuthority,
    priorOverrideDigest: parsedCommand.expectedOverrideDigest,
    overrideDigest,
    override,
  };
};

const inferWeekday = (value: unknown): "TUE" | "THU" | "FRI" => {
  const override = parseOverrideRecord(value);
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    weekday: "short",
  }).format(new Date(override.deliveryDateMillis));
  if (day === "Tue") return "TUE";
  if (day === "Thu") return "THU";
  if (day === "Fri") return "FRI";
  return failReceipt();
};

const calendarDocument = (
  override: DeliveryCalendarOverrideValue,
): UnknownRecord => ({
  weekKey: override.weekKey,
  deliveryDate: Timestamp.fromMillis(override.deliveryDateMillis),
  ordersBlockedDate: Timestamp.fromMillis(
    override.ordersBlockedDateMillis,
  ),
  ordersOpenAt: Timestamp.fromMillis(override.ordersOpenAtMillis),
  ordersCloseAt: Timestamp.fromMillis(override.ordersCloseAtMillis),
  updatedBy: override.updatedBy,
  updatedAt: Timestamp.fromMillis(override.updatedAtMillis),
});

export const createFirestoreDeliveryCalendarCommandRepository = (
  firestore: Firestore,
  now: () => Timestamp = Timestamp.now,
) => ({
  resolveMutationContext: async (
    value: DeliveryCalendarMutationContextInput,
  ): Promise<DeliveryCalendarMutationContext> => {
    const input = parseDeliveryCalendarMutationContextInput(value);
    const root = `${input.environment}/plus-collections`;
    return firestore.runTransaction(async (transaction) => {
      const [state, current] = await Promise.all([
        transaction.get(firestore.doc(`${root}/shiftPlanningState/current`)),
        transaction.get(firestore.doc(
          `${root}/deliveryCalendar/${input.weekKey}`,
        )),
      ]);
      const planningAuthority = captureShiftPlanningWriterAuthority(
        state.data(),
      );
      if (!planningAuthority) {
        return failConflict(
          "delivery_calendar_state_unavailable",
          "Delivery calendar planning state is unavailable",
        );
      }
      const override = overrideFromSnapshot(current);
      return {
        schemaVersion: 1,
        environment: input.environment,
        weekKey: input.weekKey,
        planningAuthority,
        overrideDigest: override ?
          createDeliveryCalendarOverrideDigest(override) : null,
      };
    });
  },

  transition: async (
    value: DeliveryCalendarMutationInput,
    actor: {uid: string; memberId: string},
  ): Promise<DeliveryCalendarMutationResult> => {
    const input = parseDeliveryCalendarMutationInput(value);
    const actorUid = requireDocumentId(actor.uid);
    const actorMemberId = requireDocumentId(actor.memberId);
    const commandDigest = createDeliveryCalendarCommandDigest(input);
    const root = `${input.environment}/plus-collections`;
    const stateRef = firestore.doc(`${root}/shiftPlanningState/current`);
    const calendarRef = firestore.doc(
      `${root}/deliveryCalendar/${input.weekKey}`,
    );
    const receiptRef = firestore.doc(
      `${root}/deliveryCalendarMutationReceipts/${input.operationId}`,
    );
    const authLinkRef = firestore.doc(`${root}/authLinks/${actorUid}`);
    const memberRef = firestore.doc(`${root}/users/${actorMemberId}`);

    return firestore.runTransaction(async (transaction) => {
      const [receiptSnapshot, authLinkSnapshot, memberSnapshot] =
        await Promise.all([
          transaction.get(receiptRef),
          transaction.get(authLinkRef),
          transaction.get(memberRef),
        ]);
      if (!authLinkSnapshot.exists || !memberSnapshot.exists) {
        throw new HttpRequestError(
          403,
          "admin_required",
          "An active admin is required",
        );
      }
      const currentActor = resolveLinkedMember(
        actorUid,
        authLinkSnapshot.data(),
        memberSnapshot.data(),
      );
      if (
        currentActor.memberId !== actorMemberId ||
        !isAdminMember(currentActor)
      ) {
        throw new HttpRequestError(
          403,
          "admin_required",
          "An active admin is required",
        );
      }
      if (receiptSnapshot.exists) {
        const receipt = parseStoredReceipt(receiptSnapshot.data());
        if (
          receipt.commandDigest !== commandDigest ||
          receipt.actorMemberId !== actorMemberId
        ) {
          return failConflict(
            "delivery_calendar_operation_conflict",
            "Delivery calendar operationId is already in use",
          );
        }
        return {
          schemaVersion: 1,
          environment: receipt.environment,
          operationId: receipt.operationId,
          action: receipt.action,
          weekKey: receipt.weekKey,
          commandDigest: receipt.commandDigest,
          planningAuthority: receipt.planningAuthority,
          priorOverrideDigest: receipt.priorOverrideDigest,
          overrideDigest: receipt.overrideDigest,
          override: receipt.override,
          replayed: true,
        };
      }

      await assertShiftPlanningWriterAuthorityInTransaction({
        transaction,
        stateReference: stateRef,
        capturedValue: input.expectedPlanningAuthority,
        changedCode: "delivery_calendar_authority_changed",
        changedMessage: "Delivery calendar planning authority changed",
      });
      const currentSnapshot = await transaction.get(calendarRef);
      const currentOverride = overrideFromSnapshot(currentSnapshot);
      const currentDigest = currentOverride ?
        createDeliveryCalendarOverrideDigest(currentOverride) : null;
      if (currentDigest !== input.expectedOverrideDigest) {
        return failConflict(
          "delivery_calendar_override_conflict",
          "Delivery calendar override changed",
        );
      }

      const committedAt = now();
      const resultingOverride = input.action === "upsert" ?
        buildDeliveryCalendarOverride({
          weekKey: input.weekKey,
          deliveryWeekday: input.deliveryWeekday as "TUE" | "THU" | "FRI",
          actorMemberId,
          updatedAtMillis: committedAt.toMillis(),
        }) : null;
      const overrideDigest = resultingOverride ?
        createDeliveryCalendarOverrideDigest(resultingOverride) : null;
      const result: Omit<DeliveryCalendarMutationResult, "replayed"> = {
        schemaVersion: 1,
        environment: input.environment,
        operationId: input.operationId,
        action: input.action,
        weekKey: input.weekKey,
        commandDigest,
        planningAuthority: input.expectedPlanningAuthority,
        priorOverrideDigest: currentDigest,
        overrideDigest,
        override: resultingOverride,
      };
      if (resultingOverride) {
        transaction.set(calendarRef, calendarDocument(resultingOverride));
      } else {
        transaction.delete(calendarRef);
      }
      transaction.create(receiptRef, {
        ...result,
        operationKind: "deliveryCalendarMutation",
        actorMemberId,
        committedAt,
      });
      return {...result, replayed: false};
    });
  },
});
