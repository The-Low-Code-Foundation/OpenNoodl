/**
 * REL-014 — the value the field destroys.
 *
 * > *"When you accidentally click them in the wrong way and delete the var value, it goes back to
 * > 'auto' and you can't get the var thing back."* — Richard, 2026-09-04
 *
 * `ElementConfigRegistry.applyDefaults` writes `width: 'var(--space-4)'` onto every new Checkbox
 * and `fontSize: 'var(--text-base)'` onto every new Text. The dimension and number-with-units
 * fields then ran that string through `parseFloat`, got `NaN`, and called
 * `setParameter(name, undefined)` — which is the call that **clears** a parameter. So the product
 * deleted a value the product itself had authored, on contact, and typing it back deleted it
 * again.
 *
 * ## What this file grades, and what it deliberately cannot
 *
 * Every assertion below goes through the **`onCommit` prop the row hands to `NumberUnitInput`** —
 * the same callback the real input calls from `commitIfChanged` on blur and on Enter — rather than
 * through the private `updateValue` behind it. That is the wiring, not a re-implementation of it.
 *
 * `NumberUnitInput` itself cannot be loaded by this runner: it reaches
 * `PropertyPanelSelectInput`, which imports an `.svg`, and there is no loader for one here. So it
 * is mocked, the element it would have become is captured, and what is asserted is the props the
 * row computed — the stored parameter, the string the field will display, and the element key.
 * ⚠️ **The one thing that is therefore NOT graded here is the input's own local-state behaviour**:
 * that `commitIfChanged` skips a blur with no change, and that a remount re-seeds the text from
 * the `value` prop. Both are read off the component and named in the row's findings; the drive
 * owes the confirmation.
 *
 * 🔴 **`../utils` is mocked for resolution, not for behaviour.** It imports
 * `@noodl-contexts/NodeGraphContext`, an alias this runner does not map. `getEditType` is
 * restated below **verbatim** from the real file so the port-type resolution under test is the
 * shipped one.
 */

jest.mock('../../src/editor/src/views/panels/propertyeditor/utils', () => ({
  // Verbatim from `views/panels/propertyeditor/utils.ts`.
  getEditType: (p: { type?: { editAsType?: unknown } }) => (p.type?.editAsType ? p.type.editAsType : p.type),
  // Only reached when `isConnected` is true, which no case here is.
  getConnectionSourceLabel: () => undefined,
  getConnectionSourceNavigate: () => undefined
}));

jest.mock('../../src/editor/src/views/panels/propertyeditor/components/NumberUnitInput', () => ({
  NumberUnitInput: function NumberUnitInput() {
    return null;
  }
}));

import { Dimension } from '../../src/editor/src/views/panels/propertyeditor/DataTypes/Dimension';
import { NumberWithUnits } from '../../src/editor/src/views/panels/propertyeditor/DataTypes/NumberWithUnits';

const TOKEN = 'var(--space-4)';

/** A `dimension`/`number` port with a unit choice, as the shipped catalog declares Width. */
const PORT = {
  name: 'width',
  displayName: 'Width',
  group: 'Dimensions',
  type: { name: 'dimension', units: ['%', 'px', 'vw', 'vh'], defaultUnit: '%' }
};

interface Write {
  name: string;
  value: unknown;
}

/** The node model, reduced to what a row actually calls on it. */
function aModel(parameters: Record<string, unknown>) {
  const writes: Write[] = [];
  return {
    parameters,
    writes,
    getParameter(name: string) {
      return parameters[name];
    },
    hasParameter() {
      return true;
    },
    isPortConnected() {
      return false;
    },
    setParameter(name: string, value: unknown) {
      writes.push({ name, value });
      if (value === undefined) delete parameters[name];
      else parameters[name] = value;
    }
  };
}

/** `Ports.setParameter`, restated: the row's `parent`, which hard-codes the undo entry. */
function aParent(model: ReturnType<typeof aModel>) {
  return {
    model,
    setParameter(name: string, value: unknown) {
      model.setParameter(name, value);
    }
  };
}

interface Captured {
  key: unknown;
  props: {
    value: string;
    unit: string;
    isChanged: boolean;
    onCommit: (text: string) => void;
    onUnitChange: (unit: string, currentText: string) => void;
    onReset?: () => void;
  };
}

type RowClass = { fromPort(args: unknown): unknown };

const ROWS: [string, RowClass][] = [
  ['Dimension', Dimension],
  ['NumberWithUnits', NumberWithUnits]
];

