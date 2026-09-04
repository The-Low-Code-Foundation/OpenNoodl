/**
 * REL-014 — the last two copies of "a parse failure is a deletion".
 *
 * `tokenFieldValue.test.ts` beside this file grades the twins the row was written about
 * (`Dimension` / `NumberWithUnits`). This one grades the two copies that were found while
 * building it and left for an owner:
 *
 *  1. **the margin/padding widget** — `MarginPaddingInput.commitEdit`, which is where most of
 *     the tokens the editor authors actually live. `TextInputConfig` stamps
 *     `paddingTop/Bottom: 'var(--space-2)'` and `paddingLeft/Right: 'var(--space-3)'` onto every
 *     new Text Input, and `isOfMarginPaddingType` claims those eight ports **four branches ahead**
 *     of the numeric rows in `Ports.viewClassForPort`, so the fix that landed in the twins could
 *     never reach them;
 *  2. **plain `number` ports** — `BasicType.onChange`, `parseFloat` → `isNaN ? undefined`.
 *
 * ## 🔴 The second one had a caller that ate the value first
 *
 * `BasicType` is the only row that selects `PropertyPanelInputType.Number`, and
 * `PropertyPanelNumberInput.handleUpdate` was `if (!isNaN(extractNumber(text))) { …commit… }`
 * with **no else**. Text it could not read as a number never reached `onChange` at all. So
 * fixing `BasicType` alone would have been a fix to a line no token can arrive at — a green
 * assertion over dead code. `readNumberInputText` is that missing branch, and it is graded here
 * beside the row, because the row's correctness is worth nothing without it.
 *
 * ## What is graded, and what is asserted
 *
 * - **Graded, by running it**: `readMarginPaddingEdit` and the widget's display helpers;
 *   `readNumberInputText`; and both rows through the **props they hand their component** — the
 *   same `onUpdate` / `onUpdateAll` / `onChange` callbacks the real widgets call.
 * - **Not graded, and owed to a drive**: that the components' own local state behaves — that
 *   `commitEdit`'s snap-back puts the surviving text back in the box, and that a remounted
 *   `PropertyPanelNumberInput` re-seeds from `value`. Neither component can be loaded by this
 *   runner: `MarginPaddingInput.tsx` imports `common/Icon` (webpack's `require.context`, which
 *   ts-jest rejects) and both call hooks, so no runner here can evaluate them. That is exactly
 *   why the decisions were lifted into `marginPaddingEdit` / `numberInputEdit`.
 *
 * 🔴 **`../utils` and `@noodl-models/nodelibrary` are mocked for resolution, not for behaviour.**
 * `getEditType` and `NodeLibrary.nameForPortType` are restated **verbatim** below, so the port-type
 * resolution under test is the shipped one. Everything else mocked here is a component this
 * runner cannot load.
 */

jest.mock('../../src/editor/src/views/panels/propertyeditor/utils', () => ({
  // Verbatim from `views/panels/propertyeditor/utils.ts`.
  getEditType: (p: { type?: { editAsType?: unknown } }) => (p.type?.editAsType ? p.type.editAsType : p.type),
  getConnectionSourceLabel: () => undefined,
  getConnectionSourceNavigate: () => undefined
}));

jest.mock('../../src/editor/src/views/panels/propertyeditor/components/NumberUnitInput', () => ({
  NumberUnitInput: function NumberUnitInput() {
    return null;
  }
}));

// `MarginPaddingInput.tsx` imports `common/Icon`; see the module note.
jest.mock('../../src/editor/src/views/panels/propertyeditor/components/MarginPaddingInput', () => ({
  MarginPaddingInput: function MarginPaddingInput() {
    return null;
  }
}));

// `PropertyPanelInputWithExpressionModal` reaches `PropertyPanelSelectInput`, which imports an
// `.svg`, and `ExpressionEditorModal`, which reaches the editor.
jest.mock('../../src/editor/src/views/panels/propertyeditor/components/PropertyPanelInputWithExpressionModal', () => ({
  PropertyPanelInputWithExpressionModal: function PropertyPanelInputWithExpressionModal() {
    return null;
  }
}));

