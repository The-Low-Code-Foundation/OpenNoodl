/**
 * TPL-006 — the gate over the story engine.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## 🔴 What this gate can and cannot grade
 *
 * **AC1 and AC3 are criteria a render cannot meet** — a screenshot cannot click a
 * choice and a static check cannot paste JSON into a box. So this file grades what
 * is true of the *artefact*, and the behaviour is graded by driving a real browser;
 * that session is written up in the task file with its readings. Neither half is
 * sufficient and this comment exists so nobody mistakes a green suite here for a
 * story that plays.
 *
 * What is here, and why each one is worth a spec:
 *
 * - **§1 The demo story is walked.** Every `goto` resolves, every passage is
 *   reachable, and the gated ending is reachable *only* through the choice that
 *   gives its key. A story that dead-ends is the worst defect this template could
 *   ship and it is **invisible in a screenshot** — the page draws perfectly either
 *   way.
 * - **§2 The engine is in the graph.** Five `Condition` gates with both halves fed,
 *   and the `Function` nodes are exactly the five named seams. This is the
 *   criterion the template exists to satisfy.
 * - **§3 The writes are sequenced.** The gift lands before the move, or the next
 *   passage filters its choices against an inventory one click out of date.
 * - **§4 The prose wraps.** `contentSize` renders `white-space: pre`, which is the
 *   one defect on this template that ruins the page and shows up in no graph.
 * - **§5 The contrast is recomputed** from the tokens, not trusted to the comment.
 * - **§6 🔴 The story is in ONE parameter**, and §8 proves it by replacing the
 *   whole story and diffing every other file in the artefact.
 *
 * @module noodl-mcp/tests/tpl006Template.test
 */
import * as fs from 'fs';
import * as path from 'path';

import type {
  LegacyComponent,
  LegacyConnection,
  LegacyNode
} from '../../noodl-editor/src/editor/src/io/ProjectExporter';

import {
  CHOICE_COMPONENT,
  FUNCTION_SEAMS,
  GATE_NODES,
  PAGE_READ,
  PAGE_REMIX,
  PASSAGE_COMPONENT,
  PROSE_NODES,
  REQUIRED_MODULES,
  SIDEBAR_COMPONENT,
  SOURCE_COMPONENT,
  VAR_AT,
  VAR_CARRYING,
  VAR_PASTED
} from './tpl006Components';
import {
  AuthoredTemplate,
  buildStoryTemplateProject,
  prepareStoryArtefact,
  readStoryJson,
  TEMPLATE_ID,
  TEMPLATE_PROJECT_NAME
} from './tpl006Template';
import { MEANING, requestedCompositions, TPL006_TOKENS, USED_COMPOSITIONS } from './tpl006Theme';

jest.setTimeout(300_000);

const OUTPUT = path.join(__dirname, '..', '..', '..', 'templates', TEMPLATE_ID);

/** The story this template ships, as data rather than as a parameter. */
interface Passage {
  id: string;
  title: string;
  text: string;
  choices?: Array<{ label: string; goto: string; gives?: string; requires?: string }>;
}

const STORY: Passage[] = JSON.parse(readStoryJson());

let built: AuthoredTemplate;

/**
 * One declared port on a `Component Inputs` / `Component Outputs` node.
 *
 * `LegacyNode.ports` is `unknown[]`, and honestly so — the legacy format carries
 * several port shapes. This is the one this template authors, named here rather
 * than asserted at each of the three reads.
 */
interface AuthoredPort {
  name: string;
  plug?: string;
  type?: string | { name?: string };
}

/** Every component in the authored project. */
function componentsOf(): LegacyComponent[] {
  return built.project.components ?? [];
}

/** Every node in the authored project, by component legacy name. */
function nodesOf(component: string): LegacyNode[] {
  const found = componentsOf().find((c) => c.name === component);
  if (!found) {
    throw new Error(`no component "${component}" — the project has: ${componentsOf().map((c) => c.name).join(', ')}`);
  }
  const out: LegacyNode[] = [];
  const walk = (list: LegacyNode[]) => {
    for (const n of list ?? []) {
      out.push(n);
      if (n.children) walk(n.children);
    }
  };
  walk(found.graph?.roots ?? []);
  return out;
}

function connectionsOf(component: string): LegacyConnection[] {
  return componentsOf().find((c) => c.name === component)?.graph?.connections ?? [];
}

/** The ports a `Component Inputs`/`Outputs` node declares, typed once. */
function portsOf(node: LegacyNode): AuthoredPort[] {
  return (node.ports ?? []) as AuthoredPort[];
}

beforeAll(async () => {
  built = await buildStoryTemplateProject();
});

// ── §1 The demo story is a story ────────────────────────────────────────────

