import * as fs from 'fs';
import * as path from 'path';

import { ThemeName, tokenContrast } from '../support/themeTokens';

/**
 * The launcher's Projects view — the fourth slice of the `--theme-color-border-default` sweep
 * opened in phase 75 (`BORDER-CONTROL-SWEEP.md`), and the second in `noodl-core-ui`.
 *
 * 🔴 COPIED FROM `code-editor-control-borders.test.ts`, NOT from the bench or picker files.
 * Session 63's finding was that its first draft read `border-color` out of the whole SCSS rule
 * body — which contains the nested `&:hover` — and so passed 38/38 while four of ten mutants
 * survived. The bench and picker helpers have the same defect and were never exposed only
 * because those families happened to write their states as top-level rules. THIS family nests
 * with `&` everywhere, so `own()` below is load-bearing from the first row.
 *
 * 🔴 `border-default` IS A DIVIDER TONE AND IS SUPPOSED TO BE INVISIBLE (`colors.css`, NAT-003).
 * The defect is never the token; it is the subset of declarations that are CONTROL boundaries
 * wearing it. The negative control at the bottom holds that line.
 *
 * 🔴 WHAT THIS FAMILY ADDED, each with a row that reddens at a number:
 *
 * 1. A THIRD SHAPE OF THE HOVER TRAP, and the first that is INVISIBLE TO A GREP.
 *    Sessions 61-63 each found hover rules that NAME a divider tone (`border-strong`,
 *    `border-highlight`) — findable by searching hover rules for `border-color`. The sweep doc's
 *    "20 stylesheets" trap list is built that way. `.FolderPickerItem:hover` DECLARES NO BORDER
 *    AT ALL. It moves the FILL down the ramp (bg-3 -> bg-4), and POL-016 scopes `border-control`
 *    to bg-1/2/3 — it measures 2.64 dark / 2.77 light on bg-4. So the resting fix is INHERITED
 *    onto a step where it fails 1.4.11. A hover can therefore break a resting fix without
 *    mentioning the border, and no search over border declarations can find it.
 *
 * 2. A SIXTH PROOF THE INVENTORY IS A FLOOR. It lists `.Card`, `.Select` and `.FolderPickerItem`
 *    from this family. `.Search` — the box that draws the search `<input>`'s boundary — is a
 *    fourth, and the query cannot see it for the reason it could not see
 *    `.TemplateFilter-search`, `NodePickerSearchBar .Field` or `BenchScenarioBar .NameField`:
 *    a text field sets no `cursor: pointer`. Four families, four times, same blind spot.
 *
 * 3. A FOURTH DISTINCT NEGATIVE-CONTROL BOUND. Sessions 61 and 62 filed that the bound belongs
 *    to the GROUND: 1.4 on bg-1, 1.2 on bg-2. This family sits on bg-0, where the divider is
 *    1.46 dark / 1.12 light — the highest yet, needing 1.5. Copying any previous file's bound
 *    would have read the correct value as a defect.
 *
 * 🔴 THIS SPEC READS THE STYLESHEETS, NOT THE PALETTE. Asserting `border-control` clears 3:1
 * would pass on a build where this family never names it. Every row resolves the selector's own
 * border, its own fill and its ground out of the `.scss` files, so a revert fails at a NUMBER.
 */

const LAUNCHER = path.resolve(__dirname, '../../../noodl-core-ui/src/preview/launcher/Launcher');

const FILES = {
  launcher: `${LAUNCHER}/Launcher.module.scss`,
  projects: `${LAUNCHER}/views/Projects.module.scss`,
  card: `${LAUNCHER}/components/LauncherProjectCard/LauncherProjectCard.module.scss`,
  searchBar: `${LAUNCHER}/components/LauncherSearchBar/LauncherSearchBar.module.scss`
} as const;

type FileKey = keyof typeof FILES;

/** ⚠️ Comments are stripped FIRST — the prose this sweep added names the very tokens the parser
 *  below looks for, and a regex that read a comment would report the wrong tone. */
