import * as fs from 'fs';
import * as path from 'path';

import { ThemeName, tokenContrast } from '../support/themeTokens';

/**
 * `FolderTree` — the launcher's projects sidebar and the confirmation dialog it opens, and the
 * slice of the phase-75 border sweep (`BORDER-CONTROL-SWEEP.md`) that closes the last
 * `noodl-core-ui` entry named on the remaining list. Sibling of
 * `learner-path-control-borders.test.ts` (session 66), whose helpers this copies.
 *
 * THREE CONTROLS FIXED OR GRADED, and the family is read whole rather than trusted against the list:
 *
 *   `.RenameInputField` / `.CreateFolderInputField`  two native `<input>`s sharing one rule —
 *                        1.26:1 dark / 1.27:1 light on the sidebar they sit in. NOT on the sweep's
 *                        inventory: neither sets `cursor`, which is the exact blind spot the
 *                        inventory documents at `.TemplateFilter-search`.
 *   `.DeleteConfirmationCancelButton`  a `<button>` — 1.07 / 1.15, and ON the list.
 *   `.DeleteConfirmationDeleteButton`  edge and fill are the SAME tone, 1.00:1 between them —
 *                        graded by its fill step, and its HOVER is a known-open defect pinned below.
 *
 * 🔴 FOUR FINDINGS THIS FAMILY ADDED:
 *
 * 1. THE SECOND GROUND IS A MODAL THIS COMPONENT RENDERS ITSELF. Session 66 found a control with
 *    two grounds from one call site and filed "count PLACEMENTS, not call sites". `FolderTree` has
 *    one call site (`Projects.tsx`) and TWO grounds again — but this time the second is not another
 *    spot in the layout, it is a `position: fixed` dialog the component renders into the middle of
 *    the screen. A placement count that walks the component's own layout tree still misses it,
 *    because the dialog ESCAPES that tree. ✅ Read what the component RENDERS, including its modals.
 *    The two buttons that matter most here are on `bg-2`, not the `bg-1` the file's own header
 *    comment describes.
 *
 * 2. THE FILL STEP DECIDES WHETHER THE EDGE IS GRADED AT ALL — session 66's `edge === fill` branch
 *    generalised, and this family is where the special case stops being enough. Session 60 already
 *    observed at `.TemplateCard` that an edge is "load-bearing or not depending on whether the fill
 *    step carries the object on its own"; that observation has been prose in the sweep doc for six
 *    sessions and is encoded here. `edge === fill` is simply the case where the outermost tone IS
 *    the fill. See `identifies()` below.
 *
 * 3. SESSION 64's HOVER REMEDY TRANSFERS — AND WAS MEASURED, NOT INHERITED. `.FolderPickerCancelButton`
 *    (session 64, same view, different component) is the same shape as
 *    `.DeleteConfirmationCancelButton`: a `bg-3` button whose hover moves the fill DOWN to `bg-4`,
 *    where `border-control` is 2.64 / 2.77. Session 65 filed that a guard inherited is untested
 *    until its mutant runs in the new family. Run here it kills — see the state row.
 *
 * 4. A DEFECT THIS SWEEP CANNOT FIX, RECORDED AS A NUMBER RATHER THAN AS PROSE.
 *    `.DeleteConfirmationDeleteButton:hover` drops both fill and edge to `danger-dim`, which is
 *    2.61:1 on the dialog in DARK. It is not fixable inside this file: the same button's white
 *    label needs the dim step to be legible at all (2.79:1 on `danger` in dark), so the boundary
 *    and the label pull in opposite directions and the answer is a platform token decision. It is
 *    pinned by its measured value below so that it cannot drift silently, and written up in the
 *    sweep doc. ⚠️ Pinned, NOT asserted to pass.
 *
 * 🔴 THIS SPEC READS THE STYLESHEETS, NOT THE PALETTE. Asserting that a tone clears 3:1 would pass
 * on a build where this family never names it. Every row resolves the selector's own border, its
 * own fill and its grounds out of the `.scss` files, so a revert fails at a NUMBER.
 */

const CORE = path.resolve(__dirname, '../../../noodl-core-ui/src');
const LAUNCHER = `${CORE}/preview/launcher/Launcher`;

