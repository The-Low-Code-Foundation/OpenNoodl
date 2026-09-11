/**
 * CN-010 — dynamic ports: the agent-facing half.
 *
 * ## What was measured before anything was written
 *
 * The task's acceptance criterion 3 asks that `get_node_type` "report the
 * dynamic-port mechanism **the way it does for `Function` and `Object`**". Run
 * against the real catalog on 2026-08-17, that premise is false three times over,
 * and the third is the defect:
 *
 * 1. There is no type named `Function` or `Object`. The catalog calls them
 *    `Javascript2` and `Model2`; `get_node_type('Function')` is a lookup miss.
 * 2. 88 of the 175 shipped types declare `dynamicPorts`, and 34 of those carry
 *    `declaredPortGroups` — 165 groups, 158 with a condition. **None of it
 *    reached an answer.** The projection emitted `{ mechanisms: [...] }` and
 *    dropped the rest.
 * 3. 🔴 It also dropped the prose, because it read `dp.note` — **a field that
 *    exists on no node in the product.** The catalog's field is `description`,
 *    non-optional on both `DynamicPortInfo` (shipped) and
 *    `OverlayDynamicPortInfo` (kits). So the answer for every dynamic type was a
 *    bare mechanism list: *this port list is incomplete*, with no statement of
 *    how, and 88/88 of them typechecked and shipped that way.
 *
 * The editor's `CatalogIndex.dynamicPortNote()` reads `description` and has been
 * right the whole time. ⚠️ **This is the third field in this phase sourced from a
 * table no kit can appear in, or named wrong in one consumer of two** — after
 * CN-008's `docs` and CN-009's `summary`. The pattern is not "kits were
 * forgotten": it is that a second consumer of a shared document re-declares the
 * shape it reads, and nothing types the seam.
 *
 * ## Why the summary fallback is not symmetric, and why the obvious control cannot fail
 *
 * `getNodeTypeSummary` pairs `hasDynamicPorts: true` with `runtimeBehavior`,
 * precisely so the flag is an answer rather than a flag. `runtimeBehavior` comes
 * from `enrichment` — generated at repo-build time, keyed by type name — so:
 *
 * | | has `enrichment.runtimeBehavior` |
 * |---|---|
 * | shipped dynamic types | **88 of 88** |
 * | kit types | **0, on every machine, by construction** |
 *
 * 🔴 So a control of the form *"no built-in's summary shows the generic dynamic
 * description"* **passes against a completely unimplemented fallback**: the
 * `else` branch is unreachable for all 88. That is CN-009's finding 2 again, in a
 * new field, and it is why the real control below is a **hand-built node shaped so
 * the fallback would fire** — one with dynamic ports and no description at all.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  getNodeTypeDetail,
  getNodeTypeSummary,
  setCatalogOverlay,
  type NodeTypeDetail,
  type NodeTypeSummary
} from '../src/catalog';
import { clearProjectOverlay, extractProjectOverlay } from '../src/kitOverlay';
import type { OverlayCatalogNode } from '@nodegx/kit-catalog';
import { buildKitExtractor } from './helpers';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const enriched = require('../../noodl-types/src/node-catalog-enriched.json') as {
  nodes: Array<{
    typeName: string;
    dynamicPorts?: { mechanisms: string[]; description?: string; declaredPortGroups?: unknown[] } | null;
    enrichment?: { runtimeBehavior?: string };
  }>;
};

const KIT_DYNPORTS = path.join(__dirname, 'fixtures', 'kit-dynports');

let tempDir: string;

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cn010-'));
  process.env.NODEGX_KIT_EXTRACT = await buildKitExtractor(tempDir);
}, 120_000);

afterAll(() => {
  delete process.env.NODEGX_KIT_EXTRACT;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

afterEach(() => clearProjectOverlay());

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

/** The dynports kit, extracted once by the real extractor and installed. */
function useDynportsKit(): void {
  const extracted = extractProjectOverlay(KIT_DYNPORTS);
  expect(extracted.failures).toEqual([]);
  setCatalogOverlay(extracted.nodes);
}

/** A hand-built overlay node — for the shapes no real kit produces. */
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

