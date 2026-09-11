/**
 * Deploy the components an MCP authoring run actually wrote — not twins of them.
 *
 * SB-004 §7 acceptance 8 is the reason this exists. The task's product is seven
 * cloud components on disk in the v2 multi-file shape; a backend loads
 * `*.workflow.json` bundles in the runtime's export shape. Between those two
 * sits one conversion, and the choice is to perform it here or to re-type the
 * graphs by hand into a fixture — which is what
 * `measure-the-artefact-before-believing-the-task-file` is about: a twin agrees
 * with the artefact only until the first edit that reaches one of them.
 *
 * ## What is borrowed and what is written here
 *
 * The v2 → legacy half is the **editor's own reader**, re-exported by
 * `noodl-mcp/src/editor-deps.ts` precisely so a plain node process can call it:
 * `reconstructLegacyComponent` (which uses `unflattenNodes`) is pure — it
 * imports types and nothing else, no `ProjectModel`, no `NodeLibrary`, no
 * Electron.
 *
 * The legacy → runtime half is written here, because the editor's version
 * (`utils/exporter/util.ts`, `exportComponent`) reads `node.type.allowAsChild`
 * and `graph.getConnectionHealth` off live `NodeLibrary` types and cannot be
 * reached from a test process. Three things differ, and each is stated rather
 * than assumed:
 *
 *  1. **Connections are renamed, not reshaped.** `fromId/fromProperty` becomes
 *     `sourceId/sourcePort` (`exportConnection`, same file). The editor drops
 *     unhealthy connections here; nothing does that for us, which is the
 *     honest behaviour for this bridge — a wire the door accepted is a wire the
 *     runtime should be given.
 *  2. **`roots` is empty.** The editor puts a root node's id in `roots` when its
 *     type is `allowAsChild`, i.e. when it is visual. Cloud components have no
 *     visual tree at all, so the list is empty by construction — and
 *     `editor-deps.ts` warns that `visualRoots` is a fixed point through the
 *     importer, so this bridge must not be reused for a page.
 *  3. 🔴 **Component ports are derived from the Component Inputs/Outputs
 *     nodes, and the plug is INVERTED.** This is the one that costs a wrong
 *     conclusion. `cloud-run-tasks-loop.test.ts`'s header records it from the
 *     other side: a component's ports come from the **component-level** `ports`
 *     array (`componentmodel.ts:456-463`), never from those nodes' own — with
 *     the ports only on the nodes, Run Tasks reported
 *     `run-tasks/no-completion-output` because the template had no `Success`
 *     the instance could expose, and the HTTP request then hung rather than
 *     answering (CWF-018). A Component Inputs node *outputs* a value into its
 *     graph, so `{plug: 'output'}` there is `{plug: 'input'}` on the component;
 *     Component Outputs is the mirror. `createFromExportData` reads exactly
 *     that field to decide which map a port lands in.
 *
 * Only `port.name` is load-bearing at run time — `registerComponentInputPort`
 * uses the name and nothing else — so the authored type string is passed through
 * verbatim rather than being translated into the editor's `{name}` form.
 */
import * as fs from 'fs';
import * as path from 'path';

import { reconstructLegacyComponent } from '../../../noodl-mcp/src/editor-deps';

/** A connection in the runtime's export shape. */
export interface RuntimeConnection {
  sourceId: string;
  sourcePort: string;
  targetId: string;
  targetPort: string;
}

/** A component as a `*.workflow.json` bundle carries it. */
export interface RuntimeComponent {
  name: string;
  ports: Array<{ name: string; plug: string; type: unknown }>;
  nodes: unknown[];
  connections: RuntimeConnection[];
  roots: string[];
}

/** The bundle itself, as `WorkflowRunner.loadWorkflows` reads it. */
export interface WorkflowBundle {
  components: RuntimeComponent[];
  settings: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

interface AuthoredNode {
  id: string;
  type: string;
  ports?: Array<{ name: string; plug?: string; type?: unknown }>;
  children?: AuthoredNode[];
}

/** The two node types that contribute a component's interface. */
const INTERFACE_NODES: Record<string, 'input' | 'output'> = {
  // A Component Inputs node's OUTPUT port is a component INPUT, and vice versa.
  'Component Inputs': 'input',
  'Component Outputs': 'output'
};

function walk(nodes: AuthoredNode[], visit: (node: AuthoredNode) => void): void {
  for (const node of nodes) {
    visit(node);
    if (node.children?.length) walk(node.children, visit);
  }
}

/**
 * The component-level `ports` array, from the interface nodes in the graph.
 *
 * ⚠️ A duplicate name across two interface nodes of the same kind is collapsed,
 * which matches `addInputPort`'s own last-write-wins dictionary. The authored
 * components each have one of each node, and the caller asserts the port set it
 * expected rather than trusting this.
 */
function deriveComponentPorts(nodes: AuthoredNode[]): RuntimeComponent['ports'] {
  const ports: RuntimeComponent['ports'] = [];
  const seen = new Set<string>();

  walk(nodes, (node) => {
    const plug = INTERFACE_NODES[node.type];
    if (!plug) return;
    for (const port of node.ports ?? []) {
      const key = `${plug}:${port.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      ports.push({ name: port.name, plug, type: port.type });
    }
  });

  return ports;
}

/**
 * Read one authored component's three v2 files and return it in the shape a
 * workflow bundle carries.
 *
 * `registryKey` is the directory under `components/` and the key in
 * `_registry.json` — e.g. `__cloud__/publishPage`. The legacy name comes out of
 * the component file's own `path`, which is what `toLegacyName` prefers, so the
 * name a `taskTemplate` or an instance node refers to is the one on disk rather
 * than one this bridge reconstructed.
 */
export function readAuthoredComponent(projectDir: string, registryKey: string): RuntimeComponent {
  const dir = path.join(projectDir, 'components', registryKey);
  const read = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8')) as T;

  const legacy = reconstructLegacyComponent(
    registryKey,
    read('component.json'),
    read('nodes.json'),
    read('connections.json')
  );

  const roots = (legacy.graph.roots ?? []) as unknown as AuthoredNode[];

  return {
    name: legacy.name,
    ports: deriveComponentPorts(roots),
    nodes: roots,
    connections: (legacy.graph.connections ?? []).map((c) => ({
      sourceId: c.fromId,
      sourcePort: c.fromProperty,
      targetId: c.toId,
      targetPort: c.toProperty
    })),
    // Cloud components have no visual tree — see the header.
    roots: []
  };
}

/** The whole bundle, in the order given. */
export function bundleAuthoredComponents(projectDir: string, registryKeys: string[]): WorkflowBundle {
  return {
    components: registryKeys.map((key) => readAuthoredComponent(projectDir, key)),
    settings: {},
    metadata: {}
  };
}
