#!/usr/bin/env node

const {
  parseMigrationArgs,
  runAuthLinkBackfill,
} = require("./backfill-auth-links.cjs");

async function main() {
  const options = {
    ...parseMigrationArgs(process.argv.slice(2)),
    dataset: "collections",
  };
  const summary = await runAuthLinkBackfill(options);
  console.log(JSON.stringify({
    apply: options.apply,
    dataset: options.dataset,
    summary,
  }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Migration failed");
    process.exitCode = 1;
  });
}
