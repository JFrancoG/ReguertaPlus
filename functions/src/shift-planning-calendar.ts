import {ShiftPlanningError} from "./shift-planning-contract.js";

export type BusinessWeekday =
  | "MON"
  | "TUE"
  | "WED"
  | "THU"
  | "FRI"
  | "SAT"
  | "SUN";

const weekdayIndex: Record<BusinessWeekday, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

const requireSeasonStartYear = (value: number): number => {
  if (!Number.isSafeInteger(value) || value < 2000 || value > 9998) {
    throw new ShiftPlanningError(
      "invalid_target_season",
      "Season start year is outside the supported range.",
    );
  }
  return value;
};

const formatDate = (value: Date): string => [
  value.getUTCFullYear().toString().padStart(4, "0"),
  (value.getUTCMonth() + 1).toString().padStart(2, "0"),
  value.getUTCDate().toString().padStart(2, "0"),
].join("-");

const dateFromParts = (year: number, monthIndex: number, day: number): Date =>
  new Date(Date.UTC(year, monthIndex, day));

const parseBusinessDate = (value: string): Date => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new ShiftPlanningError(
      "invalid_business_date",
      "Business date must use YYYY-MM-DD.",
    );
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const result = dateFromParts(year, monthIndex, day);
  if (formatDate(result) !== value) {
    throw new ShiftPlanningError(
      "invalid_business_date",
      "Business date is not a valid Gregorian date.",
    );
  }
  return result;
};

export const addBusinessDays = (value: string, days: number): string => {
  if (!Number.isSafeInteger(days)) {
    throw new ShiftPlanningError(
      "invalid_business_date",
      "Business-day offset must be an integer.",
    );
  }
  const date = parseBusinessDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
};

export const buildDeliverySeasonDates = (
  seasonStartYear: number,
  weekday: BusinessWeekday,
): string[] => {
  const startYear = requireSeasonStartYear(seasonStartYear);
  const targetWeekday = weekdayIndex[weekday];
  if (targetWeekday === undefined) {
    throw new ShiftPlanningError(
      "invalid_delivery_calendar",
      "Delivery weekday is not supported.",
    );
  }
  const start = dateFromParts(startYear, 8, 1);
  const end = dateFromParts(startYear + 1, 7, 31);
  const offset = (targetWeekday - start.getUTCDay() + 7) % 7;
  const first = dateFromParts(startYear, 8, 1 + offset);
  const dates: string[] = [];
  for (
    let current = first;
    current.getTime() <= end.getTime();
    current = dateFromParts(
      current.getUTCFullYear(),
      current.getUTCMonth(),
      current.getUTCDate() + 7,
    )
  ) {
    dates.push(formatDate(current));
  }
  return dates;
};

export const buildMarketSeasonDates = (seasonStartYear: number): string[] => {
  const startYear = requireSeasonStartYear(seasonStartYear);
  const months = [8, 9, 10, 11, 0, 1, 2, 3, 4, 5];
  return months.map((monthIndex) => {
    const year = monthIndex >= 8 ? startYear : startYear + 1;
    const first = dateFromParts(year, monthIndex, 1);
    const firstSaturdayOffset = (6 - first.getUTCDay() + 7) % 7;
    return formatDate(dateFromParts(
      year,
      monthIndex,
      1 + firstSaturdayOffset + 14,
    ));
  });
};

export const buildFutureMarketDates = (
  targetSeasonStartYear: number,
  count: number,
): string[] => {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new ShiftPlanningError(
      "invalid_rotation_position_count",
      "Future market date count must be a non-negative integer.",
    );
  }
  const dates: string[] = [];
  let seasonStartYear = requireSeasonStartYear(targetSeasonStartYear) + 1;
  while (dates.length < count) {
    dates.push(...buildMarketSeasonDates(seasonStartYear));
    seasonStartYear += 1;
  }
  return dates.slice(0, count);
};

export const projectionSeasonStartYear = (businessDate: string): number => {
  const date = parseBusinessDate(businessDate);
  return date.getUTCMonth() >= 8 ?
    date.getUTCFullYear() :
    date.getUTCFullYear() - 1;
};

export const requireProjectionPrefix = (
  completeDates: readonly string[],
  occupiedDates: readonly string[],
): void => {
  if (
    occupiedDates.length > completeDates.length ||
    occupiedDates.some((date, index) => date !== completeDates[index])
  ) {
    throw new ShiftPlanningError(
      "invalid_inherited_projection_prefix",
      "Inherited projection dates must be one contiguous calendar prefix.",
    );
  }
};
