export type ShiftSheetsEnvironment = "develop" | "production";
export type ShiftSheetsType = "delivery" | "market";

export type ShiftSheetsTab = {
  readonly type: ShiftSheetsType;
  readonly seasonStartYear: number;
  readonly title: string;
};

export type ShiftSheetsConfig = {
  readonly environment: ShiftSheetsEnvironment;
  readonly workbookId: string;
  readonly aliases: readonly ShiftSheetsTab[];
};

/** Distinguishes rejected inputs from ambiguous external writes. */
export class ShiftSheetsError extends Error {
  /**
   * @param {string} code Stable machine-readable failure category.
   * @param {string} message Non-sensitive diagnostic.
   */
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "ShiftSheetsError";
  }
}

const failConfig = (message: string): never => {
  throw new ShiftSheetsError("invalid_sheets_config", message);
};

const requireType = (type: ShiftSheetsType): void => {
  if (type !== "delivery" && type !== "market") {
    failConfig("Unknown shift type.");
  }
};

const requireSeason = (year: number): void => {
  if (!Number.isSafeInteger(year) || year < 1900 || year > 2198) {
    failConfig("Unsupported shift season.");
  }
};

/**
 * Proposed formatter for new tables; historical names require explicit aliases.
 * It does not discover or authorize any live workbook.
 * @param {ShiftSheetsType} type Shift partition.
 * @param {number} seasonStartYear September-start season.
 * @return {string} Canonical proposed title.
 */
export const formatShiftSheetsTabTitle = (
  type: ShiftSheetsType,
  seasonStartYear: number,
): string => {
  requireType(type);
  requireSeason(seasonStartYear);
  const label = `${seasonStartYear}-` +
    `${(seasonStartYear + 1) % 100}`.padStart(2, "0");
  return `turnos-${type === "delivery" ? "reparto" : "mercado"} ${label}`;
};

/**
 * Selects only the requested environment. Missing parameters never fall back
 * to a global workbook or the other environment; aliases are supplied by the
 * reviewed caller and are copied before any asynchronous work.
 * @param {object} input Explicit workbook parameters and approved tab aliases.
 * @return {ShiftSheetsConfig} Immutable environment-bound configuration.
 */
export const createShiftSheetsConfig = (input: {
  environment: ShiftSheetsEnvironment;
  workbooks: Partial<Record<ShiftSheetsEnvironment, string>>;
  aliases?: readonly ShiftSheetsTab[];
}): ShiftSheetsConfig => {
  if (input.environment !== "develop" && input.environment !== "production") {
    return failConfig("Unknown Sheets environment.");
  }
  const workbookId = input.workbooks[input.environment];
  if (!workbookId || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(workbookId)) {
    return failConfig("An exact environment workbook ID is required.");
  }
  if (input.workbooks.develop && input.workbooks.production &&
    input.workbooks.develop === input.workbooks.production) {
    return failConfig("Develop and production must use distinct workbooks.");
  }
  const partitions = new Set<string>();
  const titles = new Set<string>();
  const aliases = (input.aliases ?? []).map((alias) => {
    requireType(alias.type);
    requireSeason(alias.seasonStartYear);
    if (typeof alias.title !== "string" || alias.title.trim() !== alias.title ||
      !alias.title || alias.title.length > 100 ||
      /[[\]:*?/\\]/.test(alias.title) ||
      [...alias.title].some((character) => character.charCodeAt(0) < 32)) {
      return failConfig("Tab alias title is invalid.");
    }
    const partition = `${alias.type}:${alias.seasonStartYear}`;
    if (partitions.has(partition) || titles.has(alias.title)) {
      return failConfig("Tab aliases must identify distinct partitions.");
    }
    const canonical = /^turnos-(reparto|mercado) (\d{4})-(\d{2})$/
      .exec(alias.title);
    if (canonical && alias.title !== formatShiftSheetsTabTitle(
      alias.type, alias.seasonStartYear,
    )) {
      return failConfig("Alias conflicts with a canonical seasonal tab.");
    }
    partitions.add(partition);
    titles.add(alias.title);
    return Object.freeze({...alias});
  });
  return Object.freeze({
    environment: input.environment,
    workbookId,
    aliases: Object.freeze(aliases),
  });
};

/**
 * Routes by the actual ISO calendar date, including September carryover.
 * @param {ShiftSheetsConfig} config Frozen environment configuration.
 * @param {ShiftSheetsType} type Shift partition.
 * @param {string} date Exact YYYY-MM-DD date, without time-zone conversion.
 * @return {ShiftSheetsTab} Explicit alias or proposed canonical table.
 */
export const resolveShiftSheetsTab = (
  config: ShiftSheetsConfig,
  type: ShiftSheetsType,
  date: string,
): ShiftSheetsTab => {
  requireType(type);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!match || !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date) {
    return failConfig("Shift date must be an exact calendar date.");
  }
  const year = Number(match[1]);
  const seasonStartYear = Number(match[2]) >= 9 ? year : year - 1;
  requireSeason(seasonStartYear);
  return config.aliases.find((alias) => alias.type === type &&
    alias.seasonStartYear === seasonStartYear) ?? Object.freeze({
    type,
    seasonStartYear,
    title: formatShiftSheetsTabTitle(type, seasonStartYear),
  });
};

export const quoteShiftSheetsTitle = (title: string): string =>
  `'${title.replace(/'/g, "''")}'`;

/**
 * Resolves invocation-time configuration with explicitly reviewed aliases,
 * including an explicit empty list. Legacy global ranges are never a fallback.
 * @param {ShiftSheetsEnvironment} environment Requested environment.
 * @param {object} variables Runtime environment variables.
 * @return {ShiftSheetsConfig} Detached environment/workbook/tab authority.
 */
export const readShiftSheetsWorkerConfig = (
  environment: ShiftSheetsEnvironment,
  variables: Readonly<Record<string, string | undefined>>,
): ShiftSheetsConfig => {
  try {
    const raw = variables[`SHIFT_SHEETS_ALIASES_${environment.toUpperCase()}`];
    if (!raw || raw.length > 8192) return failConfig("Aliases are required.");
    const aliases = JSON.parse(raw);
    if (!Array.isArray(aliases) || aliases.length > 8 || aliases.some((item) =>
      typeof item !== "object" || item === null ||
      Object.keys(item).sort().join(",") !== "seasonStartYear,title,type")) {
      return failConfig("Aliases must be an exact reviewed mapping.");
    }
    return createShiftSheetsConfig({environment, aliases, workbooks: {
      develop: variables.SHEETS_SPREADSHEET_ID_DEVELOP,
      production: variables.SHEETS_SPREADSHEET_ID_PRODUCTION,
    }});
  } catch {
    return failConfig("Explicit worker configuration is invalid.");
  }
};
