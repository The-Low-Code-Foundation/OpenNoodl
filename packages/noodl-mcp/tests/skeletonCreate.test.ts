/**
 * LAS-012 §4 / F41 — the on-ramp that rejected its own output.
 *
 * `create_project` mints an `/App` + `/Pages/Home` skeleton. `create_plan` then
 * rejected a plan containing an operation creating `Pages/Home`: *"that
 * component already exists — use an update"*. Haiku and qwen each burned a turn
 * on it in session 6; sonnet did not. The `create_project` result **does** say a
 * Home skeleton was made, so this was knowledge given and dropped rather than
 * knowledge withheld — but the phase's standing rule is structure over gate, and
 * a create aimed at a page nobody has touched is an update by any reading that
 * matters.
 *
 * The coercion is deliberately narrow. It fires only for a component that is
 * still exactly `Page` + the placeholder `Text` this project writes, because the
 * failure mode on the other side — a plan that silently overwrote work because
 * the model said "create" — is a far worse turn than the one being saved. The
 * last two specs are that boundary.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { ProjectStore } from '../src/project/ProjectStore';
import { isUntouchedSkeletonPage, SKELETON_PLACEHOLDER_MARKER, writeProjectSkeleton } from '../src/tools/createProject';
import { call, connect, copyFixture, type TestSession } from './helpers';

interface CreatePlanResponse {
  planId: string;
  operations: Array<{ id: string; kind: string; target: string }>;
  absorbedCreates?: Array<{ id: string; target: string }>;
  absorbedNote?: string;
}

interface ErrorPayload {
  errors?: string[];
  message?: string;
}

describe('LAS-012 §4 — the predicate for "nobody has touched this page"', () => {
  const skeleton = [
    { type: 'Page', parameters: { title: 'Home', urlPath: 'home' } },
    { type: 'Text', parameters: { text: `Kiln & Co.${SKELETON_PLACEHOLDER_MARKER}` } }
  ];

  it('recognises exactly what writeProjectSkeleton writes', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'las012-skeleton-'));
    try {
      writeProjectSkeleton(dir, 'Kiln & Co.');
      const nodes = JSON.parse(fs.readFileSync(path.join(dir, 'components/Pages/Home/nodes.json'), 'utf8')).nodes;
      // The marker and the writer live in one file so a reworded placeholder
      // changes both at once. This spec is what proves they still agree.
      expect(isUntouchedSkeletonPage(nodes)).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('says no to a page with anything added, removed or rewritten', () => {
    expect(isUntouchedSkeletonPage([...skeleton, { type: 'Group', parameters: {} }])).toBe(false);
    expect(isUntouchedSkeletonPage([skeleton[0]])).toBe(false);
    expect(
      isUntouchedSkeletonPage([skeleton[0], { type: 'Text', parameters: { text: 'Welcome to our shop' } }])
    ).toBe(false);
    expect(isUntouchedSkeletonPage([])).toBe(false);
  });
});

describe('LAS-012 §4 — create_plan absorbs a create aimed at the skeleton', () => {
  let tmpRoot: string;
  let session: TestSession | undefined;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'las012-f41-'));
    writeProjectSkeleton(tmpRoot, 'Kiln & Co.');
    // Written by hand rather than by create_project so this suite does not
    // depend on a scoping conversation to reach the door it is about.
    new ProjectStore(tmpRoot);
  });

  afterEach(async () => {
    if (session) await session.close();
    session = undefined;
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('turns the rejected create into an update, and says it did', async () => {
    session = await connect(tmpRoot);
    const res = await call<CreatePlanResponse>(session, 'create_plan', {
      request: 'A storefront home page',
      operations: [
        { kind: 'create', target: 'Pages/Home', intent: 'The storefront landing page.' },
        { kind: 'create', target: 'Components/ProductCard', intent: 'One product.' }
      ]
    });

    // This is the whole finding: it used to be `isError: true`, "that component
    // already exists — use an update", one turn spent.
    expect(res.isError).toBe(false);
    const home = res.data.operations.find((op) => op.target === 'Pages/Home');
    expect(home?.kind).toBe('update');
    // Reported, never silent: the kind is not the one the caller asked for.
    expect(res.data.absorbedCreates).toEqual([{ id: home!.id, target: 'Pages/Home' }]);
    expect(res.data.absorbedNote).toContain('untouched project skeleton');

    // The sibling create is untouched — only the skeleton target is absorbed.
    expect(res.data.operations.find((op) => op.target === 'Components/ProductCard')?.kind).toBe('create');
  });

  it('still rejects a create over a page someone has built', async () => {
    // One extra node is enough: from here on the page is somebody's work, and a
    // coerced update would replace it without anyone asking.
    const file = path.join(tmpRoot, 'components/Pages/Home/nodes.json');
    const nodes = JSON.parse(fs.readFileSync(file, 'utf8'));
    nodes.nodes.push({ id: 'hero', type: 'Group', parent: nodes.nodes[0].id, parameters: {} });
    nodes.nodes[0].children = [...(nodes.nodes[0].children || []), 'hero'];
    fs.writeFileSync(file, JSON.stringify(nodes, null, 2));

    session = await connect(tmpRoot);
    const res = await call<ErrorPayload>(session, 'create_plan', {
      request: 'A storefront home page',
      operations: [{ kind: 'create', target: 'Pages/Home', intent: 'The storefront landing page.' }]
    });

    expect(res.isError).toBe(true);
    expect(JSON.stringify(res.data)).toContain('already exists');
  });

  it('leaves a create for a component that does not exist alone', async () => {
    session = await connect(tmpRoot);
    const res = await call<CreatePlanResponse>(session, 'create_plan', {
      request: 'A product card',
      operations: [{ kind: 'create', target: 'Components/ProductCard', intent: 'One product.' }]
    });

    expect(res.isError).toBe(false);
    expect(res.data.operations[0].kind).toBe('create');
    expect(res.data.absorbedCreates).toBeUndefined();
  });
});
