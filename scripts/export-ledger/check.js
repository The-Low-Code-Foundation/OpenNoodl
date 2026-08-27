#!/usr/bin/env node
/**
 * export-ledger:check — the code-export coverage gate (phase-18 EXP-008).
 *
 * Every node type in the catalog must be classified in
 * packages/nodegx-export/coverage-ledger.json. The point is contributor-facing: a new
 * frontend node cannot reach the editor's picker (the catalog is CI-enforced by
 * catalog:check) without either a deterministic translation in packages/nodegx-export or
 * an explicit, reviewed exemption sentence in the ledger. Silence is the one thing this
 * gate forbids.
 *
 * Statuses:
 *   translated   — packages/nodegx-export emits real code for it (note says what).
 *   stubbed      — emitted as a typed stub by design (backend seam); requires `exemption`.
 *   deferred     — not translated yet; requires `exemption` saying why that is acceptable.
 *   backend-only — availableIn is exactly ['cloud']; the frontend export never sees it.
 *
 * Usage: node scripts/export-ledger/check.js [--catalog <path>] [--ledger <path>]
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function argValue(flag, fallback) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

const root = path.join(__dirname, '..', '..');
const catalogPath = argValue('--catalog', path.join(root, 'packages', 'noodl-types', 'src', 'node-catalog.json'));
const ledgerPath = argValue('--ledger', path.join(root, 'packages', 'nodegx-export', 'coverage-ledger.json'));

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));

const VALID_STATUS = new Set(['translated', 'stubbed', 'deferred', 'backend-only']);
const HOW_TO =
  '  → Classify it in packages/nodegx-export/coverage-ledger.json. A frontend visual or logic\n' +
  '    node is expected to ship with a deterministic translation in packages/nodegx-export\n' +
  '    (status "translated"); shipping without one requires an explicit one-sentence\n' +
  '    "exemption" saying why that is acceptable, which the ledger diff puts in front of\n' +
  '    review. See dev-docs/tasks/phase-18-code-export-v2/EXP-008-EXPORT-COVERAGE-LEDGER.md.';

const errors = [];

if (ledger.catalogFormatVersion !== catalog.catalogFormatVersion) {
  errors.push(
    `ledger catalogFormatVersion "${ledger.catalogFormatVersion}" != catalog "${catalog.catalogFormatVersion}" — the catalog format changed; re-derive the ledger against it.`
  );
}

const catalogByName = new Map(catalog.nodes.map((n) => [n.typeName, n]));
const ledgerByName = new Map();
for (const entry of ledger.entries ?? []) {
  if (ledgerByName.has(entry.typeName)) {
    errors.push(`duplicate ledger entry for "${entry.typeName}".`);
  }
  ledgerByName.set(entry.typeName, entry);
}

for (const [typeName] of catalogByName) {
  if (!ledgerByName.has(typeName)) {
    errors.push(`catalog node "${typeName}" has no coverage-ledger entry.\n${HOW_TO}`);
  }
}
for (const [typeName] of ledgerByName) {
  if (!catalogByName.has(typeName)) {
    errors.push(`ledger entry "${typeName}" names no catalog node — renamed or removed? Update the ledger with it.`);
  }
}

for (const [typeName, entry] of ledgerByName) {
  const node = catalogByName.get(typeName);
  if (!node) continue;
  if (!VALID_STATUS.has(entry.status)) {
    errors.push(`"${typeName}": invalid status "${entry.status}" (expected one of ${[...VALID_STATUS].join(', ')}).`);
    continue;
  }
  const cloudOnly = Array.isArray(node.availableIn) && node.availableIn.length === 1 && node.availableIn[0] === 'cloud';
  if (cloudOnly && entry.status !== 'backend-only') {
    errors.push(`"${typeName}" is cloud-only in the catalog but ledger status is "${entry.status}" — use "backend-only".`);
  }
  if (!cloudOnly && entry.status === 'backend-only') {
    errors.push(`"${typeName}" is browser-capable (availableIn ${JSON.stringify(node.availableIn)}) but marked "backend-only".\n${HOW_TO}`);
  }
  if ((entry.status === 'deferred' || entry.status === 'stubbed') && !(typeof entry.exemption === 'string' && entry.exemption.trim().length > 0)) {
    errors.push(`"${typeName}" is "${entry.status}" without an exemption sentence.\n${HOW_TO}`);
  }
}

if (errors.length > 0) {
  console.error(`export-ledger:check FAILED — ${errors.length} problem(s):\n`);
  for (const e of errors) console.error(`- ${e}\n`);
  process.exit(1);
}

const counts = {};
for (const entry of ledgerByName.values()) counts[entry.status] = (counts[entry.status] ?? 0) + 1;
console.log(
  `export-ledger:check OK — ${ledgerByName.size} types: ` +
    Object.entries(counts)
      .map(([s, c]) => `${c} ${s}`)
      .join(', ')
);
