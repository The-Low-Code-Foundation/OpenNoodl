/**
 * SBR-010 — Messages: the loop the product left open.
 *
 * The contact form has stored rows since SB-004 and **nothing has ever read one
 * back**; the sidebar has carried a *Messages* item since SBR-006 and it went
 * nowhere. This file grades the screen at the other end of both, over the
 * **shipped artefact** — `site-builder.content.json`, what a person receives —
 * rather than over the component sets that argue for it. Every finding this
 * phase has paid for came from grading the second.
 *
 * ## 🔴 What this file can settle, and what it cannot
 *
 * AC1 (*"submit as a visitor, sign in as owner, the message is there"*) and AC2
 * (*"anonymous cannot read them"*) are person sentences about a **deployed
 * backend** and are settled in `sbr010-messages-drive.test.ts`, over real HTTP.
 * What a structural gate can hold is every claim that drive would otherwise
 * re-derive by hand, and each arm below is chosen because a plausible edit
 * breaks it **silently**:
 *
 *  - the row's port list IS `submitContactForm`'s write set, **derived from the
 *    cloud component** rather than typed here — §4's first trap is "do not
 *    author a parallel class", and a derivation is the only form of that claim
 *    that cannot rot;
 *  - the rail item has a navigate, which is the entire gap SBR-006 recorded;
 *  - the empty sentence and the count sentence are ONE node, and zero is a
 *    different sentence rather than the count with a zero in it (AC3's pair);
 *  - newest-first is a **backend** sort, so it is the order of the whole
 *    collection and not of whatever came back (AC4);
 *  - the row renders from its interface only — the placed-twice-renders-
 *    identically ghost, asserted as "no person-visible constant in the row";
 *  - and the scope: no write node exists in either component, so a Reply, a
 *    Delete or a mark-as-read arriving later reddens here first.
 *
 * ⚠️ **Name what this instrument cannot see.** The two script arms run the
 * shipped `functionScript` in Node with a plain `Inputs`/`Outputs` pair. That
 * grades the SCRIPT and says nothing about whether the runtime ever calls it —
 * the wiring arms beside them are what carry that half, and the browser drive is
 * what carries the rest.
 *
 * @see sb004Components.ts — `CONTACT_NODES`/`CONTACT_WIRES`, the write set.
 * @see sbr010-messages-drive.test.ts — AC1/AC2/AC3/AC4 against a real backend.
 */
import { CONTACT_NODES, CONTACT_WIRES } from './sb004Components';
import {
  ANONYMOUS_SENDER,
  EMPTY_MESSAGE_LIST_TEXT,
  MESSAGES_DEFERRED,
  MESSAGES_READ_ONLY_TEXT,
  MESSAGE_LIST_ERROR_TEXT,
  MESSAGE_SORT
} from './sb005Components';
import { readArtefact } from './siteBuilderStyleScan';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const SITE_SECURITY = require('../../noodl-editor/src/editor/src/models/template/templates/site-builder.security.json') as {
  collections: Record<string, { permissions: Record<string, string> }>;
};

interface Node {
  id: string;
  type: string;
  label?: string;
  parameters?: Record<string, unknown>;
  ports?: Array<{ name: string; plug: string; type: string }>;
  children?: Node[];
}
interface Connection {
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
}

const artefact = readArtefact() as unknown as {
  components: Array<{ name: string; graph: { roots: Node[]; connections?: Connection[] } }>;
};

const ROW = '/Admin/MessageRow';
const SCREEN = '/Pages/Messages';
const SHELL = '/Admin/Shell';

const component = (name: string) => {
  const found = artefact.components.find((c) => c.name === name);
  if (!found) throw new Error(`SBR-010: no component "${name}" in the artefact`);
  return found;
};

const nodesOf = (name: string): Node[] => {
  const out: Node[] = [];
  const walk = (n: Node) => {
    out.push(n);
    for (const c of n.children ?? []) walk(c);
  };
  for (const r of component(name).graph.roots) walk(r);
  return out;
};

const wiresOf = (name: string): Connection[] => component(name).graph.connections ?? [];

/** 🔴 The door reallocates ids (`inputs` ships as `inputs-14`), so nothing here keys on one. */
const byLabel = (name: string, label: string): Node => {
  const found = nodesOf(name).filter((n) => n.label === label);
  if (found.length !== 1) throw new Error(`SBR-010: ${found.length} nodes labelled "${label}" in ${name}, wanted 1`);
  return found[0];
};