const FILES = {
  folderTree: `${LAUNCHER}/components/FolderTree/FolderTree.module.scss`,
  folderTreeItem: `${LAUNCHER}/components/FolderTreeItem/FolderTreeItem.module.scss`,
  projects: `${LAUNCHER}/views/Projects.module.scss`
} as const;

type FileKey = keyof typeof FILES;

/** ⚠️ Comments are stripped FIRST — this session's edit put `border-default`, `border-control`,
 *  `primary` AND the bg-4 ratios into comments directly above the rules that name them. Without
 *  this the parser reads the explanation of the fix instead of the fix. */
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

/** Every top-level rule body that applies to `selector`, in document order. The LAST one wins. */
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
 * 🔴 LOAD-BEARING IN THIS FAMILY, and measured here rather than inherited — session 65's standing
 * instruction, which session 66 confirmed cuts both ways. Broken here it kills: the two `<input>`s
 * nest `&:focus { border-color: var(--theme-color-primary) }`, and `tokenOf` tries `border-color`
 * before `border`, so a reader without this resolves the RESTING edge of an unfocused field to
 * `primary` — which clears 3:1 on every surface this family touches, so the revert mutant PASSES.
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

/** ⚠️ Both spellings — this family writes `background-color:` in the dialog and `background:` in
 *  the sidebar items. Reading only one makes a ground look unpainted. */
const fillOf = (body: string) => tokenOf(body, 'background-color') ?? tokenOf(body, 'background');
const paintsFill = (body: string) => declares(body, 'background-color') || declares(body, 'background');

const lastOf = <T,>(bodies: string[], read: (b: string) => T | null): T | null => {
  for (let i = bodies.length - 1; i >= 0; i--) {
    const value = read(bodies[i]);
    if (value !== null && value !== undefined) return value;
  }
  return null;
};

/** Every state of a control, from BOTH places a state can be written. */
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
        // ⚠️ THE SUFFIX GUARD IS UNEXERCISED IN THIS FAMILY, and this comment says so because the
        // mutant said so. It was predicted to be live: `.RenameInput` is the wrapper that HOLDS
        // `.RenameInputField`, and `.CreateFolderInput` holds `.CreateFolderInputField` — which
        // looks exactly like session 66's `.Option` / `.Options` hazard. It is the MIRROR IMAGE of
        // it. The guard fires only when the QUERIED selector is a prefix of another one, and here
        // the queried selector is the LONGER of the pair, so nothing is ever a candidate. Removing
        // this line kills no row.
        //
        // ✅ Kept because it is correct and the next `.RenameInputFieldWrapper` would need it —
        // recorded as unexercised rather than reported as this file's strength, which is session
        // 65's own instruction applied to session 66's helper. A common prefix is NOT enough to
        // conclude the guard is live; the direction is the whole question.
        if (!/^[:.[]/.test(rest)) continue;
        add(rest, r.body);
      }
    }
  }
  return order.map((selector) => ({ selector, bodies: bySuffix.get(selector)! }));
}

type Ground = { file: FileKey; selector: string; token: string; what: string };

/**
 * The 224px sidebar the tree fills. Read out of the VIEW rather than this component — `FolderTree`
 * paints nothing at its root, so its controls are seen against whatever placed it.
 */
const SIDEBAR: Ground = {
  file: 'projects',
  selector: '.Sidebar',
  token: '--theme-color-bg-1',
  what: 'the projects sidebar (bg-1)'
};

/**
 * FINDING 1 — the ground that a placement count cannot reach. `.DeleteConfirmationDialog` is
 * `position: fixed` and rendered by this component into the centre of the screen, so the two
 * buttons inside it are NOT on the `bg-1` sidebar this file's header comment describes.
 */
const DIALOG: Ground = {
  file: 'folderTree',
  selector: '.DeleteConfirmationDialog',
  token: '--theme-color-bg-2',
  what: "the confirmation dialog (bg-2)"
};

