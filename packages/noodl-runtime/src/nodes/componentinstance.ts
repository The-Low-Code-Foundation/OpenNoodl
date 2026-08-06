'use strict';

import type { ComponentModelLike, GraphNodeModel, GraphPortModel } from '@noodl/types';

import type { RuntimeNode, RuntimeNodeContext, RuntimeVisualNode } from '../internal';

import Node = require('../node');
import NodeScope = require('../nodescope');

let componentIdCounter = 0;

/**
 * A node that *is* an instance of a user component.
 *
 * It owns a `NodeScope` holding that component's whole graph, and its ports are the
 * component's own — the `component-ports` dynamic mechanism. Its job is to keep three
 * things in sync as the component model changes underneath it: the port set, the Component
 * Inputs/Outputs nodes inside the scope, and the roots it renders.
 */
interface ComponentInstanceNode extends RuntimeVisualNode {
  nodeScope: InstanceType<typeof NodeScope>;
  parentNodeScope?: InstanceType<typeof NodeScope>;
  componentModel?: ComponentModelLike;
  _internal: RuntimeNode['_internal'] & {
    childRoot: ComponentInstanceNode | null;
    componentOutputValues: Record<string, unknown>;
    componentOutputs: RuntimeNode[];
    componentInputs: RuntimeNode[];
    inputValues: Record<string, unknown>;
    roots: RuntimeVisualNode[];
    /** Stable per instance; the key component state is stored under. */
    instanceId: string;
    creatorCallbacks?: {
      onOutputChanged?(name: string, value: unknown, previous: unknown): void;
    };
  };

  setComponentModel(componentModel: ComponentModelLike): Promise<void>;
  registerComponentInputPort(port: GraphPortModel): void;
  registerComponentOutputPort(port: GraphPortModel): void;
  setOutputFromComponentOutput(name: string, value: unknown): void;
  setChildRoot(node: ComponentInstanceNode | null): void;
  getChildRootIndex(): number;
  getChildRoot(): ComponentInstanceNode | null;
  getRoots(): RuntimeVisualNode[];
  triggerDidMount(): void;
  getInstanceId(): string;
}

interface ComponentInstanceNodeConstructor {
  new (
    context: RuntimeNodeContext,
    id: string,
    parentNodeScope?: InstanceType<typeof NodeScope>
  ): ComponentInstanceNode;
  (
    this: ComponentInstanceNode,
    context: RuntimeNodeContext,
    id: string,
    parentNodeScope?: InstanceType<typeof NodeScope>
  ): void;
  prototype: ComponentInstanceNode;
}

const ComponentInstanceNode = function ComponentInstanceNode(
  this: ComponentInstanceNode,
  context: RuntimeNodeContext,
  id: string,
  parentNodeScope?: InstanceType<typeof NodeScope>
) {
  Node.call(this, context, id);

  this.nodeScope = new NodeScope(context, this);
  this.parentNodeScope = parentNodeScope;
  this._internal.childRoot = null;
  this._internal.componentOutputValues = {};
  this._internal.componentOutputs = [];
  this._internal.componentInputs = [];
  this._internal.inputValues = {};
  this._internal.roots = [];

  // Note the typo is load-bearing: this exact prefix is what component state is keyed by,
  // so correcting the spelling would orphan every stored value.
  this._internal.instanceId = '__$ndl_componentInstaceId' + componentIdCounter;

  this.nodeScope.modelScope = parentNodeScope ? parentNodeScope.modelScope : undefined;
  // CWF-013: the per-run services travel the same way the model scope does, and have to — a node
  // that logs is usually several component instances deep, and the request id it needs belongs to
  // the scope the cloud runner created for this one request.
  this.nodeScope.runContext = parentNodeScope ? parentNodeScope.runContext : undefined;

  componentIdCounter++;
} as unknown as ComponentInstanceNodeConstructor;

