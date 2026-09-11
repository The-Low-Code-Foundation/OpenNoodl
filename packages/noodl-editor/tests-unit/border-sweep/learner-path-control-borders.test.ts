import * as fs from 'fs';
import * as path from 'path';

import { ThemeName, tokenContrast } from '../support/themeTokens';

/**
 * `LearnerPathSection` — the intake questions and the path they produce, and the slice of the
 * phase-75 border sweep (`BORDER-CONTROL-SWEEP.md`) that closes the launcher's learning tab.
 * Sibling of `launcher-button-control-borders.test.ts` (session 65), whose helpers this copies.
 *
 * THREE CONTROLS, and the third is the interesting one:
 *
 *   `.Option`   a `<button aria-pressed>` — `bg-2` fill, was 1.07:1 dark / 1.15:1 light on it
 *   `.Ghost`    a `<button>` with NO fill — was 1.46 / 1.12 on one ground and 1.26 / 1.27 on
 *               the other, and the edge is the only thing that exists
 *   `.Primary`  edge and fill are the SAME tone, 1.00:1 between them — and it is CORRECT
 *
 * 🔴 FOUR FINDINGS THIS FAMILY ADDED, each with a row that reddens at a number:
 *
 * 1. A CONTROL CAN HAVE TWO GROUNDS WITH ONLY ONE CALL SITE. Session 65 found that a shared
 *    button must clear on the worst of the surfaces it is placed on, and said to COUNT THE CALL
 *    SITES of anything in `components/`. Counted here, `LearnerPathSection` has exactly one —
 *    and that count is the wrong instrument, because `.Ghost` is placed TWICE INSIDE THIS ONE
 *    COMPONENT: once in the head row, on the launcher's `bg-0` content area, and once inside a
 *    `.Step`, which paints `bg-1`. The second ground is invisible to a call-site count and is
 *    found only by reading the component's own JSX. ✅ Count PLACEMENTS, not call sites.
 *
 * 2. A CONTROL WHOSE EDGE IS ITS FILL IS GRADED BY ITS FILL STEP, NOT EXCUSED BY JUDGEMENT.
 *    `.Primary` measures 1.00:1 between border and fill, which is the shape session 63 hit at
 *    `.SaveButton` and disposed of as a false positive. Rather than list it as "deliberately
 *    left alone" and stop, this spec grades it: `primary` on the `bg-0` ground is 6.53 / 4.03,
 *    so the object is identified many times over. The row goes red if that fill ever moves —
 *    an assertion an exclusion list cannot make.
 *
 * 3. `own()` IS LOAD-BEARING HERE, AND IT WAS MEASURED HERE. Session 65 filed that a guard
 *    inherited from a sibling family is untested until its mutant is run in the new one, having
 *    found `own()` INERT in its own. Run here it kills: `.Option` nests
 *    `&[data-chosen='yes'] { border-color: var(--theme-color-primary) }`, so a reader without
 *    `own()` resolves the RESTING edge to `primary` — which clears 3:1 on every surface, so the
 *    `.Option` revert passes. The instruction cuts both ways, which is the point of checking.
 *
 * 4. THE OTHER HALF OF THE STATE READER DRAWS NOTHING IN THIS FAMILY, and this file says so
 *    rather than reporting it as a strength — session 65's lesson applied to session 65's own
 *    helper. Every state here is a NESTED `&` block; the top-level mechanism finds none.
 *
 * 🔴 THIS SPEC READS THE STYLESHEETS, NOT THE PALETTE. Asserting that a tone clears 3:1 would
 * pass on a build where this family never names it. Every row resolves the selector's own border,
 * its own fill and its grounds out of the `.scss` files, so a revert fails at a NUMBER.
 */

const CORE = path.resolve(__dirname, '../../../noodl-core-ui/src');
const LAUNCHER = `${CORE}/preview/launcher/Launcher`;

const FILES = {
  learnerPath: `${LAUNCHER}/components/LearnerPathSection/LearnerPathSection.module.scss`,
  launcherShell: `${LAUNCHER}/Launcher.module.scss`
} as const;

type FileKey = keyof typeof FILES;

/** ⚠️ Comments are stripped FIRST — the prose this sweep added names the very tokens the parser
 *  below looks for, and this session's edit put `border-default`, `border-control` AND `primary`
 *  into comments directly above the rules that name them. Without this the parser reads the
 *  explanation of the fix instead of the fix. */
