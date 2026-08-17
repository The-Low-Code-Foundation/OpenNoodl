/**
 * CN-009 — the MCP surface for kits, inside the budget.
 *
 * ## What CN-003 already did, and what was left
 *
 * `list_node_types` and `get_node_type` read the **merged** catalog document, so
 * a project's kit types have been in their answers since CN-003. Measured
 * against the real cashflow project on 2026-08-17, before any change here:
 * `list_node_types` returned all five `nodegx.cashflow.*` types and
 * `get_node_type('nodegx.cashflow.Pill')` returned **23 inputs / 14 outputs** —
 * exactly the counts CN-009's acceptance criterion 2 names. **AC2 was met on
 * arrival**, and this suite pins it rather than claiming it.
 *
 * Two things were not, and both are silent rather than broken:
 *
 * 1. 🔴 **No provenance reached any answer.** The overlay carries `providedBy`
 *    and `kitModule` on every kit node; both projections dropped them, so an
 *    agent could not tell an author's node from a shipped one. ✅ **D1** makes
 *    that a first-class fact.
 * 2. 🔴 **The author's own `docs` sentence was dropped**, because `summary` was
 *    read from `enrichment`, which is generated at repo-build time and keyed by
 *    type name — **a kit type can never be in it**. So a kit node reached the
 *    agent with a name, a port list and no statement of what it is for; and
 *    since `list_node_types`' `query` searches the summary, the kit had no
 *    free-text handle either. Measured on the cashflow kit before the fix:
 *    `query: "draggable"` → **[]** and `query: "snaps to whole days"` → **[]**,
 *    against a `Money Pill` whose `docs` reads *"A draggable money pill that
 *    snaps to whole days…"*. After: both return `nodegx.cashflow.Pill`.
 *
 * ⚠️ **This is the same defect s16 fixed editor-side** (CN-008 finding 3). It
 * was two bugs, one per consumer, because the two read different enrichment
 * sources — not one bug reachable from two places.
 *
 * ## Why the assertions run on fixtures and the numbers above came from cashflow
 *
 * 🔴 The cashflow kit lives **outside this repo** (`NodeGX test
 * projects/cashflow-command-centre`), under no gate and in no checkout — a suite
 * that read it would pass on this machine and fail everywhere else. So the
 * cashflow figures are *recorded measurements* in the task notes, and every
 * assertion here runs against `tests/fixtures/kit-app` and
 * `tests/fixtures/kit-hazards`, which are versioned and reproduce the shape.
 *
 * ## The control that can actually fail
 *
 * ⚠️ `docs` is one field over two vocabularies: prose on a kit node, a **URL**
 * on a shipped one (158 of 175 built-ins carry one; 158 of 158 are
 * `https://docs.noodl.net/…`). "No built-in shows a URL as its summary" is
 * therefore a test that **cannot fail today** — all 175 built-ins have an
 * `enrichment.summary`, so the fallback is never reached for them whether it is
 * gated or not. A green there would be evidence of nothing. The real control is
 * `a non-kit node with a docs URL and no enrichment` below: it is constructed so
 * the fallback *would* fire, and it fails the moment the provenance gate is
 * removed.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  getNodeTypeDetail,
  getNodeTypeSummary,
  listNodeTypes,
  setCatalogOverlay,
  type NodeTypeDetail,
  type NodeTypeSummary
} from '../src/catalog';
import { clearProjectOverlay, extractProjectOverlay } from '../src/kitOverlay';
import type { OverlayCatalogNode } from '@nodegx/kit-catalog';
import { buildKitExtractor, call, connect, type TestSession } from './helpers';

const FIXTURES = path.join(__dirname, 'fixtures');
const KIT_APP = path.join(FIXTURES, 'kit-app');
const KIT_HAZARDS = path.join(FIXTURES, 'kit-hazards');

let tempDir: string;

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cn009-'));
  process.env.NODEGX_KIT_EXTRACT = await buildKitExtractor(tempDir);
}, 120_000);

afterAll(() => {
  delete process.env.NODEGX_KIT_EXTRACT;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

afterEach(() => clearProjectOverlay());

/** Extract a fixture project and make it the catalog's overlay. */
function overlay(projectDir: string): OverlayCatalogNode[] {
  const extracted = extractProjectOverlay(projectDir);
  expect({ dir: path.basename(projectDir), failures: extracted.failures.map((f) => f.kitModule) }).toEqual({
    dir: path.basename(projectDir),
    // `kit-hazards` ships a kit that throws on purpose; `kit-app` must be clean.
    failures: path.basename(projectDir) === 'kit-hazards' ? ['Throwing Kit'] : []
  });
  setCatalogOverlay(extracted.nodes);
  return extracted.nodes;
}