jest.mock('@noodl-models/nodelibrary', () => ({
  NodeLibrary: {
    // Verbatim from `models/nodelibrary/nodelibrary.ts`.
    nameForPortType: (type: string | { name?: string } | null | undefined) => {
      if (!type) return undefined;
      return typeof type === 'string' ? type : type.name;
    }
  }
}));

import { readFileSync } from 'fs';
import { join } from 'path';

// `BasicType` imports the `PropertyPanelInputType` enum from this barrel, and the barrel is the
// component file: it reaches `ExpressionInput` -> `common/Icon`, whose `require.context` is a
// webpack call this runner has no answer for. The enum's members are restated verbatim from
// `PropertyPanelInput.tsx`; the last case in this file re-reads that source and fails if the one
// member these specs branch on has drifted from the copy below.
jest.mock('@noodl-core-ui/components/property-panel/PropertyPanelInput', () => ({
  PropertyPanelInputType: {
    Text: 'text',
    TextArea: 'text-area',
    Number: 'number',
    LengthUnit: 'length-unit',
    Slider: 'slider',
    Select: 'select',
    Color: 'color',
    TextRadio: 'text-radio',
    IconRadio: 'icon-radio',
    Checkbox: 'checkbox',
    Button: 'button'
  }
}));

import { readNumberInputText } from '@noodl-core-ui/components/property-panel/PropertyPanelNumberInput/numberInputEdit';

import {
  MarginPaddingParam,
  MarginPaddingSide,
  agreementKeyOf,
  commitMarginPaddingEdit,
  editTextOf,
  isMarginPaddingToken,
  isZeroValue,
  labelTextOf,
  readMarginPaddingEdit,
  scrubStartOf,
  tokenLabel
} from '../../src/editor/src/views/panels/propertyeditor/components/marginPaddingEdit';
import { BasicType } from '../../src/editor/src/views/panels/propertyeditor/DataTypes/BasicType';
import { MarginPaddingType } from '../../src/editor/src/views/panels/propertyeditor/DataTypes/MarginPaddingType';

/** The token `TextInputConfig` stamps on `paddingTop` and `paddingBottom`. */
const TOKEN = 'var(--space-2)';

interface Write {
  name: string;
  value: unknown;
  opts: unknown;
}

