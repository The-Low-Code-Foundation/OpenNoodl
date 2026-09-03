/**
 * REL-011a — the control-style census.
 *
 * Phase 82's row REL-011a: *"the fifty-three controls, and the three that were
 * styled."* The gate that says every interactive control in the site-builder
 * template carries the style parameters its own measured defaults leave missing.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## 🔴 Written to be RED at HEAD, and it was
 *
 * REL-011a AC1: *"The spec must be written so it FAILS at HEAD — 3 of 53 — and
 * the failure recorded before the fix, or it is a gate with a hole shaped like
 * the defect."* Run against the artefact as it stood at `c13068f2`, before a
 * single parameter was added, this file read:
 *
 * | type | in the template | meeting the contract |
 * |---|---|---|
 * | `textinput` | 25 | **0** |
 * | `button` | 26 | **1** (`/Site/CtaSection`'s call to action) |
 * | `checkbox` | 1 | **0** |
 * | `options` | 1 | **0** |
 * | **total** | **53** | **1** |
 *
 * ⚠️ **One, not the three the row was opened on.** REL-011 §2 counted *"carrying
 * any `var(--…)` parameter"*, which admits `/Pages/Admin`'s `New page` button on
 * a lone `marginLeft` — spacing, not treatment — and `/Admin/PresetChip`, which
 * sets a full chip treatment but no `fontSize`. Neither reading is wrong; they
 * are different questions. This file asks the one the bar asks.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## Why each required port is required, and why the obvious ones are not
 *
 * 🔴 **Every port below is required because a *measured* default fails the bar.**
 * The bar is Richard's, 2026-08-31: *"you can at least see the elements clearly
 * and interact"*. A port whose default already meets it is deliberately absent
 * from this contract — requiring it would move this census's number and no
 * pixel, which is REL-010 §6.5's refused move wearing a different hat.
 *
 * Two ports were dropped for exactly that reason, and they are the useful half:
 *
 * 1. 🔴 **`fontFamily` is NOT required, on any type.** `assets/style.css` gives
 *    `.ndl-controls-button` and `.ndl-controls-textinput` `font-family: inherit`
 *    — P78 D18's fix, measured across eleven pages. The controls already render
 *    in the project's face. Requiring the port would restate a value that is
 *    already correct.
 * 2. 🔴 **Label ports are NOT required.** A `<label>` is not a form control and
 *    inherits the page's size and colour; the labels are legible in the very
 *    photograph this row was opened on (*"Your name / Your email / Your
 *    message"* is readable — it is the field **beneath** it that is not there).
 *
 * And `fontSize` **is** required, from the same stylesheet's own comment:
 * *"`font-family` only, deliberately. Size and weight were not measured, and
 * adding `font-size: inherit` here would change the metrics."* So a control's
 * text is at the user agent's 13.33px while the `Text` beside it is at
 * `--text-base`.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## 🔴 Two of the four types already met the legibility half, and this file says so
 *
 * REL-011 §2 reads *"53 interactive controls and styles 3 of them"* and infers a
 * uniform defect. Measured on the **live** node definitions — `nodes/controls/`,
 * not the `nodes-deprecated/` twin that carries the same display names — that is
 * not the shape:
 *
 * | type | at its own defaults | verdict against the bar |
 * |---|---|---|
 * | `textinput` | `background-color: transparent`, `border-style: none` (stylesheet), border width 0 | 🔴 **invisible** — the row's defect |
 * | `button` | `background-color: black; color: white; padding: 5px 20px` (stylesheet), radius 0 | 🟡 legible; a raw pair outside the palette |
 * | `options` | `borderStyle: solid, borderWidth: 2, borderColor: #000000, borderRadius: 5` | 🟢 **draws already** |
 * | `checkbox` | `borderStyle: solid, borderWidth: 2, borderColor: #000000, borderRadius: 3`, 32×32 | 🟢 **draws already** |
 *
 * ✅ So the invisible-field finding is confirmed — three independent ways, the
 * node default, the stylesheet rule and the photograph — and it is **the text
 * inputs**, not the controls in general. The dropdown and the checkbox are asked
 * here only to join the palette, and this file does not pretend that is a
 * legibility fix.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## Which element each port reaches
 *
 * ⚠️ Nearly filed as a hazard, and it is the opposite. With `useLabel: true` —
 * which all 25 fields set — `TextInput` renders an outer `<div>` holding the
 * `<label>` and an inner `[noodl-style-tag="inputWrapper"]` holding the
 * `<input>`. A border on the outer div would box the label in with the field.
 * The product already routes around it: `addBorderInputs`, `addPaddingInputs`
 * and `backgroundColor` all carry `styleTag: 'inputWrapper'`, and the text style
 * carries `styleTag: 'input'`. **Every port this contract requires lands on the
 * element a person would expect.** Nothing here is inert.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## One population, and why that is honest here
 *
 * `sbr012RawColourGate.test.ts` scans the artefact **and** the component sets,
 * because a regex over source text can see both. This contract is per-node and
 * per-port, which the generated artefact expresses and a TypeScript data file
 * does not without parsing it. So this gate reads the artefact — *what a person
 * receives* — and leans on `sb007Template.test.ts`, which asserts that artefact
 * is byte-identical to a fresh generation from the source. If that byte-gate is
 * ever suspended, this file measures the shipped bytes, which is the half worth
 * keeping.
 *
 * @see siteBuilderStyleScan.ts — the instrument, shared with SBR-012.
 */
