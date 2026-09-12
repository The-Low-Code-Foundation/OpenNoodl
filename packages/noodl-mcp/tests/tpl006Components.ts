/**
 * TPL-006 — the story engine: a branching story whose whole creative surface is
 * one JSON array.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## What this template is, and the one sentence it is graded against
 *
 * Richard, 2026-09-11: *"you can build anything with Claude Code today, fine, but
 * **can you go in and edit it afterwards?** I love how with the dungeon game you
 * made that you can edit the static JSON file to create new levels."*
 *
 * So the sentence that has to be true when this ships:
 *
 * > **A person can ship a completely different game by editing one JSON array,
 * > and never open the node graph once.**
 *
 * A new dungeon level is more of the same game. A new `story.json` is a detective
 * novel, an onboarding walkthrough, a D&D one-shot, a language lesson or a sales
 * demo — a different product out of the same graph.
 *
 * ## 🔴 The corollary, which is the hardest rule in this file
 *
 * **The graph is an interpreter, not a story.** Any passage text, title or choice
 * label hard-coded into a node breaks the claim, because it is content a person
 * has to open the graph to change — and it renders identically, which is why
 * `tpl006Template.test.ts` §6 reads every authored parameter in the built
 * artefact and fails if the demo story appears anywhere except the one
 * `Static Data` node that is the authoring surface.
 *
 * ⚠️ **The gate had to be written as "exactly one parameter", not "no
 * parameter".** The story has to live somewhere, and the literal reading of AC6
 * fails on the node the template exists to show you. One is the claim; two is the
 * defect.
 *
 * ## The data shape — the entire authoring surface, and four verbs
 *
 * ```json
 * [
 *   { "id": "start", "title": "…", "text": "…",
 *     "choices": [
 *       { "label": "…", "goto": "log", "gives": "the keeper's name" },
 *       { "label": "…", "goto": "end", "requires": "the keeper's name" }
 *     ] }
 * ]
 * ```
 *
 * **`goto`** moves, **`requires`** hides a choice until you carry a thing,
 * **`gives`** hands you one, and **an absent `choices` array is an ending**.
 * 🔴 **Resist a fifth verb** — each one is a line of the README nobody reads and a
 * branch in the interpreter.
 *
 * ## 🔴 Interactive fiction is the genre that does not want the missing node
 *
 * TPL-005's first finding was **D40 — there is no ticker node**, and the dungeon
 * had to become turn-based to survive it. **Interactive fiction is structurally
 * turn-based**: nothing moves until the reader chooses. The product's sharpest
 * limitation is invisible here rather than worked around.
 *
 * ## 🔴 Zero `noodl_modules`, and what that cost
 *
 * `Text Input` takes `type: 'textArea'` out of the box, so the Remix page needs
 * nothing installed. The one thing a module would have bought is a literal
 * clipboard write (`library/modules/clipboard` ships `nodegx.clipboard`, zero
 * dependencies), and it is **deliberately not used**:
 *
 * - AC4 asserts zero modules on the artefact directory, and a zero-module project
 *   is strictly easier to zip, deploy and open than TPL-005's one-module one;
 * - **D41 measured that a module can fail to register in a two-module project**
 *   while registering cleanly beside all 32 — a template is exactly the arm where
 *   that happens;
 * - and the affordance it would buy is one the page already has. The Remix box
 *   **opens holding the story that is playing** ({@link PARSE_STORY_SCRIPT}'s
 *   counterpart, `Story/Source.json`), so "copy the current story" is select-all
 *   in a box a person is already editing, and the round-trip is a product action
 *   rather than a clipboard API that is refused on plain http.
 *
 * ⚠️ Recorded as a deviation from AC3's wording rather than as a pass: AC3 asks
 * for a Copy button. There is no button; there is a box that is already full.
 *
 * ## 🔴 The repeater rule, which is the one most likely to be got wrong
 *
 * A row publishes to the `For Each`, not to the page. Every output on the template
 * component reappears on the repeater — a signal as `itemOutputSignal-<name>`, a
 * value as `itemOutput-<name>` — and **the value is flagged dirty BEFORE the
 * signal is sent** (`foreach.tsx:921-927`, read rather than assumed), so
 * `itemOutput-goto → Set Variable.value` beside `itemOutputSignal-picked →
 * Set Variable.do` cannot write a stale target.
 *
 * ⚠️ **And the id only moves if the signal is consumed**, which is why nothing
 * here wires `itemActionItemId`: the row publishes what the page needs
 * (`goto`, `gives`) directly, the way `/Navigation Menu` and `/App Shell` do in
 * the shipped prefab library (`itemOutputSignal-Click` + `itemOutput-Url` into one
 * `RouterNavigate`).
 *
 * ## 🔴 `white-space: pre` is the defect this template would otherwise ship
 *
 * Measured in `Text.tsx:79-85`: a `Text` node with `sizeMode: 'contentSize'` or
 * `'contentWidth'` gets `white-space: pre` — **it does not wrap**. Every other
 * template in this repo sets `contentSize` on almost every `Text`, because their
 * strings are short. This one's strings are paragraphs with `\n\n` in them, so a
 * `contentSize` prose node renders as a handful of lines running off the right of
 * the screen, on a page that otherwise looks perfect. The prose nodes are
 * `contentHeight`, and {@link PROSE_NODES} names them so the gate can check.
 *
 * @module noodl-mcp/tests/tpl006Components
 */
import { composition, MEANING } from './tpl006Theme';

/** The router every page registers into. */
export const ROUTER = 'Main';

/** One component, in the shape `create_component` takes. */
export interface Tpl006Component {
  path: string;
  nodes: unknown[];
  connections: unknown[];
}

// ── The components' legacy names, spelled once ───────────────────────────────

export const SOURCE_COMPONENT = '/Story/Source';
export const PASSAGE_COMPONENT = '/Story/Passage';
export const CHOICE_COMPONENT = '/Story/Choice';
export const CARRIED_COMPONENT = '/Story/Carried';
export const SIDEBAR_COMPONENT = '/Story/Sidebar';
export const PASTER_COMPONENT = '/Story/Paster';
export const PAGE_READ = '/Pages/Read';
export const PAGE_REMIX = '/Pages/Remix';

/** The label prefix the editor's node tree lists, and `START-HERE.md` is built from. */
export const EDIT = 'EDIT — ';

/** The app-wide variables. Spelled once, because a typo here is a story that never moves. */
export const VAR_AT = 'storyAt';
export const VAR_CARRYING = 'storyCarrying';
export const VAR_PASTED = 'storyPasted';

/** A reading measure. 42rem of prose is about 70 characters a line, which is where reading is fastest. */
export const MEASURE = 680;

const TYPE_TEXT_INPUT = 'net.noodl.controls.textinput';
const TYPE_BUTTON = 'net.noodl.controls.button';
const CSS_NODE = 'CSS Definition';
const FUNCTION_NODE = 'JavaScriptFunction';
const STATES_NODE = 'States';
const STATIC_DATA_NODE = 'Static Data';
const FOR_EACH_NODE = 'For Each';
const VARIABLE_NODE = 'Variable2';
const SET_VARIABLE_NODE = 'Set Variable';
const EXPRESSION_NODE = 'Expression';
const CONDITION_NODE = 'Condition';
const INVERTER_NODE = 'Inverter';
const NAVIGATE_NODE = 'RouterNavigate';

const px = (value: number) => ({ value, unit: 'px' });
const pct = (value: number) => ({ value, unit: '%' });

/**
 * A composition's parameters, sized to their content.
 *
 * 🔴 The door raises `inert-dimension` when a `width` survives beside a `sizeMode`
 * that ignores it — *"the value is never read"*. A parameter nothing reads is a
 * parameter the next person to open the panel will believe.
 */
function contentSized(params: Record<string, unknown>): Record<string, unknown> {
  // 🔴 The annotation is load-bearing. Without it TS infers the spread's literal
  // shape as `{ sizeMode: string }` and the two `delete`s below are errors — which
  // is how `typecheck:mcp` was red from the moment TPL-005 shipped this helper and
  // stayed red for a day: the jest run compiles with babel and never sees it.
  const out: Record<string, unknown> = { ...params, sizeMode: 'contentSize' };
  delete out.width;
  delete out.height;
  return out;
}

// ── Type, from the product's own compositions ───────────────────────────────

const H_TITLE = { ...composition('displayHeadline'), as: 'h1' };
const H_SECTION = { ...composition('sectionHeading'), as: 'h2' };
const T_EYEBROW = { ...composition('eyebrow'), as: 'span' };
const T_LEAD = composition('lead');
const T_BODY = composition('body');
const T_META = composition('meta');
const T_ERROR = composition('fieldError');
const BTN_PRIMARY = composition('primaryButton');
const BTN_OUTLINE = composition('outlineButton');
const BAND = composition('band');
const SHELL = composition('shell');

// ── Node helpers ────────────────────────────────────────────────────────────

function text(id: string, label: string, parent: string, value: string, params: Record<string, unknown>): unknown {
  return { id, type: 'Text', label, parent, parameters: { text: value, ...params } };
}

