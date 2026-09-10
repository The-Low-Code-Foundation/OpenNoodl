/**
 * CMP-001 AC2 (P85) — the interface playbook ships where a model reads it.
 *
 * The decomposition doctrine has said what BECOMES a component since AAQ-008. Nothing said what to
 * put ON one, and phase 85 measured the consequence: **26%** of the components in the corpus an
 * agent learns from publish any `Component Outputs`, against **84%** of the components the original
 * Noodl team shipped in `library/prefabs`. The playbook now rides `get_project_info` as
 * `interfaceDoctrine`, beside the four doctrine fields already there.
 *
 * ## What each half of this suite grades, and why it is two halves
 *
 * 1. **It arrives.** Asserted over a real server, on the text the client RECEIVED — not on the
 *    imported module. `rejectionExamples`' traps spec records why: a paragraph can be added to a
 *    source file and never leave the process. ⚠️ And an identity assertion alone (`toBe(MODULE)`)
 *    is the two-arms-agree-at-zero trap from CMP-004 AC3 — it passes with both sides blank — so
 *    every content assertion below reads `info.data.interfaceDoctrine`, and the length is bounded
 *    from below.
 *
 * 2. 🔴 **What it says is true of the artefacts it cites.** This is the half that exists because
 *    the task file's own exemplar was not. CMP-001 §3.1 offered LearnBook's `Collapsable group` at
 *    "11 nodes, 4 inputs" with a `forceOpen → Inverter → pointerEventsEnabled` wire called "the
 *    craft"; the string `forceOpen` occurs in no `project.json` on this machine and all four copies
 *    of that component read 9 nodes and two inputs. It was written into the task and never
 *    re-measured — the fifth premise in this phase not to survive contact. So every component,
 *    port, state list and wire the shipped text names is re-derived here from the graphs on the
 *    shelf, and both sides are bound: the claim has to be in the doctrine AND true of the graph.
 *
 * ⚠️ **These specs run against the REAL `library/` tree and the REAL enriched catalog**, so the
 * counts move when the shelf does — deliberately, as in `cmp004LibraryQuery`. A red here means the
 * doctrine's text has gone stale against the artefacts it teaches from, which is exactly the
 * failure this suite exists to catch. The reference instrument for the two percentages is
 * `dev-docs/tasks/phase-85-the-component-is-the-backbone/measure-interfaces.py`; the derivation
 * below reproduced its numbers (corpus 26%, prefabs 84%) at the time of writing, and the two
 * disagreeing is itself worth knowing.
 */

import * as fs from 'fs';
import * as path from 'path';

import { INTERFACE_DOCTRINE_MD } from '../src/editor-deps';
import { resolveLibraryRoot } from '../src/libraryShelf';

import { call, connect, copyFixture } from './helpers';

// ── The graphs the doctrine cites ────────────────────────────────────────────

interface LegacyNode {
  id: string;
  type: string;
  parameters?: Record<string, unknown>;
  children?: LegacyNode[];
}
interface Conn {
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
}
interface Comp {
  key: string;
  nodes: LegacyNode[];
  conns: Conn[];
}

function flatten(roots: LegacyNode[]): LegacyNode[] {
  const out: LegacyNode[] = [];
  const walk = (n: LegacyNode) => {
    out.push(n);
    for (const ch of n.children ?? []) if (ch && typeof ch === 'object') walk(ch);
  };
  for (const r of roots ?? []) walk(r);
  return out;
}

/** Every component on the real shelf, keyed `<entry>::<component name>`. */
function loadShelf(): Map<string, Comp> {
  const resolved = resolveLibraryRoot();
  if (!resolved.ok) throw new Error(`the real library root is required for this suite: ${resolved.reason}`);
  const prefabs = path.join(resolved.root, 'prefabs');
  const out = new Map<string, Comp>();
  for (const entry of fs.readdirSync(prefabs).sort()) {
    const file = path.join(prefabs, entry, 'project', 'project.json');
    if (!fs.existsSync(file)) continue;
    const project = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      components?: { name: string; graph?: { roots?: LegacyNode[]; connections?: Conn[] } }[];
    };
    for (const c of project.components ?? []) {
      out.set(`${entry}::${c.name}`, {
        key: `${entry}::${c.name}`,
        nodes: flatten(c.graph?.roots ?? []),
        conns: c.graph?.connections ?? []
      });
    }
  }
  return out;
}