function detail(typeName: string): NodeTypeDetail {
  const d = getNodeTypeDetail(typeName);
  if ('error' in d) throw new Error(`${typeName}: ${d.error}`);
  return d;
}

function summary(typeName: string): NodeTypeSummary {
  const s = getNodeTypeSummary(typeName);
  if ('error' in s) throw new Error(`${typeName}: ${s.error}`);
  return s;
}

/**
 * A catalog-shaped node built by hand, for the two cases no real kit produces.
 *
 * ⚠️ Hand-built deliberately. Both controls below need a node the fixtures
 * cannot give — one whose `providedBy` is *not* `project-kit` while it still
 * carries a `docs` field, and one whose `docs` is blank rather than absent. Every
 * shipped node has an `enrichment.summary` and every fixture kit writes real
 * prose, so with fixtures alone neither branch is ever taken and both controls
 * would pass against a completely ungated implementation.
 */
function kitNode(over: Partial<OverlayCatalogNode> & { typeName: string }): OverlayCatalogNode {
  return {
    displayName: over.typeName,
    category: 'Visual',
    isVisual: true,
    isDeprecated: false,
    inNodePicker: true,
    availableIn: ['browser'],
    providedBy: 'project-kit',
    kitModule: 'Control Kit',
    inputs: [],
    outputs: [],
    dynamicPorts: null,
    parameterEncoding: { known: false, reason: 'control fixture' },
    ...over
  } as unknown as OverlayCatalogNode;
}

describe('CN-009 AC1 — list_node_types marks whose node it is', () => {
  it('every kit row carries its provenance and the kit that declared it', () => {
    overlay(KIT_APP);

    const kitRows = listNodeTypes({}).filter((r) => r.typeName.startsWith('demo.kit.'));
    expect(
      kitRows.map((r) => ({ typeName: r.typeName, providedBy: r.providedBy, kitModule: r.kitModule }))
    ).toEqual([
      { typeName: 'demo.kit.Badge', providedBy: 'project-kit', kitModule: 'Demo Kit' },
      { typeName: 'demo.kit.Meter', providedBy: 'project-kit', kitModule: 'Demo Kit' }
    ]);
  });

  it('and two kits in one project are told apart, not merged', () => {
    // ⚠️ A fixture of one kit cannot see a collapse: a bug that stamped every
    // row with the *first* kit's name would pass the test above. `kit-hazards`
    // carries three kits, one of which throws.
    overlay(KIT_HAZARDS);

    const byModule = new Map<string, string[]>();
    for (const r of listNodeTypes({}).filter((r) => r.providedBy === 'project-kit')) {
      byModule.set(r.kitModule!, [...(byModule.get(r.kitModule!) ?? []), r.typeName]);
    }
    // Shadow Kit's only type collides with a built-in and is reported rather
    // than merged (CN-003), so it contributes no row — the kit that survives is
    // named, and it is named correctly.
    expect([...byModule.entries()].sort()).toEqual([['Working Kit', ['demo.kit.Survivor']]]);
  });

  it('🔴 CONTROL — the built-ins are untouched: not one gains a provenance field', () => {
    overlay(KIT_APP);

    const marked = listNodeTypes({ includeHidden: true }).filter((r) => !r.typeName.startsWith('demo.kit.'));
    expect({
      builtinsListed: marked.length > 100,
      withProvidedBy: marked.filter((r) => r.providedBy !== undefined).map((r) => r.typeName),
      withKitModule: marked.filter((r) => r.kitModule !== undefined).map((r) => r.typeName)
    }).toEqual({ builtinsListed: true, withProvidedBy: [], withKitModule: [] });
  });
});