/**
 * A `Text` that holds prose — a paragraph, or several with blank lines between.
 *
 * 🔴 `sizeMode: 'contentHeight'` and never `contentSize`, for the reason in the
 * module header: `contentSize` renders `white-space: pre` and the prose stops
 * wrapping. {@link PROSE_NODES} lists every node built this way and the gate
 * asserts the size mode survived into the artefact.
 */
function prose(id: string, label: string, parent: string, value: string, params: Record<string, unknown>): unknown {
  return {
    id,
    type: 'Text',
    label,
    parent,
    parameters: { text: value, width: pct(100), sizeMode: 'contentHeight', ...params }
  };
}

function group(
  id: string,
  label: string,
  parent: string | undefined,
  params: Record<string, unknown>,
  children?: string[]
): unknown {
  const node: Record<string, unknown> = { id, type: 'Group', label, parameters: params };
  if (parent) node.parent = parent;
  if (children) node.children = children;
  return node;
}

/** A component instance, placed in the visual tree. */
function place(id: string, type: string, label: string, parent: string, parameters?: Record<string, unknown>): unknown {
  const node: Record<string, unknown> = { id, type, label, parent };
  if (parameters) node.parameters = parameters;
  return node;
}

/** A node with no parent — a logic node, or an instance of a component that draws nothing. */
function logic(id: string, type: string, label: string, parameters?: Record<string, unknown>): unknown {
  const node: Record<string, unknown> = { id, type, label };
  if (parameters) node.parameters = parameters;
  return node;
}

function inputs(id: string, label: string, ports: Array<[string, string]>): unknown {
  return { id, type: 'Component Inputs', label, ports: ports.map(([name, type]) => ({ name, type, plug: 'output' })) };
}

function outputs(id: string, label: string, ports: Array<[string, string]>): unknown {
  return { id, type: 'Component Outputs', label, ports: ports.map(([name, type]) => ({ name, type, plug: 'input' })) };
}

function wire(fromId: string, fromProperty: string, toId: string, toProperty: string): unknown {
  return { fromId, fromProperty, toId, toProperty };
}

/**
 * Untick every named value input's **Run On Value Change** checkbox, so the node
 * runs only when its control signal pulses.
 *
 * 🔴 This is what stops `takeWhatItGives` — fed by the very variable it writes —
 * from running forever. The port name is `runOnChange-<input>` and a Function's
 * value inputs are `in-<name>`.
 */
export function signalOnly(...inputNames: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const name of inputNames) out[`runOnChange-${name}`] = false;
  return out;
}

/** A `Condition` that tests only when `eval` pulses — every branch in this graph is one. */
function gate(id: string, label: string): unknown {
  return logic(id, CONDITION_NODE, label, { ...signalOnly('condition') });
}

// ── The branches that ARE the engine's decisions ─────────────────────────────

/**
 * Every branch in the engine, by node id, and what it decides.
 *
 * 🔴 `tpl006Template.test.ts` asserts each of these exists, is a `Condition`, and
 * has something wired into **both** its `eval` and its `condition` — a gate with
 * an unwired `eval` never fires, and one with an unwired `condition` tests a value
 * nothing supplies. Both render perfectly.
 *
 * ⚠️ **Three of the five are about the author's data, not about the reader.** A
 * `goto` that names no passage, a passage every one of whose choices is locked, and
 * JSON that will not parse are the three mistakes a person editing one array will
 * actually make, and an engine that answers any of them with a blank screen is an
 * engine that gets blamed for their typo.
 */
export const GATE_NODES: ReadonlyArray<{ id: string; component: string; decides: string }> = [
  { id: 'rdFoundGate', component: PAGE_READ, decides: 'is there a passage with that id?' },
  { id: 'rdEndGate', component: PAGE_READ, decides: 'is this passage an ending?' },
  { id: 'rdGiftGate', component: PAGE_READ, decides: 'did that choice hand you something new?' },
  { id: 'rdStuckGate', component: PAGE_READ, decides: 'is there any way on from this passage?' },
  { id: 'rxOkGate', component: PAGE_REMIX, decides: 'is what was pasted a story?' }
];

/**
 * Every `Function` node, and the seam it sits at.
 *
 * 🔴 The gate asserts this list is exactly the set of Function nodes in the
 * template — a sixth appearing without a line here is the failure this template is
 * written against, caught at the count rather than at a review.
 *
 * ⚠️ **`NODES BEFORE CODE, AND NEVER ALTERNATE.`** Each of these is one whole
 * calculation in one node. The branches between them are `Condition` nodes a person
 * can open and follow, and the one place a library node already does the job —
 * "is the inventory empty" — is an `Expression`, not a line of script.
 */
export const FUNCTION_SEAMS: ReadonlyArray<{ id: string; component: string; seam: string }> = [
  { id: 'srPick', component: SOURCE_COMPONENT, seam: 'which story is being read, and what it looks like as text' },
  { id: 'rdFind', component: PAGE_READ, seam: 'the passage you are in' },
  { id: 'rdScreen', component: PAGE_READ, seam: 'project the reader’s state onto the screen' },
  { id: 'rdCarry', component: PAGE_READ, seam: 'take what a choice gives you' },
  { id: 'rxParse', component: PAGE_REMIX, seam: 'read what was pasted, and say what is wrong with it' }
];

/**
 * Every `Text` node holding prose, and therefore every node where
 * `white-space: pre` would be a defect.
 *
 * 🔴 See the module header. The gate asserts none of these is `contentSize` or
 * `contentWidth`, because a prose node that stops wrapping is invisible in a graph
 * and ruins the page.
 */
export const PROSE_NODES: ReadonlyArray<{ id: string; component: string }> = [
  { id: 'psText', component: PASSAGE_COMPONENT },
  { id: 'chLabel', component: CHOICE_COMPONENT },
  { id: 'rdNote', component: PAGE_READ },
  { id: 'rdFoot', component: PAGE_READ },
  { id: 'rxLead', component: PAGE_REMIX },
  { id: 'rxHelpBody', component: PAGE_REMIX }
];

// ── The demo story ───────────────────────────────────────────────────────────

/**
 * *The Last Light*, written 2026-09-11 with the `story-craft` and `prose-craft`
 * skills Richard supplied, and held as a separate artefact so the prose can be
 * reviewed, replaced or overruled without touching a line of this file.
 *
 * 🔴 **It is loaded from disk rather than pasted in here, and that is the point.**
 * A story inlined in a TypeScript module is a story a person has to be a developer
 * to change. This module's job is to put it in one `Static Data` parameter and
 * stop.
 *
 * ⚠️ **The subject is still Richard's to overturn** (TPL-006 §6): he asked for the
 * story straight after reading the lighthouse mockups, which is a go in substance,
 * but an example's description is published and this is his product voice.
 * Overturning it costs the prose and nothing else — `STORY_FILE` is the only thing
 * that would change.
 */
export const STORY_FILE = 'dev-docs/tasks/phase-78-the-templates/tpl-006-the-last-light.json';

// ── The five scripts, one per seam ───────────────────────────────────────────

/**
 * Seam 1 — which story is being read, and what it looks like as text.
 *
 * Two sources, one answer: the story this template ships with, or the one somebody
 * pasted on the Remix page. It lives in `Story/Source` rather than on a page
 * because **both pages need the same answer** — the reader needs the passages, the
 * Remix box needs the same story as editable text — and two copies of that
 * decision would drift the first time one of them changed.
 *
 * 🔴 **`JSON.stringify` cannot be pointed at `Static Data.items`.** Those rows
 * arrive as runtime `Model` instances, not plain objects, so serialising them
 * would emit the record machinery rather than the story. This rebuilds plain
 * objects first, which is also what lets the copy keep an author's shape: a
 * passage with no `choices` comes back out with no `choices`, because that absence
 * is how an ending is written.
 *
 * ⚠️ A fresh array every run — `Outputs` publishes only on change, so a reused one
 * would never reach the graph.
 */
export const PICK_STORY_SCRIPT = `const shipped = Inputs.shipped || [];
const pasted = Inputs.pasted || [];
const playing = pasted.length > 0 ? pasted : shipped;

// Plain objects, rebuilt. Static Data hands out Model records, and JSON.stringify
// of a Model is the record machinery rather than the story.
const plain = [];
for (let i = 0; i < playing.length; i++) {
  const p = playing[i] || {};
  const one = { id: String(p.id || ''), title: String(p.title || ''), text: String(p.text || '') };
  // An absent choices array IS an ending, so the copy must not invent an empty one.
  const choices = p.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const kept = [];
    for (let c = 0; c < choices.length; c++) {
      const ch = choices[c] || {};
      const row = { label: String(ch.label || ''), goto: String(ch.goto || '') };
      if (ch.gives) row.gives = String(ch.gives);
      if (ch.requires) row.requires = String(ch.requires);
      kept.push(row);
    }
    one.choices = kept;
  }
  plain.push(one);
}

Outputs.story = plain;
Outputs.firstId = plain.length > 0 ? plain[0].id : '';
Outputs.json = JSON.stringify(plain, null, 2);
// One sentence rather than a name and a count on two ports: the page shows it
// whole, and a port nobody reads is a port the next reader has to rule out.
const whose = pasted.length > 0 ? 'Your story' : 'The story this template ships with';
Outputs.source = whose + ' — ' + plain.length + (plain.length === 1 ? ' passage' : ' passages');`;

