'use strict';

import React from 'react';
import ReactDOM from 'react-dom';

import type { TSFixme } from '../typings/global';
import type {
  ComponentInstanceLike,
  DynamicPortEntry,
  GraphModelLike,
  GraphNodeModel,
  InputPortDefinition,
  InspectInfo,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeScopeLike,
  NodeSSRCompat,
  NodeVariant,
  OutputPortDefinition,
  PortLabelTruncationMode,
  PortType,
  StateTransition,
  Timer,
  VisualStateDefinition
} from '@noodl/types';

import { iconSourceProblem } from './components/visual/Icon/iconSourceProblem';
import DOMBoundingBoxObserver from './dom-boundingbox-oberver';
import Layout, { type ParentLayout } from './layout';
import mergeDeep from './mergedeep';
import NodeSharedPortDefinitions from './node-shared-port-definitions';
import transitionParameter from './node-transitions';
import type Styles from './styles';

// ===========================================================================
// The React node-definition API
//
// `createNodeFromReactComponent` is the bridge between two authoring models.
// A node author writes a *React* node definition ({@link ReactNodeDefinition})
// — a React component plus port declarations phrased in terms of React props
// and CSS — and this module compiles it into the *runtime* node definition
// (`NodeDefinitionOptions` from `@noodl/types`) that `defineNode` understands.
//
// The two models differ in one important way, and it is the reason this file
// exists: a runtime input port is a `set(value)` callback, whereas a React node
// declares *where the value goes* (`inputProps` → a React prop, `inputCss` → a
// style property) and lets this module synthesise the setter. Authors
// therefore never write `set` on `inputProps`/`inputCss`; it is generated onto
// the very object they wrote, in place. The types below mark those fields as
// generated rather than pretending they are absent.
//
// Types are declared here rather than in `@noodl/types` on purpose: this is a
// React-specific authoring surface, and `@noodl/types` is shared with the
// cloud runtime, which has neither React nor a DOM.
// ===========================================================================

/**
 * A style object as this module manipulates it.
 *
 * Deliberately *not* `React.CSSProperties`. Styles here are read and written by
 * computed name (`styleObject[p] = …`), and their values have already had units
 * appended (`'12px'`, `'translateX(-50%) …'`), so every useful property would
 * end up widened to `string` anyway. Claiming `CSSProperties` would assert a
 * precision this code does not have — and would reject the plain `{ display:
 * 'flex', flexDirection: 'column' }` literals that nodes actually write, whose
 * values widen to `string`.
 */
export type StyleObject = Record<string, any>;

/** The props a React node's component receives. */
export interface ReactNodeProps {
  /** Per-`styleTag` style objects, for nodes that style more than one element. */
  styles: Record<string, StyleObject>;
  [prop: string]: any;
}

/** The subset of `NodeContext` a visual node reaches for. */
export interface ReactNodeContext extends NodeContextLike {
  frameNumber: number;
  scheduleUpdate(): void;
  getDefaultValueForInput(nodeType: string, inputName: string): unknown;
  variants: {
    getVariant(typename: string, variantName: string): NodeVariant | undefined;
    [extra: string]: any;
  };
  /**
   * Project-wide colours, text styles and variants.
   *
   * `NodeContextLike` publishes only the two lookups every runtime has and marks it
   * optional, because the cloud runtime has no styles at all; in the browser viewer it is
   * always the full `Styles` service.
   */
  styles: Styles;
  /**
   * Records which node currently holds keyboard focus. Installed by `viewer.jsx`,
   * so it exists only in the browser viewer.
   */
  setNodeFocused(node: ReactNodeInstance, focused: boolean): void;
  /** True when the runtime is rendering inside the editor's canvas preview. */
  runningInCanvas?: boolean;
}

/**
 * The component instance that owns a node scope, as this file walks it.
 *
 * `@noodl/types` publishes the general shape as `ComponentInstanceLike`; this narrows the
 * two members `getVisualParentNode` walks — a React node's visual parent is a React node,
 * and the scope it came from is a React scope.
 */
export interface ComponentOwnerLike extends ComponentInstanceLike {
  parent?: ReactNodeInstance;
  parentNodeScope?: ReactNodeScope;
}

/** The subset of `NodeScope` a visual node reaches for. */
export interface ReactNodeScope extends NodeScopeLike {
  componentOwner: ComponentOwnerLike;
  context: ReactNodeContext;
}

/**
 * The graph-model entry behind a node, which is where variants and per-visual-
 * state parameters live.
 *
 * Absent on nodes the runtime synthesises rather than reads from the project —
 * a Router's page instances, for example. {@link ReactNodeInstance.setVisualStates}
 * checks for exactly that and gives up early.
 *
 * Slice 3 declared this shape locally because nothing published it. `@noodl/types` now
 * does, as `GraphNodeModel`, and the two were describing the same object — so this is an
 * alias rather than a second opinion. Kept as a name because this file and the nodes that
 * import from it read better with it.
 */
export type ReactNodeModel = GraphNodeModel;

/**
 * A transition in flight on one parameter.
 *
 * This is exactly a scheduler {@link Timer} — `node-transitions` populates
 * `_transitions` with `timerScheduler.createTimer(...)` results and calls `start()`
 * on them. It was previously declared here as its own `{ stop(): void }`, which was
 * a second, narrower description of the same object and made `start()` invisible.
 */
export type RunningTransition = Timer;

/**
 * A queued {@link ReactNodeInstance.withInnerComponent} action, with the drop callback the
 * outcome contract needs attached to it.
 *
 * The callback rides on the function rather than being queued beside it so that the existing
 * `_pendingInnerActions` array stays one list of callables — `_flushPendingInnerActions` calls
 * every entry unchanged, and a caller that passes no `onDropped` is byte-for-byte what it was.
 */
export type PendingInnerAction = ((inner: any) => void) & { _onDropped?: () => void };

/**
 * `this` inside every callback on a React node definition, and the type of
 * `props.noodlNode` in the React component the node renders.
 *
 * It is the runtime `NodeInstance` plus everything `createNodeFromReactComponent`
 * mixes in below — child management, styling, variants and visual states.
 *
 * The index signature is deliberate and load-bearing: `def.methods` puts
 * author-defined members straight onto the prototype, and `initialize` is free
 * to hang per-instance scratch state off `this`. Typing that away would make
 * roughly every node in the standard library fail to compile. It costs typo
 * detection on *undeclared* members only — the members declared here are still
 * checked.
 */
export interface ReactNodeInstance extends NodeInstance {
  context: ReactNodeContext;
  nodeScope: ReactNodeScope;
  model?: ReactNodeModel;

  // --- react plumbing -----------------------------------------------------
  /** Identity of this node's React element; changing it forces a full remount. */
  reactKey: string;
  /** The component `def.getReactComponent()` returned. */
  reactComponent: React.ComponentType<any> | string;
  /** The `NoodlReactComponent` wrapper instance. */
  reactComponentRef: NoodlReactComponent | null;
  /**
   * Whatever the *inner* component put in its `ref` — often, but not always, a
   * DOM node.
   *
   * `any` rather than `unknown`: node definitions call imperative methods on it
   * (`scrollToIndex`, `snapToPositionX`, `play`), and which methods exist is
   * decided by the component each node returns from `getReactComponent`. There
   * is no one type here, only a per-node contract the author holds.
   */
  innerReactComponentRef: any;
  /**
   * The node's root DOM element. Set either by the wrapper's ref callback (when
   * the inner component is a host element) or by the component itself calling
   * {@link setDOMElement} from a ref on its root — the contract every built-in
   * visual/control component follows now that findDOMNode is gone in React 19.
   */
  _domElement?: Element;
  /** The frame this node last rendered on; used to render at most once per frame. */
  renderedAtFrame: number;
  forceUpdateScheduled: boolean;

  props: ReactNodeProps;
  /** The node's own inline styles, applied to the root element. */
  style: StyleObject;
  /** Values pushed from React props, read back by the generated output getters. */
  outputPropValues: Record<string, unknown>;
  /** Styles parsed out of the `styleCss` input, so they can be removed on change. */
  customCssStyles?: Record<string, string>;
  /** True when the node passes itself to its React component as a prop. */
  noodlNodeAsProp: boolean;

  // --- children -----------------------------------------------------------
  children: ReactNodeInstance[];
  parent?: ReactNodeInstance;
  childIndex: number;
  childrenCount: number;
  /** Memoised result of {@link renderChildren}; cleared whenever children change. */
  cachedChildren: React.ReactNode;
  updateChildIndiciesScheduled: boolean;

  addChild(child: ReactNodeInstance, index?: number): void;
  removeChild(child: ReactNodeInstance): void;
  contains(node: ReactNodeInstance): boolean;
  getChildren(): ReactNodeInstance[];
  isChild(child: ReactNodeInstance): boolean;
  getChildRoot(): ReactNodeInstance;
  setChildIndex(index: number): void;
  updateChildIndices(): void;
  updateChildrenCount(): void;
  scheduleUpdateChildCountAndIndicies(): void;

