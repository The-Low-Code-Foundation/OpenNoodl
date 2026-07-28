/**
 * The property-editor rows for workflow step params (WFA-004 §4).
 *
 * Three `TypeView` subclasses beside the thirty that already exist — the
 * registry's intended extension point, reached through `viewClassForPort`'s
 * dispatch on the port TYPE NAME. Nothing in the property editor learns what a
 * workflow is; it learns three more port types.
 *
 * The operator set and the scope roots are read off the port type, exactly the
 * way `enum` reads its values off the port type. They were put there by the
 * translator from the SERVED catalog, so no control here holds its own copy of
 * a backend contract.
 *
 * @module views/panels/propertyeditor/DataTypes/WorkflowTypes
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { PropertyPanelRow } from '@noodl-core-ui/components/property-panel/PropertyPanelInput';

import { ConditionEditor } from '../components/WorkflowCondition/ConditionEditor';
import { SwitchCasesEditor } from '../components/WorkflowCondition/SwitchCasesEditor';
import { WorkflowValueInput } from '../components/WorkflowCondition/WorkflowValueInput';
import { TypeView } from '../TypeView';
import { getEditType } from '../utils';

/**
 * Shared plumbing: read the port, mount a React root, write the parameter back
 * through the undo queue.
 */
abstract class WorkflowTypeView extends TypeView {
  el: TSFixme;
  protected root: Root | null = null;

  protected static fill<T extends WorkflowTypeView>(view: T, args: TSFixme): T {
    const p = args.port;
    const parent = args.parent;

    view.port = p;
    view.displayName = p.displayName ? p.displayName : p.name;
    view.name = p.name;
    view.type = getEditType(p);
    view.default = p.default;
    view.group = p.group;
    view.tooltip = p.tooltip;
    view.value = parent.model.getParameter(p.name);
    view.parent = parent;
    view.isConnected = parent.model.isPortConnected(p.name, 'target');
    view.isDefault = parent.model.parameters[p.name] === undefined;

    return view;
  }

  /** The operators this backend will actually evaluate. */
  protected get ops() {
    return this.type?.ops || [];
  }

  /** Scope roots from the served value language. */
  protected get scope() {
    return this.type?.scope || [];
  }

  /**
   * The node this row is editing.
   *
   * `parent.model` is a `ModelProxy` (the visual-state/variant indirection), and
   * the real `NodeGraphNode` is one level in at `.model` — the same hop
   * `TypeView.bindStyleDefaultWatch` makes. Reading `parent.model.owner`
   * directly returns undefined, which is silent: the predecessor picker simply
   * says nothing runs before this step.
   */
  private get node() {
    const m = this.parent?.model as TSFixme;
    return (m && m.model) || m;
  }

  /** The graph and step id the predecessor picker needs. */
  protected get graph() {
    return this.node?.owner;
  }

  protected get stepId(): string | undefined {
    return this.node?.id;
  }

  protected write(value: unknown) {
    this.parent.model.setParameter(this.name, value, {
      undo: true,
      label: `set ${this.name}`,
      oldValue: this.value
    });
    this.value = value;
    this.isDefault = false;
    this.renderReact();
  }

  abstract renderReact(): void;

  render() {
    const div = document.createElement('div');
    div.style.width = '100%';
    if (!this.root) this.root = createRoot(div);
    this.el = div;
    this.renderReact();
    return this.el;
  }

  resetToDefault() {
    this.value = this.parent.model.getParameter(this.name);
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

/** `condition` params — the control §4 says decides whether the canvas is usable. */
export class WorkflowConditionType extends WorkflowTypeView {
  static fromPort(args: TSFixme) {
    return WorkflowTypeView.fill(new WorkflowConditionType(), args);
  }

  renderReact() {
    if (!this.root) return;
    this.root.render(
      React.createElement(
        PropertyPanelRow,
        { label: this.displayName, isChanged: !this.isDefault, onReset: () => this.write(undefined) } as TSFixme,
        React.createElement(ConditionEditor, {
          value: this.parent.model.getParameter(this.name),
          onChange: (value: unknown) => this.write(value),
          ops: this.ops,
          scope: this.scope,
          graph: this.graph,
          stepId: this.stepId
        })
      )
    );
  }
}

/** `switch.cases` — labels here become output ports on the card. */
export class WorkflowCasesType extends WorkflowTypeView {
  static fromPort(args: TSFixme) {
    return WorkflowTypeView.fill(new WorkflowCasesType(), args);
  }

  renderReact() {
    if (!this.root) return;
    this.root.render(
      React.createElement(
        PropertyPanelRow,
        { label: this.displayName, isChanged: !this.isDefault, onReset: () => this.write(undefined) } as TSFixme,
        React.createElement(SwitchCasesEditor, {
          value: this.parent.model.getParameter(this.name),
          onChange: (value: unknown) => this.write(value),
          ops: this.ops,
          scope: this.scope,
          graph: this.graph,
          stepId: this.stepId
        })
      )
    );
  }
}

/**
 * `any` and `path` params — a literal, or a reference into the run scope.
 *
 * The same control serves both: WFA-003's `path` type is a reference that must
 * be one, and `any` is a reference that may be one. Splitting them would mean
 * two controls that differ only in which mode they open in.
 */
export class WorkflowValueType extends WorkflowTypeView {
  static fromPort(args: TSFixme) {
    return WorkflowTypeView.fill(new WorkflowValueType(), args);
  }

  renderReact() {
    if (!this.root) return;
    this.root.render(
      React.createElement(
        PropertyPanelRow,
        { label: this.displayName, isChanged: !this.isDefault, onReset: () => this.write(undefined) } as TSFixme,
        React.createElement(WorkflowValueInput, {
          value: this.parent.model.getParameter(this.name),
          onChange: (value: unknown) => this.write(value),
          scope: this.scope,
          graph: this.graph,
          stepId: this.stepId,
          ariaLabel: this.displayName
        })
      )
    );
  }
}
