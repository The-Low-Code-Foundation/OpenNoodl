import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { NodeLibrary } from '@noodl-models/nodelibrary';
import { listPortTypeFor } from '@noodl-core-ui/components/json-editor/utils/listValueCodec';
import { capabilityProbes, gateForPort, resolveGateTarget, type GateTarget } from '@noodl-utils/capability-gating';
import { decoratePortElement } from '@noodl-utils/capability-gating/portDecoration';
import { describePortElement } from '@noodl-utils/portDescription';

import { EventDispatcher } from '../../../../../../shared/utils/EventDispatcher';
import View from '../../../../../../shared/ListenableView';
import PopupLayer from '../../../popuplayer';
import { CodeEditorType } from '../CodeEditor';
import { PropertyGroups, PropertyGroupModel } from '../components/PropertyGroups';
import { ModelProxy } from '../models/modelProxy';
import { PagesType } from '../Pages';
import { getEditType } from '../utils';
import { AlignToolsType } from './AlignTools/AlignToolsType';
import { BasicType } from './BasicType';
import { BooleanType } from './BooleanType';
import { ByobFilterType } from './ByobFilterType';
import { ColorType } from './ColorPicker/ColorType';
import { ComponentType } from './ComponentType';
import { CurveType } from './CurveEditor/CurveType';
import { Dimension } from './Dimension';
import { EnumType } from './EnumType';
import { SourceCodeType } from './FilePicker/SourceCodeType';
import { FontType } from './FontType';
import { IconType } from './IconType';
import { IdentifierType } from './IdentifierType';
import { ImageType } from './ImageType';
import { ListValueType } from './ListValueType';
import { LogicBuilderHiddenType } from './LogicBuilderHiddenType';
import { LogicBuilderWorkspaceType } from './LogicBuilderWorkspaceType';
import { MarginPaddingType } from './MarginPaddingType';
import { NumberWithUnits } from './NumberWithUnits';
import { PopoutGroup } from './PopoutGroup';
import { PropListType } from './PropListType';
import {
  WorkflowBackoffType,
  WorkflowCasesType,
  WorkflowConditionType,
  WorkflowFunctionRefType,
  WorkflowParamsType,
  WorkflowTransformType,
  WorkflowTriggerInfoType,
  WorkflowValueType
} from './WorkflowTypes';
import { QuerySortingType } from './QuerySortingType';
import { ResizingType } from './ResizingType';
import { SizeModeType } from './SizeModeType';
import { StringListType } from './StringList/StringListType';
import { TabGroup } from './TabGroup';
import { TextAreaType } from './TextAreaType';
import { TextStyleType } from './TextStyleType';
import { VariableType } from './VariableType';

const groupExpansions = {};

type Port = {
  popout?: TSFixme;
  group: string;
  name: string;
  displayName?: string;
  index?: number;
  plug?: string;
  type?: string;
};

export class Ports extends View {
  model: ModelProxy;
  popout: TSFixme;
  _selectedTabForGroup: TSFixme;
  activePopout: TSFixme;
  _portsHash: TSFixme;
  views: TSFixme = [];
  _toolsType: TSFixme;
  groups: TSFixme[];
  el: HTMLElement;
  private root: Root | null = null;
  private _unsubscribeProbes: (() => void) | null = null;