/**
 * Seam 2 — the passage you are in.
 *
 * 🔴 **`firstId` is a fallback, not a convenience.** Before anything has written
 * `storyAt` the reader is at the beginning, and a seam that answered "no such
 * passage" for one frame would flash the broken-story state on every load. TPL-005
 * shipped exactly this bug as NaN coordinates: eight thrown scripts before a key
 * was pressed, and the board drew perfectly.
 *
 * ⚠️ So an empty `at` with an empty `firstId` is the one honest `found: false` at
 * load — a story with no passages in it — and the page says so in prose.
 */
export const FIND_PASSAGE_SCRIPT = `const story = Inputs.story || [];
// Where you are, or the beginning if you have not started. See the note above.
const at = String(Inputs.at || '') || String(Inputs.firstId || '');

let here = null;
for (let i = 0; i < story.length; i++) {
  if (String((story[i] || {}).id) === at) {
    here = story[i];
    break;
  }
}

// The id this seam SETTLED on, so nothing downstream has to re-derive the
// fallback and disagree with it for a frame.
Outputs.at = at;

if (here === null) {
  Outputs.found = false;
  Outputs.title = '';
  Outputs.text = '';
  Outputs.choices = [];
  Outputs.isEnding = false;
  Outputs.missing = at;
} else {
  const choices = Array.isArray(here.choices) ? here.choices : [];
  Outputs.found = true;
  Outputs.title = String(here.title || '');
  Outputs.text = String(here.text || '');
  // A fresh array: Outputs publishes only on change.
  Outputs.choices = choices.slice();
  Outputs.isEnding = choices.length === 0;
  Outputs.missing = '';
}`;

/**
 * Seam 3 — project the reader's state onto the screen.
 *
 * The one seam left fully reactive, because following the state is its whole job —
 * the same role `buildCells` plays in TPL-005.
 *
 * 🔴 **A locked choice is ABSENT, and that is a story decision, not a UI one.**
 * There is no greyed-out row, no padlock and no hint. A reader who never read the
 * log never learns the third way out existed, which is the only reason the ending
 * that needs it means anything. A future "helpful" affordance that revealed locked
 * choices would break the story rather than merely the plate it was drawn on.
 *
 * ⚠️ **Every row carries its own `id`, and it is `<passage>#<index>`.** Rows become
 * runtime records keyed by `id` in a process-wide registry, so two passages whose
 * choices were both called `0` would be the same record.
 */
export const SCREEN_SCRIPT = `const choices = Inputs.choices || [];
const carrying = Inputs.carrying || [];
const at = String(Inputs.at || '');
const isEnding = Inputs.isEnding === true;

const have = {};
for (let i = 0; i < carrying.length; i++) {
  const entry = carrying[i];
  const name = typeof entry === 'string' ? entry : String((entry || {}).thing || '');
  if (name !== '') have[name] = true;
}

const rows = [];
for (let i = 0; i < choices.length; i++) {
  const c = choices[i] || {};
  const needs = String(c.requires || '');
  // Absent, not greyed out. See the note above — this is the story, not the CSS.
  if (needs !== '' && have[needs] !== true) continue;
  rows.push({
    id: at + '#' + i,
    label: String(c.label || ''),
    goto: String(c.goto || ''),
    gives: String(c.gives || '')
  });
}

Outputs.rows = rows;
Outputs.carryCount = Object.keys(have).length;
// 🔴 A passage that is not an ending and has nothing the reader can take. Every
// choice it owns needs something they are not carrying, so the story stops here
// and nothing in the data says it meant to.
Outputs.stuck = !isEnding && rows.length === 0;`;

/**
 * Seam 4 — take what a choice gives you.
 *
 * Signal-driven: it is fed by the very variable it writes, so left reactive it runs
 * for ever. `runOnChange-in-carrying` and `runOnChange-in-gift` are unticked and the
 * gate checks they survived DEF-038's pinning pass.
 *
 * 🔴 **`added` is the whole reason this is one node rather than a branch.** The
 * script always runs on a pick and answers *whether there was anything to add*;
 * the `Condition` beside it decides whether to store the result. That is the shape
 * TPL-005's `takeCoin` ended up in after driving found the damage landing a move
 * late twice — the gate's condition and its `eval` come from the same script run
 * with nothing in between.
 *
 * ⚠️ Records, not strings, and deduplicated: `{ id, thing }` is what a repeater can
 * draw, and carrying the same thing twice is a list with a bug in it.
 */
export const CARRY_SCRIPT = `const carrying = Inputs.carrying || [];
const gift = String(Inputs.gift || '');

const out = [];
const seen = {};
for (let i = 0; i < carrying.length; i++) {
  const entry = carrying[i];
  const name = typeof entry === 'string' ? entry : String((entry || {}).thing || '');
  if (name === '' || seen[name] === true) continue;
  seen[name] = true;
  out.push({ id: name, thing: name });
}

if (gift === '' || seen[gift] === true) {
  Outputs.added = false;
} else {
  out.push({ id: gift, thing: gift });
  Outputs.added = true;
}

// A fresh array every run: Outputs publishes only on change, and a mutated array
// is the same object, so a reused one would never reach the graph.
Outputs.carrying = out;`;

/**
 * Seam 5 — read what was pasted, and say what is wrong with it.
 *
 * 🔴 **The first thing anyone does on the Remix page is paste something
 * malformed**, and a blank screen there kills the whole pitch. So this reports in
 * prose, and it checks the four things a person editing one array actually gets
 * wrong, in the order they get them wrong: not JSON, not a list, a passage with no
 * `id`, two passages with the same `id`, and a `goto` pointing at nothing.
 *
 * ⚠️ **The dangling `goto` check is the expensive one and it is the reason this is
 * worth a seam.** It is the mistake that produces a story which loads, reads
 * correctly, and dead-ends three clicks in — and the only place it can be caught
 * before a reader hits it is here.
 */
export const PARSE_STORY_SCRIPT = `const raw = String(Inputs.text || '').trim();

let problem = '';
let parsed = null;

if (raw === '') {
  problem = 'The box is empty. Paste a story — a list of passages — and press Read this story.';
} else {
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    problem = 'That is not valid JSON yet: ' + e.message;
  }
}

if (problem === '' && !Array.isArray(parsed)) {
  problem = 'A story is a list of passages, so the outermost brackets have to be [ ] rather than { }.';
}

const rows = [];
if (problem === '') {
  const ids = {};
  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i] || {};
    const id = String(p.id || '');
    if (id === '') {
      problem = 'Passage ' + (i + 1) + ' has no "id". Every passage needs one, because that is what a choice points at.';
      break;
    }
    if (ids[id] === true) {
      problem = 'Two passages are both called "' + id + '". Ids have to be unique or a choice cannot say which one it means.';
      break;
    }
    ids[id] = true;
    rows.push(p);
  }

  // The dangling goto: a story that loads, reads, and dead-ends three clicks in.
  if (problem === '') {
    for (let i = 0; i < rows.length && problem === ''; i++) {
      const choices = Array.isArray(rows[i].choices) ? rows[i].choices : [];
      for (let c = 0; c < choices.length; c++) {
        const target = String((choices[c] || {}).goto || '');
        if (target === '') {
          problem = 'A choice in "' + String(rows[i].id) + '" has no "goto", so there is nowhere for it to lead.';
          break;
        }
        if (ids[target] !== true) {
          problem = 'A choice in "' + String(rows[i].id) + '" points at "' + target + '", and there is no passage with that id.';
          break;
        }
      }
    }
  }

  if (problem === '' && rows.length === 0) {
    problem = 'That is an empty list. A story needs at least one passage.';
  }
}

Outputs.ok = problem === '';
Outputs.problem = problem;
// A fresh array either way, and empty when it could not be read — so a bad paste
// can never half-replace the story that is playing.
Outputs.story = problem === '' ? rows.slice() : [];`;

// ── The app shell ────────────────────────────────────────────────────────────

export const APP_COMPONENT = 'App';

/**
 * The things a node port cannot say about a page of prose.
 *
 * ⚠️ **Narrow on purpose.** Everything a port can express is set on the node. What
 * is left is the body's ground, two hover states, and the one rule that makes a
 * choice feel like a choice.
 *
 * The last block is not decoration: a person who has asked their operating system
 * to stop moving things gets a page that does not move.
 */
export const STORY_CSS = `/* The story engine — the few things a node port cannot say.
   Everything a port CAN express is set on the node, not here. */

.pressable { cursor: pointer; }

/* 🔴 The BODY's ground. A Group's backgroundColor cannot reach the body, so
   anything below the content is the browser's own white — which on a warm paper
   page reads as a seam across the screen. Only a stylesheet can paint it.
   (No backticks in this block: it lives inside a TS template literal.) */
html, body { background: var(--background); }

/* A choice lifts slightly under the pointer and settles back. 120ms is slow
   enough to be felt and fast enough not to be waited for. */
.story-choice {
  transition: background-color 120ms ease-out, border-color 120ms ease-out, transform 120ms ease-out;
}
.story-choice:hover {
  background-color: var(--surface-raised);
  border-color: var(--primary);
  transform: translateX(2px);
}

/* The paste box is code, so it is set in the mono face and given room to breathe
   between lines — a 400-line story in a 1.2 line-height box is unreadable. */
.story-paste {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  line-height: 1.55;
  tab-size: 2;
}

@media (prefers-reduced-motion: reduce) {
  .story-choice { transition: none; }
  .story-choice:hover { transform: none; }
}`;

