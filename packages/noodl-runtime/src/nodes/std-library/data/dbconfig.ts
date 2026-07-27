'use strict';

import type {
  GraphModelLike,
  GraphNodeModel,
  InspectInfo,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule,
  RuntimeDiscoveredPort
} from '@noodl/types';

import ConfigService = require('../../../api/configservice');

/** One parameter in the project's `dbConfigSchema` metadata. */
interface ConfigSchemaEntry {
  type?: string;
  /** Parameters flagged this way are only offered in the cloud runtime. */
  masterKeyOnly?: boolean;
}

/**
 * `this` inside the Config node.
 *
 * Both of its ports are dynamic — the key comes from the project's config schema, and the
 * value port's *type* comes from whichever key is selected — so there is nothing in
 * `inputs`/`outputs` and everything in `registerInputIfNeeded`/`registerOutputIfNeeded`.
 */
interface DbConfigInstance extends NodeInstance {
  _internal: {
    config?: Record<string, unknown>;
    configKey?: string;
    useDevValue?: boolean;
    devValue?: unknown;
  };
  getValue(): unknown;
  setInternal(key: string, value: unknown): void;
}

const ConfigNodeDefinition: NodeDefinitionOptions = {
  name: 'DbConfig',
  docs: 'https://docs.noodl.net/nodes/data/cloud-data/config',
  displayNodeName: 'Config',
  category: 'Cloud Services',
  usePortAsLabel: 'configKey',
  color: 'data',
  initialize: function (this: DbConfigInstance) {
    const internal = this._internal;

    ConfigService.instance.getConfig().then((config: Record<string, unknown>) => {
      internal.config = config;
      if (this.hasOutput('value')) this.flagOutputDirty('value');
    });
  },
  getInspectInfo(this: DbConfigInstance): InspectInfo {
    const value = this.getValue();

    if (value === undefined) return '[No Value]';

    return [{ type: 'value', value: value }];
  },
  inputs: {},
  outputs: {},
  methods: {
    getValue: function (this: DbConfigInstance) {
      const internal = this._internal;
      if (internal.useDevValue && this.context.editorConnection && this.context.editorConnection.isRunningLocally()) {
        return internal.devValue;
      } else if (internal.config !== undefined && internal.configKey !== undefined) {
        return internal.config[internal.configKey];
      }
    },
    setInternal: function (this: DbConfigInstance, key: string, value: unknown) {
      this._internal[key] = value;
      if (this.hasOutput('value')) this.flagOutputDirty('value');
    },
    registerOutputIfNeeded: function (this: DbConfigInstance, name: string) {
      if (this.hasOutput(name)) {
        return;
      }

      if (name === 'value')
        return this.registerOutput(name, {
          getter: this.getValue.bind(this)
        });
    },
    registerInputIfNeeded: function (this: DbConfigInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      if (name === 'configKey' || name === 'useDevValue' || name === 'devValue')
        return this.registerInput(name, {
          set: this.setInternal.bind(this, name)
        });
    }
  }
};

const DbConfigNodeModule: NodeModule = {
  node: ConfigNodeDefinition,
  setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    function updatePorts(node: GraphNodeModel) {
      const ports: RuntimeDiscoveredPort[] = [];

      context.editorConnection.clearWarning(node.component.name, node.id, 'dbconfig-warning');

      const configSchema = graphModel.getMetaData('dbConfigSchema') as Record<string, ConfigSchemaEntry> | undefined;
      let valueType: string | undefined;

      if (configSchema) {
        const isCloud = typeof _noodl_cloud_runtime_version !== 'undefined';
        ports.push({
          name: 'configKey',
          displayName: 'Parameter',
          group: 'General',
          type: {
            name: 'enum',
            enums: Object.keys(configSchema)
              .filter((k) => isCloud || !configSchema[k].masterKeyOnly)
              .map((k) => ({ value: k, label: k })),
            allowEditOnly: true
          },
          plug: 'input'
        });

        const configKey = node.parameters['configKey'] as string | undefined;
        if (configKey !== undefined && configSchema && configSchema[configKey]) {
          valueType = configSchema[configKey].type;

          if (
            valueType === 'string' ||
            valueType === 'boolean' ||
            valueType === 'number' ||
            valueType === 'object' ||
            valueType === 'array'
          ) {
            ports.push({
              name: 'useDevValue',
              displayName: 'Enable',
              group: 'Local Override',
              type: 'boolean',
              default: false,
              plug: 'input'
            });

            if (node.parameters['useDevValue'] === true) {
              ports.push({
                name: 'devValue',
                displayName: 'Value',
                group: 'Local Override',
                type: valueType,
                plug: 'input'
              });
            }
          }
        } else if (configKey !== undefined) {
          context.editorConnection.sendWarning(node.component.name, node.id, 'dbconfig-warning', {
            showGlobally: true,
            message: configKey + ' config parameter is missing, add it to your cloud service.'
          });
        }
      } else {
        context.editorConnection.sendWarning(node.component.name, node.id, 'dbconfig-warning', {
          showGlobally: true,
          message: 'You need an active cloud service.'
        });
      }

      ports.push({
        name: 'value',
        displayName: 'Value',
        group: 'General',
        type: valueType || '*',
        plug: 'output'
      });

      context.editorConnection.sendDynamicPorts(node.id, ports);
    }

    function _managePortsForNode(node: GraphNodeModel) {
      updatePorts(node);

      node.on('parameterUpdated', function () {
        updatePorts(node);
      });

      graphModel.on('metadataChanged.dbConfigSchema', function () {
        ConfigService.instance.clearCache();
        updatePorts(node);
      });
    }

    graphModel.on('editorImportComplete', () => {
      graphModel.on('nodeAdded.DbConfig', function (node: GraphNodeModel) {
        _managePortsForNode(node);
      });

      for (const node of graphModel.getNodesWithType('DbConfig')) {
        _managePortsForNode(node);
      }
    });
  }
};

export = DbConfigNodeModule;
