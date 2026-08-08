/**
 * LAS-007 — push, not pull: the recipe arrives inside the rejection.
 *
 * Haiku's 42-turn cold replay called `list_examples`, `get_example` and the
 * project docs **zero times**, including across the seven turns it spent stuck
 * on validation rejections that two of the recipes answer exactly. Advice to
 * retrieve is dead weight; attachment works. These specs pin that the
 * attachment happens, that it is bounded, and — the one the task asks for by
 * name — that the table cannot go stale in silence.
 *
 * ⚠️ The recipes this table attaches were themselves broken until this task.
 * All three `ui-*` composition examples declared their `Component Inputs` ports
 * `plug: "input"`, which is backwards (LAS-001's inversion: a component INPUT is
 * a port plugged "output"). Attaching one to an interface rejection would have
 * taught the agent the exact defect it was being refused for. `catalog:examples`
 * reported 57/57 clean throughout because it ran the `rules/` validator only and
 * its project mapping discarded `plug` before any check could see it — the F14
 * shape, in the gate written to keep the recipes honest. Both are fixed; the
 * last spec here is the tripwire.
 */
import * as fs from 'fs';

import { call, connect, copyFixture, TestSession } from './helpers';
import { DIAGNOSTIC_EXAMPLES } from '../src/editor-deps';
import { getExample } from '../src/catalog';

interface AttachedRecipe {
  code: string;
  exampleId: string;
  title: string;
  why: string;
  fragment?: Array<{ name: string; nodes: unknown[] }>;
  note?: string;
}

interface RejectionPayload {
  error: {
    details: {
      readable: string[];
      examples?: { note: string; recipes: AttachedRecipe[] };
    };
  };
}

/**
 * A card instantiated four times with parameters, whose component declares no
 * Component Inputs. Haiku's exact shape, and the one F2 is about.
 */
const DEAD_CARD_PAGE = [
  { id: 'page', type: 'Page', parameters: { title: 'Shop' } },
  { id: 'row', type: 'Group', parent: 'page' },
  { id: 'c1', type: '/Components/Dead', parent: 'row', parameters: { name: 'A', price: '1' } },
  { id: 'c2', type: '/Components/Dead', parent: 'row', parameters: { name: 'B', price: '2' } }
];

describe('LAS-007 — the table is checked, not trusted', () => {
  it('every example id in DIAGNOSTIC_EXAMPLES exists in the catalog', () => {
    const missing: string[] = [];
    for (const entry of DIAGNOSTIC_EXAMPLES) {
      for (const id of entry.examples) {
        if (!getExample(id)) missing.push(`${entry.code} → ${id}`);
      }
    }
    // The task's own acceptance line: an entry naming a nonexistent example id
    // must fail the suite rather than attaching nothing at run time.
    expect(missing).toEqual([]);
  });

  it('every attached recipe declares a working interface — the defect this task found', () => {
    // A recipe that teaches `plug: "input"` on a Component Inputs node teaches
    // the thing the interface gate refuses. All three ui-* recipes did.
    const backwards: string[] = [];
    for (const entry of DIAGNOSTIC_EXAMPLES) {
      for (const id of entry.examples) {
        const example = getExample(id);
        if (!example) continue;
        for (const component of example.components) {
          for (const node of component.nodes as Array<{ type?: string; ports?: Array<{ name?: string; plug?: string }> }>) {
            if (node.type !== 'Component Inputs') continue;
            for (const port of node.ports ?? []) {
              if (port.plug !== undefined && !String(port.plug).includes('output')) {
                backwards.push(`${id}:${component.name}:${port.name} is plugged "${port.plug}"`);
              }
            }
          }
        }
      }
    }
    expect(backwards).toEqual([]);
  });
});