const source = (file: FileKey) => fs.readFileSync(FILES[file], 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Every top-level rule in a file, as `{ selectors, body }`. A real scanner rather than a regex,
 *  for the reason session 63 documented: comma-separated selectors and later overriding rules
 *  both defeat an anchored `^\.X\s*\{`. */
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

/** Every top-level rule body that applies to `selector`, in document order. Last one wins. */
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

/** Every nested `&<suffix> { ... }` block in a rule body. States are discovered from disk, so a
 *  state added later is measured without anyone remembering to add a row for it. */
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
 * A rule's OWN declarations, with every nested block removed. Session 63's finding, and it is
 * load-bearing HERE — measured, not assumed:
 *
 * 🔴 REPLACING THIS FUNCTION WITH `return body` MAKES THE SPEC PASS 38/38 WITH MUTANT 1 APPLIED.
 * Reverting `.Card`'s resting edge to `border-default` then changes nothing the spec looks at,
 * because `.Card` nests `&:hover { border-color: primary }` and `border()` tries `border-color`
 * before `border` — so the RESTING rows resolve to the HOVER's tone. That is session 63's defect
 * reproduced exactly, in a family that nests every state.
 *
 * ⚠️ What breaking it does NOT do, checked rather than presumed: the ground read survives,
 * because `.ContentArea` declares its own `background` ABOVE its nested scrollbar rules and
 * `tokenOf` takes the first match. The ground misread needs a second condition — see the
 * pin-by-name row below, which is where that case is documented and measured.
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

/** ⚠️ This family mixes both spellings — `Launcher`/`LauncherProjectCard` use the `background:`
 *  shorthand, `Projects` uses `background-color:`. Reading only one would silently make
 *  `.FolderPickerItem` look transparent and measure it against the wrong surface. */
const fillOf = (body: string) => tokenOf(body, 'background-color') ?? tokenOf(body, 'background');
const paintsFill = (body: string) => declares(body, 'background-color') || declares(body, 'background');

const lastOf = <T,>(bodies: string[], read: (b: string) => T | null): T | null => {
  for (let i = bodies.length - 1; i >= 0; i--) {
    const value = read(bodies[i]);
    if (value !== null && value !== undefined) return value;
  }
  return null;
};

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
 * The four CONTROLS in this family, each with the rule that paints the surface it is seen
 * against. Confirmed against the TSX: `.Card` is a `role="button"` div, `.FolderPickerItem` is a
 * `<button>`, and `.Search` / `.Select` are the boxes that draw a native `<input>`'s and
 * `<select>`'s boundary (`LauncherSearchBar.tsx`).
 *
 * ⚠️ The Projects view sets no background on `.Main`, so the first three are seen against the
 * launcher's own `.ContentArea` — a ground in a DIFFERENT stylesheet from every control that
 * sits on it. `.FolderPickerItem` is the exception: it is inside the move-to-folder modal and
 * takes its ground from `.FolderPickerDialog` in its own file.
 *
 * ⚠️ DELIBERATELY ABSENT, and asserted as still-dividers at the bottom: `.Sidebar` (a region
 * boundary), `.FolderPickerDialog` (a modal surface edge) and `.Kbd` — the ⌘K keycap, a HINT
 * rather than something a reader operates, and left alone for the same reason session 61 left
 * the node picker's `.Kbd` and `.Enter`.
 */
const CONTROLS: {
  name: string;
  file: FileKey;
  selector: string;
  ground: { file: FileKey; selector: string; token: string };
}[] = [
  {
    name: 'LauncherProjectCard .Card',
    file: 'card',
    selector: '.Card',
    ground: { file: 'launcher', selector: '.ContentArea', token: '--theme-color-bg-0' }
  },
  {
    name: 'LauncherSearchBar .Search (the site the inventory CANNOT see)',
    file: 'searchBar',
    selector: '.Search',
    ground: { file: 'launcher', selector: '.ContentArea', token: '--theme-color-bg-0' }
  },
  {
    name: 'LauncherSearchBar .Select',
    file: 'searchBar',
    selector: '.Select',
    ground: { file: 'launcher', selector: '.ContentArea', token: '--theme-color-bg-0' }
  },
  {
    name: 'Projects .FolderPickerItem (whose HOVER breaks the fix without naming a border)',
    file: 'projects',
    selector: '.FolderPickerItem',
    ground: { file: 'projects', selector: '.FolderPickerDialog', token: '--theme-color-bg-2' }
  }
];

describe.each(['dark', 'light'] as ThemeName[])('the launcher Projects family in %s', (theme) => {
  describe.each(CONTROLS)('$name', ({ file, selector, ground }) => {
    const bodies = () => rules(file, selector);

    const groundToken = () => {
      const token = lastOf(rules(ground.file, ground.selector), fillOf);
      if (!token) throw new Error(`${ground.file} ${ground.selector} no longer paints a background`);
      return token;
    };

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
      // The row that carries this family's finding. It measures a state that changes the border
      // OR THE FILL — and the fill half is what catches `.FolderPickerItem:hover`, which names no
      // border and would be invisible to any check built around border declarations.
      const restBorder = border();
      const failures: string[] = [];

      for (const state of mergedStates(bodies())) {
        if (!state.bodies.some((b) => declares(b, 'border-color') || paintsFill(b))) continue;
        const stateBorder = lastOf(state.bodies, (b) => tokenOf(b, 'border-color')) ?? restBorder;
        const stateFill = lastOf(state.bodies, fillOf) ?? fill();

        const onFill = tokenContrast(theme, stateBorder, stateFill);
        const onGround = tokenContrast(theme, stateBorder, groundToken());
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

    it('🔴 its ground is pinned BY NAME, because a misread here cannot fail a number', () => {
      // ⚠️ THE ROW THE CONTRAST ROWS CANNOT REPLACE, and the exact conditions were measured.
      // `.ContentArea` nests a scrollbar-track rule painting `bg-1`. Two things must both go
      // wrong for the ground to become that scrollbar: `own()` must regress, AND the nested rule
      // must use the other spelling (`background-color` where the outer uses `background`),
      // because `fillOf` tries `background-color` FIRST. Reproduced both together: this row goes
      // red 6 times and EVERY contrast row above stays green — `border-control` clears 3:1 on
      // bg-1 (4.17 / 3.72) just as it does on bg-0 (4.86 / 3.28), so no number can notice.
      //
      // 🔴 That is the general shape worth keeping: when the wrong answer also passes, the only
      // check that works is naming the right one. It also pins the ground against an ordinary
      // restyle of `.ContentArea`, which is the likelier way this drifts.
      expect(`${ground.selector} paints ${groundToken()}`).toBe(`${ground.selector} paints ${ground.token}`);
    });
  });

  it('🔴 border-control CANNOT carry .FolderPickerItem:hover, and this is why', () => {
    // Finding 1, with its reason attached. POL-016 scopes `border-control` to bg-1/2/3; this
    // button's hover fill is bg-4. Anyone "tidying" the hover away — the remedy that was correct
    // for the node picker, whose hover fill moved the OTHER way — reddens the state row above.
    // ⚠️ Deliberately a TRIPWIRE, not a permanent truth: if `border-control` is ever re-placed so
    // it clears bg-4, this row goes red on an IMPROVEMENT, and the right response is to reconsider
    // the tone here — which is exactly the conversation the red should start.
    const hover = nestedStates(rule('projects', '.FolderPickerItem')).find((s) => s.selector === '&:hover');
    const hoverFill = fillOf(hover!.body)!;
    const ratio = tokenContrast(theme, '--theme-color-border-control', hoverFill);
    const verdict =
      ratio < 3
        ? 'border-control still fails on this hover fill'
        : `border-control now measures ${ratio.toFixed(2)}:1 on ${hoverFill} in ${theme} — re-read the ` +
          `.FolderPickerItem:hover comment, the reason it uses primary may have expired`;
    expect(verdict).toBe('border-control still fails on this hover fill');
  });

  it('🔴 the divider tone is still INVISIBLE on the surfaces this family uses', () => {
    // The negative control, and the row that refuses the over-fix: a sweep that raised the shared
    // token instead of the call sites would pass every row above and redden this one.
    //
    // ⚠️ THE BOUND IS A PROPERTY OF THE GROUND, filed by sessions 61 and 62 and confirmed here
    // from a third step of the ramp. bg-0 carries the divider at 1.46 in dark — HIGHER than the
    // bg-1 surfaces that needed 1.4 and the bg-2 surfaces that needed 1.2. Copying either of the
    // earlier files' bounds would read the correct value as a defect.
    const grounds: { rule: () => string; bound: number; what: string }[] = [
      { rule: () => rule('launcher', '.ContentArea'), bound: 1.5, what: 'the launcher content area (bg-0)' },
      { rule: () => rule('projects', '.FolderPickerDialog'), bound: 1.2, what: 'the folder-picker dialog (bg-2)' },
      { rule: () => rule('projects', '.FolderPickerItem'), bound: 1.2, what: "the picker row's own fill (bg-3)" }
    ];

    const failures = grounds
      .map(({ rule: r, bound, what }) => {
        const ratio = tokenContrast(theme, '--theme-color-border-default', fillOf(r())!);
        return ratio < bound ? null : `border-default is ${ratio.toFixed(2)}:1 on ${what} in ${theme}, over ${bound}`;
      })
      .filter(Boolean);

    expect(failures).toEqual([]);
  });

  it('🔴 the REGION edges and the keycap were deliberately left alone', () => {
    // The over-fix row. A blanket find-and-replace over this family would raise these three too,
    // and none is something a reader must identify as operable: two are boundaries between
    // regions, and `.Kbd` is the ⌘K hint printed INSIDE the search box — the control there is
    // `.Search`, which is fixed above.
    const regions: [FileKey, string, string][] = [
      ['projects', '.Sidebar', 'border-right'],
      ['projects', '.FolderPickerDialog', 'border'],
      ['searchBar', '.Kbd', 'border']
    ];

    for (const [file, selector, property] of regions) {
      expect(`${file} ${selector}: ${tokenOf(rule(file, selector), property)}`).toBe(
        `${file} ${selector}: --theme-color-border-default`
      );
    }
  });
});
