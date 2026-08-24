import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { NodeLibrary } from '@noodl-models/nodelibrary';
import { capabilityProbes, gateForPort, resolveGateTarget, type GateTarget } from '@noodl-utils/capability-gating';
import { decoratePortElement } from '@noodl-utils/capability-gating/portDecoration';
import { describePortElement } from '@noodl-utils/portDescription';

import { listPortTypeFor } from '@noodl-core-ui/components/json-editor/utils/listValueCodec';

import View from '../../../../../../shared/ListenableView';
import { EventDispatcher } from '../../../../../../shared/utils/EventDispatcher';
import PopupLayer from '../../../popuplayer';
import { CodeEditorType } from '../CodeEditor';
import { PropertyFilterInput } from '../components/PropertyFilterInput';
import { PropertyGroups, PropertyGroupModel } from '../components/PropertyGroups';
import { ModelProxy } from '../models/modelProxy';
import { PagesType } from '../Pages';
import { countFilterableRows, filterGroups, isFilterActive, shouldOfferFilter } from '../propertyPanelFilter';
import { ADVANCED_CSS_GROUP, countActivePorts, orderPropertyGroups } from '../propertyPanelTiers';
import { propertyPanelViewState } from '../propertyPanelViewState';
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
import { QuerySortingType } from './QuerySortingType';
import { ResizingType } from './ResizingType';
import { SizeModeType } from './SizeModeType';
import { StringListType } from './StringList/StringListType';
import { TabGroup } from './TabGroup';
import { TextAreaType } from './TextAreaType';
import { TextStyleType } from './TextStyleType';
import { VariableType } from './VariableType';
import {
  WorkflowBackoffType,
  WorkflowCasesType,
  WorkflowConditionType,
  WorkflowFunctionRefType,
  WorkflowParamsType,
  WorkflowTransformType,
  WorkflowTriggerInfoType,
  WorkflowValidateType,
  WorkflowValueType
} from './WorkflowTypes';

type Port = {
  popout?: TSFixme;
  group: string;
  name: string;
  displayName?: string;
  index?: number;
  plug?: string;
  type?: string;
};

/** How many frames to keep looking for the panel's scroller before giving up. */
const SCROLL_BIND_ATTEMPTS = 5;

export class Ports extends View {
  model: ModelProxy;
  popout: TSFixme;
  _selectedTabForGroup: TSFixme;
  activePopout: TSFixme;
  _portsHash: TSFixme;
  views: TSFixme = [];
  _toolsType: TSFixme;
  /** FB-017 AC7: the raw text in the filter box. Empty means the tier view. */
  _filterQuery = '';
  /**
   * Expansion overrides that live only as long as the current filter.
   *
   * 🔴 Non-null exactly while a filter is active, and that is what makes AC7's "clearing the
   * filter restores the tier view" true rather than approximately true. A hit inside `Advanced
   * CSS` has to open it, but opening it by calling `propertyPanelViewState.setExpanded` would
   * write a searching keystroke into the builder's persisted preferences — so the next node they
   * select, and every session after it, would open with Advanced CSS expanded because they once
   * looked for `transform origin`. The tier split would erode itself one search at a time.
   *
   * Absent an entry a group reads as expanded, since a query's hits must be visible. Present
   * entries are the ones the builder collapsed *during* the search, which is them saying "not
   * that one" and is worth honouring until the box is cleared.
   */
  _filterExpansion: Record<string, boolean> | null = null;
  /** The element {@link bindScrollTracking} last attached to, so the listener can be moved. */
  _scrollTrackedEl: HTMLElement | undefined;
  _onScroll: (() => void) | undefined;
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
  /**
   * Bind scroll tracking and restore the offset, once the panel is actually in the DOM.
   *
   * 🔴 This runs on a short retry rather than a single `setTimeout(0)`, and that is the whole
   * reason scroll memory works at all. `index.tsx` builds the view with
   * `new PropertyEditorView(props); instance.render()` and only *then* calls `setInstance`,
   * which is the state update that mounts the `Frame` and the `ScrollArea` around it. So the
   * first `renderGroups` for a newly selected node runs while `this.el` has no parent at all —
   * `scrollContainer()` finds nothing, and a listener bound there would be bound to nothing.
   *
   * The previous attempt bound only inside `if (scrollTop)`, which is never true on a first
   * render, so the listener was never attached and nothing was ever recorded to restore. ⚠️ That
   * failed *silently and identically* to the pre-existing defect it was meant to fix: a panel
   * that opens at the top looks the same whether the offset was restored as `0` or never stored.
   *
   * Bounded at {@link SCROLL_BIND_ATTEMPTS}, because a panel that has not mounted after a few
   * frames is one that is not going to.
   */
  settleScroll(scrollTop: number, attempt = 0): void {
    setTimeout(
      () => {
        this.bindScrollTracking();

        const target = this.scrollContainer();
        if (target) {
          if (scrollTop) target.scrollTop = scrollTop;
        } else if (attempt < SCROLL_BIND_ATTEMPTS) {
          this.settleScroll(scrollTop, attempt + 1);
        }
      },
      attempt === 0 ? 0 : 50
    );
  }