/**
 * Runs a shipped `functionScript` the way the Function node's contract says it
 * is run: `Inputs` in, `Outputs` out.
 *
 * ⚠️ Node, not the runtime — see the header. What it grades is the body, which
 * is the half the browser drive cannot read back out of a rendered row.
 */
function runScript(script: string, inputs: Record<string, unknown>): Record<string, unknown> {
  const outputs: Record<string, unknown> = {};
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  new Function('Inputs', 'Outputs', script)(inputs, outputs);
  return outputs;
}

// ── §0. The instrument can see ───────────────────────────────────────────────

describe('SBR-010 §0 — the instrument can see', () => {
  /**
   * 🔴 Read this before believing any green below. Every assertion here is a
   * claim about a walk, and a walk that visited nothing is the same green as a
   * screen that is correct.
   */
  it('the walker reaches both components, and they are not empty', () => {
    expect(nodesOf(ROW).length).toBeGreaterThanOrEqual(8);
    expect(nodesOf(SCREEN).length).toBeGreaterThanOrEqual(10);
    expect(wiresOf(ROW).length).toBeGreaterThanOrEqual(8);
    expect(wiresOf(SCREEN).length).toBeGreaterThanOrEqual(6);
  });

  it('CONTROL: the walker returns nothing for a component that does not exist', () => {
    expect(() => nodesOf('/Pages/NoSuchScreen')).toThrow(/no component/);
  });
});

// ── §1. The record shape is the cloud function's, derived and not retyped ────

/**
 * Every field `submitContactForm` puts on a `ContactMessage`, read off SB-004's
 * own component rather than restated.
 *
 * Two sources, because the function uses both: `prop-<field>` arrives as a WIRE
 * for the four request parameters and as a PARAMETER for `handled`, and a
 * derivation that read only one of them would miss half the class.
 */
const storedFields = (): string[] => {
  const save = (CONTACT_NODES as Array<{ id: string; parameters?: Record<string, unknown> }>).find((n) => n.id === 'save');
  if (!save) throw new Error('SBR-010: no `save` node in CONTACT_NODES');
  const fromParams = Object.keys(save.parameters ?? {})
    .filter((k) => k.startsWith('prop-'))
    .map((k) => k.slice('prop-'.length));
  const fromWires = (CONTACT_WIRES as Connection[])
    .filter((w) => w.toId === 'save' && w.toProperty.startsWith('prop-'))
    .map((w) => w.toProperty.slice('prop-'.length));
  return [...new Set([...fromParams, ...fromWires])].sort();
};

const contactCollection = (): string => {
  const save = (CONTACT_NODES as Array<{ id: string; parameters?: Record<string, unknown> }>).find((n) => n.id === 'save');
  return String(save?.parameters?.collectionName);
};

describe('SBR-010 §1 — the row reads the class the cloud function writes', () => {
  it('CONTROL: the derivation found a real write set, from both of its sources', () => {
    // A derivation that returned `[]` would make every arm below vacuous, and
    // `handled` is the one field that comes from the PARAMETER half — so its
    // presence is what says both halves were read.
    expect(storedFields()).toEqual(['email', 'handled', 'message', 'name', 'pageSlug']);
    expect(contactCollection()).toBe('ContactMessage');
  });

  it('the query names the collection the cloud function writes — derived, not typed', () => {
    const query = byLabel(SCREEN, 'Every message, newest first');
    expect(query.type).toBe('DbCollection2');
    expect(query.parameters?.collectionName).toBe(contactCollection());
  });

  /**
   * 🔴 §4's first trap, as arithmetic: *"the record shape is whatever
   * `submitContactForm` stores today — don't invent a parallel class."*
   *
   * `For Each` delivers a declared input whose name matches a field and nothing
   * else (`foreach.tsx:594-596`), so a port list that drifted from the write set
   * would be a row silently rendering blanks. The one field deliberately NOT
   * read is `handled`, which is SBR-010's mark-as-read deferral: it is written
   * by the cloud function and read by nobody, and this arm is where that stops
   * being an accident.
   */
  it('every stored field except `handled` is a declared port, and `id` beside them', () => {
    const inputs = byLabel(ROW, 'The stored message');
    expect(inputs.type).toBe('Component Inputs');
    const declared = (inputs.ports ?? []).map((p) => p.name).sort();

    const wanted = storedFields().filter((f) => f !== 'handled');
    for (const field of wanted) expect(`${field}:${declared.includes(field)}`).toBe(`${field}:true`);

    // `id` is `For Each`'s own — `model.getId()`, not a field — and `createdAt`
    // is Parse's. Together with the four above, that is the whole list: a port
    // nobody derived would show up here.
    expect(declared).toEqual(['createdAt', 'email', 'id', 'message', 'name', 'pageSlug']);
    expect(declared).not.toContain('handled');
  });

  /**
   * ⚠️ `createdAt` is typed `*` and that is a measurement, not a shrug:
   * `_deserializeJSON` returns a `Date` when the class schema has loaded and
   * declares it one, and the ISO **string** the wire carried when it has not
   * (`cloudstore.js:345-356`). A port typed `string` would be a claim about
   * which of those two the row gets, and the row does not get to choose.
   */
  it('`createdAt` is the one port that cannot be typed', () => {
    const inputs = byLabel(ROW, 'The stored message');
    const port = (inputs.ports ?? []).find((p) => p.name === 'createdAt');
    expect(port?.type).toBe('*');
    // …and the control: every other port IS typed, so `*` is a decision about
    // this port rather than the file's habit.
    for (const p of inputs.ports ?? []) {
      if (p.name !== 'createdAt') expect(`${p.name}:${p.type}`).toBe(`${p.name}:string`);
    }
  });
});