// ─── AC3 · the sentence ───────────────────────────────────────────────────────

describe('AC3 — the dynamic-port description reaches the answer', () => {
  /**
   * 🔴 The whole-population assertion, and the one that would have caught the
   * original defect on the day it landed.
   *
   * A single spot-check on one type is satisfied by a projection that reads any
   * field that happens to be populated on that type. Requiring all 88 means a
   * regression to a wrong field name — which is exactly what `note` was — fails
   * 88 times rather than passing 88 times.
   */
  it('every shipped type that declares dynamic ports states how, not just that', () => {
    const declared = enriched.nodes.filter((n) => n.dynamicPorts);
    expect(declared.length).toBe(88); // pin the population; a drop here is a catalog regression

    const silent = declared
      .map((n) => n.typeName)
      .filter((t) => {
        const dp = detail(t).dynamicPorts;
        return !dp || !dp.description || dp.description.trim().length === 0;
      });

    expect(silent).toEqual([]);
  });

  it("carries the kit author's own wording for a kit node", () => {
    useDynportsKit();

    expect(detail('dynports.kit.Panel').dynamicPorts?.description).toMatch(
      /declares dynamic port groups.*read from the kit/s
    );
  });

  /**
   * The dead field, pinned by name.
   *
   * `note` was never populated by anything, so no assertion about *behaviour*
   * distinguishes "reads the right field" from "reads a second wrong field as
   * well". This one does, and it is cheap.
   */
  it('publishes no `note` field — the name that matched nothing', () => {
    useDynportsKit();

    for (const t of ['For Each', 'Javascript2', 'dynports.kit.Panel', 'dynports.kit.Feed']) {
      expect(Object.keys(detail(t).dynamicPorts ?? {})).not.toContain('note');
    }
  });

  it('says nothing rather than something empty when a node has no description', () => {
    setCatalogOverlay([
      kitNode({
        typeName: 'control.kit.Blank',
        dynamicPorts: { mechanisms: ['runtime-discovered'], description: '' }
      } as never)
    ]);

    const dp = detail('control.kit.Blank').dynamicPorts;
    expect(dp?.mechanisms).toEqual(['runtime-discovered']);
    expect(dp && 'description' in dp).toBe(false);
  });
});

// ─── AC3 · the enumerable half ────────────────────────────────────────────────

describe('AC3 — declaredPortGroups, the half that was fully knowable', () => {
  it("answers a kit's conditional group with its condition and its port names", () => {
    useDynportsKit();

    expect(detail('dynports.kit.Panel').dynamicPorts?.declaredPortGroups).toEqual([
      { condition: 'mode = list', inputs: ['itemCount'] }
    ]);
  });

  it('answers a shipped type the same way', () => {
    expect(detail('For Each').dynamicPorts?.declaredPortGroups).toEqual([
      { condition: 'templateType = explicit OR templateType NOT SET', inputs: ['template'] },
      { condition: 'templateType = dynamic', inputs: ['templateScript'] }
    ]);
  });

  /**
   * ⚠️ The exporter's own bookkeeping must not travel.
   *
   * `nodelibraryexport.ts` stamps `name: "conditionalports/extended"` on a group
   * and the shipped catalog keeps it (30 of 165 groups). It names a mechanism
   * inside the exporter and means nothing to a caller, so passing the raw entry
   * through would spend bytes teaching an agent a word it cannot use.
   */
  it('drops the exporter internals a caller cannot act on', () => {
    const groups = detail('For Each').dynamicPorts?.declaredPortGroups ?? [];
    expect(groups.length).toBeGreaterThan(0);

    for (const g of groups) {
      expect(Object.keys(g).sort()).toEqual(expect.not.arrayContaining(['name', 'template', 'indexStep']));
    }
  });

  /**
   * Absent, never `[]`.
   *
   * `Feed` declares a `channelPort` — genuinely runtime-named — so there is no
   * enumerable group to report. An empty array would read as "we looked and
   * there are none", which is true here but would be a lie the moment a mapping
   * bug produced one; absence says the node has no enumerable half at all.
   */
  it('omits the field entirely for a node whose dynamism is runtime-only', () => {
    useDynportsKit();

    const dp = detail('dynports.kit.Feed').dynamicPorts;
    expect(dp?.mechanisms).toEqual(['runtime-discovered']);
    expect(dp && 'declaredPortGroups' in dp).toBe(false);
  });

  it('drops a group that names no port at all', () => {
    setCatalogOverlay([
      kitNode({
        typeName: 'control.kit.Hollow',
        dynamicPorts: {
          mechanisms: ['declared-port-groups'],
          description: 'has one real group and one that names nothing',
          declaredPortGroups: [{ condition: 'a = b' }, { condition: 'c = d', inputs: ['real'] }]
        }
      } as never)
    ]);

    expect(detail('control.kit.Hollow').dynamicPorts?.declaredPortGroups).toEqual([
      { condition: 'c = d', inputs: ['real'] }
    ]);
  });
});

