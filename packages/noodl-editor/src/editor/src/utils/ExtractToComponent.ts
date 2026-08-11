import { ComponentModel } from '@noodl-models/componentmodel';
import { Connection, NodeGraphModel, NodeGraphNode, NodeGraphNodeSet } from '@noodl-models/nodegraphmodel';
import { RuntimeType } from '@noodl-models/nodelibrary/NodeLibraryData';
import { ProjectModel } from '@noodl-models/projectmodel';
import { UndoQueue, UndoActionGroup } from '@noodl-models/undo-queue-model';

import { NodeGraphEditorNode } from '../views/nodegrapheditor/NodeGraphEditorNode';
import { getComponentModelRuntimeType } from './NodeGraph';
import { guid, Rectangle } from './utils';

type ConnectionInfo = {
  connection: Connection;
  portName: string; //name of the component input or output port
};

function flattenTree(roots: readonly NodeGraphEditorNode[]) {
  const nodes = new Set<NodeGraphEditorNode>();

  function addSubtree(node: NodeGraphEditorNode) {
    nodes.add(node);
    for (const child of node.children) {
      addSubtree(child);
    }
  }

  roots.forEach(addSubtree);

  return Array.from(nodes);
}

export function extractToComponent(
  projectModel: ProjectModel,
  nodeGraphModel: NodeGraphModel,
  nodeset: NodeGraphNodeSet,
  selectedNodes: readonly NodeGraphEditorNode[],
  newNodePosition: { x: number; y: number },
  /**
   * The full component name to create, e.g. `/Components/Product card`.
   *
   * Required. It used to be generated here — always
   * `<current component>/Extracted component` — which is why every extraction
   * landed nested inside whatever component it was born in, under a name nobody
   * chose. The caller asks first (see `ExtractToComponentPopup`); this function
   * only performs the extraction.
   */
  componentName: string
) {
  const undoGroup = new UndoActionGroup({ label: 'extract to component' });

  const name = componentName;

  const component = new ComponentModel({
    name,
    graph: new NodeGraphModel(),
    id: guid()
  });

  //get the parent of one of the visual nodes so we know where to place the new component instace
  const firstNodeWithParent = getFirstNodeWithExternalParent(selectedNodes);
  const parent = firstNodeWithParent?.parent;
  const childIndex = parent?.children.indexOf(firstNodeWithParent);

  //get all nodes, including children
  const selectedNodesAndChildren = flattenTree(selectedNodes);

  //figure out which connections needs to move to component inputs and outputs
  const [componentInputs, componentOutputs] = collectComponentInputsAndOutputs(
    nodeGraphModel,
    selectedNodesAndChildren
  );

  //remove the nodes we're extracting
  nodeGraphModel.removeNodeSet(nodeset, { undo: undoGroup });

  //set the origin of the nodes to 0,0
  const originalOrigin = nodeset.getOriginPosition();
  undoGroup.pushAndDo({
    do() {
      nodeset.setOriginPosition({ x: 0, y: 0 });
    },
    undo() {
      nodeset.setOriginPosition(originalOrigin);
    }
  });

  //and add them to the new component
  component.graph.insertNodeSet(nodeset, { undo: undoGroup });

  //connect the component input and output nodes
  connectComponentInputsAndOutputs(component, componentInputs, componentOutputs, undoGroup);

  //add the new component to the project
  projectModel.addComponent(component, { undo: undoGroup });

  //create an instance of the new component...
  const node = NodeGraphNode.fromJSON({
    type: name,
    id: guid(),
    x: newNodePosition.x,
    y: newNodePosition.y
  });

  if (parent) {
    parent.model.insertChild(node, childIndex, { undo: undoGroup });
  } else {
    nodeGraphModel.addRoot(node, { undo: undoGroup });
  }

  connectExternalInputsAndOutputs(nodeGraphModel, node, componentInputs, componentOutputs, undoGroup);

  UndoQueue.instance.push(undoGroup);
}

