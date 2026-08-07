/**
 * AAQ-005 — the project-level effects an apply carries, on the external door.
 *
 * The editor's `applyAuthoredPlan` does four things in one undo group: writes
 * components, writes docs, registers pages, and applies the project settings the
 * plan agreed. This package's `apply_plan` did the first two. The other two are
 * not decorations — they are Layer 1's AAQ-001 and AAQ-003, the two findings
 * Richard reported as *"page router has no pages"* and *"any page created by AI
 * isn't scrollable"*, and an external agent got neither.
 *
 * Registration is covered in `pageRegistration.test.ts`. This file covers the
 * settings half, and the third effect — provisioning a backend — which used not
 * to port at all. AAQ-011/F13 gave it its own tool (`provision.test.ts`); what
 * is asserted here is that a plan still refuses it, and now says where to go.
 */
import * as fs from 'fs';
import * as path from 'path';

import type { ProjectV2File } from '../src/editor-deps';
import { call, connect, copyFixture, readJson, TestSession } from './helpers';

interface CreatePlanResponse {
  planId: string;
  operations: Array<{ id: string; kind: string; target: string }>;
  scroll?: 'page' | 'app';
}

interface ApplyPlanResponse {
  applied: Array<{ operation: string; target: string }>;
  settings?: string[];
}

interface ErrorPayload {
  error?: { code?: string; message?: string; details?: Record<string, unknown> };
}

const PAGE_NODES = [
  { id: 'ct_page', type: 'Page', parameters: { title: 'Catalogue', urlPath: 'catalogue' } },
  { id: 'ct_text', type: 'Text', parent: 'ct_page', parameters: { text: 'Catalogue' } }
];

function settings(dir: string): Record<string, unknown> {
  return (readJson<ProjectV2File>(dir, 'nodegx.project.json').settings ?? {}) as Record<string, unknown>;
}

/** Create a one-page plan, stage it, apply it. Returns the apply result. */
async function runPlan(session: TestSession, scroll?: 'page' | 'app') {
  const plan = await call<CreatePlanResponse>(session, 'create_plan', {
    request: 'Add a catalogue page',
    ...(scroll ? { scroll } : {}),
    operations: [{ kind: 'create', target: 'Pages/Catalogue', intent: 'The listing page' }]
  });
  await call(session, 'stage_plan_operation', {
    plan_id: plan.data.planId,
    operation_id: plan.data.operations[0].id,
    nodes: PAGE_NODES
  });
  return call<ApplyPlanResponse>(session, 'apply_plan', { plan_id: plan.data.planId });
}

describe('AAQ-005 — project effects of an applied plan', () => {
  let dir: string;
  let session: TestSession;

  beforeEach(async () => {
    dir = copyFixture();
    session = await connect(dir);
  });

  afterEach(async () => {
    await session.close();
  });

  describe('AAQ-003 — the app the plan builds scrolls', () => {
    it('turns bodyScroll on for a page-scrolling app', async () => {
      const applied = await runPlan(session, 'page');

      expect(applied.isError).toBe(false);
      expect(settings(dir).bodyScroll).toBe(true);
      expect(applied.data.settings).toEqual(['bodyScroll']);
    });

    it('records the decision even when it is the falsy one', async () => {
      // ⚠️ The whole defect lives in this asymmetry: unset is falsy is 'app', so
      // "nobody decided" and "decided app" are indistinguishable on disk unless
      // the deciding is written down. An app plan must therefore still write.
      const applied = await runPlan(session, 'app');

      expect(settings(dir).bodyScroll).toBe(false);
      expect(applied.data.settings).toEqual(['bodyScroll']);
    });

    it('says nothing about scrolling when the plan did not', async () => {
      const applied = await runPlan(session);

      expect(applied.isError).toBe(false);
      expect(settings(dir).bodyScroll).toBeUndefined();
      expect(applied.data.settings).toBeUndefined();
    });

    it('never overwrites a setting the project already made', async () => {
      // The editor's rule, verbatim: a plan states what a NEW app needs, not
      // what an existing one should have chosen.
      const project = readJson<ProjectV2File>(dir, 'nodegx.project.json');
      fs.writeFileSync(
        path.join(dir, 'nodegx.project.json'),
        JSON.stringify({ ...project, settings: { ...project.settings, bodyScroll: false } }, null, 2)
      );

      const applied = await runPlan(session, 'page');

      expect(applied.isError).toBe(false);
      expect(settings(dir).bodyScroll).toBe(false);
      expect(applied.data.settings).toBeUndefined();
    });

    it('leaves the other settings of the project alone', async () => {
      await runPlan(session, 'page');

      expect(settings(dir).htmlTitle).toBe('Demo App');
      expect(settings(dir).navigationPathType).toBe('path');
    });
  });

  describe('AAQ-005 / AAQ-011 F13 — provision is one vocabulary, and it has its own tool', () => {
    it('refuses a provision operation with the reason, not a schema rejection', async () => {
      const res = await call<ErrorPayload>(session, 'create_plan', {
        request: 'Build a shop with a backend',
        operations: [
          { kind: 'provision', target: 'App backend', intent: 'Products and orders' },
          { kind: 'create', target: 'Pages/Shop', intent: 'The shop page' }
        ]
      });

      expect(res.isError).toBe(true);
      expect(res.data.error?.code).toBe('invalid-argument');
      // F13: the capability exists now, so the refusal is about WHERE it lives —
      // a plan is all-or-nothing and discardable, and a spawned process is not.
      expect(res.data.error?.message).toContain('provision_backend');
      expect(res.data.error?.details?.use).toBe('provision_backend');
      expect(res.data.error?.details?.unsupportedOperations).toEqual(['App backend']);
    });

    it('still accepts the three kinds it can execute', async () => {
      const res = await call<CreatePlanResponse>(session, 'create_plan', {
        request: 'Add a page',
        operations: [{ kind: 'create', target: 'Pages/Shop', intent: 'The shop page' }]
      });

      expect(res.isError).toBe(false);
      expect(res.data.operations).toHaveLength(1);
    });
  });
});