  constructor(args) {
    super();
    this.model = args.model;
    this.popout = args.popout;
    this._selectedTabForGroup = {};

    this.bindModel(this.model);

    // BCN-010: a probe settles asynchronously, so the panel has to be told.
    this._unsubscribeProbes = capabilityProbes().onChange(() => this.renderGroups());
  }
  showPopout(popout) {
    if (this.activePopout) {
      this.hidePopout();
    }

    const _onClose = popout.onClose;
    popout.onClose = () => {
      this.activePopout = null;
      _onClose && _onClose();
    };

    this.activePopout = PopupLayer.instance.showPopout(popout);
  }
  hidePopout() {
    PopupLayer.instance.hidePopout(this.activePopout);
  }
  bindModel(model) {
    model.on(
      [
        'instancePortsChanged',
        'portAdded',
        'portRemoved',
        'portRenamed',
        'connectionRemoved',
        'variantChanged',
        'variantUpdated'
      ],
      () => {
        this.renderGroups();
      },
      this
    );

    model.on(
      ['modelParameterUndo', 'modelParameterRedo'],
      () => {
        this._portsHash = undefined;
        this.renderGroups();
      },
      this
    );

    model.owner &&
      model.owner.on(
        ['connectionAdded', 'connectionRemoved'],
        () => {
          this.renderGroups();
        },
        this
      );
  }
  dispose() {
    this._unsubscribeProbes && this._unsubscribeProbes();
    this._unsubscribeProbes = null;
    this.model && this.model.off(this);
    // @ts-expect-error
    this.model && this.model.owner && this.model.owner.off(this);
    EventDispatcher.instance.off(this);

    this.views.forEach((v) => v.dispose && v.dispose());

    if (this.root) {
      this.root.unmount();
      this.root = null;
    }

    this.hidePopout();
  }
  /**
   * Everything the gates would render, as a string, for the re-render hash.
   *
   * Computed rather than snapshotted from the cache so it also moves when the
   * *project's* backend changes, which is the switch the live pass drives.
   */
  private capabilitySignature(): string {
    const typeName = this.model.type && (this.model.type.name || this.model.type.localName);
    if (!typeName) return '';
    const target = this.capabilityTarget();
    const parts = [target.backendId || '', target.type || ''];
    for (const port of this._getPorts()) {
      const gate = gateForPort(typeName, port.name, target);
      if (gate) parts.push(`${port.name}:${gate.effective}:${gate.reason || ''}`);
    }
    return parts.join('|');
  }

  /**
   * The backend this node's ports are gated against — BCN-010.
   *
   * Resolved once per render rather than per row: every port on one node
   * resolves to the same backend, and `resolveGateTarget` reads project
   * metadata. The node's own `backendId` parameter wins when it has one (the
   * six Record and two relation nodes, since BCN-004 step 5); everything else
   * gets the project's active backend, which is what it resolves to at runtime.
   */
  private capabilityTarget(): GateTarget {
    try {
      const backendId = this.model.getParameter ? (this.model.getParameter('backendId') as string) : undefined;
      return resolveGateTarget(backendId);
    } catch (e) {
      // A panel that cannot resolve a backend must still render its ports.
      return {};
    }
  }

