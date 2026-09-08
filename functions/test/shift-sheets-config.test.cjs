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
