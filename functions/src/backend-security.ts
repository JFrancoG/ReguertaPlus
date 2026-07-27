import {createHash} from "node:crypto";

export type AppEnvironment = "develop" | "production";

export type CanonicalRole = "member" | "producer" | "admin";

export type VerifiedIdentity = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
};

export type ReviewerRoutingPolicy = {
  emails: string[];
  uids: string[];
};

export type IdentityTokenVerifier = (
  token: string,
  checkRevoked: boolean,
) => Promise<unknown>;

export type FirestoreEventAuthType =
  | "service_account"
  | "api_key"
  | "system"
  | "unauthenticated"
  | "unknown";

export type FirestoreEventAuthContext = {
  authType: FirestoreEventAuthType;
  authId?: string;
};

export type LinkedActiveAdminResolver = (uid: string) => Promise<boolean>;

export type LinkedMember = {
  memberId: string;
  roles: CanonicalRole[];
  isActive: true;
};

export type ProducerParity = "even" | "odd";

export type EcoCommitmentMode = "weekly" | "biweekly";

export type FieldPatch<T> =
  | {kind: "preserve"}
  | {kind: "clear"}
  | {kind: "set"; value: T};

export type MemberBusinessFields = {
  companyName: string | null;
  phoneNumber: string | null;
  producerParity: ProducerParity | null;
  ecoCommitment: {
    mode: EcoCommitmentMode;
    parity: ProducerParity | null;
  };
};

export type MemberUpsertInput = {
  memberId: string | null;
  displayName: string;
  normalizedEmail: string;
  roles: CanonicalRole[];
  isActive: boolean;
  producerCatalogEnabled: boolean;
  isCommonPurchaseManager: boolean;
  companyName: FieldPatch<string>;
  phoneNumber: FieldPatch<string>;
  producerParity: FieldPatch<ProducerParity>;
  ecoCommitment: {
    mode: FieldPatch<EcoCommitmentMode>;
    parity: FieldPatch<ProducerParity>;
  };
};

/** Safe HTTP error whose message can be returned to a caller. */
export class HttpRequestError extends Error {
  /**
   * Creates a request error.
   * @param {number} status HTTP response status.
   * @param {string} code Stable machine-readable error code.
   * @param {string} message Safe user-facing message.
   */
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpRequestError";
  }
}

const asTrimmedString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" ?
    value as Record<string, unknown> :
    {};

const hasOwn = (value: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const extractStringValues = (
  source: Record<string, unknown>,
  keys: string[],
): string[] => keys.flatMap((key) => {
  const value = source[key];
  const values = Array.isArray(value) ? value : [value];
  return values
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
});

export const parseReviewerRoutingPolicy = (
  value: unknown,
): ReviewerRoutingPolicy => {
  const source = asRecord(value);
  const nested = asRecord(source.reviewerAllowlist);
  const emails = extractStringValues(source, [
    "reviewerAllowlistEmails",
    "reviewerAllowlist",
    "reviewerEmails",
  ]).concat(extractStringValues(nested, [
    "emails",
    "allowlistedEmails",
  ])).map((email) => email.toLowerCase());
  const uids = extractStringValues(source, [
    "reviewerAllowlistUids",
    "reviewerUids",
  ]).concat(extractStringValues(nested, [
    "uids",
    "allowlistedUids",
  ]));
  return {
    emails: Array.from(new Set(emails)),
    uids: Array.from(new Set(uids)),
  };
};

export const resolveReviewerEnvironment = (
  requestedEnvironment: AppEnvironment,
  identity: VerifiedIdentity,
  globalConfig: unknown,
): AppEnvironment => {
  if (requestedEnvironment !== "production") {
    return requestedEnvironment;
  }
  const policy = parseReviewerRoutingPolicy(globalConfig);
  const isAllowlisted = policy.uids.includes(identity.uid) ||
    (identity.email !== null && policy.emails.includes(identity.email));
  return isAllowlisted ? "develop" : requestedEnvironment;
};

export const parseAppEnvironment = (value: unknown): AppEnvironment => {
  const normalized = asTrimmedString(value)?.toLowerCase();
  if (normalized === "develop" || normalized === "production") {
    return normalized;
  }
  throw new HttpRequestError(
    400,
    "invalid_environment",
    "environment must be develop or production",
  );
};

export const extractBearerToken = (authorization: unknown): string => {
  const header = Array.isArray(authorization) ?
    authorization[0] :
    authorization;
  const value = asTrimmedString(header);
  const match = value?.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) {
    throw new HttpRequestError(
      401,
      "unauthenticated",
      "A valid Authorization Bearer token is required",
    );
  }
  return match[1];
};

