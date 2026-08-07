/**
 * SchemaManager.changeColumnType — AAQ-002/F5 (phase 40).
 *
 * The fifth schema mutation. Before it, the admin surface could create, add,
 * rename and delete, which meant a provision re-run against a collection that
 * already existed could not make it match the plan: `createTable` returns
 * `created: false` and adds nothing, so an auto-created collection kept its zero
 * columns and the editor's `prop-*` ports could never appear.
 *
 * Run against a **real** SQLite engine on a temp file, not a mock, because the
 * half that can go wrong is the one that emits SQL: SQLite has no
 * `ALTER COLUMN`, so a change that crosses storage classes is an
 * add-copy-drop-rename, and "the metadata says Number now" is not evidence that
 * the rows survived it.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const { resolveEngine, SchemaManager } = require('../../src/api/adapters/local-sql');

const engine = resolveEngine();

/** A SchemaManager over a fresh on-disk database, with its temp dir. */
function freshManager() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aaq002-schema-'));
  const db = engine.open(path.join(dir, 'test.db'));
  const sm = new SchemaManager(db);
  sm.ensureSchemaTable();
  return { sm, db, dir };
}

function rowsOf(db, table) {
  return db.prepare(`SELECT * FROM "${table}" ORDER BY "objectId"`).all();
}

describe('SchemaManager.changeColumnType', () => {
  let ctx;

  beforeEach(() => {
    ctx = freshManager();
  });

  afterEach(() => {
    try {
      ctx.db.close();
    } catch {
      /* already closed */
    }
    fs.rmSync(ctx.dir, { recursive: true, force: true });
  });

  it('reports no change when the column already has the wanted type', () => {
    const { sm } = ctx;
    sm.createTable({ name: 'Puppy', columns: [{ name: 'name', type: 'String' }] });

    expect(sm.changeColumnType('Puppy', 'name', 'String')).toEqual({ changed: false });
  });

  it('converts stored values when the storage class moves, and says how many', () => {
    const { sm, db } = ctx;
    sm.createTable({ name: 'Puppy', columns: [{ name: 'age', type: 'String' }] });
    db.prepare('INSERT INTO "Puppy" ("objectId", "age") VALUES (?, ?)').run('a', '3');
    db.prepare('INSERT INTO "Puppy" ("objectId", "age") VALUES (?, ?)').run('b', '7');
    db.prepare('INSERT INTO "Puppy" ("objectId", "age") VALUES (?, ?)').run('c', null);

    const result = sm.changeColumnType('Puppy', 'age', 'Number');

    expect(result.changed).toBe(true);
    expect(result.from).toBe('String');
    // TEXT → REAL, so this one really did rebuild — and only the two non-null
    // values were at risk, which is the number a human has to be told.
    expect(result.rebuilt).toBe(true);
    expect(result.convertedValues).toBe(2);

    // The data came through the CAST, and the column still holds the same rows
    // in the same order — the drop/rename did not shuffle anything.
    expect(rowsOf(db, 'Puppy').map((r) => r.age)).toEqual([3, 7, null]);
    expect(sm.getTableSchema('Puppy').columns).toEqual([{ name: 'age', type: 'Number' }]);
  });

  it('⚠️ a value that is not convertible becomes 0 — the documented loss', () => {
    const { sm, db } = ctx;
    sm.createTable({ name: 'Puppy', columns: [{ name: 'age', type: 'String' }] });
    db.prepare('INSERT INTO "Puppy" ("objectId", "age") VALUES (?, ?)').run('a', 'sold out');

    const result = sm.changeColumnType('Puppy', 'age', 'Number');

    expect(result.convertedValues).toBe(1);
    // SQLite's CAST rules, not ours. Pinned so nobody discovers it in a user's
    // data: this is exactly why the provisioner turns `convertedValues` into a
    // sentence rather than reconciling quietly.
    expect(rowsOf(db, 'Puppy')[0].age).toBe(0);
  });

  it('touches no data when both types share a storage class', () => {
    const { sm, db } = ctx;
    sm.createTable({ name: 'Puppy', columns: [{ name: 'born', type: 'String' }] });
    db.prepare('INSERT INTO "Puppy" ("objectId", "born") VALUES (?, ?)').run('a', '2026-08-05');

    // Both String and Date are TEXT, so this is a metadata correction.
    const result = sm.changeColumnType('Puppy', 'born', 'Date');

    expect(result).toEqual({ changed: true, from: 'String', rebuilt: false, convertedValues: 0 });
    expect(rowsOf(db, 'Puppy')[0].born).toBe('2026-08-05');
    expect(sm.getTableSchema('Puppy').columns[0].type).toBe('Date');
  });

  it('corrects a column whose recorded type is unknown without emitting SQL for it', () => {
    const { sm, db } = ctx;
    // The shape an imported or older schema has. `TYPE_MAP` has no entry, so a
    // rebuild would emit `ADD COLUMN "x" undefined` — which is not SQL.
    sm.createTable({ name: 'Puppy', columns: [{ name: 'note', type: 'Mystery' }] });
    db.prepare('INSERT INTO "Puppy" ("objectId") VALUES (?)').run('a');

    const result = sm.changeColumnType('Puppy', 'note', 'String');

    expect(result.rebuilt).toBe(false);
    expect(sm.getTableSchema('Puppy').columns[0].type).toBe('String');
    expect(rowsOf(db, 'Puppy')).toHaveLength(1);
  });

  it('leaves the other columns of the table alone', () => {
    const { sm, db } = ctx;
    sm.createTable({
      name: 'Puppy',
      columns: [
        { name: 'name', type: 'String' },
        { name: 'age', type: 'String' },
        { name: 'good', type: 'Boolean' }
      ]
    });
    db.prepare('INSERT INTO "Puppy" ("objectId", "name", "age", "good") VALUES (?, ?, ?, ?)').run('a', 'Rex', '4', 1);

    sm.changeColumnType('Puppy', 'age', 'Number');

    const row = rowsOf(db, 'Puppy')[0];
    expect(row.name).toBe('Rex');
    expect(row.age).toBe(4);
    expect(row.good).toBe(1);
    expect(sm.getTableSchema('Puppy').columns.map((c) => c.name)).toEqual(['name', 'age', 'good']);
  });

  it('refuses system columns, unknown types, missing columns and Relations', () => {
    const { sm } = ctx;
    sm.createTable({
      name: 'Puppy',
      columns: [
        { name: 'name', type: 'String' },
        { name: 'litter', type: 'Relation', targetClass: 'Litter' }
      ]
    });

    expect(() => sm.changeColumnType('Puppy', 'createdAt', 'Number')).toThrow(/system columns/);
    expect(() => sm.changeColumnType('Puppy', 'name', 'Sparkle')).toThrow(/Unknown column type/);
    expect(() => sm.changeColumnType('Puppy', 'nope', 'String')).toThrow(/does not exist/);
    expect(() => sm.changeColumnType('Nothing', 'name', 'String')).toThrow(/Table "Nothing" does not exist/);
    // Both directions: a Relation lives in a junction table, so "converting" it
    // is creating or destroying associations — never this method's call.
    expect(() => sm.changeColumnType('Puppy', 'litter', 'String')).toThrow(/junction table/);
    expect(() => sm.changeColumnType('Puppy', 'name', 'Relation')).toThrow(/junction table/);
  });
});
