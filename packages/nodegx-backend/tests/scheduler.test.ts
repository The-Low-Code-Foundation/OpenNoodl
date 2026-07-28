/**
 * WF-005 scheduler — the missed-fire policy (pure decision) and that an armed
 * schedule reaches the dispatcher.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { SecretsStore } from '../src/config/SecretsStore';
import { TriggerRegistry, TriggerDef } from '../src/triggers/registry';
import { computeStartPlan, CronScheduler } from '../src/triggers/scheduler';
import type { TriggerDispatcher, FireInput, FireOutcome } from '../src/triggers/dispatcher';

function scheduleTrigger(overrides: Partial<TriggerDef> = {}): TriggerDef {
  return {
    id: 'trg_s',
    type: 'schedule',
    enabled: true,
    target: { kind: 'function', name: 'digest' },
    schedule: { cron: '0 * * * *', missedFirePolicy: 'skip' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status: { lastFiredAt: null, nextFireAt: null, lastResult: null, fireCount: 0 },
    ...overrides
  };
}

describe('computeStartPlan — missed-fire policy', () => {
  it('skip: never catches up, resumes at the next future fire', () => {
    const t = scheduleTrigger({
      schedule: { cron: '0 * * * *', missedFirePolicy: 'skip' },
      status: { lastFiredAt: '2026-01-01T08:00:00.000Z', nextFireAt: null, lastResult: null, fireCount: 1 }
    });
    // Service starts at 12:30 after being down since 08:00 — many fires missed.
    const plan = computeStartPlan(t, new Date(2026, 0, 1, 12, 30));
    expect(plan.fireNow).toBe(false);
    expect(plan.nextFireAt.getHours()).toBe(13);
  });

  it('run-once-on-start: catches up ONCE when a fire was missed', () => {
    const t = scheduleTrigger({
      schedule: { cron: '0 * * * *', missedFirePolicy: 'run-once-on-start' },
      status: { lastFiredAt: '2026-01-01T08:00:00.000Z', nextFireAt: null, lastResult: null, fireCount: 1 }
    });
    const plan = computeStartPlan(t, new Date(2026, 0, 1, 12, 30));
    expect(plan.fireNow).toBe(true); // one catch-up, not one-per-missed-window
    expect(plan.nextFireAt.getHours()).toBe(13);
  });

  it('run-once-on-start: does NOT catch up when nothing was missed', () => {
    const t = scheduleTrigger({
      schedule: { cron: '0 * * * *', missedFirePolicy: 'run-once-on-start' },
      // Last fired at 12:00; now 12:30 — the 13:00 fire is still in the future.
      status: { lastFiredAt: '2026-01-01T12:00:00.000Z', nextFireAt: null, lastResult: null, fireCount: 1 }
    });
    const plan = computeStartPlan(t, new Date(2026, 0, 1, 12, 30));
    expect(plan.fireNow).toBe(false);
  });

  it('never catches up when the trigger has never fired', () => {
    const t = scheduleTrigger({ schedule: { cron: '0 * * * *', missedFirePolicy: 'run-once-on-start' } });
    expect(computeStartPlan(t, new Date(2026, 0, 1, 12, 30)).fireNow).toBe(false);
  });
});

describe('CronScheduler.start', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-sched-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('fires a run-once-on-start schedule through the dispatcher, tagged schedule', async () => {
    const reg = new TriggerRegistry(dir, new SecretsStore(dir));
    const { trigger } = reg.upsert({
      type: 'schedule',
      target: { kind: 'function', name: 'digest' },
      schedule: { cron: '0 * * * *', missedFirePolicy: 'run-once-on-start' }
    });
    // Pretend it last fired hours ago so a catch-up is due.
    reg.recordFire(trigger.id, { firedAt: '2026-01-01T08:00:00.000Z' });

    const fires: FireInput[] = [];
    const fakeDispatcher = {
      fire: (input: FireInput): Promise<FireOutcome> => {
        fires.push(input);
        return Promise.resolve({ result: { ok: true, at: 'now' }, statusCode: 200, body: '{}' });
      },
      recordRejection: () => ({ ok: false, at: 'now' })
    } as unknown as TriggerDispatcher;

    const scheduler = new CronScheduler({
      registry: reg,
      dispatcher: fakeDispatcher,
      now: () => new Date(2026, 0, 1, 12, 30)
    });
    scheduler.start();
    // The catch-up fire is scheduled via a resolved promise microtask.
    await Promise.resolve();
    await Promise.resolve();
    scheduler.stop();

    expect(fires.length).toBeGreaterThanOrEqual(1);
    expect(fires[0].triggerType).toBe('schedule');
    expect(fires[0].trigger.id).toBe(trigger.id);
    // next fire recorded for the UI.
    expect(reg.get(trigger.id)!.status.nextFireAt).toBeTruthy();

    // WFA-003: the uniform payload, from the real call site. `body: {}` rather
    // than an absent key is what lets one definition read `body.x` whether a
    // cron or a webhook started it — the schedule simply has nothing to put
    // there yet (F8 is WFA-005's).
    const payload = fires[0].payload;
    expect(payload.body).toEqual({});
    expect(payload.triggerType).toBe('schedule');
    expect(payload.trigger).toEqual({
      type: 'schedule',
      id: trigger.id,
      firedAt: expect.any(String),
      cron: '0 * * * *'
    });
    // The deprecated top-level view a definition written before WFA-003 reads.
    expect(payload.triggerId).toBe(trigger.id);
    expect(payload.cron).toBe('0 * * * *');
  });
});
