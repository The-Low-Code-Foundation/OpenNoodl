/**
 * AWP-002 ⭐ — the conformance gate: `noodl-mcp` must not write what the editor
 * could not.
 *
 * ## Why this exists
 *
 * The project format has a conformance guard for one producer and none for the
 * other. `tests/io/schema-drift.test.ts` and the whole-object round-trip suite
 * both test editor → v2 → editor. **Nothing tested MCP → v2 → editor**, and
 * `noodl-mcp` is now a first-class producer of the format — for an agent-authored
 * project it is the *only* producer.
 *
 * F43 is what that gap looks like when it fails: not a schema violation (the file
 * validates), not a rule violation (`validate:project` reported 0 errors on 108
 * nodes), but a file that is **legal and unrenderable**, in a shape the editor's
 * own writer structurally cannot produce.
 *
 * ## ⚠️ The correction this suite makes to its own task file
 *
 * AWP-002 §1 predicted that the structural round trip would catch F43 —
 * *"MCP writes no `visualRoots`, the editor's re-export adds it, and the diff
 * names the field."* **Measured, 2026-08-08: it does not.**
 *
 * `visualRoots` is derived by `NodeGraphModel.toJSON()`, which sits *between*
 * `ProjectImporter` and `ProjectExporter` in the real editor pipeline and is
 * unreachable from a node process (it imports NodeLibrary, UndoQueue,
 * WarningsModel, EventDispatcher). The two pure functions on their own are a
 * **fixed point** for the field: `reconstructLegacyComponent` copies
 * `nodesFile.visualRoots` to `graph.visualRoots` and `buildComponentV2Files`
 * copies it back, so absent-in is absent-out and §1 sees nothing.
 *
 * So the structural diff is necessary and **not sufficient**, and §2 — the
 * reader-agreement check — is not the optional half. It is the half that catches
 * F43.
 *
 * ## Seen failing before it was seen passing
 *
 * Run against the writer as it stood before AWP-001, §2 reported **13**
 * disagreements by name: both components authored live in `beforeAll`, and 11 of
 * the 13 in the replay project — independently reproducing the corpus census
 * ("11 lack `visualRoots` while holding visual nodes") without being told it.
 * AWP-001's write-time derivation cleared the first group and its read-time
 * fallback cleared the second.
 */

import * as fs from 'fs';
import * as path from 'path';

import { buildComponentV2Files, reconstructLegacyComponent } from '../src/editor-deps';
import type { ComponentV2File, ConnectionsV2File, NodesV2File, NodeV2 } from '../src/editor-deps';
import { deriveVisualRootIds, makeProjectVisualPredicate, readVisualRoots } from '../src/visualRoots';
import { call, connect, copyFixture, TestSession } from './helpers';

const REPLAY = path.join(__dirname, 'fixtures', 'replay-deepseek-v4-pro');

interface ComponentFiles {
  component: ComponentV2File;
  nodes: NodesV2File;
  connections: ConnectionsV2File;
}
interface Fixture extends ComponentFiles {
  /** `<project>:<registry path>` — every failure names the component it is about. */
  label: string;
  registryPath: string;
}

/**
 * Differences that are **decisions**, not details.
 *
 * The whole value of this gate is that this list is short enough to read, so
 * every entry carries its reason and anything not on it fails.
 *
 * ⚠️ **This list got shorter, and that is the point.** It used to hold four
 * entries of the form "the editor's writer drops a field `noodl-mcp` wrote,
 * filed not fixed because the fix is in `ProjectExporter` and this package
 * cannot be the place that changes it". Three of them — `component.description`
 * (A13), `component.created` (A12) and `component.modifiedBy` — were fixed by
 * **LEG-006**, and the honesty check below (`none is dead`) is what forced them
 * off the list rather than leaving them as a permanent excuse. They are now
 * asserted the other way round, in "§1 … carries authored prose and provenance".
 *
 * `component.type` (A14) is still here and is still real.
 */
