/**
 * VFN-007 — the shelf that does not say which.
 *
 * > *"When you save a block, to the project or to your backpack, clicking the backpack option
 * > doesn't check the checkbox, even though afterwards it correctly saves to the backpack."*
 *
 * ## 🔴 The mechanism, measured live 2026-08-13, and it is not contrast
 *
 * `BaseDialog` renders `{children}` **twice** — once into a zero-height `MeasuringContainer` it
 * measures the body with, once into the visible `ChildContainer`. Every dialog body is therefore
 * two React instances in one document. A native radio group is scoped to the **document** by
 * `name`, so two options were four radios in one group and the browser kept exactly one checked:
 *
 * ```
 * BEFORE  [2] visible   This project  checked=TRUE
 * AFTER   [1] MEASURING My backpack   checked=TRUE   <- the check went to the invisible copy
 *         [3] visible   My backpack   checked=false  <- and never arrived here
 * ```
 *
 * After the click no visible radio was checked at all, while React's state was correctly
 * `'user'` — which is why the report says the save still goes to the backpack.
 *
 * ## What a spec can and cannot say about that
 *
 * It cannot re-run the drive. What it can hold is the property that makes the class impossible:
 * **the picker does not participate in a native radio group**, and its indicator is on tokens
 * whose contrast is decided in the source rather than by Chromium's light-mode form defaults.
 *
 * 🔴 Both of those are *absences*, and a suite of absences is indistinguishable from an
 * instrument that measured nothing. So every parser and every measurement below is also run over
 * the picker **exactly as it was when the report was written**, and is required to see the
 * defect there. Those are the tests named NEGATIVE CONTROL, and they are the reason to believe
 * the rest.
 */
import * as fs from 'fs';
import * as path from 'path';

import { DEFAULT_SCOPE } from '../../src/editor/src/views/BlocklyEditor/MyBlocksSave';
import { shelfAfterKey, shelfOption, SHELF_OPTIONS } from '../../src/editor/src/views/BlocklyEditor/myblocks/shelfChoice';
import { InMemoryShelf, MyBlocksStore, SCOPES } from '../../src/editor/src/views/BlocklyEditor/myblocks/store';
import { tokenContrast } from '../support/themeTokens';

const DIALOG_TSX = path.join(__dirname, '../../src/editor/src/views/BlocklyEditor/MyBlocksSaveDialog.tsx');
const DIALOG_SCSS = path.join(
  __dirname,
  '../../src/editor/src/views/BlocklyEditor/MyBlocksSaveDialog.module.scss'
);

/**
 * The source with every comment removed.
 *
 * 🔴 Not tidiness — correctness. This file's own subject is the string `type="radio"`, and the
 * component and stylesheet both explain at length why they no longer contain one. A parser that
 * read comments would find the word it forbids in the sentence forbidding it, pass or fail for
 * the wrong reason, and keep doing so forever. The repo has a register entry for exactly this:
 * *a spec can contain the sentence it forbids.*
 */
function withoutComments(source: string): string {
  return (
    source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // `//` only when it is not a URL scheme.
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  );
}

/** The balanced region starting at the first `open` at or after `from`. */
function balanced(source: string, from: number, open: string, close: string): string {
  const start = source.indexOf(open, from);
  if (start === -1) return '';

  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === open) depth++;
    else if (source[i] === close) {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return '';
}

/** The JSX one option row renders — the body of the `SHELF_OPTIONS.map(...)` callback. */
function optionRowSource(source: string): string {
  const map = source.indexOf('SHELF_OPTIONS.map(');
  if (map === -1) return '';
  return balanced(source, map, '(', ')');
}

const dialog = withoutComments(fs.readFileSync(DIALOG_TSX, 'utf8'));
const stylesheet = withoutComments(fs.readFileSync(DIALOG_SCSS, 'utf8'));

/**
 * The picker as it was on 2026-08-13 — copied from `MyBlocksSaveDialog.tsx` before this task,
 * and the thing every parser below has to be able to convict.
 */