describe("CN-009 — the kit author's own sentence reaches the agent", () => {
  it('get_node_type carries `docs` as the summary, in both detail modes', () => {
    overlay(KIT_APP);

    // Both modes, because `summary` is the *default* — provenance and purpose
    // that only survive `detail: "full"` are absent from almost every real call.
    expect({
      full: detail('demo.kit.Badge').summary,
      summary: summary('demo.kit.Badge').summary
    }).toEqual({
      full: 'A labelled badge that can show a percentage.',
      summary: 'A labelled badge that can show a percentage.'
    });

    expect({
      providedBy: summary('demo.kit.Meter').providedBy,
      kitModule: summary('demo.kit.Meter').kitModule,
      summary: summary('demo.kit.Meter').summary
    }).toEqual({
      providedBy: 'project-kit',
      kitModule: 'Demo Kit',
      summary: 'A horizontal meter. Outputs the fraction it is filled to, as a percentage.'
    });
  });

  it('list_node_types query matches the docs prose, not only the name', () => {
    overlay(KIT_APP);

    const q = (needle: string) =>
      listNodeTypes({ query: needle })
        .map((r) => r.typeName)
        .filter((t) => t.startsWith('demo.kit.'));

    // 🔴 The regression this pins. Before the fix each of these returned [] —
    // the words are in `docs` and nowhere else. "badge" is the beside-it
    // known-firing signal: it matched before and must still match, so a fix that
    // broke ordinary name search would be caught here rather than by a user.
    expect({
      percentage: q('percentage'),
      'fraction it is filled': q('fraction it is filled'),
      badge: q('badge')
    }).toEqual({
      percentage: ['demo.kit.Badge', 'demo.kit.Meter'],
      'fraction it is filled': ['demo.kit.Meter'],
      badge: ['demo.kit.Badge']
    });
  });

  it("the kit's name is a search handle the type name does not carry", () => {
    overlay(KIT_APP);
    // `demo.kit.Badge` does not contain the string "Demo Kit".
    expect(listNodeTypes({ query: 'Demo Kit' }).map((r) => r.typeName)).toEqual([
      'demo.kit.Badge',
      'demo.kit.Meter'
    ]);
  });

  it('⚠️ absent docs is an omission, never an empty summary', () => {
    overlay(KIT_HAZARDS);
    // `demo.kit.Survivor` declares no `docs`. Provenance still arrives — the two
    // facts are independent, and a node with nothing said about it must not
    // reach the agent carrying `summary: ""`.
    const s = summary('demo.kit.Survivor');
    expect({ providedBy: s.providedBy, hasSummaryKey: 'summary' in s }).toEqual({
      providedBy: 'project-kit',
      hasSummaryKey: false
    });
  });

  it('⚠️ and so is a docs string that is only whitespace', () => {
    // Found by mutating: every fixture kit either writes real prose or omits the
    // key, so `docs: "   "` was reachable and unasserted — `summaryOf` returning
    // the trimmed value unconditionally survived the whole suite. An author who
    // leaves the scaffold's field blank is the ordinary way to get here, and
    // `summary: ""` reads to an agent as "this node is documented, and the
    // documentation is nothing".
    setCatalogOverlay([kitNode({ typeName: 'zzz.control.Blank', docs: '   \n  ' })]);
    const d = detail('zzz.control.Blank');
    // 🔴 The listing row is the half that can actually break, and asserting only
    // the detail is why the first version of this test was an equivalent mutant.
    // `getNodeTypeDetail` writes the summary behind `if (summary)`, so a
    // `summaryOf` that returned `""` would still be invisible there — while
    // `listNodeTypes` assigns it unconditionally and would ship `summary: ""` on
    // the row. The guard has to live in `summaryOf`, and this is what says so.
    const row = listNodeTypes({}).find((r) => r.typeName === 'zzz.control.Blank');
    expect({
      detailHasSummaryKey: 'summary' in d,
      rowSummary: row?.summary,
      providedBy: d.providedBy
    }).toEqual({ detailHasSummaryKey: false, rowSummary: undefined, providedBy: 'project-kit' });
  });

  it('🔴 CONTROL — a non-kit node with a docs URL and no enrichment gets NO summary', () => {
    // The control that can fail. Every shipped node has an `enrichment.summary`,
    // so the built-ins can never exercise the fallback and their green proves
    // nothing. This node is shaped like the hazard the gate exists for: a `docs`
    // field holding a docs.noodl.net URL, no enrichment, and a `providedBy` that
    // is not `project-kit`. Ungate `summaryOf` and this test reports the URL.
    setCatalogOverlay([
      kitNode({
        typeName: 'zzz.control.NotAKit',
        displayName: 'Not A Kit',
        providedBy: 'noodl-runtime' as OverlayCatalogNode['providedBy'],
        kitModule: 'should-not-be-read',
        docs: 'https://docs.noodl.net/nodes/logic/and'
      })
    ]);

    const d = detail('zzz.control.NotAKit');
    expect({
      summary: d.summary,
      providedBy: d.providedBy,
      matchedByItsUrl: listNodeTypes({ query: 'docs.noodl.net' }).map((r) => r.typeName)
    }).toEqual({ summary: undefined, providedBy: undefined, matchedByItsUrl: [] });
  });
});

