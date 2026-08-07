# TASK-007C: Visual Workflow Runtime

## Overview

Adapt the existing CloudRunner to work with the local backend, create database CRUD nodes and trigger nodes that use the same visual paradigm as the frontend, and implement hot-reload for workflow changes.

**Parent Task:** TASK-007 (Integrated Local Backend)
**Phase:** C (Workflow Runtime)
**Effort:** 12-16 hours
**Priority:** HIGH
**Depends On:** TASK-007A, TASK-007B

---

## Objectives

1. Adapt CloudRunner to work with LocalSQLAdapter
2. Create local database nodes (Query, Insert, Update, Delete)
3. Create trigger nodes (Schedule, DB Change, Webhook)
4. Implement workflow compilation from editor
5. Implement hot-reload without service interruption
6. Ensure same node paradigm works in frontend and backend

---

## Background

### Existing CloudRunner

The `noodl-viewer-cloud` package contains `CloudRunner` which executes visual workflows:

```typescript
// packages/noodl-viewer-cloud/src/index.ts
export class CloudRunner {
  private runtime: NoodlRuntime;

  constructor(options) {
    this.runtime = new NoodlRuntime({
      type: 'cloud',
      componentFilter: (c) => c.name.startsWith('/#__cloud__/'),
      // ...
    });
  }

  async run(functionName: string, request: NoodlRequest): Promise<NoodlResponse> {
    // Creates component instance, finds Request node, executes, waits for Response
  }
}
```

### Existing Cloud Nodes

```
packages/noodl-viewer-cloud/src/nodes/
├── cloud/
│   ├── request.ts      # Entry point for cloud functions
│   └── response.ts     # Exit point for cloud functions
└── data/
    └── aggregatenode.js  # Aggregate queries
```

### Target Architecture

```
Visual Workflow in Editor                 Execution in Backend
┌─────────────────────────────────┐      ┌─────────────────────────────┐
│  /#__local__/GetTodos           │      │  CloudRunner                │
│  ┌─────────────────────────────┐│      │  ┌───────────────────────┐  │
│  │ [Request] ──→ [Query DB]    ││  ──→ │  │ Component Instance    │  │
│  │     │             │         ││      │  │ ├─ Request Node       │  │
│  │     │             ↓         ││      │  │ ├─ Query Node         │  │
│  │     │        [Response]     ││      │  │ └─ Response Node      │  │
│  └─────────────────────────────┘│      │  └───────────────────────┘  │
└─────────────────────────────────┘      │           │                  │
                                         │           ↓                  │
                                         │  LocalSQLAdapter            │
                                         │  (SQLite Database)          │
                                         └─────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Adapt CloudRunner for Local Backend (3 hours)

**File:** `packages/noodl-viewer-cloud/src/LocalCloudRunner.ts`

```typescript
import { CloudRunner } from './index';
import { LocalSQLAdapter } from '@noodl/runtime/src/api/adapters/local-sql/LocalSQLAdapter';
import NoodlRuntime from '@noodl/runtime';
import NodeScope from '@noodl/runtime/src/nodescope';
import Model from '@noodl/runtime/src/model';

export interface LocalCloudRunnerOptions {
  adapter: LocalSQLAdapter;
  enableDebugInspectors?: boolean;
}

export class LocalCloudRunner {
  private runtime: NoodlRuntime;
  private adapter: LocalSQLAdapter;
  private scheduledJobs: Map<string, any> = new Map();

  constructor(options: LocalCloudRunnerOptions) {
    this.adapter = options.adapter;

    this.runtime = new NoodlRuntime({
      type: 'cloud',
      platform: {
        requestUpdate: (f: any) => setImmediate(f),
        getCurrentTime: () => new Date().getTime(),
        objectToString: (o: any) => JSON.stringify(o, null, 2),
        isRunningLocally: () => true
      },
      // Accept both cloud and local components
      componentFilter: (c) => 
        c.name.startsWith('/#__cloud__/') || c.name.startsWith('/#__local__/'),
      dontCreateRootComponent: true
    });

    // Inject adapter into runtime context
    this.runtime.context.getLocalAdapter = () => this.adapter;
    this.runtime.context.localAdapter = this.adapter;

    // Register local nodes
    this.registerLocalNodes();

    this.runtime.setDebugInspectorsEnabled(options.enableDebugInspectors || false);
  }

  private registerLocalNodes(): void {
    // Import and register all local database and trigger nodes
    const nodes = [
      require('./nodes/database/local-query'),
      require('./nodes/database/local-insert'),
      require('./nodes/database/local-update'),
      require('./nodes/database/local-delete'),
      require('./nodes/triggers/schedule'),
      require('./nodes/triggers/db-change'),
      require('./nodes/triggers/webhook'),
    ];

    nodes.forEach(nodeModule => {
      if (nodeModule.node) {
        this.runtime.registerNode(nodeModule.node);
      }
      if (nodeModule.setup) {
        nodeModule.setup(this.runtime.context);
      }
    });
  }