  /**
   * The element that actually scrolls this panel.
   *
   * 🔴 FB-017 found the existing scroll-restore reading the wrong element, and it had been wrong
   * for as long as the panel has been inside a `ScrollArea`. The code below used to say
   * `this.el.parentElement.parentElement`, which lands on `.sidebar-property-editor` — that
   * carries `overflow-y: auto` but its content never overflows it, so its `scrollHeight` equals
   * its `clientHeight` and its `scrollTop` is permanently `0`. The real scroller is
   * `ScrollArea`'s root, six levels up, mounted by `index.tsx` around the legacy `Frame`.
   *
   * So "remember the scrolling so a re-render doesn't reset the scroll position" has been reading
   * `0`, storing `0`, and restoring nothing — which is exactly the symptom Jordan reported as the
   * single costliest thing about the panel. ⚠️ A fixed hop count is what made it silent: two
   * `parentElement`s cannot fail, they just arrive somewhere else after someone wraps the panel.
   * This walks for the property instead of counting levels.
   */
  scrollContainer(): HTMLElement | undefined {
    let el = this.el ? this.el.parentElement : null;

    while (el) {
      const overflowY = getComputedStyle(el).overflowY;
      if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
        return el;
      }
      el = el.parentElement;
    }

    return undefined;
  }

  /**
   * Start recording this panel's scroll offset, once there is something to record it on.
   *
   * Bound lazily from `renderGroups` rather than in `render`, because the scroller is not this
   * view's element and does not exist — or does not yet overflow — when `el` is created. Bound
   * against the specific element it was found on, so a `ScrollArea` replaced underneath the panel
   * moves the listener rather than leaving it on a detached node.
   */
  bindScrollTracking(): void {
    const scroller = this.scrollContainer();
    if (!scroller || scroller === this._scrollTrackedEl) return;

    if (this._scrollTrackedEl && this._onScroll) {
      this._scrollTrackedEl.removeEventListener('scroll', this._onScroll);
    }

    this._onScroll = () => {
      // ⚠️ A filtered panel is a different document: its offsets are measured against a handful
      // of surviving rows and mean nothing once the box is cleared. Recording one would replace
      // the offset the builder actually left the node at — so the search reads the scroll memory
      // and never writes to it.
      if (this._filterExpansion) return;
      propertyPanelViewState.setScroll(this.nodeId(), scroller.scrollTop);
    };
    this._scrollTrackedEl = scroller;
    scroller.addEventListener('scroll', this._onScroll);
  }

  /**
   * The selected node's id — the key FB-017 remembers a scroll offset under.
   *
   * `this.model` is a `ModelProxy`; the id lives on the `NodeGraphNode` it wraps. Optional all
   * the way down because the ports view is also built for things that are not graph nodes (the
   * component-inputs editors), and a missing id must mean "remember nothing" rather than throw.
   */
  nodeId(): string | undefined {
    return this.model && this.model.model ? this.model.model.id : undefined;
  }

  /**
   * How many of a group's ports are connected or set — FB-017 AC2's badge.
   *
   * Counted from the *views*, because that is the set of ports the group actually drew: a port
   * filtered out by `_getPorts` (a capability gate, an `allowConnectionsOnly` object type) has
   * no row to be hidden, so counting it would report activity the builder cannot go and find.
   *
   * ⚠️ `TabGroup` views stand in for several ports at once and carry no `name`, so they
   * contribute nothing here rather than a wrong number. A tab group inside a collapsed section
   * is the one case the badge under-reports, and under-reporting is the safe direction: the
   * badge exists to say "look in here", never to certify that there is nothing to find.
   */
  countActiveInGroup(group: TSFixme): number {
    const names: string[] = [];
    for (const view of group.views || []) {
      if (view && typeof view.name === 'string') names.push(view.name);
    }

    return countActivePorts(names, {
      isConnected: (name) => Boolean(this.model && this.model.isPortConnected(name)),
      isSet: (name) => Boolean(this.model) && this.model.parameters[name] !== undefined
    });
  }

  /**
   * Whether a group draws open right now — the persisted preference, or the search's override.
   *
   * While a filter is active every group reads as expanded unless the builder has collapsed it
   * during this search, because a hit the query found and the panel then hid is worse than no
   * filter at all. See {@link _filterExpansion} for why this is not simply written through to
   * `propertyPanelViewState`.
   */
  isGroupExpanded(groupName: string): boolean {
    if (this._filterExpansion) {
      return Object.prototype.hasOwnProperty.call(this._filterExpansion, groupName)
        ? this._filterExpansion[groupName]
        : true;
    }

    return propertyPanelViewState.isExpanded(groupName);
  }

  /**
   * Take a new query from the filter box.
   *
   * The override map is created and destroyed on the *transitions* into and out of an active
   * filter, not on every keystroke — otherwise a group the builder collapsed mid-search would
   * spring back open on the next character they typed.
   */
  setFilterQuery(value: string): void {
    const wasActive = isFilterActive(this._filterQuery);
    const nowActive = isFilterActive(value);

    this._filterQuery = value;

    if (nowActive !== wasActive) {
      this._filterExpansion = nowActive ? {} : null;
    }

    this.renderGroups();
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
      capabilities: this.capabilitySignature(),
      // 🔴 The RAW query, not whether it is active. The filter box is a controlled input rendered
      // from this very call, so a keystroke that does not change the hash is a keystroke that
      // never reaches the box — type a space and the panel would appear frozen.
      filter: this._filterQuery
    };

    const _portsHash = JSON.stringify(inputData);
    if (_portsHash === this._portsHash)
      // No change in ports, no need to re-render
      return;

    this._portsHash = _portsHash;

    //remember the scrolling so a re-render doesn't reset the scroll position
    //
    // FB-017 / Jordan §4: falling back to the node's *remembered* offset is what makes a
    // reselect land where the builder left it. A re-render mid-session measures a live
    // scroller and reads the same number back; a fresh selection measures a panel that has
    // just been rebuilt at 0, and this is the only place that knows better.
    this.bindScrollTracking();

    const scroller = this.scrollContainer();
    let scrollTop = scroller ? scroller.scrollTop : 0;
    if (!scrollTop && !isFilterActive(this._filterQuery)) {
      scrollTop = propertyPanelViewState.getScroll(this.nodeId());
    }

    const allGroups = this.getViewGroupsFromPorts();

    // If only one group then don't render group sections
    //
    // 🔴 Both of these read the UNFILTERED groups, deliberately. Deciding either against the
    // surviving rows would let the panel's chrome change shape as a builder types: filtering down
    // to two rows would take the filter box away from under the cursor, and filtering down to one
    // group would drop every heading — including the one naming the group the hit was found in,
    // which is the answer to "where did this property live".
    const showHeaders = !(allGroups.length === 1 && allGroups[0].name === 'Other');
    const offerFilter = shouldOfferFilter(allGroups);

    const groups = offerFilter ? filterGroups(allGroups, this._filterQuery) : allGroups;

    // FB-017: two tiers. `orderPropertyGroups` decides which groups fold into `Advanced CSS`
    // and puts the rest in Richard's order — the node's own subject headings first, then the
    // shared CSS basics. See `propertyPanelTiers.ts` for the ruling and why it is keyed by
    // group name rather than by a per-port `tier` field.
    const { basic, advanced } = orderPropertyGroups(groups);

    const toModel = (g): PropertyGroupModel => ({
      name: g.name,
      isExpanded: this.isGroupExpanded(g.name),
      // AC2: a collapsed group still reports how much of it is live, so folding CSS away
      // cannot become a new hiding place for FB-018's confusion.
      activeCount: this.countActiveInGroup(g),
      els: this.renderParams(g.views)
    });

    this.root.render(
      React.createElement(
        React.Fragment,
        null,
        offerFilter &&
          React.createElement(PropertyFilterInput, {
            value: this._filterQuery,
            matchCount: countFilterableRows(groups),
            onChange: (value: string) => this.setFilterQuery(value)
          }),
        React.createElement(PropertyGroups, {
          groups: basic.map(toModel),
          advancedGroups: advanced.map(toModel),
          isAdvancedExpanded: this.isGroupExpanded(ADVANCED_CSS_GROUP),
          showHeaders,
          filterQuery: isFilterActive(this._filterQuery) ? this._filterQuery : undefined,
          onToggleGroup: (groupName: string, isExpanded: boolean) => {
            if (this._filterExpansion) {
              // Transient while searching — see the field's note. Writing this to settings would
              // persist a keystroke as a preference.
              this._filterExpansion[groupName] = isExpanded;
            } else {
              propertyPanelViewState.setExpanded(groupName, isExpanded);
            }
            // The ports have not changed, so `renderGroups`'s hash guard would refuse the
            // re-render that draws the new state. Clearing it is what makes the click visible.
            this._portsHash = undefined;
            this.renderGroups();
          }
        })
      )
    );

    //and now the rendering is done. In case any scrolling was done, set the scrolling again.
    //React commits asynchronously, so this has to wait for the rows to be in the DOM.
    this.settleScroll(scrollTop);
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

    // CWF-004 slice 2: a validate step's `rules` — one row per thing that must
    // be true, each a path assertion or a condition.
    function isOfWorkflowValidateType() {
      return NodeLibrary.nameForPortType(type) === 'workflow-validate';
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
    else if (isOfWorkflowValidateType()) return WorkflowValidateType;
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