  // --- mounting and rendering ---------------------------------------------
  /** Mirrors the `mounted` input. A false value keeps the node out of the tree. */
  wantsToBeMounted: boolean;
  didCallTriggerDidMount?: boolean;
  /**
   * Whether the node participates in frame-based layout — see
   * {@link ReactNodeDefinition.frame}, which nothing currently sets.
   */
  useFrame: boolean;

  render(): React.ReactElement | undefined;
  renderChildren(): React.ReactNode;
  forceUpdate(): void;
  /**
   * Change the layout this node lays its children out in. Always use this
   * rather than assigning `props.layout` — see the method for why.
   */
  setLayout(layout: ParentLayout): void;
  /** Re-key the node so React rebuilds its subtree from scratch. */
  _resetReactVirtualDOM(): void;
  /** SSR only: fire `didMount` without a browser lifecycle to hang it off. */
  triggerDidMount(): void;

  // --- geometry -----------------------------------------------------------
  boundingBoxObserver: {
    addObserver(): void;
    removeObserver(): void;
    setTarget(element: HTMLElement | null): void;
    [extra: string]: any;
  };
  clientBoundingRect: Partial<DOMRect>;

  // --- styling ------------------------------------------------------------
  setStyle(newStyles: Record<string, any>, styleTag?: string): void;
  removeStyle(styles: string[], styleTag?: string): void;
  getStyle(style: string): unknown;
  updateAdvancedStyle(params: { content?: string }): void;
  getRef(): NoodlReactComponent | null;
  getDOMElement(): HTMLElement | null;
  /**
   * Root-element reporting contract: built-in components attach
   * `ref={(el) => props.noodlNode?.setDOMElement(el)}` on their root host
   * element. Keeps `_domElement` and the bounding-box observer in sync,
   * including the null on unmount.
   */
  setDOMElement(element: Element | null): void;
  /**
   * NDA-012 (Visual) A3 — run an action on the inner React component, deferring it until
   * there is one rather than dropping it. Use in place of
   * `this.innerReactComponentRef && this.innerReactComponentRef.doThing()`.
   *
   * @param onDropped ERG-001 §4 — called if the queue's 16-deep cap discards this action before
   * the node ever mounts. That is the one path on which an action here can end in silence, so a
   * caller holding an outcome token reports `Failure` from it rather than letting the invocation
   * vanish. Callers with no outcome to report omit it.
   */
  withInnerComponent(action: (inner: any) => void, onDropped?: () => void): void;
  /**
   * {@link withInnerComponent}, reporting the outcome contract's ports around it — ERG-001 §4.
   *
   * This is the shape every DV-viii Visual action has: defer to the inner component, then say
   * what happened. Seven of the eight Visual nodes with action inputs could not tell a graph
   * their action had finished, which is the largest single block the contract exists to close.
   *
   * `action` returns a **reason string** when the component declined to do anything (the shape
   * `Group`'s two scroll actions already use) and `undefined` when it acted; those become
   * `Failure` and `Done`. A discarded queue entry is `Failure` too, via `onDropped`.
   */
  outcomeOnInnerComponent(action: (inner: any) => string | void, options?: { code?: string }): void;
  /** Queued {@link withInnerComponent} actions; drained by the wrapper's ref callback. */
  _pendingInnerActions?: PendingInnerAction[];
  _flushPendingInnerActions(): void;
  /** The node this one renders inside, hopping out of the component if it is a root. */
  getVisualParentNode(): ReactNodeInstance | undefined;

  // --- variants and visual states -----------------------------------------
  variant?: NodeVariant;
  currentVisualStates?: string[];
  _transitions?: Record<string, RunningTransition>;

  setVariant(variant: NodeVariant): void;
  getParameter(name: string): unknown;
  getParametersForStates(states: string[]): Record<string, any>;
  setVisualStates(newStates: string[]): void;
  _getVisualStates(): string[];
  _getNewState(prevStates: string[] | undefined, newStates: string[]): string;
  _getDefaultTransition(state: string): StateTransition | undefined;
  _getStateTransition(state: string): Record<string, StateTransition>;
  _stopStateTransitions(): void;

  /**
   * True when the input's value arrives over a connection, in which case
   * variants and visual states must not overwrite it. Runtime internal.
   */
  _hasInputBeenSetFromAConnection(inputName: string): boolean;

  [extra: string]: any;
}

/** A callback an author writes on a React node definition. */
type ReactNodeCallback<TArgs extends any[] = any[], TResult = void> = (
  this: ReactNodeInstance,
  ...args: TArgs
) => TResult;

/**
 * An ordinary runtime input, declared on a React node.
 *
 * Structurally this is {@link InputPortDefinition} — the definition is passed
 * straight through to `defineNode` — but the callbacks run with the *React*
 * instance as `this`, and every one of them relies on it: `setStyle`,
 * `forceUpdate`, `innerReactComponentRef`, `props`. Declaring the runtime
 * `this` here would reject the node bodies this module exists to compile.
 */
export interface ReactInputDefinition extends Omit<InputPortDefinition, 'set' | 'valueChangedToTrue' | 'setUnitType'> {
  set?: ReactNodeCallback<[any]>;
  valueChangedToTrue?: ReactNodeCallback;
  setUnitType?: ReactNodeCallback<[string]>;
}

/** An ordinary runtime output, declared on a React node. See {@link ReactInputDefinition}. */
export interface ReactOutputDefinition
  extends Omit<OutputPortDefinition, 'get' | 'getter' | 'onFirstConnectionAdded' | 'onLastConnectionRemoved'> {
  get?: ReactNodeCallback<[], unknown>;
  /** @deprecated Historical spelling of {@link get}; still honoured. */
  getter?: ReactNodeCallback<[], unknown>;
  onFirstConnectionAdded?: ReactNodeCallback;
  onLastConnectionRemoved?: ReactNodeCallback;
}

/**
 * An input that writes a React prop.
 *
 * The value is stored at `this.props[name]`, or at `this.props[propPath][name]`
 * when {@link propPath} is set. A `type` of `'node'` is special: the connected
 * node is rendered and the resulting element passed as the prop.
 */
export interface ReactInputPropDefinition extends Omit<InputPortDefinition, 'set'> {
  /** Nests the prop one level down, e.g. `propPath: 'inputProps'`. */
  propPath?: string;
  /** Called after the prop is written. */
  onChange?: ReactNodeCallback<[any]>;
  /** Generated by this module. Authors do not write it. */
  set?: ReactNodeCallback<[any]>;
}

/**
 * An input that writes a CSS property.
 *
 * The value goes to `this.style`, or to `this.props.styles[styleTag]` when
 * {@link styleTag} is set — which is how a node styles more than one element.
 */
export interface ReactInputCssDefinition extends Omit<InputPortDefinition, 'set'> {
  /** The style property to write; defaults to the port's own name. */
  targetStyleProperty?: string;
  /** Marks the element (via a `noodl-style-tag` attribute) this style applies to. */
  styleTag?: string;
  /** Set `false` to declare a default for the editor without applying it at runtime. */
  applyDefault?: boolean;
  /** Called after the style is written. */
  onChange?: ReactNodeCallback<[any]>;
  /** Generated by this module. Authors do not write it. */
  set?: ReactNodeCallback<[any]>;
}

/**
 * An output driven by a React prop — a callback the component invokes.
 *
 * Either the port *is* the prop (the component calls `props.onClick()`), or
 * {@link props} declares a group of prop callbacks that all feed this one port.
 */
export interface ReactOutputPropDefinition extends Omit<OutputPortDefinition, 'get'> {
  /** Nests the prop one level down, matching {@link ReactInputPropDefinition.propPath}. */
  propPath?: string;
  /** Several prop callbacks handled together, keyed by prop name. */
  props?: Record<string, ReactNodeCallback>;
  /** Derives the port's value from the prop callback's arguments; defaults to the first. */
  getValue?: ReactNodeCallback<any[], unknown>;
  /** Called after the value is stored and the port flagged dirty. */
  onChange?: ReactNodeCallback<[any]>;
  /** Generated by this module for non-signal outputs. Authors do not write it. */
  get?: (this: ReactNodeInstance) => unknown;
}

/**
 * Frame-based layout opt-in.
 *
 * Nothing in the repository sets this, so `useFrame` is always false and the
 * `Layout.size`/`Layout.align` pass in {@link NoodlReactComponent.render} never
 * runs. Layout reaches nodes through `inputCss` and
 * `node-shared-port-definitions` instead.
 *
 * DEBT-006 decision (2026-07-25): **retained**. Deleting it would only save a
 * few dead branches in-repo, while third-party modules that define React nodes
 * could legitimately pass `frame` (the port-registration half works and is part
 * of the historical module API surface). Revisit if DEBT-008's module-compat
 * work establishes that no module can reach this path.
 */
