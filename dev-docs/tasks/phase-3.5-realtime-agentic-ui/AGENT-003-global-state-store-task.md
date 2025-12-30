# AGENT-003: Global State Store

## Overview

Create a global observable store system that enables reactive state sharing across components, similar to Zustand or Redux. This replaces the current pattern of passing state through Component Inputs/Outputs or using Send/Receive Event for every state update.

**Phase:** 3.5 (Real-Time Agentic UI)  
**Priority:** CRITICAL (core infrastructure)  
**Effort:** 2-3 days  
**Risk:** Low

---

## Problem Statement

### Current Limitation

Noodl currently requires manual state synchronization:

```
Component A changes value
  → Send Event "valueChanged"
  → Component B Receive Event "valueChanged"
  → Manually update Component B's state
  → Component C also needs Receive Event
  → Component D also needs Receive Event
  ... (scales poorly)
```

Or through prop drilling:

```
Root Component
  ├─ Component A (receives prop)
  │   ├─ Component B (receives prop)
  │   │   └─ Component C (finally uses prop!)
  │   └─ Component D (also receives prop)
  └─ Component E (receives prop)
```

### Desired Pattern: Observable Store

```
[Global Store "app"] 
  ├─ Component A subscribes → auto-updates
  ├─ Component B subscribes → auto-updates
  ├─ Component C subscribes → auto-updates
  └─ Timeline View subscribes → auto-updates

Component A changes value
  → Store updates
  → ALL subscribers react automatically
```

### Real-World Use Cases (Erleah)

1. **Timeline + Parking Lot** - Both views show same agenda items
2. **Chat + Timeline** - Chat updates trigger timeline changes
3. **User Session** - Current user, auth state, preferences
4. **Real-time Sync** - Backend updates propagate to all views
5. **Draft State** - Unsaved changes visible across UI

---

## Goals

1. ✅ Create named stores with typed state
2. ✅ Subscribe components to stores (auto-update on changes)
3. ✅ Update store values (trigger all subscriptions)
4. ✅ Selective subscriptions (only listen to specific keys)
5. ✅ Transaction support (batch multiple updates)
6. ✅ Computed values (derived state)
7. ✅ Persistence (optional localStorage sync)

---

## Technical Design

### Node Specifications

We'll create THREE nodes for complete store functionality:

1. **Global Store** - Creates/accesses a store, outputs state
2. **Global Store Set** - Updates store values
3. **Global Store Subscribe** - Listens to specific keys

### Global Store Node

```javascript
{
  name: 'net.noodl.GlobalStore',
  displayNodeName: 'Global Store',
  category: 'Data',
  color: 'purple',
  docs: 'https://docs.noodl.net/nodes/data/global-store'
}
```

#### Ports: Global Store

| Port Name | Type | Group | Description |
|-----------|------|-------|-------------|
| **Inputs** |
| `storeName` | string | Store | Name of store to access (default: "app") |
| `initialState` | object | Store | Initial state if store doesn't exist |
| `persist` | boolean | Store | Save to localStorage (default: false) |
| `storageKey` | string | Store | localStorage key (default: storeName) |
| **Outputs** |
| `state` | object | Data | Current complete state |
| `stateChanged` | signal | Events | Fires when any value changes |
| `ready` | signal | Events | Fires when store initialized |
| `storeId` | string | Info | Unique store identifier |

### Global Store Set Node

```javascript
{
  name: 'net.noodl.GlobalStore.Set',
  displayNodeName: 'Set Global Store',
  category: 'Data',
  color: 'purple'
}
```

#### Ports: Global Store Set

| Port Name | Type | Group | Description |
|-----------|------|-------|-------------|
| **Inputs** |
| `storeName` | string | Store | Name of store to update |
| `set` | signal | Actions | Trigger update |
| `key` | string | Update | Key to update |
| `value` | * | Update | New value |
| `merge` | boolean | Update | Merge object (default: false) |
| `transaction` | boolean | Update | Batch with other updates |
| **Outputs** |
| `completed` | signal | Events | Fires after update |
| `error` | string | Events | Error message if update fails |

