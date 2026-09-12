"use strict";
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {fairnessSnapshot} = require("./shift-planning-activation-fixture.cjs");
const recordFor = (member, entering, floor = 0, observedAtMillis = 10) => {
  const value = {schemaVersion: 1, policyRevision: "hu084-provisional-v1", userId: member.userId,
    revision: 3, source: {isActive: member.isActive, roles: [...member.roles].sort(),
      isCommonPurchaseManager: member.isCommonPurchaseManager}, eligible: member.isActive,
    observedAtMillis, pendingQueueTransition: true,
    pendingTypes: {delivery: true, market: true},
    ...(!member.isActive || member.userId === "member-1" ?
      {frozenExclusion: {reason: "excusedDeparture", revision: 2}} : {}),
    admissionAfterRound: {delivery: floor, market: floor},
    admissionRequired: {delivery: entering, market: entering}};
  return {id: member.userId, data: {value, digest: digest(value)}};
};
const reserveFor = (userId, type, time = 10) => ({id: digest([type, userId]).split(":").at(-1),
  data: {userId, type, active: true, enteredAtMillis: time, revision: 3}});
const admissionSnapshot = () => {
  const snapshot = fairnessSnapshot();
  snapshot.roster[1].isActive = false;
  snapshot.roster.push({...snapshot.roster[2], userId: "member-7"});
  const membership = {records: [recordFor(snapshot.roster[0], true),
    recordFor(snapshot.roster[1], false), recordFor(snapshot.roster.at(-1), true)],
    reserves: ["member-1", "member-7"].flatMap((userId) => ["delivery", "market"].map((type) => reserveFor(userId, type)))};
  const source = () => ({credits: [], claims: [], ledger: null, frozenThroughRound: 0});
  snapshot.creditLedger = {enabled: true, policyRevision: "hu084-provisional-v1",
    sources: {delivery: source(), market: source(), membership}};
  return snapshot;
};
const inputFor = (snapshot) => ({source: snapshot.creditLedger.sources.membership,
  rotations: {delivery: snapshot.rotations.delivery.cursor, market: snapshot.rotations.market.cursor},
  frozenThroughRound: {delivery: snapshot.creditLedger.sources.delivery.frozenThroughRound,
    market: snapshot.creditLedger.sources.market.frozenThroughRound}, roster: snapshot.roster});

module.exports = {admissionSnapshot, recordFor, reserveFor, inputFor};
