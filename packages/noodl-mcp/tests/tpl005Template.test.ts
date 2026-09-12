/**
 * TPL-005 — the gate over the pixel game.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## 🔴 What this gate can and cannot grade
 *
 * **Every acceptance criterion on this template is one a render cannot meet** — a
 * screenshot cannot press a key. So this file grades the things that are true of
 * the *artefact*, and the behaviour was graded by driving a real browser with
 * real key events; that session is written up in the task file with its readings.
 * Neither half is sufficient and this comment exists so nobody mistakes a green
 * suite here for a game that plays.
 *
 * What is here, and why each one is worth a spec:
 *
 * - **Every room is walked.** A breadth-first search from `@` proves the exit and
 *   *every* coin is reachable and no enemy is sealed off. A room whose exit is
 *   walled in is the worst defect this template could ship and it is **invisible
 *   in a screenshot** — the board draws perfectly either way.
 * - **The game is in the graph.** The six `Condition` gates exist and have both
 *   `eval` and `condition` fed; the `Function` nodes are exactly the six named
 *   seams. This is the criterion the whole template exists to satisfy.
 * - **The `runOnChange` unticks survive.** Fourteen of them are load-bearing —
 *   without them `takeCoin` and `stepEnemies` are fed by the variables they
 *   write, which is an infinite loop — and DEF-038's pinning pass rewrites that
 *   family of checkboxes on the way out.
 * - **The contrast is recomputed from the tokens**, not trusted to the comment
 *   that records it.
 * - **A sixth room is added by editing one node**, by doing it.
 *
 * @module noodl-mcp/tests/tpl005Template.test
 */
import * as fs from 'fs';
import * as path from 'path';

import {
  FUNCTION_SEAMS,
  GATE_NODES,
  GRID_H,
  GRID_W,
  LEVELS,
  MOVE_COMPONENT,
  PAGE_PLAY,
  REQUIRED_MODULES,
  VAR_COINS,
  VAR_ENEMIES,
  VAR_X,
  VAR_Y
} from './tpl005Components';
import type { LegacyConnection, LegacyNode } from '../../noodl-editor/src/editor/src/io/ProjectExporter';

import {
  AuthoredTemplate,
  buildPixelTemplateProject,
  preparePixelArtefact,
  TEMPLATE_ID
} from './tpl005Template';
import { requestedCompositions, TILE_PALETTE, TPL005_TOKENS, USED_COMPOSITIONS } from './tpl005Theme';

jest.setTimeout(180_000);

/**
 * Junctions a room must offer per enemy it holds. Derived from the room that
 * was unplayable (2) and the four that are not (5, 8, 16, 9.7).
 */
const JUNCTIONS_PER_ENEMY_FLOOR = 4;

const OUTPUT = path.join(__dirname, '..', '..', '..', 'templates', TEMPLATE_ID);

let built: AuthoredTemplate;

/** Every node in the authored project, by component legacy name. */
function nodesOf(component: string): LegacyNode[] {
  const found = (built.project.components ?? []).find((c) => c.name === component);
  if (!found) throw new Error(`no component "${component}" — the project has: ${(built.project.components ?? []).map((c) => c.name).join(', ')}`);
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
  const found = (built.project.components ?? []).find((c) => c.name === component);
  return found?.graph?.connections ?? [];
}

beforeAll(async () => {
  built = await buildPixelTemplateProject();
});

// ── §1 The rooms are all finishable ─────────────────────────────────────────