### Global Store Subscribe Node

```javascript
{
  name: 'net.noodl.GlobalStore.Subscribe',
  displayNodeName: 'Subscribe to Store',
  category: 'Data',
  color: 'purple'
}
```

#### Ports: Global Store Subscribe

| Port Name | Type | Group | Description |
|-----------|------|-------|-------------|
| **Inputs** |
| `storeName` | string | Store | Name of store to watch |
| `keys` | string | Subscribe | Comma-separated keys to watch (blank = all) |
| **Outputs** |
| `value` | * | Data | Current value of watched key(s) |
| `changed` | signal | Events | Fires when watched keys change |
| `previousValue` | * | Data | Value before change |

---

## Implementation Details

### File Structure

```
packages/noodl-runtime/src/nodes/std-library/data/
├── globalstore.js              # Global Store singleton
├── globalstorenode.js          # Global Store node
├── globalstoresetnode.js       # Set node
├── globalstoresubscribenode.js # Subscribe node
└── globalstore.test.js         # Unit tests
```

### Core Store Implementation

```javascript
// globalstore.js - Singleton store manager

class GlobalStoreManager {
  constructor() {
    this.stores = new Map();
    this.subscribers = new Map();
  }
  
  /**
   * Get or create a store
   */
  getStore(name, initialState = {}) {
    if (!this.stores.has(name)) {
      this.stores.set(name, { ...initialState });
      this.subscribers.set(name, new Map());
      
      console.log(`[GlobalStore] Created store: ${name}`);
    }
    return this.stores.get(name);
  }
  
  /**
   * Get current state
   */
  getState(name) {
    return this.stores.get(name) || {};
  }
  
  /**
   * Update state (triggers subscribers)
   */
  setState(name, updates, options = {}) {
    const current = this.getStore(name);
    const { merge = false, transaction = false } = options;
    
    let next;
    if (merge && typeof updates === 'object' && typeof current === 'object') {
      next = { ...current, ...updates };
    } else {
      next = updates;
    }
    
    this.stores.set(name, next);
    
    // Notify subscribers (unless in transaction)
    if (!transaction) {
      this.notify(name, next, current, updates);
    }
    
    // Persist if enabled
    this.persistStore(name);
  }
  
  /**
   * Update a specific key
   */
  setKey(name, key, value, options = {}) {
    const current = this.getStore(name);
    const updates = { [key]: value };
    
    const next = { ...current, ...updates };
    this.stores.set(name, next);
    
    if (!options.transaction) {
      this.notify(name, next, current, updates);
    }
    
    this.persistStore(name);
  }
  
  /**
   * Subscribe to store changes
   */
  subscribe(name, callback, keys = []) {
    if (!this.subscribers.has(name)) {
      this.subscribers.set(name, new Map());
    }
    
    const subscriberId = Math.random().toString(36);
    const storeSubscribers = this.subscribers.get(name);
    
    storeSubscribers.set(subscriberId, { callback, keys });
    
    // Return unsubscribe function
    return () => {
      storeSubscribers.delete(subscriberId);
    };
  }
  
  /**
   * Notify subscribers of changes
   */
  notify(name, nextState, prevState, updates) {
    const subscribers = this.subscribers.get(name);
    if (!subscribers) return;
    
    const changedKeys = Object.keys(updates);
    
    subscribers.forEach(({ callback, keys }) => {
      // If no specific keys, always notify
      if (!keys || keys.length === 0) {
        callback(nextState, prevState, changedKeys);
        return;
      }
      
      // Check if any watched key changed
      const hasChange = keys.some(key => changedKeys.includes(key));
      if (hasChange) {
        callback(nextState, prevState, changedKeys);
      }
    });
  }
  
  /**
   * Persist store to localStorage
   */
  persistStore(name) {
    const storeMeta = this.storeMeta.get(name);
    if (!storeMeta || !storeMeta.persist) return;
    
    try {
      const state = this.stores.get(name);
      const key = storeMeta.storageKey || name;
      localStorage.setItem(`noodl_store_${key}`, JSON.stringify(state));
    } catch (e) {
      console.error(`[GlobalStore] Failed to persist ${name}:`, e);
    }
  }
  
  /**
   * Load store from localStorage
   */
  loadStore(name, storageKey) {
    try {
      const key = storageKey || name;
      const data = localStorage.getItem(`noodl_store_${key}`);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error(`[GlobalStore] Failed to load ${name}:`, e);
    }
    return null;
  }
  
  /**
   * Configure store options
   */
  configureStore(name, options = {}) {
    if (!this.storeMeta) {
      this.storeMeta = new Map();
    }
    this.storeMeta.set(name, options);
    
    // Load persisted state if enabled
    if (options.persist) {
      const persisted = this.loadStore(name, options.storageKey);
      if (persisted) {
        this.stores.set(name, persisted);
      }
    }
  }
  
  /**
   * Transaction: batch multiple updates
   */
  transaction(name, updateFn) {
    const current = this.getStore(name);
    const updates = updateFn(current);
    
    const next = { ...current, ...updates };
    this.stores.set(name, next);
    
    this.notify(name, next, current, updates);
    this.persistStore(name);
  }
  
  /**
   * Clear a store
   */
  clearStore(name) {
    this.stores.delete(name);
    this.subscribers.delete(name);
    
    if (this.storeMeta?.has(name)) {
      const meta = this.storeMeta.get(name);
      if (meta.persist) {
        const key = meta.storageKey || name;
        localStorage.removeItem(`noodl_store_${key}`);
      }
    }
  }
}

// Singleton instance
const globalStoreManager = new GlobalStoreManager();

module.exports = { globalStoreManager };
```