const CONTROLS: { name: string; file: FileKey; selectors: string[]; grounds: Ground[] }[] = [
  {
    name: '.RenameInputField / .CreateFolderInputField — two native <input>s the inventory could not see',
    file: 'folderTree',
    selectors: ['.RenameInputField', '.CreateFolderInputField'],
    grounds: [SIDEBAR]
  },
  {
    name: '.DeleteConfirmationCancelButton — a <button> on the DIALOG, not on the sidebar',
    file: 'folderTree',
    selectors: ['.DeleteConfirmationCancelButton'],
    grounds: [DIALOG]
  },
  {
    name: '.DeleteConfirmationDeleteButton — edge and fill are the SAME tone, and at rest that is correct',
    file: 'folderTree',
    selectors: ['.DeleteConfirmationDeleteButton'],
    grounds: [DIALOG]
  }
];

describe.each(['dark', 'light'] as ThemeName[])('the folder tree family in %s', (theme) => {
  describe.each(CONTROLS)('$name', ({ file, selectors, grounds }) => {
    const bodies = () => selectors.flatMap((s) => rules(file, s));

    /** ✅ THE GROUND IS PINNED BY NAME, not just by number — session 64's finding, kept because the
     *  two grounds here differ by one ramp step (1.168:1 between them in dark) and a row that read
     *  the wrong one would still pass on `border-control`. */
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

    /**
     * FINDING 2 — one criterion covering both shapes the sweep has met.
     *
     * A control is identified against its surroundings by its OUTERMOST tone: the border if it
     * paints one, otherwise the fill. That single ratio is what 1.4.11 asks for, and it is asserted
     * for every control in every state.
     *
     * The SECOND question — is the ring visible as a ring against the fill it encloses — is asked
     * only when the ring is doing the identifying on its own, i.e. when the fill does NOT clear
     * 3:1 on the ground. Session 66's `edge === fill` branch is the degenerate case of this (the
     * outermost tone IS the fill), and session 60's `.TemplateCard` note is the other half of it.
     *
     * ⚠️ It stays strict exactly where the sweep has always been strict: every `bg-N` control here
     * has a fill step of 1.10–1.17 on its ground, so the ring is load-bearing and BOTH ratios are
     * graded. It relaxes only for the destructive button, whose `danger` fill is 4.52 / 4.38 on the
     * dialog and identifies it many times over.
     */
    const identifies = (edge: string, ownFill: string, ground: Ground): string[] => {
      const groundTone = groundToken(ground);
      const boundary = edge;
      const failures: string[] = [];

      const onGround = tokenContrast(theme, boundary, groundTone);
      if (onGround < 3) {
        failures.push(
          `${selectors.join('')} is ${onGround.toFixed(2)}:1 against ${ground.what} in ${theme} — ` +
            `under 1.4.11's 3:1, so nothing marks where the control is`
        );
      }

      const fillStep = tokenContrast(theme, ownFill, groundTone);
      if (fillStep >= 3) return failures; // the fill carries the object; the ring is decoration.

      if (edge === ownFill) {
        failures.push(
          `${selectors.join('')} paints its edge the same tone as its fill, and that fill is only ` +
            `${fillStep.toFixed(2)}:1 on ${ground.what} in ${theme} — nothing identifies it`
        );
        return failures;
      }

      const onFill = tokenContrast(theme, edge, ownFill);
      if (onFill < 3) {
        failures.push(
          `${selectors.join('')}'s border is ${onFill.toFixed(2)}:1 on its own fill in ${theme}, and ` +
            `the fill is only ${fillStep.toFixed(2)}:1 on ${ground.what} — the ring is the only ` +
            `affordance and it cannot be seen`
        );
      }
      return failures;
    };

    it('🔴 its resting boundary identifies the control on EVERY surface it is placed on', () => {
      const failures = grounds.flatMap((ground) => identifies(border(), fill(ground), ground));
      expect([...new Set(failures)]).toEqual([]);
    });

    it('🔴 no state of it drops the boundary below 3:1', () => {
      // FINDING 3. The row session 64's remedy has to survive. `.DeleteConfirmationCancelButton`
      // moves its fill DOWN the ramp on hover (bg-3 -> bg-4) while naming no border of its own, so
      // without the added `primary` it inherits `border-control` onto a step where that tone is
      // 2.64 dark / 2.77 light — a control that loses its edge only while the pointer is on it.
      //
      // ⚠️ `.DeleteConfirmationDeleteButton:hover` is EXCLUDED here and pinned by its number in the
      // row below instead. It fails, it is not fixable in this file, and a silent skip would be the
      // exclusion this sweep has learned to refuse — so it is graded somewhere that says so.
      const restBorder = border();
      const failures: string[] = [];

      for (const ground of grounds) {
        for (const state of statesOf(file, selectors)) {
          if (selectors.includes('.DeleteConfirmationDeleteButton')) continue;
          if (!state.bodies.some((b) => declares(b, 'border-color') || paintsFill(b))) continue;
          const stateBorder = lastOf(state.bodies, (b) => tokenOf(b, 'border-color')) ?? restBorder;
          const stateFill = lastOf(state.bodies, fillOf) ?? fill(ground);
          for (const failure of identifies(stateBorder, stateFill, ground)) {
            failures.push(`${state.selector}: ${failure}`);
          }
        }
      }

      expect([...new Set(failures)]).toEqual([]);
    });
  });

  it('🔴 the destructive button rests correctly and its HOVER is a known-open defect, pinned by number', () => {
    // FINDING 4, and the reason it is a pin rather than an assertion.
    //
    // At REST the button paints `danger` as both edge and fill: 1.00:1 between them, the shape
    // session 63 called a false positive at `.SaveButton`. Graded by its fill step it is correct —
    // `danger` is 4.52 dark / 4.38 light on the dialog, so the object is identified by its fill.
    //
    // On HOVER both drop to `danger-dim`, which is 2.61:1 on the dialog in DARK. That is a real
    // 1.4.11 failure and this sweep cannot fix it: the same button's white label needs the dim step
    // to be legible (white is 2.79:1 on `danger` in dark, 4.83:1 on `danger-dim`), so raising the
    // boundary darkens the label and vice versa. `danger` as a white-labelled fill is used in at
    // least seven stylesheets, so the answer is a platform token decision, not a local edit.
    //
    // Pinned to the MEASURED value so it cannot drift unnoticed. This row does not claim the hover
    // passes — it claims the defect is still exactly the size it was when it was written up.
    const restingEdge = tokenOf(rule('folderTree', '.DeleteConfirmationDeleteButton'), 'border');
    const restingFill = fillOf(rule('folderTree', '.DeleteConfirmationDeleteButton'));
    expect(restingEdge).toBe('--theme-color-danger');
    expect(restingFill).toBe('--theme-color-danger');

    const restStep = tokenContrast(theme, restingFill!, '--theme-color-bg-2');
    expect(restStep >= 3 ? 'carried by its fill' : `the destructive fill is ${restStep.toFixed(2)}:1 on the dialog`).toBe(
      'carried by its fill'
    );

    const hover = nestedStates(rule('folderTree', '.DeleteConfirmationDeleteButton')).find((s) =>
      s.selector.includes(':hover')
    );
    expect(hover).toBeDefined();
    expect(fillOf(hover!.body)).toBe('--theme-color-danger-dim');
    expect(tokenOf(hover!.body, 'border-color')).toBe('--theme-color-danger-dim');

    const hoverStep = tokenContrast(theme, '--theme-color-danger-dim', '--theme-color-bg-2');
    expect(`hover boundary ${hoverStep.toFixed(2)}:1`).toBe(
      `hover boundary ${(theme === 'dark' ? 2.61 : 5.96).toFixed(2)}:1`
    );
  });

  it('🔴 the borderless controls are carried by something, and that something is graded', () => {
    // The sweep's exclusion rule applied rather than its exclusion list extended. `.NewFolderButton`
    // is a real `<button>` that paints `border: 0` and `background: none` — under the inventory's
    // own membership test it is a control with NO boundary at all, which reads as the worst defect
    // in the file. It is not one: what identifies it is its LABEL, and a label is a number.
    //
    // Writing "a text button, deliberately left alone" would be a claim no row could ever fail.
    // This row fails the moment the label tone moves.
    const button = rule('folderTree', '.NewFolderButton');
    expect(tokenOf(button, 'border')).toBeNull();
    expect(fillOf(button)).toBeNull();

    const label = tokenOf(button, 'color')!;
    expect(label).toBe('--theme-color-fg-muted');
    const resting = tokenContrast(theme, label, '--theme-color-bg-1');
    expect(resting >= 4.5 ? 'legible' : `the new-folder label is ${resting.toFixed(2)}:1 on the sidebar`).toBe('legible');

    // ...and on the step its own hover moves the fill to.
    const hover = nestedStates(button).find((s) => s.selector.includes(':hover'))!;
    const hovered = tokenContrast(theme, tokenOf(hover.body, 'color')!, fillOf(hover.body)!);
    expect(hovered >= 4.5 ? 'legible' : `the new-folder label is ${hovered.toFixed(2)}:1 when hovered`).toBe('legible');
  });

  it('🔴 the divider tone is still INVISIBLE on the surfaces this family uses', () => {
    // The negative control, and the row that refuses the over-fix: a sweep that raised the shared
    // token instead of the call sites would pass every row above and redden this one.
    //
    // ⚠️ THE BOUND IS A PROPERTY OF THE GROUND — sessions 61, 62, 64, 65 and 66 each filed this,
    // and this family needs THREE bounds like the last one did, for three different steps: the
    // sidebar (bg-1, 1.27 light), the dialog (bg-2, 1.15 light) and the cancel button's own fill
    // (bg-3, 1.08 dark). Copying any single earlier file's bound reads a correct value as a defect.
    const grounds: { token: string; bound: number; what: string }[] = [
      { token: groundOf('projects', '.Sidebar'), bound: 1.4, what: 'the sidebar (bg-1)' },
      { token: groundOf('folderTree', '.DeleteConfirmationDialog'), bound: 1.2, what: 'the dialog (bg-2)' },
      { token: groundOf('folderTree', '.DeleteConfirmationCancelButton'), bound: 1.2, what: "the cancel button's fill (bg-3)" }
    ];

    const failures = grounds
      .map(({ token, bound, what }) => {
        const ratio = tokenContrast(theme, '--theme-color-border-default', token);
        return ratio < bound ? null : `border-default is ${ratio.toFixed(2)}:1 on ${what} in ${theme}, over ${bound}`;
      })
      .filter(Boolean);

    expect(failures).toEqual([]);
  });

  it('🔴 the REGION edges were deliberately left alone', () => {
    // The over-fix mutant's target: a blanket find-and-replace over this stylesheet would raise
    // these too, and each is a boundary between REGIONS rather than something a reader must
    // identify as operable. `.Divider` separates the virtual folders from the user's; the dialog
    // is a container, and it is told apart from what is behind it by a 50%-black backdrop and a
    // popup shadow rather than by its hairline.
    const regions: [string, string][] = [
      ['.Divider', '--theme-color-border-default'],
      ['.DeleteConfirmationDialog', '--theme-color-border-default']
    ];

    for (const [selector, expected] of regions) {
      const body = rule('folderTree', selector);
      const token = tokenOf(body, 'border') ?? tokenOf(body, 'background-color');
      expect(`${selector}: ${token}`).toBe(`${selector}: ${expected}`);
    }

    // ⚠️ And the dialog's separation is asserted where it actually comes from, so that the reason
    // above is graded rather than merely stated: the scrim and the shadow both have to still exist.
    const dialog = rule('folderTree', '.DeleteConfirmationDialog');
    expect(declares(dialog, 'box-shadow')).toBe(true);
    expect(fillOf(rule('folderTree', '.DeleteConfirmationBackdrop'))).toBe('--base-color-black-transparent-50');
  });

  it('🔴 the sibling stylesheet was read too, and it names no border at all', () => {
    // Session 61's "read the family exhaustively rather than trust the list". `FolderTreeItem` is
    // the other half of this component and every row in the sidebar is one — a `cursor: pointer`
    // element that the sweep's inventory query would never surface, because it declares no border.
    // Its items are carried by fill and label (`primary-bg` + `primary` when selected, `bg-3` on
    // hover), so there is nothing to raise. This row records that as CHECKED, and reddens if a
    // border is ever added there without being measured.
    const bordered = topLevelRules('folderTreeItem').filter(
      (r) => tokenOf(r.body, 'border') ?? tokenOf(r.body, 'border-color')
    );
    expect(bordered.map((r) => r.selectors.join(','))).toEqual([]);
  });
});

/** The fill token of a ground rule, pinned by name at its point of use. */
function groundOf(file: FileKey, selector: string): string {
  const token = lastOf(rules(file, selector), fillOf);
  if (!token) throw new Error(`${file} ${selector} paints no fill`);
  return token;
}
