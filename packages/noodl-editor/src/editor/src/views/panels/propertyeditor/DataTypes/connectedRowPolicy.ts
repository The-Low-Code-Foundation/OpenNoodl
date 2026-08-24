/**
 * FB-018 — what every property row does when a connection drives it.
 *
 * ## Why this file exists at all
 *
 * The binding chip shipped in UIX-003 (phase 23). PAR-002 recorded that only `BasicType`
 * reached it. ERG-003 extended it to list rows. Then nothing, for three phases — and
 * nothing anywhere said which rows were still missing it, so "the chip is rolled out"
 * and "the chip is rolled out to five of thirty-six row classes" were the same sentence
 * as far as the repo was concerned.
 *
 * A test user then wired a number into a Group's Width, typed a width by hand, and could
 * not understand why the typed value rendered and then reverted. `Dimension` was one of
 * the rows the rollout had not reached: it drew a 1px outline around a field that stayed
 * fully editable.
 *
 * 🔴 SO THE POINT OF THIS TABLE IS NOT THE CHIPS — IT IS THE ENTRIES THAT ARE NOT CHIPS.
 * A row class with no decision recorded here fails `connectedRowPolicy.test.ts`, which
 * checks this table against the dispatch chain in `Ports.ts` in both directions. That is
 * what stops the next rollout stalling silently: a new row class cannot be added without
 * someone writing down what it does with a connection, and a row cannot sit undecided
 * while the repo reads as finished.
 *
 * ⚠️ THIS TABLE IS A RECORD OF DECISIONS, NOT A MECHANISM. Nothing reads it at runtime.
 * It cannot make a row draw a chip and it does not know whether one does — a `chip` entry
 * here is a claim, and the claim is graded by `bindingChipRows.test.tsx`, which renders
 * the row components and looks for the chip. Editing this file to say `chip` does not
 * make a row chip, and that is deliberate: a self-certifying registry would be a rubber
 * stamp.
 */

/** How a row class presents a port that a connection is driving. */
export type ConnectedRowPolicy =
  /** Renders the binding chip in place of the row's controls. */
  | { kind: 'chip' }
  /**
   * Cannot chip for a structural reason — the row is not one port's value, so there is
   * no single connection for a chip to name.
   */
  | { kind: 'exception'; reason: string }
  /**
   * Could chip and does not yet. One port, but a bespoke editor rather than a field, so
   * replacing it with a chip is a design decision per editor rather than a rollout.
   *
   * 🔴 THIS BUCKET IS THE HONEST ANSWER AND IT IS ALSO THE DEBT. FB-018's AC2 asks for
   * "chip or a recorded reason it can't", and writing `exception` on a row that plainly
   * *could* chip would have met the letter of it by lying. The test pins this list
   * exactly, so it can only shrink deliberately — and a row class added later cannot
   * join it without being named.
   */
  | { kind: 'deferred'; reason: string };

/**
 * Keyed by the class names the `Ports.ts` dispatch chain returns. The test parses that
 * chain out of the real file rather than taking a list from here, so this table is graded
 * against the code that actually decides which row a port gets.
 */