  async load(exportData: any, projectSettings?: any): Promise<void> {
    await this.runtime.setData(exportData);
    if (projectSettings) {
      this.runtime.setProjectSettings(projectSettings);
    }

    // Initialize any scheduled triggers
    this.initializeTriggers();
  }

  async run(functionName: string, request: { body: string; headers: Record<string, string> }): Promise<{
    statusCode: number;
    body: string;
    headers?: Record<string, string>;
  }> {
    return new Promise((resolve, reject) => {
      const requestId = Math.random().toString(36).substring(2);
      
      // Try both prefixes
      const componentName = this.findComponent(functionName);
      if (!componentName) {
        return reject(new Error(`Function not found: ${functionName}`));
      }

      const requestScope = new NodeScope(this.runtime.context);
      requestScope.modelScope = new Model.Scope();

      this.runtime.context
        .createComponentInstanceNode(componentName, requestId + '-' + functionName, requestScope)
        .then((functionComponent) => {
          // Find request node
          const requestNode = functionComponent.nodeScope.getNodesWithType('noodl.cloud.request')[0] ||
                             functionComponent.nodeScope.getNodesWithType('noodl.local.request')[0];

          if (!requestNode) {
            requestScope.reset();
            return reject(new Error('No request node found in function'));
          }

          // Find response nodes
          let hasResponded = false;
          const responseNodes = [
            ...functionComponent.nodeScope.getNodesWithTypeRecursive('noodl.cloud.response'),
            ...functionComponent.nodeScope.getNodesWithTypeRecursive('noodl.local.response')
          ];

          responseNodes.forEach((resp) => {
            resp._internal._sendResponseCallback = (response: any) => {
              if (hasResponded) return;
              hasResponded = true;

              functionComponent._onNodeDeleted();
              requestScope.reset();
              requestScope.modelScope.reset();

              resolve(response);
            };
          });

          // Execute
          setImmediate(() => {
            try {
              requestNode.sendRequest({
                body: request.body,
                headers: request.headers
              }).catch(reject);
            } catch (e) {
              reject(e);
            }
          });

          // Timeout after 30 seconds
          setTimeout(() => {
            if (!hasResponded) {
              hasResponded = true;
              functionComponent._onNodeDeleted();
              requestScope.reset();
              reject(new Error('Function timeout'));
            }
          }, 30000);
        })
        .catch(reject);
    });
  }

  private findComponent(name: string): string | null {
    const prefixes = ['/#__local__/', '/#__cloud__/'];
    for (const prefix of prefixes) {
      const fullName = prefix + name;
      if (this.runtime.graphModel.components.has(fullName)) {
        return fullName;
      }
    }
    return null;
  }

  private initializeTriggers(): void {
    // Find and initialize all trigger nodes
    const components = Array.from(this.runtime.graphModel.components.values())
      .filter(c => c.name.startsWith('/#__local__/') || c.name.startsWith('/#__cloud__/'));

    for (const component of components) {
      // Look for schedule trigger nodes
      const scheduleTriggers = component.graph?.getNodesWithType?.('noodl.trigger.schedule') || [];
      for (const trigger of scheduleTriggers) {
        this.setupScheduleTrigger(component.name, trigger);
      }

      // Look for db change trigger nodes  
      const dbTriggers = component.graph?.getNodesWithType?.('noodl.trigger.dbChange') || [];
      for (const trigger of dbTriggers) {
        this.setupDbChangeTrigger(component.name, trigger);
      }
    }
  }

  private setupScheduleTrigger(componentName: string, triggerNode: any): void {
    const cron = triggerNode.parameters?.cron;
    const enabled = triggerNode.parameters?.enabled !== false;

    if (!cron || !enabled) return;

    const nodeCron = require('node-cron');
    const job = nodeCron.schedule(cron, async () => {
      console.log(`[Trigger] Schedule fired for ${componentName}`);
      try {
        await this.run(componentName.replace(/^\/#__(local|cloud)__\//, ''), {
          body: JSON.stringify({ trigger: 'schedule', timestamp: Date.now() }),
          headers: {}
        });
      } catch (e) {
        console.error(`[Trigger] Error executing scheduled function:`, e);
      }
    });

    this.scheduledJobs.set(`${componentName}:${triggerNode.id}`, job);
  }

