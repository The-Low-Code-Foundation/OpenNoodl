/**
 * WF-001 WorkflowRegistry — persistence, strict validation, and the
 * refuse-to-start-on-invalid doctrine (a workflow that silently fails to load is
 * an automation that fails on a delay timer).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { WorkflowRegistry, WorkflowConfigError } from '../src/workflow/WorkflowRegistry';
import type { WorkflowStep } from '../src/workflow/types';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wf001-reg-'));
}

const steps = (): WorkflowStep[] => [
  { id: 'a', kind: 'call-function', ref: 'first', next: ['b'] },
  { id: 'b', kind: 'call-function', ref: 'second' }
];

describe('WF-001 WorkflowRegistry', () => {
  it('upserts, persists to disk, and reloads on a fresh registry', () => {
    const dir = tmp();
    try {
      const reg = new WorkflowRegistry(dir);
      const created = reg.upsert({ name: 'Pipeline', entry: 'a', steps: steps() });
      expect(created.id).toMatch(/^wf_/);
      expect(fs.existsSync(path.join(dir, 'workflow-defs', `${created.id}.workflow-def.json`))).toBe(true);

      const reg2 = new WorkflowRegistry(dir);
      const reloaded = reg2.get(created.id);
      expect(reloaded).not.toBeNull();
      expect(reloaded!.steps.length).toBe(2);
      expect(reloaded!.entry).toBe('a');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects an invalid definition (cycle) instead of persisting it', () => {
    const dir = tmp();
    try {
      const reg = new WorkflowRegistry(dir);
      expect(() =>
        reg.upsert({
          entry: 'a',
          steps: [
            { id: 'a', kind: 'call-function', ref: 'x', next: ['b'] },
            { id: 'b', kind: 'call-function', ref: 'y', next: ['a'] }
          ]
        })
      ).toThrow(WorkflowConfigError);
      expect(reg.list()).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refuses to start when a definition file on disk is invalid (loud)', () => {
    const dir = tmp();
    try {
      const defsDir = path.join(dir, 'workflow-defs');
      fs.mkdirSync(defsDir, { recursive: true });
      fs.writeFileSync(
        path.join(defsDir, 'broken.workflow-def.json'),
        JSON.stringify({ version: 1, id: 'broken', entry: 'nope', concurrency: 1, steps: [{ id: 'a', kind: 'call-function', ref: 'x' }], createdAt: '', updatedAt: '' })
      );
      expect(() => new WorkflowRegistry(dir)).toThrow(WorkflowConfigError);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('deletes a definition from memory and disk', () => {
    const dir = tmp();
    try {
      const reg = new WorkflowRegistry(dir);
      const created = reg.upsert({ id: 'keeper', entry: 'a', steps: steps() });
      expect(reg.delete(created.id)).toBe(true);
      expect(reg.get(created.id)).toBeNull();
      expect(fs.existsSync(path.join(dir, 'workflow-defs', 'keeper.workflow-def.json'))).toBe(false);
      expect(reg.delete('keeper')).toBe(false); // already gone
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
