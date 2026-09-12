/**
 * TPL-005 — the pixel game: a turn-based dungeon, five rooms, no backend.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## What this template is
 *
 * Richard, 2026-09-11: *"something cooler that will show off NodeGX's node graph
 * and power"*, explicitly **not a site template**, for 0.2.3 — shared as a zip
 * and published as a demo page.
 *
 * So: **a game you play with the arrow keys.** A tile grid, a sprite, coins that
 * raise a score, an exit, and enemies that step when you step. Five rooms, each
 * one string in a `Static Data` node.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## 🔴 Turn-based, because the product has no ticker
 *
 * Measured while scoping this task and filed as **D40**: `Timer` is a one-shot
 * (`displayName: 'Delay'`), nothing in the std library or the runtime repeats,
 * and of the 33 shipped library modules the three that call `setInterval` do so
 * internally and expose no tick. A real-time loop would therefore have to be a
 * `Delay` re-entering its own `Restart` — an idiom taught nowhere, validated by
 * nothing, its stability never measured.
 *
 * **One keypress is one step, so no loop is needed.** The world moves when you
 * do. That is also the sentence Richard's own roster wrote for this template:
 * *"a sprite you move with the keyboard"* — never *"a sprite that moves"*.
 *
 * ## 🔴 The game is in the GRAPH. That is the whole point of shipping it.
 *
 * The failure this template exists to avoid is one `Function` node holding
 * `step()` with a repeater drawing whatever it returns. That ships a game and
 * teaches that NodeGX is a way to host JavaScript.
 *
 * So the rule, and `tpl005Template.test.ts` grades it: **no Function node
 * decides what happens.** Every branch in the game is a `Condition` a person can
 * see and follow — {@link GATE_NODES} names all six — and the Functions are
 * pure questions and transforms at the named seams ({@link FUNCTION_SEAMS}):
 * parse a room, ask whether a tile is a wall, take a coin, run the world's turn,
 * project the state to cells. Each is a thing a graph would
 * express as theatre rather than clarity.
 *
 * ## 🔴 Two ordering traps, and the one port that solves both
 *
 * **(a) Four movers, one value port.** The move rule is `Game/Move`, placed four
 * times with `dx`/`dy` as *instance parameters*. The first shape of this graph
 * had each instance publish `tx`/`ty` back to the page, and it is wrong in a way
 * that renders perfectly: all four instances recompute whenever the player moves,
 * so `Set Variable`'s value port carries **whichever instance published last**,
 * not the one whose key was pressed. The fix is that each instance commits its
 * own move, inside itself, and the page is told only *that* a move happened.
 *
 * **(b) Reading a variable you just wrote.** `Set Variable` has a **`done`**
 * output documented as firing *"once the variable has been written and every
 * Variable node reading it has been notified"*. That is the sequencing primitive
 * this graph is built on: `x` is written, `done` fires, `y` is written, `done`
 * fires, and only then does `moved` leave the component. Everything downstream
 * reads `px`/`py` from the variables and is guaranteed to see the new tile.
 *
 * ⚠️ **And the step chain's Functions are signal-driven, not reactive.** A
 * `takeCoin` fed by the `coins` variable it writes is an infinite loop; so is
 * `stepEnemies`. Each of their value inputs is unticked with
 * `runOnChange-in-<name>: false` ({@link signalOnly}) so the node runs only when
 * `run` pulses. The renderer (`buildCells`) is the one Function left fully
 * reactive, because following state is its entire job.
 *
 * ## The keyboard is a module, and it travels with the project
 *
 * There is no built-in keyboard node. Keys are `keyboard-shortcuts`
 * (0 dependencies, no build step) and the win is `confetti` (the same), both
 * **copied into the project's `noodl_modules/`** by `tpl005Template.ts`.
 *
 * 🔴 Measured, not assumed: the MCP door **refuses** `keyboard-shortcuts.KeyboardShortcut`
 * with `unknown-node-type` and writes nothing — until the module is present in
 * the project being authored, after which the same write reports 0 errors, 0
 * warnings and 0 infos. So the install is a *precondition of authoring*, not a
 * packaging step afterwards.
 *
 * @module noodl-mcp/tests/tpl005Components
 */
import { composition, LEGEND, TILE_PALETTE } from './tpl005Theme';

/** The router every page registers into. */
export const ROUTER = 'Main';

/** One component, in the shape `create_component` takes. */
export interface Tpl005Component {
  path: string;
  nodes: unknown[];
  connections: unknown[];
}

// ── The components' legacy names, spelled once ───────────────────────────────

export const CELL_COMPONENT = '/Game/Cell';
export const ROW_COMPONENT = '/Game/Row';
export const MOVE_COMPONENT = '/Game/Move';
export const STAT_COMPONENT = '/Game/Stat';
export const KEYCAP_COMPONENT = '/Game/KeyCap';
export const HUD_COMPONENT = '/Game/Hud';
export const TEACH_COMPONENT = '/Game/Teach';
export const PAGE_PLAY = '/Pages/Play';

/** The label prefix the editor's node tree lists, and `START-HERE.md` is built from. */
export const EDIT = 'EDIT — ';

/** The app-wide variables. Spelled once, because a typo here is a silent game. */
export const VAR_X = 'playerX';
export const VAR_Y = 'playerY';
export const VAR_COINS = 'coinsLeft';
export const VAR_ENEMIES = 'enemyTiles';

/** How much a person can take. Three is enough to learn a room and not enough to walk it blind. */
export const START_HP = 3;

/** The board. 12 × 9 is the largest grid that still reads at a glance on a laptop. */
export const GRID_W = 12;
export const GRID_H = 9;

/** One tile, in px. 12 × 34 + 11 × 2 = 430 wide; the media rule in {@link BOARD_CSS} shrinks it on a phone. */
export const TILE = 34;

const TYPE_KEYBOARD = 'keyboard-shortcuts.KeyboardShortcut';
const CSS_NODE = 'CSS Definition';
const FUNCTION_NODE = 'JavaScriptFunction';
const STATES_NODE = 'States';
const STATIC_DATA_NODE = 'Static Data';
const FOR_EACH_NODE = 'For Each';
const VARIABLE_NODE = 'Variable2';
const SET_VARIABLE_NODE = 'Set Variable';
const EXPRESSION_NODE = 'Expression';
const CONDITION_NODE = 'Condition';
const COUNTER_NODE = 'Counter';
const FORMAT_NODE = 'String Format';

const px = (value: number) => ({ value, unit: 'px' });
const pct = (value: number) => ({ value, unit: '%' });

/**
 * A composition's parameters, sized to their content.
 *
 * 🔴 The door raises `inert-dimension` when a `width` survives beside a
 * `sizeMode` that ignores it — *"the value is never read"*. Several compositions
 * set `width: 100%` because most of their uses want it, so switching one to
 * content sizing has to **remove** the dimension rather than sit on top of it.
 * A parameter nothing reads is a parameter that will be believed by the next
 * person to open the panel.
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

// ── Node helpers ────────────────────────────────────────────────────────────

function text(id: string, label: string, parent: string, value: string, params: Record<string, unknown>): unknown {
  return { id, type: 'Text', label, parent, parameters: { text: value, ...params } };
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
 * 🔴 This is what stops `takeCoin` and `stepEnemies` — each fed by the very
 * variable it writes — from running forever, and it is what makes the step chain
 * an *order* rather than a race. The port name is `runOnChange-<input>`
 * (`RUN_ON_CHANGE_PREFIX`), and a Function's value inputs are `in-<name>`.
 */
export function signalOnly(...inputNames: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const name of inputNames) out[`runOnChange-${name}`] = false;
  return out;
}

/** A `Condition` that tests only when `eval` pulses — every gate in this graph is one. */
function gate(id: string, label: string): unknown {
  return logic(id, CONDITION_NODE, label, { ...signalOnly('condition') });
}

// ── The six Condition nodes that ARE the game's decisions ────────────────────

/**
 * Every branch in the game, by node id, and what it decides.
 *
 * 🔴 `tpl005Template.test.ts` asserts each of these exists, is a `Condition`,
 * and has something wired into **both** its `eval` and its `condition` — a gate
 * with an unwired `eval` never fires, and one with an unwired `condition` tests
 * a value nothing supplies. Both render perfectly.
 */
