export type ShiftEligibilityMember = {
  isActive: boolean;
  roles: readonly string[];
  isCommonPurchaseManager: boolean;
};

export const isEligibleForShiftRotation = (
  member: ShiftEligibilityMember,
): boolean => {
  const isProducer = member.roles.some(
    (role) => role.trim().toLowerCase() === "producer",
  );
  const isRealProducer = isProducer && !member.isCommonPurchaseManager;
  return member.isActive && !isRealProducer;
};

/**
 * @param {object|undefined} previous Stored member before the upsert.
 * @param {ShiftEligibilityMember} next Validated eligibility inputs to save.
 * @return {boolean} Whether this write establishes a new eligibility date.
 */
export const shiftEligibilityChanged = (
  previous: Record<string, unknown> | undefined,
  next: ShiftEligibilityMember,
): boolean => {
  if (!previous) return true;
  const {roles, isActive, isCommonPurchaseManager} = previous;
  if (typeof isActive !== "boolean" ||
      typeof isCommonPurchaseManager !== "boolean" ||
      !Array.isArray(roles) ||
      !roles.every((role) => typeof role === "string")) {
    // Repairing an incomplete legacy profile cannot establish its history.
    return false;
  }
  const wasEligible = isEligibleForShiftRotation({
    roles, isActive, isCommonPurchaseManager,
  });
  return wasEligible !== isEligibleForShiftRotation(next);
};
