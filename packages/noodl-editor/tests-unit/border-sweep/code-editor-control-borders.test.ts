import * as fs from 'fs';
import * as path from 'path';

import { ThemeName, tokenContrast } from '../support/themeTokens';

/**
 * The code-editor family's slice of the `--theme-color-border-default` sweep opened in phase 75
 * (`BORDER-CONTROL-SWEEP.md`). Sibling of `bench-control-borders.test.ts` and
 * `node-picker-control-borders.test.ts`, and the FIRST slice in `noodl-core-ui` rather than
 * `noodl-editor` — which is the thing session 62 wanted tested: the ground is still readable out
 * of a sibling stylesheet, it is just a different sibling per control rather than one shared rail.
 *
 * 🔴 `border-default` IS A DIVIDER TONE AND IS SUPPOSED TO BE INVISIBLE (`colors.css`, NAT-003).
 * The defect is never the token; it is the subset of declarations that are CONTROL boundaries
 * wearing it. The negative controls at the bottom hold that line.
 *
 * 🔴 THREE FINDINGS THIS FAMILY ADDED, each with a row that reddens at a number:
 *
 * 1. `border-control` IS NOT THE ANSWER EVERYWHERE. POL-016 scopes its guarantee to "bg-1, bg-2
 *    and bg-3"; `JavaScriptEditor .CloseButton` is filled `bg-4`, where the token measures
 *    2.64:1 dark / 2.77:1 light — UNDER 3:1. Swapping it in there would have looked exactly like
 *    the rest of the sweep and shipped a control that still fails 1.4.11. It uses
 *    `fg-default-shy`, which its own `:hover` had been using all along.
 *
 * 2. THE INVENTORY IS WRONG IN BOTH DIRECTIONS HERE, not just short. It lists `.SaveButton`,
 *    which was never part of the defect — it overrides `border-color` to `primary` — and it does
 *    NOT list `.FormatButton`, which shares the declaration and really did wear the divider. A
 *    FIFTH proof that the count is a floor, and the first proof it also contains false positives.
 *
 * 3. THE UP/DOWN RULE SESSION 62 FILED HAS A THIRD CASE. `.CancelButton:hover` fills DOWN the
 *    ramp (bg-2 -> bg-3) yet lands at 3.08 / 3.05, so deletion would have PASSED. `primary` is
 *    used anyway, because a rule that exists to emphasise on hover must not go QUIETER under the
 *    pointer. "Which fix" is not settled by the direction alone — it is direction, then the
 *    number, then what the rule is for.
 *
 * 🔴 THIS SPEC READS THE STYLESHEETS, NOT THE PALETTE. Asserting `border-control` clears 3:1
 * would pass on a build where this family never names it. Every row resolves the selector's own
 * border, its own fill and its ground out of the `.scss` files, so a revert fails at a NUMBER.
 */

const UI = path.resolve(__dirname, '../../../noodl-core-ui/src/components/code-editor');

const FILES = {
  button: `${UI}/CodeHistory/CodeHistoryButton.module.scss`,
  dropdown: `${UI}/CodeHistory/CodeHistoryDropdown.module.scss`,
  diffModal: `${UI}/CodeHistory/CodeHistoryDiffModal.module.scss`,
  jsEditor: `${UI}/JavaScriptEditor.module.scss`
} as const;

type FileKey = keyof typeof FILES;

/** ⚠️ Comments are stripped FIRST — the prose this sweep added names the very tokens the parser
 *  below looks for, and a regex that read a comment would report the wrong tone. */
const source = (file: FileKey) => fs.readFileSync(FILES[file], 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Every top-level rule in a file, as `{ selectors, body }`. A real scanner rather than a regex,
 * because this family broke the regex one twice over: `.FormatButton, .SaveButton` share a
 * comma-separated selector, and `.SaveButton` ALSO has its own later rule that overrides part of
 * it. An anchored `^\.SaveButton\s*\{` matches the shared rule's second line and silently
 * reports the WRONG body — which is how a first draft of this spec "confirmed" `.SaveButton`'s
 * edge was `primary` while actually reading a nested `:hover` inside the shared rule. It fitted;
 * it excluded nothing.
 */
function topLevelRules(file: FileKey): { selectors: string[]; body: string }[] {
  const text = source(file);
  const out: { selectors: string[]; body: string }[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const open = text.indexOf('{', cursor);
    if (open === -1) break;
    let depth = 0;
    let close = -1;
    for (let i = open; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}' && --depth === 0) {
        close = i;
        break;
      }
    }
    if (close === -1) throw new Error(`unbalanced braces in ${file}`);
    const selectors = text
      .slice(cursor, open)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    out.push({ selectors, body: text.slice(open + 1, close) });
    cursor = close + 1;
  }
  return out;
}