/**
 * Build one row over a model holding `stored`, and capture what it renders.
 *
 * The React root is replaced rather than created: `render()` needs a `document`, this runner has
 * none, and the root is only ever a sink for the element. Everything under test is computed
 * before `render` is called.
 */
function aField(RowType: RowClass, stored?: unknown) {
  const parameters: Record<string, unknown> = {};
  if (stored !== undefined) parameters[PORT.name] = stored;

  const model = aModel(parameters);
  const parent = aParent(model);

  const view = RowType.fromPort({ port: PORT, parent }) as {
    root: unknown;
    renderReact(): void;
  };

  const frames: Captured[] = [];
  view.root = {
    render: (element: { key: unknown; props: Captured['props'] }) => {
      frames.push({ key: element.key, props: element.props });
    },
    unmount: () => undefined
  };
  view.renderReact();

  return {
    parameters,
    writes: model.writes,
    frames,
    /** What the field shows and is wired to right now. */
    latest: () => frames[frames.length - 1],
    /** The blur/Enter path, exactly as `NumberUnitInput.commitIfChanged` calls it. */
    commit: (text: string) => frames[frames.length - 1].props.onCommit(text),
    stored: () => parameters[PORT.name]
  };
}

describe.each(ROWS)('REL-014 — %s', (_name, RowType) => {
  // ------------------------------------------------------------------ AC1
  describe('AC1 — a token typed into the field is kept verbatim', () => {
    it('is what the model holds afterwards', () => {
      const field = aField(RowType);
      field.commit(TOKEN);
      // 🔴 The one that reddens on the unfixed code: `parseFloat` gave NaN and the row wrote
      // `undefined`, so this key was deleted rather than set.
      expect(field.stored()).toBe(TOKEN);
    });

    it('and it is the string the field displays back — the value round-trips', () => {
      const field = aField(RowType);
      field.commit(TOKEN);
      expect(field.latest().props.value).toBe(TOKEN);
    });

    it('a token with a fallback is a token too', () => {
      const field = aField(RowType);
      field.commit('var(--space-4, 16px)');
      expect(field.stored()).toBe('var(--space-4, 16px)');
    });
  });

  // ------------------------------------------------------------------ AC2
  describe('AC2 — a token already on the port survives an edit', () => {
    it("survives the gesture Richard described — one character touched, then blur", () => {
      const field = aField(RowType, TOKEN);
      // The closing paren deleted by an accidental keypress. Unparseable, and not a token.
      field.commit('var(--space-4');
      expect(field.stored()).toBe(TOKEN);
    });

    it('survives a stray character appended', () => {
      const field = aField(RowType, TOKEN);
      field.commit(TOKEN + 'x');
      expect(field.stored()).toBe(TOKEN);
    });

    it('survives re-committing the identical text', () => {
      const field = aField(RowType, TOKEN);
      field.commit(TOKEN);
      expect(field.stored()).toBe(TOKEN);
    });

    /**
     * The no-change blur is guarded inside `NumberUnitInput` (`commitIfChanged` compares the
     * typed text against the `value` prop), which this runner cannot load. What IS gradeable
     * here is the precondition that guard depends on: the string the row hands down has to be
     * the stored token itself, or the comparison would fire on every blur.
     */
    it('and a focus/blur with no change has nothing to compare unequal', () => {
      const field = aField(RowType, TOKEN);
      expect(field.latest().props.value).toBe(field.stored());
    });
  });

  // ------------------------------------------------------------------ AC3
  describe('AC3 — the reset dot still resets', () => {
    it('clears the parameter, token or not', () => {
      const field = aField(RowType, TOKEN);
      const onReset = field.latest().props.onReset;
      expect(typeof onReset).toBe('function');
      onReset!();
      expect(field.stored()).toBeUndefined();
      // `toEqual` ignores an `undefined` property, so the write is asserted field by field.
      expect(field.writes[field.writes.length - 1].name).toBe(PORT.name);
      expect(field.writes[field.writes.length - 1].value).toBeUndefined();
    });

    it('and an emptied field still clears — deleting on purpose is still possible', () => {
      const field = aField(RowType, TOKEN);
      field.commit('');
      expect(field.stored()).toBeUndefined();
    });
  });

  // ------------------------------------------------------------------ AC4
  describe('AC4 — the paired control, on the same field', () => {
    it('the token survives…', () => {
      const field = aField(RowType, { value: 50, unit: '%' });
      field.commit(TOKEN);
      expect(field.stored()).toBe(TOKEN);
    });

    it('…and "banana" is still refused — nothing is written at all', () => {
      const field = aField(RowType, { value: 50, unit: '%' });
      const before = field.writes.length;
      field.commit('banana');
      // Refused means the row did not reach the model: no value, and no undo entry either.
      expect(field.writes.length).toBe(before);
      expect(field.stored()).toMatchObject({ value: 50, unit: '%' });
    });

    it('…and the refusal is visible — the field is remounted onto the surviving value', () => {
      const field = aField(RowType, { value: 50, unit: '%' });
      const keyBefore = field.latest().key;

      field.commit('banana');

      // The key change is what re-seeds the input's local text. Without it the field keeps
      // showing "banana" while the model holds 50, which reads as accepted.
      expect(field.latest().key).not.toBe(keyBefore);
      expect(field.latest().props.value).toBe('50');
    });

    it('…while an accepted edit does NOT remount — the control for the assertion above', () => {
      // 🔴 A key that changed on every render would pass the previous test and destroy every
      // drag and every keystroke. One prop different, opposite expectation.
      const token = aField(RowType, { value: 50, unit: '%' });
      const tokenKey = token.latest().key;
      token.commit(TOKEN);
      expect(token.latest().key).toBe(tokenKey);

      const number = aField(RowType, { value: 50, unit: '%' });
      const numberKey = number.latest().key;
      number.commit('75');
      expect(number.latest().key).toBe(numberKey);
    });

    it('the token rule is narrow — near-misses are refused, not stored as strings', () => {
      for (const text of ['var(--space-4', 'var(--)', '--space-4', 'var(--a) extra', 'vart(--a)']) {
        const field = aField(RowType, { value: 50, unit: '%' });
        field.commit(text);
        expect({ text, stored: field.stored() }).toEqual({ text, stored: { value: 50, unit: '%' } });
      }
    });

    it('and ordinary numbers are untouched by any of this', () => {
      const plain = aField(RowType);
      plain.commit('75');
      expect(plain.stored()).toMatchObject({ value: 75, unit: '%' });

      const withUnit = aField(RowType);
      withUnit.commit('75px');
      expect(withUnit.stored()).toMatchObject({ value: 75, unit: 'px' });

      const overToken = aField(RowType, TOKEN);
      overToken.commit('75px');
      expect(overToken.stored()).toMatchObject({ value: 75, unit: 'px' });
    });
  });
});