// ── §2. The rail item finally goes somewhere ────────────────────────────────

describe('SBR-010 §2 — the Messages item in the sidebar navigates', () => {
  /**
   * 🔴 **The whole of the shell's share of this task, and it is one wire.**
   * `navMessages` has rendered since SBR-006 and taken the current-item styling
   * like its siblings for eleven sessions while doing nothing — which is why
   * "the item is in the sidebar" was never evidence of anything.
   */
  it('navMessages.onClick reaches a RouterNavigate aimed at /Pages/Messages', () => {
    const item = byLabel(SHELL, 'Messages');
    const target = byLabel(SHELL, 'To the messages list');
    expect(target.type).toBe('RouterNavigate');
    // A component legacyName, never an invented URL path — the mistake the MCP
    // guidance names outright, and the door refuses (`unresolved-navigation`).
    expect(target.parameters?.target).toBe(SCREEN);
    expect(
      wiresOf(SHELL).some(
        (w) => w.fromId === item.id && w.fromProperty === 'onClick' && w.toId === target.id && w.toProperty === 'navigate'
      )
    ).toBe(true);
  });

  it('MUTANT: without that wire the rail item is decoration again', () => {
    const item = byLabel(SHELL, 'Messages');
    const target = byLabel(SHELL, 'To the messages list');
    const without = wiresOf(SHELL).filter((w) => !(w.fromId === item.id && w.toId === target.id));
    expect(without.length).toBe(wiresOf(SHELL).length - 1);
    expect(without.some((w) => w.fromId === item.id && w.toProperty === 'navigate')).toBe(false);
  });

  /**
   * The screen places the shell with the THIRD distinct `active`, and the value
   * has to be one the shell's own script knows — a screen saying `'inbox'` would
   * render a rail with nothing lit and no diagnostic anywhere.
   */
  it('the screen lights its own rail item, and the shell knows the word', () => {
    const placement = byLabel(SCREEN, 'Admin shell');
    expect(placement.type).toBe(SHELL);
    expect(placement.parameters?.active).toBe('messages');

    // 🔴 The shell's script is RUN with the word the screen sends, rather than
    // searched for it. A `toContain` would pass on the word appearing in a
    // comment, in a dead branch, or in an output name nothing reads — and this
    // repo has been bitten by exactly that. Starve the candidate instead: feed
    // it `'messages'` and read what it publishes.
    const style = String(byLabel(SHELL, 'Colour and weight for the current item').parameters?.functionScript);
    const lit = runScript(style, { active: 'messages' });
    expect(lit.messagesColor).toBe('var(--primary)');
    expect(lit.messagesWeight).toBe('var(--font-semibold)');
    // …and the negative control in the same reading: the other two rail items
    // are NOT lit, so the arm is about the word and not about the node always
    // answering `--primary`.
    expect(lit.pagesColor).toBe('var(--foreground)');
    expect(lit.themeColor).toBe('var(--foreground)');

    // …and the mirror: a screen that sends some other word lights nothing, which
    // is what makes `active` a real interface rather than a decoration.
    const dark = runScript(style, { active: 'inbox' });
    expect(dark.messagesColor).toBe('var(--foreground)');
  });
});

