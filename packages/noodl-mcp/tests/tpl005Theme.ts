/**
 * TPL-005 — the look of the pixel game, and nothing else.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## The palette, and why it is the first dark row on the shelf
 *
 * The shelf is green (members' area), blue (site builder) and rust (landing
 * pages) — three business apps, three light grounds. A game is the first row
 * that is not a business app, and a dark ground is the honest way to say so
 * before a person has read a word.
 *
 * 🔴 **None of the five shipped presets is dark** (`minimal`, `modern`,
 * `enterprise`, `soft`, `playful`), so this template does what
 * `tpl003Theme.ts` did and more of it: start from **`minimal`** — the one
 * `tpl001Theme.ts` measured as passing WCAG AA on its own primary button
 * (17.72, where three of the five fail) — and override the grounds to ink.
 *
 * ⚠️ **A dark override is where contrast quietly dies**, because every ratio a
 * preset was measured at is now measured against a different ground. So all
 * sixteen pairs this template actually draws were computed, not eyeballed, and
 * `tpl005Template.test.ts` recomputes them from these very tokens — a palette
 * edit that breaks one reddens the gate rather than shipping.
 *
 * | pair | ratio | floor |
 * |---|---|---|
 * | `--primary-foreground` on `--primary` | **11.24** | 4.5 |
 * | `--primary` as text on `--background` | **11.32** | 4.5 |
 * | `--primary` as text on `--surface` | **10.30** | 4.5 |
 * | `--primary` as text on `--surface-raised` | **9.18** | 4.5 |
 * | `--foreground` on `--background` | **16.05** | 4.5 |
 * | `--foreground` on `--surface` | **14.61** | 4.5 |
 * | `--foreground` on `--surface-raised` | **13.02** | 4.5 |
 * | `--muted-foreground` on `--surface` | **6.90** | 4.5 |
 * | `--muted-foreground` on `--background` | **7.58** | 4.5 |
 * | `--accent-foreground` on `--accent` | **8.23** | 4.5 |
 * | `--secondary-foreground` on `--secondary` | **10.75** | 4.5 |
 * | `--border-control` on `--background` | **4.50** | 3.0 |
 * | `--border-control` on `--surface` | **4.10** | 3.0 |
 * | `--destructive` as text on `--background` | **6.86** | 4.5 |
 * | `--destructive` as text on `--surface` | **6.24** | 4.5 |
 * | `--destructive-foreground` on `--destructive` | **7.17** | 4.5 |
 *
 * ## The three colours that mean something
 *
 * A game's palette is not decoration — it is the legend. Three of these tokens
 * are load-bearing and the board reads wrong if they are swapped:
 *
 * - **`--primary` (mint)** is *yours and good*: the sprite, the score, the coin.
 * - **`--destructive` (coral)** is *costly*: an enemy, and the hearts it takes.
 * - **`--accent-foreground` (violet)** is *the way out*: the exit tile.
 *
 * 🔴 **Nothing else on the board is allowed to be mint or coral**, which is why
 * the walls and the floor are tokens away from both (`--surface-raised` and
 * `--surface`). A wall the colour of an enemy is a board a person misreads at
 * speed, and speed is the whole point.
 *
 * ⚠️ **The shadow tokens are left as the preset wrote them and nothing uses
 * them.** On an ink ground a shadow is invisible; the board's depth is a border
 * and a ground, both of which this palette can show. `tpl003Theme.ts` recorded
 * the same trap from the other side — a hover written as a shadow in a template
 * whose shadows are `none` is a rule that appears to work and does nothing.
 *
 * @module noodl-mcp/tests/tpl005Theme
 */
import { buildStyleVocabulary, getPreset } from '../src/editor-deps';

/** The shipped preset this template starts from — the one measured as passing. */
export const TPL005_PRESET = 'minimal';

/**
 * The three colours that are the board's legend, spelled once.
 *
 * 🔴 Exported because `tpl005Components.ts` sets them on the `Cell` and the HUD
 * **through these names**, and `tpl005Template.test.ts` asserts the board draws
 * exactly these three roles. A fourth meaning added to the board without a
 * fourth entry here is a legend that no longer describes the game.
 */