/** Ports are what a connection carries out of `Component Inputs` / into `Component Outputs`. */
function ports(c: Comp): { inputs: string[]; outputs: string[] } {
  const ci = new Set(c.nodes.filter((n) => n.type === 'Component Inputs').map((n) => n.id));
  const co = new Set(c.nodes.filter((n) => n.type === 'Component Outputs').map((n) => n.id));
  return {
    inputs: [...new Set(c.conns.filter((x) => ci.has(x.fromId)).map((x) => x.fromProperty))].sort(),
    outputs: [...new Set(c.conns.filter((x) => co.has(x.toId)).map((x) => x.toProperty))].sort()
  };
}

const SHELF = loadShelf();

function comp(key: string): Comp {
  const c = SHELF.get(key);
  if (!c) throw new Error(`the doctrine cites ${key}, which is not on the shelf`);
  return c;
}

/** `<type>.<port> -> <type>.<port>`, for asserting a wire rather than a node's presence. */
function wires(c: Comp): string[] {
  const byId = new Map(c.nodes.map((n) => [n.id, n] as const));
  return c.conns.map(
    (x) =>
      `${byId.get(x.fromId)?.type ?? '?'}.${x.fromProperty} -> ${byId.get(x.toId)?.type ?? '?'}.${x.toProperty}`
  );
}

// ── The received text ────────────────────────────────────────────────────────

let received = '';
let readOnly: string | undefined;
let alsoReceived: { authoringDoctrine?: string; designDoctrine?: string } = {};

beforeAll(async () => {
  const dir = copyFixture();
  const rw = await connect(dir, true);
  const info = await call<{ interfaceDoctrine?: string; authoringDoctrine?: string; designDoctrine?: string }>(
    rw,
    'get_project_info'
  );
  received = info.data.interfaceDoctrine ?? '';
  alsoReceived = { authoringDoctrine: info.data.authoringDoctrine, designDoctrine: info.data.designDoctrine };
  await rw.close();

  const ro = await connect(dir, false);
  const roInfo = await call<{ interfaceDoctrine?: string }>(ro, 'get_project_info');
  readOnly = roInfo.data.interfaceDoctrine;
  await ro.close();

  fs.rmSync(dir, { recursive: true, force: true });
});