### Global Store Node Implementation

```javascript
// globalstorenode.js

const { globalStoreManager } = require('./globalstore');

var GlobalStoreNode = {
  name: 'net.noodl.GlobalStore',
  displayNodeName: 'Global Store',
  category: 'Data',
  color: 'purple',
  
  initialize: function() {
    this._internal.storeName = 'app';
    this._internal.unsubscribe = null;
  },
  
  inputs: {
    storeName: {
      type: 'string',
      displayName: 'Store Name',
      group: 'Store',
      default: 'app',
      set: function(value) {
        if (this._internal.unsubscribe) {
          this._internal.unsubscribe();
        }
        this._internal.storeName = value;
        this.setupStore();
      }
    },
    
    initialState: {
      type: 'object',
      displayName: 'Initial State',
      group: 'Store',
      set: function(value) {
        this._internal.initialState = value;
        this.setupStore();
      }
    },
    
    persist: {
      type: 'boolean',
      displayName: 'Persist',
      group: 'Store',
      default: false,
      set: function(value) {
        this._internal.persist = value;
        globalStoreManager.configureStore(this._internal.storeName, {
          persist: value,
          storageKey: this._internal.storageKey
        });
      }
    },
    
    storageKey: {
      type: 'string',
      displayName: 'Storage Key',
      group: 'Store',
      set: function(value) {
        this._internal.storageKey = value;
      }
    }
  },
  
  outputs: {
    state: {
      type: 'object',
      displayName: 'State',
      group: 'Data',
      getter: function() {
        return globalStoreManager.getState(this._internal.storeName);
      }
    },
    
    stateChanged: {
      type: 'signal',
      displayName: 'State Changed',
      group: 'Events'
    },
    
    ready: {
      type: 'signal',
      displayName: 'Ready',
      group: 'Events'
    },
    
    storeId: {
      type: 'string',
      displayName: 'Store ID',
      group: 'Info',
      getter: function() {
        return this._internal.storeName;
      }
    }
  },
  
  methods: {
    setupStore: function() {
      const storeName = this._internal.storeName;
      const initialState = this._internal.initialState || {};
      
      // Configure persistence
      globalStoreManager.configureStore(storeName, {
        persist: this._internal.persist,
        storageKey: this._internal.storageKey
      });
      
      // Get or create store
      globalStoreManager.getStore(storeName, initialState);
      
      // Subscribe to changes
      this._internal.unsubscribe = globalStoreManager.subscribe(
        storeName,
        (nextState, prevState, changedKeys) => {
          this.flagOutputDirty('state');
          this.sendSignalOnOutput('stateChanged');
        }
      );
      
      // Trigger initial state output
      this.flagOutputDirty('state');
      this.sendSignalOnOutput('ready');
    },
    
    _onNodeDeleted: function() {
      if (this._internal.unsubscribe) {
        this._internal.unsubscribe();
      }
    }
  },
  
  getInspectInfo: function() {
    const state = globalStoreManager.getState(this._internal.storeName);
    return {
      type: 'value',
      value: state
    };
  }
};

module.exports = {
  node: GlobalStoreNode
};
```

