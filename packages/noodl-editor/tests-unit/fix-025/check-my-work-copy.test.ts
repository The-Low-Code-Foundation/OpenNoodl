/**
 * FIX-025 — the "Check my work" control says what it is looking for.
 *
 * Richard: *"'Check my work' button doesn't make sense, it seems to trigger all the signals in
 * the app but it's not clear when or why you should actually click it."*
 */
import { describeCondition, describeStepCheck } from '../../src/editor/src/views/lessons/lessonconditioncopy';

describe('describeStepCheck', () => {
  it('🔴 names the node the shipped lesson actually asks for', () => {
    // The exact condition from the installed "State on a page" lesson's last step.
    expect(describeStepCheck([{ node: '/#__page__/Home:#Caption', hasType: 'Text', path: '/#__page__/Home:#Caption', hastype: 'Text' }]))
      .toBe('Looking for a Text called “Caption” on Home.');
  });

  it('returns null when the step has nothing to grade — the control is then not drawn at all', () => {
    expect(describeStepCheck([])).toBeNull();
    expect(describeStepCheck(undefined)).toBeNull();
  });

  it('joins two conditions readably', () => {
    const line = describeStepCheck([
      { path: '/#__page__/Home:%Text', hastype: 'Text' },
      { path: '/#__page__/Home:%Variable2', hastype: 'Variable2' }
    ]);
    expect(line).toBe('Looking for a Text on Home and a Variable2 on Home.');
  });

  it('counts the tail rather than printing a paragraph', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ path: `/App:#N${i}`, hastype: 'Text' }));
    expect(describeStepCheck(many)).toMatch(/and 3 more\.$/);
  });

  it('🔴 an unrecognised verb degrades to a generic line, never to JSON at a beginner', () => {
    expect(describeCondition({ somethingNobodyHasWrittenCopyFor: true })).toBeNull();
    expect(describeStepCheck([{ somethingNobodyHasWrittenCopyFor: true }])).toBe(
      'Looking for the changes this step asks for.'
    );
  });

  it('describes a connection between two named nodes', () => {
    expect(
      describeCondition({ from: '/App:#Button', to: '/App:#Text', hasconnection: 'click,set' })
    ).toBe('Button wired to Text (click → set)');
  });
});

/**
 * P79 J4 — a condition named the parameters it grades but not the values they must equal.
 *
 * Measured by the session-8 lesson-runner drive on `it-breaks-on-a-phone` step 1, which rendered
 *
 *   "Looking for a Group called “Board” on Home, “Board” with sizeMode, maxWidth set and
 *    paddingLeft and paddingRight set on “Board”."
 *
 * The step needs `sizeMode: contentHeight` and `maxWidth: 560px`, and said neither. The
 * single-key arm had said its value all along, so the sentence got LESS useful the more the
 * step asked for — which is why the multi-key case is the one with a row here.
 */
describe('P79 J4 — a graded value is named, not just its parameter', () => {
  // The exact condition from the shipped `it-breaks-on-a-phone` step 1, in compiled form.
  const BOARD = '/Pages/Home:#Home:#Page shell:#Board';

  it('🔴 names every expected value, not just the parameter names', () => {
    expect(
      describeCondition({
        path: BOARD,
        paramseq: { sizeMode: 'contentHeight', maxWidth: { value: 560, unit: 'px' } }
      })
    ).toBe('“Board” with sizeMode set to "contentHeight" and maxWidth set to 560px');
  });

  it('renders a dimension the way the property panel does, not as a JSON blob', () => {
    expect(describeCondition({ path: BOARD, paramseq: { maxWidth: { value: 560, unit: 'px' } } })).toBe(
      '“Board” with maxWidth set to 560px'
    );
  });

  it('joins three the same way the condition list does', () => {
    expect(describeCondition({ path: BOARD, paramseq: { a: 1, b: 2, c: 3 } })).toBe(
      '“Board” with a set to 1, b set to 2 and c set to 3'
    );
  });

  it('still names an object that is not a dimension rather than dropping it', () => {
    expect(describeCondition({ path: BOARD, paramseq: { style: { weight: 700 } } })).toBe(
      '“Board” with style set to {"weight":700}'
    );
  });

  it('renders the whole step 1 sentence a learner reads', () => {
    expect(
      describeStepCheck([
        { path: BOARD, hastype: 'Group' },
        { path: BOARD, paramseq: { sizeMode: 'contentHeight', maxWidth: { value: 560, unit: 'px' } } },
        { path: BOARD, hasparams: 'paddingLeft,paddingRight' }
      ])
    ).toBe(
      'Looking for a Group called “Board” on Home, ' +
        '“Board” with sizeMode set to "contentHeight" and maxWidth set to 560px and ' +
        'paddingLeft and paddingRight set on “Board”.'
    );
  });
});