export function canExtractToComponent(
  nodeGraphModel: NodeGraphModel,
  selectedNodes: readonly NodeGraphEditorNode[]
): { allow: boolean; reason?: string } {
  //can't extract siblings since they would require a new parent which could change behavior, so don't allow it
  const parents = getParents(selectedNodes);
  if (parents.length > 1) {
    return { allow: false, reason: 'Nodes that are siblings must have have their parent selected' };
  }

  //extracting component and outputs nodes aren't implemented (but would be fairly straight forward to do)
  const hasComponentInputs = selectedNodes.some((node) => node.model.typename === 'Component Inputs');
  if (hasComponentInputs) {
    return { allow: false, reason: 'Extracting a Component Inputs node is unsupported' };
  }

  const hasComponentOutputs = selectedNodes.some((node) => node.model.typename === 'Component Outputs');
  if (hasComponentOutputs) {
    return { allow: false, reason: 'Extracting a Component Outputs node is unsupported' };
  }

  return { allow: true };
}

//Get all parents. Exclude parents that are part of the nodes array (so a hiererachy of nodes won't include "internal" parents)
function getParents(nodes: readonly NodeGraphEditorNode[]) {
  const parents = [];

  for (const node of nodes) {
    if (node.parent && !nodes.includes(node.parent)) {
      parents.push(node.parent);
    }
  }

  return parents;
}

function getFirstNodeWithExternalParent(nodes: readonly NodeGraphEditorNode[]) {
  for (const node of nodes) {
    if (node.parent && !nodes.includes(node.parent)) {
      return node;
    }
  }

  return null;
}

function collectComponentInputsAndOutputs(nodeGraphModel: NodeGraphModel, nodes: NodeGraphEditorNode[]) {
  const inputs: ConnectionInfo[] = [];
  const outputs: ConnectionInfo[] = [];

  const extractedNodeIds = new Set(Array.from(nodes.values()).map((node) => node.id));
  nodeGraphModel.forEachConnection((c) => {
    if (extractedNodeIds.has(c.fromId) && !extractedNodeIds.has(c.toId)) {
      //get the display name of the port to make the component port names nicer
      const port = nodeGraphModel.findNodeWithId(c.toId).findPortWithName(c.toProperty);
      const portName = port.displayName || c.toProperty;

      outputs.push({ connection: c, portName });
    } else if (!extractedNodeIds.has(c.fromId) && extractedNodeIds.has(c.toId)) {
      const port = nodeGraphModel.findNodeWithId(c.toId).findPortWithName(c.toProperty);
      const portName = port.displayName || c.toProperty;

      inputs.push({ connection: c, portName });
    }
  });

  //group all connection that can share one conneciton
  //e.g. two connection that both trigger the same output should have one component output and not two
  const inputGroups: Record<string, ConnectionInfo[]> = {};
  for (const input of inputs) {
    const id = input.connection.fromId + input.connection.fromProperty;
    if (!inputGroups[id]) {
      inputGroups[id] = [];
    }
    inputGroups[id].push(input);
  }

  const outputGroups: Record<string, ConnectionInfo[]> = {};
  for (const output of outputs) {
    const id = output.connection.toId + output.connection.toProperty;
    if (!outputGroups[id]) {
      outputGroups[id] = [];
    }
    outputGroups[id].push(output);
  }

  //make sure connection groups doesn't have name collisions
  resolveNameCollisions(Object.values(inputGroups));
  resolveNameCollisions(Object.values(outputGroups));

  return [inputs, outputs];
}

function resolveNameCollisions(groups: ConnectionInfo[][]) {
  const nameCounter: Record<string, number> = {};

  for (const group of groups) {
    const portName = group[0].portName;

    if (!nameCounter[portName]) {
      nameCounter[portName] = 1;
    } else {
      nameCounter[portName]++;
    }

    const count = nameCounter[portName];
    if (count > 1) {
      group.forEach((connectionInfo) => (connectionInfo.portName = portName + ' ' + count));
    }
  }
}