const source = (file: FileKey) => fs.readFileSync(FILES[file], 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Every top-level rule in a file, as `{ selectors, body }`. A real scanner rather than a regex —
 *  see the code-editor spec's note on why an anchored `^\.X\s*\{` reads the wrong body. */
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

/** Every top-level rule body that applies to `selector`, in document order. More than one rule can
 *  apply and the LAST one wins. */
function rules(file: FileKey, selector: string): string[] {
  const found = topLevelRules(file)
    .filter((r) => r.selectors.includes(selector))
    .map((r) => r.body);
  if (!found.length) throw new Error(`no such rule in ${file}: ${selector}`);
  return found;
}

function rule(file: FileKey, selector: string): string {
  const found = rules(file, selector);
  if (found.length !== 1) throw new Error(`${file} ${selector} has ${found.length} rules — use rules()`);
  return found[0];
}

/**
 * A rule's OWN declarations, with every nested block removed.
 *
 * 🔴 FINDING 3, AND IT WAS REPRODUCED IN THIS FAMILY RATHER THAN INHERITED FROM THE SIBLING.
 * Session 65 broke this function in its own file and killed NOTHING — no nested state there
 * declared `border-color` — and filed that a guard carried over is untested until its mutant is
 * run again. Run here it kills: `.Option` nests `&[data-chosen='yes']` with a `border-color`, and
 * `tokenOf` tries `border-color` before `border`, so a reader without this resolves the resting
 * edge of an UNCHOSEN option to `primary`. Every contrast row then passes with the revert applied,
 * because `primary` clears 3:1 on all four steps this family touches.
 *
 * ⚠️ It matters for the GROUND too, and for the same reason session 64 gave: `.ContentArea` nests
 * `&::-webkit-scrollbar-track { background: var(--theme-color-bg-1) }`, so a reader without this
 * measures every control in this file against a scrollbar.
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

/** Every nested `&<suffix> { ... }` block in a rule body. */
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

/** The token a declaration names, e.g. `border: 1px solid var(--x)` -> `--x`. */
function tokenOf(body: string, property: string): string | null {
  const match = own(body).match(new RegExp(`(?:^|[;{\\s])${property}:[^;]*?var\\((--[a-z0-9-]+)\\)`, 'm'));
  return match ? match[1] : null;
}

function declares(body: string, property: string): boolean {
  return new RegExp(`(?:^|[;{\\s])${property}:`, 'm').test(own(body));
}

/** ⚠️ Both spellings: this family writes `background:` throughout while the sibling files use
 *  `background-color:`. Reading only one would make a ground look unpainted and silently measure
 *  the control against the wrong surface. */
const fillOf = (body: string) => tokenOf(body, 'background-color') ?? tokenOf(body, 'background');
const paintsFill = (body: string) => declares(body, 'background-color') || declares(body, 'background');

const lastOf = <T,>(bodies: string[], read: (b: string) => T | null): T | null => {
  for (let i = bodies.length - 1; i >= 0; i--) {
    const value = read(bodies[i]);
    if (value !== null && value !== undefined) return value;
  }
  return null;
};

/**
 * Every state of a control, from BOTH places a state can be written — session 65's helper, kept
 * whole so the sweep has one reader rather than five.
 *
 * ⚠️ FINDING 4, AND IT IS AN ADMISSION RATHER THAN A CLAIM. In THIS family the top-level branch
 * finds nothing: `LearnerPathSection` nests every state with `&`. It is kept because it is
 * correct and the next top-level `.Option:hover` would need it, but the row below asserts what
 * this file actually relies on — the NESTED mechanism — and records the other as unexercised
 * rather than reporting a guard this family has not tested.
 */
function statesOf(file: FileKey, selectors: string[]): { selector: string; bodies: string[] }[] {
  const order: string[] = [];
  const bySuffix = new Map<string, string[]>();
  const add = (suffix: string, body: string) => {
    if (!bySuffix.has(suffix)) {
      bySuffix.set(suffix, []);
      order.push(suffix);
    }
    bySuffix.get(suffix)!.push(body);
  };

  for (const selector of selectors) {
    for (const body of rules(file, selector)) {
      for (const state of nestedStates(body)) add(state.selector.slice(1), state.body);
    }
    for (const r of topLevelRules(file)) {
      for (const s of r.selectors) {
        if (!s.startsWith(selector) || s === selector) continue;
        const rest = s.slice(selector.length);
        if (!/^[:.[]/.test(rest)) continue;
        add(rest, r.body);
      }
    }
  }
  return order.map((selector) => ({ selector, bodies: bySuffix.get(selector)! }));
}

type Ground = { file: FileKey; selector: string; token: string; what: string };

/**
 * The launcher's scrolling content area, which is the ground under this whole section: the
 * section root, the tab strip's `.TabContent` and the `Learning` view all paint nothing, so a
 * control here is seen against `bg-0`. Verified by reading up the tree rather than assumed —
 * `Tabs`' segmented variant explicitly paints `background: none`.
 */
const CONTENT_AREA: Ground = {
  file: 'launcherShell',
  selector: '.ContentArea',
  token: '--theme-color-bg-0',
  what: "the launcher's content area (bg-0)"
};

/** The `<li>` a path lesson is drawn in — a REGION, and the second ground `.Ghost` sits on. */
const STEP: Ground = {
  file: 'learnerPath',
  selector: '.Step',
  token: '--theme-color-bg-1',
  what: 'a path step (bg-1)'
};

/**
 * The three CONTROLS in this family, each with EVERY surface it is actually placed on.
 *
 * ⚠️ DELIBERATELY ABSENT, and asserted as still-dividers at the bottom of this file: `.Truth`,
 * `.Step` and `.Omitted`. All three are static `bg-1` boxes on the `bg-0` content area, carried
 * by a fill step of 1.165 dark / 1.133 light — over NAT-001's 1.09 perceptual bar — with the
 * border only tidying the corner. Nothing in them is operable.
 *
 * 🧭 ALSO ABSENT, and NOT a token question: every `:disabled` state in this file drops `opacity`
 * to 0.5–0.55, a composited value `themeTokens` explicitly refuses to grade. Recorded in the
 * sweep doc rather than measured here — the `.ResizeHandle` precedent from session 62, because a
 * made-up number is worse than an admitted gap.
 */
const CONTROLS: { name: string; file: FileKey; selectors: string[]; grounds: Ground[] }[] = [
  {
    name: '.Option — an intake answer, a <button aria-pressed> filled bg-2',
    file: 'learnerPath',
    selectors: ['.Option'],
    grounds: [CONTENT_AREA]
  },
  {
    name: '.Ghost — NO fill, and TWO grounds from a single call site',
    file: 'learnerPath',
    selectors: ['.Ghost'],
    grounds: [CONTENT_AREA, STEP]
  },
  {
    name: '.Primary — edge and fill are the SAME tone, and that is correct',
    file: 'learnerPath',
    selectors: ['.Primary'],
    grounds: [CONTENT_AREA]
  }
];

describe.each(['dark', 'light'] as ThemeName[])('the learner path family in %s', (theme) => {
  describe.each(CONTROLS)('$name', ({ file, selectors, grounds }) => {
    const bodies = () => selectors.flatMap((s) => rules(file, s));

    /**
     * ✅ THE GROUND IS PINNED BY NAME, not just by number — session 64's finding, and this is the
     * very surface that produced it. `Launcher .ContentArea` nests a scrollbar track painting
     * `bg-1` and a thumb painting `border-default`, so a reader that reached into a nested block
     * would measure these controls against a scrollbar. `border-control` clears 3:1 on `bg-1`
     * (4.17 / 3.72) exactly as on `bg-0` (4.86 / 3.28), so that misread would have left every
     * contrast row in this file GREEN on the wrong answer.
     */
    const groundToken = (ground: Ground) => {
      const token = lastOf(rules(ground.file, ground.selector), fillOf);
      expect(`${ground.file} ${ground.selector} paints ${token}`).toBe(
        `${ground.file} ${ground.selector} paints ${ground.token}`
      );
      return token!;
    };

    const border = () => {
      const token = lastOf(bodies(), (b) => tokenOf(b, 'border-color') ?? tokenOf(b, 'border'));
      if (!token) throw new Error(`${file} ${selectors.join('')}: no border naming a token`);
      return token;
    };

    /** A control that paints no fill is seen against its ground on BOTH sides of the edge. */
    const fill = (ground: Ground) => lastOf(bodies(), fillOf) ?? groundToken(ground);

    it('🔴 its resting boundary clears 3:1 against its own fill — or its fill carries it alone', () => {
      // FINDING 2. The `edge === fill` branch is this family's addition to the sweep's shape.
      // `.Primary` paints its border the same tone as its background, so the naive ratio is
      // 1.00:1 and reads as the worst defect in the file. It is not one: what identifies that
      // button is the FILL, at 6.53 / 4.03 on the ground. So the claim being graded switches to
      // the fill step rather than the row being deleted — and it still reddens if the fill moves.
      const failures = grounds
        .map((ground) => {
          const edge = border();
          const own = fill(ground);

          if (edge === own) {
            const step = tokenContrast(theme, own, groundToken(ground));
            return step >= 3
              ? null
              : `${selectors.join('')} paints its edge the same tone as its fill, and that fill is ` +
                  `only ${step.toFixed(2)}:1 on ${ground.what} in ${theme} — nothing identifies it`;
          }

          const ratio = tokenContrast(theme, edge, own);
          return ratio >= 3
            ? null
            : `${selectors.join('')}'s border is ${ratio.toFixed(2)}:1 on its own fill in ${theme} — ` +
                `under 1.4.11's 3:1, so the control has no perceivable edge`;
        })
        .filter(Boolean);
      expect([...new Set(failures)]).toEqual([]);
    });

    it('🔴 its resting boundary clears 3:1 on EVERY surface it is placed on', () => {
      // FINDING 1. `.Ghost` has one call site and TWO grounds, because it is placed twice inside
      // this component: the head row sits on `bg-0`, the "Explain this for me" button sits inside
      // a `.Step` on `bg-1`. A tone picked by reading the first placement is a real measurement
      // of the wrong question, exactly as session 65's shared button was.
      const failures = grounds
        .map((ground) => {
          const edge = border();
          if (edge === fill(ground)) return null; // graded as a fill step by the row above.
          const ratio = tokenContrast(theme, edge, groundToken(ground));
          return ratio >= 3 ? null : `${selectors.join('')} is ${ratio.toFixed(2)}:1 on ${ground.what} in ${theme}`;
        })
        .filter(Boolean);
      expect(failures).toEqual([]);
    });

    it('🔴 no state of it moves the edge below 3:1 on EITHER side', () => {
      // The row a find-and-replace over the sweep's inventory would not have. Both hover rules
      // here declare NO border, so there is nothing to delete and the only question is whether
      // inheriting the RAISED resting tone is safe on the step the fill moves to — session 65's
      // fifth variant of the hover trap. Both move UP the ramp: `.Option` bg-2 -> bg-3 (3.08 /
      // 3.05, the tightest pair in this file) and `.Ghost` transparent -> bg-2 (3.57 / 3.37).
      const restBorder = border();
      const failures: string[] = [];

      for (const ground of grounds) {
        for (const state of statesOf(file, selectors)) {
          if (!state.bodies.some((b) => declares(b, 'border-color') || paintsFill(b))) continue;
          const stateBorder = lastOf(state.bodies, (b) => tokenOf(b, 'border-color')) ?? restBorder;
          const stateFill = lastOf(state.bodies, fillOf) ?? fill(ground);

          if (stateBorder === stateFill) {
            const fillStep = tokenContrast(theme, stateFill, groundToken(ground));
            if (fillStep < 3) {
              failures.push(
                `${selectors.join('')}${state.selector} paints its edge the same tone as its fill, and ` +
                  `that fill is only ${fillStep.toFixed(2)}:1 on ${ground.what}`
              );
            }
            continue;
          }

          const onFill = tokenContrast(theme, stateBorder, stateFill);
          const onGround = tokenContrast(theme, stateBorder, groundToken(ground));
          if (onFill < 3) {
            failures.push(`${selectors.join('')}${state.selector} is ${onFill.toFixed(2)}:1 on its own fill`);
          }
          if (onGround < 3) {
            failures.push(`${selectors.join('')}${state.selector} is ${onGround.toFixed(2)}:1 on ${ground.what}`);
          }
        }
      }

      expect([...new Set(failures)]).toEqual([]);
    });
  });

  it('🔴 the state reader finds what this file actually relies on — and one half draws NOTHING', () => {
    // FINDING 4. Session 65's `statesOf` reads states from two places, and in ITS family both
    // spellings were live. Here only the nested one is, so the honest assertion is a pin on the
    // states that exist plus an explicit record that the other branch is unexercised. Reporting
    // the two-mechanism reader as this file's strength would be session 65's own warning —
    // a guard inherited is a guard untested — repeated by the session that received it.
    const option = statesOf('learnerPath', ['.Option']).map((s) => s.selector);
    expect(option).toContain(':hover:not(:disabled)');
    expect(option).toContain("[data-chosen='yes']");

    const ghost = statesOf('learnerPath', ['.Ghost']).map((s) => s.selector);
    expect(ghost).toContain(':hover:not(:disabled)');

    // The unexercised half, asserted as unexercised. If a top-level `.Option:hover` is ever
    // added, this row goes red and the next reader learns the branch has started to matter.
    // ⚠️ The suffix must begin with `:`, `.` or `[` — the same rule `statesOf` applies, and it is
    // load-bearing in exactly this file: `.Options` is the flex row that HOLDS the options, and a
    // naive prefix match reads it as a state of `.Option` and reddens this row on nothing.
    const extendsOne = (s: string) =>
      ['.Option', '.Ghost', '.Primary'].some((c) => s.startsWith(c) && s !== c && /^[:.[]/.test(s.slice(c.length)));
    const topLevel = topLevelRules('learnerPath').flatMap((r) => r.selectors).filter(extendsOne);
    expect(topLevel).toEqual([]);

    // ...and the same trap, checked on the reader this file DOES rely on: `.Options` and
    // `.OmittedTitle` are siblings, not states.
    expect(option).not.toContain('s');
    expect(statesOf('learnerPath', ['.Omitted']).map((s) => s.selector)).toEqual([]);
  });

  it('🔴 the chosen option is still distinguishable from an unchosen one', () => {
    // ⚠️ Raising a RESTING edge is not free on a toggle: `.Option` is `aria-pressed`, and the
    // chosen state is carried partly by its border. A stronger resting tone eats into the signal
    // the selection contrasts against. It survives on four separate channels — hue, the fill
    // step, the label colour and the weight — but the border pair must not collapse to the same
    // tone, which is what this row refuses.
    const resting = tokenOf(rule('learnerPath', '.Option'), 'border');
    const chosen = nestedStates(rule('learnerPath', '.Option')).find((s) => s.selector.includes('data-chosen'));
    expect(chosen).toBeDefined();

    const chosenBorder = tokenOf(chosen!.body, 'border-color');
    expect(resting).not.toBe(chosenBorder);
    expect(paintsFill(chosen!.body)).toBe(true);
    expect(declares(chosen!.body, 'color')).toBe(true);
    expect(declares(chosen!.body, 'font-weight')).toBe(true);

    // And the chosen tone is itself still a real edge on the fill it lands on.
    const chosenFill = fillOf(chosen!.body)!;
    const ratio = tokenContrast(theme, chosenBorder!, chosenFill);
    expect(ratio >= 3 ? 'passes' : `the chosen option is ${ratio.toFixed(2)}:1 on its own fill`).toBe('passes');
  });

  it('🔴 the divider tone is still INVISIBLE on the surfaces this family uses', () => {
    // The negative control, and the row that refuses the over-fix: a sweep that raised the shared
    // token instead of the call sites would pass every row above and redden this one.
    //
    // ⚠️ THE BOUND IS A PROPERTY OF THE GROUND — sessions 61, 62, 64 and 65 each filed this, and
    // this is the first family needing THREE of them at once, because its controls touch three
    // steps: `bg-0` under the section (1.46 dark), `bg-1` inside a step (1.27 light) and `bg-2`
    // under an option (1.15 light). Copying any single earlier file's bound reads a correct value
    // as a defect on two of the three.
    const grounds: { rule: () => string; bound: number; what: string }[] = [
      { rule: () => rule('launcherShell', '.ContentArea'), bound: 1.5, what: 'the content area (bg-0)' },
      { rule: () => rule('learnerPath', '.Step'), bound: 1.4, what: 'a path step (bg-1)' },
      { rule: () => rule('learnerPath', '.Option'), bound: 1.2, what: "an option's fill (bg-2)" }
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
    // The over-fix mutant's target: a blanket find-and-replace over this stylesheet would raise
    // these too, and each is a boundary between REGIONS rather than something a reader must
    // identify as operable. `.Truth` is a sentence, `.Step` is a list item and `.Omitted` is a
    // note — all `bg-1` boxes carried by their own fill step on the `bg-0` ground.
    const regions: [string, string][] = [
      ['.Truth', '--theme-color-border-default'],
      ['.Step', '--theme-color-border-default'],
      ['.Omitted', '--theme-color-border-default']
    ];

    for (const [selector, expected] of regions) {
      expect(`${selector}: ${tokenOf(rule('learnerPath', selector), 'border')}`).toBe(`${selector}: ${expected}`);
    }

    // ⚠️ And they are carried by their FILL, which is the reason the edge may stay a divider.
    // If the ramp ever flattens so a region is invisible without its border, this reddens and the
    // membership judgement above has to be re-made rather than inherited.
    const step = tokenContrast(theme, '--theme-color-bg-1', '--theme-color-bg-0');
    expect(step >= 1.09 ? 'carried' : `a bg-1 region is only ${step.toFixed(3)}:1 on bg-0`).toBe('carried');
  });
});
