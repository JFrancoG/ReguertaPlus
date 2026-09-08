import {ShiftSheetsConfig, ShiftSheetsError, resolveShiftSheetsTab} from
  "./shift-sheets-config.js";
import type {ShiftSheetsImportTab} from "./shift-sheets-import.js";
import {SHIFT_SHEETS_LIMITS} from "./shift-sheets.js";

/**
 * Detaches bounded reviewed layouts for durable receipts. Routing is checked
 * separately against the adapter's current environment and alias authority.
 * @param {unknown} value Reviewed mapping, never inferred from sheet titles.
 * @return {ShiftSheetsImportTab[]} Validated, detached layout descriptions.
 */
export const parseShiftSheetsImportTabs = (
  value: unknown,
): readonly ShiftSheetsImportTab[] => {
  try {
    if (Buffer.byteLength(JSON.stringify(value) ?? "") > 65536) {
      throw new Error("Oversized mapping.");
    }
    const tabs = value as ShiftSheetsImportTab[];
    if (!Array.isArray(tabs) || !tabs.length ||
      tabs.length > SHIFT_SHEETS_LIMITS.tabs ||
      new Set(tabs.map((tab) => tab.title)).size !== tabs.length) {
      throw new Error("Invalid tab set.");
    }
    for (const tab of tabs) {
      if (Object.keys(tab).sort().join(",") !==
          "decorations,layout,seasonStartYear,title,type" ||
        !Number.isSafeInteger(tab.seasonStartYear) ||
        tab.seasonStartYear < 1900 || tab.seasonStartYear > 2198 ||
        !["delivery", "market"].includes(tab.type) ||
        typeof tab.title !== "string" || !tab.title.trim() ||
        tab.title.length > 100 ||
        !["canonical", `${tab.type}_human`].includes(tab.layout) ||
        !Array.isArray(tab.decorations) ||
        tab.decorations.length > SHIFT_SHEETS_LIMITS.tabRows ||
        (tab.layout === "canonical" && tab.decorations.length) ||
        new Set(tab.decorations.map((row) => row.rowNumber)).size !==
        tab.decorations.length || tab.decorations.some((row) =>
        Object.keys(row).sort().join(",") !== "cells,rowNumber" ||
          !Number.isSafeInteger(row.rowNumber) || row.rowNumber < 1 ||
          row.rowNumber > SHIFT_SHEETS_LIMITS.tabRows ||
          !Array.isArray(row.cells) ||
          row.cells.length > SHIFT_SHEETS_LIMITS.tabColumns ||
          row.cells.some((cell: unknown) =>
            typeof cell !== "string" || cell.length > 1024))) {
        throw new Error("Invalid layout.");
      }
    }
    return structuredClone(tabs);
  } catch {
    throw new ShiftSheetsError("invalid_sheets_import",
      "An exact reviewed layout mapping is required.");
  }
};

/**
 * Loads the reviewed mapping from deployment configuration, never HTTP input.
 * Human and technical mappings use the same separate prepare/apply/write-back
 * flow. No layout or decoration is inferred from aliases.
 * @param {ShiftSheetsConfig} config Exact environment and routing authority.
 * @param {object} variables Invocation-time environment variables.
 * @return {ShiftSheetsImportTab[]} Explicit bounded tab mapping.
 */
export const readShiftSheetsImportMapping = (
  config: ShiftSheetsConfig,
  variables: Readonly<Record<string, string | undefined>>,
): readonly ShiftSheetsImportTab[] => {
  try {
    const raw = variables[
      `SHIFT_SHEETS_IMPORT_TABS_${config.environment.toUpperCase()}`
    ];
    if (!raw || raw.length > 65536) throw new Error("Missing mapping.");
    const tabs = parseShiftSheetsImportTabs(JSON.parse(raw));
    for (const tab of tabs) {
      if (resolveShiftSheetsTab(config, tab.type,
        `${tab.seasonStartYear}-09-01`).title !== tab.title) {
        throw new Error("Mapping differs from routing authority.");
      }
    }
    return tabs;
  } catch {
    throw new ShiftSheetsError("invalid_sheets_import",
      "An exact reviewed import mapping is required.");
  }
};
