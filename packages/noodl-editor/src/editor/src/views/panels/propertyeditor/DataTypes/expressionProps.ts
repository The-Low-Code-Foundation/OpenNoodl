/**
 * POL-011 — the value↔expression conversion, in one place.
 *
 * `fx` turns a property from a literal into an expression (`Noodl.Variables.foo`)
 * and back. The conversion between those two shapes lived inside `BasicType`,
 * which is why exactly one family of ports had the affordance: a `string` port
 * marked `multiline` routes to `TextAreaType` instead, and `TextAreaType` had no
 * idea expressions existed. Button's `label` got `fx`; Text's `text` did not —
 * an accident of the textarea being a separate view, not a decision that a
 * multiline string may not be an expression.
 *
 * ⚠️ **Two copies of this would drift and then disagree**, and the disagreement
 * would be about what a saved parameter *means* — a literal that reads as an
 * expression, or an expression whose fallback is silently dropped. So the
 * conversion is here and every type that offers `fx` calls it.
 *
 * @module views/panels/propertyeditor/DataTypes/expressionProps
 */

import { createExpressionParameter, isExpressionParameter } from '@noodl-models/ExpressionParameter';

/**
 * What a `TypeView` has to provide to offer expressions.
 *
 * Structural rather than a base class: the views are legacy `TypeView`
 * subclasses that host React through `createRoot`, and they differ in almost
 * everything else. This is the whole of what the conversion touches.
 */
export interface ExpressionHost {
  parent: TSFixme;
  name: string;
  displayName: string;
  isDefault: boolean;
  renderReact(): void;
}

export interface ExpressionProps {
  supportsExpression: true;
  expressionMode: 'fixed' | 'expression';
  expression: string;
  onExpressionModeChange(mode: 'fixed' | 'expression'): void;
  onExpressionChange(expression: string): void;
}

/**
 * The `fx` half of a property row's props.
 *
 * ⚠️ Every re-render is deferred with `setTimeout(…, 0)`, and that is lifted
 * from `BasicType` deliberately rather than tidied away: these views are
 * rendered *by* the property editor, and re-entering the render synchronously
 * from inside a React event handler renders a root while it is already
 * rendering.
 */
export function expressionProps(host: ExpressionHost): ExpressionProps {
  const param = host.parent.model.getParameter(host.name);
  const isExprMode = isExpressionParameter(param);

  return {
    supportsExpression: true,
    expressionMode: isExprMode ? 'expression' : 'fixed',
    expression: isExprMode ? param.expression : '',

    onExpressionModeChange: (mode) => {
      const currentParam = host.parent.model.getParameter(host.name);

      if (mode === 'expression') {
        // ⚠️ The literal becomes the **fallback**, not nothing. It is what the
        // property is worth before anything evaluates — on a server render, in
        // a preview with no variable set — and dropping it would blank every
        // bound row the moment `fx` was pressed.
        const currentValue = isExpressionParameter(currentParam) ? currentParam.fallback : currentParam;
        host.parent.setParameter(host.name, createExpressionParameter(String(currentValue || ''), currentValue, 1), {
          undo: true,
          label: `enable expression for ${host.displayName}`
        });
      } else {
        const fixedValue = isExpressionParameter(currentParam) ? currentParam.fallback : currentParam;
        host.parent.setParameter(host.name, fixedValue, {
          undo: true,
          label: `disable expression for ${host.displayName}`
        });
      }

      host.isDefault = false;
      setTimeout(() => host.renderReact(), 0);
    },

    onExpressionChange: (expression) => {
      const currentParam = host.parent.model.getParameter(host.name);
      // Only ever edits an existing expression parameter: writing a bare string
      // here would silently convert the row back to a literal whose text
      // happens to look like code.
      if (isExpressionParameter(currentParam)) {
        host.parent.setParameter(
          host.name,
          { ...currentParam, expression },
          { undo: true, label: `change ${host.displayName} expression` }
        );
      }

      host.isDefault = false;
      setTimeout(() => host.renderReact(), 0);
    }
  };
}
