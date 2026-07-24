'use strict';

import Model from '@noodl/runtime/src/model';
import type {
  EditorConnectionLike,
  GraphNodeModel,
  ModelLike,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';

/**
 * `this` inside a Set …Component Object Properties node.
 *
 * `hasScheduledStore` lives on the instance rather than in `_internal` — that is where the
 * original put it, and the two Component Object nodes do the same, so it is left alone.
 */
interface SetComponentObjectPropertiesInstance extends NodeInstance {
  _internal: {
    /** Latest value of each `prop-…` input, keyed by the property name without the prefix. */
    inputValues: Record<string, unknown>;
    /**
     * Written by the parent variant's `getComponentObjectId` as it walks up the tree.
     * Nothing on this node reads it — the Parent Component Object node has a field of the
     * same name that its inspector *does* read, and this looks like a copy of that walk
     * which kept the assignment. Recorded rather than removed; see PLAT-003 NOTES §15.
     */
    parentComponentName?: string;
  };
  hasScheduledStore?: boolean;
  getComponentObjectId(): string | undefined;
  scheduleStore(): void;
}

/**
 * What the two concrete nodes supply. Everything else about them is identical, which is why
 * this file exists.
 */
interface SetComponentObjectPropertiesDef {
  name: string;
  displayName: string;
  docs: string;
  /**
   * The id of the {@link ModelLike} to write into. Returning `undefined` — which the parent
   * variant does when no enclosing component has a Component Object node — means there is
   * nothing to store to.
   */
  getComponentObjectId(this: SetComponentObjectPropertiesInstance): string | undefined;
}

function extendSetComponentObjectProperties(def: SetComponentObjectPropertiesDef): NodeModule {
  const SetComponentObjectProperties: NodeDefinitionOptions = {
    name: def.name,
    displayNodeName: def.displayName,
    category: 'Component Utilities',
    color: 'component',
    docs: def.docs,
    initialize: function (this: SetComponentObjectPropertiesInstance) {
      this._internal.inputValues = {};
    },
    inputs: {
      properties: {
        type: {
          name: 'stringlist',
          allowEditOnly: true
        },
        displayName: 'Properties',
        group: 'Properties',
        set() {}
      },
      store: {
        type: 'signal',
        group: 'Actions',
        displayName: 'Do',
        valueChangedToTrue(this: SetComponentObjectPropertiesInstance) {
          this.scheduleStore();
        }
      }
    },
    outputs: {
      stored: {
        type: 'signal',
        group: 'Events',
        displayName: 'Done'
      }
    },
    methods: {
      getComponentObjectId: def.getComponentObjectId,
      scheduleStore(this: SetComponentObjectPropertiesInstance) {
        if (this.hasScheduledStore) return;
        this.hasScheduledStore = true;

        const internal = this._internal;
        this.scheduleAfterInputsHaveUpdated(() => {
          const model: ModelLike = Model.get(this.getComponentObjectId());
          this.hasScheduledStore = false;

          const properties = (this.model.parameters.properties as string) || '';
          const validProperties = properties.split(',');

          const keysToSet = Object.keys(internal.inputValues).filter((key) => validProperties.indexOf(key) !== -1);

          for (const i of keysToSet) {
            model.set(i, internal.inputValues[i], { resolve: true });
          }
          this.sendSignalOnOutput('stored');
        });
      },
      registerInputIfNeeded: function (this: SetComponentObjectPropertiesInstance, name: string) {
        if (this.hasInput(name)) {
          return;
        }

        if (name.startsWith('prop-')) {
          const propertyName = name.substring('prop-'.length);
          this.registerInput(name, {
            set(this: SetComponentObjectPropertiesInstance, value: unknown) {
              this._internal.inputValues[propertyName] = value;
            }
          });
        } else if (name.startsWith('type-')) {
          this.registerInput(name, {
            set() {}
          });
        }
      }
    }
  };

  function updatePorts(
    nodeId: string,
    parameters: Record<string, unknown>,
    editorConnection: EditorConnectionLike
  ): void {
    const ports = [];

    const _types = [
      { label: 'String', value: 'string' },
      { label: 'Boolean', value: 'boolean' },
      { label: 'Number', value: 'number' },
      { label: 'Date', value: 'date' },
      { label: 'Array', value: 'array' },
      { label: 'Object', value: 'object' },
      { label: 'Any', value: '*' }
    ];

    // Add value outputs
    const properties = parameters.properties as string | undefined;
    if (properties) {
      for (const p of properties.split(',')) {
        // Property input
        ports.push({
          type: {
            name: parameters['type-' + p] === undefined ? '*' : parameters['type-' + p]
          },
          plug: 'input',
          group: 'Property Values',
          displayName: p,
          //  editorName:p,
          name: 'prop-' + p
        });

        // Property type
        ports.push({
          type: {
            name: 'enum',
            enums: _types,
            allowEditOnly: true
          },
          plug: 'input',
          group: 'Property Types',
          displayName: p,
          default: '*',
          name: 'type-' + p
        });
      }
    }

    editorConnection.sendDynamicPorts(nodeId, ports, {
      detectRenamed: {
        plug: 'input'
      }
    });
  }

  return {
    node: SetComponentObjectProperties,
    setup: function (context: NodeContextLike, graphModel) {
      const editorConnection = context.editorConnection;
      if (!editorConnection || !editorConnection.isRunningLocally()) {
        return;
      }

      graphModel.on('nodeAdded.' + def.name, (node: GraphNodeModel) => {
        updatePorts(node.id, node.parameters, editorConnection);

        node.on('parameterUpdated', (event: { name: string }) => {
          if (event.name === 'properties' || event.name.startsWith('type-')) {
            updatePorts(node.id, node.parameters, editorConnection);
          }
        });
      });
    }
  };
}

export { extendSetComponentObjectProperties };