/**
 * P79 D2 — the "Looking for..." line showed the learner a raw internal type id.
 *
 * Filed from source against lesson 2 and first WITNESSED by the session-8 drive, which read
 * `poke-it` step 1 as *"Looking for a net.noodl.controls.button called “Poke” on Home"*.
 *
 * 🔴 The register recorded this as the dotted ids only. It is wider than that: eight of the
 * types the shipped lessons grade do not read as their own name, and three of them are plain
 * words that are simply the WRONG word — `Circle` is **Shape**, `Timer` is **Delay** (this
 * phase's E4 and H3), `Logic Builder` is **Visual Function**. A learner hunting the picker for
 * a "Timer" does not find one. That is why the fix resolves through the picker's own label
 * function rather than tidying up the string.
 */
describe('P79 D2 — a node is called what the editor calls it', () => {
  /** Stands in for `NodeLibrary` + `getItemLabel`, with the catalog's real answers. */
  const library: Record<string, string> = {
    'net.noodl.controls.button': 'Button',
    'net.noodl.visual.columns': 'Columns',
    'net.noodl.animatetovalue': 'Animate To Value',
    Circle: 'Shape',
    Timer: 'Delay',
    'Logic Builder': 'Visual Function',
    DbCollection2: 'Query Records',
    NewDbModelProperties: 'Create Record',
    Text: 'Text',
    Group: 'Group'
  };
  const resolve = (type: string) => library[type];

  it('🔴 renders the sentence the drive read, with the name the picker shows', () => {
    expect(
      describeStepCheck([{ path: '/#__page__/Home:#Poke', hastype: 'net.noodl.controls.button' }], resolve)
    ).toBe('Looking for a Button called “Poke” on Home.');
  });

  it.each([
    ['Circle', 'Shape'],
    ['Timer', 'Delay'],
    ['Logic Builder', 'Visual Function'],
    ['DbCollection2', 'Query Records'],
    ['NewDbModelProperties', 'Create Record'],
    ['net.noodl.visual.columns', 'Columns'],
    ['net.noodl.animatetovalue', 'Animate To Value']
  ])('%s is named %s', (type, shown) => {
    expect(describeCondition({ path: '/App:#N', hastype: type }, resolve)).toBe(
      `a ${shown} called “N” on App`
    );
  });

  it('leaves a type that is already its own name alone', () => {
    expect(describeCondition({ path: '/App:#Caption', hastype: 'Text' }, resolve)).toBe(
      'a Text called “Caption” on App'
    );
  });

  it('🔴 degrades rather than throwing when the library has not loaded', () => {
    // `getNodeTypeWithName` returns undefined before load, so the resolver returns undefined.
    const unloaded = () => undefined;
    expect(describeCondition({ path: '/App:#Poke', hastype: 'net.noodl.controls.button' }, unloaded)).toBe(
      'a Button called “Poke” on App'
    );
    // And with no resolver at all — the shape every existing caller and spec uses.
    expect(describeCondition({ path: '/App:#Poke', hastype: 'net.noodl.controls.button' })).toBe(
      'a Button called “Poke” on App'
    );
  });

  it('⚠️ the fallback does not invent a name it cannot know', () => {
    // Documented degradation: an undotted id is left alone rather than guessed at, and a
    // squashed dotted leaf is not re-spaced. Both are wrong-but-honest without a library.
    expect(describeCondition({ path: '/App:#N', hastype: 'Timer' })).toBe('a Timer called “N” on App');
    expect(describeCondition({ path: '/App:#N', hastype: 'net.noodl.animatetovalue' })).toBe(
      'a Animatetovalue called “N” on App'
    );
  });
});

