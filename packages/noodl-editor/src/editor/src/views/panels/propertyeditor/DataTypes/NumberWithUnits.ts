import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { NumberUnitInput } from '../components/NumberUnitInput';
import { transformOriginFocus } from '../transformOriginFocus';
import { TypeView } from '../TypeView';
import { getConnectionSourceLabel, getConnectionSourceNavigate, getEditType } from '../utils';
import { commitScrub, writeScrubStep } from './scrubCommit';
import { scrubSpecForPortType, scrubStartValue } from './scrubPolicy';

/**
 * REL-014 — what a typed edit to a number-with-units field *means*.
 *
 * ## Why this exists, and why it lives here rather than in each row
 *
 * The old shape was two outcomes: a number, or `undefined`. `undefined` is the
 * value that clears a parameter, so **every parse failure was a deletion** —
 * and `var(--space-4)` is a parse failure. `parseFloat('var(--space-4)')` is
 * `NaN`, so touching one character of a token and blurring wiped it, and typing
 * it back wiped it again. The editor authors those tokens itself
 * (`ElementConfigRegistry.applyDefaults` stamps `var(--space-4)` on every new
 * Checkbox, `var(--text-base)` on every new Text), so the product was
 * destroying its own values on contact. Colour fields never had the bug —
 * `ColorType`'s `onCommit` commits any non-empty trimmed string.
 *
 * So there are **four** outcomes, and separating them is the whole fix:
 *
 * - `clear` — an empty field. Still `undefined`, still a deletion, deliberately.
 * - `token` — a design-token reference, kept **verbatim** as a string.
 * - `number` — a number, with the unit the text ended in if it named one.
 * - `refuse` — text that is none of the above (`banana`). The parameter is left
 *   alone. AC4: a parse failure must stop being a deletion, which is not the
 *   same as accepting everything.
 *
 * 🔴 **One copy, imported by both rows.** `Dimension` and `NumberWithUnits` are
 * twins that each carried their own byte-identical `parseNumberWithUnit`, which
 * is exactly how a fix lands in one and not the other (AC5). There is now one
 * function and `Dimension.ts` imports it.
 */
export type NumberFieldEdit =
  | { kind: 'clear' }
  | { kind: 'token'; token: string }
  | { kind: 'number'; value: number; unit: string | undefined }
  | { kind: 'refuse' };

/**
 * A design-token reference, in the shape the editor itself writes.
 *
 * ⚠️ Deliberately narrow. It matches `var(--name)` and `var(--name, fallback)`
 * and nothing else — not a half-typed `var(--space-4`, not `var(--)`, not a
 * bare `--space-4`. A looser rule here is how AC1 turns into "the field accepts
 * anything", which is the failure AC4 is the control for.
 */
const TOKEN_REFERENCE = /^var\(\s*--[A-Za-z0-9_-]+\s*(?:,[^()]*)?\)$/;

/** Whether `text` is a design-token reference this field must keep verbatim. */
export function isTokenReference(text: unknown): boolean {
  return typeof text === 'string' && TOKEN_REFERENCE.test(text.trim());
}

/**
 * Read one typed edit. See {@link NumberFieldEdit} for why there are four
 * answers rather than two.
 *
 * ⚠️ The numeric branch keeps `parseFloat`'s tolerance on purpose — `50px`,
 * `50 px` and even `50abc` have always committed as `50`, and narrowing that
 * here would be a second, unasked-for behaviour change riding along with this
 * one.
 */
export function readNumberFieldEdit(text: unknown, permittedUnits: string[]): NumberFieldEdit {
  const trimmed = typeof text === 'string' ? text.trim() : String(text ?? '').trim();

  if (trimmed === '') return { kind: 'clear' };
  if (isTokenReference(trimmed)) return { kind: 'token', token: trimmed };

  const value = parseFloat(trimmed);
  if (isNaN(value)) return { kind: 'refuse' };

  let unit: string | undefined;
  (permittedUnits || []).some((u) => {
    if (trimmed.endsWith(u)) {
      unit = u;
      return true;
    }
    return false;
  });

  return { kind: 'number', value, unit };
}