export const APP_NODES = [
  group('app_root', 'App', undefined, {
    sizeMode: 'explicit',
    width: pct(100),
    height: pct(100),
    // 🔴 Without this the app ends where its content ends and the rest of the
    // viewport is the browser's white.
    backgroundColor: 'var(--background)'
  }, ['app_router']),
  { id: 'app_router', type: 'Router', label: 'Main router', parent: 'app_root', parameters: { name: ROUTER } },
  logic('app_css', CSS_NODE, 'The page — the ground, the hover, the paste box', { style: STORY_CSS })
];
export const APP_WIRES: unknown[] = [];

// ── Story/Source — the one place the story lives ─────────────────────────────

/**
 * The story, and the decision about which story is being read.
 *
 * 🔴 **A logic-only component, placed on both pages, and it is the answer to
 * "where does a person edit this?"** The whole creative work is one `Static Data`
 * parameter in here. It is not buried in a page among forty layout nodes; it is a
 * component in the tree called `Story/Source` whose only visible node is the one
 * labelled `EDIT — …`.
 *
 * 🔴 **And it is why there is only one copy.** The reader needs the passages and
 * the Remix box needs the same story as editable text. Putting the choice of story
 * on each page would be the same decision written twice — the shape
 * `a-second-copy-of-a-palette-drifts-silently` was filed for. Here both pages place
 * this component and read its outputs.
 *
 * ⚠️ **No `Component Inputs` at all, and that is correct rather than lazy.** It is
 * a source: nothing a parent could set would change what the story is. CMP-001's
 * own §10 shape — `Component Inputs` → working nodes → `Component Outputs` — names
 * the interface a *utility* carries, and the point of that clause is the
 * **outputs**: a logic component with no outputs is a node with extra steps. This
 * one publishes five, including the `ready` signal the page's boot chain runs on.
 */
function sourceComponent(storyJson: string): Tpl006Component {
  return {
    path: 'Story/Source',
    nodes: [
      {
        id: 'srStory',
        type: STATIC_DATA_NODE,
        label: `${EDIT}your story — every passage, in this one list`,
        parameters: { type: 'json', json: storyJson }
      },
      logic('srPasted', VARIABLE_NODE, 'A story somebody pasted on the Remix page', { name: VAR_PASTED }),
      logic('srPick', FUNCTION_NODE, 'Which story is being read', { functionScript: PICK_STORY_SCRIPT }),
      outputs('srOutputs', 'The story', [
        ['ready', 'signal'],
        ['story', 'array'],
        ['firstId', 'string'],
        ['source', 'string'],
        ['json', 'string']
      ])
    ],
    connections: [
      // 🔴 Nothing is wired to `srPick.run`, on purpose: a Function node auto-runs
      // at load ONLY if `run` is unconnected (`simplejavascript.ts`). Wiring
      // anything there would cost the boot, and nothing else on either page is
      // guaranteed to publish first — the app would open on an empty page.
      wire('srStory', 'items', 'srPick', 'in-shipped'),
      wire('srPasted', 'value', 'srPick', 'in-pasted'),
      wire('srPick', 'success', 'srOutputs', 'ready'),
      wire('srPick', 'out-story', 'srOutputs', 'story'),
      wire('srPick', 'out-firstId', 'srOutputs', 'firstId'),
      wire('srPick', 'out-source', 'srOutputs', 'source'),
      wire('srPick', 'out-json', 'srOutputs', 'json')
    ]
  };
}

// ── Story/Passage — the prose ────────────────────────────────────────────────

/**
 * One passage: an eyebrow, a title and the prose.
 *
 * 🔴 **This component is also TPL-006's re-measurement of D43**, and the control
 * is on the page beside it. D43 read *"a value wired into a States node's
 * `currentState` never changes its state"*, measured on TPL-005's `Game/Cell`.
 * Re-measured against the shipped prefab library: **ten** components wire a value
 * into `currentState` — `toast` `/Show Toast`, both `xano` clients,
 * `media-query`, `tab-bar` `/Tab Bar Item`, `table` `/Header Cell`,
 * `advanced-columns`, `toggle-switch`, and two in `stripe` — and four of those are
 * inside repeated rows, so "it is a repeater" is not the explanation either.
 *
 * ⚠️ **What TPL-005 did differently, and it is two things, both copied from the
 * library here:** every shipped instance sets `currentState` **as a parameter**
 * as well as wiring it, and every shipped `Component Inputs` port feeding that
 * wire is typed **`*`**, never `string`. `Game/Cell` did neither.
 *
 * So: `mode` is typed `*`, `psLook` carries `currentState: 'reading'`, and the
 * page drives it from a States node of its own that is driven by `to-<state>`
 * **signals** — the idiom that is known to work. Whichever way the render lands,
 * the row in TPL-005 §6 and the D43 memory get rewritten rather than left as two
 * half-true records.
 */
const PASSAGE_STATES = {
  states: 'reading,ending,lost,stuck',
  // 🔴 The parameter every one of the ten shipped instances sets. See above.
  currentState: 'reading',
  values: 'rule,eyebrow,tone',
  'type-rule': 'color',
  'type-eyebrow': 'string',
  'type-tone': 'color',
  // Reading — a quiet rule down the left, and a label that names where you are.
  'value-reading-rule': 'var(--border-strong)',
  'value-reading-eyebrow': 'You are here',
  'value-reading-tone': 'var(--muted-foreground)',
  // An ending — the rule takes the accent, because this is the last thing you read.
  'value-ending-rule': MEANING.choice,
  'value-ending-eyebrow': 'An ending',
  'value-ending-tone': MEANING.choice,
  // A passage that is not there. The only place the broken colour appears.
  'value-lost-rule': MEANING.broken,
  'value-lost-eyebrow': 'A passage that is not there',
  'value-lost-tone': MEANING.broken,
  // 🔴 A fourth state, added because DRIVING found the copy wrong. A passage whose
  // choices are all locked was being labelled "A passage that is not there" — it is
  // there, it was read, and the thing that is wrong is the author's `requires`.
  // Mapping two different data mistakes onto one label is the shape that gets a
  // person looking for the wrong bug.
  'value-stuck-rule': MEANING.broken,
  'value-stuck-eyebrow': 'No way on from here',
  'value-stuck-tone': MEANING.broken,
  // 🔴 FALSE, and it is the difference between this panel working and not.
  // Measured in a browser with the control beside it (TPL-006 §6): with
  // `useTransitions: true` — which is the port's DEFAULT — a States node publishes
  // its string and boolean values on a state change and **never publishes a colour
  // or a number at all**. Sampled at 0, 60, 150, 320, 700 and 1500ms after the
  // change: the eyebrow string flipped at 60ms and both colours read their
  // previous value at every sample. With it false, all three change together.
  // Registered as a product defect; do not "tidy" this back to the default.
  useTransitions: false
};

const PASSAGE: Tpl006Component = {
  path: 'Story/Passage',
  nodes: [
    group('psWrap', 'One passage', undefined, {
      width: pct(100),
      sizeMode: 'contentHeight',
      flexDirection: 'column',
      alignItems: 'flex-start',
      rowGap: 'var(--space-3)',
      paddingLeft: 'var(--space-6)',
      borderLeftStyle: 'solid',
      borderLeftWidth: 'var(--border-2)',
      borderLeftColor: 'var(--border-strong)'
    }, ['psEyebrow', 'psTitle', 'psText']),
    text('psEyebrow', 'Where you are', 'psWrap', '', { ...T_EYEBROW, sizeMode: 'contentSize' }),
    // The page's one display headline, and it comes from the data.
    prose('psTitle', 'The passage title', 'psWrap', '', {
      ...H_TITLE,
      fontFamily: 'var(--font-serif)',
      fontSize: px(34),
      lineHeight: 1.2
    }),
    // 🔴 `contentHeight`, never `contentSize` — see `prose()` and the module header.
    prose('psText', 'The passage itself', 'psWrap', '', {
      ...T_BODY,
      fontFamily: 'var(--font-serif)',
      fontSize: px(19),
      lineHeight: 1.72,
      maxWidth: px(MEASURE),
      color: 'var(--foreground)'
    }),
    logic('psLook', STATES_NODE, 'Reading, an ending, or a passage that is not there', PASSAGE_STATES),
    inputs('psInputs', 'The passage', [
      ['title', 'string'],
      ['text', 'string'],
      // 🔴 `*`, not `string`. Every one of the ten shipped prefabs that drives a
      // States node from a component input types this port `*`.
      ['mode', '*']
    ])
  ],
  connections: [
    wire('psInputs', 'title', 'psTitle', 'text'),
    wire('psInputs', 'text', 'psText', 'text'),
    // 🔴 THE D43 PROBE. See the note above.
    wire('psInputs', 'mode', 'psLook', 'currentState'),
    wire('psLook', 'rule', 'psWrap', 'borderLeftColor'),
    wire('psLook', 'eyebrow', 'psEyebrow', 'text'),
    wire('psLook', 'tone', 'psEyebrow', 'color')
  ]
};

// ── Story/Choice — one thing you can do next ─────────────────────────────────