/**
 * Every top-level rule body that applies to `selector`, in document order.
 *
 * 🔴 More than one rule can apply, and the LAST one wins — that is the whole of the `.SaveButton`
 * finding. Returning a list instead of a body is what lets the rows below measure what a reader
 * actually sees rather than what the first matching declaration says.
 */
function rules(file: FileKey, selector: string): string[] {
  const found = topLevelRules(file)
    .filter((r) => r.selectors.includes(selector))
    .map((r) => r.body);
  if (!found.length) throw new Error(`no such rule in ${file}: ${selector}`);
  return found;
}

/** The single rule body for a selector, for the cases that genuinely have one. */
function rule(file: FileKey, selector: string): string {
  const found = rules(file, selector);
  if (found.length !== 1) throw new Error(`${file} ${selector} has ${found.length} rules — use rules()`);
  return found[0];
}

/**
 * Every nested `&<suffix> { ... }` block in a rule body — `:hover`, `:active`, `:disabled`,
 * `:hover:not(:disabled)`, `:focus-visible`.
 *
 * 🔴 The sweep's finding is that the unit of work is a RULE, not a declaration: a resting edge
 * raised to a control tone while a `:hover` quietly keeps a divider is a REGRESSION, not a fix.
 * Discovering the states from disk means a state added later is measured without anyone
 * remembering to add a row for it. This family nests with `&`, where the bench used top-level
 * rules — so this walks the body rather than the file.
 */
function nestedStates(body: string): { selector: string; body: string }[] {
  const found: { selector: string; body: string }[] = [];
  const pattern = /(?:^|\n)\s*&([^{,\n]*?)\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body))) {
    const start = body.indexOf('{', match.index);
    let depth = 0;
    for (let i = start; i < body.length; i++) {
      if (body[i] === '{') depth++;
      else if (body[i] === '}' && --depth === 0) {
        found.push({ selector: `&${match[1].trim()}`, body: body.slice(start + 1, i) });
        break;
      }
    }
  }
  return found;
}

/**
 * A rule's OWN declarations, with every nested block removed.
 *
 * 🔴 THIS FUNCTION IS THE SESSION'S FINDING, and the ten-mutant battery is what produced it. A
 * first draft read `border-color` out of the whole rule body — which in SCSS includes the nested
 * `&:hover` — so `.CancelButton`'s resting edge resolved to its HOVER's `primary` and the resting
 * rows could not see the resting declaration at all. Every row was green and FOUR mutants
 * survived: reverting three of the five controls to `border-default` changed nothing the spec
 * looked at. The tell was mutant 4, which touched only a `:hover` and reddened the RESTING rows —
 * a kill attributed to the wrong row is a broken reader, not a strong spec.
 */
function own(body: string): string {
  let out = '';
  let depth = 0;
  for (const ch of body) {
    if (ch === '{') {
      depth++;
      continue;
    }
    if (ch === '}') {
      depth--;
      continue;
    }
    if (depth === 0) out += ch;
  }
  return out;
}

/** The token a declaration names, e.g. `border: 1px solid var(--x)` -> `--x`. */
function tokenOf(body: string, property: string): string | null {
  const match = own(body).match(new RegExp(`(?:^|[;{\\s])${property}:[^;]*?var\\((--[a-z0-9-]+)\\)`, 'm'));
  return match ? match[1] : null;
}

function declares(body: string, property: string): boolean {
  return new RegExp(`(?:^|[;{\\s])${property}:`, 'm').test(own(body));
}

/** ⚠️ These files mix `background:` and `background-color:` — the CodeHistory three use the
 *  shorthand, `JavaScriptEditor` uses the longhand. Reading only one would have silently made
 *  three controls look transparent and measured them against the wrong surface. */
