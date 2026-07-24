import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { isExpressionParameter, createExpressionParameter } from '@noodl-models/ExpressionParameter';
import { NodeLibrary } from '@noodl-models/nodelibrary';
import { ParameterValueResolver } from '@noodl-utils/ParameterValueResolver';

import { PropertyPanelInputType } from '@noodl-core-ui/components/property-panel/PropertyPanelInput';

import { PropertyPanelInputWithExpressionModal } from '../components/PropertyPanelInputWithExpressionModal';
import { TypeView } from '../TypeView';
import { getEditType } from '../utils';

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
      inputType: mapTypeToInputType(firstType(this.type)),
      properties: undefined, // No special properties needed for basic types
      isChanged: !this.isDefault,
      isConnected: this.isConnected,
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

      // Expression support
      supportsExpression: true,
      expressionMode: isExprMode ? ('expression' as const) : ('fixed' as const),
      expression: isExprMode ? paramValue.expression : '',

      onExpressionModeChange: (mode: 'fixed' | 'expression') => {
        const currentParam = this.parent.model.getParameter(this.name);

        if (mode === 'expression') {
          // Convert to expression parameter
          const currentValue = isExpressionParameter(currentParam) ? currentParam.fallback : currentParam;

          const exprParam = createExpressionParameter(String(currentValue || ''), currentValue, 1);

          this.parent.setParameter(this.name, exprParam, {
            undo: true,
            label: `enable expression for ${this.displayName}`
          });
        } else {
          // Convert back to fixed value
          const fixedValue = isExpressionParameter(currentParam) ? currentParam.fallback : currentParam;

          this.parent.setParameter(this.name, fixedValue, {
            undo: true,
            label: `disable expression for ${this.displayName}`
          });
        }

        this.isDefault = false;
        // Re-render to update UI
        setTimeout(() => this.renderReact(), 0);
      },

      onExpressionChange: (expression: string) => {
        const currentParam = this.parent.model.getParameter(this.name);

        if (isExpressionParameter(currentParam)) {
          // Update the expression
          this.parent.setParameter(
            this.name,
            {
              ...currentParam,
              expression
            },
            {
              undo: true,
              label: `change ${this.displayName} expression`
            }
          );
        }

        this.isDefault = false;
        // Re-render to update UI and sync modal with inline input
        setTimeout(() => this.renderReact(), 0);
      }
    };

    this.root.render(React.createElement(PropertyPanelInputWithExpressionModal, props));
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
