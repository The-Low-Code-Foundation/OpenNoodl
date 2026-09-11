/**
 * DEF-001 — the contrast floor for the tokens a *built app* renders.
 *
 * ## What this reads, and why it is not `nat-001/palette-contrast.spec.ts`
 *
 * 🔴 **Two contrast gates now exist in this package and they read different files.** Say which is
 * which here, or the next reader deletes one as a duplicate — the mistake this repo has already
 * made once (`a check in a second pipeline is a duplicate first`).
 *
 *  - `nat-001/palette-contrast.spec.ts` grades **the editor's own chrome**: `--theme-color-*`
 *    resolved out of `colors.css`. Its subject is the person *building* an app.
 *  - **This file** grades **the design tokens a built app ships to its visitors**:
 *    `DefaultTokens.ts` and the five `StylePresets`. Its subject is a person who never chose
 *    NodeGX and is looking at somebody's deployed page.
 *
 * They share no token, no file and no population. A green run in either says nothing about the
 * other.
 *
 * ## The pairs are DERIVED, not listed
 *
 * 🔴 A hand-written pair list is an exclusion list that cannot fail. The pairs here are read out
 * of the two places the product actually renders colour from:
 *
 *  1. `ElementConfigRegistry` — every element config, every variant, every interaction state.
 *     This is what a Button/TextInput/Checkbox/Text is stamped with on creation.
 *  2. `STYLE_COMPOSITIONS` — the recipe parameters an agent is told to copy.
 *
 * That derivation is what caught the rows DEF-001's own write-up missed: the task named the
 * TextInput border, and the same walk found `Checkbox`'s.
 *
 * ## What it cannot see — stated, because an unstated limit reads as coverage
 *
 * It grades colour pairs that are **written down in a config or a composition**. A graph where an
 * author types a raw hex, or wires `backgroundColor` at runtime, is invisible to it. It does not
 * render anything: `--shadow-*`, gradients, and any colour decided at paint time are out of scope,
 * and `scripts/devtools/icon-contrast.js` remains the authority on those.
 *
 * ## Registration
 *
 * None needed. `jest.config.js` matches `tests-unit/ ** /?(*.)+(spec|test).ts` by path.
 *
 * @module noodl-editor/tests-unit/def-001/design-token-contrast
 */
import { ElementConfigRegistry } from '@noodl-models/ElementConfigs/ElementConfigRegistry';
import { ElementConfig, ResolvedVariant, VariantConfig } from '@noodl-models/ElementConfigs/ElementConfigTypes';
import { STYLE_COMPOSITIONS } from '@noodl-models/StyleTokensModel/StyleCompositions';
import { buildDefaultTokenMap } from '@noodl-models/StyleTokensModel/DefaultTokens';
import {
  EnterprisePreset,
  MinimalPreset,
  ModernPreset,
  PlayfulPreset,
  SoftPreset
} from '@noodl-models/StylePresets/presets';
import { StylePreset } from '@noodl-models/StylePresets/StylePresetTypes';

import { contrastRatio, parseColor, Rgb } from '../support/themeTokens';

// ---------------------------------------------------------------------------
// Palettes — the ground, and the four presets layered on it
// ---------------------------------------------------------------------------

/** `--background` is what a colour sits on when an element declares no background of its own. */
const PAGE_BACKGROUND_TOKEN = '--background';

type Palette = { id: string; tokens: Record<string, string> };

function defaultTokenValues(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, record] of buildDefaultTokenMap()) out[name] = record.value;
  return out;
}

/**
 * A preset is *overrides on the defaults*, which is how `StylePresetsModel` applies them — so a
 * preset that names no `--primary` (Modern ships `tokens: {}`) is graded on the default value.
 * 🔴 That layering is the whole reason Modern's failure was misread as Modern's: it is the
 * ground's.
 */
function palettes(): Palette[] {
  const base = defaultTokenValues();
  const presets: StylePreset[] = [ModernPreset, MinimalPreset, PlayfulPreset, EnterprisePreset, SoftPreset];
  return [
    { id: 'defaults', tokens: base },
    ...presets.map((p) => ({ id: p.id, tokens: { ...base, ...p.tokens } }))
  ];
}

// ---------------------------------------------------------------------------
// Deriving the pairs
// ---------------------------------------------------------------------------

/**
 * Which node types are *controls* — a thing a person is asked to operate. WCAG 1.4.11 puts a 3:1
 * floor on the boundary of one of these and on nothing else, so a card's hairline is correctly
 * exempt and a text field's edge is correctly not.
 *
 * 🔴 The classification is asserted **total** below. An exclusion list that cannot fail is how a
 * new control ships ungraded.
 */
