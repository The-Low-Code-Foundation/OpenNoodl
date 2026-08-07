export enum RuntimeType {
  Browser = 'browser',
  Cloud = 'cloud',
  /**
   * WFA-004 — the WF-001 workflow engine.
   *
   * This filters which node types the picker offers for the graph you have
   * open, which is the whole job `RuntimeType` does. It does NOT say a workflow
   * is a component: a workflow is its own document type stored on a backend,
   * not in the project (see WFA-004-ASSESSMENT §1). The node types under this
   * runtime are the WF-002 step kinds, and they arrive from a running backend's
   * `GET /admin/workflow-step-kinds` — never from a bundled copy, which could
   * offer a kind the target backend cannot execute.
   */
  Workflow = 'workflow'
}

export const RuntimeTypes: RuntimeType[] = [RuntimeType.Browser, RuntimeType.Cloud, RuntimeType.Workflow];

export interface NodeLibraryDataNode {
  name: string;
  description: string;
  type: string;
  subCategories: {
    name: string;
    items: string[];
  }[];
}

export interface NodeLibraryTypecast {
  from: string;
  to: string[];
}

export interface NodeLibraryDataDynamicPort {
  type: string;
  name: string;
}

/**
 * One project-settings port, as it arrives over the wire.
 *
 * The viewer declares these in `noodl-viewer-react/src/project-settings.ts` and hands
 * the array straight to the editor via `setProjectSettings` — already in the editor's
 * wire format, each entry naming itself and its `plug`, rather than keyed by name
 * inside a node definition. This is the editor's side of that wire, which is what this
 * file describes; `type` stays loose because a port type is either a bare name
 * (`'string'`) or a spec object (`{ name: 'enum', enums: [...] }`), and the editor
 * passes both through to the property panel without inspecting them.
 */
export interface NodeLibraryProjectSettingsPort {
  name: string;
  type: string | Record<string, unknown>;
  plug?: 'input' | 'output' | 'input/output';
  displayName?: string;
  group?: string;
  default?: unknown;
  tooltip?: unknown;
  /** Keeps the setting out of an exported or deployed build's settings surface. */
  ignoreInExport?: boolean;
}

/**
 * The project-settings template.
 *
 * Both members are optional because `getProjectSettingsPorts()` falls back to `{}`
 * when the library has not loaded yet — which is the state the Settings panel opens in.
 */
export interface NodeLibraryProjectSettings {
  ports?: NodeLibraryProjectSettingsPort[];
  dynamicports?: NodeLibraryDataDynamicPort[];
}

export interface NodeLibraryDataNodeColors {
  base: string;
  baseHighlighted: string;
  header: string;
  headerHighlighted: string;
  outline: string;
  outlineHighlighted: string;
  text: string;
}

export interface NodeLibraryDataConnectionColors {
  normal: string;
  highlighted: string;
  pulsing: string;
}

export interface NodeLibraryDataNodeType {
  runtimeTypes?: RuntimeType[];
  name: string;
  docs: string;
  color: string;
  allowAsChild: boolean;
  category: string;
  haveComponentChildren: string[];
}

export interface NodeLibraryData {
  projectsettings: NodeLibraryProjectSettings;

  typecasts: NodeLibraryTypecast[];

  dynamicports: NodeLibraryDataDynamicPort[];

  colors: {
    nodes: {
      component: NodeLibraryDataNodeColors;
      visual: NodeLibraryDataNodeColors;
      data: NodeLibraryDataNodeColors;
      javascript: NodeLibraryDataNodeColors;
      default: NodeLibraryDataNodeColors;
    };
    connections: {
      signal: NodeLibraryDataConnectionColors;
      default: NodeLibraryDataConnectionColors;
    };
  };

  nodetypes: NodeLibraryDataNodeType[];

  nodeIndex: {
    coreNodes: NodeLibraryDataNode[];
    moduleNodes: {
      name: string;
      items: TSFixme[];
    }[];
  };
}