function connectComponentInputsAndOutputs(
  component: ComponentModel,
  inputs: ConnectionInfo[],
  outputs: ConnectionInfo[],
  undoGroup: UndoActionGroup
) {
  if (inputs.length) {
    const componentInput = NodeGraphNode.fromJSON({
      type: 'Component Inputs',
      id: guid(),
      ...getComponentInputsPosition(component, inputs.length),
      ports: inputs.map((input) => ({
        name: input.portName,
        plug: 'output',
        type: {
          name: '*'
        }
      }))
    });

    component.graph.addRoot(componentInput, { args: undoGroup });
    for (const input of inputs) {
      const c = {
        fromId: componentInput.id,
        fromProperty: input.portName,
        toId: input.connection.toId,
        toProperty: input.connection.toProperty
      };
      component.graph.addConnection(c, { undo: undoGroup });
    }
  }

  //outputs
  if (outputs.length) {
    const componentOutput = NodeGraphNode.fromJSON({
      type: 'Component Outputs',
      id: guid(),
      ...getComponentOutputsPosition(component, outputs.length),
      ports: outputs.map((output) => ({
        name: output.portName,
        plug: 'input',
        type: {
          name: '*'
        }
      }))
    });

    component.graph.addRoot(componentOutput, { args: undoGroup });
    for (const output of outputs) {
      const c = {
        fromId: output.connection.fromId,
        fromProperty: output.connection.fromProperty,
        toId: componentOutput.id,
        toProperty: output.portName
      };
      component.graph.addConnection(c, { undo: undoGroup });
    }
  }
}

function connectExternalInputsAndOutputs(
  nodeGraphModel: NodeGraphModel,
  node: NodeGraphNode,
  inputs: ConnectionInfo[],
  outputs: ConnectionInfo[],
  undoGroup: UndoActionGroup
) {
  //add connections to component inputs
  for (const input of inputs) {
    nodeGraphModel.addConnection(
      {
        fromId: input.connection.fromId,
        fromProperty: input.connection.fromProperty,
        toId: node.id,
        toProperty: input.portName
      },
      { undo: undoGroup }
    );
  }

  //and outputs
  for (const output of outputs) {
    nodeGraphModel.addConnection(
      {
        fromId: node.id,
        fromProperty: output.portName,
        toId: output.connection.toId,
        toProperty: output.connection.toProperty
      },
      { undo: undoGroup }
    );
  }
}

/**
 * A place an extracted component can be put.
 *
 * `path` is a real component-name prefix — `/`, `/#Pages`, `/#Pages/Home` — so
 * `joinComponentPath(path, localName)` is a component name in exactly the shape
 * every other producer of one makes (see `useComponentActions.toFolderPath`).
 *
 * `kind` is derived, not stored: the project has only names and graphs. A path
 * that *is* a component's name can still be extracted into — that is what
 * nesting is, and it is what extraction used to do unconditionally.
 */
export type ExtractDestinationKind = 'root' | 'sheet' | 'folder' | 'component';

export interface ExtractDestination {
  path: string;
  kind: ExtractDestinationKind;
  /** Human-readable trail, e.g. `Pages / Home`. Sheets lose their `#`. */
  label: string;
  /** True for the component the nodes are being extracted *out of*. */
  isCurrent: boolean;
}

/** The sheets whose contents are not browser components. */
const CLOUD_SHEET = '/#__cloud__';
const WORKFLOW_SHEET = '/#__workflow__';

/** Components the panel hides, and which must not be offered as a parent. */
function isPlaceholder(name: string) {
  return name.endsWith('/.placeholder');
}

/**
 * The leading slash a component name is *supposed* to have.
 *
 * It is not guaranteed. `ProjectModel.getComponentWithName` is an exact string
 * match with no normalisation, and real projects hold both forms side by side —
 * a fixture opened while this was written had `/#__page__/Home` next to a bare
 * `App`. Without this, that `App` derives the path `/App`, fails to match its
 * own name in the component set, and is offered as a *folder* rather than as
 * the component you are extracting out of.
 */
