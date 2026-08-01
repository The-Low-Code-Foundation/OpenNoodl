/* GENERATED FILE — do not edit.
 * Regenerate with: npm run catalog:generate
 * Source of truth: the live node registries (see scripts/node-catalog/).
 * Field semantics: docs/node-catalog/SCHEMA.md
 */

/** Canonical node type strings as they appear in project files (`node.type`). */
export type NodeTypeName =
  | 'AddDbModelRelation'
  | 'And'
  | 'Animation'
  | 'Boolean'
  | 'Boolean To String'
  | 'Button'
  | 'CSS Definition'
  | 'Checkbox'
  | 'Circle'
  | 'Cloud File'
  | 'Cloud Function'
  | 'CloudFunction2'
  | 'Collection'
  | 'Collection2'
  | 'CollectionClear'
  | 'CollectionInsert'
  | 'CollectionNew'
  | 'CollectionRemove'
  | 'Color'
  | 'Color Blend'
  | 'Component Children'
  | 'Component Inputs'
  | 'Component Outputs'
  | 'Component State'
  | 'Condition'
  | 'Counter'
  | 'Date To String'
  | 'DbCollection'
  | 'DbCollection2'
  | 'DbConfig'
  | 'DbModel'
  | 'DbModel2'
  | 'DeleteDbModelProperties'
  | 'Drag'
  | 'Event Receiver'
  | 'Event Sender'
  | 'Expression'
  | 'Field Set'
  | 'Filter Collection'
  | 'FilterDBModels'
  | 'For Each'
  | 'For Each Actions'
  | 'Form'
  | 'Globals'
  | 'Group'
  | 'Gyroscope'
  | 'Image'
  | 'Inverter'
  | 'JavaScriptFunction'
  | 'Javascript2'
  | 'Label'
  | 'Logic Builder'
  | 'Map Collection'
  | 'Model'
  | 'Model2'
  | 'NavigationClosePopup'
  | 'NavigationShowPopup'
  | 'NewDbModelProperties'
  | 'NewModel'
  | 'Number'
  | 'Number Blend'
  | 'Number Remapper'
  | 'On App Error'
  | 'Open File Picker'
  | 'Options'
  | 'Or'
  | 'Page'
  | 'Page Stack'
  | 'PageInputs'
  | 'PageStackNavigate'
  | 'PageStackNavigateBack'
  | 'PageStackNavigateToPath'
  | 'Parent Component State'
  | 'REST2'
  | 'Radio Button'
  | 'Radio Button Group'
  | 'Range'
  | 'RemoveDbModelRelation'
  | 'Router'
  | 'RouterNavigate'
  | 'RunTasks'
  | 'Screen Resolution'
  | 'Script Downloader'
  | 'Set Variable'
  | 'SetDbModelProperties'
  | 'SetModelProperties'
  | 'Sign File URL'
  | 'Signal To Index'
  | 'States'
  | 'Static Data'
  | 'String'
  | 'String Format'
  | 'String Mapper'
  | 'String Selector'
  | 'Substring'
  | 'Switch'
  | 'Text'
  | 'Text Input'
  | 'Timer'
  | 'Transition'
  | 'Unique Id'
  | 'Upload File'
  | 'Value Changed'
  | 'Variable'
  | 'Variable2'
  | 'Video'
  | 'net.noodl.ActionDispatcher'
  | 'net.noodl.ActionHandler'
  | 'net.noodl.ComponentObject'
  | 'net.noodl.GlobalStore'
  | 'net.noodl.GlobalStore.Set'
  | 'net.noodl.GlobalStore.Subscribe'
  | 'net.noodl.HTTP'
  | 'net.noodl.JSONStreamParser'
  | 'net.noodl.OptimisticUpdate'
  | 'net.noodl.ParentComponentObject'
  | 'net.noodl.PatternExtractor'
  | 'net.noodl.SSE'
  | 'net.noodl.SetComponentObjectProperties'
  | 'net.noodl.SetParentComponentObjectProperties'
  | 'net.noodl.StateHistory'
  | 'net.noodl.StateHistory.Undo'
  | 'net.noodl.StateSnapshot'
  | 'net.noodl.StreamBuffer'
  | 'net.noodl.TextAccumulator'
  | 'net.noodl.WebSocket'
  | 'net.noodl.animatetovalue'
  | 'net.noodl.controls.button'
  | 'net.noodl.controls.checkbox'
  | 'net.noodl.controls.options'
  | 'net.noodl.controls.radiobutton'
  | 'net.noodl.controls.range'
  | 'net.noodl.controls.textinput'
  | 'net.noodl.externallink'
  | 'net.noodl.user.LogIn'
  | 'net.noodl.user.LogOut'
  | 'net.noodl.user.RequestMagicLink'
  | 'net.noodl.user.RequestPasswordReset'
  | 'net.noodl.user.ResetPassword'
  | 'net.noodl.user.SendEmailVerification'
  | 'net.noodl.user.SetUserProperties'
  | 'net.noodl.user.SignInWith'
  | 'net.noodl.user.SignUp'
  | 'net.noodl.user.User'
  | 'net.noodl.user.VerifyEmail'
  | 'net.noodl.visual.columns'
  | 'net.noodl.visual.icon'
  | 'noodl.cloud.aggregate'
  | 'noodl.cloud.request'
  | 'noodl.cloud.response'
  | 'noodl.cloud.sendemail';