export const CONNECTED_ROW_POLICY: Record<string, ConnectedRowPolicy> = {
  // ── chips ────────────────────────────────────────────────────────────────
  // The five that already did, before FB-018:
  BasicType: { kind: 'chip' },
  EnumType: { kind: 'chip' },
  TextAreaType: { kind: 'chip' },
  ListValueType: { kind: 'chip' },
  StringListType: { kind: 'chip' },

  // FB-018. Dimension is the row the task was filed about; the rest are the same
  // shape — one port, one value, an editable-looking control — reached through
  // `PropertyPanelRow`, which is where the chip now lives for non-`PropertyPanelInput`
  // rows.
  Dimension: { kind: 'chip' },
  NumberWithUnits: { kind: 'chip' },
  ColorType: { kind: 'chip' },
  IconType: { kind: 'chip' },
  // The `PickerTypeView` family — one edit in the base class reaches all six.
  ImageType: { kind: 'chip' },
  FontType: { kind: 'chip' },
  ComponentType: { kind: 'chip' },
  IdentifierType: { kind: 'chip' },
  TextStyleType: { kind: 'chip' },
  SourceCodeType: { kind: 'chip' },
  // FB-018 narrowed `PropertyPanelInput`'s exclusion from "buttons and checkboxes" to
  // buttons: a connected checkbox stayed clickable, which is the filed bug with a
  // different control.
  BooleanType: { kind: 'chip' },

  // ── structural exceptions ────────────────────────────────────────────────
  AlignToolsType: {
    kind: 'exception',
    reason:
      'One row, several ports — it writes `this.ports[comp].name`, not `this.name`. ' +
      'A single chip cannot name the connection because there is no single port; the row ' +
      'would need per-port chrome, which is a different control, not a chip.'
  },
  MarginPaddingType: {
    kind: 'exception',
    reason:
      'The box-model editor edits four sides as four ports in one control. Same reason as ' +
      'AlignToolsType: no single port for a chip to be about. FB-016 owns this control.'
  },

  // ── deferred: one port, bespoke editor ───────────────────────────────────
  SizeModeType: {
    kind: 'deferred',
    reason:
      'One port, but the control is a segmented mode picker rather than a value field, and ' +
      'it is the GATE in FB-021 rather than a gated port. Chipping it would hide the control ' +
      'that explains why Width and Height are disabled — decide it with FB-021, not before.'
  },
  ResizingType: {
    kind: 'deferred',
    reason: 'One port, drawn as a resize-handle diagram. A chip replacing the diagram needs a design call.'
  },
  VariableType: {
    kind: 'deferred',
    reason: 'One port, drawn as a variable picker with its own popout.'
  },
  PropListType: {
    kind: 'deferred',
    reason: 'One port holding a list of properties; the row is an editor for the list, not a field.'
  },
  QuerySortingType: {
    kind: 'deferred',
    reason: 'One port holding a sorting structure, edited by a builder popout.'
  },
  ByobFilterType: {
    kind: 'deferred',
    reason: 'One port holding a filter tree, edited by the filter builder (BCN-003b).'
  },
  CurveType: {
    kind: 'deferred',
    reason: 'One port holding an easing curve, edited on a canvas.'
  },
  CodeEditorType: {
    kind: 'deferred',
    reason: 'One port holding source, edited in a popped-out CodeMirror rather than in the row.'
  },
  PagesType: {
    kind: 'deferred',
    reason: 'One port holding the router page list, edited by a dedicated editor.'
  },

  // The workflow family (WFA-*). Each is one port holding a structure, edited by a
  // bespoke row or popout; two of them are read-only facts rather than controls at all.
  WorkflowConditionType: { kind: 'deferred', reason: 'One port holding a condition tree, edited by ConditionEditor.' },
  WorkflowCasesType: { kind: 'deferred', reason: 'One port holding switch cases, edited by a bespoke row.' },
  WorkflowValueType: { kind: 'deferred', reason: 'One port holding a workflow value expression.' },
  WorkflowParamsType: { kind: 'deferred', reason: 'One port holding a parameter map.' },
  WorkflowTransformType: { kind: 'deferred', reason: 'One port holding a transform definition.' },
  WorkflowValidateType: { kind: 'deferred', reason: 'One port holding a validation definition.' },
  WorkflowBackoffType: { kind: 'deferred', reason: 'One port holding retry/backoff settings, drawn as a multi-field row.' },
  WorkflowTriggerInfoType: {
    kind: 'exception',
    reason:
      'WFA-005: a read-only fact about a trigger — "a row, not a control". It shows what the ' +
      'backend holds and takes no value, so there is nothing a connection could override.'
  },
  WorkflowFunctionRefType: {
    kind: 'deferred',
    reason: 'One port naming a cloud function, drawn as a row that also resolves what the name points at.'
  }
};

/**
 * The `deferred` rows, pinned — WRITTEN OUT, not derived.
 *
 * 🔴 THE FIRST VERSION OF THIS COMPUTED ITSELF FROM THE TABLE ABOVE, WHICH PINS NOTHING.
 * A list derived from the thing it is meant to constrain grows silently to match it: mark
 * a new row `deferred` and the "pinned" set simply agrees, and the test that reads it
 * passes while the debt gets bigger. That is the rubber stamp this file's header warns
 * about, one screen further down.
 *
 * So it is a literal. The test asserts it against the table in both directions, and the
 * only way to add a row to it is to type the name here — which is the moment somebody has
 * to say out loud that another row ships without the chip. Removing one is the good
 * direction and equally deliberate.
 */
export const DEFERRED_ROW_CLASSES: readonly string[] = [
  'ByobFilterType',
  'CodeEditorType',
  'CurveType',
  'PagesType',
  'PropListType',
  'QuerySortingType',
  'ResizingType',
  'SizeModeType',
  'VariableType',
  'WorkflowBackoffType',
  'WorkflowCasesType',
  'WorkflowConditionType',
  'WorkflowFunctionRefType',
  'WorkflowParamsType',
  'WorkflowTransformType',
  'WorkflowValidateType',
  'WorkflowValueType'
];