export interface ReactNodeFrame {
  /** `true`, or an options object forwarded to `addDimensions`. */
  dimensions?: boolean | Record<string, unknown>;
  position?: boolean;
  margins?: boolean;
  padding?: boolean;
  align?: boolean;
}

/**
 * What an author passes to {@link createNodeFromReactComponent}.
 *
 * Fields not listed here are **not** forwarded to the runtime definition. One
 * is worth calling out because nodes in this repository set it and it does
 * nothing:
 *
 * - `category` — every React node is registered as `'Visual'`, regardless.
 *
 * (`deprecated` used to be dropped the same way; DEBT-006 forwards it, so
 * Form/Label now report themselves deprecated in the catalog.)
 */
export interface ReactNodeDefinition {
  /** Canonical type string, as it appears in project files. */
  name: string;
  /** Returns the React component to render. Called once per instance. */
  getReactComponent: ReactNodeCallback<[], React.ComponentType<any> | string>;

  displayName?: string;
  displayNodeName?: string;
  docs?: string;
  /**
   * URL of a documentation page for this node.
   *
   * 🔴 **Separate from {@link docs} on purpose (D10).** `docs` is one field over
   * two vocabularies — a URL on the 158 shipped nodes that carry one, the kit
   * author's own prose on a kit node — so a kit had no way to offer a link
   * without its sentence being rendered as an `href` that opens nothing.
   * Sniffing for `http` was considered and rejected: it encodes a guess about
   * the author's intent in a regex, and it mislabels a kit whose prose merely
   * opens with a URL. Two fields, two meanings, no guessing.
   */
  docsUrl?: string;
  allowChildren?: boolean;
  allowAsExportRoot?: boolean;
  singleton?: boolean;
  useVariants?: boolean;
  visualStates?: VisualStateDefinition[];
  usePortAsLabel?: string;
  portLabelTruncationMode?: PortLabelTruncationMode;
  connectionPanel?: unknown;
  nodeDoubleClickAction?: unknown;
  dynamicports?: DynamicPortEntry[];

  /** Passes the node itself to the React component as `props.noodlNode`. */
  noodlNodeAsProp?: boolean;
  /** Set `false` to omit the standard `mounted` input. */
  mountedInput?: boolean;
  /** See {@link ReactNodeFrame} — currently unused. */
  frame?: ReactNodeFrame;

  /** Styles applied to every instance before any input is set. */
  defaultCss?: StyleObject;

  /** Ports written as ordinary runtime inputs, with their own `set`. */
  inputs?: Record<string, ReactInputDefinition>;
  /** Ports that write React props. */
  inputProps?: Record<string, ReactInputPropDefinition>;
  /** Ports that write CSS properties. */
  inputCss?: Record<string, ReactInputCssDefinition>;
  /** Ports written as ordinary runtime outputs, with their own `get`. */
  outputs?: Record<string, ReactOutputDefinition>;
  /** Ports driven by React prop callbacks. */
  outputProps?: Record<string, ReactOutputPropDefinition>;

  initialize?: ReactNodeCallback;
  methods?: Record<string, ReactNodeCallback<any[], any>>;
  getInspectInfo?: ReactNodeCallback<[], InspectInfo>;
  nodeScopeDidInitialize?: ReactNodeCallback;
  /** Runs once at registration, not per instance. */
  setup?: (context: ReactNodeContext, graphModel: GraphModelLike) => void;

  /** @deprecated Ignored — React nodes are always registered as `'Visual'`. */
  category?: string;
  /** Marks the node deprecated in the runtime definition and the catalog. */
  deprecated?: boolean;
  /** Server-side-rendering compatibility (RUN-002); forwarded to the runtime definition and the catalog. */
  ssr?: NodeSSRCompat;

  [extra: string]: unknown;
}

/**
 * What `createNodeFromReactComponent` returns: the shape
 * `NoodlRuntime.registerNode` expects for a definition that also needs
 * registration-time setup.
 */
export interface ReactNodeModule {
  node: NodeDefinitionOptions;
  setup?: (context: ReactNodeContext, graphModel: GraphModelLike) => void;
}

function addOutputPropHandler(
  node: ReactNodeInstance,
  propCallbacks: Record<string, ReactNodeCallback>,
  propPath?: string
) {
  const props = propPath ? node.props[propPath] : node.props;

  for (const propName in propCallbacks) {
    if (props[propName]) {
      const prevCb = props[propName];
      props[propName] = () => {
        prevCb();
        propCallbacks[propName].call(node);
      };
    } else {
      props[propName] = propCallbacks[propName].bind(node);
    }
  }
  node.forceUpdate();
}

function addPrimitiveOutputPropHandler(node: ReactNodeInstance, name: string, output: ReactOutputPropDefinition) {
  let prop;

  if (output.type === 'signal') {
    prop = () => {
      node.sendSignalOnOutput(name);
    };
  } else {
    prop = (...args: any[]) => {
      node.outputPropValues[name] = output.getValue ? output.getValue.call(node, ...args) : args[0];
      node.flagOutputDirty(name);
      output.onChange && output.onChange.call(node, node.outputPropValues[name]);
    };
  }

  addOutputPropHandler(node, { [name]: prop }, output.propPath);
}

/**
 * AIB-001 — is this value a design-token reference rather than a magnitude?
 *
 * A units-typed input normally carries `{ value, unit }` and is rendered as
 * `value + unit`. A `var(--token)` string is already a complete CSS value and
 * must reach the style untouched: fitting it with a unit produces
 * `var(--space-4)px`, and reading `.value` off it produces `undefined`. Both
 * failures are silent, which is why they survived — and the authoring prompt
 * asks the model for this exact form on every spacing, radius and font-size
 * port it sets.
 *
 * Provably inert for existing projects: no units-typed parameter in any of the
 * 35 projects in this repository is a `var(` string.
 */
function isTokenReference(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('var(');
}

/** Diagnostic key namespace for an icon port that was handed something it cannot draw. */
const ICON_SOURCE_DIAGNOSTIC = 'visual/icon-source-not-an-icon';

/** A port type is a bare string or `{ name }`; this is the name, or `null`. */
function portTypeNameOf(type: unknown): string | null {
  if (!type) return null;
  const name = typeof type === 'string' ? type : (type as { name?: string }).name;
  return typeof name === 'string' ? name.toLowerCase() : null;
}

function defineRegularInputProp(input: ReactInputPropDefinition, name: string) {
  if (!input.type) throw new Error(`input ${name} is missing a type`);

  // FB-019 AC3. An icon port is the one structured type with no cast row of its own, so the
  // only value that can arrive over a wire comes from a `*` output and has been checked by
  // nobody. Reported at the port rather than in `IconGlyph`: here the port has a name and the
  // node has an id, the check runs once per set instead of once per render, and `setDiagnostic`
  // is a setter — the statement that raises the warning is the one that clears it.
  if (portTypeNameOf(input.type) === 'icon') {
    input.set = function (value) {
      const props = input.propPath ? this.props[input.propPath] : this.props;
      const problem = iconSourceProblem(value, input.displayName || name);
      this.setDiagnostic(ICON_SOURCE_DIAGNOSTIC + '/' + name, problem);

      // Dropped rather than passed on, so a value the renderer cannot draw behaves like a port
      // that was never set — an empty span still takes its `iconSize` in layout, which is the
      // half of this defect that looks like a rendering bug rather than a wiring one.
      if (value !== undefined && !problem) {
        props[name] = value;
      } else {
        delete props[name];
      }
      if (input.onChange) {
        input.onChange.call(this, value);
      }
      this.forceUpdate();
    };
  } else if ((input.type as PortType).units) {
    input.set = function (value) {
      const props = input.propPath ? this.props[input.propPath] : this.props;
      // AIB-001: see the matching guard in the inputCss loop below. Here the
      // failure was quieter still — a token reference has no `.value`, so the
      // prop was DELETED and the property fell back to its default.
      if (isTokenReference(value)) {
        props[name] = value;
      } else if (value && value.value !== undefined) {
        props[name] = value.value + value.unit;
      } else {
        delete props[name];
      }
      if (input.onChange) {
        input.onChange.call(this, value);
      }
      this.forceUpdate();
    };
  } else {
    input.set = function (value) {
      const props = input.propPath ? this.props[input.propPath] : this.props;
      if (value !== undefined) {
        props[name] = value;
      } else {
        delete props[name];
      }
      if (input.onChange) {
        input.onChange.call(this, value);
      }
      this.forceUpdate();
    };
  }
}

function flattenArray(target: React.ReactNode[], array: React.ReactNode[]) {
  for (const e of array) {
    if (Array.isArray(e)) {
      flattenArray(target, e);
    } else if (e !== undefined) {
      target.push(e);
    }
  }
}