/**
 * One choice, and the only interactive thing on the reading page.
 *
 * 🔴 **It publishes `goto` and `gives` as well as `picked`, and that is the
 * repeater contract rather than three ports for the sake of it.** The page never
 * places this component — a `For Each` does — so a row that only published a
 * signal would leave the page knowing that *something* was clicked and not which.
 * Every output reappears on the repeater (`itemOutputSignal-picked`,
 * `itemOutput-goto`, `itemOutput-gives`) and the values land before the signal
 * (`foreach.tsx:921-927`), which is exactly how `/Navigation Menu` and `/App Shell`
 * drive one `RouterNavigate` out of a list in the shipped library.
 *
 * ⚠️ **`label`, `goto` and `gives` are not wired from the page either.** A
 * repeater copies each row's fields onto the item's `Component Inputs` by name
 * (`foreach.tsx:595`), so the row shape `{ id, label, goto, gives }` that
 * {@link SCREEN_SCRIPT} emits arrives on its own. The ports have to exist; nothing
 * has to be drawn.
 */
const CHOICE: Tpl006Component = {
  path: 'Story/Choice',
  nodes: [
    group('chRow', 'One choice', undefined, {
      width: pct(100),
      sizeMode: 'contentHeight',
      flexDirection: 'row',
      alignItems: 'flex-start',
      columnGap: 'var(--space-3)',
      paddingTop: 'var(--space-4)',
      paddingBottom: 'var(--space-4)',
      paddingLeft: 'var(--space-5)',
      paddingRight: 'var(--space-5)',
      backgroundColor: 'var(--surface)',
      borderStyle: 'solid',
      borderWidth: 'var(--border-1)',
      borderColor: 'var(--border)',
      borderRadius: 'var(--radius-md)',
      cssClassName: 'story-choice pressable'
    }, ['chMark', 'chLabel']),
    text('chMark', 'The marker', 'chRow', '→', {
      ...T_BODY,
      color: MEANING.choice,
      fontWeight: 'var(--font-semibold)',
      sizeMode: 'contentSize'
    }),
    // `contentHeight` with a 100% width: in an UNWRAPPED flex row children shrink
    // to share the width, so the label takes what is left beside the marker and
    // wraps instead of running off a phone.
    prose('chLabel', 'What the choice says', 'chRow', '', {
      ...T_BODY,
      color: 'var(--foreground)',
      lineHeight: 1.5
    }),
    inputs('chInputs', 'The choice', [
      ['label', 'string'],
      ['goto', 'string'],
      ['gives', 'string']
    ]),
    outputs('chOutputs', 'What was taken', [
      ['picked', 'signal'],
      ['goto', 'string'],
      ['gives', 'string']
    ])
  ],
  connections: [
    wire('chInputs', 'label', 'chLabel', 'text'),
    wire('chInputs', 'goto', 'chOutputs', 'goto'),
    wire('chInputs', 'gives', 'chOutputs', 'gives'),
    // The whole row is the target, not the words in it — a four-word choice with a
    // two-pixel hit area is a choice people miss.
    wire('chRow', 'onClick', 'chOutputs', 'picked')
  ]
};

// ── Story/Carried — one thing you are carrying ───────────────────────────────

/**
 * One thing in the reader's hands.
 *
 * ⚠️ **It publishes nothing, and that is stated rather than hidden.** CMP-001 asks
 * what the parent can learn from a component and says to answer out loud when the
 * answer is nothing: a carried thing is a label. There is no fifth verb for
 * dropping one ({@link FUNCTION_SEAMS} and the data contract both stop at four), so
 * a `dropped` output would be a port nobody could wire — which the same doctrine
 * calls cost.
 */
const CARRIED: Tpl006Component = {
  path: 'Story/Carried',
  nodes: [
    group('caPill', 'One thing you carry', undefined, {
      sizeMode: 'contentSize',
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 'var(--space-1)',
      paddingBottom: 'var(--space-1)',
      paddingLeft: 'var(--space-3)',
      paddingRight: 'var(--space-3)',
      backgroundColor: 'var(--accent)',
      borderRadius: 'var(--radius-full)',
      borderStyle: 'solid',
      borderWidth: 'var(--border-1)',
      borderColor: MEANING.carried
    }, ['caText']),
    text('caText', 'What it is', 'caPill', '', {
      ...T_META,
      color: MEANING.carried,
      fontWeight: 'var(--font-medium)',
      sizeMode: 'contentSize'
    }),
    inputs('caInputs', 'The thing', [['thing', 'string']])
  ],
  connections: [wire('caInputs', 'thing', 'caText', 'text')]
};

// ── Story/Sidebar — what you carry ───────────────────────────────────────────

/**
 * What the reader is carrying, and what it says when that is nothing.
 *
 * 🔴 **The empty state is the point of the component.** A reader three passages in
 * with nothing in their hands has to be told that the panel is working and that
 * things will appear in it — otherwise the `requires` mechanic is invisible until
 * the one moment it matters, and by then they have already chosen.
 *
 * 🔴 **One flag, both halves, through an `Inverter`.** `hasThings` mounts the pills
 * and its inverse mounts the line that replaces them, which is the shape
 * `Table/String Cell` uses in the shipped library for exactly this reason: the two
 * halves can never both be showing and never both be gone. A component that wires
 * the visible half of a flag and stops has the same shape as one that works and a
 * bug inside it.
 */
const SIDEBAR: Tpl006Component = {
  path: 'Story/Sidebar',
  nodes: [
    group('sbWrap', 'What you carry', undefined, {
      width: pct(100),
      sizeMode: 'contentHeight',
      flexDirection: 'column',
      alignItems: 'flex-start',
      rowGap: 'var(--space-3)',
      paddingTop: 'var(--space-5)',
      paddingBottom: 'var(--space-5)',
      paddingLeft: 'var(--space-5)',
      paddingRight: 'var(--space-5)',
      backgroundColor: 'var(--surface)',
      borderRadius: 'var(--radius-lg)',
      borderStyle: 'solid',
      borderWidth: 'var(--border-1)',
      borderColor: 'var(--border)'
    }, ['sbHead', 'sbList', 'sbEmpty']),
    text('sbHead', 'The heading', 'sbWrap', 'What you carry', {
      ...T_EYEBROW,
      color: 'var(--muted-foreground)',
      sizeMode: 'contentSize'
    }),
    group('sbList', 'The things', 'sbWrap', {
      width: pct(100),
      sizeMode: 'contentHeight',
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: 'var(--space-2)',
      rowGap: 'var(--space-2)'
    }, ['sbPills']),
    logic('sbPills', FOR_EACH_NODE, 'One pill per thing', {
      template: CARRIED_COMPONENT,
      templateType: 'explicit'
    }),
    text('sbEmpty', 'When you carry nothing', 'sbWrap', 'Nothing yet. Some choices hand you something, and some only appear once you are carrying it.', {
      ...T_META,
      color: 'var(--muted-foreground)',
      width: pct(100),
      sizeMode: 'contentHeight'
    }),
    logic('sbNot', INVERTER_NODE, 'And when it is empty', {}),
    inputs('sbInputs', 'The inventory', [
      ['things', 'array'],
      ['hasThings', 'boolean']
    ])
  ],
  connections: [
    wire('sbInputs', 'things', 'sbPills', 'items'),
    wire('sbInputs', 'hasThings', 'sbList', 'mounted'),
    // Both halves of the flag, so they can never both be showing.
    wire('sbInputs', 'hasThings', 'sbNot', 'value'),
    wire('sbNot', 'result', 'sbEmpty', 'mounted')
  ]
};

// ── Story/Paster — the Remix control ─────────────────────────────────────────

/**
 * The paste-a-story control: a box that is already full, a button, and a problem
 * line.
 *
 * 🔴 **Richard's ruling put the Remix page in scope — *"it's the point"*** — and
 * this is the whole of it. *"You can build anything with Claude Code today, fine,
 * but can you go in and edit it afterwards?"* The answer this page gives is: the
 * box already holds the story that is playing, so editing it is a gesture, and the
 * graph sits behind it for whoever wants to change the **rules** rather than the
 * **content**. Two doors, both open, in the first ten seconds.
 *
 * 🔴 **The controlled-value shape, which is CMP-001 §2**: `value` arrives, `text`
 * and `play` leave. A parent that had to poll a text box for its contents could not
 * use this component, and that is the pattern most of the prefab library's 84%
 * turns out to be.
 *
 * ⚠️ **`problem` is wired to a `Text`'s `visible` as well as its `text`** — the
 * design doctrine's "falsiness is free conditional rendering". An empty problem
 * hides its own chrome with no logic node, so the page is not carrying an always-on
 * red line that happens to say nothing.
 */