export function normalizeComponentName(name: string) {
  return name.startsWith('/') ? name : '/' + name;
}

/** `/` + `Card` → `/Card`; `/#Pages/Home` + `Card` → `/#Pages/Home/Card`. */
export function joinComponentPath(folderPath: string, localName: string) {
  return folderPath === '/' ? '/' + localName : folderPath + '/' + localName;
}

/** The folder a component lives in. `/#Pages/Home` → `/#Pages`, `/Card` → `/`. */
export function parentPathOf(componentName: string) {
  const normalized = normalizeComponentName(componentName);
  const cut = normalized.lastIndexOf('/');
  return cut <= 0 ? '/' : normalized.substring(0, cut);
}

/**
 * Is a component already called this?
 *
 * Both spellings are checked, because the project may hold either and
 * `getComponentWithName` will not find one when asked for the other — a
 * collision missed here is a second component with the same name in the tree.
 */
function componentExists(projectModel: ProjectModel, componentName: string) {
  const normalized = normalizeComponentName(componentName);
  return !!(
    projectModel.getComponentWithName(normalized) || projectModel.getComponentWithName(normalized.substring(1))
  );
}

/**
 * Is this path in the same runtime as the component being extracted from?
 *
 * The runtime of a component is its *name* (`utils/NodeGraph`), so moving an
 * extraction across the `#__cloud__` boundary silently changes what the graph
 * is — cloud nodes in a browser component, or the reverse. The picker refuses
 * to offer the crossing rather than validating it afterwards.
 */
function isInRuntime(path: string, runtime: RuntimeType) {
  const isCloud = path === CLOUD_SHEET || path.startsWith(CLOUD_SHEET + '/');
  const isWorkflow = path === WORKFLOW_SHEET || path.startsWith(WORKFLOW_SHEET + '/');

  if (runtime === RuntimeType.Cloud) return isCloud;
  if (runtime === RuntimeType.Workflow) return isWorkflow;
  return !isCloud && !isWorkflow;
}

/** `#Pages` → `Pages`, and the two internal sheets get the names the UI uses. */
function segmentLabel(segment: string) {
  if (segment === '#__cloud__') return 'Cloud Functions';
  if (segment === '#__workflow__') return 'Workflows';
  return segment.startsWith('#') ? segment.substring(1) : segment;
}

/** `/#Pages/Home` → `Pages / Home`. Root is named rather than drawn as `/`. */
export function labelForPath(path: string) {
  if (path === '/') return 'Project root';
  return path.split('/').filter(Boolean).map(segmentLabel).join(' / ');
}

/**
 * Every folder, sheet and component the extraction may be put in, in tree order.
 *
 * Derived from component names alone — folders are virtual in this project
 * format, so a folder exists exactly as long as some component's name has it as
 * a prefix.
 */
export function collectExtractDestinations(
  projectModel: ProjectModel,
  sourceComponent: ComponentModel
): ExtractDestination[] {
  const runtime = getComponentModelRuntimeType(sourceComponent);
  const components = projectModel.getComponents();
  const componentNames = new Set(
    components.filter((c) => !isPlaceholder(c.name)).map((c) => normalizeComponentName(c.name))
  );
  const sourceName = normalizeComponentName(sourceComponent.name);

  const paths = new Set<string>(['/']);
  for (const component of components) {
    const segments = component.name.split('/').filter(Boolean);

    /**
     * A placeholder contributes its *folders* but never itself. An empty folder
     * exists only as `<folder>/.placeholder` (see
     * `useComponentActions.handleAddFolder`), so skipping placeholders outright
     * would make every empty folder — the ones most likely to have been made to
     * hold exactly this — impossible to extract into.
     */
    const last = isPlaceholder(component.name) ? segments.length - 1 : segments.length;

    for (let i = 1; i <= last; i++) {
      paths.add('/' + segments.slice(0, i).join('/'));
    }
  }

  return Array.from(paths)
    .filter((path) => isInRuntime(path, runtime))
    .sort((a, b) => a.localeCompare(b))
    .map((path) => {
      const segments = path.split('/').filter(Boolean);

      let kind: ExtractDestinationKind;
      if (path === '/') kind = 'root';
      else if (segments.length === 1 && segments[0].startsWith('#')) kind = 'sheet';
      else if (componentNames.has(path)) kind = 'component';
      else kind = 'folder';

      return { path, kind, label: labelForPath(path), isCurrent: path === sourceName };
    });
}