### Global Store Set Node Implementation

```javascript
// globalstoresetnode.js

const { globalStoreManager } = require('./globalstore');

var GlobalStoreSetNode = {
  name: 'net.noodl.GlobalStore.Set',
  displayNodeName: 'Set Global Store',
  category: 'Data',
  color: 'purple',
  
  inputs: {
    storeName: {
      type: 'string',
      displayName: 'Store Name',
      group: 'Store',
      default: 'app'
    },
    
    set: {
      type: 'signal',
      displayName: 'Set',
      group: 'Actions',
      valueChangedToTrue: function() {
        this.doSet();
      }
    },
    
    key: {
      type: 'string',
      displayName: 'Key',
      group: 'Update'
    },
    
    value: {
      type: '*',
      displayName: 'Value',
      group: 'Update'
    },
    
    merge: {
      type: 'boolean',
      displayName: 'Merge Object',
      group: 'Update',
      default: false
    },
    
    transaction: {
      type: 'boolean',
      displayName: 'Transaction',
      group: 'Update',
      default: false
    }
  },
  
  outputs: {
    completed: {
      type: 'signal',
      displayName: 'Completed',
      group: 'Events'
    },
    
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events'
    }
  },
  
  methods: {
    doSet: function() {
      const storeName = this._internal.storeName || 'app';
      const key = this._internal.key;
      const value = this._internal.value;
      
      if (!key) {
        this._internal.error = 'Key is required';
        this.flagOutputDirty('error');
        return;
      }
      
      try {
        const options = {
          merge: this._internal.merge,
          transaction: this._internal.transaction
        };
        
        globalStoreManager.setKey(storeName, key, value, options);
        
        this.sendSignalOnOutput('completed');
      } catch (e) {
        this._internal.error = e.message;
        this.flagOutputDirty('error');
      }
    }
  }
};

module.exports = {
  node: GlobalStoreSetNode
};
```

### Global Store Subscribe Node Implementation

```javascript
// globalstoresubscribenode.js

const { globalStoreManager } = require('./globalstore');

var GlobalStoreSubscribeNode = {
  name: 'net.noodl.GlobalStore.Subscribe',
  displayNodeName: 'Subscribe to Store',
  category: 'Data',
  color: 'purple',
  
  initialize: function() {
    this._internal.unsubscribe = null;
  },
  
  inputs: {
    storeName: {
      type: 'string',
      displayName: 'Store Name',
      group: 'Store',
      default: 'app',
      set: function(value) {
        if (this._internal.unsubscribe) {
          this._internal.unsubscribe();
        }
        this._internal.storeName = value;
        this.setupSubscription();
      }
    },
    
    keys: {
      type: 'string',
      displayName: 'Keys',
      group: 'Subscribe',
      set: function(value) {
        if (this._internal.unsubscribe) {
          this._internal.unsubscribe();
        }
        this._internal.keys = value;
        this.setupSubscription();
      }
    }
  },
  
  outputs: {
    value: {
      type: '*',
      displayName: 'Value',
      group: 'Data',
      getter: function() {
        const storeName = this._internal.storeName || 'app';
        const state = globalStoreManager.getState(storeName);
        
        const keys = this._internal.keys;
        if (!keys) return state;
        
        // Return specific key(s)
        const keyList = keys.split(',').map(k => k.trim());
        if (keyList.length === 1) {
          return state[keyList[0]];
        } else {
          // Multiple keys - return object
          const result = {};
          keyList.forEach(key => {
            result[key] = state[key];
          });
          return result;
        }
      }
    },
    
    changed: {
      type: 'signal',
      displayName: 'Changed',
      group: 'Events'
    },
    
    previousValue: {
      type: '*',
      displayName: 'Previous Value',
      group: 'Data',
      getter: function() {
        return this._internal.previousValue;
      }
    }
  },
  
  methods: {
    setupSubscription: function() {
      const storeName = this._internal.storeName || 'app';
      const keysStr = this._internal.keys;
      const keys = keysStr ? keysStr.split(',').map(k => k.trim()) : [];
      
      this._internal.unsubscribe = globalStoreManager.subscribe(
        storeName,
        (nextState, prevState, changedKeys) => {
          this._internal.previousValue = this._internal.value;
          this.flagOutputDirty('value');
          this.flagOutputDirty('previousValue');
          this.sendSignalOnOutput('changed');
        },
        keys
      );
      
      // Trigger initial value
      this.flagOutputDirty('value');
    },
    
    _onNodeDeleted: function() {
      if (this._internal.unsubscribe) {
        this._internal.unsubscribe();
      }
    }
  }
};

module.exports = {
  node: GlobalStoreSubscribeNode
};
```