describe('TPL-006 §1 — the demo story can actually be read', () => {
  /**
   * 🔴 The spec that matters most and reads least like a test. A passage is typed
   * by hand; nothing about writing one says whether anybody can reach it.
   */
  it('every passage has a unique id, a title and some prose', () => {
    expect(STORY.length).toBeGreaterThan(1);
    const ids = new Set<string>();
    for (const p of STORY) {
      expect(typeof p.id).toBe('string');
      expect(p.id.length).toBeGreaterThan(0);
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.text.length).toBeGreaterThan(0);
    }
  });

  it('every goto lands on a passage that exists, and every choice has a label', () => {
    const ids = new Set(STORY.map((p) => p.id));
    for (const p of STORY) {
      for (const c of p.choices ?? []) {
        expect(c.label.length).toBeGreaterThan(0);
        // The one authoring mistake that produces a story which loads, reads
        // correctly, and dead-ends three clicks in.
        expect(ids.has(c.goto)).toBe(true);
      }
    }
  });

  it('every passage is reachable from the first one, carrying everything', () => {
    // The optimistic walk: a reader who takes every choice that is ever open.
    const ids = new Set(STORY.map((p) => p.id));
    const byId = new Map(STORY.map((p) => [p.id, p]));
    const seen = new Set<string>([STORY[0].id]);
    const queue = [STORY[0].id];
    while (queue.length) {
      const here = byId.get(queue.shift()!)!;
      for (const c of here.choices ?? []) {
        if (!ids.has(c.goto) || seen.has(c.goto)) continue;
        seen.add(c.goto);
        queue.push(c.goto);
      }
    }
    const unreachable = STORY.filter((p) => !seen.has(p.id)).map((p) => p.id);
    expect(unreachable).toEqual([]);
  });

  it('there is more than one ending, and an ending offers nothing further', () => {
    const endings = STORY.filter((p) => !Array.isArray(p.choices) || p.choices.length === 0);
    expect(endings.length).toBeGreaterThanOrEqual(2);
    for (const e of endings) expect(e.choices).toBeUndefined();
  });

  /**
   * 🔴 The story's own mechanic, graded rather than described. *The Last Light*'s
   * third way out exists only for a reader who read the log — so a `requires` that
   * nothing `gives`, or one the reader is handed anyway, would leave the template's
   * headline feature untested by the only story that ships with it.
   */
  it('a gated choice exists, its key is given by another choice, and the gate is not the first passage', () => {
    const gated = STORY.flatMap((p) => (p.choices ?? []).filter((c) => c.requires)).map((c) => c.requires!);
    expect(gated.length).toBeGreaterThan(0);
    const given = new Set(STORY.flatMap((p) => (p.choices ?? []).map((c) => c.gives)).filter(Boolean));
    for (const need of gated) expect(given.has(need)).toBe(true);

    // And the walk that does NOT read the log cannot reach what the gate protects.
    const byId = new Map(STORY.map((p) => [p.id, p]));
    const reachableCarryingNothing = new Set<string>([STORY[0].id]);
    const queue = [STORY[0].id];
    while (queue.length) {
      const here = byId.get(queue.shift()!)!;
      for (const c of here.choices ?? []) {
        // A reader who never takes a `gives` choice carries nothing, so every
        // `requires` choice stays invisible to them.
        if (c.requires) continue;
        if (c.gives) continue;
        if (reachableCarryingNothing.has(c.goto)) continue;
        reachableCarryingNothing.add(c.goto);
        queue.push(c.goto);
      }
    }
    const gatedTargets = STORY.flatMap((p) => (p.choices ?? []).filter((c) => c.requires).map((c) => c.goto));
    for (const target of gatedTargets) {
      expect(reachableCarryingNothing.has(target)).toBe(false);
    }
  });
});

// ── §2 The engine is in the graph ───────────────────────────────────────────