const PASTER: Tpl006Component = {
  path: 'Story/Paster',
  nodes: [
    group('paWrap', 'Paste a story', undefined, {
      width: pct(100),
      sizeMode: 'contentHeight',
      flexDirection: 'column',
      alignItems: 'flex-start',
      rowGap: 'var(--space-4)'
    }, ['paBox', 'paProblem', 'paRow']),
    {
      id: 'paBox',
      type: TYPE_TEXT_INPUT,
      label: 'The story, as text',
      parent: 'paWrap',
      parameters: {
        type: 'textArea',
        // 🔴 `sizeMode: 'explicit'` or `width`/`height` are INERT on this node —
        // the design doctrine's §8, and the reason a `width: 100%` text field
        // renders 170px wide.
        sizeMode: 'explicit',
        width: pct(100),
        height: px(360),
        useLabel: false,
        placeholder: 'Paste a list of passages here…',
        cssClassName: 'story-paste',
        fontSize: px(13),
        color: 'var(--foreground)',
        backgroundColor: 'var(--surface)',
        borderStyle: 'solid',
        borderWidth: 'var(--border-1)',
        borderColor: 'var(--border-control)',
        borderRadius: 'var(--radius-md)',
        paddingTop: 'var(--space-4)',
        paddingBottom: 'var(--space-4)',
        paddingLeft: 'var(--space-4)',
        paddingRight: 'var(--space-4)'
      }
    },
    text('paProblem', 'What is wrong with it', 'paWrap', '', {
      ...T_ERROR,
      color: MEANING.broken,
      width: pct(100),
      sizeMode: 'contentHeight'
    }),
    group('paRow', 'The two buttons', 'paWrap', {
      sizeMode: 'contentSize',
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      columnGap: 'var(--space-3)',
      rowGap: 'var(--space-3)'
    }, ['paPlay', 'paBack']),
    {
      id: 'paPlay',
      type: TYPE_BUTTON,
      label: 'Read it',
      parent: 'paRow',
      parameters: { ...contentSized(BTN_PRIMARY), label: 'Read this story', cssClassName: 'pressable' }
    },
    {
      id: 'paBack',
      type: TYPE_BUTTON,
      label: 'Back to the story',
      parent: 'paRow',
      parameters: { ...contentSized(BTN_OUTLINE), label: 'Back to reading', cssClassName: 'pressable' }
    },
    inputs('paInputs', 'The box', [
      ['value', 'string'],
      ['problem', 'string']
    ]),
    outputs('paOutputs', 'What the reader did', [
      ['play', 'signal'],
      ['back', 'signal'],
      ['text', 'string']
    ])
  ],
  connections: [
    wire('paInputs', 'value', 'paBox', 'startValue'),
    wire('paBox', 'onTextChanged', 'paOutputs', 'text'),
    wire('paPlay', 'onClick', 'paOutputs', 'play'),
    wire('paBack', 'onClick', 'paOutputs', 'back'),
    wire('paInputs', 'problem', 'paProblem', 'text'),
    // 🔴 `mounted`, never `visible`. Falsiness as conditional rendering is the
    // design doctrine's own recipe and the port it names is `visible` — but
    // `visible` only HIDES: the node keeps its box and the column keeps its gap, so
    // an empty problem line leaves a hole above the buttons on every normal paste.
    // Found by looking at the page, which is the only instrument that shows it.
    wire('paInputs', 'problem', 'paProblem', 'mounted')
  ]
};

// ── Pages/Read — the engine ──────────────────────────────────────────────────

/**
 * What the page is able to say about where the reader is.
 *
 * 🔴 **Driven by `to-<state>` signals, which is the idiom that is known to work**,
 * and it is deliberately the control half of this template's D43 re-measurement:
 * this States node and `Story/Passage`'s are the same kind of node in the same
 * artefact, one driven by signals and one by a value into `currentState`. If the
 * page's chrome changes and the passage's rule does not, D43's mechanism claim
 * survives; if both change, it does not. Either way one render settles it.
 *
 * ⚠️ **`note` is empty in two of the four states on purpose.** It is wired to the
 * line's `visible` as well as its `text`, so an empty note hides its own chrome —
 * and the two cases that *do* have something to say name a mistake in the data
 * rather than a thing that happened to the reader.
 */
const MODE_STATES = {
  states: 'reading,ending,lost,stuck',
  currentState: 'reading',
  values: 'note,panel',
  'type-note': 'string',
  'type-panel': 'string',
  // Reading — nothing to say, and no room taken up saying it.
  'value-reading-note': '',
  'value-reading-panel': 'reading',
  // An ending. The only thing left is to go round again.
  'value-ending-note': 'That is an ending. Start again and the other roads are still there.',
  'value-ending-panel': 'ending',
  // A goto with no passage behind it. The named message is a String Format node,
  // because a state value cannot hold the id that is missing.
  'value-lost-note': '',
  'value-lost-panel': 'lost',
  // 🔴 Every choice locked and the passage is not an ending: the one remaining way
  // a story that loads and reads correctly can dead-end. See `SCREEN_SCRIPT`.
  'value-stuck-note':
    'Every choice here needs something you are not carrying, so there is no way on. That is usually a "requires" that nothing "gives".',
  'value-stuck-panel': 'stuck',
  // False for the same measured reason as `PASSAGE_STATES` — and here it is
  // belt-and-braces rather than load-bearing, because every value on this node is a
  // string and strings are the type the transition path does not swallow. It is set
  // anyway so the two States nodes in this template cannot disagree about a
  // parameter whose default is a defect.
  useTransitions: false
};

/**
 * The reading page, and the engine underneath it.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## One click, in the order it happens
 *
 * 1. A `Story/Choice` row's `onClick` publishes `picked`, and the repeater flags
 *    `itemOutput-goto` / `itemOutput-gives` **before** sending
 *    `itemOutputSignal-picked` (`foreach.tsx:921-927`).
 * 2. `picked` runs `rdCarry`, which is signal-driven because it is fed by the
 *    variable it writes.
 * 3. `rdCarry.success` evaluates `rdGiftGate` on `rdCarry.out-added` — the gate's
 *    condition and its `eval` come from the same script run, with nothing in
 *    between.
 * 4. **Either** the gate is true, the new inventory is stored, and that store's
 *    `done` moves the reader; **or** the gate is false and its `onfalse` moves the
 *    reader directly. Two wires into one `do`, exactly one of which fires.
 * 5. `storyAt` changes, `rdFind` re-runs reactively, and its `success` walks the
 *    two gates that decide what the page is.
 *
 * 🔴 **The gift is stored before the move, and that is not tidiness.** The choices
 * the next passage shows are filtered on what the reader is carrying, so a move
 * that landed first would draw the new passage's choices against the old
 * inventory — and the one choice that the gift was *for* would be missing for a
 * frame, or for ever if nothing else published.
 *
 * ## 🔴 Why nothing is wired to any Function's `run` except `rdCarry`'s
 *
 * A Function node auto-runs at load **only if `run` is unconnected**
 * (`simplejavascript.ts`: `if (!this.isInputConnected('run')) this.scheduleRun()`).
 * `rdFind` and `rdScreen` follow the reader's state, so they must be reactive and
 * must boot; `rdCarry` must not, because it reads `storyCarrying` and writes it.
 *
 * ## What a person changes first
 *
 * Nothing on this page. The story is `Story/Source`, one `Static Data` node, and
 * `docs/START-HERE.md` opens by saying so. The only editable thing here is the
 * node labelled `EDIT — what the reader already carries`, which ships empty.
 */