export const GATE_NODES: ReadonlyArray<{ id: string; component: string; decides: string }> = [
  { id: 'mvGate', component: MOVE_COMPONENT, decides: 'is there a wall in the way?' },
  { id: 'plCoinGate', component: PAGE_PLAY, decides: 'was there a coin on that tile?' },
  { id: 'plExitGate', component: PAGE_PLAY, decides: 'is that tile the way out?' },
  { id: 'plHitGate', component: PAGE_PLAY, decides: 'did an enemy reach you?' },
  { id: 'plDeathGate', component: PAGE_PLAY, decides: 'have you run out of hearts?' },
  { id: 'plWinGate', component: PAGE_PLAY, decides: 'was that the last room, or just this one?' }
];

/**
 * Every `Function` node, and the seam it sits at.
 *
 * 🔴 The gate asserts this list is exactly the set of Function nodes in the
 * template — a seventh appearing without a line here is the failure this
 * template is written against, caught at the count rather than at a review.
 */
export const FUNCTION_SEAMS: ReadonlyArray<{ id: string; component: string; seam: string }> = [
  { id: 'plPickLevel', component: PAGE_PLAY, seam: 'parse a room out of its string' },
  { id: 'mvWall', component: MOVE_COMPONENT, seam: 'ask whether one tile is a wall' },
  { id: 'plTakeCoin', component: PAGE_PLAY, seam: 'take a coin off the list' },
  { id: 'plStepEnemies', component: PAGE_PLAY, seam: 'the world’s turn — who moves, who is gone, did it hurt' },
  { id: 'plBuildCells', component: PAGE_PLAY, seam: 'project the state onto rows of cells' }
];

// ── The rooms ───────────────────────────────────────────────────────────────

/**
 * The five rooms. `#` wall · `.` floor · `c` coin · `E` enemy · `@` you · `>` out.
 *
 * 🔴 **Every room is walked by the gate before it ships.** `tpl005Template.test.ts`
 * breadth-first searches each grid from `@` and asserts the exit and *every* coin
 * is reachable, and that no enemy is sealed behind a wall. A room whose exit is
 * walled off is the worst defect a game template could carry and it is invisible
 * in a screenshot — the board draws perfectly either way.
 *
 * ⚠️ Difficulty is enemies, not maze: 0 → 1 → 2 → 1 → 3. Room 4 is the long way
 * round with one enemy, so the ramp is not a straight line.
 */
export const LEVELS: ReadonlyArray<{ name: string; grid: string }> = [
  {
    name: 'First steps',
    grid: [
      '############',
      '#@...c.....#',
      '#.####.###.#',
      '#.c..#....c#',
      '#..#.#.###.#',
      '#.##...#...#',
      '#....###...#',
      '#.c......>.#',
      '############'
    ].join('\n')
  },
  {
    name: 'Company',
    grid: [
      '############',
      '#@....#...c#',
      '#.###.#.##.#',
      '#...#.#.#..#',
      '#.#.#...#..#',
      '#.#...#.c..#',
      '#.#.###..#.#',
      '#c..E....>.#',
      '############'
    ].join('\n')
  },
  {
    name: 'Crossfire',
    grid: [
      '############',
      '#@..c#....E#',
      '#.##.#.###.#',
      '#..#...#c..#',
      '#c.#.#.#.#.#',
      '#..#.#...#.#',
      '#.##.###.#.#',
      '#E...c...>.#',
      '############'
    ].join('\n')
  },
  {
    name: 'The long way',
    grid: [
      '############',
      '#@.#.......#',
      '#..#.#####.#',
      '##.#.#c..#.#',
      '#..#.#.#.#c#',
      '#.##.#.#.#.#',
      '#....#.#.#.#',
      '#.c..E.#.>.#',
      '############'
    ].join('\n')
  },
  {
    // \U0001f534 REDESIGNED 2026-09-11, after Richard played it: *"the 5th room
    // appears to be unsolvable"*. He was right, and the reason was not
    // reachability — the exit and every coin passed the walk gate then and pass
    // it now. It was **geometry against pursuer count**: the old room was 87%
    // one-tile-wide corridor with only SIX junctions, and three same-speed
    // chasers. You cannot dodge past anything in a corridor, so three of them
    // pincer you and there is nowhere to go. Two junctions per enemy; every
    // other room has five or more.
    //
    // This one is the finale, so it is an OPEN room rather than a maze: 29
    // junctions, 47% corridor, room to dance with three of them. Gated now by
    // junctions-per-enemy so no future room can ship in the old shape.
    name: 'Last light',
    grid: [
      '############',
      '#@..c....E.#',
      '#.#..##..#.#',
      '#.#.c..#.#c#',
      '#....#.....#',
      '#c##...##..#',
      '#..#.E.#.#.#',
      '#..c....>.E#',
      '############'
    ].join('\n')
  }
];

export const LEVELS_JSON = JSON.stringify(LEVELS, null, 2);

/** The glyphs the board draws. Geometric shapes, so no icon font has to load for a tile to read. */
export const GLYPH = { player: '◆', coin: '●', enemy: '▲', exit: '▣' } as const;

// ── The six scripts, one per seam ───────────────────────────────────────────

/**
 * Seam 1 — parse a room out of its string.
 *
 * Everything else in the graph works in numbers and short strings; this is the
 * one place the grid is read as text. Coins and enemies leave as `"x,y"` strings
 * rather than objects, because `indexOf` on a flat list is a thing the rest of
 * the graph can do without another script.
 */
export const PICK_LEVEL_SCRIPT = `var levels = Inputs.levels || [];
var i = Math.max(1, Number(Inputs.index) || 1) - 1;
var lv = levels[i] || levels[0] || { name: '', grid: '' };
var grid = String(lv.grid || '');
var rows = grid.split('\\n');
var w = 0;
for (var r = 0; r < rows.length; r++) if (rows[r].length > w) w = rows[r].length;

var coins = [];
var enemies = [];
var start = { x: 1, y: 1 };
var exit = { x: 1, y: 1 };
for (var y = 0; y < rows.length; y++) {
  for (var x = 0; x < rows[y].length; x++) {
    var ch = rows[y].charAt(x);
    if (ch === 'c') coins.push(x + ',' + y);
    else if (ch === 'E') enemies.push(x + ',' + y);
    else if (ch === '@') start = { x: x, y: y };
    else if (ch === '>') exit = { x: x, y: y };
  }
}

Outputs.grid = grid;
Outputs.width = w;
Outputs.height = rows.length;
Outputs.roomName = String(lv.name || '');
Outputs.startX = start.x;
Outputs.startY = start.y;
Outputs.exitX = exit.x;
Outputs.exitY = exit.y;
// A fresh array every run: Outputs publishes only on change, and a mutated
// array is the same object, so a reused one would never reach the graph.
Outputs.coins = coins.slice();
Outputs.enemies = enemies.slice();
Outputs.levelCount = levels.length;

// \u{1f534} READ THE NUDGE, or the port it is wired to does not exist.
// A Function node's ports come from THIS SCRIPT — reading Inputs.reload is the
// only thing that mints "in-reload". The graph wired a Counter to it and the
// script never mentioned it, so the port was never registered and the real
// exporter dropped the connection: the room could never restart. The render
// harness hid it by lifting ports off connections, so it worked under
// measurement and would not have worked in the product.
Outputs.reload = Number(Inputs.reload) || 0;`;

/**
 * Seam 2 — is that one tile a wall?
 *
 * Off the grid counts as a wall, so the outer ring of `#` is a belt and the
 * bounds check is the braces. A room missing its border still cannot be walked
 * out of.
 */
export const IS_WALL_SCRIPT = `var rows = String(Inputs.grid || '').split('\\n');
var w = Number(Inputs.w) || 0;
var x = Number(Inputs.x);
var y = Number(Inputs.y);
// 🔴 NaN FIRST, and it is not defensive padding — it is the bug this script
// shipped with. At load nothing has written playerX yet, so "px + dx" is NaN,
// and EVERY comparison against NaN is false: all four bounds checks passed and
// the next line read rows[NaN].charAt(NaN). Eight thrown scripts before a
// single key was pressed, and the board still drew perfectly.
if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= w || y >= rows.length) {
  Outputs.blocked = true;
} else {
  var ch = rows[y].charAt(x);
  Outputs.blocked = ch === '#' || ch === '';
}`;