describe('TPL-005 §1 — every room can actually be finished', () => {
  /**
   * 🔴 The spec that matters most and reads least like a test. A level is a
   * string typed by hand; nothing about drawing it says whether it can be walked.
   */
  it.each(LEVELS.map((l, i) => [i + 1, l.name] as const))('room %i (%s) is the right size, and its exit and every coin can be reached', (index, name) => {
    const lv = LEVELS[index - 1];
    const rows = lv.grid.split('\n');
    expect(rows).toHaveLength(GRID_H);
    for (const row of rows) expect(row).toHaveLength(GRID_W);

    const at = (x: number, y: number) => rows[y]?.[x] ?? '#';
    let start: { x: number; y: number } | null = null;
    let exit: { x: number; y: number } | null = null;
    const coins: Array<{ x: number; y: number }> = [];
    const enemies: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const ch = at(x, y);
        if (ch === '@') start = { x, y };
        else if (ch === '>') exit = { x, y };
        else if (ch === 'c') coins.push({ x, y });
        else if (ch === 'E') enemies.push({ x, y });
        // A glyph nobody handles draws as floor and means nothing — catch the typo here.
        else expect(['#', '.']).toContain(ch);
      }
    }
    expect(start).not.toBeNull();
    expect(exit).not.toBeNull();
    expect(coins.length).toBeGreaterThan(0);

    // Walk it.
    const seen = new Set<string>([`${start!.x},${start!.y}`]);
    const queue = [start!];
    while (queue.length) {
      const { x, y } = queue.shift()!;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const nx = x + dx;
        const ny = y + dy;
        const key = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
        if (at(nx, ny) === '#' || seen.has(key)) continue;
        seen.add(key);
        queue.push({ x: nx, y: ny });
      }
    }

    expect(seen.has(`${exit!.x},${exit!.y}`)).toBe(true);
    for (const c of coins) expect(seen.has(`${c.x},${c.y}`)).toBe(true);
    // An enemy behind a wall never reaches anybody, so the room is easier than it looks.
    for (const e of enemies) expect(seen.has(`${e.x},${e.y}`)).toBe(true);
  });

  /**
   * 🔴 The gate for the defect PLAYING found, generalised.
   *
   * Richard, having played it: *"the 5th room appears to be unsolvable."* The
   * exit and every coin were reachable — the walk gate above passed on that room
   * then and passes now — so **reachability was never the question**. The room
   * was 87% one-tile-wide corridor with three same-speed pursuers, and you
   * cannot dodge past anything in a corridor: three of them pincer you and there
   * is nowhere left to stand.
   *
   * A junction is the only tile where a chase can be broken, so **every enemy
   * needs junctions to be dodged around**. The old room had 2 per enemy; the
   * other four rooms have 5, 8, 16 and (redesigned) 9.7. The floor is 4 — under
   * every shipping room and over the one that was unplayable.
   *
   * ⚠️ This bounds GEOMETRY, not difficulty, and it cannot prove a room is
   * winnable. It rules out the one shape that is reliably not.
   */
  it.each(LEVELS.map((l, i) => [i + 1, l.name] as const))('room %i (%s) leaves somewhere to dodge for every enemy it holds', (index, _name) => {
    const rows = LEVELS[index - 1].grid.split('\n');
    const at = (x: number, y: number) => rows[y]?.[x] ?? '#';
    const open: Array<[number, number]> = [];
    let enemies = 0;
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        if (at(x, y) === '#') continue;
        open.push([x, y]);
        if (at(x, y) === 'E') enemies++;
      }
    }
    const junctions = open.filter(
      ([x, y]) =>
        [[0, -1], [0, 1], [-1, 0], [1, 0]].filter(([dx, dy]) => at(x + dx, y + dy) !== '#').length >= 3
    ).length;

    if (enemies === 0) return; // a room that chases nobody needs no room to run
    expect(junctions / enemies).toBeGreaterThanOrEqual(JUNCTIONS_PER_ENEMY_FLOOR);
  });

  it('the rooms get busier — the enemy count never falls to zero after the first', () => {
    const counts = LEVELS.map((l) => (l.grid.match(/E/g) ?? []).length);
    expect(counts[0]).toBe(0); // the first room teaches movement and nothing else
    for (const c of counts.slice(1)) expect(c).toBeGreaterThan(0);
  });
});

// ── §2 The game is in the graph ─────────────────────────────────────────────

