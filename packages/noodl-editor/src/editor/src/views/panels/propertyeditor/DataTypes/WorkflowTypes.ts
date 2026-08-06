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

import { UndoActionGroup, UndoQueue } from '@noodl-models/undo-queue-model';
import { WorkflowEditorService } from '@noodl-models/workflow/WorkflowEditorService';
import { PORT_PARAM_MAPPING } from '@noodl-models/workflow/workflowPorts';

import { PropertyPanelRow } from '@noodl-core-ui/components/property-panel/PropertyPanelInput';

import { ConditionEditor } from '../components/WorkflowCondition/ConditionEditor';
import { FunctionRefRow } from '../components/WorkflowCondition/FunctionRefRow';
import { RetryBackoffRow } from '../components/WorkflowCondition/RetryBackoffRow';
import { SwitchCasesEditor } from '../components/WorkflowCondition/SwitchCasesEditor';
import { TransformOutputEditor } from '../components/WorkflowCondition/TransformOutputEditor';
import { TriggerInfoRow } from '../components/WorkflowCondition/TriggerInfoRow';
import { WorkflowParamsEditor } from '../components/WorkflowCondition/WorkflowParamsEditor';
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
 * `transform.output` — the object a Transform step produces (CWF-004).
 *
 * Unlike `WorkflowParamsType` below, this edits ONE param's value, so it needs
 * none of that row's sibling-writing machinery: an ordinary `write()` through
 * the undo queue is the whole story, and `isChanged` / `onReset` mean what they
 * mean everywhere else in this panel.
 *
 * The operation vocabulary rides on the port TYPE (`this.ops`), put there by the
 * translator from the served catalog — the same place `enum` carries its values.
 * Nothing here holds a copy of the backend's operation list, which is what makes
 * "remove an op from the backend and it leaves the picker" true with no editor
 * change at all.
 */
export class WorkflowTransformType extends WorkflowTypeView {
  static fromPort(args: TSFixme) {
    return WorkflowTypeView.fill(new WorkflowTransformType(), args);
  }

