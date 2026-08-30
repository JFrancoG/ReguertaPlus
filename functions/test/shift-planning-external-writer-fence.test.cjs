"use strict";

const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const {join} = require("node:path");
const {test} = require("node:test");

const {
  createShiftPlanningExternalWriterFence,
  runShiftPlanningExternalWriterMutation,
} = require("../lib/shift-planning-external-writer-fence.js");

test("captures once and revalidates every external mutation", async () => {
  let currentRevision = 4;
  let captureCount = 0;
  let mutationCount = 0;
  const fence = await createShiftPlanningExternalWriterFence({
    capture: async () => {
      captureCount += 1;
      return {revision: currentRevision};
    },
    revalidate: async (captured) => {
      if (captured.revision !== currentRevision) {
        throw new Error("planning authority changed");
      }
    },
  });

  await runShiftPlanningExternalWriterMutation(fence, async () => {
    mutationCount += 1;
  });
  currentRevision = 5;

  await assert.rejects(
    runShiftPlanningExternalWriterMutation(fence, async () => {
      mutationCount += 1;
    }),
    /planning authority changed/,
  );
  assert.equal(captureCount, 1);
  assert.equal(mutationCount, 1);
});

test("revalidates after the final external mutation", async () => {
  let currentRevision = 7;
  const fence = await createShiftPlanningExternalWriterFence({
    capture: async () => currentRevision,
    revalidate: async (captured) => {
      if (captured !== currentRevision) {
        throw new Error("planning authority changed");
      }
    },
  });

  await runShiftPlanningExternalWriterMutation(fence, async () => {
    currentRevision = 8;
  });

  await assert.rejects(
    fence.finish,
    /planning authority changed/,
  );
});

test("does not run an external mutation when revalidation fails", async () => {
  let mutationCalled = false;
  const fence = await createShiftPlanningExternalWriterFence({
    capture: async () => "authority-1",
    revalidate: async () => {
      throw new Error("planning maintenance");
    },
  });

  await assert.rejects(
    runShiftPlanningExternalWriterMutation(fence, async () => {
      mutationCalled = true;
    }),
    /planning maintenance/,
  );
  assert.equal(mutationCalled, false);
});

test("legacy shift trigger fences Sheets and Firestore effects", () => {
  const source = readFileSync(join(__dirname, "../src/index.ts"), "utf8");
  const start = source.indexOf("export const onShiftWritten");
  const end = source.indexOf(
    "export const onDeliveryCalendarOverrideWritten",
    start,
  );
  const trigger = source.slice(start, end);
  const effectsStart = source.indexOf("const persistShiftExportEffects");
  const effectsEnd = source.indexOf("const formatNotificationDate", effectsStart);
  const effects = source.slice(effectsStart, effectsEnd);

  assert.match(trigger, /createShiftPlanningExternalWriterFence/);
  assert.match(trigger, /upsertShiftRowInSheet\([\s\S]*?writerFence,\s*\)/);
  assert.match(trigger, /await writerFence\.finish\(\)/);
  assert.match(trigger, /persistShiftExportEffects/);
  assert.doesNotMatch(trigger, /afterSnapshot\.ref\.set/);
  assert.doesNotMatch(trigger, /dispatchShiftUpdatedNotification/);
  assert.match(effects, /runShiftPlanningNotificationGuardedShiftWrite/);
  assert.match(effects, /assertShiftPlanningWriterAuthorityInTransaction/);
  assert.match(effects, /shiftExportStateMatches/);
  assert.match(effects, /transaction\.set/);
  assert.match(effects, /transaction\.create/);
});