import { ARTEFACT_PATH, ParamRow, artefactParams, readArtefact, tokenUniverse } from './siteBuilderStyleScan';

/** Only the four control types the template actually places. */
const CONTROL_PREFIX = 'net.noodl.controls.';

/**
 * The ports each control type must set, and the measured default each one is
 * there to overrule. 🔴 The `why` is not decoration — it is the record that
 * stops a later session adding a port here because it looks tidy.
 */
export const CONTROL_STYLE_CONTRACT: Record<string, ReadonlyArray<{ port: string; why: string }>> = {
  textinput: [
    { port: 'backgroundColor', why: "node default 'transparent', and `.ndl-controls-textinput` sets it again" },
    { port: 'borderStyle', why: 'the wrapper has no border-style, so a width alone draws nothing' },
    { port: 'borderWidth', why: 'shared border default is 0 — this is what makes the field invisible' },
    { port: 'borderColor', why: 'otherwise the UA colour, which is not in the palette' },
    { port: 'borderRadius', why: 'node default 0; the template already chose --radius-md on its one styled control' },
    { port: 'color', why: "the <input>'s UA colour rather than --foreground" },
    { port: 'fontSize', why: 'the stylesheet inherits family but deliberately not size — the field is at UA 13.33px' },
    { port: 'paddingLeft', why: 'the wrapper has no padding, so text would sit against its new border' },
    { port: 'paddingRight', why: 'as paddingLeft' },
    { port: 'paddingTop', why: 'as paddingLeft' },
    { port: 'paddingBottom', why: 'as paddingLeft' }
  ],
  button: [
    { port: 'backgroundColor', why: "stylesheet `background-color: black` — a raw value outside the palette" },
    { port: 'color', why: 'stylesheet `color: white`, chosen against that black rather than against the palette' },
    { port: 'borderRadius', why: 'default 0 — the square corners beside the CTA pill are the two-idioms finding' },
    { port: 'fontSize', why: 'as textinput: family inherits, size does not' }
  ],
  // 🟢 Draws at its own defaults. Required here only to reach the palette, and
  // this file does not call that a legibility fix.
  options: [
    { port: 'backgroundColor', why: "node default 'transparent' over whatever ground it lands on" },
    { port: 'borderColor', why: 'node default #000000 — draws, but raw' },
    { port: 'borderRadius', why: 'node default 5px, which is not --radius-md' },
    { port: 'color', why: 'UA colour rather than --foreground' }
  ],
  checkbox: [
    { port: 'backgroundColor', why: "node default 'transparent' with applyDefault:false" },
    { port: 'borderColor', why: 'node default #000000 — draws, but raw' },
    { port: 'borderRadius', why: 'node default 3px, which is not --radius-md' }
  ]
};