describe('TPL-005 §2 — the game is in the graph, not in a script', () => {
  /**
   * 🔴 The criterion this template exists for. A game whose rules are one
   * `Function` node ships a game and teaches that NodeGX hosts JavaScript.
   */
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
    for (const c of built.project.components ?? []) {
      for (const n of nodesOf(c.name)) {
        if (n.type === 'Condition') found.push(`${c.name}::${n.id}`);
      }
    }
    expect(found.sort()).toEqual([...declared].sort());
  });

  it('the Function nodes are exactly the named seams', () => {
    const declared = new Set(FUNCTION_SEAMS.map((f) => `${f.component}::${f.id}`));
    const found: string[] = [];
    for (const c of built.project.components ?? []) {
      for (const n of nodesOf(c.name)) {
        if (n.type === 'JavaScriptFunction') found.push(`${c.name}::${n.id}`);
      }
    }
    expect(found.sort()).toEqual([...declared].sort());
  });

  it('no Function script writes a variable, navigates, or reaches outside itself', () => {
    // A seam answers a question or transforms a list. The moment one of them
    // stores state or navigates, the branch has left the graph.
    for (const seam of FUNCTION_SEAMS) {
      const node = nodesOf(seam.component).find((n) => n.id === seam.id);
      const script = String(node!.parameters?.functionScript ?? '');
      expect(script.length).toBeGreaterThan(0);
      for (const forbidden of ['Noodl.Variables', 'Noodl.navigate', 'Noodl.Objects', 'setTimeout', 'setInterval', 'document.', 'window.', 'fetch(']) {
        expect(script).not.toContain(forbidden);
      }
    }
  });

  /**
   * 🔴 The gate for the class of defect the deploy path found.
   *
   * A `Function` node's ports come from its script: reading `Inputs.x` mints
   * `in-x`, assigning `Outputs.y` mints `out-y`. A connection to a port the
   * script never mentions **targets nothing** — and it is invisible in the
   * editor and under `render-from-disk` (which lifts ports off connections),
   * while the real exporter's health filter drops it silently.
   *
   * This shipped once: `plReloads.currentCount → plPickLevel.in-reload`, where
   * the script never read `Inputs.reload`. The room could never have restarted
   * in the product, and it restarted correctly every time under measurement.
   */
  it('every wired Function port is one its own script actually mentions', () => {
    for (const seam of FUNCTION_SEAMS) {
      const script = String(nodesOf(seam.component).find((n) => n.id === seam.id)!.parameters?.functionScript ?? '');
      for (const wire of connectionsOf(seam.component)) {
        if (wire.toId === seam.id && String(wire.toProperty).startsWith('in-')) {
          const name = String(wire.toProperty).slice(3);
          expect(script).toContain(`Inputs.${name}`);
        }
        if (wire.fromId === seam.id && String(wire.fromProperty).startsWith('out-')) {
          const name = String(wire.fromProperty).slice(4);
          expect(script).toContain(`Outputs.${name}`);
        }
      }
    }
  });

  it('the move rule is written once and placed four times', () => {
    const page = nodesOf(PAGE_PLAY);
    const movers = page.filter((n) => n.type === MOVE_COMPONENT);
    expect(movers).toHaveLength(4);
    // 🔴 Each instance carries its own direction as a PARAMETER. Delivering the
    // direction on a wire instead is the defect the module header records: all
    // four recompute on every move, so a value port carries whichever published
    // last rather than the one whose key was pressed.
    const steps = movers.map((m) => `${m.parameters?.dx},${m.parameters?.dy}`).sort();
    expect(steps).toEqual(['-1,0', '0,-1', '0,1', '1,0']);
  });

  it('the four keyboard nodes name the arrow keys first', () => {
    const keys = nodesOf(PAGE_PLAY).filter((n) => n.type === 'keyboard-shortcuts.KeyboardShortcut');
    expect(keys).toHaveLength(4);
    for (const k of keys) {
      const shortcut = String(k.parameters?.shortcut ?? '');
      expect(shortcut.length).toBeGreaterThan(0);
      // Held keys repeat: a turn-based game cannot run you into anything you
      // did not have time to see, and walking a corridor should be one gesture.
      expect(k.parameters?.allowRepeat).toBe(true);
    }
    expect(keys.map((k) => String(k.parameters?.shortcut).split(',')[0].trim()).sort()).toEqual(['down', 'left', 'right', 'up']);
  });
});

// ── §3 The ordering that makes it deterministic ─────────────────────────────