  /** Render a group's views (and their child views) and collect their elements. */
  renderParams(views): TSFixme[] {
    const els = [];
    const target = this.capabilityTarget();
    const typeName = this.model.type && (this.model.type.name || this.model.type.localName);

    // ERG-004 §7.7 item 2: the port objects, so a row can be given its own
    // `description`. Looked up by name rather than read off the view, because
    // only some `fromPort` implementations keep a `.port` reference — the same
    // reason the decoration below is a wrapper and not a prop.
    const portsByName = new Map<string, TSFixme>();
    for (const port of this._getPorts()) portsByName.set(port.name, port);

    for (const j in views) {
      const v = views[j];
      v.childViews && v.childViews.forEach((v) => v.render()); // Render any child views first

      // BCN-010: the one place every row's element passes through, whatever
      // class produced it. See `portDecoration.ts` for why the gate is a wrapper
      // here rather than two props on twenty-nine row classes. ERG-004's
      // description hangs off the same seam, for the same reason — see
      // `portDescription.ts`.
      const el = describePortElement(v.render(), v.name ? portsByName.get(v.name) : undefined);
      const gate = typeName && v.name ? gateForPort(typeName, v.name, target) : undefined;
      els.push(gate ? decoratePortElement(el, gate, target, v.name) : el);
    }
    return els;
  }
  renderGroups() {
    if (!this.root) return; // not rendered yet

    const inputData = {
      ports: this._getPorts(),
      variant: this.model.variantName,
      // BCN-010: without this, a probe that settles *after* the panel is open
      // never reaches the screen — the ports have not changed, so the hash has
      // not changed, and `renderGroups` returns early. Subscribe To Changes on
      // Directus is exactly that case: it paints closed-because-unprobed and
      // then a real answer arrives ~200ms later.
      capabilities: this.capabilitySignature()
    };

    const _portsHash = JSON.stringify(inputData);
    if (_portsHash === this._portsHash)
      // No change in ports, no need to re-render
      return;

    this._portsHash = _portsHash;

    //remember the scrolling so a re-render doesn't reset the scroll position
    let scrollTop = 0;
    if (this.el.parentElement) {
      scrollTop = this.el.parentElement.parentElement.scrollTop;
    }

    const groups = this.getViewGroupsFromPorts();

    // If only one group then don't render group sections
    const showHeaders = !(groups.length === 1 && groups[0].name === 'Other');

    const groupModels: PropertyGroupModel[] = groups.map((g) => {
      if (groupExpansions.hasOwnProperty(g.name)) {
        g.isExpanded = groupExpansions[g.name];
      }

      return {
        name: g.name,
        isExpanded: g.isExpanded,
        els: this.renderParams(g.views)
      };
    });

    this.root.render(React.createElement(PropertyGroups, { groups: groupModels, showHeaders }));

    //and now the rendering is done. In case any scrolling was done, set the scrolling again.
    //React commits asynchronously, so this has to wait for the rows to be in the DOM.
    if (scrollTop) {
      setTimeout(() => {
        if (this.el.parentElement) {
          this.el.parentElement.parentElement.scrollTop = scrollTop;
        }
      }, 0);
    }
  }
  render() {
    this._portsHash = undefined; // Clear cache

    if (!this.el) {
      this.el = document.createElement('div');

      // Some element in the prop editor has gained focus — move the ports to
      // the front so dropdowns are not clipped by the panels below.
      this.el.addEventListener('focusin', () => {
        this.el.style.zIndex = '1000';
      });
      this.el.addEventListener('focusout', () => {
        // Move back when blurred (wait 500ms)
        setTimeout(() => {
          this.el.style.zIndex = '';
        }, 500);
      });
    }

    if (!this.root) {
      this.root = createRoot(this.el);
    }

    this.renderGroups();
  }
  setParameterEx(name, newvalue, oldvalue, skipundo) {
    this.model.setParameter(name, newvalue, {
      undo: !skipundo,
      oldValue: oldvalue,
      label: 'edit parameter'
    });
  }
  setParameter(name, newvalue) {
    this.model.setParameter(name, newvalue, { undo: true, label: 'edit parameter' });
  }
  viewClassForPort(p) {
    const type = getEditType(p);

    // Check for custom editorType
    if (typeof type === 'object' && type.editorType === 'logic-builder-workspace') {
      return LogicBuilderWorkspaceType;
    }

    // Hidden type for internal Logic Builder parameters (renders nothing)
    if (typeof type === 'object' && type.editorType === 'logic-builder-hidden') {
      return LogicBuilderHiddenType;
    }

    // Align tools types
    function isOfAlignToolsType() {
      return NodeLibrary.nameForPortType(type) === 'enum' && typeof type === 'object' && type.alignComp !== undefined;
    }

    // Size mode types
    function isOfSizeModeType() {
      return NodeLibrary.nameForPortType(type) === 'enum' && typeof type === 'object' && type.sizeComp === 'mode';
    }

    // Enum types
    function isOfEnumType() {
      return NodeLibrary.nameForPortType(type) === 'enum' && typeof type === 'object' && type.enums;
    }

    // Color types
    function isOfColorType() {
      return NodeLibrary.nameForPortType(type) === 'color';
    }

    // Boolean types
    function isOfBooleanType() {
      return NodeLibrary.nameForPortType(type) === 'boolean';
    }

    // Basic types
    function isOfBasicType() {
      const name = NodeLibrary.nameForPortType(type);
      return name === 'string' || name === 'number';
    }

    /**
     * ## Which string ports get `fx` — POL-011, decided rather than inherited
     *
     * A `string` port can reach four different views, and until POL-011 **only
     * `BasicType` had heard of expressions**. So Button's `label` offered `fx`
     * and the Text node's `text` did not, purely because the latter is declared
     * `multiline` and multiline had its own view. That was never a decision.
     *
     * It is one now, per route:
     *
     * | Route | `fx` | Why |
     * |---|---|---|
     * | `BasicType` — plain `string`/`number` | **yes** | the original, unchanged |
     * | `TextAreaType` — `multiline` | **yes** | the reported gap; the literal is multiline, the expression is one line |
     * | `CodeEditorType` — `codeeditor` | **no** | the value already *is* code; an expression producing code is a second language in one field, and nothing asked for it |
     * | `IdentifierType` — `identifierOf` | **no** | a name chosen from a set the project holds. An expression could name something that does not exist, and the picker could not show it. Same reasoning as `EnumType` |
     *
     * The two `no`s are structural rather than a flag: neither view renders
     * `PropertyPanelInput`, so neither can offer the toggle — `CodeEditorType`
     * is its own editor and `IdentifierType` is a `PickerTypeView`. A
     * `supportsExpression: false` on them would be a prop nothing reads. The
     * decision is recorded here, at the one place that routes them.
     */
    function isOfTextAreaType() {
      return NodeLibrary.nameForPortType(type) === 'string' && typeof type === 'object' && type.multiline;
    }

    // Is of code editor type
    function isOfCodeEditorType() {
      return NodeLibrary.nameForPortType(type) === 'string' && typeof type === 'object' && type.codeeditor;
    }

    // Array- and object-typed ports both edit as a literal.
    //
    // Without the object branch `viewClassForPort` returned undefined and `_getPorts`
    // filtered the row out altogether, so an object-typed input was connection-only with
    // nothing on screen to say why — you could not give a Global Store its starting shape
    // or an SSE call its headers without wiring a Function node whose whole body was a
    // literal. `Node.setInputValue` parses a string arriving on either type.
    //
    // ERG-003: both now route to `ListValueType` (the shared `JSONEditor`) rather than to
    // `CodeEditorType`, so they gain a visual builder. The stored form is unchanged, and
    // `listPortTypeFor` is the one definition of "is this a list-shaped port" — the catalog
    // test derives its expectation from the same function, so the set of ports the shared
    // editor covers cannot drift from the set it is claimed to cover.
    function isOfListValueType() {
      const t = listPortTypeFor(type);
      return t === 'array' || t === 'object';
    }

    // Image ref type
    function isOfImageType() {
      return NodeLibrary.nameForPortType(type) === 'image';
    }

    // Icon ref type
    function isOfIconType() {
      return NodeLibrary.nameForPortType(type) === 'icon';
    }

    // Font ref type
    function isOfFontType() {
      return NodeLibrary.nameForPortType(type) === 'font';
    }

    // Text style type
    function isOfTextStyleType() {
      return NodeLibrary.nameForPortType(type) === 'textStyle';
    }

    // Component reference type
    function isOfComponentType() {
      return NodeLibrary.nameForPortType(type) === 'component';
    }

    // Number with units
    function isOfNumberWithUnitsType() {
      return NodeLibrary.nameForPortType(type) === 'number' && type.units !== undefined;
    }

    // Dimension type (number, unit dropdown and special boolean for fixed dimension)
    function isOfDimensionType() {
      return NodeLibrary.nameForPortType(type) === 'dimension';
    }

    // Is source code file
    function isOfSourceCodeFileType() {
      return NodeLibrary.nameForPortType(type) === 'source';
    }

    // Is string list type
    function isOfStringListType() {
      return NodeLibrary.nameForPortType(type) === 'stringlist';
    }

    // Is margin padding type
    function isOfMarginPaddingType() {
      //  return NodeLibrary.nameForPortType(type) === 'margins' || NodeLibrary.nameForPortType(type) === 'padding';
      return type && type.marginPaddingComp !== undefined;
    }

    // Is of resizing type
    function isOfResizingType() {
      return NodeLibrary.nameForPortType(type) === 'resizing';
    }

    // Is of variable type
    function isOfVariableType() {
      return NodeLibrary.nameForPortType(type) === 'variable';
    }

    // Is of identifier
    function isOfIdentifierType() {
      return NodeLibrary.nameForPortType(type) === 'string' && typeof type === 'object' && type.identifierOf;
    }

    // Is of curve
    function isOfCurveType() {
      return NodeLibrary.nameForPortType(type) === 'curve';
    }

    // Is of query
    function isOfQueryFilterType() {
      return NodeLibrary.nameForPortType(type) === 'query-filter';
    }

    function isOfQuerySortingType() {
      return NodeLibrary.nameForPortType(type) === 'query-sorting';
    }

    function isOfByobFilterType() {
      return NodeLibrary.nameForPortType(type) === 'byob-filter';
    }

    // Is of pages type
    function isOfPagesType() {
      return NodeLibrary.nameForPortType(type) === 'pages';
    }

    // Is of proplist
    // WFA-004: workflow step params. Three more port types beside the thirty
    // above — the registry's intended extension point.
    function isOfWorkflowConditionType() {
      return NodeLibrary.nameForPortType(type) === 'workflow-condition';
    }

    function isOfWorkflowCasesType() {
      return NodeLibrary.nameForPortType(type) === 'workflow-cases';
    }

    function isOfWorkflowValueType() {
      const name = NodeLibrary.nameForPortType(type);
      return name === 'workflow-value' || name === 'workflow-path';
    }

    // CWF-001: `call-function`'s param mapping — a dictionary of author-chosen
    // names, each holding one of the values above.
    function isOfWorkflowParamsType() {
      return NodeLibrary.nameForPortType(type) === 'workflow-params';
    }

    // CWF-004: a transform's `output` — one row per field of the object the
    // step produces, each row a value or one operation from the served table.
    function isOfWorkflowTransformType() {
      return NodeLibrary.nameForPortType(type) === 'workflow-transform';
    }

    // CWF-005: an attempt count that shows the delay sequence it implies.
    function isOfWorkflowBackoffType() {
      return NodeLibrary.nameForPortType(type) === 'workflow-backoff';
    }

    // WFA-005: a read-only fact about a trigger — a backend object drawn on the
    // canvas as an entry node. A row, not a control.
    function isOfWorkflowTriggerInfoType() {
      return NodeLibrary.nameForPortType(type) === 'workflow-trigger-info';
    }

    // WFA-006: the cloud function a step calls. A name, plus what it resolves to
    // in the project and on the backend — which are two different questions.
    function isOfWorkflowFunctionRefType() {
      return NodeLibrary.nameForPortType(type) === 'workflow-function-ref';
    }

    function isOfPropListType() {
      return NodeLibrary.nameForPortType(type) === 'proplist';
    }

    if (isOfAlignToolsType()) return AlignToolsType;
    else if (isOfSizeModeType()) return SizeModeType;
    else if (isOfEnumType()) return EnumType;
    else if (isOfColorType()) return ColorType;
    else if (isOfBooleanType()) return BooleanType;
    else if (isOfTextAreaType()) return TextAreaType;
    else if (isOfCodeEditorType()) return CodeEditorType;
    else if (isOfListValueType()) return ListValueType;
    else if (isOfMarginPaddingType()) return MarginPaddingType;
    else if (isOfNumberWithUnitsType()) return NumberWithUnits;
    else if (isOfDimensionType()) return Dimension;
    else if (isOfIdentifierType()) return IdentifierType;
    else if (isOfBasicType()) return BasicType;
    else if (isOfImageType()) return ImageType;
    else if (isOfIconType()) return IconType;
    else if (isOfFontType()) return FontType;
    else if (isOfTextStyleType()) return TextStyleType;
    else if (isOfComponentType()) return ComponentType;
    else if (isOfSourceCodeFileType()) return SourceCodeType;
    else if (isOfStringListType()) return StringListType;
    else if (isOfResizingType()) return ResizingType;
    else if (isOfVariableType()) return VariableType;
    else if (isOfCurveType()) return CurveType;
    // BCN-003b: both filter ports render the one builder. `QueryFilterType` and
    // the `QueryEditor` filter components it rendered are deleted, not
    // deprecated — a second builder for one idea is what this task retired.
    else if (isOfQueryFilterType()) return ByobFilterType;
    else if (isOfQuerySortingType()) return QuerySortingType;
    else if (isOfByobFilterType()) return ByobFilterType;
    else if (isOfPagesType()) return PagesType;
    else if (isOfPropListType()) return PropListType;
    else if (isOfWorkflowConditionType()) return WorkflowConditionType;
    else if (isOfWorkflowCasesType()) return WorkflowCasesType;
    else if (isOfWorkflowValueType()) return WorkflowValueType;
    else if (isOfWorkflowParamsType()) return WorkflowParamsType;
    else if (isOfWorkflowTransformType()) return WorkflowTransformType;
    else if (isOfWorkflowBackoffType()) return WorkflowBackoffType;
    else if (isOfWorkflowTriggerInfoType()) return WorkflowTriggerInfoType;
    else if (isOfWorkflowFunctionRefType()) return WorkflowFunctionRefType;
  }
  _getPorts(): readonly Port[] {
    let ports = this.model.getPorts('input');

    // Is type editable
    function isOfEditableType(p) {
      return !(typeof p.type === 'object' && p.type.allowConnectionsOnly);
    }

    // Remote not editable and ports that don't have an associated view
    ports = ports.filter((p) => isOfEditableType(p) && this.viewClassForPort(p) !== undefined);

    // If this is a popout remote all ports not beloning to this popout
    if (this.popout !== undefined)
      ports = ports.filter((p) => !(p.popout === undefined || p.popout.group !== this.popout));

    return ports;
  }