/** Seam 3 — take a coin off the list, and say whether there was one. */
export const TAKE_COIN_SCRIPT = `var coins = (Inputs.coins || []).slice();
var key = Number(Inputs.x) + ',' + Number(Inputs.y);
var at = coins.indexOf(key);
if (at === -1) {
  Outputs.taken = false;
} else {
  coins.splice(at, 1);
  Outputs.taken = true;
}
Outputs.coins = coins;
Outputs.left = coins.length;`;

/**
 * Seam 4 — the world takes its turn: who moves, who is gone, did it hurt.
 *
 * One tile, toward you, along whichever axis it is furthest away on — which is
 * what stops it jittering on a diagonal. It will not walk through a wall, and it
 * will not step onto a tile another enemy has already claimed this turn.
 *
 * 🔴 **It answers the WHOLE turn, and that is an ordering decision, not tidiness.**
 * This was three nodes — step, store, then a separate seam that read the stored
 * list back to see who reached you — and driving found the damage landing **one
 * move late**, twice, from two different intermediates. The cause is the same
 * both times: a gate whose `eval` comes from one node and whose `condition`
 * travels through another (a variable round-trip, or a reactive `Expression`)
 * can be evaluated before that value has arrived. With one node there is nothing
 * in between: the gate's condition is this script's own output and its `eval` is
 * this script's own `success`.
 *
 * 🔴 **It may never END its turn on your tile** — the defect Richard found by
 * playing. An enemy that landed on you had `dx = dy = 0` the next turn, so it had
 * no candidate step and simply stayed: invisible under the sprite, a heart every
 * move, nothing you could do. The two directions are now different events:
 *
 * | what happened | cost | what becomes of it |
 * |---|---|---|
 * | it reached you | a heart | **it holds its ground** — you have to run |
 * | you charged it | a heart | **it is gone** — you fought through |
 *
 * ⚠️ **Asymmetric on purpose, and the symmetric version was tried first.**
 * Removing it in both directions fixed the drain and then made the game
 * un-losable: every enemy costs at most one heart, so with three hearts only the
 * three-enemy room could be failed and rooms 1–4 could not be lost at all.
 * A pursuer surviving keeps the pressure; charging one keeps every one-wide
 * corridor passable, so a room can never be sealed by a body.
 *
 * ⚠️ One heart per turn even if two of them get you — `Counter.decrease` steps by
 * one. Recorded rather than fixed: it errs toward the player.
 */
export const WORLD_TURN_SCRIPT = `var rows = String(Inputs.grid || '').split('\\n');
var w = Number(Inputs.w) || 0;
var px = Number(Inputs.px);
var py = Number(Inputs.py);

function wall(x, y) {
  // Same NaN guard as Game/Move's: an un-loaded room makes every coordinate NaN.
  if (!Number.isFinite(x) || !Number.isFinite(y)) return true;
  if (x < 0 || y < 0 || x >= w || y >= rows.length) return true;
  var ch = rows[y].charAt(x);
  return ch === '#' || ch === '';
}

var list = Inputs.enemies || [];
var out = [];
var claimed = {};
var hurt = false;

for (var i = 0; i < list.length; i++) {
  var parts = String(list[i]).split(',');
  var ex = Number(parts[0]);
  var ey = Number(parts[1]);

  // YOU CHARGED IT: it is already on your tile, because it will never step
  // there itself. Costs a heart, and it is gone - which is what keeps a
  // one-wide corridor passable instead of sealed by a body.
  if (ex === px && ey === py) {
    hurt = true;
    continue;
  }

  var dx = px - ex;
  var dy = py - ey;
  var tries = [];
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx !== 0) tries.push([ex + (dx > 0 ? 1 : -1), ey]);
    if (dy !== 0) tries.push([ex, ey + (dy > 0 ? 1 : -1)]);
  } else {
    if (dy !== 0) tries.push([ex, ey + (dy > 0 ? 1 : -1)]);
    if (dx !== 0) tries.push([ex + (dx > 0 ? 1 : -1), ey]);
  }

  var nx = ex;
  var ny = ey;
  for (var t = 0; t < tries.length; t++) {
    var cx = tries[t][0];
    var cy = tries[t][1];
    if (wall(cx, cy)) continue;
    if (claimed[cx + ',' + cy]) continue;
    // IT REACHED YOU: an attack, and it HOLDS ITS GROUND. Never ending a turn
    // on your tile is what makes the distance always at least one, so moving
    // away always works.
    if (cx === px && cy === py) {
      hurt = true;
      break;
    }
    nx = cx;
    ny = cy;
    break;
  }
  claimed[nx + ',' + ny] = true;
  out.push(nx + ',' + ny);
}

// A fresh array, and one that CANNOT contain your own tile.
Outputs.enemies = out;
Outputs.hurt = hurt;`;

/**
 * Seam 6 — project the state onto rows of cells.
 *
 * The one Function left fully reactive, because following the state is its whole
 * job. It returns **rows**, not a flat list, so the board is two nested
 * repeaters and no CSS grid has to fight a Group's inline flex for the layout.
 *
 * ⚠️ The order of the tests is the draw order, and it is a decision: you are
 * drawn over an enemy, an enemy over a coin, a coin over the exit. Standing on
 * the way out should look like standing on the way out, so `player` wins — and
 * the exit gate has already fired by the time anyone looks.
 */
export const BUILD_CELLS_SCRIPT = `var rows = String(Inputs.grid || '').split('\\n');
// The legend, as the page's own Static Data node wrote it. A kind with no row
// falls back to the first, so an unknown kind draws as floor rather than as
// nothing — an invisible tile is a hole in the board.
var palette = {};
var legend = Inputs.legend || [];
for (var p = 0; p < legend.length; p++) palette[String(legend[p].kind)] = legend[p];
var fallback = legend[0] || { ground: '', edge: '', ink: '' };
var w = Number(Inputs.w) || 0;
var px = Number(Inputs.px);
var py = Number(Inputs.py);

var coinAt = {};
var coins = Inputs.coins || [];
for (var i = 0; i < coins.length; i++) coinAt[String(coins[i])] = true;

var enemyAt = {};
var enemies = Inputs.enemies || [];
for (var j = 0; j < enemies.length; j++) enemyAt[String(enemies[j])] = true;

var out = [];
for (var y = 0; y < rows.length; y++) {
  var cells = [];
  for (var x = 0; x < w; x++) {
    var ch = rows[y].charAt(x) || '#';
    var kind = 'floor';
    var glyph = '';
    if (ch === '#') {
      kind = 'wall';
    } else if (x === px && y === py) {
      kind = 'player';
      glyph = '${GLYPH.player}';
    } else if (enemyAt[x + ',' + y]) {
      kind = 'enemy';
      glyph = '${GLYPH.enemy}';
    } else if (coinAt[x + ',' + y]) {
      kind = 'coin';
      glyph = '${GLYPH.coin}';
    } else if (ch === '>') {
      kind = 'exit';
      glyph = '${GLYPH.exit}';
    }
    var look = palette[kind] || fallback;
    cells.push({
      id: x + ',' + y,
      kind: kind,
      glyph: glyph,
      ground: look.ground,
      edge: look.edge,
      ink: look.ink
    });
  }
  out.push({ id: 'row' + y, cells: cells });
}
Outputs.rows = out;`;

// ── The app shell ────────────────────────────────────────────────────────────

export const APP_COMPONENT = 'App';

/**
 * The three things a node port cannot say about this board.
 *
 * 🔴 **`!important` is load-bearing here and it is not laziness.** A `Group`'s
 * size arrives as an inline style, and an inline style beats a stylesheet — so
 * the phone rule cannot shrink a tile without it. The alternative was a CSS grid
 * for the whole board, which would have had to fight the same inline `display:
 * flex` on every one of the board's own Groups; two nested repeaters and one
 * size override is the smaller surface. The rule is narrow on purpose: it
 * overrides two properties on one class at one breakpoint.
 *
 * ⚠️ **Nothing here uses `var(--shadow-*)`.** On an ink ground a shadow is
 * invisible, so a lift written as one would be a rule that appears to work and
 * does nothing — the trap `tpl003Theme.ts` recorded from the other side. The
 * board's depth is a border and a ground.
 *
 * The last block is not decoration: a person who has asked their operating
 * system to stop moving things gets a board that does not move.
 */