const READ: Tpl006Component = {
  path: 'Pages/Read',
  nodes: [
    // ── The visual tree ────────────────────────────────────────────────────
    { id: 'rdPage', type: 'Page', label: 'Read', parameters: { title: 'Read', urlPath: '' }, children: ['rdBand'] },
    group('rdBand', 'The page', 'rdPage', {
      ...BAND,
      width: pct(100),
      sizeMode: 'contentHeight',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: 'var(--space-16)',
      paddingBottom: 'var(--space-16)',
      backgroundColor: 'var(--background)'
    }, ['rdShell']),
    // 🔴 `maxWidth` overridden from the composition's 1200: this is a page of
    // prose, and 1200px of running text is unreadable however well it is set.
    group('rdShell', 'The column', 'rdBand', {
      ...SHELL,
      maxWidth: px(760),
      sizeMode: 'contentHeight',
      flexDirection: 'column',
      alignItems: 'flex-start',
      rowGap: 'var(--space-8)'
    }, ['rdHead', 'rdPassage', 'rdChoiceCol', 'rdNote', 'rdMissing', 'rdSide', 'rdActions', 'rdFoot']),

    group('rdHead', 'What this is', 'rdShell', {
      width: pct(100),
      sizeMode: 'contentHeight',
      flexDirection: 'column',
      alignItems: 'flex-start',
      rowGap: 'var(--space-1)'
    }, ['rdEyebrow', 'rdSourceLine']),
    text('rdEyebrow', 'A NodeGX template', 'rdHead', 'An interactive story', {
      ...T_EYEBROW,
      color: 'var(--primary)',
      sizeMode: 'contentSize'
    }),
    text('rdSourceLine', 'Which story this is', 'rdHead', '', {
      ...T_META,
      color: 'var(--muted-foreground)',
      sizeMode: 'contentSize'
    }),

    place('rdPassage', PASSAGE_COMPONENT, 'The passage', 'rdShell'),

    group('rdChoiceCol', 'What you can do', 'rdShell', {
      width: pct(100),
      sizeMode: 'contentHeight',
      flexDirection: 'column',
      alignItems: 'flex-start',
      rowGap: 'var(--space-2)'
    }, ['rdChoices']),
    logic('rdChoices', FOR_EACH_NODE, 'One row per choice you can see', {
      template: CHOICE_COMPONENT,
      templateType: 'explicit'
    }),

    prose('rdNote', 'What the page has to say', 'rdShell', '', { ...T_LEAD, color: 'var(--muted-foreground)' }),
    prose('rdMissing', 'The passage that is not there', 'rdShell', '', { ...T_BODY, color: MEANING.broken }),

    place('rdSide', SIDEBAR_COMPONENT, 'What you carry', 'rdShell'),

    group('rdActions', 'The two doors', 'rdShell', {
      sizeMode: 'contentSize',
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      columnGap: 'var(--space-3)',
      rowGap: 'var(--space-3)'
    }, ['rdRestart', 'rdToRemix']),
    // 🔴 Both buttons are OUTLINE, and a filled one here would be a mistake. The
    // accent on this page belongs to the choices — the only thing a reader is
    // meant to be drawn to is the story. A brass button beside brass choice
    // markers is two things competing to be the obvious next action.
    {
      id: 'rdRestart',
      type: TYPE_BUTTON,
      label: 'Start again',
      parent: 'rdActions',
      parameters: { ...contentSized(BTN_OUTLINE), label: 'Start again', cssClassName: 'pressable' }
    },
    {
      id: 'rdToRemix',
      type: TYPE_BUTTON,
      label: 'Write your own',
      parent: 'rdActions',
      parameters: { ...contentSized(BTN_OUTLINE), label: 'Write your own story', cssClassName: 'pressable' }
    },

    prose('rdFoot', 'Where to start editing', 'rdShell',
      'Every passage in this story is one list in the Story/Source component. Open it, and what you write is what people read.',
      { ...T_META, color: 'var(--muted-foreground)' }),

    // ── The story, and where the reader is in it ───────────────────────────
    logic('rdSrc', SOURCE_COMPONENT, 'The story being read'),
    logic('rdVarAt', VARIABLE_NODE, 'Which passage you are in', { name: VAR_AT }),
    logic('rdVarCarry', VARIABLE_NODE, 'What you are carrying', { name: VAR_CARRYING }),
    {
      id: 'rdStart',
      type: STATIC_DATA_NODE,
      label: `${EDIT}what the reader already carries, if anything`,
      // Empty, and a person can put `[{ "thing": "a lantern" }]` in it to start
      // the reader holding something. One edit, no rewiring.
      parameters: { type: 'json', json: '[]' }
    },

    logic('rdFind', FUNCTION_NODE, 'The passage you are in', { functionScript: FIND_PASSAGE_SCRIPT }),
    logic('rdScreen', FUNCTION_NODE, 'What you can see from here', { functionScript: SCREEN_SCRIPT }),
    logic('rdCarry', FUNCTION_NODE, 'Take what that choice gives you', {
      functionScript: CARRY_SCRIPT,
      ...signalOnly('in-carrying', 'in-gift')
    }),

    gate('rdFoundGate', 'Is there a passage with that id?'),
    gate('rdEndGate', 'Is this an ending?'),
    gate('rdGiftGate', 'Was that something new?'),
    gate('rdStuckGate', 'Is there any way on from here?'),

    logic('rdLoadAt', SET_VARIABLE_NODE, 'Put the reader at the beginning', { name: VAR_AT }),
    logic('rdLoadCarry', SET_VARIABLE_NODE, 'Empty their hands', { name: VAR_CARRYING }),
    logic('rdSetCarry', SET_VARIABLE_NODE, 'You are carrying that now', { name: VAR_CARRYING }),
    logic('rdSetAt', SET_VARIABLE_NODE, 'You are in that passage now', { name: VAR_AT }),

    logic('rdMode', STATES_NODE, 'What the page has to say, in words', MODE_STATES),
    logic('rdMissingFmt', 'String Format', 'The id that is missing, in a sentence', {
      format: 'There is no passage with the id "{id}". Open Story/Source and look at the goto that points there.'
    }),
    // 🔴 An `Expression`, not a line of script: one library node does the whole
    // step, which is the half of NODES BEFORE CODE that is about not writing code.
    logic('rdHasCarry', EXPRESSION_NODE, 'Are you carrying anything?', { expression: 'n > 0' })
    // 🔴 `rdGoRemix` is NOT here. See `READ_REMIX_DOOR` below.
  ],

  connections: [
    // ── The story arrives, and the reader is put at the beginning ──────────
    wire('rdSrc', 'source', 'rdSourceLine', 'text'),
    wire('rdSrc', 'firstId', 'rdLoadAt', 'value'),
    wire('rdSrc', 'ready', 'rdLoadAt', 'do'),
    wire('rdLoadAt', 'done', 'rdLoadCarry', 'do'),
    wire('rdStart', 'items', 'rdLoadCarry', 'value'),
    // The same chain is the restart. One path, so there is nothing to race.
    wire('rdRestart', 'onClick', 'rdLoadAt', 'do'),

    // ── The passage you are in ─────────────────────────────────────────────
    wire('rdSrc', 'story', 'rdFind', 'in-story'),
    // 🔴 The fallback, not a convenience — see `FIND_PASSAGE_SCRIPT`.
    wire('rdSrc', 'firstId', 'rdFind', 'in-firstId'),
    wire('rdVarAt', 'value', 'rdFind', 'in-at'),
    wire('rdFind', 'out-title', 'rdPassage', 'title'),
    wire('rdFind', 'out-text', 'rdPassage', 'text'),

    // ── What you can see from here ─────────────────────────────────────────
    wire('rdFind', 'out-choices', 'rdScreen', 'in-choices'),
    wire('rdFind', 'out-isEnding', 'rdScreen', 'in-isEnding'),
    // 🔴 The passage the finder SETTLED on, not the raw variable: before the boot
    // write lands they disagree, and row ids built from the wrong one would change
    // under the repeater a frame later.
    wire('rdFind', 'out-at', 'rdScreen', 'in-at'),
    wire('rdVarCarry', 'value', 'rdScreen', 'in-carrying'),
    wire('rdScreen', 'out-rows', 'rdChoices', 'items'),
    wire('rdVarCarry', 'value', 'rdSide', 'things'),
    wire('rdScreen', 'out-carryCount', 'rdHasCarry', 'n'),
    wire('rdHasCarry', 'asBoolean', 'rdSide', 'hasThings'),

    // ── The three things the page can be ───────────────────────────────────
    wire('rdFind', 'out-found', 'rdFoundGate', 'condition'),
    wire('rdFind', 'success', 'rdFoundGate', 'eval'),
    wire('rdFoundGate', 'onfalse', 'rdMode', 'to-lost'),
    // 🔴 CHAINED, not both evaluated by `rdFind.success`. A passage that is not
    // there has no choices either, so an ending gate fired in parallel would send
    // `to-reading` at the same moment as `to-lost` and the winner would be
    // whichever wire the runtime walked first.
    wire('rdFoundGate', 'ontrue', 'rdEndGate', 'eval'),
    wire('rdFind', 'out-isEnding', 'rdEndGate', 'condition'),
    wire('rdEndGate', 'ontrue', 'rdMode', 'to-ending'),
    wire('rdEndGate', 'onfalse', 'rdMode', 'to-reading'),
    // And the dead end, from strictly later in the chain than the state it overrides.
    wire('rdScreen', 'out-stuck', 'rdStuckGate', 'condition'),
    wire('rdScreen', 'success', 'rdStuckGate', 'eval'),
    wire('rdStuckGate', 'ontrue', 'rdMode', 'to-stuck'),

    // ── What the page says about it ────────────────────────────────────────
    // 🔴 THE D43 PROBE: a States VALUE into a component input into another States
    // node's `currentState`. The control is this node's own `to-` wiring above.
    wire('rdMode', 'panel', 'rdPassage', 'mode'),
    wire('rdMode', 'note', 'rdNote', 'text'),
    // 🔴 `mounted`, never `visible` — see `Story/Paster`. A `visible: false` Text
    // keeps its box AND the column's `rowGap` on both sides of it, and this page
    // has two of them that are empty most of the time: the first screenshot showed
    // ~130px of nothing between the choices and the inventory.
    wire('rdMode', 'note', 'rdNote', 'mounted'),
    wire('rdFind', 'out-missing', 'rdMissingFmt', 'id'),
    wire('rdMissingFmt', 'formatted', 'rdMissing', 'text'),
    wire('rdFind', 'out-missing', 'rdMissing', 'mounted'),

    // ── Taking a choice ───────────────────────────────────────────────────
    wire('rdChoices', 'itemOutput-gives', 'rdCarry', 'in-gift'),
    wire('rdVarCarry', 'value', 'rdCarry', 'in-carrying'),
    wire('rdChoices', 'itemOutputSignal-picked', 'rdCarry', 'run'),
    wire('rdCarry', 'out-added', 'rdGiftGate', 'condition'),
    wire('rdCarry', 'success', 'rdGiftGate', 'eval'),
    wire('rdCarry', 'out-carrying', 'rdSetCarry', 'value'),
    wire('rdGiftGate', 'ontrue', 'rdSetCarry', 'do'),
    // 🔴 The gift lands BEFORE the move, or the next passage filters its choices
    // against an inventory that is one click out of date. Exactly one of these two
    // wires fires per click.
    wire('rdChoices', 'itemOutput-goto', 'rdSetAt', 'value'),
    wire('rdSetCarry', 'done', 'rdSetAt', 'do'),
    wire('rdGiftGate', 'onfalse', 'rdSetAt', 'do'),

    // ── The other door ────────────────────────────────────────────────────
    // 🔴 `rdToRemix.onClick` is wired by `READ_REMIX_DOOR`, after the page it
    // leads to exists. See that constant.
  ]
};