const CONTROL_NODE_TYPES = new Set([
  'net.noodl.controls.button',
  'net.noodl.controls.textinput',
  'net.noodl.controls.checkbox'
]);

/** Node types that are known, deliberately not controls, and why. */
const NON_CONTROL_NODE_TYPES: Record<string, string> = {
  Text: 'typography — carries no border or background port in this runtime',
  Group: 'a box; its border is decoration, and 1.4.11 does not reach decoration',
  Image: 'media; no text and no operable boundary',
  Columns: 'layout; no text and no operable boundary'
};

type Pair = {
  /** Where it came from, e.g. `button/primary` or `composition:outlineButton`. */
  source: string;
  nodeType: string;
  kind: 'text' | 'controlBorder';
  /** Token name or literal for the ink. */
  fg: string;
  /** Token name or literal for what the ink sits on. */
  bg: string;
  /** WCAG floor: 4.5 for text, 3 for a control boundary. */
  min: number;
  why: string;
};

/**
 * What a colour sits on. A declared `backgroundColor` answers it outright.
 *
 * 🔴 **When nothing is declared, there is more than one honest answer, and grading only the
 * lightest one is a hole shaped like the defect.** `transparent` means "whatever is behind me",
 * and that is `--background` at the top of a page but `--surface` inside every card, panel and
 * form — which is where form text actually lives. Grading only `--background` is optimistic
 * exactly where a real app is darker.
 *
 * Measured, on the case that produced this change: DEF-006 §6.4 proposed sourcing the `fieldError`
 * composition from `--destructive`. On `--background` that reads 4.66–6.47:1 and passes in all six
 * palettes; on `--surface` it reads 4.38:1 under Playful and 4.49:1 under Soft and **fails**. The
 * single-ground version of this function would have passed the proposal and shipped an error
 * message two presets render below AA.
 *
 * Both grounds are graded, so a colour has to clear its floor on either surface it may land on.
 * ⚠️ This is still not "every ground": a composition nested on `--surface-raised`, or on a fill an
 * author sets at runtime, is outside it — `--surface` is the darkest ground the vocabulary itself
 * ships, not the darkest one that can exist.
 */
const IMPLICIT_GROUND_TOKENS = [PAGE_BACKGROUND_TOKEN, '--surface'];

function groundsOf(style: Record<string, string>): string[] {
  const declared = style.backgroundColor;
  if (!declared || declared === 'transparent') return IMPLICIT_GROUND_TOKENS.map((t) => `var(${t})`);
  return [declared];
}

function hasBorder(style: Record<string, string>): boolean {
  if (!style.borderColor) return false;
  const width = style.borderWidth;
  if (width === undefined) return true;
  if (width === '0' || width === '0px' || width === 'none') return false;
  return style.borderStyle !== 'none';
}

function pairsFromStyle(source: string, nodeType: string, style: Record<string, string>): Pair[] {
  const out: Pair[] = [];
  const grounds = groundsOf(style);

  for (const bg of grounds) {
    if (style.color) {
      out.push({
        source,
        nodeType,
        kind: 'text',
        fg: style.color,
        bg,
        min: 4.5,
        why: 'WCAG 1.4.3 — body text against its own background'
      });
    }

    if (hasBorder(style) && CONTROL_NODE_TYPES.has(nodeType)) {
      out.push({
        source,
        nodeType,
        kind: 'controlBorder',
        fg: style.borderColor,
        bg,
        min: 3,
        why: 'WCAG 1.4.11 — the boundary of an operable control'
      });
    }
  }

  return out;
}

/**
 * `disabled` is the one state WCAG exempts (1.4.3 and 1.4.11 both carve out inactive controls),
 * and every `disabled` block here is an `opacity` change rather than a colour, so grading it would
 * measure the un-dimmed colour and call it the truth. Named rather than filtered silently.
 */
const UNGRADED_STATES = new Set(['disabled']);

/**
 * The same split `ElementConfigRegistry.resolveVariant` performs — base properties on one side,
 * interaction states on the other — done on a config object rather than through the singleton, so
 * the walk works on a mutated copy. The registry's own version is exercised by the totality
 * assertion below, which reads the live registry.
 */
function resolveVariantOf(variant: VariantConfig): ResolvedVariant {
  const baseStyles: Record<string, string> = {};
  for (const [key, value] of Object.entries(variant)) {
    if (key === 'states') continue;
    if (typeof value === 'string') baseStyles[key] = value;
  }
  return { baseStyles, states: variant.states ?? {} };
}