describe('CN-009 AC4 — a project with no kits is unchanged', () => {
  it('no row and no detail acquires a kit field, across the whole catalog', () => {
    clearProjectOverlay();

    const rows = listNodeTypes({ includeHidden: true });
    expect({
      rows: rows.length > 150,
      withProvidedBy: rows.filter((r) => r.providedBy !== undefined).length,
      withKitModule: rows.filter((r) => r.kitModule !== undefined).length,
      // 🔴 The half that matters: every row's summary is still its enrichment
      // summary. 158 of these carry a `docs` URL, so an ungated fallback would
      // change the *content* of rows without adding a key — a change no
      // key-counting assertion above would see.
      summariesFromDocs: rows.filter((r) => (r.summary ?? '').startsWith('http')).length
    }).toEqual({ rows: true, withProvidedBy: 0, withKitModule: 0, summariesFromDocs: 0 });
  });

  it('and a built-in still answers exactly as it did', () => {
    clearProjectOverlay();
    const and = detail('And');
    expect({
      summaryIsProse: !and.summary?.startsWith('http'),
      hasSummary: typeof and.summary === 'string' && and.summary.length > 0,
      providedBy: and.providedBy,
      kitModule: and.kitModule
    }).toEqual({ summaryIsProse: true, hasSummary: true, providedBy: undefined, kitModule: undefined });
  });
});

