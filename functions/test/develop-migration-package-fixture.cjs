"use strict";
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {input: plannerInput} = require("./develop-planner-entry-fixture.cjs");
const {doc} = require("./develop-legacy-census-fixture.cjs");
const {inspectCensus} = require("../scripts/inspect-develop-legacy-census.cjs");
const WORKBOOK = "1O7VKs7S4wZHVvTfNBehAd5EzF3Mgw2q9LweK68Gm76A";
const OWNER = "testplusprojects@gmail.com";
const ROOT = "develop/plus-collections";

function fixture({timestampNanoseconds = "123456789"} = {}) {
  const base = plannerInput(), snapshot = base.census;
  for (const row of snapshot.collections.shifts) {
    // The current legacy payload postdates the retained event, with its own CAS version.
    row.updateTime = "2026-10-28T10:00:03.123456789Z";
    row.fields.source = {stringValue: "google_sheets"};
    row.fields.opaqueLegacyField = {mapValue: {fields: {precise: {timestampValue: `2025-01-01T00:00:00.${timestampNanoseconds}Z`},
      large: {integerValue: "9007199254740991"}, binary: {bytesValue: "AQID"}}}};
  }
  const stableSourceDigest = inspectCensus(snapshot).stableSetDigest;
  const proposal = base.contentProposal;
  proposal.content.workbookId = WORKBOOK;
  delete proposal.contentDigest; delete proposal.proposalDigest;
  const proposalDigest = digest(proposal), contentDigest = digest(proposal.content);
  Object.assign(proposal, {proposalDigest, contentDigest});
  const cohort = proposal.content.rotations.delivery.initialCursor.cohortUserIds;
  snapshot.collections.users = Array.from({length:48}, (_, i) => doc(`${ROOT}/users/${i < 32 ? cohort[i] : `inactive-${i}`}`,
    {isActive:i < 32, roles:["member"], isCommonPurchaseManager:false, displayName:`Example ${i}`}));
  for (const name of ["shiftPlanningState", "shiftCoverageReserves", "shiftCoverageCredits", "shiftMembershipState",
    "shiftPlanningSyncCommands", "shiftCoverageCases", "shiftCoverageEffects", "shiftSwapRequests"]) snapshot.collections[name] = [];
  snapshot.singletons = Object.fromEntries(["shiftPlanningState/current", "shiftPlanningState/sourcePolicy", "shiftPlanningState/sheetsSubmission",
    "shiftRotations/delivery", "shiftRotations/market"].map(key => [key,null]));
  snapshot.singletons["config/global"] = doc(`${ROOT}/config/global`, {version:1});
  snapshot.collections.config = [structuredClone(snapshot.singletons["config/global"]),
    doc(`${ROOT}/config/member`, {cacheExpirationMinutes:30,deliveryDayOfWeek:3,lastTimestamps:{}}),
    doc(`${ROOT}/config/public`, {versions:{}})];
  const sheetCells = {spreadsheetId:WORKBOOK, sheets:[...new Set(proposal.content.helperProjectionDraft.map(c => c.tabTitle))].map((title,i) => ({
    properties:{sheetId:i,title},data:[{rowData:Array.from({length:60}, (_,r) => ({values:[{userEnteredValue:{stringValue:`Published ${r}`}}]}))}]}))};
  const owners = [{emailAddress:OWNER}];
  const file = {id:WORKBOOK,mimeType:"application/vnd.google-apps.spreadsheet",version:"278",parents:["root"],owners};
  const permission = (emailAddress,role) => ({type:"user",emailAddress,role});
  const permissions = [permission(OWNER,"owner"), ...["drpuerk@gmail.com", "195744802339-compute@developer.gserviceaccount.com",
    "firebase-adminsdk-2xhs2@reguerta-9f27f.iam.gserviceaccount.com", "reguerta-shifts-inspector@reguerta-9f27f.iam.gserviceaccount.com"].map(e => permission(e,"reader"))];
  const controls = {projectId:"reguerta-9f27f",readOnly:true,functions:base.observedFunctions.map(data => ({data})),
    jobs:Array.from({length:3}, () => ({observed:true,data:{state:"PAUSED"}})),rulesRelease:{observed:true,data:{}},
    ruleset:{observed:true,data:{}},projectIam:{observed:true,data:{}}};
  const indexes = {projectId:"reguerta-9f27f",databaseId:"(default)",readOnly:true,
    indexes:Array.from({length:6}, (_,i) => ({state:"READY",name:`projects/reguerta-9f27f/databases/(default)/collectionGroups/${i ? `example-${i}` : "shiftPlanningRequests"}/indexes/example`,
      fields:[{fieldPath:"requestedByUserId",order:"ASCENDING"},{fieldPath:"schemaVersion",order:"ASCENDING"},{fieldPath:"requestedAt",order:"DESCENDING"}]}))};
  return {snapshot,proposal,sheetCells,referenceCells:structuredClone(sheetCells),fileBefore:{data:structuredClone(file)},fileAfter:{data:file},
    filePermissions:{fileId:WORKBOOK,data:{permissions}},parent:{data:{id:"root",name:"Mi unidad",mimeType:"application/vnd.google-apps.folder",owners}},
    parentPermissions:{fileId:"root",data:{permissions:[permission(OWNER,"owner")]}},indexes,controls,reviewedControls:structuredClone(controls),
    assessment:{canEnterMaintenance:false,canApply:false,stableSourceDigest,workbook:{numericRevision:"278"}},
    reviewedContentDigest:contentDigest,reviewedProposalDigest:proposalDigest};
}

module.exports = {fixture};