describe('CMP-001 AC2 — the playbook reaches the agent', () => {
  it('rides get_project_info read-write, verbatim from the shared module, and not read-only', () => {
    // One substrate, two clients: the bytes an external agent reads are the module's bytes.
    expect(received).toBe(INTERFACE_DOCTRINE_MD);
    // 🔴 Bounded from below on purpose — the assertion above passes with both sides empty.
    expect(received.length).toBeGreaterThan(5000);
    // A read-only client has nothing to apply it to, and it is not small.
    expect(readOnly).toBeUndefined();
  });

  it('arrives beside the decomposition doctrine it is the second half of, and is not a copy of it', () => {
    expect(alsoReceived.authoringDoctrine).toBeTruthy();
    expect(alsoReceived.designDoctrine).toBeTruthy();
    expect(received).not.toBe(alsoReceived.authoringDoctrine);
    // The decomposition doctrine says a named section is a component; this one says what goes on it.
    expect(alsoReceived.authoringDoctrine).toMatch(/A named section is a component/);
    expect(received).toMatch(/What goes on a component's interface/);
  });

  it('carries all ten patterns, each by the wire that makes it one', () => {
    // P1 placement, P2 controlled value, P3 flags.
    expect(received).toMatch(/Align X.+Margin Top/s);
    expect(received).toContain('State Changed');
    expect(received).toContain('Show Rows Per Page');
    // P4 — the enum input, which is the port AC1 had to document before this could be taught.
    expect(received).toContain('States.currentState');
    expect(received).toMatch(/enum\s+INPUT/);
    expect(received).toContain('Condition.ontrue/onfalse');
    // P5 dependency injection, P6 polymorphic rows, P7 the slot.
    expect(received).toContain('For Each.template');
    expect(received).toContain('templateType: "dynamic"');
    expect(received).toContain('Component Children');
    // P8 failure, P9 array ports, P10 the named utility (CMP-003 AC2 travels with this field).
    expect(received).toContain('Has Error');
    expect(received).toMatch(/One array port feeding a/);
    expect(received).toContain('Format full name');
    expect(received).toMatch(/A logic component with no .Component Outputs. is a node with extra steps/);
  });

  it('states the floors nowhere — a graded build must not be able to count its way to a pass', () => {
    // CMP-001 AC3's three floors (50% / 20% / 0.15) grade the CMP-002 build, which reads this field.
    // 🔴 An absence is only evidence beside a signal known to fire: on a blank field every
    // assertion below passes and the spec grades nothing, so the text is anchored first.
    expect(received).toContain('Before you call a component done');
    expect(received).not.toMatch(/floor/i);
    expect(received).not.toMatch(/at least (half|50)/i);
    expect(received).not.toMatch(/0\.15/);
  });
});

describe('CMP-001 AC2 — every component the playbook cites is on the shelf with the ports it claims', () => {
  /**
   * Each row: the component, and the ports the doctrine names for it. Both sides are asserted —
   * the port has to be IN THE TEXT and true of the graph — so neither a silently dropped claim nor
   * a renamed port passes. The count is pinned so an emptied table cannot grade nothing.
   */
  const CLAIMS: { key: string; inputs: string[]; outputs: string[] }[] = [
    { key: 'toggle-switch::/Toggle Switch', inputs: ['State', 'Show Label'], outputs: ['State', 'State Changed'] },
    { key: 'date-picker::/Date Picker', inputs: ['Value'], outputs: ['Value', 'Changed'] },
    { key: 'tab-bar::/Tab Bar', inputs: ['Selected Tab'], outputs: ['Selected Tab', 'Selected Tab Changed'] },
    {
      key: 'pagination::/Pagination',
      inputs: ['Current Page', 'Show Summary', 'Show Rows Per Page', 'Rows Per Page Options'],
      outputs: ['Current Page']
    },
    { key: 'rating::/Rating', inputs: [], outputs: ['Rating'] },
    {
      key: 'multi-select::/Multi Select/Dropdown',
      inputs: ['Option Template', 'Pill Template', 'Selection', 'Options'],
      outputs: ['Selected Items', 'Changed']
    },
    {
      key: 'form-fields::/Form Fields/Labelled Select',
      inputs: ['Disabled', 'Required'],
      outputs: ['Has Error']
    },
    { key: 'file-upload::/File Upload', inputs: [], outputs: ['Error', 'Failed', 'State'] },
    // 🔴 Neither of these rows may be empty: a claim with no ports agrees with a broken
    // derivation at zero, which is how two CMP-004 specs passed with `countNodes` returning 0.
    { key: 'table::/Table/Row', inputs: [], outputs: ['Click'] },
    { key: 'page-header::/Page Header', inputs: ['Breadcrumbs'], outputs: ['Crumb Clicked'] }
  ];

  it('the claim table is the one that was written, not an empty one', () => {
    expect(CLAIMS).toHaveLength(10);
    expect(CLAIMS.flatMap((c) => [...c.inputs, ...c.outputs]).length).toBeGreaterThan(20);
  });

  it.each(CLAIMS)('$key exposes what the doctrine says it does', ({ key, inputs, outputs }) => {
    const { inputs: real, outputs: realOut } = ports(comp(key));
    // Every row asserts something on both sides — see the note on the table.
    expect(inputs.length + outputs.length).toBeGreaterThan(0);
    for (const p of inputs) {
      expect(received).toContain(p);
      expect(real).toContain(p);
    }
    for (const p of outputs) {
      expect(received).toContain(p);
      expect(realOut).toContain(p);
    }
  });

  it('the placement block the doctrine says is on almost every prefab really is', () => {
    const BLOCK = ['Align X', 'Align Y', 'Margin Top', 'Margin Right', 'Margin Bottom', 'Margin Left', 'Position'];
    // The text writes the four margins in their compressed form; the graphs carry them expanded.
    for (const p of ['Align X', 'Align Y', 'Margin Top/Right/Bottom/Left', 'Position', 'Mounted']) {
      expect(received).toContain(p);
    }
    for (const key of [
      'toggle-switch::/Toggle Switch',
      'date-picker::/Date Picker',
      'tab-bar::/Tab Bar',
      'pagination::/Pagination',
      'rating::/Rating'
    ]) {
      expect(received).toContain(key.split('::')[1].replace(/^\//, '').split('/').pop() as string);
      for (const p of BLOCK) expect(ports(comp(key)).inputs).toContain(p);
    }
  });

  it('the wires it teaches are wires that exist', () => {
    // P4 variant selector — an input straight into the generated enum port.
    expect(wires(comp('toast::/Show Toast'))).toContain('Component Inputs.Type -> States.currentState');
    expect(received).toMatch(/toast.+\(.Type.\)/s);
    // P4 lifecycle — the state list, and the button it disables while busy.
    const states = (key: string) =>
      comp(key)
        .nodes.filter((n) => n.type === 'States')
        .map((n) => n.parameters?.states);
    expect(states('file-upload::/File Upload')).toContain('Idle,Picking,Uploading,Done,Failed');
    expect(received).toContain('Idle,Picking,Uploading,Done,Failed');
    expect(states('auth-pages::/Auth Pages/Sign In')).toContain('Idle,Busy');
    expect(received).toContain('Idle/Busy');
    expect(wires(comp('auth-pages::/Auth Pages/Sign In'))).toContain(
      'States.Enabled -> net.noodl.controls.button.enabled'
    );
    // P5 — the template ports go straight into the repeater.
    expect(wires(comp('multi-select::/Multi Select/Dropdown'))).toContain(
      'Component Inputs.Option Template -> For Each.template'
    );
    // P6 — dynamic rows, and the script the doctrine quotes.
    const forEach = comp('table::/Table/Row').nodes.find((n) => n.type === 'For Each');
    expect(forEach?.parameters?.templateType).toBe('dynamic');
    expect(String(forEach?.parameters?.templateScript)).toContain("'../' + item.Type + ' Cell'");
    expect(received).toContain("component = '../' + item.Type + ' Cell'");
    // P7 — the slot, in the two shelf components the doctrine names.
    for (const key of ['page-header::/Page Header', 'table::/Table/Base Cell']) {
      expect(comp(key).nodes.some((n) => n.type === 'Component Children')).toBe(true);
    }
    expect(received).toContain('Table/Base Cell');
    // "A flag has to reach everything it implies" — the two wires that make that sentence true.
    expect(wires(comp('form-fields::/Form Fields/Labelled Select'))).toEqual(
      expect.arrayContaining([
        'Component Inputs.Disabled -> JavaScriptFunction.in-Disabled',
        'JavaScriptFunction.out-Enabled -> net.noodl.controls.options.enabled'
      ])
    );
    expect(wires(comp('table::/Table/String Cell'))).toEqual(
      expect.arrayContaining(['Model2.prop-Editable -> Inverter.value', 'Inverter.result -> Text.mounted'])
    );
    expect(received).toMatch(/Table\/String Cell.+Editable.+Inverter/s);
  });
});

describe('CMP-001 AC2 — the numbers it argues from are the numbers the artefacts give', () => {
  /**
   * 🔴 The whole case for the field is one pair of percentages. If the shelf or the corpus moves
   * far enough to round differently, the sentence in the doctrine is no longer true and this goes
   * red — which is the point. Re-run `measure-interfaces.py` before changing a literal here.
   */
  const publishRate = (comps: { inputs: string[]; outputs: string[] }[]) => {
    const withInterface = comps.filter((c) => c.inputs.length > 0);
    return Math.round((withInterface.filter((c) => c.outputs.length > 0).length / withInterface.length) * 100);
  };

  it('the shipped library publishes outputs at the rate the doctrine states', () => {
    const rate = publishRate([...SHELF.values()].map(ports));
    expect(rate).toBe(84);
    expect(received).toMatch(/\*\*84%\*\*/);
  });

  it('the corpus an agent learns from publishes at the rate the doctrine states', () => {
    const catalog = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog-enriched.json'), 'utf8')
    ) as { examples: { components: { name: string; nodes: LegacyNode[]; connections?: Conn[] }[] }[] };
    const comps = catalog.examples.flatMap((e) =>
      e.components.map((c) => ports({ key: c.name, nodes: c.nodes ?? [], conns: c.connections ?? [] }))
    );
    // The population is not empty and not the shelf — a rate over nothing is not a rate.
    expect(comps.filter((c) => c.inputs.length > 0).length).toBeGreaterThan(20);
    // 🔴 This literal has moved TWICE now, and correctly both times: 10 until CMP-001 AC3
    // added four examples that publish, then 21 until the AC3 remainder gave `/Note Row` and
    // `/Todo Row` the outputs their own examples already claimed. Each time this spec is what
    // said the doctrine's sentence had gone stale, within the same session that moved it.
    // Re-run `measure-interfaces.py corpus` before touching it — count the artefact, never the
    // literal.
    expect(publishRate(comps)).toBe(26);
    expect(received).toMatch(/\*\*26%\*\*/);
  });

  it('the fifty-four components that publish a failure port are still fifty-four', () => {
    const failing = [...SHELF.values()]
      .map(ports)
      .filter((p) => p.outputs.some((o) => ['Success', 'Failure', 'Failed', 'Error'].includes(o)));
    expect(failing).toHaveLength(54);
    expect(received).toContain('**Fifty-four**');
  });
});

/**
 * CMP-001 AC3 remainder — the repeated-row rule, graded against the runtime that implements it
 * and the corpus that now demonstrates it.
 *
 * 🔴 The rule was written because the corpus had **zero** `itemOutputSignal-…` connections across
 * 72 examples, and both examples that reached for the mechanism were broken by it. The port names
 * are therefore re-derived from `foreach.tsx` rather than quoted: a doctrine that names a port the
 * runtime does not mint is worse than one that says nothing.
 */
describe('CMP-001 AC3 remainder — a repeated row publishes to the repeater', () => {
  const FOREACH = fs.readFileSync(
    path.join(__dirname, '..', '..', 'noodl-viewer-react', 'src', 'nodes', 'std-library', 'data', 'foreach.tsx'),
    'utf8'
  );

  const corpus = () =>
    (
      JSON.parse(
        fs.readFileSync(path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog-enriched.json'), 'utf8')
      ) as { examples: { id: string; components: { name: string; connections?: Conn[] }[] }[] }
    ).examples;

  it('the three port names the doctrine gives are the three the runtime mints', () => {
    // Not a substring search over prose: these are the literals `_collectPortsInTemplateComponent`
    // builds and the one `itemOutputSignalTriggered` flags.
    expect(FOREACH).toContain("'itemOutputSignal-' + outputName");
    expect(FOREACH).toContain("'itemOutput-' + outputName");
    expect(FOREACH).toContain("this._internal.itemActionItemId = model.getId()");
    for (const port of ['itemOutputSignal-', 'itemOutput-', 'itemActionItemId']) {
      expect(received).toContain(port);
    }
  });

  it('the runtime really does gate the id on the signal being consumed', () => {
    // The doctrine's one 🔴 claim. `registerOutputIfNeeded` is the only writer of the flag, and
    // `onOutputChanged` is the only reader — if either half moved, the warning is now false.
    expect(FOREACH).toContain("this._internal.itemOutputSignals[name.substring('itemOutputSignal-'.length)] = true");
    expect(FOREACH).toMatch(/internal\.itemOutputSignals\[name\]\s*\)\s*\{\s*\n\s*this\.itemOutputSignalTriggered/);
    expect(received).toContain('itemActionItemId');
    expect(received).toMatch(/only moves if the signal is consumed/);
  });

  it('the corpus demonstrates the mechanism the doctrine describes', () => {
    const wired = corpus().flatMap((e) =>
      e.components.flatMap((c) =>
        (c.connections ?? [])
          .filter((x) => x.fromProperty.startsWith('itemOutputSignal-') || x.fromProperty.startsWith('itemOutput-'))
          .map((x) => `${e.id}::${x.fromProperty}`)
      )
    );
    // Was zero across all 72 examples until the AC3 remainder. A rule nothing demonstrates is the
    // failure this phase exists to catch, so the floor here is "more than none", asserted by name.
    expect(wired).toEqual(
      expect.arrayContaining([
        'cloud-record-crud::itemOutputSignal-rename',
        'cloud-record-crud::itemOutputSignal-delete',
        'cloud-record-crud::itemOutput-title',
        'data-shared-array-add-remove::itemOutputSignal-remove'
      ])
    );
  });

  it('every itemActionItemId wire in the corpus has an item signal beside it', () => {
    // 🔴 The defect this remainder found, turned into a standing gate: `data-shared-array-add-remove`
    // wired the id with nothing consuming a signal, so it read `undefined` for the life of the page
    // and `catalog:examples` could not see it — `For Each` has runtime-discovered ports and is one
    // of the 172 nodes that check skips.
    for (const e of corpus()) {
      for (const c of e.components) {
        const conns = c.connections ?? [];
        const usesId = conns.some((x) => x.fromProperty === 'itemActionItemId');
        if (!usesId) continue;
        const signals = conns.filter((x) => x.fromProperty.startsWith('itemOutputSignal-'));
        // Named, so a failure says WHICH component is wired to read an id that never arrives.
        expect(`${e.id}::${c.name} item signals=${signals.length}`).not.toBe(`${e.id}::${c.name} item signals=0`);
      }
    }
  });
});