describe('TPL-006 §2 — the engine is in the graph, not in a script', () => {
  it.each(GATE_NODES.map((g) => [g.id, g.component, g.decides] as const))(
    'the gate "%s" in %s exists and decides: %s',
    (id, component, _decides) => {
      const node = nodesOf(component).find((n) => n.id === id);
      expect(node).toBeDefined();
      expect(node!.type).toBe('Condition');

      const wires = connectionsOf(component);
      // 🔴 BOTH halves. A gate with no `eval` never fires; a gate with no
      // `condition` tests a value nothing supplies. Both render perfectly.
      expect(wires.some((w) => w.toId === id && w.toProperty === 'eval')).toBe(true);
      expect(wires.some((w) => w.toId === id && w.toProperty === 'condition')).toBe(true);
    }
  );

  it('every Condition in the template is a declared gate — no branch is undocumented', () => {
    const declared = new Set(GATE_NODES.map((g) => `${g.component}::${g.id}`));
    const found: string[] = [];
    for (const c of componentsOf()) {
      for (const n of nodesOf(c.name)) {
        if (n.type === 'Condition') found.push(`${c.name}::${n.id}`);
      }
    }
    expect(found.sort()).toEqual([...declared].sort());
  });

  it('the Function nodes are exactly the named seams', () => {
    const declared = new Set(FUNCTION_SEAMS.map((f) => `${f.component}::${f.id}`));
    const found: string[] = [];
    for (const c of componentsOf()) {
      for (const n of nodesOf(c.name)) {
        if (n.type === 'JavaScriptFunction') found.push(`${c.name}::${n.id}`);
      }
    }
    expect(found.sort()).toEqual([...declared].sort());
  });

  it('no Function script stores state, navigates, or reaches outside itself', () => {
    // A seam answers a question or transforms a list. The moment one of them
    // stores state or navigates, the branch has left the graph.
    for (const seam of FUNCTION_SEAMS) {
      const node = nodesOf(seam.component).find((n) => n.id === seam.id);
      const script = String(node!.parameters?.functionScript ?? '');
      expect(script.length).toBeGreaterThan(0);
      for (const forbidden of [
        'Noodl.Variables',
        'Noodl.navigate',
        'Noodl.Objects',
        'setTimeout',
        'setInterval',
        'document.',
        'window.',
        'fetch(',
        'navigator.'
      ]) {
        expect(script).not.toContain(forbidden);
      }
    }
  });

  /**
   * 🔴 The gate for the class of defect the TPL-005 deploy path found.
   *
   * A `Function` node's ports come from its script: reading `Inputs.x` mints
   * `in-x`, assigning `Outputs.y` mints `out-y`. A connection to a port the script
   * never mentions **targets nothing** — invisible in the editor and under
   * `render-from-disk` (which lifts ports off connections), while the real
   * exporter's health filter drops it silently.
   */
  it('every wired Function port is one its own script actually mentions', () => {
    for (const seam of FUNCTION_SEAMS) {
      const script = String(nodesOf(seam.component).find((n) => n.id === seam.id)!.parameters?.functionScript ?? '');
      for (const wire of connectionsOf(seam.component)) {
        if (wire.toId === seam.id && String(wire.toProperty).startsWith('in-')) {
          expect(script).toContain(`Inputs.${String(wire.toProperty).slice(3)}`);
        }
        if (wire.fromId === seam.id && String(wire.fromProperty).startsWith('out-')) {
          expect(script).toContain(`Outputs.${String(wire.fromProperty).slice(4)}`);
        }
      }
    }
  });

  it('the story is read by one component that both pages place', () => {
    // 🔴 One copy of the story and one copy of the decision about which story is
    // playing. Two would drift the first time one of them changed.
    for (const page of [PAGE_READ, PAGE_REMIX]) {
      expect(nodesOf(page).filter((n) => n.type === SOURCE_COMPONENT)).toHaveLength(1);
    }
    const statics = nodesOf(SOURCE_COMPONENT).filter((n) => n.type === 'Static Data');
    expect(statics).toHaveLength(1);
  });

  /**
   * 🔴 The repeater contract, both halves.
   *
   * A row publishes to the repeater, not to the page, and **the id only moves if
   * the signal is consumed** — so a value wire with no signal wire beside it reads
   * empty for ever and the click that looked wired never fires.
   */
  it('the choice repeater consumes the row’s signal AND the values it publishes', () => {
    const page = nodesOf(PAGE_READ);
    const repeater = page.find((n) => n.id === 'rdChoices');
    expect(repeater!.type).toBe('For Each');
    expect(repeater!.parameters?.template).toBe(CHOICE_COMPONENT);

    const wires = connectionsOf(PAGE_READ);
    const fromRepeater = wires.filter((w) => w.fromId === 'rdChoices').map((w) => String(w.fromProperty));
    expect(fromRepeater).toContain('itemOutputSignal-picked');
    expect(fromRepeater).toContain('itemOutput-goto');
    expect(fromRepeater).toContain('itemOutput-gives');

    // And the row really does publish all three, or the repeater's ports do not exist.
    const published = new Set(
      nodesOf(CHOICE_COMPONENT)
        .filter((n) => n.type === 'Component Outputs')
        .flatMap((n) => portsOf(n).map((p) => p.name))
    );
    for (const name of ['picked', 'goto', 'gives']) expect(published).toContain(name);
  });

  it('the sidebar draws its pills with a repeater over one component', () => {
    const repeater = nodesOf(SIDEBAR_COMPONENT).find((n) => n.type === 'For Each');
    expect(repeater!.parameters?.template).toBe('/Story/Carried');
  });
});

// ── §3 The ordering that makes it deterministic ─────────────────────────────

