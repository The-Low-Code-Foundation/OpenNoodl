import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { isExpressionParameter } from '@noodl-models/ExpressionParameter';
import { NodeLibrary } from '@noodl-models/nodelibrary';
import { ParameterValueResolver } from '@noodl-utils/ParameterValueResolver';

import { PropertyPanelInputType } from '@noodl-core-ui/components/property-panel/PropertyPanelInput';

import { PropertyPanelInputWithExpressionModal } from '../components/PropertyPanelInputWithExpressionModal';
import { TypeView } from '../TypeView';
import { getConnectionSourceLabel, getConnectionSourceNavigate, getEditType } from '../utils';
import { expressionProps } from './expressionProps';
import { commitScrub, writeScrubStep } from './scrubCommit';
import { scrubSpecForPortType, scrubStartValue } from './scrubPolicy';

function firstType(type) {
  return NodeLibrary.nameForPortType(type);
}

function mapTypeToInputType(type: string): PropertyPanelInputType {
  switch (type) {
    case 'number':
      return PropertyPanelInputType.Number;
    case 'string':
    default:
      return PropertyPanelInputType.Text;
  }
}

export class BasicType extends TypeView {
  el: TSFixme;
  private root: Root | null = null;
  /** What the parameter held when the current scrub began; `undefined` between gestures. */
  private scrubStartParameter: TSFixme = undefined;

  static fromPort(args) {
    const view = new BasicType();

    const p = args.port;
    const parent = args.parent;

    view.port = p;
    view.displayName = p.displayName ? p.displayName : p.name;
    view.name = p.name;
    view.type = getEditType(p);
    view.group = p.group;
    view.tooltip = p.tooltip;
    view.value = parent.model.getParameter(p.name);
    view.parent = parent;
    view.isConnected = parent.model.isPortConnected(p.name, 'target');
    view.isDefault = parent.model.parameters[p.name] === undefined;

    return view;
  }

  render() {
    // Create container for React component
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

    const paramValue = this.parent.model.getParameter(this.name);
    const isExprMode = isExpressionParameter(paramValue);

    // Get display value - MUST be a primitive, never an object
    // Use ParameterValueResolver to defensively handle any value type,
    // including expression objects that might slip through during state transitions
    const rawValue = isExprMode ? paramValue.fallback : paramValue;
    const displayValue = ParameterValueResolver.toString(rawValue);

    const props = {
      label: this.displayName,
      value: displayValue,
      dataIdentifier: this.name,
      // FB-015 AC4 — a shape hint from the port's own metadata, so the field says what goes in it
      // while it is empty. Only ports that declare one get anything.
      placeholder: this.port?.placeholder,
      inputType: mapTypeToInputType(firstType(this.type)),
      properties: undefined, // No special properties needed for basic types
      isChanged: !this.isDefault,
      isConnected: this.isConnected,
      scrub: this.scrubBinding(isExprMode),
      // PAR-002 binding chip: name the driving connection ("Node · Port");
      // clicking selects the source node on the canvas.
      connectionLabel: this.isConnected ? getConnectionSourceLabel(this.parent.model, this.name) : undefined,
      onConnectionClick: this.isConnected ? getConnectionSourceNavigate(this.parent.model, this.name) : undefined,
      onReset: () => {
        this.parent.model.setParameter(this.name, undefined, {
          undo: true,
          label: 'reset parameter'
        });
        this.isDefault = true;
        setTimeout(() => this.renderReact(), 0);
      },
      onChange: (value: unknown) => {
        // Handle standard value change
        if (firstType(this.type) === 'number') {
          const numValue = parseFloat(String(value));
          this.parent.setParameter(this.name, isNaN(numValue) ? undefined : numValue, {
            undo: true,
            label: `change ${this.displayName}`
          });
        } else {
          this.parent.setParameter(this.name, value, {
            undo: true,
            label: `change ${this.displayName}`
          });
        }
        this.isDefault = false;
      },

      // Expression support — POL-011 lifted this into `expressionProps` so
      // `TextAreaType` can offer the same `fx` without a second copy of the
      // value↔expression conversion.
      ...expressionProps(this)
    };

    this.root.render(React.createElement(PropertyPanelInputWithExpressionModal, props));
  }

  /**
   * FB-022 — the drag-to-scrub binding for this row, or `undefined` when the port is not a
   * draggable number.
   *
   * This row serves both `string` and `number` ports, and `scrubSpecForPortType` is what
   * separates them: a text field gets no binding because its type says so, not because
   * anything here tests `inputType`.
   *
   * 🔴 **Expression mode and connection are both gates, and neither is cosmetic.** In
   * expression mode the stored parameter is an `{ expression, fallback }` object and the
   * control is an `ExpressionInput`, not a number — a drag would overwrite the expression
   * with a literal, silently destroying what the author wrote. Both live in the policy rather
   * than here so they are gradeable in a runner that cannot render this row; see
   * `ScrubPortState`.
   */
  private scrubBinding(isExpressionMode: boolean) {
    const spec = scrubSpecForPortType(this.type, undefined, {
      isConnected: this.isConnected,
      isExpressionMode
    });
    if (!spec) return undefined;

    return {
      step: spec.step,
      value: scrubStartValue(this.parent.model.getParameter(this.name), this.port?.default),
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
          finalValue: value,
          label: `change ${this.displayName}`
        });
        this.scrubStartParameter = undefined;
        this.renderReact();
      }
    };
  }

  /**
   * One live step of a drag.
   *
   * ⚠️ `model.setParameter`, not `parent.setParameter` — the latter hard-codes
   * `{ undo: true, label: 'edit parameter' }`, so a drag routed through it would push an undo
   * entry per mousemove. AC1 is the whole gesture as one entry.
   */
  private writeScrubbedValue(value: number) {
    writeScrubStep(this.parent.model, this.name, value);
    this.isDefault = false;
    this.renderReact();
  }

  dispose() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    super.dispose();
  }

  // Legacy method kept for compatibility
  onPropertyChanged(scope, el) {
    if (firstType(scope.type) === 'number') {
      const value = parseFloat(el.val());
      this.parent.setParameter(scope.name, isNaN(value) ? undefined : value);
    } else {
      this.parent.setParameter(scope.name, el.val());
    }

    const current = this.getCurrentValue();
    el.val(current.value);
    this.isDefault = current.isDefault;

    el.blur();
  }
}