  private setupDbChangeTrigger(componentName: string, triggerNode: any): void {
    const collection = triggerNode.parameters?.collection;
    const events = triggerNode.parameters?.events || 'all';

    if (!collection) return;

    const handler = async (event: any) => {
      if (events !== 'all' && event.type !== events) return;

      console.log(`[Trigger] DB change (${event.type}) on ${collection}`);
      try {
        await this.run(componentName.replace(/^\/#__(local|cloud)__\//, ''), {
          body: JSON.stringify({
            trigger: 'dbChange',
            event: event.type,
            collection: event.collection,
            objectId: event.objectId,
            object: event.object
          }),
          headers: {}
        });
      } catch (e) {
        console.error(`[Trigger] Error executing db change handler:`, e);
      }
    };

    this.adapter.on('create', handler);
    this.adapter.on('save', handler);
    this.adapter.on('delete', handler);

    // Store for cleanup
    this.scheduledJobs.set(`${componentName}:${triggerNode.id}:handler`, {
      handler,
      stop: () => {
        this.adapter.off('create', handler);
        this.adapter.off('save', handler);
        this.adapter.off('delete', handler);
      }
    });
  }

  async reload(exportData: any): Promise<void> {
    // Stop all triggers
    this.stopAllTriggers();

    // Reload components
    await this.load(exportData);
  }

  private stopAllTriggers(): void {
    for (const [key, job] of this.scheduledJobs) {
      if (job.stop) job.stop();
    }
    this.scheduledJobs.clear();
  }

  destroy(): void {
    this.stopAllTriggers();
  }
}
```

---

### Step 2: Create Database Nodes (4 hours)

**File:** `packages/noodl-viewer-cloud/src/nodes/database/local-query.ts`

```typescript
export const node = {
  name: 'noodl.local.query',
  displayNodeName: 'Query Records',
  docs: 'https://docs.nodegex.com/nodes/local-database/query-records',
  category: 'Local Database',
  color: 'data',
  usePortAsLabel: 'collection',

  initialize() {
    this._internal.results = [];
    this._internal.count = 0;
    this._internal.queryParams = {};
  },

  getInspectInfo() {
    if (!this._internal.results?.length) {
      return { type: 'text', value: '[No results]' };
    }
    return {
      type: 'value',
      value: {
        count: this._internal.results.length,
        firstRecord: this._internal.results[0]
      }
    };
  },

  inputs: {
    collection: {
      type: 'string',
      displayName: 'Collection',
      group: 'General',
      set(value: string) {
        this._internal.collection = value;
      }
    },
    filter: {
      type: { name: 'query-filter', allowEditOnly: true },
      displayName: 'Filter',
      group: 'Filter',
      set(value: any) {
        this._internal.filter = value;
      }
    },
    sort: {
      type: { name: 'stringlist', allowEditOnly: true },
      displayName: 'Sort',
      group: 'Sorting',
      set(value: string) {
        this._internal.sort = value?.split(',').map(s => s.trim()).filter(Boolean);
      }
    },
    limit: {
      type: 'number',
      displayName: 'Limit',
      group: 'Pagination',
      default: 100,
      set(value: number) {
        this._internal.limit = value;
      }
    },
    skip: {
      type: 'number',
      displayName: 'Skip',
      group: 'Pagination',
      default: 0,
      set(value: number) {
        this._internal.skip = value;
      }
    },
    fetch: {
      type: 'signal',
      displayName: 'Fetch',
      group: 'Actions',
      valueChangedToTrue() {
        this.doQuery();
      }
    }
  },

  outputs: {
    results: {
      type: 'array',
      displayName: 'Results',
      group: 'General',
      getter() {
        return this._internal.results;
      }
    },
    count: {
      type: 'number',
      displayName: 'Count',
      group: 'General',
      getter() {
        return this._internal.count;
      }
    },
    firstRecord: {
      type: 'object',
      displayName: 'First Record',
      group: 'General',
      getter() {
        return this._internal.results?.[0];
      }
    },
    success: {
      type: 'signal',
      displayName: 'Success',
      group: 'Events'
    },
    failure: {
      type: 'signal',
      displayName: 'Failure',
      group: 'Events'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events',
      getter() {
        return this._internal.error;
      }
    }
  },

  methods: {
    async doQuery() {
      try {
        const adapter = this.context.getLocalAdapter();
        if (!adapter) {
          throw new Error('Local adapter not available');
        }

        const where = this.buildWhereClause();

        const result = await adapter.query({
          collection: this._internal.collection,
          where,
          sort: this._internal.sort,
          limit: this._internal.limit || 100,
          skip: this._internal.skip || 0,
          count: true
        });

        this._internal.results = result.results;
        this._internal.count = result.count ?? result.results.length;

        this.flagOutputDirty('results');
        this.flagOutputDirty('count');
        this.flagOutputDirty('firstRecord');
        this.sendSignalOnOutput('success');
      } catch (e: any) {
        this._internal.error = e.message;
        this.flagOutputDirty('error');
        this.sendSignalOnOutput('failure');
      }
    },

    buildWhereClause() {
      // Convert visual filter to query format
      const filter = this._internal.filter;
      if (!filter) return undefined;

      // Process visual filter with query parameters
      return this.convertVisualFilter(filter);
    },

    convertVisualFilter(filter: any): any {
      // Similar to QueryUtils.convertVisualFilter
      if (!filter) return undefined;

      if (filter.rules) {
        const conditions = filter.rules
          .map((r: any) => this.convertVisualFilter(r))
          .filter(Boolean);

        if (conditions.length === 0) return undefined;
        if (conditions.length === 1) return conditions[0];

        return filter.combinator === 'or' 
          ? { or: conditions }
          : { and: conditions };
      }

      // Single rule
      const { field, operator, value, input } = filter;
      const actualValue = input 
        ? this._internal.queryParams[input] 
        : value;

      return { [field]: { [operator]: actualValue } };
    },

    setQueryParameter(name: string, value: any) {
      this._internal.queryParams[name] = value;
    },

    registerInputIfNeeded(name: string) {
      if (this.hasInput(name)) return;

      if (name.startsWith('qp-')) {
        this.registerInput(name, {
          set: this.setQueryParameter.bind(this, name.substring(3))
        });
      }
    }
  },

  dynamicports: [
    {
      name: 'conditionalports/extended',
      condition: 'filter',
      inputs: (parameters: any) => {
        // Extract query parameter inputs from filter
        const inputs: any[] = [];
        const filter = parameters.filter;

        const extractInputs = (f: any) => {
          if (!f) return;
          if (f.rules) {
            f.rules.forEach(extractInputs);
          } else if (f.input) {
            inputs.push({
              name: 'qp-' + f.input,
              displayName: f.input,
              type: '*',
              group: 'Query Parameters'
            });
          }
        };

        extractInputs(filter);
        return inputs;
      }
    }
  ]
};