const ALLOWED_DIFFERENCES: Record<string, string> = {
  'component.modified':
    'A timestamp differs by construction — the re-export is stamped at the moment the gate runs.',
  'component.type':
    'A14 — `inferComponentType` recomputes the type from the legacy name and only recognises a root ' +
    'component by the marker `%rootcomponent`, so a project whose root is `/App` is relabelled ' +
    '`root` → `visual` on save. Also note the declared return union includes `logic`, which no branch ' +
    'can ever return.'
};

/** Every leaf whose JSON differs, as `dot.path: written=… reexport=…`. */
function diffLeaves(written: unknown, reexport: unknown, prefix = '', out: string[] = []): string[] {
  const isObj = (v: unknown) => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (isObj(written) && isObj(reexport)) {
    for (const k of new Set([...Object.keys(written as object), ...Object.keys(reexport as object)])) {
      diffLeaves((written as never)[k], (reexport as never)[k], prefix ? `${prefix}.${k}` : k, out);
    }
    return out;
  }
  if (Array.isArray(written) && Array.isArray(reexport) && written.length === reexport.length) {
    for (let i = 0; i < written.length; i++) diffLeaves(written[i], reexport[i], `${prefix}[${i}]`, out);
    return out;
  }
  if (JSON.stringify(written) !== JSON.stringify(reexport)) {
    const show = (v: unknown) => (v === undefined ? 'ABSENT' : JSON.stringify(v)).slice(0, 70);
    out.push(`${prefix}: written=${show(written)} reexport=${show(reexport)}`);
  }
  return out;
}

/** `nodes[3].parameters.text` → `nodes[].parameters.text`, so an allow-list entry is about a field. */
const generalise = (leaf: string) => leaf.split(':')[0].replace(/\[\d+\]/g, '[]');

function readComponent(root: string, registryPath: string, label: string): Fixture {
  const read = <T>(file: string) =>
    JSON.parse(fs.readFileSync(path.join(root, 'components', registryPath, file), 'utf8')) as T;
  return {
    label,
    registryPath,
    component: read<ComponentV2File>('component.json'),
    nodes: read<NodesV2File>('nodes.json'),
    connections: read<ConnectionsV2File>('connections.json')
  };
}

function registryPaths(root: string): string[] {
  const reg = JSON.parse(fs.readFileSync(path.join(root, 'components', '_registry.json'), 'utf8')) as {
    components?: Record<string, unknown>;
  };
  return Object.keys(reg.components ?? {});
}

/**
 * The moment the notional editor save happens. Deliberately *not* the fixture's
 * own `modified` value — a real save stamps the current time, so feeding the old
 * one back would make `component.modified` agree by construction and quietly
 * retire an allow-list entry that is doing real work.
 */
const SAVED_AT = '2030-01-01T00:00:00.000Z';

/** The editor's own reader, then the editor's own writer. No paraphrase. */
function roundTrip(f: Fixture): ComponentFiles {
  const legacy = reconstructLegacyComponent(f.registryPath, f.component, f.nodes, f.connections);
  return buildComponentV2Files(legacy, SAVED_AT);
}