  renderReact() {
    if (!this.root) return;
    const value = this.parent.model.getParameter(this.name);
    this.root.render(
      React.createElement(PropertyPanelRow, {
        label: this.displayName,
        isChanged: !this.isDefault,
        onReset: () => this.write(undefined),
        children: React.createElement(TransformOutputEditor, {
          value,
          onChange: (next: Record<string, unknown>) => this.write(next),
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
 * The param MAPPING — what a Call Function step hands the function (CWF-001).
 *
 * ⚠️ **This row does not edit a parameter of its own.** It is the one synthetic
 * port on a step card, and the mapping it edits IS the set of the node's
 * parameters that the kind does not declare. That is not a trick: a step's
 * params have been merged into its input by name since WFA-003, so the mapping
 * has always been "the undeclared params" — what was missing was a row to author
 * them in, because the property editor builds one row per DECLARED port and
 * `call-function` declared only `ref`.
 *
 * Editing siblings has three consequences worth stating rather than discovering:
 *   - `this.value` / `isDefault` are meaningless here (nothing is ever stored
 *     under this port's name), so `isChanged` and `onReset` are computed from
 *     the mapping instead,
 *   - the whole gesture goes into ONE `UndoActionGroup`, because a rename is a
 *     delete plus a set and undoing half of it would leave a param the author
 *     never wrote, and
 *   - a change from elsewhere (undo, MCP, a proposal) does not rebuild the row,
 *     so it subscribes to `parametersChanged` the way `WorkflowFunctionRefType`
 *     already does.
 */
export class WorkflowParamsType extends WorkflowTypeView {
  static fromPort(args: TSFixme) {
    return WorkflowTypeView.fill(new WorkflowParamsType(), args);
  }

  /** Param names this kind declares — they belong to the kind, not the author. */
  private get declared(): string[] {
    return this.type?.declared || [];
  }

  private get reserved(): string[] {
    return this.type?.reserved || [];
  }

  private get shadows(): string[] {
    return this.type?.shadows || [];
  }

  /**
   * The author's params, in stored order.
   *
   * Read off the raw parameters map rather than through `getParameter`, because
   * the whole point is the keys that have NO port — `getParameter` needs a name
   * and there is nothing to enumerate names from but this map.
   */
  private get rows(): [string, unknown][] {
    const node = this.graph?.findNodeWithId(this.stepId);
    const params = (node?.parameters || {}) as Record<string, unknown>;
    const declared = new Set([...this.declared, PORT_PARAM_MAPPING]);
    return Object.entries(params).filter(([k, v]) => !declared.has(k) && v !== undefined);
  }

  /**
   * Apply the new mapping as parameter writes — one undo group for the gesture.
   *
   * Deletes first, then sets, so a rename that reuses a name in the same gesture
   * (swap two params) cannot delete the value it has just written.
   */
  private applyRows(next: [string, unknown][]) {
    const before = new Map(this.rows);
    const after = new Map(next);
    const undo = new UndoActionGroup({ label: 'set step params' });

    const label = 'set step params';
    for (const name of before.keys()) {
      if (!after.has(name)) this.parent.model.setParameter(name, undefined, { undo, label, oldValue: before.get(name) });
    }
    for (const [name, value] of after) {
      if (before.get(name) !== value) {
        this.parent.model.setParameter(name, value, { undo, label, oldValue: before.get(name) });
      }
    }

    // `push` (not `pushAndDo`): the writes above already happened, and this
    // records their inverse — the distinction the UndoActionGroup docblock
    // exists to make.
    if (!undo.isEmpty()) UndoQueue.instance.push(undo);
    this.renderReact();
  }

  /**
   * Rebuild when the params change from anywhere — including this row's own
   * writes, which is why `renderReact` is idempotent and the name fields hold
   * their own draft state.
   */
  render() {
    const el = super.render();
    this.graph?.findNodeWithId(this.stepId)?.on('parametersChanged', () => this.renderReact(), this);
    return el;
  }

  dispose() {
    this.graph?.findNodeWithId(this.stepId)?.off(this);
    super.dispose();
  }

  resetToDefault() {
    this.renderReact();
  }

  renderReact() {
    if (!this.root) return;
    const rows = this.rows;
    this.root.render(
      React.createElement(PropertyPanelRow, {
        label: this.displayName,
        isChanged: rows.length > 0,
        onReset: () => this.applyRows([]),
        children: React.createElement(WorkflowParamsEditor, {
          value: rows,
          onChange: (next: [string, unknown][]) => this.applyRows(next),
          reserved: this.reserved,
          shadows: this.shadows,
          scope: this.scope,
          graph: this.graph,
          stepId: this.stepId
        })
      })
    );
  }
}

/**
 * `maxAttempts`, with the delay sequence it implies (CWF-005 S1).
 *
 * The one row here that reads its SIBLINGS without writing them. The four other
 * backoff numbers stay their own rows — each is individually meaningful — but
 * nothing showed their product, so "3, 1000, 2, 60000" was arithmetic homework
 * rather than a policy you could read.
 *
 * Re-renders on `parametersChanged` for the same reason `WorkflowFunctionRefType`
 * does: change the multiplier in the row below and this preview is stale, and a
 * stale preview of a delay sequence is worse than none.
 */
export class WorkflowBackoffType extends WorkflowTypeView {
  static fromPort(args: TSFixme) {
    return WorkflowTypeView.fill(new WorkflowBackoffType(), args);
  }

  render() {
    const el = super.render();
    this.graph?.findNodeWithId(this.stepId)?.on('parametersChanged', () => this.renderReact(), this);
    return el;
  }

  dispose() {
    this.graph?.findNodeWithId(this.stepId)?.off(this);
    super.dispose();
  }

  renderReact() {
    if (!this.root) return;
    const get = (name: string) => this.parent.model.getParameter(name);
    this.root.render(
      React.createElement(PropertyPanelRow, {
        label: this.displayName,
        isChanged: get(this.name) !== undefined,
        onReset: () => this.write(undefined),
        children: React.createElement(RetryBackoffRow, {
          value: get(this.name),
          onChange: (v: number | undefined) => this.write(v),
          policy: {
            delayMs: get('delayMs'),
            backoffMultiplier: get('backoffMultiplier'),
            maxDelayMs: get('maxDelayMs'),
            jitter: get('jitter')
          },
          ariaLabel: this.displayName
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

  /**
   * Re-render when the trigger this row describes changes (WFA-008).
   *
   * These rows are a view of a backend object, and since WFA-008 that object is
   * editable — from this panel's own surface (the Triggers panel), from the
   * node's menu, or from MCP. The property editor does not rebuild a row on
   * `parametersChanged`, so without this a selected webhook kept reporting the
   * cron and target it had when it was selected: the same staleness the live
   * pass caught in `WorkflowFunctionRefType`, which subscribes for the same
   * reason.
   *
   * Subscribed on the node reached through `graph`/`stepId`, not on
   * `parent.model` — that is a `ModelProxy` (F46), and reading through it for
   * anything but a parameter is the silent-undefined trap.
   */
  render() {
    const el = super.render();
    this.graph?.findNodeWithId(this.stepId)?.on('parametersChanged', () => this.renderReact(), this);
    return el;
  }

  dispose() {
    this.graph?.findNodeWithId(this.stepId)?.off(this);
    super.dispose();
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
