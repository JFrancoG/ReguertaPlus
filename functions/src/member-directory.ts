export type MemberDirectoryDocument = {
  userId: string;
  displayName: string;
  companyName: string | null;
  roles: string[];
  isActive: true;
  producerCatalogEnabled: boolean;
  isCommonPurchaseManager: boolean;
  producerParity: "even" | "odd" | null;
  ecoCommitment: {
    mode: "weekly" | "biweekly";
    parity: "even" | "odd" | null;
  };
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ?
    value as Record<string, unknown> :
    {};

const firstString = (
  source: Record<string, unknown>,
  keys: string[],
): string | null => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

const canonicalRoles = (source: Record<string, unknown>): string[] => {
  const aliases = new Map<string, string>([
    ["member", "member"],
    ["socio", "member"],
    ["producer", "producer"],
    ["productor", "producer"],
    ["admin", "admin"],
    ["administrador", "admin"],
  ]);
  const parsed = new Set<string>();
  if (Array.isArray(source.roles)) {
    source.roles.forEach((role) => {
      if (typeof role === "string") {
        const canonical = aliases.get(role.trim().toLowerCase());
        if (canonical) parsed.add(canonical);
      }
    });
  }
  if (parsed.size === 0) {
    if (source.isProducer === true) parsed.add("producer");
    if (source.isAdmin === true) parsed.add("admin");
  }
  parsed.add("member");
  return ["member", "producer", "admin"].filter((role) =>
    parsed.has(role)
  );
};

const parity = (value: unknown): "even" | "odd" | null => {
  const normalized = typeof value === "string" ?
    value.trim().toLowerCase() :
    "";
  return normalized === "even" || normalized === "odd" ? normalized : null;
};

export const buildMemberDirectoryDocument = (
  memberId: string,
  value: unknown,
): MemberDirectoryDocument | null => {
  const source = asRecord(value);
  if (source.isActive !== true) return null;
  const displayName = firstString(source, ["displayName"]) || [
    firstString(source, ["name"]),
    firstString(source, ["surname"]),
  ].filter(Boolean).join(" ").trim();
  if (!displayName) return null;

  const eco = asRecord(source.ecoCommitment);
  const ecoMode = typeof eco.mode === "string" &&
    eco.mode.trim().toLowerCase() === "biweekly" ?
    "biweekly" :
    "weekly";
  return {
    userId: memberId,
    displayName,
    companyName: firstString(source, [
      "companyName",
      "company_name",
      "company",
    ]),
    roles: canonicalRoles(source),
    isActive: true,
    producerCatalogEnabled: source.producerCatalogEnabled !== false,
    isCommonPurchaseManager: source.isCommonPurchaseManager === true,
    producerParity: parity(source.producerParity),
    ecoCommitment: {
      mode: ecoMode,
      parity: parity(eco.parity),
    },
  };
};