export function setup(context: any) {
  // Any additional setup
}
```

**File:** `packages/noodl-viewer-cloud/src/nodes/database/local-insert.ts`

```typescript
export const node = {
  name: 'noodl.local.insert',
  displayNodeName: 'Insert Record',
  docs: 'https://docs.nodegex.com/nodes/local-database/insert-record',
  category: 'Local Database',
  color: 'data',
  usePortAsLabel: 'collection',

  initialize() {
    this._internal.data = {};
  },

  inputs: {
    collection: {
      type: 'string',
      displayName: 'Collection',
      group: 'General',
      set(value: string) {
        this._internal.collection = value;
      }
    },
    properties: {
      type: { name: 'stringlist', allowEditOnly: true },
      displayName: 'Properties',
      group: 'Data',
      set(value: string) {
        this._internal.properties = value?.split(',').map(s => s.trim()).filter(Boolean);
      }
    },
    insert: {
      type: 'signal',
      displayName: 'Insert',
      group: 'Actions',
      valueChangedToTrue() {
        this.doInsert();
      }
    }
  },

  outputs: {
    record: {
      type: 'object',
      displayName: 'Record',
      group: 'General',
      getter() {
        return this._internal.createdRecord;
      }
    },
    objectId: {
      type: 'string',
      displayName: 'Object ID',
      group: 'General',
      getter() {
        return this._internal.createdRecord?.objectId;
      }
    },
    success: {
      type: 'signal',
      displayName: 'Success',
      group: 'Events'
    },
    failure: {
      type: 'signal',
      displayName: 'Failure',
      group: 'Events'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events',
      getter() {
        return this._internal.error;
      }
    }
  },

  methods: {
    async doInsert() {
      try {
        const adapter = this.context.getLocalAdapter();
        if (!adapter) {
          throw new Error('Local adapter not available');
        }

        const record = await adapter.create({
          collection: this._internal.collection,
          data: { ...this._internal.data }
        });

        this._internal.createdRecord = record;
        this.flagOutputDirty('record');
        this.flagOutputDirty('objectId');
        this.sendSignalOnOutput('success');
      } catch (e: any) {
        this._internal.error = e.message;
        this.flagOutputDirty('error');
        this.sendSignalOnOutput('failure');
      }
    },

    setProperty(name: string, value: any) {
      this._internal.data[name] = value;
    },

    registerInputIfNeeded(name: string) {
      if (this.hasInput(name)) return;

      if (name.startsWith('prop-')) {
        this.registerInput(name, {
          set: this.setProperty.bind(this, name.substring(5))
        });
      }
    }
  },

  dynamicports: [
    {
      name: 'conditionalports/extended',
      condition: 'properties',
      inputs: (parameters: any) => {
        const props = parameters.properties?.split(',').map((s: string) => s.trim()).filter(Boolean) || [];
        return props.map((p: string) => ({
          name: 'prop-' + p,
          displayName: p,
          type: '*',
          group: 'Properties'
        }));
      }
    }
  ]
};
```

**File:** `packages/noodl-viewer-cloud/src/nodes/database/local-update.ts`

```typescript
export const node = {
  name: 'noodl.local.update',
  displayNodeName: 'Update Record',
  docs: 'https://docs.nodegex.com/nodes/local-database/update-record',
  category: 'Local Database',
  color: 'data',
  usePortAsLabel: 'collection',

  initialize() {
    this._internal.data = {};
  },

  inputs: {
    collection: {
      type: 'string',
      displayName: 'Collection',
      group: 'General',
      set(value: string) {
        this._internal.collection = value;
      }
    },
    objectId: {
      type: 'string',
      displayName: 'Object ID',
      group: 'General',
      set(value: string) {
        this._internal.objectId = value;
      }
    },
    properties: {
      type: { name: 'stringlist', allowEditOnly: true },
      displayName: 'Properties',
      group: 'Data',
      set(value: string) {
        this._internal.properties = value?.split(',').map(s => s.trim()).filter(Boolean);
      }
    },
    save: {
      type: 'signal',
      displayName: 'Save',
      group: 'Actions',
      valueChangedToTrue() {
        this.doSave();
      }
    }
  },

  outputs: {
    record: {
      type: 'object',
      displayName: 'Record',
      group: 'General',
      getter() {
        return this._internal.savedRecord;
      }
    },
    success: {
      type: 'signal',
      displayName: 'Success',
      group: 'Events'
    },
    failure: {
      type: 'signal',
      displayName: 'Failure',
      group: 'Events'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events',
      getter() {
        return this._internal.error;
      }
    }
  },

  methods: {
    async doSave() {
      try {
        const adapter = this.context.getLocalAdapter();
        if (!adapter) {
          throw new Error('Local adapter not available');
        }

        if (!this._internal.objectId) {
          throw new Error('Object ID is required');
        }

        const record = await adapter.save({
          collection: this._internal.collection,
          objectId: this._internal.objectId,
          data: { ...this._internal.data }
        });

        this._internal.savedRecord = record;
        this.flagOutputDirty('record');
        this.sendSignalOnOutput('success');
      } catch (e: any) {
        this._internal.error = e.message;
        this.flagOutputDirty('error');
        this.sendSignalOnOutput('failure');
      }
    },

    setProperty(name: string, value: any) {
      this._internal.data[name] = value;
    },

    registerInputIfNeeded(name: string) {
      if (this.hasInput(name)) return;

      if (name.startsWith('prop-')) {
        this.registerInput(name, {
          set: this.setProperty.bind(this, name.substring(5))
        });
      }
    }
  },

  dynamicports: [
    {
      name: 'conditionalports/extended',
      condition: 'properties',
      inputs: (parameters: any) => {
        const props = parameters.properties?.split(',').map((s: string) => s.trim()).filter(Boolean) || [];
        return props.map((p: string) => ({
          name: 'prop-' + p,
          displayName: p,
          type: '*',
          group: 'Properties'
        }));
      }
    }
  ]
};
```

**File:** `packages/noodl-viewer-cloud/src/nodes/database/local-delete.ts`

```typescript
export const node = {
  name: 'noodl.local.delete',
  displayNodeName: 'Delete Record',
  docs: 'https://docs.nodegex.com/nodes/local-database/delete-record',
  category: 'Local Database',
  color: 'data',
  usePortAsLabel: 'collection',

  inputs: {
    collection: {
      type: 'string',
      displayName: 'Collection',
      group: 'General',
      set(value: string) {
        this._internal.collection = value;
      }
    },
    objectId: {
      type: 'string',
      displayName: 'Object ID',
      group: 'General',
      set(value: string) {
        this._internal.objectId = value;
      }
    },
    delete: {
      type: 'signal',
      displayName: 'Delete',
      group: 'Actions',
      valueChangedToTrue() {
        this.doDelete();
      }
    }
  },

  outputs: {
    success: {
      type: 'signal',
      displayName: 'Success',
      group: 'Events'
    },
    failure: {
      type: 'signal',
      displayName: 'Failure',
      group: 'Events'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events',
      getter() {
        return this._internal.error;
      }
    }
  },

  methods: {
    async doDelete() {
      try {
        const adapter = this.context.getLocalAdapter();
        if (!adapter) {
          throw new Error('Local adapter not available');
        }

        if (!this._internal.objectId) {
          throw new Error('Object ID is required');
        }

        await adapter.delete({
          collection: this._internal.collection,
          objectId: this._internal.objectId
        });

        this.sendSignalOnOutput('success');
      } catch (e: any) {
        this._internal.error = e.message;
        this.flagOutputDirty('error');
        this.sendSignalOnOutput('failure');
      }
    }
  }
};
```

---

### Step 3: Create Trigger Nodes (3 hours)

**File:** `packages/noodl-viewer-cloud/src/nodes/triggers/schedule.ts`

```typescript
export const node = {
  name: 'noodl.trigger.schedule',
  displayNodeName: 'Schedule Trigger',
  docs: 'https://docs.nodegex.com/nodes/triggers/schedule',
  category: 'Triggers',
  color: 'data',
  singleton: true,
  allowAsExportRoot: false,

  initialize() {
    this._internal.lastRun = null;
  },

  getInspectInfo() {
    return {
      type: 'text',
      value: this._internal.lastRun 
        ? `Last run: ${new Date(this._internal.lastRun).toLocaleString()}`
        : 'Not yet triggered'
    };
  },

  inputs: {
    cron: {
      type: 'string',
      displayName: 'Cron Expression',
      group: 'Schedule',
      default: '0 * * * *',
      set(value: string) {
        this._internal.cron = value;
      }
    },
    enabled: {
      type: 'boolean',
      displayName: 'Enabled',
      group: 'Schedule',
      default: true,
      set(value: boolean) {
        this._internal.enabled = value;
      }
    }
  },

  outputs: {
    triggered: {
      type: 'signal',
      displayName: 'Triggered',
      group: 'Events'
    },
    lastRun: {
      type: 'date',
      displayName: 'Last Run',
      group: 'Info',
      getter() {
        return this._internal.lastRun ? new Date(this._internal.lastRun) : null;
      }
    }
  },

  methods: {
    // Called by LocalCloudRunner when scheduled job fires
    trigger() {
      this._internal.lastRun = Date.now();
      this.flagOutputDirty('lastRun');
      this.sendSignalOnOutput('triggered');
    }
  }
};