describe('TPL-006 §3 — the writes are sequenced, not raced', () => {
  it('the gift is stored BEFORE the reader moves, down either branch of the gate', () => {
    const wires = connectionsOf(PAGE_READ);
    // 🔴 The next passage filters its choices on what the reader is carrying, so a
    // move that landed first would hide the choice the gift was for.
    expect(wires).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fromId: 'rdCarry', fromProperty: 'out-carrying', toId: 'rdSetCarry', toProperty: 'value' }),
        expect.objectContaining({ fromId: 'rdGiftGate', fromProperty: 'ontrue', toId: 'rdSetCarry', toProperty: 'do' }),
        expect.objectContaining({ fromId: 'rdSetCarry', fromProperty: 'done', toId: 'rdSetAt', toProperty: 'do' }),
        expect.objectContaining({ fromId: 'rdGiftGate', fromProperty: 'onfalse', toId: 'rdSetAt', toProperty: 'do' })
      ])
    );
    // Exactly two ways in, and they are the two branches of one gate — so exactly
    // one of them fires per click and neither can be missed.
    const moves = wires.filter((w) => w.toId === 'rdSetAt' && w.toProperty === 'do');
    expect(moves).toHaveLength(2);
  });

  it('the gate that asks about the gift is fed by the same script run that answered it', () => {
    const wires = connectionsOf(PAGE_READ);
    // 🔴 TPL-005 found damage landing a move late twice, both times from a value
    // that travelled through an intermediate. Condition and eval from one node.
    expect(wires).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fromId: 'rdCarry', fromProperty: 'out-added', toId: 'rdGiftGate', toProperty: 'condition' }),
        expect.objectContaining({ fromId: 'rdCarry', fromProperty: 'success', toId: 'rdGiftGate', toProperty: 'eval' })
      ])
    );
  });

  it('the two state gates are CHAINED, so a missing passage cannot race an ending', () => {
    const wires = connectionsOf(PAGE_READ);
    expect(wires).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fromId: 'rdFoundGate', fromProperty: 'ontrue', toId: 'rdEndGate', toProperty: 'eval' })
      ])
    );
    // ...and the ending gate is NOT also evaluated by the finder directly.
    expect(wires.some((w) => w.toId === 'rdEndGate' && w.toProperty === 'eval' && w.fromId === 'rdFind')).toBe(false);
  });

  it('the reader is put at the beginning by the story arriving, and by the restart, through one chain', () => {
    const wires = connectionsOf(PAGE_READ);
    expect(wires).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fromId: 'rdSrc', fromProperty: 'ready', toId: 'rdLoadAt', toProperty: 'do' }),
        expect.objectContaining({ fromId: 'rdSrc', fromProperty: 'firstId', toId: 'rdLoadAt', toProperty: 'value' }),
        expect.objectContaining({ fromId: 'rdLoadAt', fromProperty: 'done', toId: 'rdLoadCarry', toProperty: 'do' }),
        expect.objectContaining({ fromId: 'rdRestart', fromProperty: 'onClick', toId: 'rdLoadAt', toProperty: 'do' })
      ])
    );
    // 🔴 The first passage comes from the DATA. Nothing in the graph names one.
    const scripts = FUNCTION_SEAMS.map((s) =>
      String(nodesOf(s.component).find((n) => n.id === s.id)!.parameters?.functionScript ?? '')
    ).join('\n');
    for (const p of STORY) expect(scripts).not.toContain(`'${p.id}'`);
  });

  it('nothing is wired to the reactive seams’ `run`, so they still boot', () => {
    // 🔴 `simplejavascript.ts` auto-runs a script at load ONLY when `run` is
    // unconnected. The two seams that follow the reader's state must boot.
    for (const [component, id] of [[SOURCE_COMPONENT, 'srPick'], [PAGE_READ, 'rdFind'], [PAGE_READ, 'rdScreen']] as const) {
      expect(connectionsOf(component).some((w) => w.toId === id && w.toProperty === 'run')).toBe(false);
    }
    // And the two that must NOT boot are driven by a signal.
    expect(connectionsOf(PAGE_READ).some((w) => w.toId === 'rdCarry' && w.toProperty === 'run')).toBe(true);
    expect(connectionsOf(PAGE_REMIX).some((w) => w.toId === 'rxParse' && w.toProperty === 'run')).toBe(true);
  });

  /**
   * 🔴 The three unticks, and why they are a spec of their own.
   *
   * `rdCarry` reads the inventory and writes it; left reactive it runs for ever.
   * `rxParse` would report "that is not valid JSON yet" on every keystroke. And
   * DEF-038's pinning pass rewrites this whole family of checkboxes on the way to
   * the artefact, so "I set it" is not the same claim as "it shipped".
   */
  it('every signal-driven seam stays signal-driven — the unticks survive into the artefact', () => {
    const expected: Array<[string, string, string[]]> = [
      [PAGE_READ, 'rdCarry', ['in-carrying', 'in-gift']],
      [PAGE_REMIX, 'rxParse', ['in-text']]
    ];
    let counted = 0;
    for (const [component, id, ins] of expected) {
      const node = nodesOf(component).find((n) => n.id === id);
      expect(node).toBeDefined();
      for (const input of ins) {
        expect(node!.parameters?.[`runOnChange-${input}`]).toBe(false);
        counted++;
      }
    }
    expect(counted).toBe(3);
    // The reactive seams are left reactive: following the state is their job.
    for (const [component, id] of [[SOURCE_COMPONENT, 'srPick'], [PAGE_READ, 'rdFind'], [PAGE_READ, 'rdScreen']] as const) {
      const node = nodesOf(component).find((n) => n.id === id);
      for (const key of Object.keys(node!.parameters ?? {})) expect(key.startsWith('runOnChange-')).toBe(false);
    }
    // And every gate tests only when told to.
    for (const g of GATE_NODES) {
      expect(nodesOf(g.component).find((n) => n.id === g.id)!.parameters?.['runOnChange-condition']).toBe(false);
    }
  });

  /**
   * 🔴 The cross-page door, which is the one thing `create_component` refused.
   *
   * `RouterNavigate.target` is validated against the components that exist, so the
   * reading page could not be authored already holding a door to a page that was
   * not there yet — and the pages cannot be swapped, because the first page
   * registered is the one the app opens on. The door arrives as a delta, and a
   * delta that silently did nothing would leave a button that goes nowhere.
   */
  it('both doors between the two pages are in the artefact and point at real pages', () => {
    const read = connectionsOf(PAGE_READ);
    expect(read).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fromId: 'rdToRemix', fromProperty: 'onClick', toId: 'rdGoRemix', toProperty: 'navigate' })
      ])
    );
    expect(nodesOf(PAGE_READ).find((n) => n.id === 'rdGoRemix')!.parameters?.target).toBe(PAGE_REMIX);

    const remix = connectionsOf(PAGE_REMIX);
    expect(remix).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fromId: 'rxPaster', fromProperty: 'back', toId: 'rxGoRead', toProperty: 'navigate' }),
        expect.objectContaining({ fromId: 'rxSetPasted', fromProperty: 'done', toId: 'rxGoRead', toProperty: 'navigate' })
      ])
    );
    expect(nodesOf(PAGE_REMIX).find((n) => n.id === 'rxGoRead')!.parameters?.target).toBe(PAGE_READ);
  });

  it('the three variables the engine runs on are read as well as written', () => {
    const readers = [...nodesOf(PAGE_READ), ...nodesOf(SOURCE_COMPONENT)]
      .filter((n) => n.type === 'Variable2')
      .map((n) => n.parameters?.name);
    // 🔴 A variable nobody reads is a write nobody grades.
    for (const name of [VAR_AT, VAR_CARRYING, VAR_PASTED]) expect(readers).toContain(name);
    const writers = [...nodesOf(PAGE_READ), ...nodesOf(PAGE_REMIX)]
      .filter((n) => n.type === 'Set Variable')
      .map((n) => n.parameters?.name);
    for (const name of [VAR_AT, VAR_CARRYING, VAR_PASTED]) expect(writers).toContain(name);
  });

  /**
   * 🔴 TPL-006's half of the D43 re-measurement, pinned so the next session can
   * find the probe rather than re-deriving it.
   *
   * D43 read *"a value wired into a States node's `currentState` never changes its
   * state"*. Ten components in the shipped prefab library do exactly that wire, so
   * the mechanism claim is at least incomplete. This artefact carries both halves:
   * `Pages/Read`'s States node is driven by `to-<state>` signals (the idiom that is
   * known to work) and hands a string to `Story/Passage`, whose own States node is
   * driven through `currentState`. One render settles it.
   */
  it('the D43 control pair is both in the artefact, and the probe copies the shipped shape', () => {
    // The control: signals into the page's States node.
    const toWires = connectionsOf(PAGE_READ).filter((w) => w.toId === 'rdMode' && String(w.toProperty).startsWith('to-'));
    expect(toWires.length).toBeGreaterThanOrEqual(4);
    // The probe: a value into the passage's `currentState`.
    expect(connectionsOf(PASSAGE_COMPONENT)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fromId: 'psInputs', fromProperty: 'mode', toId: 'psLook', toProperty: 'currentState' })
      ])
    );
    const look = nodesOf(PASSAGE_COMPONENT).find((n) => n.id === 'psLook');
    // Both preconditions the ten shipped instances share, and that TPL-005 lacked.
    expect(String(look!.parameters?.states ?? '').length).toBeGreaterThan(0);
    expect(look!.parameters?.currentState).toBe('reading');
    const port = portsOf(nodesOf(PASSAGE_COMPONENT).find((n) => n.id === 'psInputs')!).find((p) => p.name === 'mode')!;
    const portType = typeof port.type === 'string' ? port.type : port.type?.name;
    expect(portType).toBe('*');
  });

  /**
   * 🔴 The parameter whose DEFAULT is a defect, pinned so a later session cannot
   * undo this by tidying it.
   *
   * Measured in a browser with the control beside it: with `useTransitions: true`
   * a `States` node publishes its `string` and `boolean` values on a state change
   * and **never publishes a `color` or a `number`**. Sampled at 0, 60, 150, 320,
   * 700 and 1500ms after one change, the eyebrow string flipped at 60ms and both
   * colours read their previous value at every sample; with the flag false all
   * three changed together. The port's default is `true`, so the failing arm is
   * the one an author gets by not thinking about it.
   */
  it('every States node in the template has transitions OFF, because the default does not publish colours', () => {
    const found: Array<[string, unknown]> = [];
    for (const c of componentsOf()) {
      for (const n of nodesOf(c.name)) {
        if (n.type === 'States') found.push([`${c.name}::${n.id}`, n.parameters?.useTransitions]);
      }
    }
    expect(found.length).toBeGreaterThanOrEqual(2);
    for (const [where, value] of found) expect([where, value]).toEqual([where, false]);
  });
});

