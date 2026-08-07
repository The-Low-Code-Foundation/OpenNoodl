/**
 * WF-004 engine compatibility test (standalone, runnable with plain `node`).
 *
 *   node dev-docs/tasks/phase-19-cloud-workflows/wf-004-engine-compat-test.js
 *
 * Proves that the chosen engine (`node:sqlite` via the shim in
 * packages/noodl-runtime/src/api/adapters/local-sql/engine.js) covers the
 * ENTIRE API surface the adapter stack actually uses, by:
 *
 *   1. Exercising the raw node:sqlite API for each primitive the adapter needs
 *      (prepared statements w/ positional params, WAL pragma, exec of
 *      multi-statement DDL, INSERT OR REPLACE / OR IGNORE, transactions +
 *      rollback, ALTER TABLE ADD COLUMN, .run() return shape).
 *   2. Running the REAL LocalSQLAdapter + SchemaManager end-to-end against the
 *      engine — create / query / save / count / delete — and, critically,
 *      closing the file and reopening a fresh adapter to prove persistence
 *      survives a restart (the exact behaviour the silent mock lacked).
 *
 * Exit code 0 = all assertions passed. Any failure throws and exits non-zero.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RUNTIME = path.join(__dirname, '../../../packages/noodl-runtime');
const { resolveEngine } = require(path.join(RUNTIME, 'src/api/adapters/local-sql/engine'));
const LocalSQLAdapter = require(path.join(RUNTIME, 'src/api/adapters/local-sql/LocalSQLAdapter'));

let passed = 0;
function ok(label) {
  passed++;
  console.log('  ok  -', label);
}

console.log('Node version:', process.versions.node);

const engine = resolveEngine();
assert(engine, 'no SQLite engine resolved');
console.log('Resolved engine:', engine.name);
console.log('');

// ---------------------------------------------------------------------------
// Part 1 — raw primitives the adapter/SchemaManager depend on
// ---------------------------------------------------------------------------
console.log('Part 1: raw engine primitives');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf004-compat-'));
const rawPath = path.join(tmpDir, 'raw.db');
const db = engine.open(rawPath);

// WAL pragma (SchemaManager/adapter call this via db.pragma)
const walResult = db.pragma('journal_mode = WAL');
ok('db.pragma("journal_mode = WAL") -> ' + JSON.stringify(walResult));

// Multi-statement DDL via exec (SchemaManager.createTable uses exec heavily)
db.exec(`
  CREATE TABLE IF NOT EXISTS "_Schema" (
    "name" TEXT PRIMARY KEY,
    "schema" TEXT NOT NULL,
    "createdAt" TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE "notes" (
    "objectId" TEXT PRIMARY KEY,
    "createdAt" TEXT DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT
  );
  CREATE INDEX IF NOT EXISTS "idx_notes_createdAt" ON "notes"("createdAt");
`);
ok('db.exec() multi-statement DDL (CREATE TABLE + CREATE INDEX)');

// sqlite_master lookup (SchemaManager checks table existence this way)
const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get('notes');
assert(exists && exists.name === 'notes', 'sqlite_master lookup failed');
ok('prepare().get() with positional param against sqlite_master');

// prepared INSERT with positional params + .run() return shape
const runResult = db.prepare('INSERT INTO "notes" ("objectId", "title") VALUES (?, ?)').run('id-1', 'hello');
assert(runResult && typeof runResult.changes !== 'undefined', '.run() missing changes');
assert(Number(runResult.changes) === 1, '.run().changes !== 1');
ok('prepare().run(...params) returns { changes } -> changes=' + runResult.changes);

// INSERT OR REPLACE (SchemaManager schema tracking) and INSERT OR IGNORE (relations)
db.prepare('INSERT OR REPLACE INTO "_Schema" ("name","schema") VALUES (?, ?)').run('notes', '{"columns":[]}');
db.prepare('INSERT OR REPLACE INTO "_Schema" ("name","schema") VALUES (?, ?)').run('notes', '{"columns":[{"name":"title"}]}');
const schemaRow = db.prepare('SELECT "schema" FROM "_Schema" WHERE "name" = ?').get('notes');
assert(JSON.parse(schemaRow.schema).columns.length === 1, 'INSERT OR REPLACE did not upsert');
ok('INSERT OR REPLACE upsert semantics');

// .all() with params
const rows = db.prepare('SELECT * FROM "notes" WHERE "title" = ?').all('hello');
assert(Array.isArray(rows) && rows.length === 1 && rows[0].objectId === 'id-1', '.all() failed');
ok('prepare().all(...params) returns row array');

// ALTER TABLE ADD COLUMN (SchemaManager.addColumn)
db.exec('ALTER TABLE "notes" ADD COLUMN "body" TEXT');
db.prepare('UPDATE "notes" SET "body" = ? WHERE "objectId" = ?').run('world', 'id-1');
const withBody = db.prepare('SELECT "body" FROM "notes" WHERE "objectId" = ?').get('id-1');
assert(withBody.body === 'world', 'ALTER TABLE ADD COLUMN failed');
ok('ALTER TABLE ADD COLUMN then read back');

// transaction shim: commit path
const insertMany = db.transaction((items) => {
  for (const it of items) {
    db.prepare('INSERT INTO "notes" ("objectId","title") VALUES (?, ?)').run(it.id, it.title);
  }
  return items.length;
});
const n = insertMany([{ id: 'id-2', title: 'a' }, { id: 'id-3', title: 'b' }]);
assert(n === 2, 'transaction return value wrong');
const countAfterCommit = db.prepare('SELECT COUNT(*) AS c FROM "notes"').get().c;
assert(Number(countAfterCommit) === 3, 'commit did not persist rows, got ' + countAfterCommit);
ok('db.transaction(fn)() commits and returns fn result');

// transaction shim: rollback path
let threw = false;
try {
  db.transaction(() => {
    db.prepare('INSERT INTO "notes" ("objectId","title") VALUES (?, ?)').run('id-4', 'doomed');
    throw new Error('boom');
  })();
} catch (e) {
  threw = true;
}
assert(threw, 'transaction did not rethrow');
const countAfterRollback = db.prepare('SELECT COUNT(*) AS c FROM "notes"').get().c;
assert(Number(countAfterRollback) === 3, 'ROLLBACK failed — doomed row leaked, count=' + countAfterRollback);
ok('db.transaction(fn) rolls back on throw and rethrows');

db.close();
ok('db.close()');

console.log('');

// ---------------------------------------------------------------------------
// Part 2 — the REAL adapter stack end-to-end + persistence across restart
// ---------------------------------------------------------------------------
console.log('Part 2: real LocalSQLAdapter end-to-end');

function createRecord(adapter, collection, data) {
  return new Promise((resolve, reject) => {
    adapter.create({ collection, data, success: resolve, error: (m) => reject(new Error(m)) });
  });
}
function saveRecord(adapter, collection, objectId, data) {
  return new Promise((resolve, reject) => {
    adapter.save({ collection, objectId, data, success: resolve, error: (m) => reject(new Error(m)) });
  });
}
function queryRecords(adapter, collection, extra) {
  return new Promise((resolve, reject) => {
    adapter.query({ collection, ...extra, success: (r, c) => resolve({ r, c }), error: (m) => reject(new Error(m)) });
  });
}
function fetchRecord(adapter, collection, objectId) {
  return new Promise((resolve, reject) => {
    adapter.fetch({ collection, objectId, success: resolve, error: (m) => reject(new Error(m)) });
  });
}
function countRecords(adapter, collection) {
  return new Promise((resolve, reject) => {
    adapter.count({ collection, success: resolve, error: (m) => reject(new Error(m)) });
  });
}
function deleteRecord(adapter, collection, objectId) {
  return new Promise((resolve, reject) => {
    adapter.delete({ collection, objectId, success: resolve, error: (m) => reject(new Error(m)) });
  });
}

async function main() {
  const dbPath = path.join(tmpDir, 'adapter.db');

  const writer = new LocalSQLAdapter(dbPath);
  await writer.connect();
  const status = writer.getPersistenceStatus();
  assert(status.mode === 'persistent', 'expected persistent mode, got ' + status.mode);
  assert(status.engine === engine.name, 'engine name mismatch: ' + status.engine);
  ok('adapter.connect() -> persistent, engine=' + status.engine);

  const created = await createRecord(writer, 'tasks', { title: 'first', done: false });
  assert(created.objectId, 'create returned no objectId');
  ok('adapter.create() -> objectId ' + created.objectId);

  await createRecord(writer, 'tasks', { title: 'second', done: true });
  const { r: allRows } = await queryRecords(writer, 'tasks', {});
  assert(allRows.length === 2, 'expected 2 rows, got ' + allRows.length);
  ok('adapter.query() returns both rows');

  await saveRecord(writer, 'tasks', created.objectId, { title: 'first-edited', done: true });
  const refetched = await fetchRecord(writer, 'tasks', created.objectId);
  assert(refetched.title === 'first-edited', 'save did not persist');
  ok('adapter.save() then fetch reflects update');

  const total = await countRecords(writer, 'tasks');
  assert(total === 2, 'count wrong: ' + total);
  ok('adapter.count() -> ' + total);

  await writer.disconnect();
  ok('adapter.disconnect()');

  // The load-bearing assertion: reopen a fresh adapter on the same file.
  const reader = new LocalSQLAdapter(dbPath);
  await reader.connect();
  const readBack = await fetchRecord(reader, 'tasks', created.objectId);
  assert(readBack && readBack.title === 'first-edited', 'DATA DID NOT SURVIVE RESTART');
  ok('fresh adapter on same file reads back persisted data (survives restart)');

  const remaining = await countRecords(reader, 'tasks');
  assert(remaining === 2, 'row count did not survive restart: ' + remaining);
  await deleteRecord(reader, 'tasks', created.objectId);
  const afterDelete = await countRecords(reader, 'tasks');
  assert(afterDelete === 1, 'delete failed: ' + afterDelete);
  ok('adapter.delete() persists');

  await reader.disconnect();

  // cleanup
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (e) {
    /* ignore */
  }

  console.log('');
  console.log('ALL ' + passed + ' ASSERTIONS PASSED — engine "' + engine.name + '" covers the adapter API surface.');
}

main().catch((e) => {
  console.error('COMPAT TEST FAILED:', e);
  process.exit(1);
});