const fillOf = (body: string) => tokenOf(body, 'background-color') ?? tokenOf(body, 'background');
const paintsFill = (body: string) => declares(body, 'background-color') || declares(body, 'background');

/** 🔴 Last rule wins. Every read below goes through these, never through a single body. */
const lastOf = <T,>(bodies: string[], read: (b: string) => T | null): T | null => {
  for (let i = bodies.length - 1; i >= 0; i--) {
    const value = read(bodies[i]);
    if (value !== null && value !== undefined) return value;
  }
  return null;
};

/** Nested states across every rule that applies, merged by suffix, later rules winning. */
function mergedStates(bodies: string[]): { selector: string; bodies: string[] }[] {
  const order: string[] = [];
  const bySuffix = new Map<string, string[]>();
  for (const body of bodies) {
    for (const state of nestedStates(body)) {
      if (!bySuffix.has(state.selector)) {
        bySuffix.set(state.selector, []);
        order.push(state.selector);
      }
      bySuffix.get(state.selector)!.push(state.body);
    }
  }
  return order.map((selector) => ({ selector, bodies: bySuffix.get(selector)! }));
}

/**
 * The five CONTROLS in this family, each with the sibling rule that paints the surface it is seen
 * against. Confirmed against the TSX: all five are `<button>`s, and `JavaScriptEditor.tsx` renders
 * `CodeHistoryButton`, `.FormatButton`, `.SaveButton` and `.CloseButton` into the SAME toolbar.
 *
 * ⚠️ DELIBERATELY ABSENT, and asserted as still-dividers at the bottom of this file: `.Modal`,
 * `.Dropdown` and `JavaScriptEditor .Root` (region/surface edges), the four hairlines that
 * separate toolbar from editor from footer, and `CodeHistoryDropdown .Item:hover` — a `<div>` row
 * whose border is EMPHASIS, not a control boundary; the control inside it is `.PreviewButton`.
 * The sweep doc warns that membership here is a judgement rather than a grep, and this is where
 * that judgement is written down.
 */
const CONTROLS: {
  name: string;
  file: FileKey;
  selector: string;
  ground: { file: FileKey; selector: string };
}[] = [
  {
    name: 'CodeHistoryButton .Button (fill EQUALS its ground — the border is all there is)',
    file: 'button',
    selector: '.Button',
    ground: { file: 'jsEditor', selector: '.Toolbar' }
  },
  {
    name: 'CodeHistoryDropdown .PreviewButton',
    file: 'dropdown',
    selector: '.PreviewButton',
    ground: { file: 'button', selector: '.Dropdown' }
  },
  {
    name: 'CodeHistoryDiffModal .CancelButton',
    file: 'diffModal',
    selector: '.CancelButton',
    ground: { file: 'diffModal', selector: '.Modal' }
  },
  {
    name: 'JavaScriptEditor .FormatButton (the site the inventory did NOT list)',
    file: 'jsEditor',
    selector: '.FormatButton',
    ground: { file: 'jsEditor', selector: '.Toolbar' }
  },
  {
    name: 'JavaScriptEditor .CloseButton (on bg-4, where border-control itself FAILS)',
    file: 'jsEditor',
    selector: '.CloseButton',
    ground: { file: 'jsEditor', selector: '.Toolbar' }
  }
];