/**
 * The one thing on `Pages/Read` that cannot be authored with the rest of it.
 *
 * 🔴 **Measured, not anticipated.** The door validates `RouterNavigate.target`
 * against the components that exist, and a target naming a component that is not
 * there yet is a **refusal**, not a warning that lands anyway:
 *
 * > `WARN [unresolved-navigation] /Pages/Read › node rdGoRemix › port "target":
 * > "Go and write your own" navigates to "/Pages/Remix", which is not a component
 * > in this project.` — `create_component "Pages/Read" rejected — nothing was
 * > written.`
 *
 * And the order cannot simply be swapped: `planPageRegistration`'s
 * `nextStartPage` gives home to **the first page registered** and then leaves it
 * alone, so writing `Pages/Remix` first would make the remix screen the page the
 * app opens on.
 *
 * ⚠️ So the two pages are authored in reading order and this one node arrives
 * afterwards as a two-operation delta — which is also the honest shape: a cycle
 * between two pages cannot be written in one pass by any door that checks its
 * targets, and pretending otherwise would mean either a dead button or a wrong
 * home page. `tpl006Template.test.ts` §3 asserts the wire is in the artefact, so
 * a delta that silently did nothing would redden rather than ship a door that
 * goes nowhere.
 */
export const READ_REMIX_DOOR = {
  component: 'Pages/Read',
  operations: [
    { op: 'add_node', node: logic('rdGoRemix', NAVIGATE_NODE, 'Go and write your own', { router: ROUTER, target: PAGE_REMIX }) },
    { op: 'add_connection', connection: wire('rdToRemix', 'onClick', 'rdGoRemix', 'navigate') }
  ]
} as const;

// ── Pages/Remix — the answer to the jab ──────────────────────────────────────

/** The shape a person is shown, and it is deliberately NOT a passage from the demo story. */
const EXAMPLE_JSON = [
  '[',
  '  {',
  '    "id": "hall",',
  '    "title": "The hallway",',
  '    "text": "Two doors. One of them is warm to the touch.",',
  '    "choices": [',
  '      { "label": "Open the warm door", "goto": "kitchen", "gives": "a brass key" },',
  '      { "label": "Unlock the far door", "goto": "out", "requires": "a brass key" }',
  '    ]',
  '  },',
  '  { "id": "kitchen", "title": "The kitchen", "text": "A key on the hook.", "choices": [',
  '      { "label": "Go back", "goto": "hall" } ] },',
  '  { "id": "out", "title": "Outside", "text": "You are out. No choices: that is an ending." }',
  ']'
].join('\n');

const REMIX: Tpl006Component = {
  path: 'Pages/Remix',
  nodes: [
    { id: 'rxPage', type: 'Page', label: 'Remix', parameters: { title: 'Remix', urlPath: 'remix' }, children: ['rxBand'] },
    group('rxBand', 'The page', 'rxPage', {
      ...BAND,
      width: pct(100),
      sizeMode: 'contentHeight',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: 'var(--space-16)',
      paddingBottom: 'var(--space-16)',
      backgroundColor: 'var(--background)'
    }, ['rxShell']),
    group('rxShell', 'The column', 'rxBand', {
      ...SHELL,
      maxWidth: px(760),
      sizeMode: 'contentHeight',
      flexDirection: 'column',
      alignItems: 'flex-start',
      rowGap: 'var(--space-8)'
    }, ['rxHead', 'rxPaster', 'rxHelp']),

    group('rxHead', 'What this page is for', 'rxShell', {
      width: pct(100),
      sizeMode: 'contentHeight',
      flexDirection: 'column',
      alignItems: 'flex-start',
      rowGap: 'var(--space-2)'
    }, ['rxEyebrow', 'rxTitle', 'rxLead']),
    text('rxEyebrow', 'Remix', 'rxHead', 'Remix', { ...T_EYEBROW, color: 'var(--primary)', sizeMode: 'contentSize' }),
    prose('rxTitle', 'The heading', 'rxHead', 'Your story goes in this box', { ...H_SECTION }),
    prose('rxLead', 'What to do', 'rxHead',
      'The box already holds the story that is playing, so you can read it, change a line, or select it all and replace it with your own. Press Read this story and it plays straight away — no editor, no rebuild, nothing to install.',
      { ...T_LEAD, color: 'var(--muted-foreground)', maxWidth: px(MEASURE) }),

    place('rxPaster', PASTER_COMPONENT, 'The box and the buttons', 'rxShell'),

    group('rxHelp', 'The contract', 'rxShell', {
      width: pct(100),
      sizeMode: 'contentHeight',
      flexDirection: 'column',
      alignItems: 'flex-start',
      rowGap: 'var(--space-3)',
      paddingTop: 'var(--space-5)',
      paddingBottom: 'var(--space-5)',
      paddingLeft: 'var(--space-5)',
      paddingRight: 'var(--space-5)',
      backgroundColor: 'var(--surface)',
      borderRadius: 'var(--radius-lg)',
      borderStyle: 'solid',
      borderWidth: 'var(--border-1)',
      borderColor: 'var(--border)'
    }, ['rxHelpHead', 'rxHelpBody', 'rxHelpExample']),
    text('rxHelpHead', 'The heading', 'rxHelp', 'Four words, and there is no fifth', {
      ...T_EYEBROW,
      color: 'var(--muted-foreground)',
      sizeMode: 'contentSize'
    }),
    prose('rxHelpBody', 'The four words', 'rxHelp',
      [
        'goto — where a choice takes the reader.',
        'gives — hands them something, and it shows up in What you carry.',
        'requires — the choice is invisible until they are carrying that thing. Not greyed out: absent.',
        'no choices at all — that passage is an ending.'
      ].join('\n'),
      { ...T_BODY, color: 'var(--foreground)', lineHeight: 1.8 }),
    prose('rxHelpExample', 'A whole story, three passages long', 'rxHelp', EXAMPLE_JSON, {
      ...T_META,
      fontFamily: 'var(--font-mono)',
      color: 'var(--muted-foreground)',
      lineHeight: 1.6
    }),

    // ── Reading what was pasted ───────────────────────────────────────────
    logic('rxSrc', SOURCE_COMPONENT, 'The story that is playing'),
    logic('rxParse', FUNCTION_NODE, 'Read what was pasted', {
      functionScript: PARSE_STORY_SCRIPT,
      // Signal-driven: the box publishes on every keystroke, and reporting
      // "that is not valid JSON yet" while somebody is halfway through typing it
      // is worse than saying nothing.
      ...signalOnly('in-text')
    }),
    gate('rxOkGate', 'Is that a story?'),
    logic('rxSetPasted', SET_VARIABLE_NODE, 'That is the story now', { name: VAR_PASTED }),
    logic('rxGoRead', NAVIGATE_NODE, 'Go and read it', { router: ROUTER, target: PAGE_READ })
  ],

  connections: [
    // The box opens holding the story that is playing — the copy affordance and
    // the edit affordance are the same box.
    wire('rxSrc', 'json', 'rxPaster', 'value'),
    wire('rxPaster', 'text', 'rxParse', 'in-text'),
    wire('rxPaster', 'play', 'rxParse', 'run'),
    wire('rxParse', 'out-ok', 'rxOkGate', 'condition'),
    wire('rxParse', 'success', 'rxOkGate', 'eval'),
    // 🔴 In prose, never silently. The first thing anyone does here is paste
    // something malformed, and a blank screen at that moment kills the pitch.
    wire('rxParse', 'out-problem', 'rxPaster', 'problem'),
    wire('rxParse', 'out-story', 'rxSetPasted', 'value'),
    wire('rxOkGate', 'ontrue', 'rxSetPasted', 'do'),
    // Stored first, then read — `done` fires once every Variable node reading it
    // has been notified, so the reading page cannot open on the old story.
    wire('rxSetPasted', 'done', 'rxGoRead', 'navigate'),
    wire('rxPaster', 'back', 'rxGoRead', 'navigate')
  ]
};

/**
 * Every component, in the order the door is given them.
 *
 * 🔴 The order is a dependency order, not a preference: a `For Each`'s `template`
 * parameter names a component, and `Story/Sidebar` repeats `Story/Carried`, so the
 * leaf comes first. `Pages/Read` is before `Pages/Remix` because the first page
 * written is the one the router makes the start page.
 */
export function tpl006Components(storyJson: string): ReadonlyArray<Tpl006Component> {
  return [sourceComponent(storyJson), PASSAGE, CHOICE, CARRIED, SIDEBAR, PASTER, READ, REMIX];
}

/**
 * The library modules this template needs.
 *
 * 🔴 **None, and it is asserted rather than assumed** (AC4). `Text Input` takes
 * `type: 'textArea'` out of the box and nothing else here is outside the standard
 * library — so this is the first template on the shelf that a person can unzip and
 * open with nothing installed. See the module header for what that cost.
 */
export const REQUIRED_MODULES: ReadonlyArray<string> = [];