export const BOARD_CSS = `/* The pixel dungeon — the three things a node port cannot say.
   Everything a port CAN express is set on the node, not here. */

.pressable { cursor: pointer; }

/* 🔴 The BODY's ground, and it is not belt-and-braces — it is the fix for a
   white band under the whole game. bodyScroll:true leaves #root static, so
   anything below the content is the browser's own white, and measuring it said
   so: body background-color read rgb(255,255,255) under a dark app. A Group's
   backgroundColor cannot reach the body; only a stylesheet can.
   (No backticks in this block: it lives inside a TS template literal, and a
   backtick here ends the string 200 lines early.) */
html, body { background: var(--background); }

/* A tile settles into its new colour rather than snapping. 90ms is under the
   ~100ms that reads as "instant", so the board still feels keyed rather than
   animated. */
.game-cell {
  transition: background-color 90ms ease-out, border-color 90ms ease-out, color 90ms ease-out;
}

/* You, and the way out, breathe. An enemy does not — a thing that pulses reads
   as alive and friendly, and this one is neither. */
.game-you { animation: game-pulse 1.6s ease-in-out infinite; }
.game-exit { animation: game-pulse 2.4s ease-in-out infinite; }
@keyframes game-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.62; }
}

/* 🔴 A phone. The tile size is an inline style from the node's own width and
   height ports, so shrinking it from a stylesheet needs !important. 12 tiles at
   26px plus the gaps is 334px, which fits a portrait phone; at 34px it does not. */
@media (max-width: 480px) {
  .game-cell {
    width: 26px !important;
    height: 26px !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .game-cell { transition: none; }
  .game-you, .game-exit { animation: none; }
  /* The coral edge still arrives — it is the information. Only the movement goes. */
  .game-board-hit, .game-board-dead { animation: none; }
}`;

export const APP_NODES = [
  group('app_root', 'App', undefined, {
    sizeMode: 'explicit',
    width: pct(100),
    height: pct(100),
    // 🔴 Without this the app ends where its content ends and the rest of the
    // viewport is the browser's white. On a dark game that is the first thing
    // anyone sees, and `bodyScroll: true` makes the gap taller than the board.
    backgroundColor: 'var(--background)'
  }, ['app_router']),
  { id: 'app_router', type: 'Router', label: 'Main router', parent: 'app_root', parameters: { name: ROUTER } },
  logic('app_css', CSS_NODE, 'The board — motion, and the phone', { style: BOARD_CSS })
];
export const APP_WIRES: unknown[] = [];

// ── Game/Cell — one tile, and the legend it draws ───────────────────────────

/**
 * One tile.
 *
 * 🔴 **The colours arrive as inputs, and the legend that chose them is a
 * `Static Data` node on the page.** This was a `States` node with six states and
 * three values — the more node-native shape, and the one that reads best in the
 * property panel. It does not work: **a value wired into a States node's
 * `currentState` never changes its state**, so every one of the 108 tiles drew
 * the first state's colours and the board came out monochrome. Measured in a
 * browser (D43), with the working control beside it — `to-<state>` *signals* into
 * a States node do work, and the banner is driven by four of them.
 *
 * ⚠️ **`kind` is still an input, and nothing is wired to it.** It is what the
 * tile IS, it is in the node tree beside the colours, and it is the port a person
 * adding a sound or an animation per kind will reach for. A port that names the
 * thing is worth more than one fewer port.
 */
const CELL: Tpl005Component = {
  path: 'Game/Cell',
  nodes: [
    group('clTile', 'One tile', undefined, {
      sizeMode: 'explicit',
      width: px(TILE),
      height: px(TILE),
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 'var(--radius-sm)',
      borderStyle: 'solid',
      borderWidth: 'var(--border-1)',
      cssClassName: 'game-cell'
    }, ['clGlyph']),
    text('clGlyph', 'What is on it', 'clTile', '', {
      ...T_BODY,
      fontFamily: 'var(--font-mono)',
      fontSize: px(Math.round(TILE * 0.53)),
      lineHeight: 1,
      sizeMode: 'contentSize'
    }),
    inputs('clInputs', 'The tile', [
      ['kind', 'string'],
      ['glyph', 'string'],
      ['ground', 'color'],
      ['edge', 'color'],
      ['ink', 'color']
    ])
  ],
  connections: [
    wire('clInputs', 'glyph', 'clGlyph', 'text'),
    wire('clInputs', 'ground', 'clTile', 'backgroundColor'),
    wire('clInputs', 'edge', 'clTile', 'borderColor'),
    wire('clInputs', 'ink', 'clGlyph', 'color')
  ]
};

// ── Game/Row — one row of the board ─────────────────────────────────────────

/**
 * One row of tiles.
 *
 * 🔴 **The board is two nested repeaters, and that is why there is no CSS grid
 * in it.** A flat list of 108 cells would need `display: grid` to wrap at
 * exactly twelve, and a Group renders `display: flex` inline — so the grid
 * would have to win an `!important` fight on the board, the row and the cell.
 * A row component with its own `For Each` gets the same layout out of the
 * product's own nodes, and it reads in the editor the way the board reads on
 * screen.
 */
const ROW: Tpl005Component = {
  path: 'Game/Row',
  nodes: [
    group('rwRow', 'One row', undefined, {
      sizeMode: 'contentSize',
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: 'var(--space-0-5)'
    }, ['rwCells']),
    logic('rwCells', FOR_EACH_NODE, 'One tile per cell', { template: CELL_COMPONENT, templateType: 'explicit' }),
    inputs('rwInputs', 'The row', [['cells', 'array']])
  ],
  connections: [wire('rwInputs', 'cells', 'rwCells', 'items')]
};

// ── Game/Move — the move rule, written once and placed four times ────────────

/**
 * One step in one direction, and the only place the rules of walking live.
 *
 * 🔴 **Placed four times with `dx`/`dy` as instance parameters** — up, down,
 * left, right — so there is one implementation of "can I go there?" rather than
 * four that drift. This is the interface doctrine's whole argument, and here it
 * also fixes a bug: see (a) in the module header. A direction arriving as a
 * *parameter* is settled before any signal fires, where a direction arriving as
 * a value on a wire is whatever published last.
 *
 * 🔴 **The commit is inside, and it is ordered by `done`.** `Set Variable`'s
 * `done` fires *after* every Variable node reading it has been notified, so:
 * write x → `done` → write y → `done` → `moved` leaves. Everything downstream
 * then reads the variables and cannot see a half-moved player.
 *
 * ⚠️ **`onfalse` is the success path, and that is deliberate.** The question the
 * gate asks is *"is there a wall in the way?"*, so the move happens when the
 * answer is no. Inverting it to ask "can I move?" would need an extra
 * `Expression` to negate `blocked` — a node whose only job is to make one
 * sentence read forwards.
 *
 * The `refused` output is wired to nothing in this template. It exists because
 * it is the thing a person adds a bump sound to, and finding it already there is
 * the difference between extending a graph and rewiring one.
 */
const MOVE: Tpl005Component = {
  path: 'Game/Move',
  nodes: [
    inputs('mvInputs', 'The step', [
      ['go', 'signal'],
      ['dx', 'number'],
      ['dy', 'number'],
      ['px', 'number'],
      ['py', 'number'],
      ['grid', 'string'],
      ['gridWidth', 'number']
    ]),
    logic('mvTx', EXPRESSION_NODE, 'The tile across', { expression: 'px + dx' }),
    logic('mvTy', EXPRESSION_NODE, 'The tile down', { expression: 'py + dy' }),
    logic('mvWall', FUNCTION_NODE, 'Is there a wall in the way?', { functionScript: IS_WALL_SCRIPT }),
    gate('mvGate', 'Can you walk there?'),
    logic('mvSetX', SET_VARIABLE_NODE, 'You are here now — across', { name: VAR_X }),
    logic('mvSetY', SET_VARIABLE_NODE, 'You are here now — down', { name: VAR_Y }),
    outputs('mvOutputs', 'What happened', [
      ['moved', 'signal'],
      ['refused', 'signal']
    ])
  ],
  connections: [
    // Where would this step land?
    wire('mvInputs', 'px', 'mvTx', 'px'),
    wire('mvInputs', 'dx', 'mvTx', 'dx'),
    wire('mvInputs', 'py', 'mvTy', 'py'),
    wire('mvInputs', 'dy', 'mvTy', 'dy'),
    // Ask the room about that tile.
    wire('mvInputs', 'grid', 'mvWall', 'in-grid'),
    wire('mvInputs', 'gridWidth', 'mvWall', 'in-w'),
    wire('mvTx', 'result', 'mvWall', 'in-x'),
    wire('mvTy', 'result', 'mvWall', 'in-y'),
    // The decision, tested only when a key says so.
    wire('mvWall', 'out-blocked', 'mvGate', 'condition'),
    wire('mvInputs', 'go', 'mvGate', 'eval'),
    // No wall: commit, in order, then say so.
    wire('mvTx', 'result', 'mvSetX', 'value'),
    wire('mvTy', 'result', 'mvSetY', 'value'),
    wire('mvGate', 'onfalse', 'mvSetX', 'do'),
    wire('mvSetX', 'done', 'mvSetY', 'do'),
    wire('mvSetY', 'done', 'mvOutputs', 'moved'),
    // A wall: nothing moves, and the graph still has somewhere to say it.
    wire('mvGate', 'ontrue', 'mvOutputs', 'refused')
  ]
};