/**
 * P79 L4 — a graded PORT is called what the property panel calls it.
 *
 * `snacks` step 2's refusal read *"csv set on “Pantry”"*. `csv` is the port's name; the panel
 * says **CSV**. D2 fixed the TYPE in this sentence and left the port, so the learner was still
 * being shown a word that appears nowhere in the editor.
 */
describe('P79 L4 — a port is called what the panel calls it', () => {
  const PANTRY = '/Pages/Home:#Pantry';
  const MENU = '/Pages/Home:#Home:#Page shell:#Board:#Menu';
  // The library's answer, stubbed: only the ports the panel really renames.
  const panel = (type: string, port: string): string | undefined => {
    const names: Record<string, Record<string, string>> = {
      'Static Data': { csv: 'CSV', items: 'Items' },
      'For Each': { items: 'Items', template: 'Template' }
    };
    return names[type]?.[port];
  };

  it('🔴 hasParams shows the panel name when a sibling hasType says what the node is', () => {
    expect(
      describeStepCheck([{ path: PANTRY, hastype: 'Static Data' }, { path: PANTRY, hasparams: 'csv' }], undefined, panel)
    ).toBe('Looking for a Static Data called “Pantry” on Home and CSV set on “Pantry”.');
  });

  it('paramsEqual names the port the same way, and keeps naming the value (J4)', () => {
    expect(
      describeStepCheck(
        [{ path: MENU, hastype: 'For Each' }, { path: MENU, paramseq: { template: '/Snack' } }],
        undefined,
        panel
      )
    ).toBe('Looking for a For Each called “Menu” on Home and “Menu” with Template set to "/Snack".');
  });

  it('a connection resolves each end against ITS OWN node type', () => {
    expect(
      describeStepCheck(
        [
          { path: PANTRY, hastype: 'Static Data' },
          { path: MENU, hastype: 'For Each' },
          { from: PANTRY, to: MENU, hasconnection: 'items,items' }
        ],
        undefined,
        panel
      )
    ).toBe('Looking for a Static Data called “Pantry” on Home, a For Each called “Menu” on Home and Pantry wired to Menu (Items → Items).');
  });

  it('falls back to the port name without a resolver, without a sibling hasType, or for a port the library does not know', () => {
    // The control: the same conditions, the old sentence. Without this, the assertions above
    // would pass against a resolver that is never consulted.
    expect(describeStepCheck([{ path: PANTRY, hastype: 'Static Data' }, { path: PANTRY, hasparams: 'csv' }])).toBe(
      'Looking for a Static Data called “Pantry” on Home and csv set on “Pantry”.'
    );
    expect(describeStepCheck([{ path: PANTRY, hasparams: 'csv' }], undefined, panel)).toBe(
      'Looking for csv set on “Pantry”.'
    );
    expect(
      describeStepCheck([{ path: PANTRY, hastype: 'Static Data' }, { path: PANTRY, hasparams: 'wibble' }], undefined, panel)
    ).toBe('Looking for a Static Data called “Pantry” on Home and wibble set on “Pantry”.');
  });

  it('describeCondition alone still answers with the raw port — the join is the step’s, not the condition’s', () => {
    expect(describeCondition({ path: PANTRY, hasparams: 'csv' })).toBe('csv set on “Pantry”');
  });
});