describe('CN-009 AC5 — the caller, built', () => {
  /**
   * "Drive a real MCP session that discovers a kit node it was not told about
   * and places it."
   *
   * ⚠️ **This is the mechanism half, and AC5 says so itself**: *"Tool output
   * changing shape is the mechanism; an agent successfully using an unfamiliar
   * node is the consequence."* What runs below is a real server over the real
   * protocol, and the discovery path is the one a model has — but the choice to
   * search for "percentage" is mine, not a model's. The consequence half needs a
   * live model and is recorded as not met.
   *
   * What it is nonetheless worth: every step here is a step a model must take in
   * order, and this phase has repeatedly found that the step nobody built the
   * caller for is the broken one (CN-006's mid-session overlay, CN-008's
   * selector). The chain is: **know nothing → find by subject → learn whose it
   * is → read its ports → place it → have the validator agree.**
   */
  let dir: string;
  let session: TestSession;

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cn009-drive-'));
    fs.cpSync(KIT_APP, dir, { recursive: true });
    session = await connect(dir, true);
  });

  afterEach(async () => {
    await session.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('a session told nothing about the kit finds the node, learns whose it is, and places it', async () => {
    // 1. Find it by *subject*. "percentage" is in the kit's `docs` and in
    //    neither type name nor display name — before this task the search
    //    returned nothing and the node was reachable only by already knowing it
    //    existed, which is not discovery.
    const found = await call<{ nodeTypes: Array<Record<string, unknown>> }>(session, 'list_node_types', {
      query: 'percentage'
    });
    expect(found.isError).toBe(false);
    const meter = found.data.nodeTypes.find((r) => r.typeName === 'demo.kit.Meter');

    // 2. The row itself says whose node this is — the fact D1 exists for, and
    //    the one that tells a caller this type will not be in any public docs.
    expect(meter).toMatchObject({
      typeName: 'demo.kit.Meter',
      providedBy: 'project-kit',
      kitModule: 'Demo Kit',
      summary: 'A horizontal meter. Outputs the fraction it is filled to, as a percentage.'
    });

    // 3. Read its ports, the same call a built-in takes.
    const doc = await call<{ types: Array<{ ports?: string[]; providedBy?: string }> }>(session, 'get_node_type', {
      type_names: ['demo.kit.Meter']
    });
    expect(doc.isError).toBe(false);
    const ports = doc.data.types[0].ports ?? [];
    expect(doc.data.types[0].providedBy).toBe('project-kit');
    // A port learned from the answer, not from the fixture source — if the doc
    // did not carry it, the placement below could not have been written.
    const valuePort = ports.find((p) => p.startsWith('in value:'));
    expect(valuePort).toBeDefined();

    // 4. Place it, setting the port that answer named.
    const created = await call<{ created: string; validation: { summary: { errors: number; warnings: number } } }>(
      session,
      'create_component',
      {
        path: 'Pages/KitDrive',
        nodes: [
          { id: 'page', type: 'Page' },
          { id: 'meter', type: 'demo.kit.Meter', parent: 'page', parameters: { value: 42 } }
        ],
        description: 'CN-009 AC5 — placing a kit node discovered through the tool surface'
      }
    );

    // 5. The validator agrees — and it is checking the node rather than skipping
    //    it, which is ✅ D4 via CN-003/CN-004.
    expect({
      isError: created.isError,
      created: created.data.created,
      errors: created.data.validation?.summary?.errors
    }).toEqual({ isError: false, created: 'Pages/KitDrive', errors: 0 });
    expect(fs.existsSync(path.join(dir, 'components', 'Pages', 'KitDrive', 'nodes.json'))).toBe(true);
  });

  it('🔴 CONTROL — the same placement with a mistyped port is still refused', () => {
    // Without this, "the validator agreed" above is indistinguishable from "the
    // validator had nothing to say about a type it does not know" — the exact
    // state CN-002 found and the reason a clean pass on a kit node is not
    // self-evidently good news. Asserted through the same door.
    return call<{
      error?: { code?: string; details?: { newErrors?: Array<{ code?: string; location?: { nodeType?: string; port?: string }; suggestion?: string }> } };
    }>(session, 'create_component', {
      path: 'Pages/KitDriveBroken',
      nodes: [
        { id: 'page', type: 'Page' },
        { id: 'meter', type: 'demo.kit.Meter', parent: 'page', parameters: { vlaue: 42 } }
      ]
    }).then((res) => {
      // 🔴 The diagnostic, not just the refusal. A bare `isError: true` would be
      // satisfied by a rejection for any reason at all — a malformed page, a
      // registry clash — and would read as "the kit node was checked" while
      // proving nothing about the kit node. This says which node, which port,
      // and that the check knew the right spelling.
      const first = res.data.error?.details?.newErrors?.[0];
      expect({
        isError: res.isError,
        code: first?.code,
        nodeType: first?.location?.nodeType,
        port: first?.location?.port,
        suggestion: first?.suggestion,
        onDisk: fs.existsSync(path.join(dir, 'components', 'Pages', 'KitDriveBroken'))
      }).toEqual({
        isError: true,
        code: 'unknown-parameter',
        nodeType: 'demo.kit.Meter',
        port: 'vlaue',
        suggestion: 'value',
        onDisk: false
      });
    });
  });
});

describe('CN-009 AC2 — a kit node answers at built-in fidelity', () => {
  it('every declared port arrives, in both modes', () => {
    const nodes = overlay(KIT_APP);
    const badge = nodes.find((n) => n.typeName === 'demo.kit.Badge')!;

    const d = detail('demo.kit.Badge');
    // Against the *overlay's* own counts rather than a hand-copied number: the
    // claim is "no reduced-fidelity path" (**P1**), which is a statement about
    // the projection losing nothing, not about a total that would go stale the
    // next time the fixture gains a port.
    expect({ inputs: d.inputs.length, outputs: d.outputs.length }).toEqual({
      inputs: badge.inputs.length,
      outputs: badge.outputs.length
    });
    expect(d.inputs.length).toBeGreaterThan(0);

    // The summary mode renders every one of them as a line.
    expect(summary('demo.kit.Badge').ports.length).toBe(badge.inputs.length + badge.outputs.length);
  });
});