  getViewGroupsFromPorts() {
    const ports = this._getPorts();

    // Loop over all ports and create views.
    // DEBT-010: dispose the previous render's views before rebuilding — this
    // used to just drop them (as the legacy `el.html('')` did), leaking every
    // row's React root on each panel re-render.
    this.views.forEach((v) => v.dispose && v.dispose());

    this._toolsType = {};
    const _viewForPort = {};
    const _tabViews = {};
    const _popoutViews = {};
    this.views = [];

    let v: TSFixme;
    for (const i in ports) {
      const p = ports[i];

      if (p.popout !== undefined && this.popout === undefined) {
        // This port belongs to a popout
        if (_popoutViews[p.popout.group] === undefined) {
          _popoutViews[p.popout.group] = new PopoutGroup({
            group: p.popout.parentGroup || p.group,
            popoutGroup: p.popout.group,
            label: p.popout.label,
            parent: this
          });

          this.views.push(_popoutViews[p.popout.group]);
          _viewForPort[p.name] = v;
        }

        continue;
      }

      const viewClass = this.viewClassForPort(p);
      if (viewClass !== undefined) {
        v = viewClass.fromPort({ port: p, parent: this });
        if (v !== undefined) {
          // Rows whose default comes from a text style refresh when it changes.
          // Done here rather than in each row's render() because the converted
          // (React) rows do not all chain up to TypeView.render().
          v.bindStyleDefaultWatch && v.bindStyleDefaultWatch();

          this.views.push(v);
          _viewForPort[p.name] = v;
        }
      }
    }

    // Group property views
    const groups = (this.groups = []);

    function addToGroup(view) {
      const name = view.group ? view.group : 'Other';
      for (const i in groups) {
        const g = groups[i];
        if (g.name === name) {
          g.views.push(view);
          return;
        }
      }

      groups.push({ name: name, views: [view], isExpanded: true });
    }

    for (const i in this.views) {
      v = this.views[i];
      if (v.port !== undefined && v.port.parent !== undefined) {
        // This view port is a child to a parent port
        // add it to that view
        const parentV = _viewForPort[v.port.parent];
        parentV && parentV.addChildTypeView && parentV.addChildTypeView(v);
      } else if (v.port !== undefined && v.port.tab !== undefined) {
        // This port belongs to a tab group
        const group = v.port.tab.group;
        if (_tabViews[group] === undefined) {
          _tabViews[group] = new TabGroup({
            group: v.group,
            tabGroup: group,
            parent: this
          });
          addToGroup(_tabViews[group]);
        }
        _tabViews[group].addView(v);
      } else addToGroup(v);
    }

    return this.groups;
  }
}