// ─── AC3 · the summary, where a kit had a flag and no answer ───────────────────

describe('AC3 — a kit summary explains its own flag', () => {
  /**
   * 🔴 The measurement that makes this a defect rather than a nicety: the
   * `runtimeBehavior` that gives `hasDynamicPorts` its meaning is present for
   * every built-in and impossible for every kit.
   */
  it('the gap is total and permanent, not a coverage hole', () => {
    const dynamic = enriched.nodes.filter((n) => n.dynamicPorts);
    const withPn = dynamic.filter((n) => n.enrichment?.runtimeBehavior);

    expect([dynamic.length, withPn.length]).toEqual([88, 88]);
  });

  it("a kit's flag arrives with the sentence that explains it", () => {
    useDynportsKit();

    const s = summary('dynports.kit.Panel');
    expect(s.hasDynamicPorts).toBe(true);
    expect(s.runtimeBehavior).toBe(detail('dynports.kit.Panel').dynamicPorts?.description);
  });

  /**
   * ⚠️ **A guard, not a control** — and the distinction is the point.
   *
   * This passes against an unimplemented fallback, because `For Each` has an
   * `enrichment.runtimeBehavior` and takes the first branch either way. It is
   * here to catch the fallback *shadowing* the better sentence, which is a real
   * regression; it grades nothing about whether the fallback exists. The test
   * below is the one that does.
   */
  it('does not let the generic sentence displace a built-in’s specific one', () => {
    const s = summary('For Each');
    const specific = enriched.nodes.find((n) => n.typeName === 'For Each')!.enrichment!.runtimeBehavior;

    expect(s.runtimeBehavior).toBe(specific);
    expect(s.runtimeBehavior).not.toBe(detail('For Each').dynamicPorts?.description);
  });

  /**
   * ✅ The real control: a node shaped so the fallback *would* fire, with nothing
   * for it to fire with. The flag must stay honest rather than gain an empty
   * sentence.
   */
  it('leaves the flag bare when there is genuinely nothing to say', () => {
    setCatalogOverlay([
      kitNode({
        typeName: 'control.kit.Mute',
        dynamicPorts: { mechanisms: ['runtime-discovered'], description: '' }
      } as never)
    ]);

    const s = summary('control.kit.Mute');
    expect(s.hasDynamicPorts).toBe(true);
    expect('runtimeBehavior' in s).toBe(false);
  });

  /**
   * ⚠️ The first draft of this used `Text`, which **declares dynamic ports** —
   * 7 conditional groups. 88 of 175 types do, including most of the visual
   * vocabulary, so "a node like any other" is not a safe way to pick a negative
   * case here. `Condition` is one of the 87 that genuinely declares none.
   */
  it('says nothing about dynamic ports for a node that has none', () => {
    useDynportsKit();

    // `null`, not absent: `CatalogNode.dynamicPorts` is `DynamicPortInfo | null`,
    // so a node with none says so explicitly.
    expect(enriched.nodes.find((n) => n.typeName === 'Condition')?.dynamicPorts).toBeNull();

    const s = summary('Condition');
    expect(s.hasDynamicPorts).toBeUndefined();
    expect(detail('Condition').dynamicPorts).toBeUndefined();
  });
});
