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

import { WorkflowEditorService } from '@noodl-models/workflow/WorkflowEditorService';

import { PropertyPanelRow } from '@noodl-core-ui/components/property-panel/PropertyPanelInput';

import { ConditionEditor } from '../components/WorkflowCondition/ConditionEditor';
import { FunctionRefRow } from '../components/WorkflowCondition/FunctionRefRow';
import { SwitchCasesEditor } from '../components/WorkflowCondition/SwitchCasesEditor';
import { TriggerInfoRow } from '../components/WorkflowCondition/TriggerInfoRow';
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
      React.createElement(PropertyPanelRow, {
        label: this.displayName,
        isChanged: !this.isDefault,
        onReset: () => this.write(undefined),
        children: React.createElement(ConditionEditor, {
          value: this.parent.model.getParameter(this.name),
          onChange: (value: unknown) => this.write(value),
          ops: this.ops,
          scope: this.scope,
          graph: this.graph,
          stepId: this.stepId
        })
      })
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
      React.createElement(PropertyPanelRow, {
        label: this.displayName,
        isChanged: !this.isDefault,
        onReset: () => this.write(undefined),
        children: React.createElement(SwitchCasesEditor, {
          value: this.parent.model.getParameter(this.name),
          onChange: (value: unknown) => this.write(value),
          ops: this.ops,
          scope: this.scope,
          graph: this.graph,
          stepId: this.stepId
        })
      })
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
      React.createElement(PropertyPanelRow, {
        label: this.displayName,
        isChanged: !this.isDefault,
        onReset: () => this.write(undefined),
        children: React.createElement(WorkflowValueInput, {
          value: this.parent.model.getParameter(this.name),
          onChange: (value: unknown) => this.write(value),
          scope: this.scope,
          graph: this.graph,
          stepId: this.stepId,
          ariaLabel: this.displayName
        })
      })
    );
  }
}

/**
 * The `ref` row — which cloud function this step calls (WFA-006).
 *
 * A step field rather than a param, but it edits like one, and it is the only
 * row in this editor whose value points at something in a **different artefact
 * store**: the function lives in the project, the step lives in a backend's
 * data directory, and the two can disagree. So this row states which of the
 * four resolution states it is in, offers the descent when there is a graph to
 * open, offers the deploy when that is what is missing, and lists the names
 * that do exist.
 *
 * The answer comes from the open `WorkflowDocument`, which is the one thing that
 * knows both halves — the project's functions and what THIS backend is serving.
 * Only one workflow is open at a time, which is what makes that lookup exact.
 */
export class WorkflowFunctionRefType extends WorkflowTypeView {
  static fromPort(args: TSFixme) {
    return WorkflowTypeView.fill(new WorkflowFunctionRefType(), args);
  }

  /**
   * Re-render on both ways this row can go stale, because it has two.
   *
   * **The world changed.** A deploy from the trail chip, a backend starting, a
   * function renamed in the Components panel: the value is untouched and the
   * answer is different. A row still reading "not deployed" after you deployed
   * it is the stalest kind of lie.
   *
   * **The value changed from somewhere else.** An undo, MCP, or the retarget
   * chip. The property editor does not rebuild a row on `parametersChanged`, so
   * without this the row keeps painting the name it was built with — caught in
   * the live pass showing the OLD name beside the NEW name's resolution, which
   * is worse than either alone.
   */
  render() {
    const el = super.render();
    WorkflowEditorService.instance.document?.on('resolutionChanged', () => this.renderReact(), this);
    this.graph?.findNodeWithId(this.stepId)?.on('parametersChanged', () => this.renderReact(), this);
    return el;
  }

  dispose() {
    WorkflowEditorService.instance.document?.off(this);
    this.graph?.findNodeWithId(this.stepId)?.off(this);
    super.dispose();
  }

  renderReact() {
    if (!this.root) return;

    const document = WorkflowEditorService.instance.document;
    const stepId = this.stepId;
    const resolution = document && stepId ? document.resolveStep(stepId) : null;

    /**
     * Read the parameter, not `this.value`.
     *
     * `this.value` is filled once when the row is built and only refreshed by
     * this row's own `write`. A `ref` can change from elsewhere — an undo, MCP,
     * or the retarget after a rename — and the live pass caught this row showing
     * the previous name beside the NEW name's resolution. The sibling types all
     * read through `getParameter` here for the same reason.
     */
    const value = this.parent.model.getParameter(this.name);

    // "Open" only when there is a graph to open; "Deploy it" only when the
    // function is in this project and the backend has said it does not have it.
    // A button that cannot help is worse than no button — it reads as an offer.
    const canOpen = resolution?.state === 'resolved-in-project';
    const canDeploy = Boolean(resolution?.inProject) && resolution?.deployed === false;

    this.root.render(
      React.createElement(PropertyPanelRow, {
        label: this.displayName,
        isChanged: !this.isDefault,
        onReset: () => this.write(undefined),
        children: React.createElement(FunctionRefRow, {
          value: typeof value === 'string' ? value : '',
          onChange: (value: string) => this.write(value || undefined),
          resolution,
          suggestions: document ? document.functionSuggestions() : [],
          onOpen: canOpen && stepId ? () => void document?.descendInto(stepId) : undefined,
          onDeploy: canDeploy
            ? async () => {
                await document?.deployFunctions();
                this.renderReact();
              }
            : undefined,
          ariaLabel: this.displayName
        })
      })
    );
  }
}

/**
 * A read-only fact about a trigger (WFA-005).
 *
 * Triggers are drawn on a workflow's canvas as its entry nodes, and a trigger is
 * a BACKEND object: `triggers.json` holds it, the running service writes status
 * back into that file, and one trigger may be shared by nothing on this canvas
 * at all. So these rows READ. Enabling, disabling and deleting are actions on
 * the node's own right-click menu, where the label can say which backend is
 * about to change.
 *
 * The webhook URL is `copyable`, because it is the single most-wanted string in
 * this whole feature and it is otherwise assembled by hand out of two panels.
 */
export class WorkflowTriggerInfoType extends WorkflowTypeView {
  static fromPort(args: TSFixme) {
    return WorkflowTypeView.fill(new WorkflowTriggerInfoType(), args);
  }

  private get copyable(): boolean {
    return Boolean(this.type?.copyable);
  }

  renderReact() {
    if (!this.root) return;
    const value = this.parent.model.getParameter(this.name);
    this.root.render(
      React.createElement(
        PropertyPanelRow,
        // No `onReset`: there is no default to go back to, and offering one
        // would suggest this row writes something.
        { label: this.displayName } as TSFixme,
        React.createElement(TriggerInfoRow, {
          value: value === undefined || value === null ? '—' : String(value),
          copyable: this.copyable,
          ariaLabel: this.displayName
        })
      )
    );
  }

  /** Nothing to reset — but the base class calls this on a parameter change. */
  resetToDefault() {
    this.renderReact();
  }
}
