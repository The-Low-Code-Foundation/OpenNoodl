/**
 * BAK-007: scheduled backups ride WF-005's CronScheduler (one scheduler, two
 * consumers), and a deliberate failure is LOUD (execution record + status).
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { createAdapter } from '../src/persistence/createAdapter';
import { ExecutionHistory } from '../src/execution/ExecutionStore';
import { BackupConfigStore } from '../src/backup/config';
import { BackupManager } from '../src/backup/BackupManager';
import { BackupSubsystem } from '../src/backup/BackupSubsystem';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bak-sched-'));
}
const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

describe('BackupSubsystem scheduling', () => {
  it('arms the shared CronScheduler and stamps the next run time', async () => {
    const dir = tmpDir();
    dirs.push(dir);
    // A real db so nothing about the schedule is degenerate.
    const handle = await createAdapter({ dataDir: dir });
    await handle.adapter.disconnect();

    const executions = new ExecutionHistory();
    executions.open(dir);
    const subsystem = new BackupSubsystem({
      dataDir: dir,
      dbPath: path.join(dir, 'data', 'local.db'),
      executions,
      backendId: 'b',
      backendName: 'B'
    });

    // Enabling a daily schedule + start() must arm the scheduler and set nextRunAt
    // (the CronScheduler.setNextFire -> config.setNextRun path — proof the ONE
    // scheduler drove the backup registry).
    subsystem.setSchedule({ enabled: true, cron: '@daily', missedFirePolicy: 'skip' });
    subsystem.start();
    const next = subsystem.config.get().status.nextRunAt;
    expect(next).toBeTruthy();
    expect(new Date(next!).getTime()).toBeGreaterThan(Date.now());
    subsystem.stop();
  });

  it('rejects an invalid cron loudly', async () => {
    const dir = tmpDir();
    dirs.push(dir);
    const executions = new ExecutionHistory();
    executions.open(dir);
    const subsystem = new BackupSubsystem({
      dataDir: dir,
      dbPath: path.join(dir, 'data', 'local.db'),
      executions,
      backendId: 'b',
      backendName: 'B'
    });
    expect(() => subsystem.setSchedule({ enabled: true, cron: 'not a cron', missedFirePolicy: 'skip' })).toThrow(/cron/i);
  });
});

describe('BackupManager loud failure', () => {
  it('records a failed execution + status (never a stale timestamp) when the snapshot fails', async () => {
    const dir = tmpDir();
    dirs.push(dir);
    const executions = new ExecutionHistory();
    executions.open(dir);
    const config = new BackupConfigStore(dir);
    // dbPath points at a file that does not exist -> snapshot fails loudly.
    const manager = new BackupManager({
      dataDir: dir,
      dbPath: path.join(dir, 'data', 'does-not-exist.db'),
      executions,
      config,
      backendId: 'b',
      backendName: 'B'
    });

    await expect(manager.createBackup({ triggerType: 'manual', source: 'deliberate' })).rejects.toThrow();

    // Status is a LOUD failure, not a quietly stale success.
    const status = config.get().status;
    expect(status.lastResult).toBeTruthy();
    expect(status.lastResult!.ok).toBe(false);
    expect(status.lastSuccessAt).toBeNull();

    // And a failed execution record exists.
    const records = executions.list({ limit: 10 }) as { status: string; workflowId: string }[];
    expect(records.some((r) => r.workflowId === '__backup__' && r.status === 'error')).toBe(true);
  });
});