const PICKER_BEFORE = `
          <fieldset className={css.Shelves}>
            <legend className={css.ShelvesLegend}>
              <Text size={TextSize.Small} textType={TextType.Shy}>
                Save it in
              </Text>
            </legend>
            {SHELF_OPTIONS.map((option) => (
              <label key={option.value} className={css.Shelf}>
                <input
                  type="radio"
                  name="myblocks-shelf"
                  checked={scope === option.value}
                  onChange={() => setScope(option.value)}
                />
                <span>
                  <Text size={TextSize.Small}>{option.label}</Text>
                  <Text size={TextSize.Small} textType={TextType.Shy}>
                    {option.note}
                  </Text>
                </span>
              </label>
            ))}
          </fieldset>
`;

describe('VFN-007 — the shelf picker is not a native radio group', () => {
  it('🔴 renders no radio input at all, and no radio-group name to be shared', () => {
    // The whole class, not the instance: with no `<input type="radio">` there is no
    // document-scoped group for `BaseDialog`'s second render of the body to join.
    expect(dialog).not.toContain('type="radio"');
    expect(dialog).not.toContain('myblocks-shelf');
    expect(dialog).not.toMatch(/<input\b/);
  });

  it('is an ARIA radiogroup instead, so the control still announces itself as one', () => {
    expect(dialog).toContain('role="radiogroup"');

    const row = optionRowSource(dialog);
    expect(row).toContain('role="radio"');
    expect(row).toContain('aria-checked');
  });

  it('🔴 the selected state is React state and nothing else', () => {
    // The bug was never in React — `scope` was correct throughout. It was that a second
    // authority (the browser's radio group) also had an opinion, and that authority won the
    // paint. `aria-checked` and the chosen class are both computed from `scope`.
    const row = optionRowSource(dialog);
    expect(row).toMatch(/const isChosen = scope === option\.value/);
    expect(row).toContain('aria-checked={isChosen}');
    expect(row).toMatch(/isChosen && css\['is-chosen'\]/);
  });

  it('clicking anywhere in the row selects it, including the consequence note', () => {
    // Criterion 3. The row *is* the control, so the note — which is the entire reason this is
    // not a `<select>` — is inside the click target rather than beside it.
    const row = optionRowSource(dialog);

    const handler = row.indexOf('onClick');
    const label = row.indexOf('{option.label}');
    const note = row.indexOf('{option.note}');

    expect(handler).toBeGreaterThan(-1);
    expect(label).toBeGreaterThan(handler);
    expect(note).toBeGreaterThan(handler);
    expect(row).toContain('chooseShelf(option.value');
  });

  it('is reachable by Tab and shows focus, with one tab stop for the group', () => {
    // Criterion 4, the half that is decided in the source: a roving tabindex (the chosen row is
    // the tab stop, the others are -1) and a focus style that is not `outline: none`.
    const row = optionRowSource(dialog);
    expect(row).toContain('tabIndex={isChosen ? 0 : -1}');
    expect(row).toContain('onKeyDown');

    expect(stylesheet).toMatch(/:focus[^{]*\{[^}]*outline:\s*2px solid var\(--theme-color-focus-ring\)/);
    expect(stylesheet).not.toMatch(/outline:\s*none/);
  });

  /**
   * 🔴 NEGATIVE CONTROL for every assertion above.
   *
   * Each of them is of the form "this string is absent" or "this string is present", and a
   * parser pointed at the wrong region would satisfy all of them by finding nothing. So run the
   * *same functions* over the picker exactly as it was when the report was written, and require
   * them to convict it.
   */
  it('NEGATIVE CONTROL — the same parser convicts the picker as it was', () => {
    const before = withoutComments(PICKER_BEFORE);

    expect(before).toContain('type="radio"');
    expect(before).toContain('name="myblocks-shelf"');
    expect(before).not.toContain('role="radiogroup"');

    const row = optionRowSource(before);
    // The parser really did find the row — it is not returning an empty string and passing by
    // accident, which is the failure mode this control exists to rule out.
    expect(row.length).toBeGreaterThan(0);
    expect(row).toContain('{option.note}');
    expect(row).not.toContain('role="radio"');
    expect(row).not.toContain('aria-checked');
    expect(row).not.toContain('tabIndex');
  });
});

describe('VFN-007 — the indicator is visible at a glance, and the number says so', () => {
  /**
   * Criterion 2: *"The selected shelf is visible at a glance, in both themes, and its indicator
   * measures ≥ 3:1 against its own surround (the non-text contrast floor)."*
   *
   * The chosen row paints its ring and dot in `--theme-color-primary` on a `--theme-color-bg-3`
   * card; an unchosen row paints its empty ring in `--theme-color-border-control` on
   * `--theme-color-bg-2`. Those are the pairs the stylesheet actually names, and the assertion
   * below checks that it still names them — a measurement of tokens the rule stopped using would
   * be a measurement of nothing.
   */
  const FLOOR = 3;

  it('the stylesheet paints the indicator with the tokens being measured', () => {
    expect(stylesheet).toMatch(/\.Shelf\.is-chosen \.ShelfMark[\s\S]*?--theme-color-primary/);
    expect(stylesheet).toMatch(/\.ShelfMark \{[\s\S]*?--theme-color-border-control/);
    expect(stylesheet).toMatch(/\.Shelf \{[\s\S]*?--theme-color-bg-2/);
    expect(stylesheet).toMatch(/\.Shelf\.is-chosen \{[\s\S]*?--theme-color-bg-3/);
  });

  for (const theme of ['dark', 'light'] as const) {
    it(`the chosen indicator clears ${FLOOR}:1 on its own card — ${theme}`, () => {
      const ratio = tokenContrast(theme, '--theme-color-primary', '--theme-color-bg-3');
      expect(ratio).toBeGreaterThanOrEqual(FLOOR);
    });

    it(`the empty ring clears ${FLOOR}:1 on its own card — ${theme}`, () => {
      // The unchosen state has to be legible too, or "which one is not selected" is a guess.
      const ratio = tokenContrast(theme, '--theme-color-border-control', '--theme-color-bg-2');
      expect(ratio).toBeGreaterThanOrEqual(FLOOR);
    });

    it(`the chosen row's border clears ${FLOOR}:1 against the card beside it — ${theme}`, () => {
      const ratio = tokenContrast(theme, '--theme-color-primary', '--theme-color-bg-2');
      expect(ratio).toBeGreaterThanOrEqual(FLOOR);
    });
  }

  /**
   * 🔴 NEGATIVE CONTROL for the measurement itself.
   *
   * Four "≥ 3" assertions are exactly what a resolver that silently returned the same colour
   * twice would produce — every pair would score 1.00 and fail, or, worse, a resolver that
   * returned white for anything unknown would score everything identically and pass. So measure
   * a pair that is *known* to be below the floor and require the instrument to say so.
   *
   * `--theme-color-border-default` on `--theme-color-bg-1` is the card outline used everywhere in
   * this dialog: 1.25:1 dark, 1.27:1 light. It is *correct* that it is below 3 — a decorative
   * card edge is not an indicator and does not owe the floor. It is here because it proves the
   * instrument can return a number below 3, which is the only thing the four tests above cannot
   * prove about themselves.
   */
  it('NEGATIVE CONTROL — the same instrument scores a known-low pair below the floor', () => {
    for (const theme of ['dark', 'light'] as const) {
      const ratio = tokenContrast(theme, '--theme-color-border-default', '--theme-color-bg-1');
      expect(ratio).toBeLessThan(FLOOR);
      // Not zero, not one, not NaN: a real reading of two different colours.
      expect(ratio).toBeGreaterThan(1);
    }
  });

  it('NEGATIVE CONTROL — a token that does not exist is an error, not a score', () => {
    // A gate that reads a field its source lacks is a gate that passes forever. Renaming
    // `--theme-color-primary` must break this suite loudly rather than quietly score 0.
    expect(() => tokenContrast('dark', '--theme-color-not-a-token', '--theme-color-bg-1')).toThrow(
      'does not resolve'
    );
  });
});

describe('VFN-007 — the choice the picker offers, and where it lands', () => {
  it('offers exactly the shelves the store has, and no others', () => {
    expect(SHELF_OPTIONS.map((option) => option.value)).toEqual([...SCOPES]);
  });

  it('⚠️ still defaults to the project — the cheaper mistake is the default', () => {
    // A block saved to the project by accident is one extra entry in `project.json`; a block
    // saved to the backpack by accident is one that works until a collaborator opens the
    // project. Nothing in VFN-007 disturbs that argument.
    expect(DEFAULT_SCOPE).toBe('project');
    expect(SHELF_OPTIONS[0].value).toBe('project');
    expect(shelfOption(DEFAULT_SCOPE)).toBeDefined();
  });

  it('🔴 keeps each option’s consequence beside it, which is why this is not a select', () => {
    for (const option of SHELF_OPTIONS) {
      expect(option.note.length).toBeGreaterThan(0);
      expect(option.label.length).toBeGreaterThan(0);
    }
    expect(shelfOption('project')!.note).toContain('travels with the project');
    expect(shelfOption('user')!.note).toContain('every project you open');
  });

  it('criterion 5 — a save with either option lands on that shelf and only that shelf', () => {
    // Asserted against `scopeOf`, not against the toast: the toast is what the dialog *says*
    // happened, and this feature has already shipped a message that outlived its own write.
    for (const option of SHELF_OPTIONS) {
      const store = new MyBlocksStore({ project: new InMemoryShelf('project'), user: new InMemoryShelf('user') });
      const definition = store.save({
        name: 'Half',
        body: { blocks: { languageVersion: 0, blocks: [{ type: 'math_number', fields: { NUM: 2 } }] } },
        scope: option.value
      });

      expect(store.scopeOf(definition.id)).toBe(option.value);
      const other = option.value === 'project' ? 'user' : 'project';
      expect(store.list(other)).toEqual([]);
    }
  });
});

describe('VFN-007 — the keys that move between the shelves', () => {
  it('arrows move the choice and wrap, in both orientations', () => {
    // Criterion 4. The ARIA radiogroup pattern moves selection with focus, and the group is a
    // column on screen and a list in the DOM, so both axes have to work.
    expect(shelfAfterKey('ArrowDown', 'project')).toBe('user');
    expect(shelfAfterKey('ArrowRight', 'project')).toBe('user');
    expect(shelfAfterKey('ArrowDown', 'user')).toBe('project');

    expect(shelfAfterKey('ArrowUp', 'user')).toBe('project');
    expect(shelfAfterKey('ArrowLeft', 'user')).toBe('project');
    expect(shelfAfterKey('ArrowUp', 'project')).toBe('user');
  });

  it('Space and Enter re-select what is focused rather than doing nothing', () => {
    expect(shelfAfterKey(' ', 'user')).toBe('user');
    expect(shelfAfterKey('Enter', 'project')).toBe('project');
  });

  it('🔴 answers null for every other key, so Tab and Escape still leave the dialog', () => {
    // The caller reads `null` as "not mine, do not preventDefault". A picker that claimed every
    // key would trap the builder inside it — a control that takes a decision and will not give
    // it back, which is the same shape of failure as one that takes a decision and shows
    // nothing.
    for (const key of ['Tab', 'Escape', 'a', 'Home', 'PageDown', 'Backspace']) {
      expect(shelfAfterKey(key, 'project')).toBeNull();
    }
  });

  it('survives a scope the picker does not offer', () => {
    // `scope` comes from `request.defaultScope`, which comes from the store's type — but a
    // future third shelf added to the store and not to the picker must not make the arrows throw.
    expect(shelfAfterKey('ArrowDown', 'nowhere' as never)).toBe('user');
  });
});