/** Props the wrapper itself needs; anything else is forwarded to the inner component. */
export interface NoodlReactComponentProps {
  noodlNode: ReactNodeInstance;
  /** Styling contributed by the *React* parent, which wins over the node's own. */
  style?: React.CSSProperties;
  [prop: string]: any;
}

/**
 * Exported for DEF-027's spec, which renders it inside a real `Drag` to grade the className
 * merge at the seam. Nothing outside this module constructs it — the node's own `render` is
 * still the only production caller.
 */
export class NoodlReactComponent extends React.Component<NoodlReactComponentProps> {
  componentDidMount() {
    // During SSR (server) and SSR hydration (client pre-settle), triggerDidMount()
    // already sent this node's didMount before React committed; sending it again on
    // commit would double-fire user graphs. The flag is cleared on unmount below so
    // a genuine remount fires didMount normally.
    if (this.props.noodlNode.didCallTriggerDidMount) return;
    this.props.noodlNode.sendSignalOnOutput('didMount');
  }

  componentWillUnmount() {
    this.props.noodlNode.didCallTriggerDidMount = false;
    this.props.noodlNode.sendSignalOnOutput('willUnmount');
    //Remove
    const noodlNode = this.props.noodlNode;
    if (noodlNode.currentVisualStates) {
      const statesToRemove = ['hover', 'pressed', 'focused'];
      const vs = noodlNode.currentVisualStates.filter((s) => !statesToRemove.includes(s));
      noodlNode.setVisualStates(vs);
    }
  }

  render() {
    //So the props are a bit tricky here...
    //this.props consist of:
    // - the props passed by the ReactComponentNode.render() function, just {noodlNode}
    // - any additional third party props coming from the parent react component.
    //E.g. the drag node adds event handlers, style, and className to this.props.

    const { noodlNode, style, ...otherProps } = this.props;

    let finalStyle = noodlNode.style;

    //check if there's additional styling from the react parent
    //if so, we need to combine it with the style from the Noodl node
    //let the extra style take priority over the noodl style, if they share some attributes
    //this is wrapped in an if for performance reasons, "..." is quite slow
    if (style) {
      finalStyle = {
        ...noodlNode.style, //styling from the noodl node
        ...style //styling from the react component parent
      };
    }

    const props: Record<string, any> = {
      ref: (ref: unknown) => {
        noodlNode.innerReactComponentRef = ref;
        // NDA-012 (Visual) A3. Actions that arrived before the component existed run now —
        // this is the moment the null-ref guards were losing them at.
        if (ref) noodlNode._flushPendingInnerActions();
        // When the inner component is itself a host element this ref IS the
        // root DOM node. Class/function components report their root through
        // setDOMElement instead (their own root ref commits before this one,
        // so this must not clobber what they already set).
        if (ref instanceof Element || (ref && typeof ref === 'object' && (ref as Node).nodeType === 1)) {
          noodlNode.setDOMElement(ref as Element);
        }
      },
      style: finalStyle,
      //the noodl props coming from the node
      //some components actually have a "style" used for something other than css,
      //so make sure this comes after the "style" prop above, so it can overwrite it
      //(e.g. Jesper's Icon Material UI)
      ...noodlNode.props,

      //otherProps can be empty, but some react components add additional props to their children
      ...otherProps
    };

    /**
     * DEF-027. A React parent that injects a `className` **adds** to the node's own; it does not
     * replace it. `style` above is deliberately the other way round (the parent wins, see
     * `NoodlReactComponentProps`) because two parents disagreeing about a css property must
     * resolve to one value. Class names do not disagree — they accumulate — so the spread's
     * last-one-wins was silently discarding the author's.
     *
     * The node that made this visible is `Drag`: `react-draggable` clones its child with
     * `clsx(children.props.className || '', 'react-draggable', …)`, and the child it clones is
     * *this* wrapper element, whose props are only `{key, noodlNode, ref}` (see the node's
     * `render`). So the library's own merge has nothing to see, it hands down a bare
     * `react-draggable`, and `...otherProps` then overwrote the `cssClassName` the author set.
     * The element reaching the DOM carried `react-draggable` and nothing else: accepted at the
     * door, stored in the graph, surviving the deploy, and simply absent at runtime.
     *
     * Fixed here rather than in `Drag.tsx` because the discarding is the spread's, not the
     * node's — a repair naming `Drag` would leave any future wrapper with the same hole. `Drag`
     * is the only child-cloning node in the viewer today (it holds the sole `cloneElement`), so
     * the sweep D28 asked for has an answer, and it is one.
     */
    if (otherProps.className && noodlNode.props.className) {
      props.className = `${noodlNode.props.className} ${otherProps.className}`;
    }

    if (noodlNode.noodlNodeAsProp) {
      props.noodlNode = noodlNode;

      //nodes that want the noodlNode also get the parent layout
      //since it's used by all built in nodes for layout purposes
      const parent = noodlNode.getVisualParentNode();
      if (parent && parent.props.layout) {
        props.parentLayout = parent.props.layout;
      }
    }

    //optimization. This is used by forceUpdate() to only render this node once per frame.
    noodlNode.renderedAtFrame = noodlNode.context.frameNumber;

    if (noodlNode.useFrame) {
      if (props.textStyle !== undefined) {
        // Apply text style
        props.style = finalStyle = Object.assign({}, props.textStyle, finalStyle);
      }
      Layout.size(finalStyle, props);
      Layout.align(finalStyle, props);

      /*  if(finalStyle.opacity === 0) {
                finalStyle.pointerEvents = 'none';
            }*/
    }

    return React.createElement(noodlNode.reactComponent, props, noodlNode.renderChildren());
  }
}

function setStylesOnDOMNode(rootElement: HTMLElement, styles: Record<string, any>, styleTag?: string) {
  let element = rootElement;

  if (styleTag) {
    //check if the root element has the style tag, if not, find the child that does
    if (element.getAttribute('noodl-style-tag') !== styleTag) {
      element = rootElement.querySelector<HTMLElement>(`[noodl-style-tag=${styleTag}]`);
    }
  }

  if (!element) return;

  for (const p in styles) {
    element.style[p] = styles[p];
  }
}

// --- the compiled side -----------------------------------------------------
// Same ports as `@noodl/types` describes, but with `this` bound to the React
// node instance rather than the bare runtime one. Declaring the assembled
// object with these types is what gives every method below a checked `this`
// without a single annotation inside the literal.

interface CompiledInputDefinition extends Omit<InputPortDefinition, 'set'> {
  set?: ReactNodeCallback<[any]>;
}

interface CompiledOutputDefinition
  extends Omit<OutputPortDefinition, 'get' | 'onFirstConnectionAdded' | 'onLastConnectionRemoved'> {
  get?: (this: ReactNodeInstance) => unknown;
  onFirstConnectionAdded?: ReactNodeCallback;
  onLastConnectionRemoved?: ReactNodeCallback;
}

interface CompiledReactNodeDefinition extends NodeDefinitionOptions {
  initialize: ReactNodeCallback;
  inputs: Record<string, CompiledInputDefinition>;
  outputs: Record<string, CompiledOutputDefinition>;
  methods: Record<string, ReactNodeCallback<any[], any>>;
}

let reactKeyCounter = 0;