// ── §4 The prose wraps ──────────────────────────────────────────────────────

describe('TPL-006 §4 — the prose wraps', () => {
  /**
   * 🔴 Measured in `Text.tsx:79-85`: `sizeMode: 'contentSize'` or `'contentWidth'`
   * renders `white-space: pre`, which does not wrap. Every other template in this
   * repo sets `contentSize` on almost every `Text`, because their strings are
   * short. This one's are paragraphs.
   */
  it.each(PROSE_NODES.map((p) => [p.component, p.id] as const))('%s › %s is not content-sized', (component, id) => {
    const node = nodesOf(component).find((n) => n.id === id);
    expect(node).toBeDefined();
    expect(node!.type).toBe('Text');
    expect(['contentSize', 'contentWidth']).not.toContain(node!.parameters?.sizeMode);
  });

  it('the passage prose is the only place with a reading measure, and it is a serif', () => {
    const node = nodesOf(PASSAGE_COMPONENT).find((n) => n.id === 'psText');
    expect(node!.parameters?.fontFamily).toBe('var(--font-serif)');
    expect(node!.parameters?.maxWidth).toEqual({ value: 680, unit: 'px' });
    // 🔴 Two nodes set a font in this whole project. A project that sets
    // `fontFamily` on forty nodes has no type system left.
    const setters: string[] = [];
    for (const c of componentsOf()) {
      for (const n of nodesOf(c.name)) {
        if (n.parameters?.fontFamily) setters.push(`${c.name}::${n.id}`);
      }
    }
    expect(setters.sort()).toEqual([`${PAGE_REMIX}::rxHelpExample`, `${PASSAGE_COMPONENT}::psText`, `${PASSAGE_COMPONENT}::psTitle`]);
  });
});