/**
 * The two sources, taken as arguments rather than read from the singleton, so a mutation arm can
 * hand in a deliberately-broken copy. Production callers pass the live registry.
 */
type Sources = { configs: ElementConfig[]; compositions: typeof STYLE_COMPOSITIONS };

function liveSources(): Sources {
  return { configs: ElementConfigRegistry.getAll(), compositions: STYLE_COMPOSITIONS };
}

function derivePairs(sources: Sources = liveSources()): Pair[] {
  const out: Pair[] = [];

  for (const config of sources.configs) {
    const { nodeType } = config;
    const defaults = { ...config.defaults };
    delete defaults._variant;

    for (const [variant, variantConfig] of Object.entries(config.variants)) {
      const resolved = resolveVariantOf(variantConfig);
      const base = { ...defaults, ...resolved.baseStyles };
      out.push(...pairsFromStyle(`${nodeType}/${variant}`, nodeType, base));

      for (const [state, styles] of Object.entries(resolved.states)) {
        if (!styles || UNGRADED_STATES.has(state)) continue;
        out.push(...pairsFromStyle(`${nodeType}/${variant}:${state}`, nodeType, { ...base, ...styles }));
      }
    }
  }

  for (const composition of sources.compositions) {
    const style: Record<string, string> = {};
    for (const [key, value] of Object.entries(composition.parameters ?? {})) {
      if (typeof value === 'string') style[key] = value;
      // A `{ value, unit }` dimension is not a colour and not a border switch; but a
      // `borderWidth: { value: 0 }` DOES turn the border off, and reading it as "absent" would
      // grade a border that is not drawn.
      else if (value && typeof value === 'object' && 'value' in (value as any)) {
        style[key] = String((value as any).value) + (((value as any).unit as string) ?? '');
      }
    }
    out.push(...pairsFromStyle(`composition:${composition.id}`, composition.nodeType, style));
  }

  return out;
}

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

const VAR_RE = /^var\(\s*(--[a-z0-9-]+)\s*\)$/i;

/** Resolve one colour expression against a palette. Returns null when it is not a flat colour. */
function resolveColour(palette: Record<string, string>, expression: string): Rgb | null {
  const match = VAR_RE.exec(expression.trim());
  const literal = match ? palette[match[1]] : expression;
  if (literal === undefined) return null;
  return parseColor(literal);
}

type Reading = Pair & { palette: string; ratio: number | null; fgValue?: string; bgValue?: string };

function grade(pairs: Pair[], patch: Record<string, Record<string, string>> = {}): Reading[] {
  const out: Reading[] = [];
  for (const palette of palettes().map((p) => ({ ...p, tokens: { ...p.tokens, ...(patch[p.id] ?? {}) } }))) {
    for (const pair of pairs) {
      const fg = resolveColour(palette.tokens, pair.fg);
      const bg = resolveColour(palette.tokens, pair.bg);
      out.push({
        ...pair,
        palette: palette.id,
        ratio: fg && bg ? contrastRatio(fg, bg) : null,
        fgValue: fg ? undefined : pair.fg,
        bgValue: bg ? undefined : pair.bg
      });
    }
  }
  return out;
}

function describeReading(r: Reading): string {
  return `[${r.palette}] ${r.source} — ${r.fg} on ${r.bg} = ${r.ratio?.toFixed(2)} (needs ${r.min}) — ${r.why}`;
}

const PAIRS = derivePairs();
const READINGS = grade(PAIRS);

function failures(readings: Reading[]): Reading[] {
  return readings.filter((r) => r.ratio !== null && r.ratio < r.min);
}

function describeReadings(readings: Reading[]): string {
  return readings.map(describeReading).join('\n');
}

/** Deep-enough copy for a mutation arm: the walk only ever reads strings out of these. */
function copyConfigs(): ElementConfig[] {
  return JSON.parse(JSON.stringify(ElementConfigRegistry.getAll())) as ElementConfig[];
}

