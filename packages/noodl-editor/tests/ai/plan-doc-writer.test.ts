/**
 * AIX-011 criterion 7 — the plan's doc write path, on real files.
 *
 * The stateful-fake spec in `authoring-plan-staging.test.ts` pins the SHAPE
 * (the write records into the caller's undo group; one undo reverts it with the
 * components). These pin the behaviour that only a filesystem can show: bytes
 * actually land, undo puts the previous bytes back, undo of a created file
 * deletes it again, and a document that changed under the review is refused
 * rather than clobbered.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import type { AppliedPlanDocOperation } from '../../src/editor/src/models/AiAssistant/authoring/planStaging';
import { createPlanDocWriter } from '../../src/editor/src/models/ProjectDocs/PlanDocWriter';
import { ProjectDocsModel } from '../../src/editor/src/models/ProjectDocs/ProjectDocsModel';
import { UndoActionGroup, UndoQueue } from '../../src/editor/src/models/undo-queue-model';
import { expectRejection } from './helpers';

const BASELINE = '# Architecture\n\nThe app is a reading list.\n';
const PROPOSED = `${BASELINE}\n## Checkout\n\nCheckout is a page so the back button behaves.\n`;

function docOp(baseline: string | null, proposed = PROPOSED): AppliedPlanDocOperation {
  return {
    kind: 'doc',
    operation: { id: 'op-1', kind: 'doc', target: 'docs/ARCHITECTURE.md', intent: 'record checkout' },
    proposed,
    baseline
  };
}

/** Undo/redo write asynchronously (the platform filesystem has no sync write). */
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

describe('AIX-011 criterion 7 — createPlanDocWriter on real files', () => {
  let dir: string;
  let docs: ProjectDocsModel;
  const file = () => path.join(dir, 'docs', 'ARCHITECTURE.md');
  const read = () => fs.readFileSync(file(), 'utf8');

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aix011-docwriter-'));
    docs = new ProjectDocsModel(dir);
    UndoQueue.instance.clear();
  });

  afterEach(() => {
    docs.dispose();
    UndoQueue.instance.clear();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes the proposed file, and one undo restores the previous bytes exactly', async () => {
    await docs.write('docs/ARCHITECTURE.md', BASELINE, {});
    const writer = createPlanDocWriter(docs)!;
    const group = new UndoActionGroup({ label: 'plan' });

    await writer.preflight!(docOp(BASELINE));
    await writer.apply(docOp(BASELINE), group);
    expect(read()).toBe(PROPOSED);

    UndoQueue.instance.push(group);
    expect(UndoQueue.instance.getHistory().length).toBe(1);
    UndoQueue.instance.undo();
    await settle();
    expect(read()).toBe(BASELINE);

    UndoQueue.instance.redo();
    await settle();
    expect(read()).toBe(PROPOSED);
  });

  it('undo of a doc the plan CREATED deletes it again, rather than leaving an empty file', async () => {
    const writer = createPlanDocWriter(docs)!;
    const group = new UndoActionGroup({ label: 'plan' });

    await writer.apply(docOp(null), group);
    expect(fs.existsSync(file())).toBe(true);

    UndoQueue.instance.push(group);
    UndoQueue.instance.undo();
    await settle();
    expect(fs.existsSync(file())).toBe(false);
  });

  it('refuses in preflight when the file changed while the plan was being reviewed', async () => {
    await docs.write('docs/ARCHITECTURE.md', BASELINE, {});
    const writer = createPlanDocWriter(docs)!;
    // The user edits it in VS Code between the doc turn and the apply click.
    fs.writeFileSync(file(), '# Architecture\n\nEdited by hand.\n');

    const error = await expectRejection(async () => writer.preflight!(docOp(BASELINE)));
    expect(error.message).toContain('changed on disk');
    expect(read()).toBe('# Architecture\n\nEdited by hand.\n');
  });

  it('refuses a target outside docs/ — the same containment as every other doc write', async () => {
    const writer = createPlanDocWriter(docs)!;
    const escaping: AppliedPlanDocOperation = {
      ...docOp(null),
      operation: { id: 'op-1', kind: 'doc', target: '../../.ssh/config', intent: 'nope' }
    };
    const onPreflight = await expectRejection(async () => writer.preflight!(escaping));
    expect(onPreflight.message).toContain('outside docs');
    const onApply = await expectRejection(async () =>
      writer.apply(escaping, new UndoActionGroup({ label: 'plan' }))
    );
    expect(onApply.message).toContain('outside docs');
  });

  it('is undefined when the project has no folder — the caller then refuses doc operations loudly', () => {
    expect(createPlanDocWriter(undefined)).toBeUndefined();
  });
});
