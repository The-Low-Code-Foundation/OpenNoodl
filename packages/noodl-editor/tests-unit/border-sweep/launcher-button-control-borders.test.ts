import * as fs from 'fs';
import * as path from 'path';

import { ThemeName, tokenContrast } from '../support/themeTokens';

/**
 * The launcher's SHARED BUTTON and the share-template modal's radio pills — the slice of the
 * phase-75 border sweep (`BORDER-CONTROL-SWEEP.md`) that closes its `--theme-color-border-strong`
 * sites. Sibling of `launcher-control-borders.test.ts` (session 64), whose helpers this copies:
 * `own()` is load-bearing and session 64 proved it by reproduction rather than assumption.
 *
 * 🔴 NEITHER SITE HERE APPEARS IN THE SWEEP'S INVENTORY AT ALL. That inventory selects blocks
 * naming `border-default` AND `cursor: pointer`; both of these name `border-strong`, so they are
 * outside its query on the TOKEN axis — the leak session 62 filed and session 64 saw at scale.
 *
 * 🔴 THREE FINDINGS THIS FAMILY ADDED, each with a row that reddens at a number:
 *
 * 1. A SHARED CONTROL HAS MANY GROUNDS, AND THE SWEEP'S TABLE SHAPE COULD NOT SAY SO. Every
 *    earlier slice mapped one control to one ground. `LauncherButton .is-secondary` is placed on
 *    THREE surfaces — `LauncherHeader` (bg-1), `CommunityAccountCard` (bg-2) and the Projects
 *    folder-picker footer (bg-2) — and a fix is only correct if it clears on the WORST of them.
 *    Reading one call site would have measured a real number about the wrong question.
 *
 * 2. `border-control` IS THE DEFECT AT `.ChoiceItem`, for a reason session 63 met from the other
 *    side. POL-016 scopes the tone to bg-1/2/3; s63's `.CloseButton` was FILLED bg-4, whereas
 *    this pill paints no fill and is GROUNDED on bg-4 (`Modal .Root`). Same exclusion, reached
 *    through the ground rather than the fill — so "what step is it on?" has to be asked of both
 *    sides of the edge, not just the fill.
 *
 * 3. THIS IS THE FIRST FAMILY WHOSE STATES NEED BOTH DISCOVERY MECHANISMS IN ONE SPEC.
 *    `LauncherButton` nests its states with `&:hover`, as the code-editor family did;
 *    `ShareTemplateModal` writes them as TOP-LEVEL rules (`.ChoiceItem:hover`), as the bench did.
 *    A reader with only one of the two is silently blind to half the states in this file — see
 *    `statesOf` below, and the mutant that proves it.
 *
 * 🔴 THIS SPEC READS THE STYLESHEETS, NOT THE PALETTE. Asserting that a tone clears 3:1 would
 * pass on a build where this family never names it. Every row resolves the selector's own border,
 * its own fill and its grounds out of the `.scss` files, so a revert fails at a NUMBER.
 */

const CORE = path.resolve(__dirname, '../../../noodl-core-ui/src');
const LAUNCHER = `${CORE}/preview/launcher/Launcher`;

const FILES = {
  launcherButton: `${LAUNCHER}/components/LauncherButton/LauncherButton.module.scss`,
  header: `${LAUNCHER}/components/LauncherHeader/LauncherHeader.module.scss`,
  communityCard: `${LAUNCHER}/components/CommunityAccountCard/CommunityAccountCard.module.scss`,
  projects: `${LAUNCHER}/views/Projects.module.scss`,
  shareModal: `${LAUNCHER}/components/ShareTemplateModal/ShareTemplateModal.module.scss`,
  modalShell: `${CORE}/components/layout/Modal/Modal.module.scss`
} as const;

type FileKey = keyof typeof FILES;

