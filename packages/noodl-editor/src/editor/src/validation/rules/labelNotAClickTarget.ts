/**
 * Rule: the words beside a toggle control are a `Text` node, so tapping them
 * does nothing.
 *
 * DEF-025 (P78 D37). `Checkbox` and `Radio Button` emit `<label for="…">` —
 * a real click target wired to the input — only when `useLabel` is on, and it
 * defaults **off** (`addLabelInputs`; Button opts into `true`, the toggles do
 * not). The obvious authoring for a labelled checkbox — a `Text` beside it in
 * a row — therefore renders a control whose sentence is inert: the only hit
 * area is the box itself, 24×24 px, WCAG 2.2 SC 2.5.8's minimum and no more.
 * D37 measured it on the members-area account page, where the template's one
 * decision was a 24 px square on a phone.
 *
 * ## What counts as "the words beside it"
 *
 * An **immediate sibling** `Text` (directly before or after the control in its
 * parent's children) that carries words — an authored `text` parameter or a
 * connection into `text`. Adjacency is the discriminator between a label and
 * unrelated copy elsewhere in the row; a `Text` two positions away is not this
 * control's label.
 *
 * ⚠️ A `Text` immediately followed by a RUN of toggles (`Text, Checkbox,
 * Checkbox…`) is a group heading, not the first box's label, and is skipped —
 * but only on the heading's side. The box run's OTHER flank can still carry a
 * real per-control label, and each toggle inside an alternating
 * `Text, Checkbox, Text, Checkbox` list keeps its own.
 *
 * ## Why only Checkbox and Radio Button
 *
 * Their words are the primary touch surface — the thing a person taps to
 * toggle. `Text Input` and `Options` also have `useLabel: false`, but the
 * design system's own `field` composition puts a separate `fieldLabel` Text
 * above those controls on purpose, label-click there is a focus nicety, and a
 * rule that fires on the doctrine's recommended shape poisons the whole
 * diagnostic set. The list is short and deliberate rather than derived,
 * because "the label is the tap target" is a semantic fact about the control
 * that no catalog property carries; the reason is written here so the list can
 * be re-decided rather than rediscovered.
 *
 * A **warning**, never an error: the graph is correct and renders; the repair
 * is to move the words onto the control's own `label`/`useLabel` ports.
 *
 * @module noodl-editor/validation/rules/labelNotAClickTarget
 */

import { LABEL_TARGET_CONTROLS } from '../../models/nodeSeed/newNodeSeed';
import { Diagnostic, DiagnosticCode } from '../diagnostics';
import { NormComponent, NormNode } from '../model';
import { Rule, RuleContext } from './types';

/**
 * The controls whose visible words are the tap surface.
 *
 * ⚠️ Imported, not repeated. DEF-025's creation default writes `useLabel: true`
 * onto exactly this set, and a rule warning about a set the door does not fill
 * (or a door filling a set the rule does not watch) is the drift that would
 * make the product warn about its own output. One list, two readers.
 */
const TOGGLE_TYPES = LABEL_TARGET_CONTROLS;

const TEXT_TYPE = 'Text';

/**
 * DEF-025 — is this control's own `label` still the placeholder?
 *
 * True when nothing readable has been put in the port: unset (so the catalog's
 * `'Label'` renders), authored to that same default, authored blank, or
 * authored to whitespace. A **connection** into `label` counts as finished —
 * the words arrive at runtime and no static reading can say what they are.
 */
function labelIsPlaceholder(control: NormNode, component: NormComponent, catalogDefault: unknown): boolean {
  if (component.connections.some((c) => c.toId === control.id && c.toProperty === 'label')) return false;

  const authored = control.parameters?.label;
  if (authored === undefined) return true;
  if (typeof authored !== 'string') return false;
  return authored.trim() === '' || authored === catalogDefault;
}