export function setup(context: any) {
  // Schedule setup is handled by LocalCloudRunner
}
```

**File:** `packages/noodl-viewer-cloud/src/nodes/triggers/db-change.ts`

```typescript
export const node = {
  name: 'noodl.trigger.dbChange',
  displayNodeName: 'Database Change Trigger',
  docs: 'https://docs.nodegex.com/nodes/triggers/database-change',
  category: 'Triggers',
  color: 'data',
  singleton: true,
  allowAsExportRoot: false,

  initialize() {
    this._internal.eventType = null;
    this._internal.record = null;
    this._internal.recordId = null;
  },

  getInspectInfo() {
    if (!this._internal.eventType) {
      return { type: 'text', value: 'Waiting for changes...' };
    }
    return {
      type: 'value',
      value: {
        event: this._internal.eventType,
        recordId: this._internal.recordId
      }
    };
  },

  inputs: {
    collection: {
      type: 'string',
      displayName: 'Collection',
      group: 'General',
      set(value: string) {
        this._internal.collection = value;
      }
    },
    events: {
      type: {
        name: 'enum',
        enums: [
          { label: 'All Changes', value: 'all' },
          { label: 'Create Only', value: 'create' },
          { label: 'Update Only', value: 'save' },
          { label: 'Delete Only', value: 'delete' }
        ]
      },
      displayName: 'Events',
      group: 'General',
      default: 'all',
      set(value: string) {
        this._internal.events = value;
      }
    }
  },

  outputs: {
    triggered: {
      type: 'signal',
      displayName: 'Triggered',
      group: 'Events'
    },
    eventType: {
      type: 'string',
      displayName: 'Event Type',
      group: 'Data',
      getter() {
        return this._internal.eventType;
      }
    },
    record: {
      type: 'object',
      displayName: 'Record',
      group: 'Data',
      getter() {
        return this._internal.record;
      }
    },
    recordId: {
      type: 'string',
      displayName: 'Record ID',
      group: 'Data',
      getter() {
        return this._internal.recordId;
      }
    }
  },

  methods: {
    // Called by LocalCloudRunner when db change occurs
    trigger(event: { type: string; object: any; objectId: string }) {
      this._internal.eventType = event.type;
      this._internal.record = event.object;
      this._internal.recordId = event.objectId;

      this.flagOutputDirty('eventType');
      this.flagOutputDirty('record');
      this.flagOutputDirty('recordId');
      this.sendSignalOnOutput('triggered');
    }
  }
};
```

**File:** `packages/noodl-viewer-cloud/src/nodes/triggers/webhook.ts`

```typescript
export const node = {
  name: 'noodl.trigger.webhook',
  displayNodeName: 'Webhook Trigger',
  docs: 'https://docs.nodegex.com/nodes/triggers/webhook',
  category: 'Triggers',
  color: 'data',
  singleton: true,
  allowAsExportRoot: false,

  // Webhook triggers work like Request nodes but auto-register routes
  initialize() {
    this._internal.lastRequest = null;
  },

  inputs: {
    path: {
      type: 'string',
      displayName: 'Path',
      group: 'General',
      default: '/webhook',
      set(value: string) {
        this._internal.path = value;
      }
    },
    method: {
      type: {
        name: 'enum',
        enums: [
          { label: 'POST', value: 'POST' },
          { label: 'GET', value: 'GET' },
          { label: 'PUT', value: 'PUT' },
          { label: 'DELETE', value: 'DELETE' }
        ]
      },
      displayName: 'Method',
      group: 'General',
      default: 'POST',
      set(value: string) {
        this._internal.method = value;
      }
    }
  },

  outputs: {
    triggered: {
      type: 'signal',
      displayName: 'Triggered',
      group: 'Events'
    },
    body: {
      type: 'object',
      displayName: 'Body',
      group: 'Request',
      getter() {
        return this._internal.body;
      }
    },
    headers: {
      type: 'object',
      displayName: 'Headers',
      group: 'Request',
      getter() {
        return this._internal.headers;
      }
    },
    query: {
      type: 'object',
      displayName: 'Query Params',
      group: 'Request',
      getter() {
        return this._internal.query;
      }
    }
  },

  methods: {
    trigger(request: { body: any; headers: any; query: any }) {
      this._internal.body = request.body;
      this._internal.headers = request.headers;
      this._internal.query = request.query;
      this._internal.lastRequest = Date.now();

      this.flagOutputDirty('body');
      this.flagOutputDirty('headers');
      this.flagOutputDirty('query');
      this.sendSignalOnOutput('triggered');
    }
  }
};
```

---

### Step 4: Implement Workflow Compiler (3 hours)

**File:** `packages/noodl-editor/src/editor/src/utils/workflow-compiler.ts`

```typescript
import { ProjectModel } from '@noodl-models/projectmodel';
import { exportComponentsToJSON } from '@noodl-utils/exporter';
import { EventDispatcher } from '../../../shared/utils/EventDispatcher';