/** ⚠️ Comments are stripped FIRST — the prose this sweep added names the very tokens the parser
 *  below looks for, and a regex that read a comment would report the wrong tone. Both files this
 *  session edited now carry a comment naming `border-control`, so this is not hypothetical. */
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
 * 🔴 SESSION 63'S FINDING — AND IN THIS FAMILY IT IS MEASURABLY INERT, WHICH IS WORTH SAYING.
 * Sessions 63 and 64 both filed that replacing this with `return body` makes a spec pass with a
 * revert applied, because in SCSS a rule body CONTAINS its nested `&:hover`, so a resting edge
 * resolves to the hover's tone. Session 64 raised that from advice to instruction.
 *
 * ⚠️ MEASURED HERE RATHER THAN INHERITED, and the instruction did not transfer: breaking this
 * function alone leaves all 22 rows GREEN, and breaking it WITH the `.is-secondary` revert
 * applied still kills the same six rows the revert kills on its own. The reason is specific and
 * checkable — NO nested state in either file declares `border-color`. `.is-secondary`'s nested
 * hover sets only `background`, and `.ChoiceItem`'s states are written as TOP-LEVEL rules, which
 * a nested-block stripper never sees.
 *
 * ✅ It is kept because it is CORRECT and because the very next `border-color` added inside a
 * nested state would need it — but this file's strength does not rest on it today, and a session
 * that assumed otherwise would be reporting a guard it had not tested. Check it per family.
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

/** ⚠️ Both spellings, again: `LauncherHeader`/`CommunityAccountCard` use `background:` while
 *  `Modal`/`Projects` use `background-color:`. Reading only one would make a ground look
 *  unpainted and silently measure the control against the wrong surface. */
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
 * Every state of a control, from BOTH places a state can be written.
 *
 * 🔴 FINDING 3. The code-editor and launcher specs walk nested `&` blocks; the bench spec matches
 * top-level rules that extend the selector. This family contains BOTH spellings — `.is-secondary`
 * nests `&:hover:not(:disabled)`, while `ShareTemplateModal` writes `.ChoiceItem:hover` and
 * `.ChoiceItem.is-selected` as top-level rules. Copying either existing helper alone leaves half
 * the states in this file unmeasured, and unmeasured states are precisely where this sweep's
 * regressions live.
 *
 * ⚠️ The suffix must begin with `:`, `.` or `[` so that `.ChoiceInput` and `.ChoiceLabel` are not
 * read as states of `.ChoiceItem`. A descendant rule like `.Choice.is-stack .ChoiceItem` is
 * deliberately NOT matched: it does not extend the selector, it re-contextualises it, and here it
 * changes only `border-radius`.
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

/**
 * The two CONTROLS in this slice, each with EVERY surface it is actually placed on.
 *
 * `selectors` is a list because a launcher button wears a base class AND a variant class
 * (`.Root.is-secondary`); the base contributes `border: 1px solid transparent`, which the variant
 * overrides. Merging them in cascade order is what a reader sees.
 *
 * ⚠️ DELIBERATELY ABSENT, and asserted as still-dividers at the bottom of this file:
 * `ShareTemplateModal`'s `.Preamble` and `.Result` (static REGIONS — a `bg-2` box on the modal's
 * `bg-4`, carried by their fill step), `Modal .Root` and the header/card region edges.
 *
 * 🧭 ALSO ABSENT, and NOT a token question: `.is-ghost` paints neither fill nor border and is
 * identified by its label text, and `.Root:disabled` drops `opacity` to 0.55 — a composited
 * value this instrument explicitly refuses to grade (see `themeTokens`' header). Both are noted
 * in the sweep doc rather than measured here, because a made-up number is worse than a gap.
 */
const CONTROLS: {
  name: string;
  file: FileKey;
  selectors: string[];
  grounds: { file: FileKey; selector: string; token: string; what: string }[];
}[] = [
  {
    name: 'LauncherButton .is-secondary (one SHARED button, three grounds)',
    file: 'launcherButton',
    selectors: ['.Root', '.is-secondary'],
    grounds: [
      { file: 'header', selector: '.Root', token: '--theme-color-bg-1', what: 'the launcher titlebar' },
      { file: 'communityCard', selector: '.Root', token: '--theme-color-bg-2', what: 'the community card' },
      {
        file: 'projects',
        selector: '.FolderPickerDialog',
        token: '--theme-color-bg-2',
        what: "the folder picker's footer"
      }
    ]
  },
  {
    name: 'ShareTemplateModal .ChoiceItem (grounded on bg-4, where border-control FAILS)',
    file: 'shareModal',
    selectors: ['.ChoiceItem'],
    grounds: [
      { file: 'modalShell', selector: '.Root', token: '--theme-color-bg-4', what: "the modal's own surface" }
    ]
  }
];