ComponentInstanceNode.prototype = Object.create(Node.prototype, {
  setComponentModel: {
    value: async function (this: ComponentInstanceNode, componentModel: ComponentModelLike) {
      this.componentModel = componentModel;
      const self = this;

      await this.nodeScope.setComponentModel(componentModel);

      this._internal.componentInputs = this.nodeScope.getNodesWithType('Component Inputs');
      this._internal.componentOutputs = this.nodeScope.getNodesWithType('Component Outputs');

      Object.values(componentModel.getInputPorts()).forEach(this.registerComponentInputPort.bind(this));
      Object.values(componentModel.getOutputPorts()).forEach(this.registerComponentOutputPort.bind(this));

      const roots = componentModel.roots || [];
      // `getNodeWithId` is typed for any node in the scope; a component's roots are visual
      // by construction, and the guarded calls in `render`/`triggerDidMount`/`contains`
      // below are what cover the exceptions (a Repeater root is not a React node).
      this._internal.roots = roots.map((id: string) => this.nodeScope.getNodeWithId(id) as RuntimeVisualNode);

      componentModel.on(
        'rootAdded',
        (id: string) => {
          this._internal.roots.push(this.nodeScope.getNodeWithId(id) as RuntimeVisualNode);
          this.forceUpdate();
        },
        this
      );

      componentModel.on(
        'rootRemoved',
        function (this: ComponentInstanceNode, id: string) {
          const index = this._internal.roots.findIndex((root) => root.id === id);
          if (index !== -1) {
            this._internal.roots.splice(index, 1);
          }
          this.forceUpdate();
        },
        this
      );

      componentModel.on('inputPortAdded', this.registerComponentInputPort.bind(this), this);
      componentModel.on('outputPortAdded', this.registerComponentOutputPort.bind(this), this);

      componentModel.on(
        'inputPortRemoved',
        function (port: GraphPortModel) {
          if (self.hasInput(port.name)) {
            self.deregisterInput(port.name);
          }
        },
        this
      );
      componentModel.on(
        'outputPortRemoved',
        // The mixed `this`/`self` here is only a style inconsistency: listeners registered
        // with a `ref` are invoked as `callback.call(ref, data)` (`eventsender.ts`), so
        // `this` is this same node.
        function (this: ComponentInstanceNode, port: GraphPortModel) {
          if (this.hasOutput(port.name)) {
            self.deregisterOutput(port.name);
          }
        },
        this
      );

      componentModel.on(
        'nodeAdded',
        function (node: GraphNodeModel) {
          if (node.type === 'Component Inputs') {
            self._internal.componentInputs.push(self.nodeScope.getNodeWithId(node.id));
          } else if (node.type === 'Component Outputs') {
            self._internal.componentOutputs.push(self.nodeScope.getNodeWithId(node.id));
          }
        },
        this
      );

      componentModel.on(
        'nodeRemoved',
        function (node: GraphNodeModel) {
          function removeNodesWithId(array: RuntimeNode[], id: string) {
            return array.filter((e) => e.id !== id);
          }
          if (node.type === 'Component Inputs') {
            self._internal.componentInputs = removeNodesWithId(self._internal.componentInputs, node.id);
          } else if (node.type === 'Component Outputs') {
            self._internal.componentOutputs = removeNodesWithId(self._internal.componentOutputs, node.id);
          }
        },
        this
      );

      componentModel.on(
        'renamed',
        function (event: { newName: string }) {
          self.name = event.newName;
        },
        this
      );
    }
  },
  _onNodeDeleted: {
    value: function (this: ComponentInstanceNode) {
      if (this.componentModel) {
        this.componentModel.removeListenersWithRef(this);
        this.componentModel = undefined;
      }

      this.nodeScope.reset();
      Node.prototype._onNodeDeleted.call(this);
    }
  },
  registerComponentInputPort: {
    value: function (this: ComponentInstanceNode, port: GraphPortModel) {
      // The port callbacks declare `this: NodeInstance`, which a subtype annotation does not
      // satisfy, so these close over `self` instead — the same idiom the `inputPortRemoved`
      // listener above uses. Equivalent by construction: the runtime invokes an input setter
      // with the node the input was registered on, which is this one.
      const self = this;
      this.registerInput(port.name, {
        set: function (value: unknown) {
          self._internal.inputValues[port.name] = value;
          self._internal.componentInputs.forEach(function (componentInput) {
            componentInput.registerOutputIfNeeded(port.name);
            componentInput.flagOutputDirty(port.name);
          });
        }
      });
    }
  },
  registerComponentOutputPort: {
    value: function (this: ComponentInstanceNode, port: GraphPortModel) {
      const self = this;
      this.registerOutput(port.name, {
        getter: function () {
          return self._internal.componentOutputValues[port.name];
        }
      });
    }
  },
  setOutputFromComponentOutput: {
    value: function (this: ComponentInstanceNode, name: string, value: unknown) {
      if (this.hasOutput(name) === false) {
        return;
      }

      this._internal.creatorCallbacks &&
        this._internal.creatorCallbacks.onOutputChanged &&
        this._internal.creatorCallbacks.onOutputChanged(name, value, this._internal.componentOutputValues[name]);

      this._internal.componentOutputValues[name] = value;
      this.flagOutputDirty(name);
    }
  },
  setChildRoot: {
    value: function (this: ComponentInstanceNode, node: ComponentInstanceNode | null) {
      const prevChildRoot = this._internal.childRoot;
      const newChildRoot = node;

      this._internal.childRoot = newChildRoot;

      if (this.model && this.model.children) {
        const parentNodeScope = this.parentNodeScope;

        const children = this.model.children
          .filter((child) => child.type !== 'Component Children')
          .map((child) => parentNodeScope.getNodeWithId(child.id));

        if (prevChildRoot) {
          for (let i = 0; i < children.length; i++) {
            if (prevChildRoot.isChild(children[i])) {
              prevChildRoot.removeChild(children[i]);
            }
          }
        }

        if (newChildRoot) {
          for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const index = child.model.parent.children.indexOf(child.model);
            this.addChild(child, index);
          }
        }
      }
    }
  },
  getChildRootIndex: {
    value: function (this: ComponentInstanceNode) {
      if (!this._internal.childRoot || !this._internal.childRoot.model || !this._internal.childRoot.model.children) {
        return 0;
      }

      const children = this._internal.childRoot.model.children;

      for (let i = 0; i < children.length; i++) {
        if (children[i].type === 'Component Children') {
          return i;
        }
      }

      return 0;
    }
  },
  getChildRoot: {
    value: function (this: ComponentInstanceNode) {
      if (this._internal.childRoot) {
        return this._internal.childRoot;
      }
      return null;
    }
  },
  getRoots: {
    value: function (this: ComponentInstanceNode) {
      return this._internal.roots;
    }
  },
  /** Added for SSR Support */
  triggerDidMount: {
    value: function (this: ComponentInstanceNode) {
      this._internal.roots.forEach((root) => {
        root.triggerDidMount && root.triggerDidMount();
      });
    }
  },
  render: {
    value: function (this: ComponentInstanceNode) {
      if (this._internal.roots.length === 0) {
        return null;
      }

      return this._internal.roots[0].render();
    }
  },
  setChildIndex: {
    value: function (this: ComponentInstanceNode, childIndex: number) {
      // NOTE: setChildIndex can be undefined when it is not a React node,
      //       but still a visual node like the foreach (Repeater) node.
      this.getRoots().forEach((root) => root.setChildIndex && root.setChildIndex(childIndex));
    }
  },
  addChild: {
    value: function (this: ComponentInstanceNode, child: RuntimeVisualNode, index: number) {
      this.getChildRoot().addChild(child, index + this.getChildRootIndex());
    }
  },
  removeChild: {
    value: function (this: ComponentInstanceNode, child: RuntimeVisualNode) {
      this.getChildRoot().removeChild(child);
    }
  },
  getChildren: {
    value: function (this: ComponentInstanceNode) {
      const childRoot = this.getChildRoot();
      return childRoot ? childRoot.getChildren() : [];
    }
  },
  isChild: {
    value: function (this: ComponentInstanceNode, child: RuntimeVisualNode) {
      if (!this.getChildRoot()) {
        return false;
      }

      return this.getChildRoot().isChild(child);
    }
  },
  contains: {
    value: function (this: ComponentInstanceNode, node: RuntimeVisualNode) {
      return this.getRoots().some((root) => root.contains && root.contains(node));
    }
  },
  _performDirtyUpdate: {
    value: function (this: ComponentInstanceNode) {
      Node.prototype._performDirtyUpdate.call(this);

      const componentInputs = this._internal.componentInputs;
      for (let i = 0, len = componentInputs.length; i < len; i++) {
        componentInputs[i].flagDirty();
      }

      this._internal.componentOutputs.forEach(function (componentOutput) {
        componentOutput.flagDirty();
      });
    }
  },
  getRef: {
    value: function (this: ComponentInstanceNode) {
      const root = this._internal.roots[0];
      return root ? root.getRef() : undefined;
    }
  },
  update: {
    value: function (this: ComponentInstanceNode) {
      Node.prototype.update.call(this);

      this._internal.componentOutputs.forEach(function (componentOutput) {
        componentOutput.update();
      });
    }
  },
  forceUpdate: {
    //this is only used when roots are added or removed
    value: function (this: ComponentInstanceNode) {
      if (!this.parent) return;

      //the parent will need to re-render the roots of this component instance
      //TODO: make this use a cleaner API, and only invalidate the affected child, instead of all children
      this.parent.cachedChildren = undefined;
      this.parent.forceUpdate();
    }
  },
  getInstanceId: {
    value(this: ComponentInstanceNode) {
      return this._internal.instanceId;
    }
  }
});

ComponentInstanceNode.prototype.constructor = ComponentInstanceNode;

export = ComponentInstanceNode;
