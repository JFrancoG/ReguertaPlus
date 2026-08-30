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