/** Does this `Text` node carry words — authored or wired in? */
function carriesWords(text: NormNode, component: NormComponent): boolean {
  const authored = text.parameters?.text;
  if (typeof authored === 'string' && authored.trim() !== '') return true;
  if (typeof authored === 'number') return true;
  return component.connections.some((c) => c.toId === text.id && c.toProperty === 'text');
}

export const labelNotAClickTarget: Rule = {
  code: DiagnosticCode.LabelNotAClickTarget,
  description: 'A Text beside a Checkbox/Radio Button is not a click target; use the control’s own label.',
  defaultEnabled: true,

  run(ctx: RuleContext): Diagnostic[] {
    const out: Diagnostic[] = [];

    for (const { component, nodeById } of ctx.components) {
      for (const control of component.nodes) {
        const displayName = TOGGLE_TYPES.get(control.type);
        if (!displayName) continue;

        // Effective value, not the authored bag alone — DEF-006's lesson. The
        // catalog default is `false` for both types today, so an unset port
        // means the label path is off; an authored `true` means the control
        // already owns its words and a sibling Text is something else.
        const defaults = ctx.catalog.inputDefaults(control.type);
        const authored = control.parameters?.useLabel;
        const effective = authored !== undefined ? authored : defaults.useLabel;

        // DEF-025 — the state the creation default creates, and the only one it
        // does. A door-authored `useLabel: true` whose `label` was never filled
        // in renders the literal placeholder BESIDE the sibling Text: two sets
        // of words, and the ones a person reads are still inert. That is
        // unfinished, not fixed, so the warning must survive its own fix.
        //
        // ⚠️ Deliberately `authored === true`, not `effective === true`: an
        // UNSET port under a flipped catalog default is a different product —
        // one where every toggle is label-on and the placeholder question gets
        // re-decided — and the arm pinning that case stays silent, as it should.
        const unfinished = authored === true && labelIsPlaceholder(control, component, defaults.label);
        if (effective === true && !unfinished) continue;

        if (!control.parent) continue;
        const parent = nodeById.get(control.parent);
        if (!parent) continue;

        const idx = parent.children.indexOf(control.id);
        if (idx === -1) continue;

        for (const flank of [idx - 1, idx + 1]) {
          const sibling = nodeById.get(parent.children[flank]);
          if (!sibling || sibling.type !== TEXT_TYPE) continue;
          if (!carriesWords(sibling, component)) continue;

          // Heading, not label: this Text sits against a run of ≥2 same-type
          // toggles, reading away from it. Only this flank is dismissed.
          const step = flank < idx ? 1 : -1;
          const textAt = flank;
          const second = nodeById.get(parent.children[textAt + step * 2]);
          if (second && second.type === control.type) continue;

          const words = typeof sibling.parameters?.text === 'string' ? ` (“${sibling.parameters.text}”)` : '';
          const hitArea = displayName === 'Checkbox' ? 'box' : 'button';
          const message = unfinished
            ? `This ${displayName} has Enable Label (useLabel) on — as every newly created one does — but its ` +
              `Label is still the placeholder, so it renders the word “Label” beside the Text${words} a person ` +
              `actually reads, and only the placeholder is a click target. Move the words onto the ${displayName}'s ` +
              `own Label port and remove the sibling Text.`
            : `The Text beside this ${displayName}${words} is not a click target — tapping the words does nothing, ` +
              `and the only hit area is the ${hitArea} itself. ` +
              `Put the words on the control instead: set Enable Label (useLabel) and Label on the ${displayName} ` +
              `(they render as a real <label> wired to the input) and remove the sibling Text.`;
          out.push({
            code: DiagnosticCode.LabelNotAClickTarget,
            severity: 'warning',
            message,
            location: {
              component: component.name,
              nodeId: control.id,
              nodeType: control.type,
              nodeLabel: control.label
            }
          });
          break; // One finding per control, whichever flank carried the words.
        }
      }
    }

    return out;
  }
};