// ── §3. AC3's pair — one node says both sentences ───────────────────────────

describe('SBR-010 §3 — the empty state and the count are the same node', () => {
  const tally = () => String(byLabel(SCREEN, 'The row-count sentence').parameters?.functionScript);

  /**
   * 🔴 **AC3, run rather than read.** SBR-016's finding is that *we asked and
   * there is nothing* and *nothing whatsoever* render identically, and this
   * screen is where the two are furthest apart: a new site with a working form
   * and a broken query look the same to its owner.
   */
  it('zero rows produce the empty SENTENCE, not the count with a zero in it', () => {
    expect(runScript(tally(), { rows: [] }).sentence).toBe(EMPTY_MESSAGE_LIST_TEXT);
    // The sentence says what would change it — a count could not.
    expect(EMPTY_MESSAGE_LIST_TEXT).toContain('contact form');
  });

  it('…and with rows it does NOT say it — the pair, in one node', () => {
    expect(runScript(tally(), { rows: [{}] }).sentence).toBe('One message');
    expect(runScript(tally(), { rows: [{}, {}, {}] }).sentence).toBe('Three messages');
    for (const n of [1, 2, 3, 9]) {
      const rows = Array.from({ length: n }, () => ({}));
      expect(runScript(tally(), { rows }).sentence).not.toBe(EMPTY_MESSAGE_LIST_TEXT);
    }
  });

  it('a row count the words run out for degrades to a numeral rather than to `undefined`', () => {
    const rows = Array.from({ length: 24 }, () => ({}));
    expect(runScript(tally(), { rows }).sentence).toBe('24 messages');
  });

  /**
   * The sentence only ever runs because the query returns: `fetched` fires on a
   * successful query whatever the row count (`dbcollectionnode2.ts:895`), and
   * SBR-016 is the task that had to make that true before an empty state could
   * mean anything.
   */
  it('the sentence is driven by `fetched`, and the refusal by `failure`', () => {
    const query = byLabel(SCREEN, 'Every message, newest first');
    const node = byLabel(SCREEN, 'The row-count sentence');
    const state = byLabel(SCREEN, 'Did the last query refuse?');
    const wires = wiresOf(SCREEN);

    expect(wires).toContainEqual({ fromId: query.id, fromProperty: 'fetched', toId: node.id, toProperty: 'run' });
    expect(wires).toContainEqual({ fromId: query.id, fromProperty: 'items', toId: node.id, toProperty: 'in-rows' });
    // 🔴 `failure`, never `fetched`, for the refusal — and `fetched` clears it,
    // so a refusal cannot outlive a later good fetch and stand beside a
    // populated list.
    expect(wires).toContainEqual({ fromId: query.id, fromProperty: 'failure', toId: state.id, toProperty: 'to-Refused' });
    expect(wires).toContainEqual({ fromId: query.id, fromProperty: 'fetched', toId: state.id, toProperty: 'to-Quiet' });

    const refusal = byLabel(SCREEN, 'The message list was refused');
    // 🔴 `mounted`, never `visible`: a refusal that has not happened must take no
    // space. P78 D16 was exactly that bug in this template.
    expect(refusal.parameters?.mounted).toBe(false);
    expect(refusal.parameters?.text).toBe(MESSAGE_LIST_ERROR_TEXT);
    expect(wires).toContainEqual({ fromId: state.id, fromProperty: 'refused', toId: refusal.id, toProperty: 'mounted' });
  });

  /**
   * 🔴 **`false`, and a browser is what settled it.** The box started `true` —
   * copied from `/Pages/Admin`'s `count`, where the argument is that an absent
   * key would be rewritten by the NDA-017 migration — and the drive read the
   * consequence on a signed-out visitor's screen: the refusal AND *"No messages
   * yet"*, together, one of them a lie told to somebody who was never allowed to
   * ask. `run` is ADDITIVE: `items` publishing an empty collection ran the
   * script with no successful query behind it.
   *
   * With the box off, `fetched` is the only trigger. The rows still ARRIVE —
   * the `items` wire is untouched — because `Node.update` drains one queued
   * value from every input before running the callbacks `fetched` scheduled.
   *
   * ⚠️ **`/Pages/Admin`'s `count` is wired identically and still says `true`**,
   * so the page list is expected to carry the same defect. Registered as D43 and
   * deliberately NOT changed here: that screen carries three other tasks'
   * verified acceptance criteria.
   */
  it('`runOnChange-in-rows` is stated FALSE, so a refused query cannot say "none"', () => {
    expect(byLabel(SCREEN, 'The row-count sentence').parameters?.['runOnChange-in-rows']).toBe(false);
  });

  it('D43: the page list still has the shape this screen was repaired out of', () => {
    // 🔴 A register row that is a MEASUREMENT rather than a note. It reddens the
    // day somebody fixes `/Pages/Admin`, which is the only way a row like this
    // gets closed rather than forgotten — and it names the twin so the next
    // reader does not have to rediscover that there is one.
    const count = artefact.components
      .find((c) => c.name === '/Pages/Admin')!
      .graph.roots.flatMap(function flat(n: Node): Node[] {
        return [n, ...(n.children ?? []).flatMap(flat)];
      })
      .find((n) => n.label === 'The row-count sentence');
    expect(count?.parameters?.['runOnChange-in-rows']).toBe(true);
  });
});