/**
 * A free name in `folderPath`, starting from `base`.
 *
 * The dialog pre-fills with this so Enter is still a one-keystroke extraction;
 * the difference from before is that the name is now visible and editable
 * *before* the component exists.
 */
export function suggestExtractedComponentName(
  projectModel: ProjectModel,
  folderPath: string,
  base = 'Extracted component'
) {
  let localName = base;
  let i = 1;

  while (componentExists(projectModel, joinComponentPath(folderPath, localName))) {
    i++;
    localName = base + ' ' + i;
  }

  return localName;
}

/** Why this name cannot be used, or `null` if it can. */
export function validateExtractedComponentName(
  projectModel: ProjectModel,
  folderPath: string,
  localName: string
): string | null {
  const trimmed = localName.trim();

  if (!trimmed) return 'Give the component a name';
  if (trimmed.includes('/')) return 'A component name cannot contain "/" — pick a folder below instead';
  if (trimmed.startsWith('#')) return 'A component name cannot start with "#"';
  if (trimmed.startsWith('.')) return 'A component name cannot start with "."';
  if (componentExists(projectModel, joinComponentPath(folderPath, trimmed))) {
    return `"${trimmed}" already exists in ${labelForPath(folderPath)}`;
  }

  return null;
}

function getComponentInputsPosition(component: ComponentModel, numOutputs: number) {
  const aabb = getAABBForNodesAndCommentsIntersecting(
    component,
    0,
    200 + numOutputs * NodeGraphEditorNode.propertyConnectionHeight
  );
  return { x: aabb.minX - NodeGraphEditorNode.size.width - 100, y: 100 };
}

function getComponentOutputsPosition(component: ComponentModel, numInputs: number) {
  const aabb = getAABBForNodesAndCommentsIntersecting(
    component,
    0,
    200 + numInputs * NodeGraphEditorNode.propertyConnectionHeight
  );
  return { x: aabb.maxX + 100, y: 100 };
}

function getAABBForNodesAndCommentsIntersecting(component: ComponentModel, minY: number, maxY: number) {
  const comments = component.graph.commentsModel.getComments() as Rectangle[];
  const nodes = component.getNodes();

  const rects = comments.concat(
    nodes.map((node) => {
      const nodeSize = NodeGraphEditorNode.size; //this is just the start size so height is likely incorrect. Good enough for our purposes here
      return {
        x: node.x,
        y: node.y,
        width: nodeSize.width,
        height: nodeSize.height
      };
    })
  );

  const aabb = {
    minX: Number.MAX_VALUE,
    maxX: -Number.MAX_VALUE,
    minY: Number.MAX_VALUE,
    maxY: -Number.MAX_VALUE
  };

  const rectsInBounds = rects.filter(
    (r) => (r.y >= minY && r.y <= maxY) || (r.y + r.height >= minY && r.y + r.height <= maxY)
  );

  for (const rect of rectsInBounds) {
    if (rect.x < aabb.minX) {
      aabb.minX = rect.x;
    }
    if (rect.x + rect.width > aabb.maxX) {
      aabb.maxX = rect.x + rect.width;
    }
    if (rect.y < aabb.minY) {
      aabb.minY = rect.y;
    }
    if (rect.y + rect.height > aabb.maxY) {
      aabb.maxY = rect.y + rect.height;
    }
  }

  return aabb;
}