describe.each(['dark', 'light'] as ThemeName[])('the launcher button family in %s', (theme) => {
  describe.each(CONTROLS)('$name', ({ file, selectors, grounds }) => {
    const bodies = () => selectors.flatMap((s) => rules(file, s));

    /**
     * ✅ THE GROUND IS PINNED BY NAME, not just by number — session 64's finding, and it applies
     * with more force here. `Modal .Content` nests scrollbar rules painting `bg-3` and `bg-5`, so
     * a reader that grabbed a nested `background` would resolve `.ChoiceItem`'s ground to the
     * scrollbar track. `border-control` clears 3:1 on `bg-3` and fails on `bg-4`, so that misread
     * would have turned the central row of this file GREEN on the broken answer.
     */
    const groundToken = (ground: (typeof grounds)[number]) => {
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
    const fill = (ground: (typeof grounds)[number]) => lastOf(bodies(), fillOf) ?? groundToken(ground);

    it('its resting boundary clears 3:1 against its own fill', () => {
      const failures = grounds
        .map((ground) => {
          const ratio = tokenContrast(theme, border(), fill(ground));
          return ratio >= 3
            ? null
            : `${file} ${selectors.join('')}'s border is ${ratio.toFixed(2)}:1 on its own fill in ` +
                `${theme} — under 1.4.11's 3:1, so the control has no perceivable edge`;
        })
        .filter(Boolean);
      expect([...new Set(failures)]).toEqual([]);
    });

    it('🔴 its resting boundary clears 3:1 on EVERY surface it is placed on', () => {
      // FINDING 1. The edge has two sides, and this control has three backs. A tone chosen by
      // reading one call site is a real measurement of the wrong question.
      const failures = grounds
        .map((ground) => {
          const ratio = tokenContrast(theme, border(), groundToken(ground));
          return ratio >= 3 ? null : `${selectors.join('')} is ${ratio.toFixed(2)}:1 on ${ground.what} in ${theme}`;
        })
        .filter(Boolean);
      expect(failures).toEqual([]);
    });

    it('🔴 no state of it moves the edge below 3:1 on EITHER side', () => {
      // The row a find-and-replace over the sweep's inventory would not have, and the row that
      // catches session 64's third shape of the hover trap: a state that changes only the FILL
      // still inherits the resting border onto a step where that border may not clear.
      const restBorder = border();
      const failures: string[] = [];

      for (const ground of grounds) {
        for (const state of statesOf(file, selectors)) {
          if (!state.bodies.some((b) => declares(b, 'border-color') || paintsFill(b))) continue;
          const stateBorder = lastOf(state.bodies, (b) => tokenOf(b, 'border-color')) ?? restBorder;
          const stateFill = lastOf(state.bodies, fillOf) ?? fill(ground);

          const onFill = tokenContrast(theme, stateBorder, stateFill);
          const onGround = tokenContrast(theme, stateBorder, groundToken(ground));

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
          if (onFill < 3) failures.push(`${selectors.join('')}${state.selector} is ${onFill.toFixed(2)}:1 on its own fill`);
          if (onGround < 3) {
            failures.push(`${selectors.join('')}${state.selector} is ${onGround.toFixed(2)}:1 on ${ground.what}`);
          }
        }
      }

      expect([...new Set(failures)]).toEqual([]);
    });
  });

  it('🔴 BOTH state spellings are actually reachable — the reader is not half-blind', () => {
    // FINDING 3, asserted rather than trusted. If `statesOf` ever loses either mechanism, the
    // state rows above keep passing on the states they can still see, which is the quietest
    // possible failure. This row names one state of each spelling and insists it is found.
    const nested = statesOf('launcherButton', ['.Root', '.is-secondary']).map((s) => s.selector);
    expect(nested).toContain(':hover:not(:disabled)');

    const topLevel = statesOf('shareModal', ['.ChoiceItem']).map((s) => s.selector);
    expect(topLevel).toContain(':hover');
    expect(topLevel).toContain('.is-selected');

    // ...and the near-misses are NOT read as states of `.ChoiceItem`.
    expect(topLevel).not.toContain('Input');
    expect(topLevel).not.toContain('Label');
  });

  it('🔴 border-control CANNOT be used on .ChoiceItem, and this is why', () => {
    // FINDING 2. POL-016 scopes `border-control` to bg-1/2/3 and this pill is grounded on bg-4.
    // Anyone "tidying" it to match the rest of the sweep reddens the fill row above; this row is
    // here so that failure arrives with its reason attached rather than as a puzzle.
    // ⚠️ Deliberately a TRIPWIRE, not a permanent truth: if `border-control` is ever re-placed so
    // it clears bg-4, this row goes red on an IMPROVEMENT, and the right response is to reconsider
    // the tone here — which is exactly the conversation that red should start.
    const modalGround = lastOf(rules('modalShell', '.Root'), fillOf)!;
    const ratio = tokenContrast(theme, '--theme-color-border-control', modalGround);
    const verdict =
      ratio < 3
        ? 'border-control still fails on this ground'
        : `border-control now measures ${ratio.toFixed(2)}:1 on ${modalGround} in ${theme} — re-read the ` +
          `.ChoiceItem comment, the reason it uses fg-default-shy may have expired`;
    expect(verdict).toBe('border-control still fails on this ground');
  });

  it('🔴 the selected pill is still distinguishable from the unselected one', () => {
    // ⚠️ Raising the RESTING edge of a radio pill is not free: this file's own note says the
    // SELECTED state is carried by the border rather than a fill, so a stronger resting tone eats
    // into the signal it contrasts against. The selection survives on three separate channels —
    // hue, a doubled weight via `box-shadow`, and the label colour — but the border pair must not
    // collapse to the same tone, which is what this row refuses.
    const resting = tokenOf(rule('shareModal', '.ChoiceItem'), 'border');
    const selected = tokenOf(rule('shareModal', '.ChoiceItem.is-selected'), 'border-color');
    expect(resting).not.toBe(selected);
    expect(declares(rule('shareModal', '.ChoiceItem.is-selected'), 'box-shadow')).toBe(true);
    expect(declares(rule('shareModal', '.ChoiceItem.is-selected'), 'color')).toBe(true);

    // And the selected tone itself is still a real edge on the modal.
    const ratio = tokenContrast(theme, selected!, lastOf(rules('modalShell', '.Root'), fillOf)!);
    expect(ratio >= 3 ? 'passes' : `the selected pill is ${ratio.toFixed(2)}:1 on the modal`).toBe('passes');
  });

  it('🔴 the divider tones are still INVISIBLE on the surfaces this family uses', () => {
    // The negative control, and the row that refuses the over-fix: a sweep that raised the shared
    // token instead of the call sites would pass every row above and redden this one.
    //
    // ⚠️ THE BOUND IS A PROPERTY OF THE GROUND — sessions 61, 62 and 64 each filed this, and this
    // is the FIFTH distinct set of bounds in the sweep. `border-strong` is the token this slice
    // moved off, so it is the one held down here: 1.74 dark on bg-1, 1.49 on bg-2, 1.10 on bg-4.
    const grounds: { rule: () => string; bound: number; what: string }[] = [
      { rule: () => rule('header', '.Root'), bound: 1.8, what: 'the titlebar (bg-1)' },
      { rule: () => rule('communityCard', '.Root'), bound: 1.5, what: 'the community card (bg-2)' },
      { rule: () => rule('modalShell', '.Root'), bound: 1.2, what: 'the modal (bg-4)' }
    ];

    const failures = grounds
      .map(({ rule: r, bound, what }) => {
        const ratio = tokenContrast(theme, '--theme-color-border-strong', fillOf(r())!);
        return ratio < bound ? null : `border-strong is ${ratio.toFixed(2)}:1 on ${what} in ${theme}, over ${bound}`;
      })
      .filter(Boolean);

    expect(failures).toEqual([]);
  });

  it('🔴 the REGION edges were deliberately left alone', () => {
    // The over-fix mutant's target: a blanket find-and-replace over these two files would raise
    // these too, and each is a boundary between REGIONS rather than something a reader must
    // identify as operable. `.Preamble` and `.Result` are `bg-2` boxes on the modal's `bg-4` —
    // carried by their fill step, with the border only tidying the corner.
    const regions: [FileKey, string, string, string][] = [
      ['shareModal', '.Preamble', 'border', '--theme-color-border-strong'],
      ['shareModal', '.Result', 'border', '--theme-color-border-strong'],
      ['modalShell', '.Root', 'border', '--theme-color-border-subtle'],
      ['header', '.Root', 'border-bottom', '--theme-color-border-default'],
      ['communityCard', '.Root', 'border', '--theme-color-border-default'],
      ['projects', '.FolderPickerDialog', 'border', '--theme-color-border-default']
    ];

    for (const [file, selector, property, expected] of regions) {
      expect(`${file} ${selector}: ${tokenOf(rule(file, selector), property)}`).toBe(`${file} ${selector}: ${expected}`);
    }
  });
});