// ── §5 The look, recomputed ─────────────────────────────────────────────────

describe('TPL-006 §5 — the contrast is recomputed, not quoted', () => {
  const value = (name: string) => {
    const found = TPL006_TOKENS.find((t) => t.name === name);
    if (!found) throw new Error(`this template does not set ${name}, so its ratio is not its to claim`);
    return found.value;
  };
  const luminance = (hex: string) => {
    const h = hex.replace('#', '');
    const channel = (i: number) => {
      const c = parseInt(h.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  };
  const ratio = (a: string, b: string) => {
    const [la, lb] = [luminance(a), luminance(b)];
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };

  const PAIRS: Array<[string, string, number]> = [
    ['--primary-foreground', '--primary', 4.5],
    ['--primary', '--background', 4.5],
    ['--primary', '--surface', 4.5],
    ['--primary', '--surface-raised', 4.5],
    ['--foreground', '--background', 4.5],
    ['--foreground', '--surface', 4.5],
    ['--foreground', '--surface-raised', 4.5],
    ['--muted-foreground', '--background', 4.5],
    ['--muted-foreground', '--surface', 4.5],
    ['--muted-foreground', '--surface-raised', 4.5],
    ['--accent-foreground', '--accent', 4.5],
    ['--accent-foreground', '--background', 4.5],
    ['--secondary-foreground', '--secondary', 4.5],
    ['--border-control', '--background', 3.0],
    ['--border-control', '--surface', 3.0],
    ['--destructive', '--background', 4.5],
    ['--destructive', '--surface', 4.5],
    ['--destructive-foreground', '--destructive', 4.5]
  ];

  it.each(PAIRS)('%s on %s clears %s:1', (fg, bg, floor) => {
    expect(ratio(value(fg), value(bg))).toBeGreaterThanOrEqual(floor);
  });

  it('the three colours that mean something are used for exactly those three things', () => {
    // Brass is a choice you can take; teal is what you carry; red is your data
    // being wrong. Anything else wearing one of them is a page a reader misreads.
    const brass: string[] = [];
    const teal: string[] = [];
    const red: string[] = [];
    for (const c of componentsOf()) {
      for (const n of nodesOf(c.name)) {
        const json = JSON.stringify(n.parameters ?? {});
        const where = `${c.name}::${n.id}`;
        if (json.includes(MEANING.choice)) brass.push(where);
        if (json.includes(MEANING.carried)) teal.push(where);
        if (json.includes(MEANING.broken)) red.push(where);
      }
    }
    // The choice marker, and the States value for an ending.
    expect(brass).toContain(`${CHOICE_COMPONENT}::chMark`);
    // The pill and its border.
    expect(teal).toEqual([`/Story/Carried::caPill`, `/Story/Carried::caText`]);
    // 🔴 Red appears ONLY where the data is wrong: the problem line, the missing
    // passage line, and the passage panel's `lost` state.
    expect(red.sort()).toEqual([`${PAGE_READ}::rdMissing`, `${PASSAGE_COMPONENT}::psLook`, `/Story/Paster::paProblem`].sort());
  });

  it('every composition asked for is one the template declares it uses', () => {
    expect(requestedCompositions()).toEqual([...USED_COMPOSITIONS].sort());
  });
});

// ── §6 The story is in exactly ONE parameter ────────────────────────────────

describe('TPL-006 §6 — the graph is an interpreter, not a story', () => {
  /**
   * 🔴 **The only spec that grades the claim the template is sold on**, and the one
   * that catches the mistake that is easiest to make while making a demo look good:
   * a `Text` node whose `text` parameter is a line of the demo story renders
   * identically and breaks the promise.
   *
   * ⚠️ Written as "exactly one parameter", not "no parameter". The story has to
   * live somewhere and that somewhere is the authoring surface. One is the claim;
   * two is the defect.
   */
  it('every passage title, every passage text and every choice label appears in ONE parameter', () => {
    const needles = new Set<string>();
    for (const p of STORY) {
      needles.add(p.title);
      needles.add(p.text);
      for (const c of p.choices ?? []) needles.add(c.label);
    }
    expect(needles.size).toBeGreaterThan(10);

    const carriers = new Map<string, Set<string>>();
    for (const c of componentsOf()) {
      for (const n of nodesOf(c.name)) {
        for (const [key, raw] of Object.entries(n.parameters ?? {})) {
          if (typeof raw !== 'string') continue;
          for (const needle of needles) {
            // 🔴 Both spellings. A passage hard-coded into a `Text.text` parameter
            // is there verbatim; the same passage inside the `Static Data` node's
            // `json` parameter is JSON-escaped, so its newlines are two characters.
            // Checking only the raw form found 13 of 20 and would have read seven
            // leaked paragraphs as clean.
            const escaped = JSON.stringify(needle).slice(1, -1);
            if (!raw.includes(needle) && !raw.includes(escaped)) continue;
            const where = `${c.name}::${n.id}::${key}`;
            if (!carriers.has(where)) carriers.set(where, new Set());
            carriers.get(where)!.add(needle);
          }
        }
      }
    }

    expect([...carriers.keys()]).toEqual([`${SOURCE_COMPONENT}::srStory::json`]);
    // And that one carries ALL of it — a partial copy would mean the rest of the
    // story had been hard-coded somewhere this scan cannot see.
    expect(carriers.get(`${SOURCE_COMPONENT}::srStory::json`)!.size).toBe(needles.size);
  });

  it('the project itself is not named after the story', () => {
    const project = JSON.parse(fs.readFileSync(path.join(built.projectDir, 'nodegx.project.json'), 'utf8'));
    expect(project.name).toBe(TEMPLATE_PROJECT_NAME);
    expect(project.settings?.htmlTitle).toBe(TEMPLATE_PROJECT_NAME);
    for (const p of STORY) {
      expect(JSON.stringify(project)).not.toContain(p.title);
    }
  });
});

// ── §7 The artefact keeps its promises ──────────────────────────────────────

describe('TPL-006 §7 — the artefact', () => {
  it('it ships ZERO library modules, and that is read off the directory', () => {
    // 🔴 "We did not install one" and "there is not one here" are different
    // sentences, and AC4 asks for the second.
    expect(REQUIRED_MODULES).toEqual([]);
    const dir = path.join(built.projectDir, 'noodl_modules');
    const contents = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
    expect(contents).toEqual([]);
  });

  it('it ships no backend, and says so by containing nothing that needs one', () => {
    expect(fs.existsSync(path.join(built.projectDir, 'components', '__cloud__'))).toBe(false);
    expect(fs.existsSync(path.join(built.projectDir, 'nodegx.security.json'))).toBe(false);
    const project = JSON.parse(fs.readFileSync(path.join(built.projectDir, 'nodegx.project.json'), 'utf8'));
    expect(project.metadata?.cloudservices).toBeUndefined();
    // A passage can be four paragraphs and the choices are under it.
    expect(project.settings?.bodyScroll).toBe(true);
  });

  it('two pages are registered, and the one the app opens on is the story', () => {
    const registrations = Object.values(built.registrations);
    expect(registrations.length).toBeGreaterThanOrEqual(1);
    const start = registrations.find((r) => r.startPage)?.startPage;
    expect(start).toBe(PAGE_READ);
    const routes = new Set(registrations.flatMap((r) => r.added));
    expect(routes.has(PAGE_READ)).toBe(true);
    expect(routes.has(PAGE_REMIX)).toBe(true);
  });

  /**
   * 🔴 The door's own diagnostics, read rather than assumed silent — and the one
   * warning it raises is **argued with** rather than suppressed.
   *
   * `uncollapsible-multi-column` Arm B fires on any wrapped row that parents a
   * `For Each` and sets a `columnGap`, with **no exclusion for content-width
   * sizing** — while Arm A has exactly that exclusion and calls it *"the exclusion
   * that took the authored false-positive rate to zero"*
   * (`responsiveArrangement.ts:262`). The sidebar's pills are `contentSize`, so the
   * mechanism the message describes — *"each item keeps the width it was given"* —
   * does not apply: nothing gave them a width. Following the suggestion (a
   * `Columns` autoFit at 260–320px) would give every two-word tag a 300px column.
   *
   * ⚠️ Measured, and the library agrees: `/Tags`, `/Multi Select/Pills` and
   * `/Multi Select/Dropdown` all wrap a `For Each` of pills — and all three avoid
   * this warning only by setting **no gap at all**, which is the thing the design
   * doctrine tells authors not to do (*"use the gap ports, never margins on the
   * children"*). Filed in `DEFECTS-THE-TEMPLATES-FOUND.md`.
   *
   * So the assertion is exact rather than absent: a NEW warning reddens this gate.
   */
  it('the door refused nothing, raised no error, and raised exactly the one argued warning', () => {
    expect(built.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const warnings = built.diagnostics.filter((d) => d.severity === 'warning');
    expect(warnings.map((w) => `${w.component} ${w.code}`)).toEqual([
      'Story/Sidebar uncollapsible-multi-column'
    ]);
  });

  it('the prepared directory carries the note, and the note teaches the one edit', () => {
    prepareStoryArtefact(built, OUTPUT);
    const note = fs.readFileSync(path.join(OUTPUT, 'docs', 'START-HERE.md'), 'utf8');
    expect(note).toContain('Static Data');
    expect(note).toContain('Story/Source');
    // The four verbs, and no fifth.
    for (const verb of ['`goto`', '`gives`', '`requires`']) expect(note).toContain(verb);
    expect(note).toContain('/remix');
    // 🔴 And the note must not teach the demo story — it is an example of the
    // SHAPE, so a person replacing the story does not find their own prose quoted
    // back at them in the documentation.
    for (const p of STORY) expect(note).not.toContain(p.title);
    // Zero modules, all the way to the directory a person unzips.
    const dir = path.join(OUTPUT, 'noodl_modules');
    expect(fs.existsSync(dir) ? fs.readdirSync(dir) : []).toEqual([]);
  });
});

// ── §8 A completely different story is one edit ─────────────────────────────

describe('TPL-006 §8 — a stranger ships a different story by editing one parameter', () => {
  /**
   * 🔴 Measured by doing it, because that is the only way to find out. The claim is
   * not "the story is data" — it is *"a person can ship a completely different game
   * by editing one JSON array, and never open the node graph once"*, and the only
   * honest instrument is to build the template with a different story and diff every
   * file in the artefact.
   *
   * Anything other than that one parameter differing is content that had leaked
   * into the graph.
   */
  it('swapping the whole story changes exactly one parameter of one node, and nothing else', async () => {
    const other = [
      {
        id: 'desk',
        title: 'Monday, 9.02',
        text: 'Forty-one tickets.\n\nThe one at the top has been open since Thursday.',
        choices: [
          { label: 'Open the oldest one', goto: 'ticket', gives: 'the account number' },
          { label: 'Start at the top of the queue', goto: 'queue' }
        ]
      },
      { id: 'ticket', title: 'Thursday, still', text: 'They have written three times.', choices: [{ label: 'Call them', goto: 'call', requires: 'the account number' }] },
      { id: 'queue', title: 'Forty of them', text: 'None of them is the one that matters.' },
      { id: 'call', title: 'Nine minutes', text: 'It was a typo in a postcode.' }
    ];
    const swapped = await buildStoryTemplateProject({ storyJson: JSON.stringify(other, null, 2) });

    const differing: string[] = [];
    for (const after of swapped.project.components ?? []) {
      const before = componentsOf().find((c) => c.name === after.name);
      expect(before).toBeDefined();
      if (JSON.stringify(before!.graph) !== JSON.stringify(after.graph)) differing.push(after.name);
    }
    expect(differing).toEqual([SOURCE_COMPONENT]);

    // ...and inside that one component, exactly one parameter of one node.
    const flat = (component: LegacyComponent | undefined) => {
      const out = new Map<string, string>();
      const walk = (list: LegacyNode[]) => {
        for (const n of list ?? []) {
          for (const [k, v] of Object.entries(n.parameters ?? {})) out.set(`${n.id}::${k}`, JSON.stringify(v));
          if (n.children) walk(n.children);
        }
      };
      walk(component?.graph?.roots ?? []);
      return out;
    };
    const a = flat(componentsOf().find((c) => c.name === SOURCE_COMPONENT));
    const b = flat((swapped.project.components ?? []).find((c) => c.name === SOURCE_COMPONENT));
    // Both sides must actually have been found, or two empty maps agree perfectly.
    expect(a.size).toBeGreaterThan(0);
    expect(b.size).toBe(a.size);
    expect([...b.keys()].sort()).toEqual([...a.keys()].sort());
    const changed = [...a.keys()].filter((k) => a.get(k) !== b.get(k));
    expect(changed).toEqual(['srStory::json']);

    // And the new story is what is in it, read back out of the artefact.
    // `flat` stored `JSON.stringify(parameterValue)`, so one parse gives the
    // parameter's text and the second gives the story it holds.
    expect(JSON.parse(JSON.parse(b.get('srStory::json')!) as string)).toHaveLength(other.length);
  });
});