// ── §4. AC4 — newest first, and it is the backend that sorts ────────────────

describe('SBR-010 §4 — the list is ordered newest-first by the query', () => {
  /**
   * 🔴 A sort applied after the fetch would be right only while every row fitted
   * in one response. `convertVisualSorting` lowers this to Parse's `-createdAt`
   * (`queryutils.ts:440`), so the ORDER is a property of the collection.
   */
  it('the query carries the descending `createdAt` sort, and it is the shared constant', () => {
    const query = byLabel(SCREEN, 'Every message, newest first');
    expect(query.parameters?.visualSort).toEqual(MESSAGE_SORT);
    expect(MESSAGE_SORT).toEqual([{ property: 'createdAt', order: 'descending' }]);
  });

  it('…and the row declares the field that sort is over, so it can show it', () => {
    const declared = (byLabel(ROW, 'The stored message').ports ?? []).map((p) => p.name);
    expect(declared).toContain(String(MESSAGE_SORT[0].property));
  });

  it('MUTANT: an unsorted query renders whatever the backend happened to return', () => {
    const query = { ...byLabel(SCREEN, 'Every message, newest first') };
    const parameters = { ...(query.parameters ?? {}) };
    delete parameters.visualSort;
    expect(parameters.visualSort).toBeUndefined();
    // The arm above would pass on `[]` as readily as on the right sort if it
    // compared nothing, so the constant is asserted to be non-empty here too.
    expect(MESSAGE_SORT.length).toBe(1);
  });

  it('the list repeats the row component, and the row is what the template names', () => {
    const list = byLabel(SCREEN, 'One row per message');
    expect(list.type).toBe('For Each');
    expect(list.parameters?.templateType).toBe('explicit');
    expect(list.parameters?.template).toBe(ROW);
    const query = byLabel(SCREEN, 'Every message, newest first');
    expect(wiresOf(SCREEN)).toContainEqual({
      fromId: query.id,
      fromProperty: 'items',
      toId: list.id,
      toProperty: 'items'
    });
  });
});

// ── §5. The row is an interface, not a picture ──────────────────────────────

describe('SBR-010 §5 — the row renders the record and nothing else', () => {
  /**
   * 🔴 **The MCP guidance's ghost, asserted:** *"a component without a Component
   * Inputs renders identically however many times you place it."* A row whose
   * text came from constants would satisfy every layout gate in this repository
   * and draw the same message N times.
   *
   * So: every `Text` in the row has an EMPTY standing `text` and a wire into it.
   * Empty rather than absent is SB-018 (3) — `Text` declares `default: 'Text'`
   * and a node whose only `text` is a wire renders the literal word **Text**
   * until that wire first publishes.
   */
  it('every Text in the row is wired, and none of them carries a person-visible constant', () => {
    const texts = nodesOf(ROW).filter((n) => n.type === 'Text');
    expect(texts.length).toBeGreaterThanOrEqual(4);
    const wires = wiresOf(ROW);
    for (const t of texts) {
      expect(`${t.label}: ${JSON.stringify(t.parameters?.text)}`).toBe(`${t.label}: ""`);
      const fed = wires.some((w) => w.toId === t.id && w.toProperty === 'text');
      expect(`${t.label}: fed=${fed}`).toBe(`${t.label}: fed=true`);
    }
  });

  it('every wire in the row starts at the interface or at the node the interface feeds', () => {
    const inputs = byLabel(ROW, 'The stored message');
    const stamp = byLabel(ROW, 'The two derived sentences');
    const sources = new Set([inputs.id, stamp.id]);
    for (const w of wiresOf(ROW)) {
      expect(`${w.fromId}.${w.fromProperty}: derived=${sources.has(w.fromId)}`).toBe(
        `${w.fromId}.${w.fromProperty}: derived=true`
      );
    }
    // …and `stamp` itself is fed by the interface, so the chain has no free end.
    const intoStamp = wiresOf(ROW).filter((w) => w.toId === stamp.id);
    expect(intoStamp.length).toBeGreaterThanOrEqual(3);
    for (const w of intoStamp) expect(w.fromId).toBe(inputs.id);
  });
});