describe('DEF-001 — the tokens a built app renders clear their WCAG floor', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // The instrument is honest about its own population before it grades anything
  // ─────────────────────────────────────────────────────────────────────────

  it('classifies every node type it meets — the control list is total, not an exclusion list', () => {
    const seen = new Set<string>(PAIRS.map((p) => p.nodeType));
    // Compositions can name a node type no element config registers, and vice versa; both are
    // real sources, so both feed this set.
    const unclassified = [...seen].filter(
      (t) => !CONTROL_NODE_TYPES.has(t) && !(t in NON_CONTROL_NODE_TYPES)
    );
    expect({ unclassified, seen: [...seen].sort() }).toEqual({ unclassified: [], seen: [...seen].sort() });

    // 🔴 And the reverse: a control named in the list that no source produces would be a rule
    // guarding nothing. Every entry must be reachable.
    const unreachableControls = [...CONTROL_NODE_TYPES].filter((t) => !seen.has(t));
    expect(unreachableControls).toEqual([]);
  });

  it('derives pairs from both sources, not from one', () => {
    const fromConfigs = PAIRS.filter((p) => !p.source.startsWith('composition:'));
    const fromCompositions = PAIRS.filter((p) => p.source.startsWith('composition:'));
    expect(fromConfigs.length).toBeGreaterThan(0);
    expect(fromCompositions.length).toBeGreaterThan(0);

    // Both kinds of floor are actually in play. A run that derived only text pairs would be green
    // while every control border failed.
    expect(PAIRS.some((p) => p.kind === 'text')).toBe(true);
    expect(PAIRS.some((p) => p.kind === 'controlBorder')).toBe(true);
  });

  it('grades every palette the product ships, including the defaults themselves', () => {
    expect(palettes().map((p) => p.id)).toEqual(['defaults', 'modern', 'minimal', 'playful', 'enterprise', 'soft']);

    // 🔴 `ModernPreset` ships `tokens: {}`, so `modern` and `defaults` MUST read identically. If
    // they ever diverge, one of them has been silently patched and the other has not.
    const byPalette = (id: string) => grade(PAIRS).filter((r) => r.palette === id).map((r) => r.ratio);
    expect(byPalette('modern')).toEqual(byPalette('defaults'));
  });

  it('resolves every colour it grades — an unresolvable token would read as a silent pass', () => {
    const unresolved = READINGS.filter((r) => r.ratio === null);
    expect(unresolved.map((r) => `${r.palette} ${r.source} ${r.fgValue ?? ''} ${r.bgValue ?? ''}`)).toEqual([]);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // The floor
  // ─────────────────────────────────────────────────────────────────────────

  it('every derived pair clears its floor in every shipped palette', () => {
    const bad = failures(READINGS);
    expect(describeReadings(bad)).toBe('');
  });

  it("the defaults' primary button clears 4.5:1 — the row a visitor pays for", () => {
    const rows = READINGS.filter(
      (r) => r.palette === 'defaults' && r.fg === 'var(--primary-foreground)' && r.bg === 'var(--primary)'
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('the TextInput and Checkbox borders clear 3:1 in every palette', () => {
    const rows = READINGS.filter((r) => r.kind === 'controlBorder');
    expect(rows.length).toBeGreaterThan(0);
    expect(describeReadings(rows.filter((r) => r.ratio! < 3))).toBe('');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Mutation arms — 🔴 a ratchet green on both arms has measured nothing
  // ─────────────────────────────────────────────────────────────────────────

  describe('is red on a planted regression', () => {
    it('(a) in the defaults — the ground every project inherits', () => {
      // blue-300: the shade `--primary` would drift back to.
      const mutated = grade(PAIRS, { defaults: { '--primary': '#93c5fd' } });
      const bad = failures(mutated);
      expect(bad.length).toBeGreaterThan(0);
      expect(bad.every((r) => r.palette === 'defaults')).toBe(true);
      expect(bad.some((r) => r.fg === 'var(--primary-foreground)' && r.bg === 'var(--primary)')).toBe(true);

      // 🔴 The control: the same plant applied to nothing leaves the run green. Without this the
      // arm proves the grader is noisy, not that it is pointed at `--primary`.
      expect(failures(grade(PAIRS, {}))).toEqual([]);
    });

    it('(b) in one preset only — a preset override is graded on its own values', () => {
      // Put `enterprise` back on the shade the defaults just left.
      const mutated = grade(PAIRS, { enterprise: { '--primary': '#3b82f6' } });
      const bad = failures(mutated);
      expect(bad.length).toBeGreaterThan(0);
      expect([...new Set(bad.map((r) => r.palette))]).toEqual(['enterprise']);
    });

    it('(c) in the TextInput variant — the element config, not the palette', () => {
      const configs = copyConfigs();
      const textinput = configs.find((c) => c.nodeType === 'net.noodl.controls.textinput');
      expect(textinput).toBeDefined();
      // Exactly the value DEF-001 found shipped: the decorative hairline on an operable control.
      textinput!.variants.default.borderColor = 'var(--border)';

      const bad = failures(grade(derivePairs({ configs, compositions: STYLE_COMPOSITIONS })));
      expect(bad.length).toBeGreaterThan(0);
      expect(bad.every((r) => r.kind === 'controlBorder')).toBe(true);
      expect(bad.every((r) => r.source.startsWith('net.noodl.controls.textinput/default'))).toBe(true);

      // The control pair: the unmutated copy of the same walk is green. 🔴 Without it this arm
      // would pass on a `derivePairs` that failed for any reason at all.
      expect(failures(grade(derivePairs({ configs: copyConfigs(), compositions: STYLE_COMPOSITIONS })))).toEqual([]);
    });

    it('(d) in a composition — the recipes an agent is told to copy are graded too', () => {
      const compositions = JSON.parse(JSON.stringify(STYLE_COMPOSITIONS)) as typeof STYLE_COMPOSITIONS;
      const outline = compositions.find((c) => c.id === 'outlineButton');
      expect(outline).toBeDefined();
      (outline!.parameters as Record<string, unknown>).borderColor = 'var(--border)';

      const bad = failures(grade(derivePairs({ configs: ElementConfigRegistry.getAll(), compositions })));
      expect(bad.map((r) => r.source)).toContain('composition:outlineButton');
    });

    it('(e) only on --surface — the ground a form field actually sits on', () => {
      // 🔴 This arm exists because the single-ground version of `groundsOf` passed the real
      // proposal that produced it. DEF-006 §6.4 proposed sourcing `fieldError` from
      // `--destructive`; on `--background` that clears 4.5:1 in all six palettes, and on the
      // `--surface` of the form card it is 4.38:1 under Playful and 4.49:1 under Soft.
      //
      // So the planted regression here is one that is INVISIBLE on the page background and only
      // appears on the surface — which is precisely the class of defect a `--background`-only
      // walk cannot see. Without this arm, narrowing `groundsOf` back to one ground leaves every
      // other test in this file green.
      const compositions = JSON.parse(JSON.stringify(STYLE_COMPOSITIONS)) as typeof STYLE_COMPOSITIONS;
      const fieldError = compositions.find((c) => c.id === 'fieldError');
      expect(fieldError).toBeDefined();
      (fieldError!.parameters as Record<string, unknown>).color = 'var(--destructive)';

      const readings = grade(derivePairs({ configs: ElementConfigRegistry.getAll(), compositions }));
      const bad = failures(readings).filter((r) => r.source === 'composition:fieldError');

      // It fails, and only against --surface, and only in the two presets that move --destructive
      // to a rose light enough to matter.
      expect(bad.length).toBeGreaterThan(0);
      expect(bad.every((r) => r.bg === 'var(--surface)')).toBe(true);
      expect([...new Set(bad.map((r) => r.palette))].sort()).toEqual(['playful', 'soft']);

      // 🔴 The control, and the half that makes this arm about the GROUND rather than about
      // --destructive being a bad colour: the same planted value against --background is clean in
      // every palette. A walk that graded only the page background would have reported nothing.
      const onBackground = failures(readings).filter(
        (r) => r.source === 'composition:fieldError' && r.bg === `var(${PAGE_BACKGROUND_TOKEN})`
      );
      expect(onBackground).toEqual([]);

      // And the unmutated composition — what actually ships — is clean on both grounds.
      const shipped = failures(grade(derivePairs({ configs: ElementConfigRegistry.getAll(), compositions: STYLE_COMPOSITIONS })));
      expect(shipped.filter((r) => r.source === 'composition:fieldError')).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // What the run covered — printed so a shrinking population is visible
  // ─────────────────────────────────────────────────────────────────────────

  it('reports its coverage', () => {
    const sources = [...new Set(PAIRS.map((p) => p.source))].sort();
    // eslint-disable-next-line no-console
    console.log(
      `DEF-001 graded ${PAIRS.length} derived pairs × ${palettes().length} palettes = ` +
        `${READINGS.length} readings across ${sources.length} sources; ` +
        `${PAIRS.filter((p) => p.kind === 'controlBorder').length} of the pairs are control borders.`
    );
    // A floor, not a pin: a pin breaks on every legitimate addition and gets loosened until it
    // means nothing. This catches the population *collapsing* — the failure mode where a walk
    // silently stops finding anything and the suite goes green.
    expect(PAIRS.length).toBeGreaterThanOrEqual(50);
    expect(sources.length).toBeGreaterThanOrEqual(28);
  });
});
