/**
 * WF-005 DB-change triggers — delivery, action filtering, and the loop rule,
 * exercised against a REAL LocalSQLAdapter + the SAME ChangeBus BAK-001 ships.
 *
 * The load-bearing test (spec success criterion + risk row): a handler that
 * writes to its OWN trigger table does not recurse unbounded. We prove the depth
 * cap suppresses the re-trigger.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { ChangeBus } from '../src/realtime/ChangeBus';
import { SecretsStore } from '../src/config/SecretsStore';
import { TriggerRegistry } from '../src/triggers/registry';
import { DbChangeTriggers } from '../src/triggers/dbchange';
import type { TriggerDispatcher, FireInput, FireOutcome } from '../src/triggers/dispatcher';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { resolveEngine } = require('../../noodl-runtime/src/api/adapters/local-sql/engine');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const LocalSQLAdapter = require('../../noodl-runtime/src/api/adapters/local-sql/LocalSQLAdapter');

function okOutcome(): FireOutcome {
  return { result: { ok: true, at: new Date().toISOString(), statusCode: 200 }, statusCode: 200, body: '{}' };
}

describe('DbChangeTriggers', () => {
  const engine = resolveEngine();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let adapter: any;
  let bus: ChangeBus;
  let dir: string;
  let reg: TriggerRegistry;

  beforeEach(async () => {
    if (!engine) throw new Error('node:sqlite required');
    adapter = new LocalSQLAdapter(':memory:', { engine, autoCreateTables: true });
    await adapter.connect();
    bus = new ChangeBus(adapter);
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-dbc-'));
    reg = new TriggerRegistry(dir, new SecretsStore(dir));
  });

  afterEach(async () => {
    bus.close();
    await adapter.disconnect();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function create(collection: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      adapter.create({ collection, data, success: resolve, error: (e: unknown) => reject(new Error(String(e))) });
    });
  }
  function remove(collection: string, objectId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      adapter.delete({ collection, objectId, success: () => resolve(), error: (e: unknown) => reject(new Error(String(e))) });
    });
  }
  const tick = () => new Promise((r) => setTimeout(r, 10));

  it('delivers a matching create to the target (with the record payload)', async () => {
    reg.upsert({ type: 'db-change', target: { kind: 'function', name: 'onOrder' }, dbChange: { collection: 'Orders', actions: ['create'] } });

    const fires: FireInput[] = [];
    const dispatcher = {
      fire: (input: FireInput) => {
        fires.push(input);
        return Promise.resolve(okOutcome());
      },
      recordRejection: () => ({ ok: false, at: 'now' })
    } as unknown as TriggerDispatcher;

    const dbc = new DbChangeTriggers({ bus, registry: reg, dispatcher });
    dbc.start();

    const row = await create('Orders', { total: 10 });
    await tick();

    expect(fires).toHaveLength(1);
    expect(fires[0].triggerType).toBe('db_change');
    expect((fires[0].payload as any).action).toBe('create');
    expect((fires[0].payload as any).collection).toBe('Orders');
    expect((fires[0].payload as any).record.objectId).toBe(row.objectId);
    dbc.stop();
  });

  it('respects the action filter (delete on a create-only trigger does not fire)', async () => {
    reg.upsert({ type: 'db-change', target: { kind: 'function', name: 'onCreate' }, dbChange: { collection: 'Orders', actions: ['create'] } });
    const fires: FireInput[] = [];
    const dispatcher = {
      fire: (input: FireInput) => {
        fires.push(input);
        return Promise.resolve(okOutcome());
      },
      recordRejection: () => ({ ok: false, at: 'now' })
    } as unknown as TriggerDispatcher;

    const dbc = new DbChangeTriggers({ bus, registry: reg, dispatcher });
    dbc.start();

    const row = await create('Orders', { total: 5 });
    await tick();
    expect(fires).toHaveLength(1); // the create
    await remove('Orders', row.objectId as string);
    await tick();
    expect(fires).toHaveLength(1); // the delete was filtered out
    dbc.stop();
  });

  it('does not fire for a disabled trigger', async () => {
    const { trigger } = reg.upsert({ type: 'db-change', target: { kind: 'function', name: 'f' }, dbChange: { collection: 'Orders', actions: ['create'] } });
    reg.setEnabled(trigger.id, false);
    const fires: FireInput[] = [];
    const dispatcher = {
      fire: (input: FireInput) => { fires.push(input); return Promise.resolve(okOutcome()); },
      recordRejection: () => ({ ok: false, at: 'now' })
    } as unknown as TriggerDispatcher;
    const dbc = new DbChangeTriggers({ bus, registry: reg, dispatcher });
    dbc.start();
    await create('Orders', { total: 1 });
    await tick();
    expect(fires).toHaveLength(0);
    dbc.stop();
  });

  it('LOOP PROTECTION: a handler writing to its own table does not recurse unbounded', async () => {
    reg.upsert({ type: 'db-change', target: { kind: 'function', name: 'onLoopy' }, dbChange: { collection: 'Loopy', actions: ['create'] } });

    let fireCount = 0;
    // The fake handler writes to the SAME trigger table on every fire — the exact
    // shape that would recurse forever without the depth cap.
    const dispatcher = {
      fire: (_input: FireInput) => {
        fireCount++;
        // Synchronous write during the handler → emits a nested change event.
        adapter.create({ collection: 'Loopy', data: { echo: fireCount }, success() {}, error() {} });
        return Promise.resolve(okOutcome());
      },
      recordRejection: () => ({ ok: false, at: 'now' })
    } as unknown as TriggerDispatcher;

    const dbc = new DbChangeTriggers({ bus, registry: reg, dispatcher });
    dbc.start();

    await create('Loopy', { seed: true });
    await tick();
    await tick();

    // Exactly one top-level fire; the handler's own write was suppressed by the
    // depth cap (default maxChangeDepth = 1), and at least one event was dropped
    // by the loop guard.
    expect(fireCount).toBe(1);
    expect(dbc.suppressedCount).toBeGreaterThanOrEqual(1);
    dbc.stop();
  });
});