// ── §6. The derived sentences, run ──────────────────────────────────────────

describe('SBR-010 §6 — the received stamp survives both shapes `createdAt` arrives in', () => {
  const stamp = () => String(byLabel(ROW, 'The two derived sentences').parameters?.functionScript);
  const ISO = '2026-09-01T20:41:05.000Z';
  const SHAPE = /^\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2}$/;

  /**
   * 🔴 **The arm this file exists for.** `_deserializeJSON` returns a `Date` when
   * the class schema has loaded and declares `createdAt` a Date, and the ISO
   * string the wire carried when it has not — the branch is keyed on the SCHEMA,
   * not on the value (`cloudstore.js:345-356`). So the same row, rendered before
   * and after the schema arrives, hands this script two different types. A
   * formatter that handled one of them would be right most of the time.
   */
  it('a Date and its own ISO string produce the SAME sentence', () => {
    const fromDate = runScript(stamp(), { createdAt: new Date(ISO), name: 'Ada' });
    const fromString = runScript(stamp(), { createdAt: ISO, name: 'Ada' });
    expect(fromDate.when).toBe(fromString.when);
    expect(String(fromDate.when)).toMatch(SHAPE);
  });

  /**
   * ⚠️ TZ-independent on purpose: the assertion is the SHAPE and the agreement
   * between the two input types, never a literal clock reading. A spec that
   * pinned `22:41` would be a claim about the machine that ran it — which is
   * also why the script does not call `toLocaleString()`.
   */
  it('a missing or unreadable time says so, rather than rendering an empty cell', () => {
    for (const bad of [undefined, null, '', 'not a date']) {
      expect(runScript(stamp(), { createdAt: bad, name: 'Ada' }).when).toBe('Received at an unknown time');
    }
  });

  it('a nameless sender is filed under the SAME fallback the email uses', () => {
    expect(runScript(stamp(), { name: '', createdAt: ISO }).who).toBe(ANONYMOUS_SENDER);
    expect(runScript(stamp(), { name: '   ', createdAt: ISO }).who).toBe(ANONYMOUS_SENDER);
    expect(runScript(stamp(), { name: 'Ada Lovelace', createdAt: ISO }).who).toBe('Ada Lovelace');

    // 🔴 The derivation, not a matching literal: the owner reads the mail that
    // arrived in their inbox and this row about the SAME event, and two
    // different fallbacks would make them look like two events.
    const compose = (CONTACT_NODES as Array<{ id: string; parameters?: Record<string, unknown> }>).find(
      (n) => n.id === 'compose'
    );
    expect(String(compose?.parameters?.functionScript)).toContain(ANONYMOUS_SENDER.toLowerCase());
  });

  /**
   * `pageSlug` is the ONE optional parameter of the four (`preq-pageSlug: false`
   * on the request node), so *absent* and *empty* are different facts about the
   * request — and only the first hides the line. An empty slug IS the site root.
   */
  it('the source line is mounted only when the request said which page it came from', () => {
    const absent = runScript(stamp(), { createdAt: ISO });
    expect(absent.hasSource).toBe(false);

    const root = runScript(stamp(), { createdAt: ISO, pageSlug: '' });
    expect(root.hasSource).toBe(true);
    expect(root.source).toBe('Sent from the home page');

    const named = runScript(stamp(), { createdAt: ISO, pageSlug: 'about' });
    expect(named.source).toBe('Sent from the about page');

    const line = byLabel(ROW, 'Which page it came from');
    // `mounted`, never `visible` — an absent line must take no space.
    expect(line.parameters?.mounted).toBe(false);
    const source = byLabel(ROW, 'The two derived sentences');
    expect(wiresOf(ROW)).toContainEqual({
      fromId: source.id,
      fromProperty: 'out-hasSource',
      toId: line.id,
      toProperty: 'mounted'
    });
  });

  it('CONTROL: the request really does make `pageSlug` the optional one', () => {
    const req = (CONTACT_NODES as Array<{ id: string; parameters?: Record<string, unknown> }>).find((n) => n.id === 'req');
    expect(req?.parameters?.['preq-pageSlug']).toBe(false);
    for (const required of ['name', 'email', 'message']) {
      expect(`${required}:${req?.parameters?.[`preq-${required}`]}`).toBe(`${required}:true`);
    }
  });
});