// ── Game/Stat — one reading in the HUD ──────────────────────────────────────

/** One HUD reading: a word, a number, and the colour that says what kind of number it is. */
const STAT: Tpl005Component = {
  path: 'Game/Stat',
  nodes: [
    group('stTile', 'One reading', undefined, {
      ...contentSized(composition('statTile')),
      flexDirection: 'column',
      alignItems: 'center',
      rowGap: 'var(--space-1)',
      minWidth: px(92),
      paddingTop: 'var(--space-3)',
      paddingBottom: 'var(--space-3)',
      paddingLeft: 'var(--space-5)',
      paddingRight: 'var(--space-5)'
    }, ['stLabel', 'stValue']),
    text('stLabel', 'What it is', 'stTile', '', { ...T_META, color: 'var(--muted-foreground)', sizeMode: 'contentSize' }),
    // 🔴 `tabular-nums` for the reason D30 measured on the members' area: Inter's
    // proportional figures make a number that counts up rag from side to side.
    text('stValue', 'The number', 'stTile', '', {
      ...composition('cardTitle'),
      fontVariantNumeric: 'tabular-nums',
      fontFamily: 'var(--font-mono)',
      fontSize: px(26),
      lineHeight: 1.1,
      sizeMode: 'contentSize'
    }),
    inputs('stInputs', 'The reading', [
      ['label', 'string'],
      ['value', 'string'],
      ['tone', 'color']
    ])
  ],
  connections: [
    wire('stInputs', 'label', 'stLabel', 'text'),
    wire('stInputs', 'value', 'stValue', 'text'),
    wire('stInputs', 'tone', 'stValue', 'color')
  ]
};

// ── Game/KeyCap — one line of the controls legend ────────────────────────────

/** One key, and what it does. Placed four times; the arrow keys are not guessable from a board. */
const KEYCAP: Tpl005Component = {
  path: 'Game/KeyCap',
  nodes: [
    group('kcRow', 'One key', undefined, {
      sizeMode: 'contentSize',
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: 'var(--space-2)'
    }, ['kcCap', 'kcWhat']),
    group('kcCap', 'The key itself', 'kcRow', {
      sizeMode: 'contentSize',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: px(30),
      paddingTop: px(3),
      paddingBottom: px(3),
      paddingLeft: 'var(--space-2)',
      paddingRight: 'var(--space-2)',
      backgroundColor: 'var(--surface-raised)',
      borderRadius: 'var(--radius-sm)',
      borderStyle: 'solid',
      borderWidth: 'var(--border-1)',
      borderColor: 'var(--border-strong)'
    }, ['kcCapText']),
    text('kcCapText', 'The glyph on the key', 'kcCap', '', {
      ...T_META,
      fontFamily: 'var(--font-mono)',
      color: 'var(--foreground)',
      sizeMode: 'contentSize'
    }),
    text('kcWhat', 'What it does', 'kcRow', '', { ...T_META, color: 'var(--muted-foreground)', sizeMode: 'contentSize' }),
    inputs('kcInputs', 'The key', [
      ['cap', 'string'],
      ['what', 'string'],
      ['tone', 'color']
    ])
  ],
  connections: [
    wire('kcInputs', 'cap', 'kcCapText', 'text'),
    wire('kcInputs', 'what', 'kcWhat', 'text'),
    // 🔴 `tone` is why the glyph legend can be the same component as the key
    // legend. Every instance sets it — a colour port left unfed by a wire
    // arrives as undefined and blanks the text it was meant to colour, which is
    // a worse failure than a legend in one colour.
    wire('kcInputs', 'tone', 'kcCapText', 'color')
  ]
};

// ── Pages/Play — the game ───────────────────────────────────────────────────

/** The four directions, and the key each one answers to. `dx`/`dy` are instance parameters. */
const DIRECTIONS: ReadonlyArray<{ id: string; label: string; cap: string; dx: number; dy: number; keys: string }> = [
  { id: 'Up', label: 'up', cap: '↑', dx: 0, dy: -1, keys: 'up, arrowup, w' },
  { id: 'Down', label: 'down', cap: '↓', dx: 0, dy: 1, keys: 'down, arrowdown, s' },
  { id: 'Left', label: 'left', cap: '←', dx: -1, dy: 0, keys: 'left, arrowleft, a' },
  { id: 'Right', label: 'right', cap: '→', dx: 1, dy: 0, keys: 'right, arrowright, d' }
];

/** The glyph legend, drawn with the same component as the key legend. */
const GLYPH_LEGEND: ReadonlyArray<{ id: string; cap: string; what: string; tone: string }> = [
  { id: 'You', cap: GLYPH.player, what: 'you', tone: LEGEND.good },
  { id: 'Coin', cap: GLYPH.coin, what: 'a coin', tone: LEGEND.good },
  { id: 'Foe', cap: GLYPH.enemy, what: 'steps when you do', tone: LEGEND.costly },
  { id: 'Out', cap: GLYPH.exit, what: 'the way out', tone: LEGEND.exit }
];

/**
 * 🔴 **`allowRepeat: true`, and it is a decision rather than a default.**
 * The module ships auto-repeat OFF, so a held arrow moves you one tile and then
 * nothing. In a turn-based game that is the wrong half of the trade: the world
 * only moves when you do, so a held key cannot run you into anything you did not
 * have time to see, and walking a corridor without lifting a finger is how a
 * grid game is expected to feel.
 *
 * ⚠️ **`w`/`a`/`s`/`d` are listed beside the arrows, and the module's text-field
 * rule is the reason it is safe**: a bare key is suppressed while focus is in an
 * input, and this page has no input. A template that later grows a "your name"
 * field will find WASD dead and the arrows alive — which is why the arrows are
 * first in every list and the only ones the legend teaches.
 */
const KEY_PARAMS = { allowRepeat: true, preventDefault: true, ignoreInTextFields: true } as const;

/**
 * What the board looks like the instant something happens to you.
 *
 * ⚠️ `cls` carries the whole class list, not an extra one: `cssClassName`
 * REPLACES the parameter, so the shared `game-board` has to travel with each
 * state or the board loses its own styling the first time it flashes.
 */
const BOARD_STATES = {
  states: 'calm,hit,dead',
  values: 'edge,cls',
  'type-edge': 'color',
  'type-cls': 'string',
  'value-calm-edge': 'var(--border-strong)',
  'value-calm-cls': 'game-board game-board-calm',
  // A heart gone: the board takes the enemy's colour for a moment.
  'value-hit-edge': LEGEND.costly,
  'value-hit-cls': 'game-board game-board-hit',
  // Out of hearts: it holds, rather than flashing, so the restart is legible.
  'value-dead-edge': LEGEND.costly,
  'value-dead-cls': 'game-board game-board-dead'
};

const BANNER_STATES = {
  states: 'playing,cleared,died,won',
  values: 'title,line,shown,tone',
  'type-title': 'string',
  'type-line': 'string',
  'type-shown': 'boolean',
  'type-tone': 'color',
  // Playing — nothing to say, and nothing taking up room to say it in.
  'value-playing-title': '',
  'value-playing-line': '',
  'value-playing-shown': false,
  'value-playing-tone': 'var(--foreground)',
  // Cleared a room.
  'value-cleared-title': 'Room cleared.',
  'value-cleared-line': 'The next one is busier. Keep moving.',
  'value-cleared-shown': true,
  'value-cleared-tone': LEGEND.good,
  // Caught. You drop what you were carrying and the room starts again.
  'value-died-title': 'They got you.',
  'value-died-line': 'You dropped your coins and the room starts again. Move to go on.',
  'value-died-shown': true,
  'value-died-tone': LEGEND.costly,
  // All five.
  'value-won-title': 'Out, with all five behind you.',
  'value-won-line': 'That is the lot. Move to start another run.',
  'value-won-shown': true,
  'value-won-tone': LEGEND.exit
};