describe('LAS-007 — the recipe arrives inside the rejection', () => {
  let dir: string;
  let session: TestSession;

  beforeEach(async () => {
    dir = copyFixture();
    session = await connect(dir);
    // The interface-less component the page below instantiates.
    const res = await call(session, 'create_component', {
      path: 'Components/Dead',
      nodes: [
        { id: 'root', type: 'Group' },
        { id: 'label', type: 'Text', parent: 'root', parameters: { text: 'Text' } }
      ],
      visual_roots: ['root']
    });
    expect(res.isError).toBe(false);
  });

  afterEach(async () => {
    await session.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('attaches the Component-Inputs recipe, with its graph, to an interface rejection', async () => {
    const res = await call<RejectionPayload>(session, 'create_component', {
      path: 'Pages/Shop',
      nodes: DEAD_CARD_PAGE,
      visual_roots: ['page']
    });

    expect(res.isError).toBe(true);
    const attached = res.data.error.details.examples;
    expect(attached).toBeDefined();
    const recipe = attached!.recipes.find((r) => r.code === 'interfaceless-instance');
    expect(recipe).toBeDefined();
    expect(recipe!.exampleId).toBe('ui-stat-tile-row');
    expect(recipe!.why).toContain('plugged "output"');

    // The graph itself, on the first rejection of this code. And it must show
    // both halves: the interface, and an instance setting it.
    expect(recipe!.fragment).toBeDefined();
    const json = JSON.stringify(recipe!.fragment);
    expect(json).toContain('"Component Inputs"');
    expect(json).toContain('"plug":"output"');
    expect(json).toContain('/Components/StatTile');
    // Canvas coordinates are stripped — a fragment is meant to be read.
    expect(json).not.toContain('"x":');
  });

  it('sends the fragment once per session, then cites the id', async () => {
    const first = await call<RejectionPayload>(session, 'create_component', {
      path: 'Pages/ShopA',
      nodes: DEAD_CARD_PAGE,
      visual_roots: ['page']
    });
    expect(first.isError).toBe(true);
    expect(first.data.error.details.examples!.recipes[0].fragment).toBeDefined();

    const second = await call<RejectionPayload>(session, 'create_component', {
      path: 'Pages/ShopB',
      nodes: DEAD_CARD_PAGE,
      visual_roots: ['page']
    });
    expect(second.isError).toBe(true);
    const repeat = second.data.error.details.examples!.recipes[0];
    // A stuck repair loop must not be re-sent the same 3 KB every turn.
    expect(repeat.fragment).toBeUndefined();
    expect(repeat.note).toContain('get_example("ui-stat-tile-row")');
    expect(repeat.exampleId).toBe('ui-stat-tile-row');
  });

  it('attaches the two Columns modes to a layoutString rejection, and nothing to an unrelated value error', async () => {
    const columns = await call<RejectionPayload>(session, 'create_component', {
      path: 'Pages/Grid',
      nodes: [
        { id: 'page', type: 'Page', parameters: { title: 'Grid' } },
        {
          id: 'cols',
          type: 'net.noodl.visual.columns',
          parent: 'page',
          // The exact string haiku shipped, which silently renders one column.
          parameters: { layoutString: '1fr 1fr 1fr 1fr' }
        }
      ],
      visual_roots: ['page']
    });

    expect(columns.isError).toBe(true);
    const ids = columns.data.error.details.examples!.recipes.map((r) => r.exampleId);
    expect(ids).toContain('vis-columns-media-cards');
    expect(ids).toContain('ui-card-grid-repeater');
  });

  it('says nothing when no table entry matches — a door that always speaks is unread', async () => {
    const res = await call<RejectionPayload>(session, 'create_component', {
      path: 'Pages/Typo',
      nodes: [
        { id: 'page', type: 'Page', parameters: { title: 'Typo' } },
        { id: 'oops', type: 'NoSuchNodeTypeAtAll', parent: 'page' }
      ],
      visual_roots: ['page']
    });

    expect(res.isError).toBe(true);
    expect(res.data.error.details.examples).toBeUndefined();
  });
});

describe('LAS-007 §3 — the traps are pushed, not offered', () => {
  it('get_project_info leads with them on a read-write server, and omits them read-only', async () => {
    const dir = copyFixture();
    const rw = await connect(dir, true);
    const info = await call<{ authoringTraps?: string; authoringDoctrine?: string }>(rw, 'get_project_info');
    expect(info.data.authoringTraps).toContain('Component Inputs');
    expect(info.data.authoringTraps).toContain('plugged "output"');
    expect(info.data.authoringTraps).toContain('Static Data');
    expect(info.data.authoringTraps).toContain('render_report');
    await rw.close();

    const ro = await connect(dir, false);
    const roInfo = await call<{ authoringTraps?: string }>(ro, 'get_project_info');
    expect(roInfo.data.authoringTraps).toBeUndefined();
    await ro.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('LAS-007 §2 — a cited example says which one is worth the call', () => {
  it('get_node_type returns titles, not bare ids', async () => {
    const dir = copyFixture();
    const session = await connect(dir);
    const res = await call<{ types: Array<{ examples?: Array<{ id: string; title: string }> }> }>(
      session,
      'get_node_type',
      { type_names: ['Component Inputs'] }
    );

    expect(res.isError).toBe(false);
    const examples = res.data.types[0].examples ?? [];
    expect(examples.length).toBeGreaterThan(0);
    for (const e of examples) {
      expect(typeof e.id).toBe('string');
      expect(e.title.length).toBeGreaterThan(10);
    }
    await session.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