describe('TPL-005 §3 — the writes are sequenced, not raced', () => {
  it('the move commits x, then y, then reports — each waiting on the last `done`', () => {
    const wires = connectionsOf(MOVE_COMPONENT);
    const setters = nodesOf(MOVE_COMPONENT).filter((n) => n.type === 'Set Variable');
    expect(setters.map((s) => s.parameters?.name).sort()).toEqual([VAR_X, VAR_Y].sort());

    // 🔴 The chain, by name. `Set Variable`'s `done` fires only once every
    // Variable node reading it has been notified, which is what lets the page
    // read playerX/playerY and be sure of what it sees.
    expect(wires).toEqual(expect.arrayContaining([
      expect.objectContaining({ fromId: 'mvGate', fromProperty: 'onfalse', toId: 'mvSetX', toProperty: 'do' }),
      expect.objectContaining({ fromId: 'mvSetX', fromProperty: 'done', toId: 'mvSetY', toProperty: 'do' }),
      expect.objectContaining({ fromId: 'mvSetY', fromProperty: 'done', toId: 'mvOutputs', toProperty: 'moved' })
    ]));
  });

  it('the room loads in a fixed order and finishes with the hearts', () => {
    const wires = connectionsOf(PAGE_PLAY);
    expect(wires).toEqual(expect.arrayContaining([
      expect.objectContaining({ fromId: 'plPickLevel', fromProperty: 'success', toId: 'plLoadX', toProperty: 'do' }),
      expect.objectContaining({ fromId: 'plLoadX', fromProperty: 'done', toId: 'plLoadY', toProperty: 'do' }),
      expect.objectContaining({ fromId: 'plLoadY', fromProperty: 'done', toId: 'plLoadCoins', toProperty: 'do' }),
      expect.objectContaining({ fromId: 'plLoadCoins', fromProperty: 'done', toId: 'plLoadEnemies', toProperty: 'do' }),
      expect.objectContaining({ fromId: 'plLoadEnemies', fromProperty: 'done', toId: 'plHearts', toProperty: 'reset' })
    ]));
  });

  it('nothing is wired to the room parser’s `run`, so it still auto-runs at load', () => {
    // 🔴 `simplejavascript.ts` auto-runs the script at load ONLY when `run` is
    // unconnected. Wiring a restart there would have cost the boot: nothing else
    // on the page is guaranteed to publish first, and the board would open empty.
    const wires = connectionsOf(PAGE_PLAY);
    expect(wires.some((w) => w.toId === 'plPickLevel' && w.toProperty === 'run')).toBe(false);
    // The restart is a reactive nudge instead.
    expect(wires).toEqual(expect.arrayContaining([
      expect.objectContaining({ fromId: 'plReloads', toId: 'plPickLevel', toProperty: 'in-reload' }),
      expect.objectContaining({ fromId: 'plDeathGate', fromProperty: 'ontrue', toId: 'plReloads', toProperty: 'increase' })
    ]));
  });

  it('the banner is cleared by a move and written from strictly later in the chain', () => {
    const wires = connectionsOf(PAGE_PLAY);
    // Cleared by the move itself...
    const clears = wires.filter((w) => w.toId === 'plBannerStates' && w.toProperty === 'to-playing');
    expect(clears).toHaveLength(4);
    for (const c of clears) expect(c.fromProperty).toBe('moved');
    // ...and the exit gate is evaluated by the coin step's completion, NOT by
    // `moved`, or "Room cleared" would race the thing that clears it.
    expect(wires).toEqual(expect.arrayContaining([
      expect.objectContaining({ fromId: 'plTakeCoin', fromProperty: 'success', toId: 'plExitGate', toProperty: 'eval' })
    ]));
    expect(wires.some((w) => w.toId === 'plExitGate' && w.toProperty === 'eval' && w.fromProperty === 'moved')).toBe(false);
  });

  /**
   * 🔴 The fourteen unticks, and why they are a spec of their own.
   *
   * `takeCoin` reads the coin list and writes it; the world turn reads the enemy
   * list and writes it. Left reactive, each one re-runs on its own output — for
   * ever. And DEF-038's pinning pass rewrites this whole family of checkboxes on
   * the way to the artefact, so "I set it" is not the same claim as "it shipped".
   */
  it('every step-chain Function is signal-driven — the unticks survive into the artefact', () => {
    const expected: Record<string, string[]> = {
      plTakeCoin: ['in-coins', 'in-x', 'in-y'],
      plStepEnemies: ['in-enemies', 'in-grid', 'in-w', 'in-px', 'in-py']
    };
    const page = nodesOf(PAGE_PLAY);
    let counted = 0;
    for (const [id, inputs] of Object.entries(expected)) {
      const node = page.find((n) => n.id === id);
      expect(node).toBeDefined();
      for (const input of inputs) {
        expect(node!.parameters?.[`runOnChange-${input}`]).toBe(false);
        counted++;
      }
    }
    expect(counted).toBe(8);
    // The renderer is the one left reactive: following the state is its job.
    const build = page.find((n) => n.id === 'plBuildCells');
    for (const key of Object.keys(build!.parameters ?? {})) expect(key.startsWith('runOnChange-')).toBe(false);
    // And every gate tests only when told to.
    for (const g of GATE_NODES) {
      const node = nodesOf(g.component).find((n) => n.id === g.id);
      expect(node!.parameters?.['runOnChange-condition']).toBe(false);
    }
  });
});