---

## Usage Examples

### Example 1: Simple Shared Counter

```
// Component A - Display
[Global Store: "app"]
  → state
  → [Get Value] key: "count"
  → [Text] text: "{count}"

// Component B - Increment
[Button] clicked
  → [Global Store: "app"] state
  → [Get Value] key: "count"
  → [Expression] value + 1
  → [Set Global Store] key: "count", value
  → [Set Global Store] set signal
```

### Example 2: User Session (Erleah)

```
// Initialize store
[Component Mounted]
  → [Global Store: "session"]
  → initialState: { user: null, isAuthenticated: false }
  
// Login updates
[Login Success] → userData
  → [Set Global Store] storeName: "session", key: "user", value
  → [Set Global Store] key: "isAuthenticated", value: true
  → [Set Global Store] set

// All components auto-update
[Subscribe to Store] storeName: "session", keys: "user"
  → value
  → [User Avatar] display
  
[Subscribe to Store] storeName: "session", keys: "isAuthenticated"
  → value
  → [Condition] if true → show Dashboard
```

### Example 3: Timeline + Parking Lot Sync (Erleah)

```
// Global store holds agenda
[Global Store: "agenda"]
  → initialState: { 
      timeline: [],
      pendingConnections: [],
      maybes: []
    }

// Timeline View subscribes
[Subscribe to Store] storeName: "agenda", keys: "timeline"
  → value
  → [Repeater] render timeline items

// Parking Lot subscribes
[Subscribe to Store] storeName: "agenda", keys: "pendingConnections,maybes"
  → value
  → [Repeater] render pending items

// AI Agent updates via SSE
[SSE] data → { type: "ADD_TO_TIMELINE", item: {...} }
  → [Set Global Store] storeName: "agenda", key: "timeline"
  → [Array] push item
  → [Set Global Store] set
  
  // Both views update automatically!
```

### Example 4: Draft State Persistence

```
[Global Store: "drafts"]
  → persist: true
  → storageKey: "user-drafts"
  → initialState: {}

// Save draft
[Text Input] changed → content
  → [Set Global Store] storeName: "drafts"
  → key: "message-{id}"
  → value: content
  → [Set Global Store] set

// Load on mount
[Component Mounted]
  → [Subscribe to Store] storeName: "drafts", keys: "message-{id}"
  → value
  → [Text Input] text
```

---

## Testing Checklist

### Functional Tests

- [ ] Store created with initial state
- [ ] Can set values in store
- [ ] Can get values from store
- [ ] Subscribers notified on changes
- [ ] Multiple components subscribe to same store
- [ ] Selective subscription (specific keys) works
- [ ] Store persists to localStorage when enabled
- [ ] Store loads from localStorage on init
- [ ] Transaction batches multiple updates
- [ ] Merge option works correctly
- [ ] Unsubscribe works on node deletion
- [ ] Multiple stores don't interfere

