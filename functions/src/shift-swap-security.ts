import {
  AppEnvironment,
  HttpRequestError,
  parseAppEnvironment,
} from "./backend-security.js";
import {
  parseShiftPlanningMaintenanceState,
} from "./shift-planning-wire.js";

export type ShiftType = "delivery" | "market";

export type ShiftLike = {
  id: string;
  type: ShiftType;
  dateMillis: number;
  assignedUserIds: string[];
  helperUserId: string | null;
};

export type ShiftSwapCandidateLike = {
  userId: string;
  shiftId: string;
};

export type ShiftSwapResponseLike = ShiftSwapCandidateLike & {
  status: "available" | "unavailable";
  respondedAtMillis: number;
};

export type ShiftSwapPlanningAuthority = {
  schemaVersion: 1;
  stateRevision: number;
  writeEpoch: number;
  activeRevision: string | null;
  activeDigest: string | null;
};

const planningAuthorityKeys = [
  "schemaVersion",
  "stateRevision",
  "writeEpoch",
  "activeRevision",
  "activeDigest",
] as const;

const failPlanningAuthority = (code: string, message: string): never => {
  throw new HttpRequestError(409, code, message);
};

const parseStoredPlanningAuthority = (
  value: unknown,
): ShiftSwapPlanningAuthority | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const authority = asRecord(value);
  const keys = Object.keys(authority);
  const activeRevision = authority.activeRevision;
  const activeDigest = authority.activeDigest;
  if (
    keys.length !== planningAuthorityKeys.length ||
    keys.some((key) => !planningAuthorityKeys.includes(
      key as typeof planningAuthorityKeys[number],
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
    return failPlanningAuthority(
      "invalid_shift_swap_authority",
      "Shift-swap planning authority is invalid",
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
 * Captures the exact open planning authority for a reciprocal swap.
 * Missing state preserves the pre-HU-082 legacy boundary until rollout.
 * @param {unknown} value Current maintenance-state document, when present.
 * @return {ShiftSwapPlanningAuthority | null} Immutable request authority.
 */
export const captureShiftSwapPlanningAuthority = (
  value: unknown,
): ShiftSwapPlanningAuthority | null => {
  if (value === null || value === undefined) {
    return null;
  }
  let state;
  try {
    state = parseShiftPlanningMaintenanceState(value);
  } catch {
    return failPlanningAuthority(
      "invalid_shift_planning_state",
      "Shift planning state is invalid",
    );
  }
  if (state.maintenanceStatus !== "open") {
    return failPlanningAuthority(
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
 * Revalidates a request's captured planning authority before another mutation.
 * Any maintenance transition or activation makes the old request stale.
 * @param {unknown} capturedValue Authority persisted with the swap request.
 * @param {unknown} currentStateValue Current maintenance-state document.
 */
export const assertShiftSwapPlanningAuthority = (
  capturedValue: unknown,
  currentStateValue: unknown,
): void => {
  const captured = parseStoredPlanningAuthority(capturedValue);
  const current = captureShiftSwapPlanningAuthority(currentStateValue);
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
    failPlanningAuthority(
      "shift_swap_planning_authority_changed",
      "Shift planning authority changed after this swap was requested",
    );
  }
};

export type ShiftSwapTransitionInput =
  | {
    environment: AppEnvironment;
    action: "create";
    requestedShiftId: string;
    reason: string;
  }
  | {
    environment: AppEnvironment;
    action: "respond";
    requestId: string;
    candidateShiftId: string;
    response: "available" | "unavailable";
  }
  | {
    environment: AppEnvironment;
    action: "cancel";
    requestId: string;
  }
  | {
    environment: AppEnvironment;
    action: "apply";
    requestId: string;
    candidateShiftId: string;
  };

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" ?
    value as Record<string, unknown> :
    {};

const requiredString = (value: unknown, field: string): string => {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.includes("/") || text.length > 256) {
    throw new HttpRequestError(
      400,
      "invalid_shift_swap_payload",
      `${field} is invalid`,
    );
  }
  return text;
};

export const parseShiftSwapTransitionInput = (
  value: unknown,
): ShiftSwapTransitionInput => {
  const body = asRecord(value);
  const environment = parseAppEnvironment(body.environment ?? body.env);
  const action = typeof body.action === "string" ?
    body.action.trim().toLowerCase() :
    "";
  if (
    action !== "create" &&
    action !== "respond" &&
    action !== "cancel" &&
    action !== "apply"
  ) {
    throw new HttpRequestError(
      400,
      "invalid_shift_swap_action",
      "action must be create, respond, cancel or apply",
    );
  }

  if (action === "create") {
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (reason.length > 500) {
      throw new HttpRequestError(
        400,
        "invalid_shift_swap_payload",
        "reason must be at most 500 characters",
      );
    }
    return {
      environment,
      action,
      requestedShiftId: requiredString(
        body.requestedShiftId,
        "requestedShiftId",
      ),
      reason,
    };
  }

  const requestId = requiredString(body.requestId, "requestId");
  if (action === "cancel") {
    return {environment, action, requestId};
  }

  const candidateShiftId = requiredString(
    body.candidateShiftId,
    "candidateShiftId",
  );
  if (action === "respond") {
    const response = typeof body.response === "string" ?
      body.response.trim().toLowerCase() :
      "";
    if (response !== "available" && response !== "unavailable") {
      throw new HttpRequestError(
        400,
        "invalid_shift_swap_response",
        "response must be available or unavailable",
      );
    }
    return {environment, action, requestId, candidateShiftId, response};
  }

  return {environment, action, requestId, candidateShiftId};
};

const DELIVERY_CANDIDATE_DELAY_MILLIS = 14 * 24 * 60 * 60 * 1_000;

export const assertActiveShiftSwapParticipants = (
  requesterValue: unknown,
  candidateValue: unknown,
): void => {
  if (
    asRecord(requesterValue).isActive !== true ||
    asRecord(candidateValue).isActive !== true
  ) {
    throw new HttpRequestError(
      409,
      "shift_swap_participant_inactive",
      "Both shift-swap participants must remain active",
    );
  }
};

export const assertShiftSwapTimingEligible = (
  requestedShift: ShiftLike,
  candidateShift: ShiftLike,
  nowMillis: number,
): void => {
  if (requestedShift.dateMillis < nowMillis) {
    throw new HttpRequestError(
      409,
      "shift_in_past",
      "Past shifts cannot be swapped",
    );
  }
  const candidateThreshold = requestedShift.type === "delivery" ?
    nowMillis + DELIVERY_CANDIDATE_DELAY_MILLIS :
    nowMillis;
  if (candidateShift.dateMillis < candidateThreshold) {
    throw new HttpRequestError(
      409,
      "shift_swap_candidate_expired",
      "The selected shift is no longer eligible for this swap",
    );
  }
};

export const buildShiftSwapCandidates = (
  source: ShiftLike,
  allShifts: ShiftLike[],
  requesterUserId: string,
  nowMillis: number,
): ShiftSwapCandidateLike[] => {
  const threshold = source.type === "delivery" ?
    nowMillis + DELIVERY_CANDIDATE_DELAY_MILLIS :
    nowMillis;
  const seen = new Set<string>();
  const candidates: ShiftSwapCandidateLike[] = [];

  allShifts
    .filter((shift) =>
      shift.id !== source.id &&
      shift.type === source.type &&
      shift.dateMillis >= threshold
    )
    .sort((left, right) =>
      left.dateMillis - right.dateMillis || left.id.localeCompare(right.id)
    )
    .forEach((shift) => {
      shift.assignedUserIds.forEach((userId) => {
        const key = `${userId}:${shift.id}`;
        if (userId !== requesterUserId && !seen.has(key)) {
          seen.add(key);
          candidates.push({userId, shiftId: shift.id});
        }
      });
    });
  return candidates;
};

export const upsertShiftSwapResponse = (
  current: ShiftSwapResponseLike[],
  response: ShiftSwapResponseLike,
): ShiftSwapResponseLike[] => current
  .filter((item) =>
    item.userId !== response.userId || item.shiftId !== response.shiftId
  )
  .concat(response)
  .sort((left, right) => right.respondedAtMillis - left.respondedAtMillis);

const replaceMember = <T extends ShiftLike>(
  shift: T,
  oldUserId: string,
  newUserId: string,
): T => ({
    ...shift,
    assignedUserIds: shift.assignedUserIds.map((userId) =>
      userId === oldUserId ? newUserId : userId
    ),
    helperUserId: shift.helperUserId === oldUserId ?
      newUserId :
      shift.helperUserId,
  });

export const applyMemberSwap = <T extends ShiftLike>(
  requested: T,
  candidate: T,
  requesterUserId: string,
  responderUserId: string,
): [T, T] => {
  const requesterRepresented =
    requested.assignedUserIds.includes(requesterUserId) ||
    requested.helperUserId === requesterUserId;
  const responderRepresented =
    candidate.assignedUserIds.includes(responderUserId) ||
    candidate.helperUserId === responderUserId;
  if (!requesterRepresented || !responderRepresented) {
    throw new HttpRequestError(
      409,
      "shift_assignments_changed",
      "Shift assignments no longer match the request",
    );
  }
  if (requested.type !== candidate.type || requested.id === candidate.id) {
    throw new HttpRequestError(
      409,
      "invalid_shift_pair",
      "Shifts cannot be swapped",
    );
  }
  return [
    replaceMember(requested, requesterUserId, responderUserId),
    replaceMember(candidate, responderUserId, requesterUserId),
  ];
};

export const recomputeDeliveryHelpers = <T extends ShiftLike>(
  shifts: T[],
): T[] => {
  const deliveries = shifts
    .filter((shift) => shift.type === "delivery")
    .sort((left, right) =>
      left.dateMillis - right.dateMillis || left.id.localeCompare(right.id)
    );
  const helperById = new Map<string, string | null>();
  deliveries.forEach((shift, index) => {
    helperById.set(
      shift.id,
      deliveries[index + 1]?.assignedUserIds[0] || null,
    );
  });
  return shifts.map((shift) =>
    shift.type === "delivery" ?
      {...shift, helperUserId: helperById.get(shift.id) || null} :
      shift
  );
};