export class NumberWithUnits extends TypeView {
  numberWithUnits: TSFixme;
  el: TSFixme;
  private root: Root | null = null;
  /** What the parameter held when the current scrub began; `undefined` between gestures. */
  private scrubStartParameter: TSFixme = undefined;
  /**
   * REL-014 AC4 — how many edits this row has refused. It is the React `key`,
   * and bumping it is what makes a refusal **visible**. See {@link rejectEdit}.
   */
  private refusals = 0;

  static fromPort(args) {
    const view = new NumberWithUnits();

    const p = args.port;
    const parent = args.parent;

    view.port = p;
    view.displayName = p.displayName ? p.displayName : p.name;
    view.name = p.name;
    view.type = getEditType(p);
    view.group = p.group;
    view.tooltip = p.tooltip;

    view.numberWithUnits = parent.model.getParameter(p.name);

    view.parent = parent;
    view.isConnected = parent.model.isPortConnected(p.name, 'target');
    view.isDefault = parent.model.parameters[p.name] === undefined;

    return view;
  }

  // @ts-expect-error
  get value() {
    return typeof this.numberWithUnits === 'object' ? this.numberWithUnits.value : this.numberWithUnits;
  }

  get unit() {
    return typeof this.numberWithUnits === 'object' ? this.numberWithUnits.unit : this.type.defaultUnit;
  }

  render() {
    const div = document.createElement('div');
    div.style.width = '100%';

    if (!this.root) {
      this.root = createRoot(div);
    }

    this.renderReact();

    this.el = div;
    return this.el;
  }

  renderReact() {
    if (!this.root) return;

    this.root.render(
      React.createElement(NumberUnitInput, {
        // REL-014 AC4 — see `refusals`. Constant across every ordinary re-render
        // (a scrub re-renders this row on every mousemove), so the field is only
        // remounted when an edit was actually turned down.
        key: `${this.name}#${this.refusals}`,
        label: this.displayName,
        value: this.value === undefined ? '' : String(this.value),
        unit: this.unit,
        units: this.type.units || [],
        isChanged: !this.isDefault,
        isConnected: this.isConnected,
        connectionLabel: this.isConnected ? getConnectionSourceLabel(this.parent.model, this.name) : undefined,
        onConnectionClick: this.isConnected ? getConnectionSourceNavigate(this.parent.model, this.name) : undefined,
        dataIdentifier: this.name,
        // FB-016 scope 4 — the crosshair's trigger. `isTransformOriginPort` filters inside the
        // tracker, so every number-with-units row can report focus and only the two that matter
        // turn anything on.
        onFocus: () => transformOriginFocus.focus(this.name),
        onBlur: () => transformOriginFocus.blur(this.name),
        scrub: this.scrubBinding(),
        onCommit: (text: string) => this.updateValue(text, this.unit),
        onUnitChange: (unit: string, currentText: string) => this.updateValue(currentText, unit),
        onReset: () => {
          this.parent.model.setParameter(this.name, undefined, {
            undo: true,
            label: 'reset parameter'
          });
          this.refreshFromModel();
        }
      })
    );
  }

  /**
   * FB-022 — the drag-to-scrub binding for this row, or `undefined` when this port type is
   * not a draggable number.
   *
   * ⚠️ **Rebuilt on every render, deliberately.** `value` is the number the *next* gesture
   * starts from, and the row re-renders after every live write during a drag — a binding
   * memoised across renders would hand the second gesture the first one's origin.
   *
   * 🔴 `isConnected` is handed to the policy even though `PropertyPanelRow` already replaces
   * the whole control with FB-018's binding chip while a connection drives the port — so
   * structurally there is no field to press. Two independent mechanisms, deliberately: see
   * `ScrubPortState` for why one of them being enough is not a reason to have only one.
   */
  private scrubBinding() {
    const spec = scrubSpecForPortType(this.type, this.unit, { isConnected: this.isConnected });
    if (!spec) return undefined;

    return {
      step: spec.step,
      value: scrubStartValue(this.numberWithUnits, this.port?.default),
      onScrubBegin: () => {
        // 🔴 The stored parameter, not the resolved number: `undefined` here means the port
        // was on its default, and undoing a drag that began there must leave it on its
        // default rather than pinning the default as an explicit value.
        this.scrubStartParameter = this.parent.model.getParameter(this.name);
      },
      onScrub: (value: number) => this.writeScrubbedValue(value),
      onScrubEnd: (value: number) => {
        this.writeScrubbedValue(value);
        commitScrub({
          model: this.parent.model,
          name: this.name,
          startValue: this.scrubStartParameter,
          finalValue: this.scrubbedParameter(value),
          label: `change ${this.displayName}`
        });
        this.scrubStartParameter = undefined;
        this.refreshFromModel();
      }
    };
  }