// ── Game/Hud and Game/Teach — the presentation, off the page ────────────────

/**
 * The three readings.
 *
 * 🔴 **A component because of what it leaves behind, not to please a linter.**
 * The door raised `oversized-page` at 68 nodes on `Pages/Play` and said the
 * useful thing: *"a component instance counts as one node here, so factoring a
 * section out is a real reduction, not a rename."* The readings and the
 * teaching block are the two parts of that page that are **not the game** — so
 * moving them out means a person who opens `Pages/Play` to see how it works
 * finds the rules and not the furniture.
 */
const HUD: Tpl005Component = {
  path: 'Game/Hud',
  nodes: [
    group('hdRow', 'The readings', undefined, {
      sizeMode: 'contentSize',
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center',
      columnGap: 'var(--space-3)',
      rowGap: 'var(--space-3)'
    }, ['hdHearts', 'hdCoins', 'hdRoom']),
    place('hdHearts', STAT_COMPONENT, 'Hearts', 'hdRow', { label: 'Hearts', tone: LEGEND.costly }),
    place('hdCoins', STAT_COMPONENT, 'Coins', 'hdRow', { label: 'Coins', tone: LEGEND.good }),
    place('hdRoom', STAT_COMPONENT, 'Room', 'hdRow', { label: 'Room', tone: LEGEND.exit }),
    inputs('hdInputs', 'The readings', [
      ['hearts', 'string'],
      ['coins', 'string'],
      ['room', 'string']
    ])
  ],
  connections: [
    wire('hdInputs', 'hearts', 'hdHearts', 'value'),
    wire('hdInputs', 'coins', 'hdCoins', 'value'),
    wire('hdInputs', 'room', 'hdRoom', 'value')
  ]
};

/**
 * What the keys are, and what the glyphs mean.
 *
 * 🔴 **A board teaches neither.** Nothing on a grid says "arrow keys", and
 * nothing says a coral triangle is the thing that takes your hearts. A game
 * whose controls are guessable only by trying every key is a game most people
 * close. It takes no inputs — it is the same for every install — so it is the
 * cheapest component in the template and the one most likely to be kept.
 */
const TEACH: Tpl005Component = {
  path: 'Game/Teach',
  nodes: [
    group('tcWrap', 'How to play', undefined, {
      width: pct(100),
      sizeMode: 'contentHeight',
      flexDirection: 'column',
      alignItems: 'center',
      rowGap: 'var(--space-3)'
    }, ['tcKeys', 'tcGlyphs']),
    group('tcKeys', 'The keys', 'tcWrap', {
      sizeMode: 'contentSize',
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center',
      columnGap: 'var(--space-6)',
      rowGap: 'var(--space-3)'
    }, DIRECTIONS.map((d) => `tcKey${d.id}`)),
    ...DIRECTIONS.map((d) =>
      place(`tcKey${d.id}`, KEYCAP_COMPONENT, `The ${d.label} key`, 'tcKeys', {
        cap: d.cap,
        what: d.label,
        tone: 'var(--foreground)'
      })
    ),
    group('tcGlyphs', 'What the glyphs mean', 'tcWrap', {
      sizeMode: 'contentSize',
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center',
      columnGap: 'var(--space-6)',
      rowGap: 'var(--space-3)'
    }, GLYPH_LEGEND.map((g) => `tcLeg${g.id}`)),
    ...GLYPH_LEGEND.map((g) =>
      place(`tcLeg${g.id}`, KEYCAP_COMPONENT, `Legend — ${g.what}`, 'tcGlyphs', {
        cap: g.cap,
        what: g.what,
        tone: g.tone
      })
    )
  ],
  connections: []
};

/**
 * The page.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## The step, in the order it happens
 *
 * 1. A key pulses one `Game/Move` instance's `go`.
 * 2. That instance asks the room about the tile, and if it is not a wall writes
 *    `playerX` then `playerY`, each waiting on the other's `done`, and then
 *    emits `moved`.
 * 3. `moved` runs `takeCoin`. Its `success` evaluates **two** gates: was there a
 *    coin (→ a coin on the count, and the shorter list stored), and is this tile
 *    the way out.
 * 4. `moved` also runs `stepEnemies`. Its `success` stores the new positions;
 *    that store's `done` runs `hitCount`, whose `success` evaluates the hit gate
 *    (→ a heart off).
 * 5. A heart changing evaluates the death gate.
 *
 * 🔴 **Why the exit gate is evaluated by `takeCoin.success` and not by `moved`.**
 * The banner is cleared by `moved` (`to-playing`), and a gate evaluated by the
 * same pulse would be racing it — "Room cleared" would appear and vanish
 * depending on which wire the runtime walked first. Everything that *writes* the
 * banner is therefore driven from strictly later in the chain than the thing
 * that clears it. This is the kind of defect that renders perfectly and shows up
 * once in twenty plays.
 *
 * ## 🔴 Why `plPickLevel` has nothing wired to its `run`
 *
 * The Function node auto-runs at load **only if `run` is unconnected**
 * (`simplejavascript.ts`: `if (!this.isInputConnected('run')) this.scheduleRun()`).
 * Wiring a restart to `run` would therefore have cost the boot: nothing else on
 * this page is guaranteed to publish at load, so the first room might never be
 * parsed and the board would open empty.
 *
 * So a restart is a **reactive nudge** instead: `plReloads` counts and its count
 * feeds `in-reload`, a ticked input the script echoes back out (it must READ it,
 * or the port does not exist — see the note in the script). A room reloads
 * because a number it depends on changed — which is also deterministic, where
 * a reset plus a re-run would have been two signals racing.
 *
 * ## What a person changes first
 *
 * `EDIT — the five rooms` is one `Static Data` node holding a JSON array of
 * `{ name, grid }`. Adding a sixth room is editing that node and nothing else:
 * no new component, no rewiring, no code. `docs/START-HERE.md` says so, and the
 * gate proves it by doing it.
 */
