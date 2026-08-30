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

import { Diagnostic, DiagnosticCode } from '../diagnostics';
import { NormComponent, NormNode } from '../model';
import { Rule, RuleContext } from './types';

/** The controls whose visible words are the tap surface. See the header. */
const TOGGLE_TYPES = new Map<string, string>([
  ['net.noodl.controls.checkbox', 'Checkbox'],
  ['net.noodl.controls.radiobutton', 'Radio Button']
]);

const TEXT_TYPE = 'Text';

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
        const authored = control.parameters?.useLabel;
        const effective = authored !== undefined ? authored : ctx.catalog.inputDefaults(control.type).useLabel;
        if (effective === true) continue;

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
          out.push({
            code: DiagnosticCode.LabelNotAClickTarget,
            severity: 'warning',
            message:
              `The Text beside this ${displayName}${words} is not a click target — tapping the words does nothing, ` +
              `and the only hit area is the ${displayName === 'Checkbox' ? 'box' : 'button'} itself. ` +
              `Put the words on the control instead: set Enable Label (useLabel) and Label on the ${displayName} ` +
              `(they render as a real <label> wired to the input) and remove the sibling Text.`,
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