export class WorkflowCompiler extends EventDispatcher {
  static instance = new WorkflowCompiler();

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private compiling = false;

  constructor() {
    super();
    this.setupListeners();
  }

  private setupListeners(): void {
    // Listen for component changes
    ProjectModel.instance.on('componentChanged', this.scheduleCompile.bind(this));
    ProjectModel.instance.on('componentAdded', this.scheduleCompile.bind(this));
    ProjectModel.instance.on('componentRemoved', this.scheduleCompile.bind(this));
    ProjectModel.instance.on('nodeAdded', this.handleNodeChange.bind(this));
    ProjectModel.instance.on('nodeRemoved', this.handleNodeChange.bind(this));
    ProjectModel.instance.on('connectionAdded', this.handleNodeChange.bind(this));
    ProjectModel.instance.on('connectionRemoved', this.handleNodeChange.bind(this));
  }

  private handleNodeChange(event: any): void {
    // Only recompile if the change is in a workflow component
    const component = event.model?.owner?.owner || event.args?.model?.owner?.owner;
    if (component?.name?.startsWith('/#__local__/') || 
        component?.name?.startsWith('/#__cloud__/')) {
      this.scheduleCompile();
    }
  }

  private scheduleCompile(): void {
    // Debounce compilation
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.compile();
    }, 1000); // 1 second debounce
  }

  async compile(): Promise<void> {
    if (this.compiling) return;

    const project = ProjectModel.instance;
    const backend = project.getMetaData('backend');

    // Only compile if we have a local backend
    if (!backend || backend.type !== 'local') {
      return;
    }

    this.compiling = true;
    this.notifyListeners('compileStart');

    try {
      // Get all workflow components
      const workflowComponents = project.getComponents().filter(c =>
        c.name.startsWith('/#__cloud__/') || c.name.startsWith('/#__local__/')
      );

      if (workflowComponents.length === 0) {
        return;
      }

      console.log(`[WorkflowCompiler] Compiling ${workflowComponents.length} workflows...`);

      // Export each workflow
      for (const component of workflowComponents) {
        const exported = exportComponentsToJSON(project, [component], {
          useBundles: false
        });

        // Clean up unnecessary metadata
        if (exported.metadata) {
          delete exported.metadata.variants;
          delete exported.metadata.styles;
        }
        delete exported.componentIndex;

        const workflowName = component.name
          .replace('/#__cloud__/', '')
          .replace('/#__local__/', '');

        // Send to backend via IPC
        await window.electronAPI.backend.updateWorkflow({
          backendId: backend.id,
          name: workflowName,
          workflow: exported
        });

        console.log(`[WorkflowCompiler] Compiled: ${workflowName}`);
      }

      // Tell backend to reload workflows
      await window.electronAPI.backend.reloadWorkflows(backend.id);

      this.notifyListeners('compileComplete', { 
        count: workflowComponents.length 
      });

      console.log('[WorkflowCompiler] All workflows compiled and reloaded');
    } catch (error) {
      console.error('[WorkflowCompiler] Compilation failed:', error);
      this.notifyListeners('compileError', { error });
    } finally {
      this.compiling = false;
    }
  }

  // Manual compile trigger
  async forceCompile(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    await this.compile();
  }

  // Get list of workflow components
  getWorkflowComponents(): any[] {
    return ProjectModel.instance.getComponents().filter(c =>
      c.name.startsWith('/#__cloud__/') || c.name.startsWith('/#__local__/')
    );
  }
}