export const LEGEND = {
  /** Yours, and good: the sprite, the score, a coin. */
  good: 'var(--primary)',
  /** Costly: an enemy, and a heart it has taken. */
  costly: 'var(--destructive)',
  /** The way out. */
  exit: 'var(--accent-foreground)',
  /** A wall — the one thing you cannot walk through. */
  wall: 'var(--surface-raised)',
  /** Floor you have not been told anything about. */
  floor: 'var(--surface)'
} as const;

/**
 * The board's legend, as the table a person edits.
 *
 * 🔴 **This is data rather than a `States` node, and that was forced.** The
 * first `Game/Cell` held a `States` node with six states and three colour
 * values, which is the more node-native shape and reads beautifully in the
 * property panel — and it **does not work**: a value wired into a States node's
 * `currentState` never changes its state, so all 108 tiles drew the first
 * state's colours. Measured in a browser, with the control beside it: `to-<state>`
 * **signals** into a States node work (the banner is driven by four of them and
 * changes correctly). Registered as D43.
 *
 * ⚠️ So the legend stayed in the graph, it just stopped being ports: one
 * `Static Data` node a person opens and edits, read by the projection. That also
 * made it cheaper — the States shape was three dynamic-port nodes per tile,
 * which is 324 of them for one board.
 */
export const TILE_PALETTE: ReadonlyArray<{ kind: string; ground: string; edge: string; ink: string }> = [
  // 🔴 **Floor is a HOLE, not a tile.** The first palette gave the floor a
  // ground one step off the wall's and an edge one step off its own ground, and
  // the screenshot settled it: 108 faint boxes and **no legible maze**. A player
  // who cannot see the room cannot play, and it was invisible in every check
  // except looking. So the floor is now the page's own ground with **no edge at
  // all** — it recedes, and what is left standing is the wall.
  { kind: 'floor', ground: 'var(--background)', edge: 'var(--background)', ink: 'var(--muted-foreground)' },
  // Wall — solid and clearly lighter than the floor: #0e1020 against #2b3057 is
  // a step you cannot miss at a glance, which is the speed a game is read at.
  { kind: 'wall', ground: 'var(--secondary)', edge: 'var(--border-strong)', ink: 'var(--secondary)' },
  // A coin — mint, on the floor, so it reads as a thing lying ON the floor.
  { kind: 'coin', ground: 'var(--background)', edge: 'var(--background)', ink: LEGEND.good },
  // An enemy — coral, and its edge too, so it is legible at the corner of an eye.
  { kind: 'enemy', ground: 'var(--background)', edge: LEGEND.costly, ink: LEGEND.costly },
  // The way out — a ground of its own, because it is the only tile you are
  // looking for.
  { kind: 'exit', ground: 'var(--accent)', edge: LEGEND.exit, ink: LEGEND.exit },
  // You.
  { kind: 'player', ground: 'var(--background)', edge: LEGEND.good, ink: LEGEND.good }
];