export const parseVerifiedIdentity = (value: unknown): VerifiedIdentity => {
  const token = asRecord(value);
  const uid = asTrimmedString(token.uid);
  if (!uid) {
    throw new HttpRequestError(401, "unauthenticated", "Invalid ID token");
  }
  const email = asTrimmedString(token.email)?.toLowerCase() || null;
  return {
    uid,
    email,
    emailVerified: token.email_verified === true,
  };
};

export const verifyBearerIdentity = async (
  authorization: unknown,
  verifyToken: IdentityTokenVerifier,
): Promise<VerifiedIdentity> => {
  const token = extractBearerToken(authorization);
  try {
    return parseVerifiedIdentity(await verifyToken(token, true));
  } catch {
    throw new HttpRequestError(
      401,
      "unauthenticated",
      "A valid Authorization Bearer token is required",
    );
  }
};

const CANONICAL_ROLE_ORDER: CanonicalRole[] = [
  "member",
  "producer",
  "admin",
];

export const normalizeCanonicalRoles = (
  value: unknown,
): CanonicalRole[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new HttpRequestError(
      400,
      "invalid_roles",
      "roles must contain canonical roles",
    );
  }

  const normalized = value.map((role) =>
    typeof role === "string" ? role.trim().toLowerCase() : ""
  );
  if (normalized.some((role) =>
    !CANONICAL_ROLE_ORDER.includes(role as CanonicalRole)
  )) {
    throw new HttpRequestError(
      400,
      "invalid_roles",
      "roles contain an unsupported value",
    );
  }

  const unique = new Set(normalized as CanonicalRole[]);
  if (!unique.has("member")) {
    throw new HttpRequestError(
      400,
      "invalid_roles",
      "roles must include member",
    );
  }
  return CANONICAL_ROLE_ORDER.filter((role) => unique.has(role));
};

export const resolveLinkedMember = (
  uid: string,
  linkValue: unknown,
  memberValue: unknown,
): LinkedMember => {
  const link = asRecord(linkValue);
  const member = asRecord(memberValue);
  const memberId = asTrimmedString(link.memberId);
  if (!memberId) {
    throw new HttpRequestError(
      403,
      "unlinked_account",
      "Account is not linked",
    );
  }
  if (asTrimmedString(member.authUid) !== uid) {
    throw new HttpRequestError(403, "invalid_link", "Account link is invalid");
  }
  if (member.isActive !== true) {
    throw new HttpRequestError(403, "inactive_member", "Member is inactive");
  }

  let roles: CanonicalRole[];
  try {
    roles = normalizeCanonicalRoles(member.roles);
  } catch {
    throw new HttpRequestError(
      403,
      "invalid_member_roles",
      "Member roles are invalid",
    );
  }
  return {memberId, roles, isActive: true};
};

export const isVerifiedLinkedAdminActor = (
  uid: string,
  authUserValue: unknown,
  linkValue: unknown,
  memberValue: unknown,
): boolean => {
  const authUser = asRecord(authUserValue);
  const member = asRecord(memberValue);
  const authEmail = asTrimmedString(authUser.email)?.toLowerCase();
  const canonicalMemberEmail = asTrimmedString(member.normalizedEmail)
    ?.toLowerCase();
  if (
    asTrimmedString(authUser.uid) !== uid ||
    authUser.disabled !== false ||
    authUser.emailVerified !== true ||
    !authEmail ||
    !canonicalMemberEmail ||
    authEmail !== canonicalMemberEmail
  ) {
    return false;
  }
  try {
    return isAdminMember(resolveLinkedMember(
      uid,
      linkValue,
      memberValue,
    ));
  } catch {
    return false;
  }
};

export const isOperationallyLinkedAdmin = (
  memberId: string,
  memberValue: unknown,
  linkValue: unknown,
): boolean => {
  const member = asRecord(memberValue);
  const authUid = asTrimmedString(member.authUid);
  if (!authUid || authUid.includes("/")) {
    return false;
  }
  try {
    const linkedMember = resolveLinkedMember(authUid, linkValue, memberValue);
    return linkedMember.memberId === memberId && isAdminMember(linkedMember);
  } catch {
    return false;
  }
};

export const canProcessPrivilegedFirestoreEvent = async (
  context: FirestoreEventAuthContext,
  resolveLinkedActiveAdmin: LinkedActiveAdminResolver,
): Promise<boolean> => {
  if (
    context.authType === "system" ||
    context.authType === "service_account"
  ) {
    return true;
  }
  if (context.authType !== "unknown") {
    return false;
  }
  const uid = asTrimmedString(context.authId);
  if (!uid) {
    return false;
  }
  try {
    return await resolveLinkedActiveAdmin(uid);
  } catch {
    return false;
  }
};