// Export singleton
export const workflowCompiler = WorkflowCompiler.instance;
```

---

### Step 5: Update Node Registry (1 hour)

**File:** `packages/noodl-viewer-cloud/src/nodes/index.ts` (modified)

```typescript
import NoodlRuntime from '@noodl/runtime';

export function registerNodes(runtime: NoodlRuntime) {
  // Existing cloud nodes
  const cloudNodes = [
    require('./cloud/request'),
    require('./cloud/response'),
    require('./data/aggregatenode')
  ];

  // New local database nodes
  const localDbNodes = [
    require('./database/local-query'),
    require('./database/local-insert'),
    require('./database/local-update'),
    require('./database/local-delete'),
  ];

  // Trigger nodes
  const triggerNodes = [
    require('./triggers/schedule'),
    require('./triggers/db-change'),
    require('./triggers/webhook'),
  ];

  const allNodes = [...cloudNodes, ...localDbNodes, ...triggerNodes];

  allNodes.forEach(function (nodeModule) {
    if (nodeModule.node) {
      runtime.registerNode(nodeModule.node);
    }
    if (nodeModule.setup) {
      nodeModule.setup(runtime.context);
    }
  });
}

// Also export for editor to know about available nodes
export const localDatabaseNodes = [
  'noodl.local.query',
  'noodl.local.insert',
  'noodl.local.update',
  'noodl.local.delete',
];