/** Node palette categories present in the registries. */
export type NodeCategory =
  | 'Animation'
  | 'Cloud'
  | 'Cloud Services'
  | 'Component Utilities'
  | 'CustomCode'
  | 'Data'
  | 'Events'
  | 'Interpolation'
  | 'Javascript'
  | 'Logic'
  | 'Math'
  | 'Navigation'
  | 'Sensors'
  | 'String Manipulation'
  | 'Utilities'
  | 'Variables'
  | 'Visual';

/** Port value type names present in the registries. */
export type PortTypeName =
  | '*'
  | 'array'
  | 'boolean'
  | 'cloudfile'
  | 'color'
  | 'component'
  | 'date'
  | 'dimension'
  | 'domelement'
  | 'enum'
  | 'font'
  | 'icon'
  | 'image'
  | 'mediastream'
  | 'number'
  | 'object'
  | 'pages'
  | 'proplist'
  | 'reference'
  | 'signal'
  | 'source'
  | 'string'
  | 'stringlist'
  | 'textStyle';

export type RuntimeEnvironment = 'browser' | 'cloud';

export type DynamicPortMechanism =
  | 'declared-port-groups'
  | 'numbered-inputs'
  | 'component-ports'
  | 'runtime-discovered'
  | 'editor-adapter';

export interface PortType {
  name: PortTypeName | string;
  enums?: Array<{ label: string; value: string } | string>;
  /** Present when the enum list is computed at runtime and not statically known. */
  enumsAreDynamic?: boolean;
  units?: string[];
  defaultUnit?: string;
  allowConnectionsOnly?: boolean;
  allowEditOnly?: boolean;
  [extra: string]: unknown;
}

export interface CatalogPort {
  name: string;
  displayName?: string;
  editorName?: string;
  group?: string;
  plug: 'input' | 'output';
  type: PortType;
  isSignal: boolean;
  default?: unknown;
  description?: string;
  index?: number;
  allowVisualStates?: boolean;
  /** True for ports the editor UI does not expose; avoid authoring against them. */
  hiddenInEditor?: boolean;
}

export interface NumberedInputSpec {
  nameBase: string;
  displayPrefix?: string;
  group?: string;
  type?: PortType;
  index?: number;
}

export interface DynamicPortInfo {
  mechanisms: DynamicPortMechanism[];
  description: string;
  declaredPortGroups?: unknown[];
  numberedInputs?: NumberedInputSpec[];
  editorAdapter?: string;
}