const artefact = readArtefact();
const rows = artefactParams(artefact);
const universe = tokenUniverse();

/** One control instance, with every parameter it sets. */
interface Control {
  component: string;
  label: string;
  type: string;
  short: string;
  parameters: Map<string, unknown>;
}

function controls(): Control[] {
  const byNode = new Map<string, Control>();
  for (const row of rows) {
    if (!row.type.startsWith(CONTROL_PREFIX)) continue;
    const key = `${row.component} | ${row.label} | ${row.type}`;
    let control = byNode.get(key);
    if (!control) {
      control = {
        component: row.component,
        label: row.label,
        type: row.type,
        short: row.type.slice(CONTROL_PREFIX.length),
        parameters: new Map()
      };
      byNode.set(key, control);
    }
    control.parameters.set(row.port, row.value);
  }
  return [...byNode.values()];
}

const ALL = controls();
const name = (c: Control) => `${c.component} | ${c.label} (${c.short})`;

/** A port counts only if it is set AND its value is a token this project defines. */
function unmet(control: Control, contract = CONTROL_STYLE_CONTRACT): string[] {
  const required = contract[control.short] ?? [];
  const missing: string[] = [];
  for (const { port } of required) {
    const value = control.parameters.get(port);
    if (typeof value !== 'string') {
      missing.push(port);
      continue;
    }
    const token = /^var\(\s*(--[A-Za-z0-9_-]+)\s*\)$/.exec(value.trim());
    // `borderStyle` is an enum, not a colour or a measure — 'solid' is the value,
    // and there is no token that could carry it.
    if (port === 'borderStyle') {
      if (value.trim() !== 'solid') missing.push(port);
      continue;
    }
    if (!token || !universe.has(token[1])) missing.push(port);
  }
  return missing;
}

describe('REL-011a §1 — the census reads what the artefact actually holds', () => {
  it('the four control types, at the counts REL-011 §2 recorded', () => {
    const byType = new Map<string, number>();
    for (const c of ALL) byType.set(c.short, (byType.get(c.short) ?? 0) + 1);
    expect(Object.fromEntries([...byType].sort())).toEqual({
      button: 26,
      checkbox: 1,
      options: 1,
      textinput: 25
    });
    expect(ALL.length).toBe(53);
  });

  it('every control type placed has a contract — a new type cannot arrive ungraded', () => {
    // 🔴 Without this, adding a `net.noodl.controls.radiobutton` to the template
    // would pass §2 silently: `unmet()` returns [] for a type with no entry.
    const placed = new Set(ALL.map((c) => c.short));
    const covered = new Set(Object.keys(CONTROL_STYLE_CONTRACT));
    expect([...placed].filter((t) => !covered.has(t))).toEqual([]);
  });
});

describe('REL-011a §2 — AC1: every control carries the style its type needs', () => {
  it('all 53 meet the contract', () => {
    const failures = ALL.map((c) => ({ control: name(c), missing: unmet(c) }))
      .filter((f) => f.missing.length > 0)
      .sort((a, b) => a.control.localeCompare(b.control));

    // The failure message is the census: which control, and which ports.
    const report = failures.map((f) => `  ${f.control} — missing ${f.missing.join(', ')}`).join('\n');
    expect(
      `${ALL.length - failures.length} of ${ALL.length} controls meet the contract\n${report}`
    ).toBe(`${ALL.length} of ${ALL.length} controls meet the contract\n`);
  });

  it('no control sets a required port to a token this project does not define', () => {
    // 🔴 A `var(--radius-lg)` that resolves nowhere is a declaration the browser
    // drops — it would read as styled here and render as the default.
    const broken: string[] = [];
    for (const c of ALL) {
      for (const { port } of CONTROL_STYLE_CONTRACT[c.short] ?? []) {
        const value = c.parameters.get(port);
        if (typeof value !== 'string') continue;
        const token = /^var\(\s*(--[A-Za-z0-9_-]+)\s*\)$/.exec(value.trim());
        if (token && !universe.has(token[1])) broken.push(`${name(c)} | ${port} = ${value}`);
      }
    }
    expect(broken).toEqual([]);
  });
});