/**
 * AC5 — the twins, held against each other.
 *
 * The two rows carried byte-identical copies of `parseNumberWithUnit`, which is the standing
 * hazard: a fix lands in the field somebody was looking at and not in its twin. They now share
 * one `readNumberFieldEdit`, and this is the gate that says so in behaviour rather than in source
 * text — re-fork it and the two dispositions drift apart here.
 */
describe('REL-014 AC5 — Dimension and NumberWithUnits dispose of the same text the same way', () => {
  const INPUTS = [
    TOKEN,
    'var(--space-4, 16px)',
    'var(--space-4',
    'var(--)',
    '--space-4',
    'banana',
    '',
    '   ',
    '0',
    '75',
    '75px',
    '-12.5'
  ];

  function disposition(RowType: RowClass, text: string) {
    const field = aField(RowType, { value: 50, unit: '%' });
    const keyBefore = field.latest().key;
    field.commit(text);

    const stored = field.stored();
    return {
      // The *kind* of outcome, not the row-specific payload: `Dimension` writes a third
      // `isFixed` field on a numeric parameter and `NumberWithUnits` does not, and that
      // difference is deliberate.
      kind:
        stored === undefined
          ? 'cleared'
          : typeof stored === 'string'
          ? `token:${stored}`
          : `number:${(stored as { value: number }).value}|${(stored as { unit: string }).unit}`,
      wrote: field.writes.length > 0,
      remounted: field.latest().key !== keyBefore
    };
  }

  it.each(INPUTS)('agree on %p', (text) => {
    expect(disposition(NumberWithUnits, text)).toEqual(disposition(Dimension, text));
  });

  /**
   * 🔴 The table above is only worth something if it can disagree. This is the control: the two
   * rows are asked about a case where they are *supposed* to differ, and they do — so an
   * `toEqual` over their dispositions is a real comparison and not two identical constants.
   */
  it('and the comparison is capable of disagreeing — the payloads genuinely differ', () => {
    const dimension = aField(Dimension);
    dimension.commit('75px');
    const number = aField(NumberWithUnits);
    number.commit('75px');

    expect(dimension.stored()).toEqual({ value: 75, unit: 'px', isFixed: false });
    expect(number.stored()).toEqual({ value: 75, unit: 'px' });
    expect(dimension.stored()).not.toEqual(number.stored());
  });
});