function createNodeFromReactComponent(def: ReactNodeDefinition): ReactNodeModule {
  // visual frame props
  const { frame } = def;
  if (frame !== undefined) {
    if (frame.dimensions) {
      NodeSharedPortDefinitions.addDimensions(def, typeof frame.dimensions === 'object' ? frame.dimensions : undefined);
    }

    if (frame.position) NodeSharedPortDefinitions.addTransformInputs(def);

    if (frame.margins) NodeSharedPortDefinitions.addMarginInputs(def);

    if (frame.padding) NodeSharedPortDefinitions.addPaddingInputs(def);

    if (frame.align) NodeSharedPortDefinitions.addAlignInputs(def);

    //  NodeSharedPortDefinitions.addSharedVisualInputs(ReactComponentNode);

    // NodeSharedPortDefinitions.addPointerEventOutputs(ReactComponentNode);
  }

  const {
    initialize,
    inputs,
    inputProps,
    inputCss,
    outputs,
    outputProps,
    dynamicports,
    defaultCss = {},
    methods
  } = def;

  //assign default values to style
  const startStyle: StyleObject = Object.assign({}, defaultCss);
  const startStyles: Record<string, StyleObject> = {};

  for (const name in inputCss) {
    const input = inputCss[name];

    const hasDefault = input.hasOwnProperty('default') && input.applyDefault !== false;
    if (input.styleTag && !startStyles.hasOwnProperty(input.styleTag)) {
      startStyles[input.styleTag] = {};
    }

    if (hasDefault) {
      const type = input.type as PortType;
      // CN-006: the same guard as `input.set` below, on the half AIB-001 did not
      // reach. AIB-001 fixed the path a *set parameter* takes; a port's declared
      // `default` never goes through it, so a units-typed port defaulting to a
      // token was fitted with the unit here and emitted as `var(--space-3)px`.
      // That is exactly what ✅ D8 asks a scaffold to emit, so the ruling landed
      // on the one path still broken — silently, because invalid CSS is dropped
      // without an error and the parameter still reads back as the right token.
      const value = type.units && !isTokenReference(input.default) ? input.default + type.defaultUnit : input.default;
      if (input.styleTag) {
        startStyles[input.styleTag][name] = value;
      } else {
        startStyle[name] = value;
      }
    }
  }

  function boundingBoxObserverCallback(this: ReactNodeInstance, attribute: string, rect: DOMRect) {
    this.clientBoundingRect = rect;
    if (attribute === 'x') {
      this.flagOutputDirty('screenPositionX');
    } else if (attribute === 'y') {
      this.flagOutputDirty('screenPositionY');
    } else if (attribute === 'width') {
      this.flagOutputDirty('boundingWidth');
    } else if (attribute === 'height') {
      this.flagOutputDirty('boundingHeight');
    }
  }

  const useVariants = def.useVariants !== undefined ? def.useVariants : true;

  const ReactComponentNode: CompiledReactNodeDefinition = {
    name: def.name,
    docs: def.docs,
    docsUrl: def.docsUrl,
    displayNodeName: def.displayNodeName || def.displayName,
    category: 'Visual',
    deprecated: def.deprecated,
    ssr: def.ssr,
    allowChildren: def.allowChildren === undefined ? true : def.allowChildren, //default to true
    visualStates: def.visualStates,
    allowAsExportRoot: def.allowAsExportRoot,
    singleton: def.singleton,
    useVariants,
    usePortAsLabel: def.usePortAsLabel,
    portLabelTruncationMode: def.portLabelTruncationMode,
    connectionPanel: def.connectionPanel,
    nodeDoubleClickAction: def.nodeDoubleClickAction,
    initialize() {
      this.reactKey = 'key' + reactKeyCounter;
      reactKeyCounter++;

      this.children = [];
      if (hasChildCountOutput) {
        this.childrenCount = 0;
      }

      this.props = { styles: {} };
      this.outputPropValues = {};
      this.style = Object.assign({}, startStyle);

      for (const styleTag in startStyles) {
        this.props.styles[styleTag] = Object.assign({}, startStyles[styleTag]);
      }
      this.childIndex = 0;
      this.clientBoundingRect = {};
      this.noodlNodeAsProp = def.noodlNodeAsProp ? true : false;

      const pollDelay = this.context && this.context.runningInCanvas ? 300 : 0;
      this.boundingBoxObserver = new DOMBoundingBoxObserver(boundingBoxObserverCallback.bind(this), pollDelay);

      this.wantsToBeMounted = true;

      this.useFrame = !!frame;

      //assign default values to props
      for (const name in inputProps) {
        const input = inputProps[name];
        if (input.propPath && !this.props.hasOwnProperty(input.propPath)) {
          this.props[input.propPath] = {};
        }

        const props = input.propPath ? this.props[input.propPath] : this.props;

        if (input.hasOwnProperty('default')) {
          // Only the object form of a port type carries units; the bare-name form
          // never does, so reading through it is safe and yields undefined.
          const type = input.type as PortType;
          // CN-006 — the `inputProps` twin of the `inputCss` guard above. Same
          // defect, different destination: this one reaches the component as a
          // prop rather than the style object, so a token default arrived as the
          // string `var(--text-sm)px` for the component to do nothing useful
          // with.
          if (type.defaultUnit && input.default !== undefined && !isTokenReference(input.default)) {
            props[name] = input.default + type.defaultUnit;
          } else {
            props[name] = input.default;
          }
        }
      }

      //set ut props that send data on noodl outputs
      for (const outputName in outputProps) {
        const output = outputProps[outputName];
        if (output.propPath && !this.props.hasOwnProperty(output.propPath)) {
          this.props[output.propPath] = {};
        }

        if (!output.props) {
          addPrimitiveOutputPropHandler(this, outputName, output);
        } else {
          addOutputPropHandler(this, output.props, output.propPath);
        }
      }

      this.reactComponentRef = null;
      this.reactComponent = def.getReactComponent.call(this);

      if (initialize) {
        initialize.call(this);
      }
    },
    getInspectInfo: def.getInspectInfo,
    nodeScopeDidInitialize: def.nodeScopeDidInitialize,
    dynamicports,
    inputs: {
      cssClassName: {
        index: 100010,
        displayName: 'CSS Class',
        group: 'Advanced HTML',
        type: 'string',
        default: '',
        description: 'Extra CSS class names to put on this element, for styling from a stylesheet you supply',
        set(value) {
          this.props.className = value;
          this.forceUpdate();
        }
      },
      styleCss: {
        index: 100011,
        displayName: 'CSS Style',
        group: 'Advanced HTML',
        type: {
          name: 'string',
          codeeditor: 'text',
          allowEditOnly: true
        },
        default: '/* background-color: red; */',
        description: 'Raw CSS declarations applied to this element, overriding the styling ports above',
        set(value) {
          this.updateAdvancedStyle({ content: value });
        }
      }
    },
    outputs: {
      /*
       * SIG-003 — `Advanced`, not the absence of a group.
       *
       * These three are the largest single source of `Other` in the library: 27
       * `childIndex`, 27 `this` and 12 `childrenCount` reached the connection
       * popup with no `group`, and `ConnectionBar` renders an ungrouped port
       * under `Other` — so a beginner opening any visual node found a heading
       * nobody chose. `Advanced` is the honest subject: they describe this
       * element's place in the tree and a reference to the node itself, not
       * anything the node is *for*, and it keeps `Values` meaning "the things
       * this node is about".
       */
      childIndex: {
        group: 'Advanced',
        displayName: 'Child Index',
        type: 'number',
        description: "This element's position among its parent's children, counting from 0",
        get() {
          return this.childIndex;
        }
      },
      this: {
        group: 'Advanced',
        displayName: 'This',
        type: 'reference',
        description: 'A reference to this node itself, for ports that take a node rather than a value',
        get() {
          return this;
        }
      },
      screenPositionX: {
        group: 'Bounding Box',
        displayName: 'Screen Position X',
        type: 'number',
        description: "Distance in pixels from the left edge of the window to this element's left edge",
        get() {
          return this.clientBoundingRect.x;
        },
        onFirstConnectionAdded() {
          this.boundingBoxObserver.addObserver();
        },
        onLastConnectionRemoved() {
          this.boundingBoxObserver.removeObserver();
        }
      },
      screenPositionY: {
        group: 'Bounding Box',
        displayName: 'Screen Position Y',
        type: 'number',
        description: "Distance in pixels from the top edge of the window to this element's top edge",
        get() {
          return this.clientBoundingRect.y;
        },
        onFirstConnectionAdded() {
          this.boundingBoxObserver.addObserver();
        },
        onLastConnectionRemoved() {
          this.boundingBoxObserver.removeObserver();
        }
      },
      boundingWidth: {
        group: 'Bounding Box',
        displayName: 'Width',
        type: 'number',
        description: 'Width this element actually ended up with after layout, in pixels',
        get() {
          return this.clientBoundingRect.width;
        },
        onFirstConnectionAdded() {
          this.boundingBoxObserver.addObserver();
        },
        onLastConnectionRemoved() {
          this.boundingBoxObserver.removeObserver();
        }
      },
      boundingHeight: {
        group: 'Bounding Box',
        displayName: 'Height',
        type: 'number',
        description: 'Height this element actually ended up with after layout, in pixels',
        get() {
          return this.clientBoundingRect.height;
        },
        onFirstConnectionAdded() {
          this.boundingBoxObserver.addObserver();
        },
        onLastConnectionRemoved() {
          this.boundingBoxObserver.removeObserver();
        }
      },
      didMount: {
        group: 'Mounted',
        displayName: 'Did Mount',
        type: 'signal',
        description: 'Fires once this element has been added to the page and can be measured'
      },
      willUnmount: {
        group: 'Mounted',
        displayName: 'Will Unmount',
        type: 'signal',
        description: 'Fires just before this element is removed from the page, while it still exists'
      }
    },
    methods: {
      updateAdvancedStyle(params) {
        //remove previous styles first
        if (this.customCssStyles) {
          this.removeStyle(Object.keys(this.customCssStyles));
          this.customCssStyles = undefined;
        }

        let style;
        let errorMessage = '';

        let rawCss = (params.content || '').replace('\n', '');

        // strip away comments
        let css = '';
        while (rawCss.length) {
          let nextComment = rawCss.indexOf('/*');
          if (nextComment === -1) {
            nextComment = rawCss.length;
          }
          css += rawCss.substring(0, nextComment);
          rawCss = rawCss.substring(nextComment);

          if (rawCss.length) {
            //were inside a comment
            let endComment = rawCss.indexOf('*/');
            if (endComment === -1) endComment = rawCss.length;
            rawCss = rawCss.substring(endComment + 2);
          }
        }
        function trim(s) {
          return s.replace(/^\s+|\s+$/gm, '');
        }

        const styles = css
          .split(';')
          .map(trim)
          .filter((s) => s.length);

        style = {};
        for (const s of styles) {
          const parts = s.split(':').map(trim);

          if (s.indexOf('\n') !== -1) {
            errorMessage += 'Missing semicolon: ' + s.split('\n')[0];
          } else if (parts.length !== 2) {
            errorMessage += 'Syntax error: ' + s;
          } else {
            const nameParts = parts[0].split('-');
            for (let i = 1; i < nameParts.length; i++) {
              nameParts[i] = nameParts[i][0].toUpperCase() + nameParts[i].substring(1);
            }
            style[nameParts.join('')] = parts[1];
          }
        }

        if (errorMessage) {
          this.context.editorConnection.sendWarning(this.nodeScope.componentOwner.name, this.id, 'css-parse-waring', {
            message: 'Error in CSS Style<br>' + errorMessage
          });
        } else {
          this.context.editorConnection.clearWarning(this.nodeScope.componentOwner.name, this.id, 'css-parse-waring');
          style && this.setStyle(style);
          this.customCssStyles = style;
        }
      },
      setChildIndex(index) {
        this.childIndex = index;
        this.flagOutputDirty('childIndex');
      },
      updateChildIndices() {
        let indexOffset = 0;
        for (let i = 0; i < this.children.length; i++) {
          const child = this.children[i];
          if (child.name === 'For Each' || child.name === 'Component Children') {
            indexOffset--;
          }
          child.setChildIndex && child.setChildIndex(i + indexOffset);
        }
      },
      updateChildrenCount() {
        let count = 0;
        this.children.forEach((child) => {
          if (child?.model?.type === 'For Each') {
            count += child.model.children.length;
          } else {
            count++;
          }
        });
        this.childrenCount = count;
        this.flagOutputDirty('childrenCount');
      },
      addChild(child, index) {
        if (index === undefined) {
          index = this.children.length;
        }

        child.parent = this;
        this.children.splice(index, 0, child);
        this.cachedChildren = undefined;
        this.scheduleUpdateChildCountAndIndicies();
        this.forceUpdate();
      },
      removeChild(child) {
        const index = this.children.indexOf(child);
        if (index !== -1) {
          this.children.splice(index, 1);
          child.parent = undefined;

          this.cachedChildren = undefined;
          this.scheduleUpdateChildCountAndIndicies();
          this.forceUpdate();
        }
      },
      contains(node) {
        //breadth first
        const index = this.children.indexOf(node);
        if (index !== -1) return true;

        return this.children.some((child) => child.contains && child.contains(node));
      },
      scheduleUpdateChildCountAndIndicies() {
        if (this.updateChildIndiciesScheduled) return;
        this.updateChildIndiciesScheduled = true;
        this.scheduleAfterInputsHaveUpdated(() => {
          this.updateChildIndices();
          if (hasChildCountOutput) {
            this.updateChildrenCount();
          }
          this.updateChildIndiciesScheduled = false;
        });
      },
      getChildren() {
        return this.children;
      },
      isChild(child) {
        return this.children.indexOf(child) !== -1;
      },
      getChildRoot() {
        return this;
      },
      setLayout(layout) {
        if (this.props.layout === layout) return;
        this.props.layout = layout;

        // Children read this as `parentLayout` in their own render (see the
        // `noodlNodeAsProp` block in `render`), and `renderChildren` memoises
        // the elements it built from it. Re-rendering only ourselves would hand
        // React those same elements back, so the children would keep laying
        // themselves out for the layout we just left — a percentage width
        // stays a flex-grow after a switch to column, and stays a plain width
        // after a switch to row, which makes the first child eat the row.
        // Dropping the memo is what makes the children recompute.
        this.cachedChildren = undefined;
        this.forceUpdate();
      },
      forceUpdate() {
        if (this.forceUpdateScheduled === true) return;
        this.forceUpdateScheduled = true;

        this.context.eventEmitter.once('frameEnd', () => {
          this.forceUpdateScheduled = false;

          if (this.renderedAtFrame === this.context.frameNumber) {
            return;
          }

          this.reactComponentRef && this.reactComponentRef.setState({});
        });
        this.context.scheduleUpdate();
      },
      _resetReactVirtualDOM() {
        //reset the react key to force a full re-render
        //this can be required since we're editing the DOM tree, without React knowing
        //and can confuse React in certain cases
        this.reactKey = 'key' + reactKeyCounter;
        reactKeyCounter++;
        const parent = this.getVisualParentNode();
        if (parent) {
          parent.cachedChildren = undefined;
          parent.forceUpdate();
        }
      },
      /** Added for SSR Support */
      triggerDidMount() {
        if (this.wantsToBeMounted && !this.didCallTriggerDidMount) {
          this.didCallTriggerDidMount = true;

          if (this.hasOutput('didMount')) {
            this.sendSignalOnOutput('didMount');
          }

          // HACK: This is requried for the Page Router.
          if (this.props.didMount) {
            this.props.didMount();
          }

          // HACK: Repeater... same as above
          if (this.didMount) {
            this.didMount();
          }
        }

        this.children.forEach((child) => {
          // TODO: Repeater is missing triggerDidMount
          child.triggerDidMount && child.triggerDidMount();
        });
      },
      render() {
        if (!this.wantsToBeMounted) {
          return;
        }

        //these props will only be sent when this component
        //is added to the react tree. Further updates will only call
        //render on the NoodlReactComponent, so make sure these props
        //don't need to change over the lifetime of this node
        return React.createElement(NoodlReactComponent, {
          key: this.reactKey,
          noodlNode: this,
          ref: (ref) => {
            this.reactComponentRef = ref;
            if (ref) {
              // Built-ins and host elements have already reported their root
              // via setDOMElement (child refs commit first), which also set
              // the observer target. The deferred fallback only matters for
              // third-party components, where getDOMElement() may need the
              // findDOMNode escape hatch on the React 18 runtime.
              if (!this._domElement) {
                requestAnimationFrame(() => {
                  if (!this._domElement) {
                    this.boundingBoxObserver.setTarget(this.getDOMElement());
                  }
                });
              }
            } else if (!this._domElement) {
              this.boundingBoxObserver.setTarget(null);
            }
          }
        });
      },
      renderChildren() {
        if (!this.cachedChildren) {
          let c = this.children.map((child) => child.render());

          let children = [];
          flattenArray(children, c);

          if (children.length === 0) {
            children = null;
          } else if (children.length === 1) {
            //some components expects a single child only, and won't handle arrays
            //and React.Children.only() throws an error on an array with only one child
            children = children[0];
          }

          this.cachedChildren = children;
        }

        return this.cachedChildren;
      },
      setStyle(newStyles, styleTag) {
        //this method will try to set css styles directly on the
        //raw DOM elements, circumventing React.
        //However, there's some layout and align attributes that are dependent
        //on each other and need to go through additional processing.
        //This function will detect those and trigger everything to run through the
        //React component when necessary.

        //TODO: move all these checks to the inputs themselves
        //so the set-method of e.g. marginLeft can do the check and either
        //set the style directly on the dom node, or trigger a react render
        const styleObject = styleTag ? this.props.styles[styleTag] : this.style;

        for (const p in newStyles) {
          styleObject[p] = newStyles[p];
        }

        const domElement = this.getDOMElement();
        if (!domElement) return;

        let forceUpdate = false;

        if (!styleTag) {
          if (newStyles.hasOwnProperty('opacity')) {
            //opacity change between zero and non-zero can toggle pointer events
            //to be treated differently, so make sure to force update during those transitions

            //note: properties in domElement.style are all strings
            forceUpdate =
              newStyles.hasOwnProperty('opacity') &&
              ((domElement.style.opacity === '0' && newStyles.opacity > 0) ||
                (domElement.style.opacity !== '0' && newStyles.opacity === 0));
          }
          if (newStyles.transform) {
            let transform = newStyles.transform;

            const parent = this.getVisualParentNode();
            //three ways we can be position absolute:
            //1. user explicitly set this node to absolute
            //2. parent has no layout, which translate into no flexDirection
            //3. there is no parent, meaning we're a root in the root component
            if (this.style.position === 'absolute' || !parent || !parent.style.flexDirection) {
              if (this.props.alignX === 'center' && !(domElement.style.marginLeft && domElement.style.marginRight))
                transform = 'translateX(-50%) ' + transform;
              if (this.props.alignY === 'center' && !(domElement.style.marginTop && domElement.style.marginBottom))
                transform = 'translateY(-50%) ' + transform;
            }

            newStyles.transform = transform;
          }

          const marginsChanged =
            newStyles.hasOwnProperty('marginLeft') ||
            newStyles.hasOwnProperty('marginRight') ||
            newStyles.hasOwnProperty('marginTop') ||
            newStyles.hasOwnProperty('marginBottom');
          const sizeInPercent =
            (this.props.width && this.props.width[this.props.width.length - 1] === '%') ||
            (this.props.height && this.props.height[this.props.height.length - 1] === '%');
          if (sizeInPercent && marginsChanged) {
            forceUpdate = true;
          }

          if (newStyles.position || newStyles.flexDirection || newStyles.clip) {
            forceUpdate = true;
          }
        }

        if (forceUpdate) {
          this.forceUpdate();
        } else {
          setStylesOnDOMNode(domElement, newStyles, styleTag);
        }
      },
      removeStyle(styles, styleTag) {
        const styleObject = styleTag ? this.props.styles[styleTag] : this.style;

        for (const p of styles) {
          delete styleObject[p];
        }

        const domElement = this.getDOMElement();

        let forceUpdate = false;
        if (!styleTag && domElement) {
          const forceUpdateAttributes = {
            marginTop: true,
            marginBottom: true,
            marginLeft: true,
            marginRight: true
          };

          for (const p of styles) {
            if (forceUpdateAttributes[p]) forceUpdate = true;
          }
        }

        if (domElement) {
          //deleting styles is done by setting them to an empty string
          const newStyles = {};
          for (const p of styles) {
            newStyles[p] = '';
          }
          setStylesOnDOMNode(domElement, newStyles, styleTag);
        }

        if (forceUpdate) {
          this.forceUpdate();
        }
      },
      getStyle(style) {
        return this.style[style];
      },
      getRef() {
        return this.reactComponentRef;
      },
      setDOMElement(element) {
        this._domElement = element || undefined;
        if (this.boundingBoxObserver) {
          this.boundingBoxObserver.setTarget((element as HTMLElement) || null);
        }
      },
      /**
       * NDA-012 (Visual) check A3 — run an imperative action on the inner React component,
       * or hold it until there is one.
       *
       * The idiom this replaces is
       * `this.innerReactComponentRef && this.innerReactComponentRef.play()`, and it is not a
       * guard so much as a coin toss: the ref is assigned by React's ref callback, which
       * commits *after* the graph update that delivered the signal. A `Play` or a
       * `Scroll To Element` that arrives in the frame the node mounts therefore hits a null
       * ref and is dropped, with nothing logged and no output to say so.
       *
       * `scheduleAfterInputsHaveUpdated` — which `Group`'s `Scroll To Index` uses and its
       * `Scroll To Element` does not — narrows the window but does not close it: it defers to
       * the end of the graph update, still before React commits. Waiting for the ref itself is
       * the only thing that actually answers the question, so this queues and the ref callback
       * flushes.
       *
       * ⚠️ A node that never mounts would otherwise accumulate for ever, so the queue is
       * capped. An author holding a button down against an unmounted node should not grow the
       * heap, and replaying two hundred queued `Play`s at mount would be its own defect.
       */
      withInnerComponent(action, onDropped) {
        if (this.innerReactComponentRef) {
          action(this.innerReactComponentRef);
          return;
        }
        if (!this._pendingInnerActions) this._pendingInnerActions = [];
        if (this._pendingInnerActions.length >= 16) {
          const dropped = this._pendingInnerActions.shift();
          // ERG-001 §4. The cap is right — replaying two hundred queued `Play`s at mount would
          // be its own defect — but until now a dropped action was the *only* way an action here
          // could end in silence, which is precisely the class the outcome contract closes. A
          // caller that owns an outcome token says so, and the drop reports `Failure` rather
          // than vanishing. Callers with no outcome to report pass nothing and behave as before.
          if (dropped && dropped._onDropped) dropped._onDropped();
        }
        if (onDropped) (action as PendingInnerAction)._onDropped = onDropped;
        this._pendingInnerActions.push(action);
      },
      outcomeOnInnerComponent(action, options) {
        const outcome = this.beginOutcome();
        const code = (options && options.code) || 'visual/action-failed';
        this.withInnerComponent(
          (inner) => {
            const reason = action(inner);
            // The imperative call has already run, so its effects are in place before the
            // outcome lands — "the outcome is the last thing an action does".
            if (typeof reason === 'string') {
              this.reportOutcome(outcome, 'failure', { code, message: reason });
            } else {
              this.reportOutcome(outcome, 'done');
            }
          },
          () => {
            this.reportOutcome(outcome, 'failure', {
              code: 'visual/action-dropped',
              message:
                'This action waited for the element to exist and was discarded after 16 more ' +
                'arrived behind it, so it never ran — the element has not mounted'
            });
          }
        );
      },
      /** Called by the wrapper's ref callback once the inner component exists. */
      _flushPendingInnerActions() {
        const pending = this._pendingInnerActions;
        if (!pending || pending.length === 0) return;
        // Cleared *before* running, so an action that queues another does not re-enter this
        // list while it is being drained.
        this._pendingInnerActions = [];
        for (const action of pending) action(this.innerReactComponentRef);
      },
      getDOMElement() {
        // Built-ins report their root through setDOMElement; host-element
        // inner components are caught by the wrapper's ref callback.
        if (this._domElement) {
          return this._domElement as HTMLElement;
        }

        // ⚠️ `typeof Element !== 'undefined'` is load-bearing, not defensive noise: `instanceof`
        // against an undeclared global is a `ReferenceError`, not `false`, and this accessor is
        // reached from nodes that declare SSR `safe` (`Group`'s `Scroll To Element` is the one
        // that found it). Without the guard, asking a node for its element anywhere without a
        // DOM throws instead of answering "there isn't one".
        const hasDOM = typeof Element !== 'undefined';

        const innerRef = this.innerReactComponentRef;
        if (innerRef && hasDOM && innerRef instanceof Element) {
          return innerRef as HTMLElement;
        }

        // Third-party module components that neither render a host root nor
        // forward a ref: on the React 18 runtime findDOMNode still exists and
        // restores the pre-19 behaviour. On React 19 it is undefined and such
        // components simply have no reachable root (documented behavioural
        // difference).
        const ref = this.getRef();
        if (!ref) return null;

        if (hasDOM && ref instanceof Element) {
          return ref as unknown as HTMLElement;
        }

        const findDOMNode = (ReactDOM as TSFixme).findDOMNode;
        if (typeof findDOMNode === 'function') {
          try {
            // eslint-disable-next-line react/no-find-dom-node -- deliberate: only reachable on the React 18 runtime, where it restores pre-19 behaviour for third-party components; undefined (and skipped) on React 19
            return findDOMNode(ref);
          } catch (e) {
            return null;
          }
        }

        return null;
      },
      getVisualParentNode() {
        if (this.parent) return this.parent;

        //we're a root
        let component = this.nodeScope.componentOwner;
        while (!component.parent && component.parentNodeScope) {
          component = component.parentNodeScope.componentOwner;
        }

        return component ? component.parent : undefined;
      },
      setVariant(variant) {
        //stop any state transitions that are currently running
        this._stopStateTransitions();

        this.variant = variant;

        const parameters = {};
        //apply base variant parameters
        variant && mergeDeep(parameters, variant.parameters);

        //apply base node parameters
        mergeDeep(parameters, this.model.parameters);

        //and then states, if any
        if (this.currentVisualStates) {
          const stateParameters = this.getParametersForStates(this.currentVisualStates);
          mergeDeep(parameters, stateParameters);
        }

        const parametersToSet = Object.keys(parameters).filter((p) => !this._hasInputBeenSetFromAConnection(p));

        for (const inputName of parametersToSet) {
          this.registerInputIfNeeded(inputName);

          if (this.hasInput(inputName)) {
            this.queueInput(inputName, parameters[inputName]);
          }
        }
      },
      getParameter(name) {
        if (this.model.parameters.hasOwnProperty(name)) {
          return this.model.parameters[name];
        } else if (this.variant && this.variant.parameters.hasOwnProperty(name)) {
          return this.variant.parameters[name];
        } else {
          return this.context.getDefaultValueForInput(this.model.type, name);
        }
      },
      getParametersForStates(states) {
        const params = {};

        //1. Get the parameters from the variant
        //2. Then override with all local values from the node's neutral state (so a color in neutral will override all states from the variant)
        //3. then apply the node specific state parameters

        //1. Apply variant states
        if (this.variant) {
          for (const state of states) {
            if (this.variant.stateParameters && this.variant.stateParameters.hasOwnProperty(state)) {
              mergeDeep(params, this.variant.stateParameters[state]);
            }
          }
        }

        //2. Override with local values from the nodes neutral state
        for (const param in params) {
          if (this.model.parameters.hasOwnProperty(param)) {
            if (isObject(params[param])) {
              mergeDeep(params[param], this.model.parameters[param]);
            } else {
              params[param] = this.model.parameters[param];
            }
          }
        }
        // mergeDeep(params, this.model.parameters);

        //3. Apply node specific state paramters
        if (this.model.stateParameters) {
          for (const state of states) {
            if (this.model.stateParameters.hasOwnProperty(state)) {
              mergeDeep(params, this.model.stateParameters[state]);
            }
          }
        }

        return params;
      },
      _getNewState(prevStates, newStates) {
        const addedStates = newStates.filter((value) => !(prevStates || []).includes(value));
        const newState = addedStates.length ? addedStates[0] : 'neutral';

        return newState === '' ? 'neutral' : newState;
      },
      _getDefaultTransition(state) {
        if (
          this.model.defaultStateTransitions &&
          this.model.defaultStateTransitions[state] &&
          this.model.defaultStateTransitions[state].curve
        ) {
          return this.model.defaultStateTransitions[state];
        } else if (
          this.variant &&
          this.variant.defaultStateTransitions &&
          this.variant.defaultStateTransitions[state] &&
          this.variant.defaultStateTransitions[state].curve
        ) {
          return this.variant.defaultStateTransitions[state];
        }
      },
      _getStateTransition(state) {
        let transitions = {};

        if (this.model.stateTransitions && this.model.stateTransitions[state]) {
          Object.assign(transitions, this.model.stateTransitions[state]);
        }

        if (this.variant && this.variant.stateTransitions && this.variant.stateTransitions[state]) {
          Object.assign(transitions, this.variant.stateTransitions[state]);
        }

        return transitions;
      },
      setVisualStates(newStates) {
        if (!this.model) {
          //this node has probably been generated by a router or similar, and is an internal node without a model
          //those nodes can't have visual states
          return;
        }

        const statesAreEqual =
          this.currentVisualStates &&
          newStates.length === this.currentVisualStates.length &&
          newStates.every((val, index) => val === this.currentVisualStates[index]);
        if (statesAreEqual) return;

        const prevStateParams = this.currentVisualStates ? this.getParametersForStates(this.currentVisualStates) : {};
        const newStateParams = this.getParametersForStates(newStates);

        const newState = this._getNewState(this.currentVisualStates, newStates);

        this.currentVisualStates = newStates;

        const newValues = {};

        //all params that were in the old states, but not in the new states, needs to be reset back to original state
        for (const param in prevStateParams) {
          if (!newStateParams.hasOwnProperty(param) && !this._hasInputBeenSetFromAConnection(param)) {
            const value = this.getParameter(param);
            if (value !== undefined) {
              newValues[param] = this.getParameter(param);
            }
          }
        }

        for (const param in newStateParams) {
          if (!this._hasInputBeenSetFromAConnection(param) && newStateParams[param] !== undefined) {
            newValues[param] = newStateParams[param];
          }
        }

        const defaultTransition = this._getDefaultTransition(newState);
        const stateTransition = this._getStateTransition(newState);

        for (const param in newValues) {
          if (stateTransition[param] && stateTransition[param].curve) {
            transitionParameter(this, param, newValues[param], stateTransition[param]);
          } else if (!stateTransition[param] && defaultTransition) {
            transitionParameter(this, param, newValues[param], defaultTransition);
          } else {
            //stop any running transition
            if (this._transitions && this._transitions[param]) {
              this._transitions[param].stop();
              delete this._transitions[param];
            }

            this.queueInput(param, newValues[param]);
          }
        }
      },
      _getVisualStates() {
        return this.currentVisualStates || [];
      },
      _stopStateTransitions() {
        if (!this._transitions) return;

        for (const name in this._transitions) {
          this._transitions[name].stop();
          delete this._transitions[name];
        }
      }
    }
  };

  if (useVariants) {
    ReactComponentNode.inputs.variant = {
      displayName: 'Variant',
      group: 'General',
      description: 'Name of a saved variant of this node type to apply, replacing the styling set here',
      type: {
        name: 'string',
        allowConnectionsOnly: true
      },
      set(variantName) {
        if (this.variant && this.variant.name === variantName) return;
        const variant = this.context.variants.getVariant(this.model.type, variantName);
        variant && this.setVariant(variant);
      }
    };
  }

  if (def.mountedInput !== false) {
    ReactComponentNode.inputs.mounted = {
      displayName: 'Mounted',
      index: 9999,
      type: 'boolean',
      group: 'General',
      description: 'Removes the element from the page entirely when false, unlike Visible which leaves its space behind',
      default: true,
      set(value) {
        value = value ? true : false;
        if (this.wantsToBeMounted !== value) {
          this.wantsToBeMounted = value;
          //either we have a direct parent, or we're a root and need to tell
          //the parent of the component instance instead
          const parent = this.getVisualParentNode();
          if (parent) {
            parent.cachedChildren = undefined;
            parent.forceUpdate();
          }
        }
      }
    };
  }

  const hasChildCountOutput = ReactComponentNode.allowChildren || ReactComponentNode.displayName;

  if (hasChildCountOutput) {
    ReactComponentNode.outputs.childrenCount = {
      group: 'Advanced', // SIG-003 — see `childIndex` above
      displayName: 'Children Count',
      type: 'number',
      description: 'How many child elements are currently mounted inside this one',
      get() {
        return this.childrenCount;
      }
    };
  }

  //regular inputs
  for (const name in inputs) {
    ReactComponentNode.inputs[name] = inputs[name];
  }

  //inputs that set react props
  for (const inputName in inputProps) {
    const input = inputProps[inputName];
    if (input.type === 'node') {
      input.type = 'reference';
      input.set = function (value) {
        const props = input.propPath ? this.props[input.propPath] : this.props;
        if (value !== undefined) {
          props[inputName] = value.render();
        } else {
          delete props[inputName];
        }
        this.forceUpdate();
      };
    } else {
      if (input.type === 'signal') {
        console.error(`Error: Signals not supported as a react prop. node: '${def.name}' input: '${inputName}'`);
      } else {
        defineRegularInputProp(input, inputName);
      }
    }

    ReactComponentNode.inputs[inputName] = input;
  }

  //inputs that set a css attribute
  for (const name in inputCss) {
    const input = inputCss[name];
    const styleTargetName = input.targetStyleProperty || name;
    // See the note in `initialize`: units only ever appear on the object form.
    const type = input.type as PortType;

    if (type.units) {
      input.set = function (value) {
        // AIB-001: a design-token reference is already a complete CSS value.
        // Without this it fell into the line below, was fitted with the port's
        // default unit and emitted as `var(--space-4)px` — invalid CSS, dropped
        // by the browser with no error anywhere. The authoring prompt instructs
        // the model to write exactly this form for spacing and radius, so every
        // on-system value it produced for a units port silently did nothing.
        if (isTokenReference(value)) {
          this.setStyle({ [styleTargetName]: value }, input.styleTag);
          if (input.onChange) input.onChange.call(this, value);
          return;
        }

        if (typeof value !== 'object' && type.defaultUnit) {
          value = { value, unit: type.defaultUnit };
        }

        if (typeof value === 'object' && value.value !== undefined) {
          //this is a value with a unit
          this.setStyle({ [styleTargetName]: value.value + value.unit }, input.styleTag);
        } else if (value !== undefined) {
          //value without a unit. One example is line height, that can be unitless
          this.setStyle({ [styleTargetName]: value }, input.styleTag);
        } else {
          //value is undefined, so just reset the style
          this.removeStyle([styleTargetName], input.styleTag);
        }
        if (input.onChange) {
          input.onChange.call(this, value);
        }
      };
    } else {
      input.set = function (value) {
        if (value !== undefined) {
          this.setStyle({ [styleTargetName]: value }, input.styleTag);
        } else {
          this.removeStyle([styleTargetName], input.styleTag);
        }
        if (input.onChange) {
          input.onChange.call(this, value);
        }
      };
    }

    ReactComponentNode.inputs[name] = input;
  }

  //regular outputs
  for (const name in outputs) {
    ReactComponentNode.outputs[name] = outputs[name];
  }

  //outputs triggered by react props
  for (const name in outputProps) {
    const output = outputProps[name];

    if (output.type !== 'signal') {
      output.get = function () {
        return this.outputPropValues[name];
      };
    }

    ReactComponentNode.outputs[name] = output;
  }

  for (const name in methods) {
    ReactComponentNode.methods[name] = methods[name];
  }

  return {
    node: ReactComponentNode,
    setup: def.setup
  };
}

function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

export { createNodeFromReactComponent };