### Edge Cases

- [ ] Setting undefined/null values
- [ ] Setting non-serializable values (with persist)
- [ ] Very large states (>1MB)
- [ ] Rapid updates (100+ per second)
- [ ] Circular references in state
- [ ] localStorage quota exceeded
- [ ] Store name with special characters

### Performance

- [ ] Memory usage stable with many subscribers
- [ ] No visible lag with 100+ subscribers
- [ ] Persistence doesn't block main thread
- [ ] Selective subscriptions only trigger when needed

---

## Documentation Requirements

### User-Facing Docs

Create: `docs/nodes/data/global-store.md`

```markdown
# Global Store

Share state across components with automatic reactivity. When the store updates, all subscribed components update automatically.

## When to Use

- **Shared State**: Multiple components need same data
- **Real-time Sync**: Backend updates propagate everywhere
- **User Session**: Auth, preferences, current user
- **Draft State**: Unsaved changes across UI
- **Theme/Settings**: App-wide configuration

## vs Component Inputs/Outputs

Traditional approach (prop drilling):
```
Root → Child A → Child B → Child C (finally uses value!)
```

Global Store approach:
```
Root sets value → All children subscribe → Auto-update
```

## Basic Usage

**Step 1: Create Store**
```
[Global Store]
  storeName: "app"
  initialState: { count: 0 }
```

**Step 2: Update Store**
```
[Button] clicked
  → [Set Global Store]
      storeName: "app"
      key: "count"
      value: 5
  → set signal
```

**Step 3: Subscribe**
```
[Subscribe to Store]
  storeName: "app"
  keys: "count"
→ value
→ [Text] "Count: {value}"
```

All subscribed components update when store changes!

## Persistence

Save store to browser storage:
```
[Global Store]
  persist: true
  storageKey: "my-app-data"
```

Survives page refreshes!

## Best Practices

1. **Name stores by domain**: "user", "agenda", "settings"
2. **Use specific keys**: Subscribe to "user.name" not entire "user"
3. **Initialize early**: Create store in root component
4. **Persist carefully**: Don't persist sensitive data

## Example: Shopping Cart

[Full example with add/remove/persist]
```

---

## Success Criteria

1. ✅ Store successfully synchronizes state across components
2. ✅ Selective subscriptions work (only trigger on relevant changes)
3. ✅ Persistence works without blocking UI
4. ✅ No memory leaks with many subscribers
5. ✅ Clear documentation with examples
6. ✅ Works in Erleah for Timeline/Parking Lot sync

---

## Future Enhancements

Post-MVP features to consider:

1. **Computed Properties** - Derived state (e.g., `fullName` from `firstName + lastName`)
2. **Middleware** - Intercept updates (logging, validation)
3. **Time Travel** - Undo/redo (connects to AGENT-006)
4. **Async Actions** - Built-in async state management
5. **Devtools** - Browser extension for debugging stores
6. **Store Composition** - Nested/related stores

---

## References

- [Zustand](https://github.com/pmndrs/zustand) - Inspiration for API design
- [Redux](https://redux.js.org/) - State management concepts
- [Recoil](https://recoiljs.org/) - Atom-based state

---

## Dependencies

- None

## Blocked By

- None

## Blocks

- AGENT-004 (Optimistic Updates) - needs store for state management
- AGENT-005 (Action Dispatcher) - uses store for UI state
- Erleah development - requires synchronized state

---

## Estimated Effort Breakdown

| Phase | Estimate | Description |
|-------|----------|-------------|
| Store Manager | 0.5 day | Core singleton with pub/sub |
| Global Store Node | 0.5 day | Main node implementation |
| Set/Subscribe Nodes | 0.5 day | Helper nodes |
| Persistence | 0.5 day | localStorage integration |
| Testing | 0.5 day | Unit tests, edge cases |
| Documentation | 0.5 day | User docs, examples |

**Total: 3 days**

Buffer: None needed (straightforward implementation)

**Final: 2-3 days**