const PLAY: Tpl005Component = {
  path: 'Pages/Play',
  nodes: [
    // ── The visual tree ────────────────────────────────────────────────────
    { id: 'plPage', type: 'Page', label: 'Play', parameters: { title: 'Pixel Dungeon', urlPath: '/' }, children: ['plWrap'] },
    group('plWrap', 'The screen', 'plPage', {
      width: pct(100),
      sizeMode: 'contentHeight',
      flexDirection: 'column',
      alignItems: 'center',
      rowGap: 'var(--space-6)',
      paddingTop: 'var(--space-10)',
      paddingBottom: 'var(--space-10)',
      paddingLeft: 'var(--space-4)',
      paddingRight: 'var(--space-4)',
      backgroundColor: 'var(--background)'
    }, ['plHead', 'plHud', 'plBoardFrame', 'plBanner', 'plTeach', 'plFoot']),

    // The title block.
    group('plHead', 'What this is', 'plWrap', {
      width: pct(100),
      sizeMode: 'contentHeight',
      flexDirection: 'column',
      alignItems: 'center',
      rowGap: 'var(--space-1)'
    }, ['plEyebrow', 'plTitle', 'plRoom']),
    text('plEyebrow', 'A NodeGX template', 'plHead', 'A NodeGX template', {
      ...T_EYEBROW,
      color: 'var(--primary)',
      sizeMode: 'contentSize'
    }),
    text('plTitle', `${EDIT}the name of your game`, 'plHead', 'Pixel Dungeon', {
      ...H_TITLE,
      sizeMode: 'contentSize'
    }),
    text('plRoom', 'Which room this is', 'plHead', '', {
      ...T_LEAD,
      color: 'var(--muted-foreground)',
      sizeMode: 'contentSize'
    }),

    // The HUD and the teaching block are components, so what is left on this
    // page is the game. See the note on `HUD`.
    place('plHud', HUD_COMPONENT, 'The readings', 'plWrap'),

    // The board.
    group('plBoardFrame', 'The board', 'plWrap', {
      cssClassName: 'game-board game-board-calm',
      sizeMode: 'contentSize',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: 'var(--space-4)',
      paddingBottom: 'var(--space-4)',
      paddingLeft: 'var(--space-4)',
      paddingRight: 'var(--space-4)',
      backgroundColor: 'var(--surface)',
      borderRadius: 'var(--radius-xl)',
      borderStyle: 'solid',
      borderWidth: 'var(--border-1)',
      borderColor: 'var(--border-strong)'
    }, ['plBoard']),
    group('plBoard', 'The rows', 'plBoardFrame', {
      sizeMode: 'contentSize',
      flexDirection: 'column',
      alignItems: 'center',
      rowGap: 'var(--space-0-5)'
    }, ['plRows']),
    logic('plRows', FOR_EACH_NODE, 'One row per row of the room', { template: ROW_COMPONENT, templateType: 'explicit' }),

    // The banner. `mounted`, never `visible` — a hidden banner that kept its
    // height would push the board around on every room.
    group('plBanner', 'What just happened', 'plWrap', {
      sizeMode: 'contentSize',
      flexDirection: 'column',
      alignItems: 'center',
      rowGap: 'var(--space-1)',
      paddingTop: 'var(--space-4)',
      paddingBottom: 'var(--space-4)',
      paddingLeft: 'var(--space-6)',
      paddingRight: 'var(--space-6)',
      backgroundColor: 'var(--surface)',
      borderRadius: 'var(--radius-lg)',
      borderStyle: 'solid',
      borderWidth: 'var(--border-1)',
      borderColor: 'var(--border)',
      mounted: false
    }, ['plBannerTitle', 'plBannerLine']),
    text('plBannerTitle', 'The headline', 'plBanner', '', { ...H_SECTION, sizeMode: 'contentSize' }),
    text('plBannerLine', 'What to do about it', 'plBanner', '', {
      ...T_BODY,
      color: 'var(--muted-foreground)',
      sizeMode: 'contentSize'
    }),

    place('plTeach', TEACH_COMPONENT, 'How to play', 'plWrap'),

    text('plFoot', 'Where to start editing', 'plWrap', 'The five rooms are one Static Data node — open it and add a sixth.', {
      ...T_META,
      color: 'var(--muted-foreground)',
      sizeMode: 'contentSize'
    }),

    // ── The room, and the run ──────────────────────────────────────────────
    {
      id: 'plLevels',
      type: STATIC_DATA_NODE,
      label: `${EDIT}the five rooms — this list IS the game`,
      parameters: { type: 'json', json: LEVELS_JSON }
    },
    logic('plLevel', COUNTER_NODE, 'Which room', {
      startValue: 1,
      limitsMin: 1,
      limitsMax: LEVELS.length,
      limitsEnabled: true
    }),
    logic('plCoins', COUNTER_NODE, 'Coins you are carrying', { startValue: 0 }),
    logic('plHearts', COUNTER_NODE, 'Hearts', {
      startValue: START_HP,
      limitsMin: 0,
      limitsMax: START_HP,
      limitsEnabled: true
    }),
    // The nudge that makes a room reload without touching `run`. See the header.
    logic('plReloads', COUNTER_NODE, 'How many times this room has restarted', { startValue: 0 }),

    logic('plPickLevel', FUNCTION_NODE, 'Read the room out of its string', { functionScript: PICK_LEVEL_SCRIPT }),

    // Where you are, what is left, and what is chasing you.
    logic('plVarX', VARIABLE_NODE, 'You — across', { name: VAR_X }),
    logic('plVarY', VARIABLE_NODE, 'You — down', { name: VAR_Y }),
    logic('plVarCoins', VARIABLE_NODE, 'Coins still on the floor', { name: VAR_COINS }),
    logic('plVarEnemies', VARIABLE_NODE, 'Where they are', { name: VAR_ENEMIES }),

    // Starting a room: four writes, each waiting on the last, then the hearts.
    logic('plLoadX', SET_VARIABLE_NODE, 'Put you at the start — across', { name: VAR_X }),
    logic('plLoadY', SET_VARIABLE_NODE, 'Put you at the start — down', { name: VAR_Y }),
    logic('plLoadCoins', SET_VARIABLE_NODE, 'Lay the coins out', { name: VAR_COINS }),
    logic('plLoadEnemies', SET_VARIABLE_NODE, 'Put them back where they started', { name: VAR_ENEMIES }),

    // The keys, and the one move rule placed once per direction.
    ...DIRECTIONS.map((d) =>
      logic(`plKey${d.id}`, TYPE_KEYBOARD, `The ${d.label} key`, { shortcut: d.keys, ...KEY_PARAMS })
    ),
    ...DIRECTIONS.map((d) => logic(`plMove${d.id}`, MOVE_COMPONENT, `Step ${d.label}`, { dx: d.dx, dy: d.dy })),

    // A coin.
    logic('plTakeCoin', FUNCTION_NODE, 'Was there a coin on that tile?', {
      functionScript: TAKE_COIN_SCRIPT,
      ...signalOnly('in-coins', 'in-x', 'in-y')
    }),
    gate('plCoinGate', 'Take it?'),
    logic('plSetCoins', SET_VARIABLE_NODE, 'One fewer on the floor', { name: VAR_COINS }),

    // The way out, and whether that was the last room.
    logic('plAtExit', EXPRESSION_NODE, 'Are you standing on the way out?', { expression: 'x === ex && y === ey' }),
    gate('plExitGate', 'Is that the way out?'),
    logic('plIsLast', EXPRESSION_NODE, 'Was that the last room?', { expression: 'lvl >= last' }),
    gate('plWinGate', 'The last room, or just this one?'),

    // Them.
    logic('plStepEnemies', FUNCTION_NODE, 'The world takes its turn', {
      functionScript: WORLD_TURN_SCRIPT,
      ...signalOnly('in-enemies', 'in-grid', 'in-w', 'in-px', 'in-py')
    }),
    logic('plSetEnemies', SET_VARIABLE_NODE, 'Where they are now', { name: VAR_ENEMIES }),
    // Two ways to lose a heart, and they are different events: one of them
    // reached you (it holds its ground), or you charged one (it is gone).
    gate('plHitGate', 'Take a heart?'),
    logic('plIsDead', EXPRESSION_NODE, 'Out of hearts?', { expression: 'hearts <= 0' }),
    gate('plDeathGate', 'Have they got you?'),

    // The board, drawn. The one Function left reactive.
    logic('plBuildCells', FUNCTION_NODE, 'Draw the room as it stands', { functionScript: BUILD_CELLS_SCRIPT }),
    {
      id: 'plPalette',
      type: STATIC_DATA_NODE,
      label: `${EDIT}what each kind of tile looks like`,
      parameters: { type: 'json', json: JSON.stringify(TILE_PALETTE, null, 2) }
    },

    // What the banner says, and the moment worth celebrating.
    logic('plBannerStates', STATES_NODE, 'What just happened, in words', BANNER_STATES),
    // 🔴 Richard, having played it: *"You also don't see any 'died' animation."*
    // He was right, and it was worse than missing polish — losing a heart had NO
    // feedback at all, so the only evidence was a number changing under the
    // board while the thing that did it was invisible under the sprite.
    // Driven by `to-<state>` SIGNALS, never by `currentState`: D43 measured that
    // a value wired into `currentState` does nothing, and these same signals are
    // what already drive the banner correctly.
    logic('plBoardStates', STATES_NODE, 'What the board is doing', BOARD_STATES),
    // The readings, as words.
    logic('plRoomFmt', FORMAT_NODE, 'Room n of five', { format: '{n} / {total}' }),
    logic('plRoomName', FORMAT_NODE, 'The room, named', { format: 'Room {n} — {name}' })
  ],

  connections: [
    // ── Reading the room ───────────────────────────────────────────────────
    // 🔴 Nothing is wired to `plPickLevel.run`, on purpose — see the header.
    wire('plLevels', 'items', 'plPickLevel', 'in-levels'),
    wire('plLevel', 'currentCount', 'plPickLevel', 'in-index'),
    wire('plReloads', 'currentCount', 'plPickLevel', 'in-reload'),

    // Starting it: four writes in a fixed order, then the hearts back to three.
    wire('plPickLevel', 'out-startX', 'plLoadX', 'value'),
    wire('plPickLevel', 'out-startY', 'plLoadY', 'value'),
    wire('plPickLevel', 'out-coins', 'plLoadCoins', 'value'),
    wire('plPickLevel', 'out-enemies', 'plLoadEnemies', 'value'),
    wire('plPickLevel', 'success', 'plLoadX', 'do'),
    wire('plLoadX', 'done', 'plLoadY', 'do'),
    wire('plLoadY', 'done', 'plLoadCoins', 'do'),
    wire('plLoadCoins', 'done', 'plLoadEnemies', 'do'),
    wire('plLoadEnemies', 'done', 'plHearts', 'reset'),

    // ── The readings ───────────────────────────────────────────────────────
    wire('plHearts', 'currentCount', 'plHud', 'hearts'),
    wire('plCoins', 'currentCount', 'plHud', 'coins'),
    wire('plLevel', 'currentCount', 'plRoomFmt', 'n'),
    wire('plPickLevel', 'out-levelCount', 'plRoomFmt', 'total'),
    wire('plRoomFmt', 'formatted', 'plHud', 'room'),
    wire('plLevel', 'currentCount', 'plRoomName', 'n'),
    wire('plPickLevel', 'out-roomName', 'plRoomName', 'name'),
    wire('plRoomName', 'formatted', 'plRoom', 'text'),

    // ── The four movers: one rule, four instances ──────────────────────────
    ...DIRECTIONS.flatMap((d) => [
      wire(`plKey${d.id}`, 'pressed', `plMove${d.id}`, 'go'),
      wire('plVarX', 'value', `plMove${d.id}`, 'px'),
      wire('plVarY', 'value', `plMove${d.id}`, 'py'),
      wire('plPickLevel', 'out-grid', `plMove${d.id}`, 'grid'),
      wire('plPickLevel', 'out-width', `plMove${d.id}`, 'gridWidth'),
      // A move clears the banner. Everything that WRITES the banner is driven
      // from strictly later in the chain, so the two cannot race.
      wire(`plMove${d.id}`, 'moved', 'plBannerStates', 'to-playing'),
      // ...and starts the turn.
      wire(`plMove${d.id}`, 'moved', 'plTakeCoin', 'run'),
      wire(`plMove${d.id}`, 'moved', 'plStepEnemies', 'run')
    ]),

    // ── A coin ─────────────────────────────────────────────────────────────
    wire('plVarCoins', 'value', 'plTakeCoin', 'in-coins'),
    wire('plVarX', 'value', 'plTakeCoin', 'in-x'),
    wire('plVarY', 'value', 'plTakeCoin', 'in-y'),
    wire('plTakeCoin', 'out-taken', 'plCoinGate', 'condition'),
    wire('plTakeCoin', 'success', 'plCoinGate', 'eval'),
    wire('plCoinGate', 'ontrue', 'plCoins', 'increase'),
    wire('plTakeCoin', 'out-coins', 'plSetCoins', 'value'),
    wire('plCoinGate', 'ontrue', 'plSetCoins', 'do'),

    // ── The way out ────────────────────────────────────────────────────────
    wire('plVarX', 'value', 'plAtExit', 'x'),
    wire('plVarY', 'value', 'plAtExit', 'y'),
    wire('plPickLevel', 'out-exitX', 'plAtExit', 'ex'),
    wire('plPickLevel', 'out-exitY', 'plAtExit', 'ey'),
    wire('plAtExit', 'result', 'plExitGate', 'condition'),
    // 🔴 Evaluated by the coin step's completion, not by `moved` — the header says why.
    wire('plTakeCoin', 'success', 'plExitGate', 'eval'),
    wire('plExitGate', 'ontrue', 'plWinGate', 'eval'),
    wire('plLevel', 'currentCount', 'plIsLast', 'lvl'),
    wire('plPickLevel', 'out-levelCount', 'plIsLast', 'last'),
    wire('plIsLast', 'result', 'plWinGate', 'condition'),
    // The last room: say so. 🔴 A `nodegx.confetti` node was here and was taken
    // out — measured as D41: that module FAILS TO REGISTER in a project holding
    // only it and the keyboard ("Cannot convert object to primitive value"),
    // while registering cleanly in a project holding all 32. A template is a
    // two-module project, which is the arm where it does not work.
    wire('plWinGate', 'ontrue', 'plBannerStates', 'to-won'),
    // Any other room: on to the next one.
    wire('plWinGate', 'onfalse', 'plLevel', 'increase'),
    wire('plWinGate', 'onfalse', 'plBannerStates', 'to-cleared'),

    // ── Them ───────────────────────────────────────────────────────────────
    wire('plVarEnemies', 'value', 'plStepEnemies', 'in-enemies'),
    wire('plPickLevel', 'out-grid', 'plStepEnemies', 'in-grid'),
    wire('plPickLevel', 'out-width', 'plStepEnemies', 'in-w'),
    wire('plVarX', 'value', 'plStepEnemies', 'in-px'),
    wire('plVarY', 'value', 'plStepEnemies', 'in-py'),
    wire('plStepEnemies', 'out-enemies', 'plSetEnemies', 'value'),
    wire('plStepEnemies', 'success', 'plSetEnemies', 'do'),
    // 🔴 ONE node answers the whole turn, so the gate's condition and its eval
    // come from the SAME script run with nothing in between. Driving found the
    // damage landing a move late twice — once through a reactive `Expression`,
    // once through a variable round-trip — and both intermediates are gone.
    wire('plStepEnemies', 'out-hurt', 'plHitGate', 'condition'),
    wire('plStepEnemies', 'success', 'plHitGate', 'eval'),
    wire('plHitGate', 'ontrue', 'plHearts', 'decrease'),

    // ── Out of hearts ──────────────────────────────────────────────────────
    wire('plHearts', 'currentCount', 'plIsDead', 'hearts'),
    wire('plIsDead', 'result', 'plDeathGate', 'condition'),
    wire('plHearts', 'countChanged', 'plDeathGate', 'eval'),
    // You drop the coins you were carrying, and the room starts again. The room
    // number is untouched, which is what makes this deterministic: one nudge,
    // one reload, no reset racing a re-run.
    wire('plDeathGate', 'ontrue', 'plCoins', 'reset'),
    wire('plDeathGate', 'ontrue', 'plReloads', 'increase'),
    wire('plDeathGate', 'ontrue', 'plBannerStates', 'to-died'),

    // ── The board, drawn ───────────────────────────────────────────────────
    wire('plPickLevel', 'out-grid', 'plBuildCells', 'in-grid'),
    wire('plPickLevel', 'out-width', 'plBuildCells', 'in-w'),
    wire('plVarX', 'value', 'plBuildCells', 'in-px'),
    wire('plVarY', 'value', 'plBuildCells', 'in-py'),
    wire('plVarCoins', 'value', 'plBuildCells', 'in-coins'),
    wire('plVarEnemies', 'value', 'plBuildCells', 'in-enemies'),
    wire('plPalette', 'items', 'plBuildCells', 'in-legend'),
    wire('plBuildCells', 'out-rows', 'plRows', 'items'),

    // ── The banner ─────────────────────────────────────────────────────────
    wire('plBannerStates', 'title', 'plBannerTitle', 'text'),
    wire('plBannerStates', 'line', 'plBannerLine', 'text'),
    wire('plBannerStates', 'shown', 'plBanner', 'mounted'),
    wire('plBannerStates', 'tone', 'plBannerTitle', 'color'),

    // ── The board reacts ───────────────────────────────────────────────────
    // A move settles it; a hit and a death are driven from strictly later in the
    // chain, so they win — the same ordering the banner relies on.
    ...DIRECTIONS.map((d) => wire(`plMove${d.id}`, 'moved', 'plBoardStates', 'to-calm')),
    wire('plHitGate', 'ontrue', 'plBoardStates', 'to-hit'),
    wire('plDeathGate', 'ontrue', 'plBoardStates', 'to-dead'),
    wire('plBoardStates', 'edge', 'plBoardFrame', 'borderColor'),
    wire('plBoardStates', 'cls', 'plBoardFrame', 'cssClassName')
  ]
};

/** Every component, in the order the door is given them. */
export const TPL005_COMPONENTS: ReadonlyArray<Tpl005Component> = [CELL, ROW, MOVE, STAT, KEYCAP, HUD, TEACH, PLAY];

/**
 * The library modules this template cannot work without.
 *
 * 🔴 **One, not two.** `confetti` was meant to be here for the win, and it is
 * measured as unable to register beside only the keyboard (D41). A module that
 * throws on registration takes only itself down — the control pair proved the
 * keyboard survives it — but a node that never reaches the catalog is a node the
 * door refuses to author, so the template cannot use it.
 */
export const REQUIRED_MODULES = ['keyboard-shortcuts'] as const;