/**
 * One key formula in a node's `parameters` object (SUB-013).
 *
 * Every field is observed, not written by hand: the generator drives the node's real
 * dynamic-port hook with seed parameters and records what it emits. `example` is a name the
 * runtime actually produced.
 */
export interface ParameterPattern {
  /** The key formula, with `<variable>` placeholders. E.g. `value-<state>-<value>`. */
  pattern: string;
  plug: 'input' | 'output' | 'input/output';
  /** What each `<variable>` stands for, and which parameter it is drawn from. */
  variables?: Record<string, string>;
  /** The editor property group these ports appear under; may itself be templated. */
  group?: string;
  /**
   * The port's value type. A literal type name when it is fixed, `"varies"` when it is not,
   * or a sentence naming the parameter it follows — for `States`, the value type of
   * `value-<state>-<value>` is chosen by the matching `type-<value>` parameter.
   */
  valueType?: string;
  /** A real emitted port name, preferring one that shows verbatim interpolation. */
  example: string;
}

/**
 * How to write the keys of this node's `parameters` object (SUB-013).
 *
 * `known: false` is a deliberate statement, not a gap: the node's port names could not be
 * determined without project context (a live component, a backend schema, user code), and
 * `reason` says which. It is the same reasoning as the validator's `DynamicPortSkipped` —
 * a check that was knowingly not performed beats silent absence.
 *
 * `known: true` with an empty `patterns` array means the node computes no names at all: its
 * dynamism is visibility only, and every port it can have is already in `inputs`/`outputs`.
 */
export type ParameterEncoding =
  | {
      known: true;
      /** Parameters whose values the keys are derived from. Empty when they are not. */
      seededBy: string[];
      /** Project metadata the keys come from instead, e.g. `dbCollections`. */
      seededByProjectMetadata?: string[];
      patterns: ParameterPattern[];
      notes?: string;
    }
  | { known: false; reason: string };

export interface CatalogNode {
  typeName: NodeTypeName;
  displayName: string;
  category?: NodeCategory;
  isVisual: boolean;
  isDeprecated: boolean;
  /** False for legacy/superseded types or ones created only through specialised flows; avoid authoring these. */
  inNodePicker: boolean;
  availableIn: RuntimeEnvironment[];
  providedBy: 'noodl-runtime' | 'noodl-viewer-react' | 'noodl-viewer-cloud' | 'noodl-editor';
  /**
   * Server-side-rendering compatibility (RUN-002). Present on every
   * browser-available type; absent for cloud-only types, where it does not
   * apply. "safe" runs fully server-side; "partial" runs but with the caveat
   * in note; "client-only" is created inert on the SSR server (ports exist,
   * logic deferred to the browser after hydration).
   */
  ssr?: { compat: 'safe' | 'partial' | 'client-only'; note?: string };
  docs?: string;
  searchTags?: string[];
  module?: string;
  shortDesc?: string;
  singleton?: boolean;
  allowAsChild?: boolean;
  allowChildrenWithCategory?: string[];
  allowAsExportRoot?: boolean;
  useVariants?: boolean;
  visualStates?: Array<{ name: string; label: string }>;
  inputs: CatalogPort[];
  outputs: CatalogPort[];
  dynamicPorts: DynamicPortInfo | null;
  /**
   * How to write the keys of this node's `parameters` object. Non-null for exactly the nodes
   * with a `dynamicPorts` block — `dynamicPorts` says the ports exist, this says what they
   * are called.
   */
  parameterEncoding: ParameterEncoding | null;
}

export interface Typecast {
  from: string;
  to: string[];
}

export interface NodeCatalog {
  catalogFormatVersion: string;
  generatedBy: string;
  schemaDocs: string;
  packages: Record<string, string>;
  portTypeNames: string[];
  typecasts: Typecast[];
  nodes: CatalogNode[];
}