const parseOptionalBoolean = (
  value: unknown,
  fallback: boolean,
  field: string,
): boolean => {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "boolean") {
    throw new HttpRequestError(
      400,
      "invalid_payload",
      `${field} must be a boolean`,
    );
  }
  return value;
};

const preservePatch = <T>(): FieldPatch<T> => ({kind: "preserve"});

const parseOptionalStringPatch = (
  source: Record<string, unknown>,
  key: string,
  maximumLength: number,
): FieldPatch<string> => {
  if (!hasOwn(source, key)) {
    return preservePatch();
  }
  const value = source[key];
  if (value === null) {
    return {kind: "clear"};
  }
  if (typeof value !== "string") {
    throw new HttpRequestError(
      400,
      "invalid_member_profile",
      `${key} must be a string or null`,
    );
  }
  const normalized = value.trim();
  if (!normalized) {
    return {kind: "clear"};
  }
  if (normalized.length > maximumLength) {
    throw new HttpRequestError(
      400,
      "invalid_member_profile",
      `${key} is too long`,
    );
  }
  return {kind: "set", value: normalized};
};

const parseEnumPatch = <T extends string>(
  source: Record<string, unknown>,
  key: string,
  allowedValues: readonly T[],
  canClear: boolean,
): FieldPatch<T> => {
  if (!hasOwn(source, key)) {
    return preservePatch();
  }
  const rawValue = source[key];
  if (rawValue === null ||
      (typeof rawValue === "string" && rawValue.trim() === "")) {
    if (canClear) {
      return {kind: "clear"};
    }
    throw new HttpRequestError(
      400,
      "invalid_member_profile",
      `${key} cannot be cleared`,
    );
  }
  const normalized = typeof rawValue === "string" ?
    rawValue.trim().toLowerCase() :
    "";
  if (!allowedValues.includes(normalized as T)) {
    throw new HttpRequestError(
      400,
      "invalid_member_profile",
      `${key} has an unsupported value`,
    );
  }
  return {kind: "set", value: normalized as T};
};

const mergeEcoPatch = <T extends string>(
  canonical: FieldPatch<T>,
  flattened: FieldPatch<T>,
): FieldPatch<T> => {
  if (canonical.kind === "preserve") {
    return flattened;
  }
  if (flattened.kind === "preserve") {
    return canonical;
  }
  if (
    canonical.kind === flattened.kind &&
    (canonical.kind !== "set" ||
      canonical.value === (flattened as {kind: "set"; value: T}).value)
  ) {
    return canonical;
  }
  throw new HttpRequestError(
    400,
    "conflicting_eco_commitment",
    "Canonical and flattened eco commitment fields conflict",
  );
};

const parseEcoCommitmentPatch = (
  body: Record<string, unknown>,
): MemberUpsertInput["ecoCommitment"] => {
  let canonical: Record<string, unknown> = {};
  if (hasOwn(body, "ecoCommitment")) {
    const rawCanonical = body.ecoCommitment;
    if (
      rawCanonical === null ||
      typeof rawCanonical !== "object" ||
      Array.isArray(rawCanonical)
    ) {
      throw new HttpRequestError(
        400,
        "invalid_member_profile",
        "ecoCommitment must be a map",
      );
    }
    canonical = rawCanonical as Record<string, unknown>;
  }
  const modes: readonly EcoCommitmentMode[] = ["weekly", "biweekly"];
  const parities: readonly ProducerParity[] = ["even", "odd"];
  return {
    mode: mergeEcoPatch(
      parseEnumPatch(canonical, "mode", modes, false),
      parseEnumPatch(body, "ecoCommitmentMode", modes, false),
    ),
    parity: mergeEcoPatch(
      parseEnumPatch(canonical, "parity", parities, true),
      parseEnumPatch(body, "ecoCommitmentParity", parities, true),
    ),
  };
};

const resolvePatch = <T>(
  patch: FieldPatch<T>,
  current: T | null,
): T | null => {
  switch (patch.kind) {
  case "preserve":
    return current;
  case "clear":
    return null;
  case "set":
    return patch.value;
  }
};

const firstOptionalString = (
  source: Record<string, unknown>,
  keys: string[],
): string | null => {
  for (const key of keys) {
    const value = asTrimmedString(source[key]);
    if (value) {
      return value;
    }
  }
  return null;
};

