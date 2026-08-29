"use strict";

const assert = require("node:assert/strict");
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
