import {HttpRequestError} from "./backend-security.js";
import {
  DocumentReference,
  Transaction,
} from "@google-cloud/firestore";
import {
  parseShiftPlanningMaintenanceState,
} from "./shift-planning-wire.js";

type UnknownRecord = Record<string, unknown>;

export type ShiftPlanningWriterAuthority = {
  schemaVersion: 1;
  stateRevision: number;
  writeEpoch: number;
  activeRevision: string | null;
  activeDigest: string | null;
};

const authorityKeys = [
  "schemaVersion",
  "stateRevision",
  "writeEpoch",
  "activeRevision",
  "activeDigest",
] as const;

const failAuthority = (code: string, message: string): never => {
  throw new HttpRequestError(409, code, message);
};

const asRecord = (value: unknown): UnknownRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value) ?
    value as UnknownRecord : {};

const parseStoredAuthority = (
  value: unknown,
  invalidCode: string,
  invalidMessage: string,
): ShiftPlanningWriterAuthority | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const authority = asRecord(value);
  const keys = Object.keys(authority);
  const activeRevision = authority.activeRevision;
  const activeDigest = authority.activeDigest;
  if (
    keys.length !== authorityKeys.length ||
    keys.some((key) => !authorityKeys.includes(
      key as typeof authorityKeys[number],
    )) ||
    authority.schemaVersion !== 1 ||
    !Number.isSafeInteger(authority.stateRevision) ||
    (authority.stateRevision as number) < 0 ||
    !Number.isSafeInteger(authority.writeEpoch) ||
    (authority.writeEpoch as number) < 0 ||
    (
      activeRevision !== null &&
      (
        typeof activeRevision !== "string" ||
        !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(activeRevision)
      )
    ) ||
    (
      activeDigest !== null &&
      (
        typeof activeDigest !== "string" ||
        !/^shift-planning:v1:sha256:[a-f0-9]{64}$/.test(activeDigest)
      )
    ) ||
    ((activeRevision === null) !== (activeDigest === null))
  ) {
    return failAuthority(
      invalidCode,
      invalidMessage,
    );
  }
  return {
    schemaVersion: 1,
    stateRevision: authority.stateRevision as number,
    writeEpoch: authority.writeEpoch as number,
    activeRevision: activeRevision as string | null,
    activeDigest: activeDigest as string | null,
  };
};

/**
 * Captures the exact open authority shared by an ordinary planning writer.
 * Missing state preserves the pre-HU-082 legacy boundary until rollout.
 * @param {unknown} value Current maintenance-state document, when present.
 * @return {ShiftPlanningWriterAuthority | null} Immutable writer authority.
 */
export const captureShiftPlanningWriterAuthority = (
  value: unknown,
): ShiftPlanningWriterAuthority | null => {
  if (value === null || value === undefined) {
    return null;
  }
  let state;
  try {
    state = parseShiftPlanningMaintenanceState(value);
  } catch {
    return failAuthority(
      "invalid_shift_planning_state",
      "Shift planning state is invalid",
    );
  }
  if (state.maintenanceStatus !== "open") {
    return failAuthority(
      "shift_planning_maintenance",
      "Shift changes are unavailable during planning maintenance",
    );
  }
  return {
    schemaVersion: 1,
    stateRevision: state.stateRevision,
    writeEpoch: state.writeEpoch,
    activeRevision: state.activeRevision,
    activeDigest: state.activeDigest,
  };
};

/**
 * Captures one operation-level authority from the canonical Firestore state.
 * Callers should do this immediately before their first external mutation.
 * @param {DocumentReference} reference Canonical maintenance-state reference.
 * @return {Promise<ShiftPlanningWriterAuthority | null>} Captured authority.
 */
export const captureShiftPlanningWriterAuthorityFromReference = async (
  reference: DocumentReference,
): Promise<ShiftPlanningWriterAuthority | null> => {
  const snapshot = await reference.get();
  return captureShiftPlanningWriterAuthority(snapshot.data());
};

/**
 * Revalidates one operation-level authority inside each mutation transaction.
 * The caller supplies its stable conflict code without exposing state details.
 * @param {object} input Captured authority, live state, and public conflict.
 */
export const assertShiftPlanningWriterAuthority = (input: {
  capturedValue: unknown;
  currentStateValue: unknown;
  changedCode: string;
  changedMessage: string;
  storedInvalidCode?: string;
  storedInvalidMessage?: string;
}): void => {
  const captured = parseStoredAuthority(
    input.capturedValue,
    input.storedInvalidCode ?? "invalid_shift_planning_writer_authority",
    input.storedInvalidMessage ?? "Shift planning writer authority is invalid",
  );
  const current = captureShiftPlanningWriterAuthority(
    input.currentStateValue,
  );
  if (
    captured === null ||
    current === null ||
    captured.stateRevision !== current.stateRevision ||
    captured.writeEpoch !== current.writeEpoch ||
    captured.activeRevision !== current.activeRevision ||
    captured.activeDigest !== current.activeDigest
  ) {
    if (captured === null && current === null) {
      return;
    }
    failAuthority(input.changedCode, input.changedMessage);
  }
};

/**
 * Re-reads and verifies an operation authority inside its mutation transaction.
 * @param {object} input Transaction, canonical state reference, and conflict.
 * @return {Promise<void>}
 */
export const assertShiftPlanningWriterAuthorityInTransaction = async (input: {
  transaction: Transaction;
  stateReference: DocumentReference;
  capturedValue: unknown;
  changedCode: string;
  changedMessage: string;
  storedInvalidCode?: string;
  storedInvalidMessage?: string;
}): Promise<void> => {
  const currentState = await input.transaction.get(input.stateReference);
  assertShiftPlanningWriterAuthority({
    capturedValue: input.capturedValue,
    currentStateValue: currentState.data(),
    changedCode: input.changedCode,
    changedMessage: input.changedMessage,
    storedInvalidCode: input.storedInvalidCode,
    storedInvalidMessage: input.storedInvalidMessage,
  });
};
