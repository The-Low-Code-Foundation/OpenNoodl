#!/usr/bin/env node
/**
 * Every behavioural drive, one after another.
 *
 * Serial, because each one starts its own headless Chrome. Exit 1 if any check
 * failed — these are assertions about shipped content, not a report.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const drives = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.js') && !['harness.js', 'run-all.js'].includes(f))
  .sort();

let failed = 0;
for (const file of drives) {
  console.log(`\n── ${file.replace(/\.js$/, '')} ${'─'.repeat(Math.max(0, 56 - file.length))}`);
  const res = spawnSync(process.execPath, [path.join(dir, file)], { stdio: 'inherit' });
  if (res.status !== 0) failed++;
}
console.log(`\n${drives.length} drive(s), ${failed} with a failing check.`);
process.exit(failed ? 1 : 0);