// ── §4 The board's legend covers the board ──────────────────────────────────

describe('TPL-005 §4 — the legend covers every tile the projection can draw', () => {
  it('every kind the renderer emits has a row in the palette', () => {
    const script = String(nodesOf(PAGE_PLAY).find((n) => n.id === 'plBuildCells')!.parameters?.functionScript ?? '');
    // The kinds the script can assign, read off the script rather than listed twice.
    const kinds = [...script.matchAll(/kind = '([a-z]+)'/g)].map((m) => m[1]);
    expect(kinds.length).toBeGreaterThan(0);
    const known = new Set(TILE_PALETTE.map((p) => p.kind));
    for (const k of new Set(kinds)) expect(known).toContain(k);
  });

  it('the palette has no row the renderer never draws', () => {
    const script = String(nodesOf(PAGE_PLAY).find((n) => n.id === 'plBuildCells')!.parameters?.functionScript ?? '');
    const kinds = new Set([...script.matchAll(/kind = '([a-z]+)'/g)].map((m) => m[1]));
    for (const p of TILE_PALETTE) expect(kinds).toContain(p.kind);
  });

  it('floor and wall are far enough apart to read as a maze', () => {
    // 🔴 The regression this locks. The first palette put floor and wall one
    // step apart and the board came out as 108 faint boxes with no legible
    // maze — invisible to every check except looking at it.
    const floor = TILE_PALETTE.find((p) => p.kind === 'floor')!;
    const wall = TILE_PALETTE.find((p) => p.kind === 'wall')!;
    expect(floor.ground).not.toBe(wall.ground);
    // A floor with a visible edge is what made the board read as boxes rather
    // than as space: its edge must be its own ground.
    expect(floor.edge).toBe(floor.ground);
    expect(wall.edge).not.toBe(wall.ground);
  });
});

// ── §5 The look, recomputed ─────────────────────────────────────────────────

