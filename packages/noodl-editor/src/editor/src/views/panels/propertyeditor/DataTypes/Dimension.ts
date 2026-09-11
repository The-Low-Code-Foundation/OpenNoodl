import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { NumberUnitInput } from '../components/NumberUnitInput';
import { TypeView } from '../TypeView';
import { getConnectionSourceLabel, getConnectionSourceNavigate, getEditType } from '../utils';
// REL-014 AC5 — `Dimension` and `NumberWithUnits` are twins, and until this row
// they each carried their own byte-identical `parseNumberWithUnit`. Two copies is
// how a fix lands in one field and not the other, so there is now one function
// and this row imports it rather than restating it.
import { readNumberFieldEdit } from './NumberWithUnits';
import { commitScrub, writeScrubStep } from './scrubCommit';
import { scrubSpecForPortType, scrubStartValue } from './scrubPolicy';

export class Dimension extends TypeView {
  numberWithUnits: TSFixme;
  isFixed: TSFixme;
  isPercent: boolean;
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
    const view = new Dimension();

    const p = args.port;
    const parent = args.parent;

    view.port = p;
    view.displayName = p.displayName ? p.displayName : p.name;
    view.name = p.name;
    view.type = getEditType(p);
    view.group = p.group;
    view.tooltip = p.tooltip;

    view.numberWithUnits = parent.model.getParameter(p.name);
    view.isFixed = view.numberWithUnits ? view.numberWithUnits.isFixed : false;
    view.isPercent = view.unit === '%';

    view.parent = parent;
    view.isConnected = parent.model.isPortConnected(p.name, 'target');
    view.isDefault = parent.model.parameters[p.name] === undefined;

    return view;
  }

  // @ts-expect-error
  get value() {
    return typeof this.numberWithUnits === 'object' ? this.numberWithUnits.value : this.numberWithUnits;
  }

  get unit(): string {
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
        showFixed: true,
        isFixed: !!this.isFixed,
        isPercent: this.isPercent,
        scrub: this.scrubBinding(),
        onCommit: (text: string) => this.updateValue(text, this.unit),
        onUnitChange: (unit: string, currentText: string) => this.updateValue(currentText, unit),
        onFixedToggle: () => {
          this.isFixed = !this.isFixed;
          this.updateValue(this.value === undefined ? '' : String(this.value), this.unit);
        },
        onReset: () => {
          this.parent.model.setParameter(this.name, undefined, {
            undo: true,
            label: 'reset parameter'
          });
          this.isFixed = false;
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

  /**
   * What this row stores for a scrubbed number.
   *
   * ⚠️ `isFixed` is carried through, not recomputed. It is a third field on the same
   * parameter and dropping it would turn a drag on a percentage width into a silent
   * un-ticking of the Fixed checkbox beside it.
   */
  private scrubbedParameter(value: number) {
    return { value, unit: this.unit ? this.unit : this.type.defaultUnit, isFixed: this.isFixed };
  }

  /** One live step of a drag — `model.setParameter`, never `parent.setParameter`. See AC1. */
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
   * parameter, so a value the field merely could not parse was deleted — and
   * `var(--space-4)`, which the editor stamps on every new Checkbox, is a value
   * this field cannot parse. See {@link readNumberFieldEdit}.
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
      // `ElementConfigRegistry.applyDefaults` stamps, and the one the `value`
      // and `unit` getters above already read back, so it round-trips.
      //
      // ⚠️ `isFixed` is deliberately not carried onto a token. It is a third
      // field on a `{ value, unit }` object and a token is not one; a token has
      // no unit either, which is why the Fixed tick is inert while one is set.
      this.parent.setParameter(this.name, edit.token);
    } else {
      const unit = edit.unit ? edit.unit : fallbackUnit;
      const u = unit ? unit : this.type.defaultUnit;
      this.parent.setParameter(this.name, { value: edit.value, unit: u, isFixed: this.isFixed });
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
    this.isPercent = this.unit === '%';
    this.renderReact();
  }

  resetToDefault() {
    this.isPercent = this.type.defaultUnit === '%';
    this.isFixed = false;
    this.numberWithUnits = this.getCurrentValue().value;
    this.renderReact();
  }

  dispose() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    super.dispose();
  }
}
