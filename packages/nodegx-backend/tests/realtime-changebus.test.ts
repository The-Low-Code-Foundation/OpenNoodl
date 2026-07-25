/**
 * BAK-001 ChangeBus — the single post-commit change tap, exercised against a
 * real node:sqlite LocalSQLAdapter.
 *
 * The load-bearing guarantee (spec risk row: "Event tap fires pre-commit or
 * inside transactions"): a transaction that ROLLS BACK must emit no change
 * event, and a transaction that COMMITS must emit its events only AFTER commit.
 * Also: create→create, save→update, delete→delete, and delete carries the row
 * as it was (its ACL included) so delivery-time permission checks have it.
 */
import { ChangeBus, ChangeEvent } from '../src/realtime/ChangeBus';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { resolveEngine } = require('../../noodl-runtime/src/api/adapters/local-sql/engine');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const LocalSQLAdapter = require('../../noodl-runtime/src/api/adapters/local-sql/LocalSQLAdapter');

describe('ChangeBus over a real adapter', () => {
  const engine = resolveEngine();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let adapter: any;
  let bus: ChangeBus;
  let events: ChangeEvent[];

  beforeAll(async () => {
    if (!engine) throw new Error('node:sqlite required');
    adapter = new LocalSQLAdapter(':memory:', { engine, autoCreateTables: true });
    await adapter.connect();
    bus = new ChangeBus(adapter);
    events = [];
    bus.subscribe((e) => events.push(e));
  });

  afterAll(async () => {
    bus.close();
    if (adapter) await adapter.disconnect();
  });

  const last = () => events[events.length - 1];

  function create(collection: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      adapter.create({ collection, data, success: resolve, error: (e: unknown) => reject(new Error(String(e))) });
    });
  }
  function save(collection: string, objectId: string, data: Record<string, unknown>): Promise<void> {
    return new Promise((resolve, reject) => {
      adapter.save({ collection, objectId, data, success: () => resolve(), error: (e: unknown) => reject(new Error(String(e))) });
    });
  }
  function remove(collection: string, objectId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      adapter.delete({ collection, objectId, success: () => resolve(), error: (e: unknown) => reject(new Error(String(e))) });
    });
  }

  it('normalizes create/save/delete to create/update/delete', async () => {
    const rec = await create('Doc', { title: 'a', ACL: { u1: { read: true } } });
    expect(last()).toMatchObject({ action: 'create', collection: 'Doc' });
    expect(last().record.title).toBe('a');

    await save('Doc', rec.objectId as string, { title: 'b' });
    expect(last()).toMatchObject({ action: 'update', collection: 'Doc' });
    expect(last().record.title).toBe('b');

    await remove('Doc', rec.objectId as string);
    const del = last();
    expect(del).toMatchObject({ action: 'delete', collection: 'Doc', id: rec.objectId });
    // The deleted record — including its ACL — rides the event.
    expect(del.record.objectId).toBe(rec.objectId);
    expect(del.record.ACL).toEqual({ u1: { read: true } });
  });

  it('a COMMITTED transaction emits its events only after commit', async () => {
    let insideTxnCount = -1;
    const before = events.length;
    adapter.transaction(() => {
      adapter.create({ collection: 'Doc', data: { title: 't1' }, success() {}, error() {} });
      adapter.create({ collection: 'Doc', data: { title: 't2' }, success() {}, error() {} });
      // Buffered: nothing delivered yet, mid-transaction.
      insideTxnCount = events.length - before;
    });
    expect(insideTxnCount).toBe(0); // post-commit contract: no early delivery
    expect(events.length - before).toBe(2); // both released on commit
    expect(events.slice(-2).map((e) => e.record.title)).toEqual(['t1', 't2']);
  });

  it('a ROLLED-BACK transaction emits nothing and leaves no row', async () => {
    const before = events.length;
    let insertedId: string | undefined;
    expect(() =>
      adapter.transaction(() => {
        adapter.create({
          collection: 'Doc',
          data: { title: 'ghost' },
          success: (r: Record<string, unknown>) => {
            insertedId = r.objectId as string;
          },
          error() {}
        });
        throw new Error('boom'); // force ROLLBACK
      })
    ).toThrow('boom');

    // No change event escaped the rolled-back transaction.
    expect(events.length).toBe(before);
    // And the row is really gone.
    const found = await new Promise<Record<string, unknown>[]>((resolve) => {
      adapter.query({ collection: 'Doc', where: { title: 'ghost' }, success: (r: Record<string, unknown>[]) => resolve(r), error: () => resolve([]) });
    });
    expect(found).toEqual([]);
    expect(insertedId).toBeDefined(); // it WAS created inside the txn, then undone
  });

  it('stops delivering after close()', async () => {
    const local = new ChangeBus(adapter);
    const seen: ChangeEvent[] = [];
    local.subscribe((e) => seen.push(e));
    await create('Doc', { title: 'x' });
    expect(seen.length).toBe(1);
    local.close();
    await create('Doc', { title: 'y' });
    expect(seen.length).toBe(1); // no further delivery
  });
});