/** Token overrides on top of the preset. Every ratio is in the header, and the gate recomputes them. */
export const TPL005_TOKENS: ReadonlyArray<{ name: string; value: string }> = [
  // Grounds — ink, not grey. A game on #111 reads as a developer tool.
  { name: '--background', value: '#0e1020' },
  { name: '--foreground', value: '#e8ecff' },
  { name: '--surface', value: '#171a2e' },
  { name: '--surface-raised', value: '#1f2340' },
  { name: '--muted', value: '#171a2e' },
  { name: '--muted-foreground', value: '#9aa3c7' },
  // Primary — mint. Yours, and good.
  { name: '--primary', value: '#4ee1a0' },
  { name: '--primary-hover', value: '#3cc98b' },
  { name: '--primary-foreground', value: '#06150e' },
  { name: '--ring', value: '#4ee1a0' },
  // Destructive — coral. Costly.
  { name: '--destructive', value: '#ff6b7a' },
  { name: '--destructive-foreground', value: '#1a0407' },
  // Secondary — for anything that is not the one action.
  { name: '--secondary', value: '#2b3057' },
  { name: '--secondary-hover', value: '#353b69' },
  { name: '--secondary-foreground', value: '#e8ecff' },
  // Accent — violet. The way out, and the level badge.
  { name: '--accent', value: '#2a2150' },
  { name: '--accent-foreground', value: '#c9b8ff' },
  // Borders — a hairline on ink has to be lighter than the ground, not darker.
  { name: '--border', value: '#262b4a' },
  { name: '--border-subtle', value: '#1d2138' },
  { name: '--border-strong', value: '#3a4170' },
  { name: '--border-control', value: '#6f79ad' },
  // Radius — a tile is square-ish. Rounder than this and the grid stops reading
  // as a grid; square and it reads as a table.
  { name: '--radius-sm', value: '4px' },
  { name: '--radius-md', value: '6px' },
  { name: '--radius-lg', value: '10px' },
  { name: '--radius-xl', value: '14px' },
  { name: '--radius-2xl', value: '18px' },
  { name: '--radius-3xl', value: '22px' },
  // Type — Inter ships in every project as `noodl_modules/inter`. The HUD's
  // numbers are set `tabular-nums` at the node, for the reason D30 measured:
  // Inter's proportional figures make a score column rag as it counts up.
  { name: '--font-sans', value: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif' },
  // 🔴 The board's own face. A tile glyph has to be monospaced or the columns
  // drift by a fraction of a character and a 12-wide grid ends up 11.6 wide.
  { name: '--font-mono', value: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' }
];

// ── The product's own compositions, looked up by id ──────────────────────────

export const VOCABULARY = buildStyleVocabulary({ getMetaData: () => undefined });

const requested = new Set<string>();

/** Every composition id this template actually asked for — recorded, not listed. */
export function requestedCompositions(): string[] {
  return [...requested].sort();
}

/**
 * One composition's parameters, by id. Throws on an unknown id naming the ones
 * that exist, so a renamed composition reddens the generator instead of styling
 * nothing.
 *
 * ⚠️ Its own `requested` set, for the reason `tpl003Theme.ts` gives: sharing one
 * would add this template's requests to another's census whenever both fixtures
 * load in the same process, and that gate would go red about a template it does
 * not grade.
 */
export function composition(id: string): Record<string, unknown> {
  requested.add(id);
  const found = (VOCABULARY.compositions as Array<{ id: string; parameters: Record<string, unknown> }>).find(
    (c) => c.id === id
  );
  if (!found) {
    const known = (VOCABULARY.compositions as Array<{ id: string }>).map((c) => c.id).join(', ');
    throw new Error(`No style composition "${id}". The vocabulary has: ${known}`);
  }
  return { ...found.parameters };
}

/**
 * Every composition id the template uses — asserted against
 * `requestedCompositions()`, so a rename, a dropped use, or a new one nobody
 * wrote down all redden.
 *
 * ⚠️ **This list was written as a wishlist and the gate caught it.** It named
 * eighteen compositions — `card`, `primaryButton`, `emptyState`, `shell` and the
 * rest — of which the template asks for **eight**. The other ten were the shape
 * a *page* template has, copied over from the landing pages before this one had
 * been built; a game has no buttons, no cards and no shell. Declaring a
 * composition nobody uses is the same lie as using one nobody declared: it
 * claims the template is built out of parts it never touches.
 */
export const USED_COMPOSITIONS = [
  'body',
  'cardTitle',
  'displayHeadline',
  'eyebrow',
  'lead',
  'meta',
  'sectionHeading',
  'statTile'
] as const;

/** The preset's overrides plus this template's, in the order the door is given them. */
export function tpl005TokenEntries(): Array<{ name: string; value: string }> {
  const preset = getPreset(TPL005_PRESET);
  if (!preset) throw new Error(`No style preset "${TPL005_PRESET}"`);
  return [...Object.entries(preset.tokens).map(([name, value]) => ({ name, value })), ...TPL005_TOKENS];
}