describe.each(['dark', 'light'] as ThemeName[])('the code-editor family in %s', (theme) => {
  describe.each(CONTROLS)('$name', ({ file, selector, ground }) => {
    const bodies = () => rules(file, selector);

    const groundToken = () => {
      const token = lastOf(rules(ground.file, ground.selector), fillOf);
      if (!token) throw new Error(`${ground.file} ${ground.selector} no longer paints a background`);
      return token;
    };

    /** ⚠️ A later `border-color` overrides an earlier `border` shorthand, which is exactly what
     *  `.SaveButton` does to the declaration it shares with `.FormatButton`. */
    const border = () => {
      const token = lastOf(bodies(), (b) => tokenOf(b, 'border-color') ?? tokenOf(b, 'border'));
      if (!token) throw new Error(`${file} ${selector}: no border naming a token`);
      return token;
    };

    /** A control that paints no fill is seen against its ground on BOTH sides of the edge. */
    const fill = () => lastOf(bodies(), fillOf) ?? groundToken();

    it('its resting boundary clears 3:1 against its own fill', () => {
      const ratio = tokenContrast(theme, border(), fill());
      const verdict =
        ratio >= 3
          ? 'passes'
          : `${file} ${selector}'s border is ${ratio.toFixed(2)}:1 on its own fill in ${theme} — under ` +
            `1.4.11's 3:1, so the control has no perceivable edge`;
      expect(verdict).toBe('passes');
    });

    it('its resting boundary clears 3:1 against the surface behind it', () => {
      // 🔴 The edge has TWO sides. A border that cleared its own fill and vanished into the panel
      // behind it would still leave the control without an outline.
      const ratio = tokenContrast(theme, border(), groundToken());
      const verdict =
        ratio >= 3
          ? 'passes'
          : `${file} ${selector}'s border is ${ratio.toFixed(2)}:1 on ${ground.selector} in ${theme}`;
      expect(verdict).toBe('passes');
    });

    it('🔴 no state of it moves the edge below 3:1 on EITHER side', () => {
      // The row a find-and-replace over the sweep's inventory would not have. `border-highlight`
      // is an ALIAS of `border-strong` — not a stronger control tone but one of NAT-003's three
      // DIVIDER tones — and both `.Button:hover` and `.CancelButton:hover` used to move the edge
      // to it. Restoring either reddens this row at a number (1.28:1 on the hover fill).
      const restBorder = border();
      const failures: string[] = [];

      for (const state of mergedStates(bodies())) {
        if (!state.bodies.some((b) => declares(b, 'border-color') || paintsFill(b))) continue;
        const stateBorder = lastOf(state.bodies, (b) => tokenOf(b, 'border-color')) ?? restBorder;
        const stateFill = lastOf(state.bodies, fillOf) ?? fill();

        const onFill = tokenContrast(theme, stateBorder, stateFill);
        const onGround = tokenContrast(theme, stateBorder, groundToken());
        // ⚠️ A solid `primary` fill identifies the control by its FILL, so a matching `primary`
        // edge is 1:1 against it by design and is not the boundary. `.PreviewButton:hover` is
        // that shape. The claim is then about the fill against the ground, which is asserted.
        if (stateBorder === stateFill) {
          const fillStep = tokenContrast(theme, stateFill, groundToken());
          if (fillStep < 3) {
            failures.push(
              `${selector}${state.selector} paints its edge the same tone as its fill, and that ` +
                `fill is only ${fillStep.toFixed(2)}:1 on ${ground.selector} — nothing identifies it`
            );
          }
          continue;
        }
        if (onFill < 3) failures.push(`${selector}${state.selector} is ${onFill.toFixed(2)}:1 on its own fill`);
        if (onGround < 3) {
          failures.push(`${selector}${state.selector} is ${onGround.toFixed(2)}:1 on ${ground.selector}`);
        }
      }

      expect(failures).toEqual([]);
    });
  });

  it('🔴 border-control CANNOT be used on .CloseButton, and this is why', () => {
    // Finding 1. POL-016 scopes `border-control` to bg-1/2/3 and this control is filled bg-4.
    // Anyone "tidying" `.CloseButton` to match its four neighbours reddens the fill row above;
    // this row is here so the failure arrives with its reason attached rather than as a puzzle.
    // ⚠️ Deliberately a TRIPWIRE, not a permanent truth: if `border-control` is ever re-placed so
    // it clears bg-4, this row goes red on an IMPROVEMENT — and the right response is then to
    // reconsider the token here, which is exactly the conversation the red should start.
    const fillToken = lastOf(rules('jsEditor', '.CloseButton'), fillOf);
    const ratio = tokenContrast(theme, '--theme-color-border-control', fillToken!);
    const verdict =
      ratio < 3
        ? 'border-control still fails on this fill'
        : `border-control now measures ${ratio.toFixed(2)}:1 on ${fillToken} in ${theme} — re-read the ` +
          `.CloseButton comment, the reason it uses fg-default-shy may have expired`;
    expect(verdict).toBe('border-control still fails on this fill');
  });

  it('🔴 .SaveButton was a FALSE POSITIVE — the shared edit never reached it', () => {
    // Finding 2, and the row that made the parser above necessary. `.SaveButton` participates in
    // the declaration this sweep edited AND overrides it afterwards, so the sweep changed the
    // string it is written with and not the colour a reader sees.
    const shared = topLevelRules('jsEditor').find(
      (r) => r.selectors.includes('.FormatButton') && r.selectors.includes('.SaveButton')
    );
    expect(shared && tokenOf(shared.body, 'border')).toBe('--theme-color-border-control');

    // ...and the override that makes it moot is still there. If a later change drops this,
    // `.SaveButton` silently inherits the shared tone and this row says so.
    const own = topLevelRules('jsEditor').filter(
      (r) => r.selectors.length === 1 && r.selectors[0] === '.SaveButton'
    );
    expect(own.length).toBe(1);
    expect(tokenOf(own[0].body, 'border-color')).toBe('--theme-color-primary');

    // It is identified by its FILL against the toolbar, not by an edge — so it was never the
    // kind of control this sweep is about.
    const toolbar = lastOf(rules('jsEditor', '.Toolbar'), fillOf)!;
    const effectiveFill = lastOf(rules('jsEditor', '.SaveButton'), fillOf)!;
    expect(effectiveFill).toBe('--theme-color-primary');
    const fillStep = tokenContrast(theme, effectiveFill, toolbar);
    expect(fillStep >= 3 ? 'passes' : `.SaveButton's fill is ${fillStep.toFixed(2)}:1 on the toolbar`).toBe('passes');
  });

  it('🔴 the divider tone is still INVISIBLE on the surfaces this family uses', () => {
    // The negative control, and the row that refuses the over-fix. `border-default` is doing its
    // job when it CANNOT be seen; a sweep that raised the shared token instead of the call sites
    // would pass every row above and redden this one.
    //
    // ⚠️ The bound is a property of the GROUND, not of the token — session 61 and 62 both filed
    // this. `colors.css` places the divider at 1.254 against bg-1 BY DESIGN, so a bg-1 surface
    // needs 1.4 where a bg-2 surface needs 1.2. Copying one file's bound to the other reads the
    // correct value as a defect.
    const grounds: { rule: () => string; bound: number; what: string }[] = [
      { rule: () => rule('diffModal', '.Modal'), bound: 1.4, what: 'the diff modal (bg-1)' },
      { rule: () => rule('button', '.Dropdown'), bound: 1.4, what: 'the history dropdown (bg-1)' },
      { rule: () => rule('jsEditor', '.Toolbar'), bound: 1.2, what: "the editor's toolbar (bg-2)" }
    ];

    const failures = grounds
      .map(({ rule: r, bound, what }) => {
        const ratio = tokenContrast(theme, '--theme-color-border-default', fillOf(r())!);
        return ratio < bound ? null : `border-default is ${ratio.toFixed(2)}:1 on ${what} in ${theme}, over ${bound}`;
      })
      .filter(Boolean);

    expect(failures).toEqual([]);
  });

  it('🔴 the REGION edges were deliberately left alone', () => {
    // The third mutant's target, in the bench's numbering: a blanket find-and-replace over this
    // family would raise these too, and each is a boundary between two REGIONS rather than
    // something a reader must identify as operable. `.Item` is the interesting one — it is a
    // `<div>`, and the control inside it is `.PreviewButton`.
    const regions: [FileKey, string, string][] = [
      ['diffModal', '.Modal', 'border'],
      ['button', '.Dropdown', 'border'],
      ['jsEditor', '.Root', 'border'],
      ['jsEditor', '.Toolbar', 'border-bottom'],
      ['jsEditor', '.Footer', 'border-top'],
      ['jsEditor', '.PortHint', 'border-bottom'],
      ['dropdown', '.Header', 'border-bottom'],
      ['diffModal', '.Header', 'border-bottom'],
      ['diffModal', '.Summary', 'border-top']
    ];

    for (const [file, selector, property] of regions) {
      expect(`${file} ${selector}: ${tokenOf(rule(file, selector), property)}`).toBe(
        `${file} ${selector}: --theme-color-border-default`
      );
    }

    // A row emphasis on a non-interactive row, not a control boundary.
    expect(tokenOf(nestedStates(rule('dropdown', '.Item'))[0].body, 'border-color')).toBe(
      '--theme-color-border-default'
    );
  });
});