  /** What this row stores for a scrubbed number. The unit is carried through untouched. */
  private scrubbedParameter(value: number) {
    return { value, unit: this.unit ? this.unit : this.type.defaultUnit };
  }

  /**
   * One live step of a drag.
   *
   * ⚠️ Goes to `model.setParameter` and **not** to `parent.setParameter`, which hard-codes
   * `{ undo: true }` — routing a drag through it would push an undo entry per mousemove,
   * which is the thing AC1 exists to prevent.
   */
  private writeScrubbedValue(value: number) {
    writeScrubStep(this.parent.model, this.name, this.scrubbedParameter(value));
    this.numberWithUnits = this.parent.model.getParameter(this.name);
    this.isDefault = false;
    this.renderReact();
  }

  /**
   * REL-014 — commit one typed edit.
   *
   * 🔴 The branch that used to read *"if the input is not a valid value, then set
   * undefined"* is the defect this row exists for: `undefined` clears the
   * parameter, so a value the field merely could not parse was deleted. A token
   * is now kept verbatim and unparseable text is turned down without touching
   * what is stored. See {@link readNumberFieldEdit}.
   */
  private updateValue(text: string, fallbackUnit: string) {
    const edit = readNumberFieldEdit(text, this.type.units || []);

    if (edit.kind === 'refuse') {
      this.rejectEdit();
      return;
    }

    if (edit.kind === 'clear') {
      this.parent.setParameter(this.name, undefined);
    } else if (edit.kind === 'token') {
      // Stored as the bare string the editor itself writes — the same shape
      // `ElementConfigRegistry.applyDefaults` stamps, and the one `value`/`unit`
      // above already read back, so it round-trips through the field.
      this.parent.setParameter(this.name, edit.token);
    } else {
      const unit = edit.unit ? edit.unit : fallbackUnit;
      this.parent.setParameter(this.name, {
        value: edit.value,
        unit: unit ? unit : this.type.defaultUnit
      });
    }

    this.refreshFromModel();
  }

  /**
   * REL-014 AC4 — turn an edit down, **visibly**.
   *
   * ⚠️ Re-rendering alone is not enough and that is the whole reason this method
   * exists. `NumberUnitInput` keeps the text in local state and only re-seeds it
   * from the `value` prop when that prop *changes* — and on a refusal it does
   * not, because nothing was written. The field would keep showing `banana`
   * while the model still held `50`, which reads as accepted. Bumping the key
   * remounts the input, so its state is re-seeded from the model and the typed
   * text snaps back to the value that survived.
   */
  private rejectEdit() {
    this.refusals++;
    this.refreshFromModel();
  }

  private refreshFromModel() {
    const current = this.getCurrentValue();
    this.numberWithUnits = current.value;
    this.isDefault = current.isDefault;
    this.renderReact();
  }

  resetToDefault() {
    this.numberWithUnits = this.getCurrentValue().value;
    this.renderReact();
  }

  dispose() {
    // ⚠️ React does not fire `blur` on an input it unmounts, so a panel rebuilt under the
    // author's cursor would leave the crosshair on with nothing focused. Handing the focus back
    // here is the only place that always runs.
    transformOriginFocus.release(this.name);

    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    super.dispose();
  }
}