describe('AWP-002 — MCP output must survive the editor’s own round trip', () => {
  let dir: string;
  let session: TestSession;
  let fixtures: Fixture[];

  beforeAll(async () => {
    dir = copyFixture();
    session = await connect(dir, true);

    // One MCP-authored component per reachable component `type`, written through
    // the real `create_component` door rather than hand-built, so the gate tests
    // the writer and not a fixture author's idea of it.
    await call(session, 'create_component', {
      path: 'Pages/Settings',
      description: 'A settings page.',
      nodes: [
        { id: 'set-page', type: 'Page', parameters: { title: 'Settings' } },
        { id: 'set-group', type: 'Group', parent: 'set-page' },
        { id: 'set-text', type: 'Text', parent: 'set-group', parameters: { text: 'Settings' } }
      ]
    });
    await call(session, 'create_component', {
      path: 'Components/Card',
      description: 'A visual card with one typed input.',
      nodes: [
        { id: 'card-root', type: 'Group' },
        { id: 'card-title', type: 'Text', parent: 'card-root', parameters: { text: 'Title' } },
        { id: 'card-in', type: 'Component Inputs', ports: [{ name: 'title', type: 'string', plug: 'output' }] }
      ],
      connections: [{ fromId: 'card-in', fromProperty: 'title', toId: 'card-title', toProperty: 'text' }]
    });
    await call(session, 'create_component', {
      path: 'Components/Calc',
      description: 'A logic-only component — no visual node anywhere in it.',
      nodes: [
        { id: 'calc-in', type: 'Component Inputs', ports: [{ name: 'n', type: 'number', plug: 'output' }] },
        { id: 'calc-expr', type: 'Expression', parameters: { expression: 'n * 2' } },
        { id: 'calc-out', type: 'Component Outputs', ports: [{ name: 'doubled', type: 'number', plug: 'input' }] }
      ],
      connections: [
        { fromId: 'calc-in', fromProperty: 'n', toId: 'calc-expr', toProperty: 'n' },
        { fromId: 'calc-expr', fromProperty: 'result', toId: 'calc-out', toProperty: 'doubled' }
      ]
    });

    // SB-001 — the fourth component type, through the same real door. The path
    // is given in the '#' spelling on purpose: the door must normalise it to
    // the editor-canonical registry key while the stored legacy name keeps the
    // '#' the bundle split reads.
    await call(session, 'create_component', {
      path: '#__cloud__/Send Welcome',
      description: 'A cloud function — Request in, Response out.',
      nodes: [
        { id: 'cf-req', type: 'noodl.cloud.request', parameters: { allowNoAuth: true } },
        { id: 'cf-res', type: 'noodl.cloud.response' }
      ],
      connections: [{ fromId: 'cf-req', fromProperty: 'receive', toId: 'cf-res', toProperty: 'send' }]
    });

    fixtures = [
      ...['Pages/Settings', 'Components/Card', 'Components/Calc', '__cloud__/Send Welcome'].map((p) =>
        readComponent(dir, p, `authored:${p}`)
      ),
      ...registryPaths(REPLAY).map((p) => readComponent(REPLAY, p, `replay-deepseek:${p}`))
    ];
  });

  afterAll(async () => {
    await session.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  /**
   * A conformance suite that silently stops loading fixtures passes forever, so
   * it asserts its own census. `13` is DeepSeek V4 Pro's session-8 artefact: 12
   * components plus `App`.
   */
  it('loads the fixtures it claims to — 4 authored live, 13 from the replay project', () => {
    expect(fixtures.filter((f) => f.label.startsWith('authored:'))).toHaveLength(4);
    expect(fixtures.filter((f) => f.label.startsWith('replay-deepseek:'))).toHaveLength(13);
    expect(fixtures.every((f) => (f.nodes.nodes ?? []).length > 0)).toBe(true);

    // SB-001 closed the hole the previous revision of this assertion recorded:
    // `create_component` now mints `__cloud__/` paths, so all four component
    // types AWP-002 §3 asks for go through the round trip.
    const types = new Set(fixtures.map((f) => f.component.type));
    expect([...types].sort()).toEqual(['cloud', 'page', 'root', 'visual']);
  });

  describe('§1 structural — the round trip must be a fixed point', () => {
    it('changes nothing outside the written allow-list', () => {
      const unexpected: string[] = [];
      for (const f of fixtures) {
        const re = roundTrip(f);
        const leaves = [
          ...diffLeaves(f.component, re.component, 'component'),
          ...diffLeaves(f.nodes, re.nodes, 'nodes'),
          ...diffLeaves(f.connections, re.connections, 'connections')
        ];
        for (const leaf of leaves) {
          if (!(generalise(leaf) in ALLOWED_DIFFERENCES)) unexpected.push(`${f.label} → ${leaf}`);
        }
      }
      expect(unexpected).toEqual([]);
    });

    it('keeps the allow-list honest — every entry is justified, and none is dead', () => {
      for (const [field, reason] of Object.entries(ALLOWED_DIFFERENCES)) {
        expect(reason.length).toBeGreaterThan(40);
      }
      // An allow-list entry nothing exercises is a claim nobody is checking.
      const seen = new Set<string>();
      for (const f of fixtures) {
        const re = roundTrip(f);
        for (const leaf of [
          ...diffLeaves(f.component, re.component, 'component'),
          ...diffLeaves(f.nodes, re.nodes, 'nodes'),
          ...diffLeaves(f.connections, re.connections, 'connections')
        ]) {
          seen.add(generalise(leaf));
        }
      }
      expect([...Object.keys(ALLOWED_DIFFERENCES)].filter((k) => !seen.has(k))).toEqual([]);
    });

    it('carries authored prose and provenance — LEG-006', () => {
      // The inverse of three allow-list entries that used to live above. This is
      // the MCP-side half of LEG-006: `reconstructLegacyComponent` →
      // `buildComponentV2Files` is the editor's own reader and writer, imported
      // from `editor-deps`, so a regression in `ProjectExporter` fails here even
      // though the change is in another package.
      //
      // ⚠️ It is NOT the whole acceptance. This pair is a fixed point with the
      // in-memory model missing, exactly as the `visualRoots` note at the top of
      // this file explains for F43. The four-step spec that covers the model is
      // `packages/noodl-editor/tests/io/component-description-roundtrip.test.ts`.
      let described = 0;
      for (const f of fixtures) {
        const re = roundTrip(f);
        if (f.component.description !== undefined) {
          expect({ label: f.label, description: re.component.description }).toEqual({
            label: f.label,
            description: f.component.description
          });
          described++;
        } else {
          // Absent in, absent out. A component with no description must not
          // acquire an empty string, which would be a diff on every save (F46).
          expect({ label: f.label, has: 'description' in re.component }).toEqual({
            label: f.label,
            has: false
          });
        }
        if (f.component.created !== undefined) {
          expect({ label: f.label, created: re.component.created }).toEqual({
            label: f.label,
            created: f.component.created
          });
        }
        if (f.component.modifiedBy !== undefined) {
          expect({ label: f.label, modifiedBy: re.component.modifiedBy }).toEqual({
            label: f.label,
            modifiedBy: f.component.modifiedBy
          });
        }
      }

      // A gate that iterated over nothing would pass. `create_component` writes
      // a description on every component authored in `beforeAll`.
      expect(described).toBeGreaterThan(0);
    });

    it('preserves the graph itself — nodes and connections are untouched by the round trip', () => {
      for (const f of fixtures) {
        const re = roundTrip(f);
        expect({ label: f.label, nodes: re.nodes.nodes }).toEqual({ label: f.label, nodes: f.nodes.nodes });
        expect({ label: f.label, conns: re.connections.connections }).toEqual({
          label: f.label,
          conns: f.connections.connections ?? []
        });
      }
    });
  });

  /**
   * §2 — the two readers of one file must agree about what renders.
   *
   * The harness reads `roots: nodesFile.visualRoots || []`
   * (`render-from-disk.js:174`). `ProjectImporter` builds roots from the node
   * tree and ignores the field for that purpose. Two readers, one file, two
   * answers — and the disagreement is invisible until something renders blank.
   *
   * This runs without a browser: "the same set of visual root ids" is the whole
   * assertion.
   */
  describe('§2 render equivalence — the two readers must agree', () => {
    const visualPredicateFor = (fixture: Fixture, all: Fixture[]) => {
      const byLegacyName = new Map<string, NodeV2[]>();
      for (const f of all) {
        if (f.label.split(':')[0] !== fixture.label.split(':')[0]) continue; // same project only
        byLegacyName.set(f.component.path ?? `/${f.registryPath}`, f.nodes.nodes ?? []);
      }
      return makeProjectVisualPredicate((legacyName) => byLegacyName.get(legacyName));
    };

    const disagreementsAmong = (subset: Fixture[], harnessReader: (f: Fixture) => string[]) =>
      subset.flatMap((f) => {
        const harness = harnessReader(f);
        const importer = deriveVisualRootIds(f.nodes.nodes, visualPredicateFor(f, fixtures));
        return JSON.stringify([...harness].sort()) === JSON.stringify([...importer].sort())
          ? []
          : [
              `${f.label}: render-from-disk would draw ${JSON.stringify(harness)}, ` +
                `the editor would draw ${JSON.stringify(importer)}`
            ];
      });

    /**
     * The write-path assertion. Every component the writer produces must have
     * readers that agree the moment it is written — no repair step in between.
     *
     * **Before AWP-001 landed this failed, naming both authored fixtures**
     * (`render-from-disk would draw [], the editor would draw ["set-page"]`)
     * alongside the 11 replay components below.
     */
    it('agrees on the visual root set for everything MCP writes', () => {
      const authored = fixtures.filter((f) => f.label.startsWith('authored:'));
      expect(authored.length).toBeGreaterThan(0);
      expect(disagreementsAmong(authored, (f) => f.nodes.visualRoots ?? [])).toEqual([]);
    });

    /**
     * The read-path assertion, on a project written *before* the writer was
     * fixed. `phase55-s8-deepseek-v4-pro` is DeepSeek V4 Pro's real session-8
     * artefact and it is evidence — it is not repaired on disk, and must not be.
     *
     * So the guarantee is the read-time fallback: a reader that derives when the
     * field is absent sees what the editor sees. This is the assertion that makes
     * AWP-001 §3 real rather than aspirational.
     */
    it('repairs an already-damaged project at read time rather than on disk', () => {
      const replay = fixtures.filter((f) => f.label.startsWith('replay-deepseek:'));

      // The damage is real and still on disk — 11 of 13, exactly the corpus census.
      const raw = disagreementsAmong(replay, (f) => f.nodes.visualRoots ?? []);
      expect(raw).toHaveLength(11);

      // And every one of them is invisible to a reader that derives.
      const repaired = disagreementsAmong(replay, (f) =>
        readVisualRoots(f.nodes, visualPredicateFor(f, fixtures))
      );
      expect(repaired).toEqual([]);
    });

    it('does not invent a visual root for a logic-only component', () => {
      const calc = fixtures.find((f) => f.label === 'authored:Components/Calc')!;
      expect(deriveVisualRootIds(calc.nodes.nodes, visualPredicateFor(calc, fixtures))).toEqual([]);
      // A logic-only component gets no key at all, not `[]` — "has no visual node"
      // and "nobody computed this" must stay distinguishable (BEN-003 depends on it).
      expect(calc.nodes.visualRoots).toBeUndefined();
    });

    it('never puts an interface node in a visual root set', () => {
      for (const f of fixtures) {
        const derived = new Set(deriveVisualRootIds(f.nodes.nodes, visualPredicateFor(f, fixtures)));
        const interfaceIds = (f.nodes.nodes ?? [])
          .filter((n) => n.type === 'Component Inputs' || n.type === 'Component Outputs')
          .map((n) => n.id);
        expect(interfaceIds.filter((id) => derived.has(id))).toEqual([]);
      }
    });
  });

  /**
   * §3 — the derivation paraphrases one thing: the editor filters roots on the
   * node library's `allowAsChild`, this side asks the catalog `isVisual`. That
   * equivalence is the load-bearing assumption of AWP-001, so it is measured
   * here rather than believed. The day the two drift apart is the day this
   * fails, instead of the day an app renders blank.
   */
  it('§3 — `allowAsChild` and `isVisual` select the same node types', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const catalog = require('../../noodl-types/src/node-catalog-enriched.json') as {
      nodes: Array<{ typeName: string; isVisual?: boolean; allowAsChild?: boolean }>;
    };
    const allowAsChild = catalog.nodes.filter((n) => n.allowAsChild === true).map((n) => n.typeName);
    const visual = catalog.nodes.filter((n) => n.isVisual === true).map((n) => n.typeName);

    expect([...allowAsChild].sort()).toEqual([...visual].sort());
    expect(visual.length).toBeGreaterThan(20); // and it is not the empty set agreeing with itself
    expect(visual).not.toContain('Component Inputs');
    expect(visual).not.toContain('Component Outputs');
  });
});
