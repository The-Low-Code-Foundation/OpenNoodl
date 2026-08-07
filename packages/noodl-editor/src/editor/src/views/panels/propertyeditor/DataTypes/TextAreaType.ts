import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { isExpressionParameter } from '@noodl-models/ExpressionParameter';
import { ParameterValueResolver } from '@noodl-utils/ParameterValueResolver';

import { PropertyPanelInputType } from '@noodl-core-ui/components/property-panel/PropertyPanelInput';

import { PropertyPanelInputWithExpressionModal } from '../components/PropertyPanelInputWithExpressionModal';
import { TypeView } from '../TypeView';
import { getConnectionSourceLabel, getConnectionSourceNavigate, getEditType } from '../utils';
import { expressionProps } from './expressionProps';

/**
 * A multiline string property — POL-011.
 *
 * ⚠️ It now renders the **same row** every other string does, rather than a
 * bare `PropertyPanelRow` around a textarea. That difference was the whole of
 * the reported defect: Button's `label` is a plain `string` and routes to
 * `BasicType`, so it gets `fx`; the Text node's `text` is declared
 * `multiline: true` and routed here, which had never heard of expressions. An
 * accident of the textarea being a separate view, not a decision that a
 * multiline string may not be an expression.
 *
 * In expression mode the row shows the expression input, not a textarea — an
 * expression is one line of code, and the multiline affordance is about the
 * *literal*. `PropertyPanelInput` already does that for every type; getting it
 * here was a matter of having a `TextArea` input type to ask for.
 */
export class TextAreaType extends TypeView {
  el: TSFixme;
  private root: Root | null = null;

  static fromPort(args) {
    const view = new TextAreaType();

    const p = args.port;
    const parent = args.parent;

    view.port = p;
    view.displayName = p.displayName ? p.displayName : p.name;
    view.name = p.name;
    view.type = getEditType(p);
    view.group = p.group;
    view.value = parent.model.getParameter(p.name);
    view.parent = parent;
    view.isConnected = parent.model.isPortConnected(p.name, 'target');
    view.isDefault = parent.model.parameters[p.name] === undefined;

    return view;
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

    // In expression mode the parameter is an object; the textarea underneath
    // must never be handed one. `ParameterValueResolver` is the same guard
    // `BasicType` uses and for the same reason.
    const paramValue = this.parent.model.getParameter(this.name);
    const rawValue = isExpressionParameter(paramValue) ? paramValue.fallback : paramValue;

    const props = {
      label: this.displayName,
      value: ParameterValueResolver.toString(rawValue),
      dataIdentifier: this.name,
      inputType: PropertyPanelInputType.TextArea,
      properties: undefined,
      isChanged: !this.isDefault,
      isConnected: this.isConnected,
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
        // ⚠️ Kept from the legacy view: the textarea commits on blur, and a
        // blur that changed nothing must not record an undo entry. Without
        // this, tabbing through the panel fills the undo queue with no-ops.
        if (String(value ?? '') === ParameterValueResolver.toString(rawValue)) return;
        this.parent.setParameter(this.name, value, {
          undo: true,
          label: `change ${this.displayName}`
        });
        this.isDefault = false;
      },

      ...expressionProps(this)
    };

    this.root.render(React.createElement(PropertyPanelInputWithExpressionModal, props));
  }

  resetToDefault() {
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