/** The node model, reduced to what these rows actually call on it. */
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
    setParameter(name: string, value: unknown, opts?: unknown) {
      writes.push({ name, value, opts });
      if (value === undefined) delete parameters[name];
      else parameters[name] = value;
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. The parse itself — one function, four outcomes, shared with the twins
// ═══════════════════════════════════════════════════════════════════════════════

describe('REL-014 — readMarginPaddingEdit', () => {
  it('AC1 — a token is kept verbatim, not parsed to NaN and dropped', () => {
    expect(readMarginPaddingEdit(TOKEN, 'px')).toEqual({ kind: 'token', value: TOKEN });
    expect(readMarginPaddingEdit('var(--space-2, 16px)', 'px')).toEqual({
      kind: 'token',
      value: 'var(--space-2, 16px)'
    });
  });

  it('AC3 — an emptied field still clears: deleting on purpose is untouched', () => {
    expect(readMarginPaddingEdit('', 'px')).toEqual({ kind: 'clear', value: undefined });
    expect(readMarginPaddingEdit('   ', 'px')).toEqual({ kind: 'clear', value: undefined });
  });

  it('AC4 — the control: text that is neither is refused, and refused is not cleared', () => {
    // 🔴 The distinction the whole row turns on. `refuse` writes nothing; `clear` writes
    // `undefined`, which deletes the parameter. Before REL-014 these were the same answer.
    expect(readMarginPaddingEdit('banana', 'px')).toEqual({ kind: 'refuse' });
    expect(readMarginPaddingEdit('banana', 'px')).not.toEqual(readMarginPaddingEdit('', 'px'));
  });

  it('the token rule is narrow — near-misses are refused, not stored as strings', () => {
    for (const text of ['var(--space-2', 'var(--)', '--space-2', 'var(--a) extra', 'vart(--a)']) {
      expect({ text, edit: readMarginPaddingEdit(text, 'px') }).toEqual({ text, edit: { kind: 'refuse' } });
    }
  });

  it('numbers are untouched, and the unit still comes from the widget’s own dropdown', () => {
    expect(readMarginPaddingEdit('16', 'px')).toEqual({ kind: 'number', value: { value: 16, unit: 'px' } });
    expect(readMarginPaddingEdit('0', '%')).toEqual({ kind: 'number', value: { value: 0, unit: '%' } });
    // ⚠️ Not `px`. This widget has always taken the unit from its dropdown rather than from
    // the text, and REL-014 deliberately did not change that — which is why the shared parser
    // is handed an empty unit list here. A `px` below would mean the fix quietly widened.
    expect(readMarginPaddingEdit('16px', '%')).toEqual({ kind: 'number', value: { value: 16, unit: '%' } });
  });
});

describe('REL-014 — what the widget shows for a token', () => {
  it('a token labels as its name and seeds the edit box in full, so it round-trips', () => {
    expect(labelTextOf(TOKEN)).toBe('--space-2');
    expect(tokenLabel('var(--space-2, 16px)')).toBe('--space-2');
    // 🔴 The value that goes back into the field must be the one that survives a re-commit.
    expect(editTextOf(TOKEN)).toBe(TOKEN);
    expect(readMarginPaddingEdit(editTextOf(TOKEN), 'px')).toEqual({ kind: 'token', value: TOKEN });
  });

  it('…and it is not the `0` or the literal `undefined` the widget used to draw', () => {
    // A bare string has no `.value`, so the old label was `v.value === undefined ? '0'`
    // → `0`, and the old edit box was seeded with `String(values[comp].value)` → the
    // literal text `undefined`. Both are the reason the token was invisible *before*
    // any edit destroyed it, so both are pinned rather than described.
    expect(labelTextOf(TOKEN)).not.toBe('0');
    expect(labelTextOf(TOKEN)).not.toBe(labelTextOf(undefined));
    expect(editTextOf(TOKEN)).not.toBe('undefined');
  });

  it('numbers label exactly as they did — the control for the two assertions above', () => {
    // 🔴 A `labelTextOf` that returned its input would pass the token tests and destroy every
    // numeric side. Same function, opposite expectation.
    expect(labelTextOf({ value: 16, unit: 'px' })).toBe('16');
    expect(labelTextOf({ value: 50, unit: '%' })).toBe('50%');
    expect(labelTextOf(undefined)).toBe('0');
    expect(editTextOf({ value: 16, unit: 'px' })).toBe('16');
    expect(isZeroValue({ value: 0, unit: 'px' })).toBe(true);
    expect(isZeroValue(TOKEN)).toBe(false);
  });

  it('a drag from a token starts at the side’s default, not at 0 with no unit', () => {
    // ⚠️ Still overwrites the token — a drag is a deliberate statement about size, and that is
    // unchanged by this row. What is fixed is `start.value || 0` on a bare string, which began
    // every such drag at 0 and wrote `{ value: n, unit: undefined }`.
    expect(scrubStartOf(TOKEN, { value: 8, unit: 'px' }, 'px')).toEqual({ value: 8, unit: 'px' });
    expect(scrubStartOf(TOKEN, undefined, '%')).toEqual({ value: 0, unit: '%' });
    expect(scrubStartOf({ value: 12, unit: '%' }, { value: 8, unit: 'px' }, 'px')).toEqual({ value: 12, unit: '%' });
  });

  it('four sides all carrying the same token agree, so the link seeds on', () => {
    expect(agreementKeyOf(TOKEN)).toBe(agreementKeyOf(TOKEN));
    // The control: it can disagree, and a token is not the same as "no explicit value".
    expect(agreementKeyOf(TOKEN)).not.toBe(agreementKeyOf('var(--space-3)'));
    expect(agreementKeyOf(TOKEN)).not.toBe(agreementKeyOf(undefined));
    expect(isMarginPaddingToken(TOKEN)).toBe(true);
    expect(isMarginPaddingToken('banana')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. The margin/padding row, through the props the widget is handed
// ═══════════════════════════════════════════════════════════════════════════════

/** The four padding ports of a Text Input, as the shared visual mixins declare them. */
const PADDING_PORTS = ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight'].map((name) => ({
  name,
  displayName: name,
  group: 'Margin and padding',
  type: {
    name: 'number',
    units: ['px', '%'],
    defaultUnit: 'px',
    marginPaddingComp: 'padding-' + name.slice('padding'.length).toLowerCase()
  }
}));

interface WidgetProps {
  values: Record<string, MarginPaddingParam | undefined>;
  defaults: Record<string, MarginPaddingParam>;
  linked: Record<MarginPaddingSide, boolean>;
  onUpdate: (comp: string, value: MarginPaddingParam | undefined, opts?: unknown) => void;
  onUpdateAll: (side: MarginPaddingSide, value: MarginPaddingParam | undefined, opts?: unknown) => void;
  onReset: () => void;
}

/**
 * Build the margin/padding row over a model holding `stored` on all four padding ports, and
 * capture what it hands the widget.
 *
 * The React root is replaced rather than created: `render()` needs a `document`, this runner has
 * none, and the root is only a sink for the element.
 */
function aPaddingWidget(stored?: unknown) {
  const parameters: Record<string, unknown> = {};
  if (stored !== undefined) for (const p of PADDING_PORTS) parameters[p.name] = stored;

  const model = aModel(parameters);
  const parent = { model, _toolsType: {} as Record<string, unknown> };

  let view: MarginPaddingType | undefined;
  for (const port of PADDING_PORTS) {
    const made = MarginPaddingType.fromPort({ port, parent });
    if (made) view = made;
  }

  const frames: WidgetProps[] = [];
  const internals = view as unknown as { root: unknown; renderReact(): void };
  internals.root = {
    render: (element: { props: WidgetProps }) => frames.push(element.props),
    unmount: () => undefined
  };
  internals.renderReact();

  /** What the edit box was told to show after the last commit, or `null` if it was not. */
  let snappedBackTo: string | null = null;

  return {
    parameters,
    writes: model.writes,
    latest: () => frames[frames.length - 1],
    snappedBackTo: (): string | null => snappedBackTo,
    /**
     * The blur/Enter path for one side. 🔴 This calls the row's **own**
     * `commitMarginPaddingEdit` with the props the row handed the widget — the parse,
     * the linked/unlinked branch and the refusal are the shipped ones, not restated
     * here. What stands in for the component is only its five-line hand-off: it holds
     * `text` and `unit` in `useState` and cannot be loaded by this runner.
     */
    commit: (comp: string, text: string, unit = 'px') => {
      const props = frames[frames.length - 1];
      snappedBackTo = null;
      return commitMarginPaddingEdit({
        comp,
        text,
        unit,
        values: props.values,
        linked: props.linked,
        onUpdate: (c, value) => props.onUpdate(c, value),
        onUpdateAll: (side, value) => props.onUpdateAll(side, value),
        onRefuse: (restored) => {
          snappedBackTo = restored;
        }
      });
    },
    stored: (name: string) => parameters[name]
  };
}

describe('REL-014 — the margin/padding widget (the copy that matters most)', () => {
  it('AC2 — the four tokens a new Text Input is born with reach the widget as tokens', () => {
    const widget = aPaddingWidget(TOKEN);
    // 🔴 Reddens on the unfixed `refreshDefault`: a token fell into the `else` and became
    // `{ value: 'var(--space-2)', unit: 'px' }`, so `defaults` claimed a magnitude it did not have.
    expect(widget.latest().values['padding-top']).toBe(TOKEN);
    expect(widget.latest().defaults['padding-top']).toBe(TOKEN);
    expect(labelTextOf(widget.latest().values['padding-top'] as string)).toBe('--space-2');
  });

  it('…and the four of them agree, so the padding link seeds on', () => {
    expect(aPaddingWidget(TOKEN).latest().linked.padding).toBe(true);
  });

  it('AC1 — a token typed into the field is what the project holds afterwards', () => {
    const widget = aPaddingWidget({ value: 16, unit: 'px' });
    widget.commit('padding-top', TOKEN);
    expect(widget.stored('paddingTop')).toBe(TOKEN);
  });

  it('AC2 — Richard’s gesture: one character touched, then blur, and the token survives', () => {
    const widget = aPaddingWidget(TOKEN);
    const before = widget.writes.length;
    // The closing paren lost to an accidental keypress. Unparseable, and not a token.
    expect(widget.commit('padding-top', 'var(--space-2')).toBe('refused');
    // 🔴 On the unfixed code this wrote `undefined`, which is the call that CLEARS the
    // parameter — the padding fell back to the node default and could not be typed back.
    expect(widget.writes.length).toBe(before);
    expect(widget.stored('paddingTop')).toBe(TOKEN);
  });

  it('AC4 — the pair, on the same field: the token survives and "banana" is refused', () => {
    const kept = aPaddingWidget({ value: 16, unit: 'px' });
    kept.commit('padding-top', TOKEN);
    expect(kept.stored('paddingTop')).toBe(TOKEN);

    const refused = aPaddingWidget({ value: 16, unit: 'px' });
    const before = refused.writes.length;
    expect(refused.commit('padding-top', 'banana')).toBe('refused');
    expect(refused.writes.length).toBe(before);
    expect(refused.stored('paddingTop')).toEqual({ value: 16, unit: 'px' });
  });

  it('AC4 — and the refusal is visible: the box is told to show what survived', () => {
    // Nothing is written on a refusal, so nothing upstream changes and no re-render
    // would correct the box on its own. Without this the field would sit there
    // showing `banana` while the project held 16 — which reads as accepted.
    const overNumber = aPaddingWidget({ value: 16, unit: 'px' });
    overNumber.commit('padding-top', 'banana');
    expect(overNumber.snappedBackTo()).toBe('16');

    const overToken = aPaddingWidget(TOKEN);
    overToken.commit('padding-top', 'var(--space-2');
    // 🔴 The full token, not the `--space-2` the label shows: what goes back into the
    // box has to be what a re-commit would store.
    expect(overToken.snappedBackTo()).toBe(TOKEN);
  });

  it('…while an accepted edit snaps nothing back — the control for the assertion above', () => {
    // 🔴 A `commitEdit` that re-seeded the box on every commit would pass the test
    // above and fight the author on every keystroke. Same helper, opposite expectation.
    const widget = aPaddingWidget({ value: 16, unit: 'px' });
    expect(widget.commit('padding-top', TOKEN)).toBe('committed');
    expect(widget.snappedBackTo()).toBeNull();
    expect(widget.commit('padding-top', '24')).toBe('committed');
    expect(widget.snappedBackTo()).toBeNull();
  });

  it('AC3 — an emptied field still clears, and clearing is still a write', () => {
    const widget = aPaddingWidget(TOKEN);
    expect(widget.commit('padding-top', '')).toBe('committed');
    // Linked, so all four go — one gesture, four sides, which is what the lock means.
    for (const p of PADDING_PORTS) expect(widget.stored(p.name)).toBeUndefined();
    expect(widget.writes.length).toBeGreaterThan(0);
  });

  it('AC3 — the reset affordance still clears a side holding a token', () => {
    const widget = aPaddingWidget(TOKEN);
    widget.latest().onReset();
    for (const p of PADDING_PORTS) expect(widget.stored(p.name)).toBeUndefined();
  });

  it('ordinary numbers are untouched by any of this — the control', () => {
    // 🔴 A widget that had started storing strings for everything would pass every token
    // assertion above. One input different, opposite expectation.
    const widget = aPaddingWidget({ value: 16, unit: 'px' });
    widget.commit('padding-top', '24');
    expect(widget.stored('paddingTop')).toEqual({ value: 24, unit: 'px' });
    expect(typeof widget.stored('paddingTop')).not.toBe('string');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. The plain `number` port — the row, and the caller that used to eat the value
// ═══════════════════════════════════════════════════════════════════════════════

/** A unitless `number` port: no `units`, so `Ports` sends it to `BasicType`. */
const NUMBER_PORT = {
  name: 'count',
  displayName: 'Count',
  group: 'General',
  type: { name: 'number' }
};

interface BasicProps {
  value: string;
  isChanged: boolean;
  onChange: (value: unknown) => void;
  onReset?: () => void;
}

function aNumberField(stored?: unknown) {
  const parameters: Record<string, unknown> = {};
  if (stored !== undefined) parameters[NUMBER_PORT.name] = stored;

  const model = aModel(parameters);
  const parent = {
    model,
    // `Ports.setParameter`, restated: the row's `parent`, which forwards the undo options.
    setParameter(name: string, value: unknown, opts?: unknown) {
      model.setParameter(name, value, opts);
    }
  };

  const view = BasicType.fromPort({ port: NUMBER_PORT, parent }) as unknown as {
    root: unknown;
    renderReact(): void;
  };

  const frames: { key: unknown; props: BasicProps }[] = [];
  view.root = {
    render: (element: { key: unknown; props: BasicProps }) => frames.push({ key: element.key, props: element.props }),
    unmount: () => undefined
  };
  view.renderReact();

  return {
    parameters,
    writes: model.writes,
    latest: () => frames[frames.length - 1],
    /**
     * What the field hands the row. `readNumberInputText` is the shipped decision;
     * the "only commit a real edit" guard around it is `handleUpdate`'s and is
     * restated here because the component holds its text in `useState` and cannot be
     * loaded by this runner.
     */
    type: (text: string) => {
      const props = frames[frames.length - 1].props;
      const current = props.value;
      const edit = readNumberInputText(text);

      if (edit.kind === 'empty') {
        if (current !== '') props.onChange(text);
      } else if (edit.text !== current) {
        props.onChange(edit.kind === 'number' ? edit.value : edit.text);
      }
    },
    stored: () => parameters[NUMBER_PORT.name]
  };
}

describe('REL-014 — the caller: PropertyPanelNumberInput no longer swallows the text', () => {
  it('🔴 a token now reaches the row instead of being discarded in the field', () => {
    // The branch that did not exist. `extractNumber('var(--space-2)')` strips to `---2`, which
    // is NaN, so the old `if (!isNaN(...))` fell off the end: no commit, no snap-back, and the
    // input left showing text the model never held.
    expect(readNumberInputText(TOKEN)).toEqual({ kind: 'passthrough', text: TOKEN });
    expect(readNumberInputText('banana')).toEqual({ kind: 'passthrough', text: 'banana' });
  });

  it('numbers and the emptied field are read exactly as before — the control', () => {
    // 🔴 If `readNumberInputText` returned `passthrough` for everything it would pass the test
    // above and hand every keystroke to the row as a string. Same function, opposite answer.
    expect(readNumberInputText('24')).toEqual({ kind: 'number', value: 24, text: '24' });
    expect(readNumberInputText('24px')).toEqual({ kind: 'number', value: 24, text: '24' });
    expect(readNumberInputText('')).toEqual({ kind: 'empty' });
  });
});

describe('REL-014 — a plain number port (BasicType)', () => {
  it('AC1 — a token typed into the field is kept verbatim', () => {
    const field = aNumberField(50);
    field.type(TOKEN);
    // 🔴 Reddens on the unfixed row: `parseFloat('var(--space-2)')` is NaN and the row wrote
    // `undefined`, so this key was deleted rather than set.
    expect(field.stored()).toBe(TOKEN);
    expect(field.latest().props.value).toBe(TOKEN);
  });

  it('AC2 — a token already on the port survives a mistyped edit and a blur', () => {
    const field = aNumberField(TOKEN);
    const before = field.writes.length;
    field.type('var(--space-2');
    expect(field.writes.length).toBe(before);
    expect(field.stored()).toBe(TOKEN);
  });

  it('AC4 — the pair, on the same field: "banana" is refused and nothing is written', () => {
    const field = aNumberField(50);
    const before = field.writes.length;
    field.type('banana');
    // Refused means the row did not reach the model: no value, and no undo entry either.
    expect(field.writes.length).toBe(before);
    expect(field.stored()).toBe(50);
  });

  it('AC4 — and the refusal is visible: the field is remounted onto the surviving value', () => {
    const field = aNumberField(50);
    const keyBefore = field.latest().key;
    field.type('banana');
    expect(field.latest().key).not.toBe(keyBefore);
    expect(field.latest().props.value).toBe('50');
  });

  it('…while an accepted edit does NOT remount — the control for the assertion above', () => {
    // 🔴 A key that changed on every render would pass the previous test and destroy every
    // drag and every keystroke. One input different, opposite expectation.
    const token = aNumberField(50);
    const tokenKey = token.latest().key;
    token.type(TOKEN);
    expect(token.latest().key).toBe(tokenKey);

    const number = aNumberField(50);
    const numberKey = number.latest().key;
    number.type('75');
    expect(number.latest().key).toBe(numberKey);
  });

  it('AC3 — an emptied field still clears, and it is still one undo entry', () => {
    const field = aNumberField(50);
    field.type('');
    expect(field.stored()).toBeUndefined();
    const last = field.writes[field.writes.length - 1];
    expect(last.value).toBeUndefined();
    expect(last.opts).toMatchObject({ undo: true });
  });

  it('AC3 — the reset dot still resets a port holding a token', () => {
    const field = aNumberField(TOKEN);
    const onReset = field.latest().props.onReset;
    expect(typeof onReset).toBe('function');
    onReset!();
    expect(field.stored()).toBeUndefined();
  });

  it('ordinary numbers are untouched — the control', () => {
    const field = aNumberField();
    field.type('75');
    expect(field.stored()).toBe(75);
    expect(typeof field.stored()).toBe('number');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. AC5, widened: four fields, one rule
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * AC5 said "graded on both `Dimension.ts` and `NumberWithUnits.ts`" because those were the two
 * copies known when the row was written. There were four. All four now ask the same
 * `readNumberFieldEdit`, and this table is what says so in behaviour rather than in source text:
 * re-fork any of them and the dispositions drift apart here.
 *
 * ⚠️ Only the **kind** of outcome is compared, not the payload — the margin/padding widget wraps
 * a number in `{value, unit}` and a plain number port does not, and that difference is deliberate.
 */
describe('REL-014 AC5 widened — the margin/padding widget and a plain number port dispose alike', () => {
  const INPUTS = [
    TOKEN,
    'var(--space-2, 16px)',
    'var(--space-2',
    'var(--)',
    '--space-2',
    'banana',
    '',
    '   ',
    '0',
    '75',
    '-12.5'
  ];

  function marginPaddingDisposition(text: string) {
    const widget = aPaddingWidget({ value: 16, unit: 'px' });
    const before = widget.writes.length;
    widget.commit('padding-top', text);
    const stored = widget.stored('paddingTop');
    return {
      kind: stored === undefined ? 'cleared' : typeof stored === 'string' ? `token:${stored}` : 'number',
      wrote: widget.writes.length > before
    };
  }

  function basicTypeDisposition(text: string) {
    const field = aNumberField(16);
    const before = field.writes.length;
    field.type(text);
    const stored = field.stored();
    return {
      kind: stored === undefined ? 'cleared' : typeof stored === 'string' ? `token:${stored}` : 'number',
      wrote: field.writes.length > before
    };
  }

  it.each(INPUTS)('agree on %p', (text) => {
    expect(marginPaddingDisposition(text)).toEqual(basicTypeDisposition(text));
  });

  /**
   * 🔴 The table above is only worth something if it can disagree. This is the control: the two
   * fields are asked about a case where they are *supposed* to differ, and they do — so the
   * `toEqual` over their dispositions is a real comparison and not two identical constants.
   */
  it('and the comparison is capable of disagreeing — the payloads genuinely differ', () => {
    const widget = aPaddingWidget({ value: 16, unit: 'px' });
    widget.commit('padding-top', '75');
    const field = aNumberField(16);
    field.type('75');

    expect(widget.stored('paddingTop')).toEqual({ value: 75, unit: 'px' });
    expect(field.stored()).toBe(75);
    expect(widget.stored('paddingTop')).not.toEqual(field.stored());
  });
});


describe('REL-014 — the mock this file depends on has not drifted from the product', () => {
  it('PropertyPanelInputType.Number is still "number" in the real enum', () => {
    const src = readFileSync(
      join(__dirname, '../../../noodl-core-ui/src/components/property-panel/PropertyPanelInput/PropertyPanelInput.tsx'),
      'utf8'
    );
    expect(src).toContain('export enum PropertyPanelInputType');
    expect(src).toContain("Number = 'number'");
  });
});