export const triggerNodes = [
  'noodl.trigger.schedule',
  'noodl.trigger.dbChange',
  'noodl.trigger.webhook',
];
```

---

## Files to Create

```
packages/noodl-viewer-cloud/src/
├── LocalCloudRunner.ts
├── nodes/
│   ├── database/
│   │   ├── local-query.ts
│   │   ├── local-insert.ts
│   │   ├── local-update.ts
│   │   └── local-delete.ts
│   └── triggers/
│       ├── schedule.ts
│       ├── db-change.ts
│       └── webhook.ts

packages/noodl-editor/src/editor/src/utils/
└── workflow-compiler.ts
```

## Files to Modify

```
packages/noodl-viewer-cloud/src/nodes/index.ts
  - Add new node registrations

packages/noodl-viewer-cloud/package.json
  - Add node-cron dependency

packages/noodl-editor/src/main/src/local-backend/LocalBackendServer.ts
  - Use LocalCloudRunner instead of CloudRunner
```

---

## Testing Checklist

### Database Nodes
- [ ] Query with no filter
- [ ] Query with equality filter
- [ ] Query with comparison operators
- [ ] Query with sorting
- [ ] Query with pagination
- [ ] Insert single record
- [ ] Insert with all property types
- [ ] Update existing record
- [ ] Update non-existent record (error)
- [ ] Delete record
- [ ] Delete non-existent record (error)

### Trigger Nodes
- [ ] Schedule trigger fires at correct times
- [ ] Schedule trigger respects enabled flag
- [ ] DB change trigger fires on create
- [ ] DB change trigger fires on update
- [ ] DB change trigger fires on delete
- [ ] DB change trigger filters by collection
- [ ] Webhook trigger receives requests

### Workflow Compilation
- [ ] Compiles on component change
- [ ] Debouncing works correctly
- [ ] Hot reload doesn't interrupt running requests
- [ ] Multiple workflows compile correctly
- [ ] Error handling for compilation failures

### Integration
- [ ] Full workflow: HTTP → Query → Response
- [ ] Full workflow: Trigger → Insert → Response
- [ ] Chained nodes work correctly
- [ ] Error propagation works

---

## Success Criteria

1. All database operations work through visual nodes
2. Triggers execute workflows automatically
3. Hot reload completes in <1 second
4. Same nodes work in editor preview and standalone backend
5. No memory leaks from trigger subscriptions
6. Error messages are user-friendly

---

## Dependencies

**NPM packages:**
- `node-cron` - For schedule triggers

**Internal:**
- TASK-007A (LocalSQLAdapter)
- TASK-007B (LocalBackendServer)
- `@noodl/runtime` (NoodlRuntime)

**Blocks:**
- TASK-007D (Launcher Integration)
- TASK-007F (Standalone Deployment)

---

## Estimated Session Breakdown

| Session | Focus | Hours |
|---------|-------|-------|
| 1 | LocalCloudRunner adaptation | 3 |
| 2 | Database nodes (Query, Insert) | 3 |
| 3 | Database nodes (Update, Delete) + Triggers | 3 |
| 4 | Workflow compiler + hot reload | 3 |
| 5 | Integration testing | 2 |
| **Total** | | **14** |