// ── §7. The scope, asserted as arithmetic ───────────────────────────────────

describe('SBR-010 §7 — read-only is the scope, and the screen says so', () => {
  /**
   * 🔴 §2's third bullet. A deferral nobody can enumerate is indistinguishable
   * from an omission nobody noticed, so the four are a list — and this arm is
   * what stops a Reply arriving without the list being revisited.
   */
  it('neither component holds a node that could write, delete or call anything', () => {
    const WRITERS = ['NewDbModelProperties', 'SetDbModelProperties', 'DeleteDbModelProperties', 'CloudFunction2', 'DbModel2'];
    for (const name of [ROW, SCREEN]) {
      const found = nodesOf(name)
        .filter((n) => WRITERS.includes(n.type))
        .map((n) => `${name} ${n.type} ${n.label}`);
      expect(found).toEqual([]);
    }
    // …beside the signal that makes that emptiness mean something: those node
    // types DO exist in this artefact, on other screens.
    const elsewhere = artefact.components
      .filter((c) => c.name !== ROW && c.name !== SCREEN)
      .flatMap((c) => {
        const out: string[] = [];
        const walk = (n: Node) => {
          if (WRITERS.includes(n.type)) out.push(`${c.name} ${n.type}`);
          for (const k of n.children ?? []) walk(k);
        };
        for (const r of c.graph.roots) walk(r);
        return out;
      });
    expect(elsewhere.length).toBeGreaterThan(0);
  });

  it('the deferral list names four things, each with a reason', () => {
    expect(MESSAGES_DEFERRED.map((d) => d.what).sort()).toEqual(['delete', 'live refresh', 'mark as read', 'reply']);
    for (const d of MESSAGES_DEFERRED) expect(`${d.what}: ${d.why.length > 40}`).toBe(`${d.what}: true`);
  });

  /**
   * The delete deferral is not a preference — the policy already refuses it, and
   * a button that could only ever fail is worse than no button. Derived from the
   * shipped policy so it cannot quietly stop being true.
   */
  it('`delete` is refused by the shipped policy, which is why there is no button', () => {
    expect(SITE_SECURITY.collections.ContactMessage.permissions.delete).toBe('nobody');
    expect(SITE_SECURITY.collections.ContactMessage.permissions.create).toBe('nobody');
  });

  /**
   * 🔴 **AC2's structural half.** The person half — an anonymous reader actually
   * being refused — is over real HTTP in the drive; this is the rule that has to
   * be true for it, read off the file that ships.
   */
  it('AC2 (structural): reading messages is admin-only in the shipped policy', () => {
    expect(SITE_SECURITY.collections.ContactMessage.permissions.find).toBe('role:admin');
    expect(SITE_SECURITY.collections.ContactMessage.permissions.get).toBe('role:admin');
    // The control: the policy is not admin-only about everything, so the arm
    // above is about this collection rather than about the file.
    expect(SITE_SECURITY.collections.Page.permissions.find).toBe('public');
  });

  it('the screen tells the owner what it does NOT do, in a sentence', () => {
    const note = byLabel(SCREEN, 'What this screen does not do');
    expect(note.parameters?.text).toBe(MESSAGES_READ_ONLY_TEXT);
    // It names the thing that DOES work rather than only the thing that does
    // not — the states rule: a surface that cannot answer says what to do next.
    expect(MESSAGES_READ_ONLY_TEXT).toContain('address');
  });

  it('the page is a page: a Page root, an admin path, and it registers itself', () => {
    const page = byLabel(SCREEN, 'Messages');
    expect(page.type).toBe('Page');
    expect(page.parameters?.title).toBe('Messages');
    expect(page.parameters?.urlPath).toBe('admin/messages');
  });
});
