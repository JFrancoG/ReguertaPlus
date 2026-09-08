"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const {
  createShiftSheetsConfig: config,
  resolveShiftSheetsTab: tab,
  quoteShiftSheetsTitle: quote,
} = require("../lib/shift-sheets-config.js");

test("environment selection never falls back or shares the opposite workbook", () => {
  assert.throws(() => config({environment: "production", workbooks: {develop: "book-development"}}));
  assert.throws(() => config({environment: "other", workbooks: {develop: "book-development"}}));
  assert.throws(() => config({environment: "develop", workbooks: {develop: "same", production: "same"}}));
  const value = config({environment: "production", workbooks: {develop: "book-development", production: "book-production"}});
  assert.equal(value.workbookId, "book-production");
});

test("actual dates route carryover across September and validate real calendar days", () => {
  const value = config({environment: "develop", workbooks: {develop: "book-development"}});
  assert.deepEqual(tab(value, "delivery", "2026-08-31"), {type: "delivery", seasonStartYear: 2025, title: "turnos-reparto 2025-26"});
  assert.equal(tab(value, "delivery", "2026-09-01").title, "turnos-reparto 2026-27");
  assert.equal(tab(value, "market", "2027-09-01").title, "turnos-mercado 2027-28");
  for (const date of ["2026-02-29", "2026-13-01", "2026-9-1", "2026-09-01T00:00:00Z"]) {
    assert.throws(() => tab(value, "delivery", date), {code: "invalid_sheets_config"});
  }
  assert.equal(tab(value, "delivery", "2028-02-29").seasonStartYear, 2027);
});

test("explicit aliases are detached and cannot collide with another partition", () => {
  const alias = {type: "delivery", seasonStartYear: 2025, title: "Reviewed example's tab"};
  const value = config({environment: "develop", workbooks: {develop: "book-development"}, aliases: [alias]});
  alias.title = "mutated";
  assert.equal(tab(value, "delivery", "2026-03-01").title, "Reviewed example's tab");
  assert.equal(quote(tab(value, "delivery", "2026-03-01").title), "'Reviewed example''s tab'");
  assert.throws(() => config({environment: "develop", workbooks: {develop: "book-development"}, aliases: [
    {type: "delivery", seasonStartYear: 2025, title: "turnos-mercado 2025-26"},
  ]}));
  assert.throws(() => config({environment: "develop", workbooks: {develop: "book-development"}, aliases: [
    {type: "delivery", seasonStartYear: 2025, title: "shared"},
    {type: "market", seasonStartYear: 2025, title: "shared"},
  ]}));
  for (const title of ["invalid/tab", "invalid[tab", "invalid:tab", "invalid\ntab"]) {
    assert.throws(() => config({environment: "develop", workbooks: {develop: "book-development"}, aliases: [
      {type: "delivery", seasonStartYear: 2025, title},
    ]}), {code: "invalid_sheets_config"});
  }
});

const {readLegacyShiftSheetsConfig: legacy} = require("../lib/shift-sheets-config.js");
const legacyVariables = () => ({
  SHEETS_SPREADSHEET_ID_DEVELOP: "dev-book", SHEETS_SPREADSHEET_ID_PRODUCTION: "prod-book",
  SHEETS_DELIVERY_RANGE_DEVELOP: "'TORRE 2025-26'!A:F", SHEETS_MARKET_RANGE_DEVELOP: "'MERCADO 2025-26'!A:C",
  SHEETS_DELIVERY_RANGE_PRODUCTION: "'Entrega'!A:F", SHEETS_MARKET_RANGE_PRODUCTION: "'Mercado'!A:C",
  SHEETS_SPREADSHEET_ID: "global-book", SHEETS_DELIVERY_RANGE: "Global!A:Z", SHEETS_MARKET_RANGE: "Global!A:Z",
});

test("legacy readers select only the explicit environment and keep the configured human ranges", () => {
  const vars = legacyVariables();
  assert.deepEqual(legacy("develop", vars), {spreadsheetId: "dev-book", deliveryRange: "'TORRE 2025-26'!A:F", marketRange: "'MERCADO 2025-26'!A:C"});
  const result = legacy("production", vars);
  assert.deepEqual(result, {spreadsheetId: "prod-book", deliveryRange: "'Entrega'!A:F", marketRange: "'Mercado'!A:C"});
  vars.SHEETS_SPREADSHEET_ID_PRODUCTION = "changed";
  assert.equal(result.spreadsheetId, "prod-book");
  assert.equal(legacy("production", vars).spreadsheetId, "changed", "Read configuration at invocation time");
});

test("missing scoped workbook or either range disables legacy routing despite complete globals and opposite environment", () => {
  for (const environment of ["develop", "production"]) {
    for (const field of ["SPREADSHEET_ID", "DELIVERY_RANGE", "MARKET_RANGE"]) {
      for (const absent of [undefined, "", "   "]) {
        const vars = legacyVariables(); vars[`SHEETS_${field}_${environment.toUpperCase()}`] = absent;
        assert.equal(legacy(environment, vars), null);
      }
    }
  }
  assert.equal(legacy("develop", {SHEETS_SPREADSHEET_ID: "global-book"}), null);
});

test("legacy configuration rejects shared workbooks, malformed identities, unknown environments and invalid ranges", () => {
  for (const change of [
    {SHEETS_SPREADSHEET_ID_PRODUCTION: "dev-book"},
    {SHEETS_SPREADSHEET_ID_PRODUCTION: " dev-book "},
    {SHEETS_SPREADSHEET_ID_DEVELOP: "book/invalid"},
    {SHEETS_DELIVERY_RANGE_DEVELOP: "A".repeat(1025)},
    {SHEETS_MARKET_RANGE_DEVELOP: "Tab!A:C\nOther!A:C"},
  ]) assert.throws(() => legacy("develop", {...legacyVariables(), ...change}), {code: "invalid_sheets_config"});
  assert.throws(() => legacy("staging", legacyVariables()), {code: "invalid_sheets_config"});
});

const {resolveShiftSheetsHumanRange: humanRange} = require("../lib/shift-sheets-config.js");
test("human ranges follow logical seasons and quote reviewed aliases without technical columns", () => {
  const settings = config({environment: "develop", workbooks: {develop: "dev-book"}, aliases: [
    {type: "delivery", seasonStartYear: 2025, title: "Torre's! 2025-26"},
  ]});
  assert.equal(humanRange(settings, "delivery", "2026-08-31"), "'Torre''s! 2025-26'!A1:F2000");
  assert.equal(humanRange(settings, "delivery", "2026-09-01"), "'turnos-reparto 2026-27'!A1:F2000");
  assert.equal(humanRange(settings, "market", "2026-09-20"), "'turnos-mercado 2026-27'!A1:C2000");
  assert.throws(() => humanRange(settings, "delivery", "2026-02-30"));
});
