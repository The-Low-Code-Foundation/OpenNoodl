import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { NumberUnitInput } from '../components/NumberUnitInput';
import { TypeView } from '../TypeView';
import { getConnectionSourceLabel, getConnectionSourceNavigate, getEditType } from '../utils';
import { commitScrub, writeScrubStep } from './scrubCommit';
import { scrubSpecForPortType, scrubStartValue } from './scrubPolicy';

function parseNumberWithUnit(stringValue, permittedUnits) {
  let value = parseFloat(stringValue);

  if (isNaN(value)) {
    value = undefined;
  }

  let unit;

  permittedUnits.some((u) => {
    if (stringValue.endsWith(u)) {
      unit = u;
      return true;
    }
    return false;
  });

  return {
    value,
    unit
  };
}

export class Dimension extends TypeView {
  numberWithUnits: TSFixme;
  isFixed: TSFixme;
  isPercent: boolean;
  el: TSFixme;
  private root: Root | null = null;
  /** What the parameter held when the current scrub began; `undefined` between gestures. */
  private scrubStartParameter: TSFixme = undefined;

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

  private updateValue(text: string, fallbackUnit: string) {
    const v = parseNumberWithUnit(text, this.type.units || []);
    const unit = v.unit ? v.unit : fallbackUnit;

    // If the input is not a valid value, then set undefined
    if (v.value !== undefined) {
      const u = unit ? unit : this.type.defaultUnit;
      this.parent.setParameter(this.name, { value: v.value, unit: u, isFixed: this.isFixed });
    } else {
      this.parent.setParameter(this.name, undefined);
    }

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
