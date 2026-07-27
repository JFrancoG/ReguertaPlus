import {
  AppEnvironment,
  HttpRequestError,
  parseAppEnvironment,
} from "./backend-security.js";

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