export const resolveMemberBusinessFields = (
  input: MemberUpsertInput,
  currentValue: unknown,
): MemberBusinessFields => {
  const current = asRecord(currentValue);
  const currentEcoCommitment = asRecord(current.ecoCommitment);
  const currentModeValue = asTrimmedString(currentEcoCommitment.mode)
    ?.toLowerCase();
  const currentMode: EcoCommitmentMode =
    currentModeValue === "biweekly" ? "biweekly" : "weekly";
  const currentEcoParityValue = asTrimmedString(currentEcoCommitment.parity)
    ?.toLowerCase();
  const currentEcoParity: ProducerParity | null =
    currentEcoParityValue === "even" || currentEcoParityValue === "odd" ?
      currentEcoParityValue :
      null;
  const currentProducerParityValue = asTrimmedString(current.producerParity)
    ?.toLowerCase();
  const currentProducerParity: ProducerParity | null =
    currentProducerParityValue === "even" ||
    currentProducerParityValue === "odd" ?
      currentProducerParityValue :
      null;

  const result: MemberBusinessFields = {
    companyName: resolvePatch(
      input.companyName,
      firstOptionalString(current, [
        "companyName",
        "company_name",
        "company",
      ]),
    ),
    phoneNumber: resolvePatch(
      input.phoneNumber,
      firstOptionalString(current, [
        "phoneNumber",
        "phone",
        "telephone",
        "telefono",
      ]),
    ),
    producerParity: resolvePatch(
      input.producerParity,
      currentProducerParity,
    ),
    ecoCommitment: {
      mode: resolvePatch(input.ecoCommitment.mode, currentMode) || "weekly",
      parity: resolvePatch(
        input.ecoCommitment.parity,
        currentEcoParity,
      ),
    },
  };
  if (input.roles.includes("producer") && !result.companyName) {
    throw new HttpRequestError(
      400,
      "producer_company_required",
      "A producer must have a companyName",
    );
  }
  return result;
};

const normalizeEmail = (value: unknown): string => {
  const email = asTrimmedString(value)?.toLowerCase();
  if (!email ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpRequestError(400, "invalid_email", "Email is invalid");
  }
  return email;
};

export const buildMemberId = (normalizedEmail: string): string => {
  const canonicalEmail = normalizedEmail.trim().toLowerCase();
  const sanitized = canonicalEmail
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const suffix = sanitized.length > 0 ? sanitized.slice(0, 40) : "member";
  const hash = createHash("sha256")
    .update(canonicalEmail)
    .digest("hex")
    .slice(0, 10);
  return `member_${suffix}_${hash}`;
};

export const assertMemberIdCompatible = (
  exists: boolean,
  currentValue: unknown,
  normalizedEmail: string,
): void => {
  if (!exists) {
    return;
  }
  const current = asRecord(currentValue);
  const currentEmail = [
    current.normalizedEmail,
    current.emailNormalized,
    current.email,
  ].map((value) => asTrimmedString(value)?.toLowerCase() || null)
    .find((value): value is string => value !== null);
  if (currentEmail === normalizedEmail) {
    return;
  }
  throw new HttpRequestError(
    409,
    "member_id_conflict",
    "memberId belongs to another member",
  );
};

export const parseMemberUpsertInput = (
  value: unknown,
): MemberUpsertInput => {
  const body = asRecord(value);
  const displayName = asTrimmedString(body.displayName);
  if (!displayName || displayName.length > 120) {
    throw new HttpRequestError(
      400,
      "invalid_display_name",
      "displayName is required and must be at most 120 characters",
    );
  }

  const memberId = asTrimmedString(body.memberId);
  if (memberId && (
    memberId.length > 128 ||
    memberId.includes("/") ||
    memberId === "." ||
    memberId === ".."
  )) {
    throw new HttpRequestError(
      400,
      "invalid_member_id",
      "memberId is invalid",
    );
  }

  const parities: readonly ProducerParity[] = ["even", "odd"];

  return {
    memberId,
    displayName,
    normalizedEmail: normalizeEmail(body.normalizedEmail ?? body.email),
    roles: normalizeCanonicalRoles(body.roles),
    isActive: parseOptionalBoolean(body.isActive, true, "isActive"),
    producerCatalogEnabled: parseOptionalBoolean(
      body.producerCatalogEnabled,
      true,
      "producerCatalogEnabled",
    ),
    isCommonPurchaseManager: parseOptionalBoolean(
      body.isCommonPurchaseManager,
      false,
      "isCommonPurchaseManager",
    ),
    companyName: parseOptionalStringPatch(body, "companyName", 160),
    phoneNumber: parseOptionalStringPatch(body, "phoneNumber", 40),
    producerParity: parseEnumPatch(
      body,
      "producerParity",
      parities,
      true,
    ),
    ecoCommitment: parseEcoCommitmentPatch(body),
  };
};

export const requirePostMethod = (method: unknown): void => {
  if (method !== "POST") {
    throw new HttpRequestError(405, "method_not_allowed", "POST is required");
  }
};

export const isAdminMember = (member: LinkedMember): boolean =>
  member.roles.includes("admin");