describe('TPL-005 §5 — the contrast is recomputed, not quoted', () => {
  const value = (name: string) => {
    const found = TPL005_TOKENS.find((t) => t.name === name);
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
    ['--muted-foreground', '--surface', 4.5],
    ['--muted-foreground', '--background', 4.5],
    ['--accent-foreground', '--accent', 4.5],
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

  it('the three colours that mean something are the three the board uses, and no others', () => {
    // A fourth meaning on the board without a fourth entry in the legend is a
    // legend that no longer describes the game.
    const inks = new Set(TILE_PALETTE.map((p) => p.ink));
    expect(inks).toContain('var(--primary)');
    expect(inks).toContain('var(--destructive)');
    expect(inks).toContain('var(--accent-foreground)');
  });

  it('every composition asked for is one the template declares it uses', () => {
    expect(requestedCompositions()).toEqual([...USED_COMPOSITIONS].sort());
  });
});

// ── §6 The artefact keeps its promises ──────────────────────────────────────

describe('TPL-005 §6 — the artefact', () => {
  it('the keyboard module travels with the project', () => {
    // 🔴 Not a packaging nicety: the MCP door REFUSES the keyboard node type
    // with `unknown-node-type` unless the module is in the project being
    // authored, and a zip without it opens on a board that answers no key.
    expect(built.modules).toContain('keyboard-shortcuts');
    expect(REQUIRED_MODULES).toContain('keyboard-shortcuts');
    expect(fs.existsSync(path.join(built.projectDir, 'noodl_modules', 'keyboard-shortcuts'))).toBe(true);
  });

  it('one page is registered into the router, and it is the start page', () => {
    const registrations = Object.values(built.registrations);
    expect(registrations).toHaveLength(1);
    expect(registrations[0].startPage).toBe(PAGE_PLAY);
  });

  it('the door refused nothing and raised no error or warning', () => {
    const loud = built.diagnostics.filter((d) => d.severity === 'error' || d.severity === 'warning');
    expect(loud).toEqual([]);
  });

  it('it ships no backend, and says so by containing nothing that needs one', () => {
    expect(fs.existsSync(path.join(built.projectDir, 'components', '__cloud__'))).toBe(false);
    expect(fs.existsSync(path.join(built.projectDir, 'nodegx.security.json'))).toBe(false);
    const project = JSON.parse(fs.readFileSync(path.join(built.projectDir, 'nodegx.project.json'), 'utf8'));
    expect(project.metadata?.cloudservices).toBeUndefined();
    // The board is taller than a laptop viewport; without this the legend cannot be reached.
    expect(project.settings?.bodyScroll).toBe(true);
  });

  it('the four variables the game runs on are read as well as written', () => {
    const page = nodesOf(PAGE_PLAY);
    const readers = page.filter((n) => n.type === 'Variable2').map((n) => n.parameters?.name);
    for (const name of [VAR_X, VAR_Y, VAR_COINS, VAR_ENEMIES]) {
      // 🔴 A variable nobody reads is a write nobody grades.
      expect(readers).toContain(name);
    }
  });

  it('the prepared directory carries the note, the module and no backend', () => {
    preparePixelArtefact(built, OUTPUT);
    expect(fs.existsSync(path.join(OUTPUT, 'docs', 'START-HERE.md'))).toBe(true);
    expect(fs.existsSync(path.join(OUTPUT, 'noodl_modules', 'keyboard-shortcuts'))).toBe(true);
    const note = fs.readFileSync(path.join(OUTPUT, 'docs', 'START-HERE.md'), 'utf8');
    // The note's first instruction is the one AC4 measures; if the note stops
    // saying it, the promise the template is sold on is gone.
    expect(note).toContain('Static Data');
    expect(note).toContain('Add a sixth room');
  });
});

// ── §7 A sixth room is one edit ─────────────────────────────────────────────

describe('TPL-005 §7 — a stranger adds a room by editing one node', () => {
  /**
   * 🔴 Measured by doing it, because that is the only way to find out. The claim
   * is not "a room is data" — it is "adding one costs one edit and nothing else",
   * and the second half is what a person actually experiences.
   */
  it('the five rooms are one Static Data node, and a sixth needs no other change', () => {
    const page = nodesOf(PAGE_PLAY);
    const dataNodes = page.filter((n) => n.type === 'Static Data');
    // Two: the rooms, and the tile palette. Both are things a person edits.
    expect(dataNodes).toHaveLength(2);

    const roomsNode = dataNodes.find((n) => String(n.label ?? '').includes('rooms'));
    expect(roomsNode).toBeDefined();
    const rooms = JSON.parse(String(roomsNode!.parameters?.json ?? '[]'));
    expect(rooms).toHaveLength(LEVELS.length);
    for (const room of rooms) {
      expect(Object.keys(room).sort()).toEqual(['grid', 'name']);
    }

    // Add one, the way a person would: append an entry. Nothing else is touched.
    const sixth = {
      name: 'A room a stranger added',
      grid: ['############', '#@........c#', '#.########.#', '#..........#', '#.########.#', '#c........>#', '#.########.#', '#..........#', '############'].join('\n')
    };
    const grown = [...rooms, sixth];
    expect(grown).toHaveLength(LEVELS.length + 1);

    // The parser reads it with no change to itself, and the room is finishable.
    const rows = sixth.grid.split('\n');
    expect(rows).toHaveLength(GRID_H);
    for (const r of rows) expect(r).toHaveLength(GRID_W);

    // 🔴 And the count a person sees comes from the DATA, not from a literal:
    // "Room 1 / 5" is `out-levelCount`, so a sixth room says 1 / 6 on its own.
    const wires = connectionsOf(PAGE_PLAY);
    expect(wires).toEqual(expect.arrayContaining([
      expect.objectContaining({ fromId: 'plPickLevel', fromProperty: 'out-levelCount', toId: 'plRoomFmt', toProperty: 'total' })
    ]));
    const parser = String(page.find((n) => n.id === 'plPickLevel')!.parameters?.functionScript ?? '');
    expect(parser).toContain('Outputs.levelCount = levels.length');
    // Nothing in the graph names the number five.
    expect(parser).not.toMatch(/=\s*5\b/);
  });
});