describe('REL-011a §3 — the gate disagrees with a broken template', () => {
  /**
   * 🔴 A census that reads "all 53" and a census that is broken produce the same
   * green. Every arm above is paired with a planted defect that must red.
   * The plants mutate a **local copy**; nothing here writes to the artefact.
   */
  const plant = (c: Control): Control => ({ ...c, parameters: new Map(c.parameters) });

  it('a control that sets nothing is reported, with its ports named', () => {
    const field = ALL.find((c) => c.short === 'textinput');
    expect(field).toBeDefined();
    const stripped = plant(field!);
    for (const { port } of CONTROL_STYLE_CONTRACT.textinput) stripped.parameters.delete(port);
    expect(unmet(stripped).sort()).toEqual(CONTROL_STYLE_CONTRACT.textinput.map((r) => r.port).sort());
  });

  it('a raw hex reads as unmet, not as styled', () => {
    // The defect this row exists to fix is a control with no tokens. The defect
    // a *later* session is likelier to introduce is one with a hex — SBR-012
    // catches that too, and so does this: a value is met only if it is a token.
    const button = ALL.find((c) => c.short === 'button');
    expect(button).toBeDefined();
    const hexed = plant(button!);
    hexed.parameters.set('backgroundColor', '#1d4ed8');
    expect(unmet(hexed)).toContain('backgroundColor');
  });

  it('a token that resolves nowhere reads as unmet', () => {
    const button = ALL.find((c) => c.short === 'button');
    const bogus = plant(button!);
    bogus.parameters.set('color', 'var(--colour-that-does-not-exist)');
    expect(unmet(bogus)).toContain('color');
  });

  it('a borderStyle of none reads as unmet — a width with no style draws nothing', () => {
    const field = plant(ALL.find((c) => c.short === 'textinput')!);
    field.parameters.set('borderStyle', 'none');
    expect(unmet(field)).toContain('borderStyle');
  });

  it('the contract itself is not empty for any type', () => {
    // A contract silently emptied would turn every arm above green.
    for (const [type, ports] of Object.entries(CONTROL_STYLE_CONTRACT)) {
      expect(ports.length).toBeGreaterThan(0);
      expect(new Set(ports.map((p) => p.port)).size).toBe(ports.length);
      for (const { why } of ports) expect(why.length).toBeGreaterThan(10);
    }
  });
});

describe('REL-011a §4 — the gate runs, on the bytes that ship', () => {
  it('this file is discovered by the package jest config, which CI runs', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config = require('../jest.config.js') as { testMatch: string[] };
    expect(config.testMatch).toContain('<rootDir>/tests/**/*.test.ts');
    expect(__filename.endsWith('.test.ts')).toBe(true);
  });

  it('the artefact read here is the one the template ships', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path') as typeof import('path');
    expect(fs.existsSync(ARTEFACT_PATH)).toBe(true);
    const template = fs.readFileSync(path.join(path.dirname(ARTEFACT_PATH), 'site-builder.template.ts'), 'utf8');
    expect(template).toContain(`./${path.basename(ARTEFACT_PATH)}`);
  });

  it('the rows this gate reads come from the artefact walker SBR-012 uses', () => {
    // A private walker that missed a nesting level would under-count silently.
    const fromShared: ParamRow[] = rows.filter((r) => r.type.startsWith(CONTROL_PREFIX));
    expect(fromShared.length).toBeGreaterThan(0);
    expect(new Set(fromShared.map((r) => r.type)).size).toBe(4);
  });
});
