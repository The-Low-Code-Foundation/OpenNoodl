# AGENT-005: Action Dispatcher

## Overview

Create a system for backend-to-frontend action dispatching, allowing the server (AI agent) to trigger UI actions directly. This enables agentic UIs where the backend can open views, navigate pages, highlight elements, and control the application flow.

**Phase:** 3.5 (Real-Time Agentic UI)  
**Priority:** HIGH  
**Effort:** 2-4 days  
**Risk:** Medium

---

## Problem Statement

### Current Limitation

Backends can only send data, not commands:

```
Backend sends: { sessions: [...], attendees: [...] }
Frontend must: Parse data → Decide what to do → Update UI manually
```

The AI agent can't directly control the UI.

### Desired Pattern: Action-Based Control

```
Backend sends: { 
  type: "OPEN_VIEW",
  view: "agenda",
  data: { sessionId: "123" }
}

Frontend: Automatically opens agenda view with session 123
```

### Real-World Use Cases (Erleah)

1. **AI Agent Navigation** - "Let me open that session for you"
2. **Guided Tours** - AI walks user through interface
3. **Smart Responses** - Agent opens relevant views based on query
4. **Proactive Suggestions** - "I see you're looking at this, let me show you related items"
5. **Workflow Automation** - Multi-step UI flows triggered by backend

---

## Goals

1. ✅ Define action vocabulary (open view, navigate, highlight, etc.)
2. ✅ Dispatch actions from backend messages
3. ✅ Execute actions safely in sandboxed context
4. ✅ Queue actions when dependencies not ready
5. ✅ Register custom action handlers
6. ✅ Integrate with SSE/WebSocket for real-time actions
7. ✅ Provide action history/logging

---

## Technical Design

### Node Specifications

We'll create TWO nodes:

1. **Action Dispatcher** - Receives and executes actions
2. **Register Action Handler** - Defines custom action types

### Action Vocabulary

Built-in actions:

```typescript
// Navigation Actions
{
  type: "OPEN_VIEW",
  view: "agenda" | "chat" | "parkingLot",
  params: { id?: string }
}

{
  type: "NAVIGATE",
  component: "SessionDetail",
  params: { sessionId: "123" }
}

{
  type: "NAVIGATE_BACK"
}

// State Actions
{
  type: "SET_STORE",
  storeName: "app",
  key: "currentView",
  value: "agenda"
}

{
  type: "SET_VARIABLE",
  variable: "selectedSession",
  value: { id: "123", name: "AI Session" }
}

// UI Actions
{
  type: "SHOW_TOAST",
  message: "Session added to timeline",
  variant: "success" | "error" | "info"
}

{
  type: "HIGHLIGHT_ELEMENT",
  elementId: "session-123",
  duration: 3000,
  message: "This is the session I found"
}

{
  type: "SCROLL_TO",
  elementId: "timeline-item-5"
}

// Data Actions
{
  type: "FETCH",
  url: "/api/sessions/123",
  method: "GET"
}

{
  type: "TRIGGER_SIGNAL",
  signalName: "refreshData"
}

// Custom Actions
{
  type: "CUSTOM",
  handler: "myCustomAction",
  data: { ... }
}
```

### Action Dispatcher Node

```javascript
{
  name: 'net.noodl.ActionDispatcher',
  displayNodeName: 'Action Dispatcher',
  category: 'Events',
  color: 'purple',
  docs: 'https://docs.noodl.net/nodes/events/action-dispatcher'
}
```

#### Ports: Action Dispatcher

| Port Name | Type | Group | Description |
|-----------|------|-------|-------------|
| **Inputs** |
| `action` | object | Action | Action object to dispatch |
| `dispatch` | signal | Actions | Trigger dispatch |
| `queueWhenBusy` | boolean | Config | Queue if action in progress (default: true) |
| `timeout` | number | Config | Max execution time (ms, default: 30000) |
| **Outputs** |
| `actionType` | string | Data | Type of current action |
| `actionData` | object | Data | Data from current action |
| `dispatched` | signal | Events | Fires when action starts |
| `completed` | signal | Events | Fires when action completes |
| `failed` | signal | Events | Fires if action fails |
| `queueSize` | number | Status | Actions waiting in queue |
| `isExecuting` | boolean | Status | Action currently running |
| `error` | string | Events | Error message |
| `result` | * | Data | Result from action execution |

### Register Action Handler Node

```javascript
{
  name: 'net.noodl.ActionDispatcher.RegisterHandler',
  displayNodeName: 'Register Action Handler',
  category: 'Events',
  color: 'purple'
}
```

#### Ports: Register Action Handler

| Port Name | Type | Group | Description |
|-----------|------|-------|-------------|
| **Inputs** |
| `actionType` | string | Handler | Action type to handle (e.g., "OPEN_DASHBOARD") |
| `register` | signal | Actions | Register this handler |
| **Outputs** |
| `trigger` | signal | Events | Fires when this action type dispatched |
| `actionData` | object | Data | Data from the action |
| `complete` | signal | Actions | Signal back to dispatcher when done |

---

## Implementation Details

### File Structure

```
packages/noodl-runtime/src/nodes/std-library/events/
├── actiondispatcher.js           # Core dispatcher singleton
├── actiondispatchernode.js       # Dispatcher node
├── registeractionhandlernode.js  # Handler registration node
└── actiondispatcher.test.js      # Tests
```

### Core Dispatcher Implementation

```javascript
// actiondispatcher.js

const { globalStoreManager } = require('../data/globalstore');

class ActionDispatcherManager {
  constructor() {
    this.handlers = new Map();
    this.queue = [];
    this.isExecuting = false;
    this.actionHistory = [];
  }
  
  /**
   * Register a handler for an action type
   */
  registerHandler(actionType, handler) {
    if (!this.handlers.has(actionType)) {
      this.handlers.set(actionType, []);
    }
    
    this.handlers.get(actionType).push(handler);
    
    console.log(`[ActionDispatcher] Registered handler for: ${actionType}`);
    
    // Return unregister function
    return () => {
      const handlers = this.handlers.get(actionType);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    };
  }
  
  /**
   * Dispatch an action
   */
  async dispatch(action, options = {}) {
    if (!action || !action.type) {
      throw new Error('Action must have a type');
    }
    
    // Queue if busy and queueing enabled
    if (this.isExecuting && options.queueWhenBusy) {
      this.queue.push(action);
      console.log(`[ActionDispatcher] Queued: ${action.type}`);
      return { queued: true, queueSize: this.queue.length };
    }
    
    this.isExecuting = true;
    
    try {
      console.log(`[ActionDispatcher] Dispatching: ${action.type}`, action);
      
      // Add to history
      this.actionHistory.push({
        action,
        timestamp: Date.now(),
        status: 'executing'
      });
      
      // Try built-in handlers first
      let result;
      if (this.builtInHandlers[action.type]) {
        result = await this.builtInHandlers[action.type](action);
      }
      
      // Then custom handlers
      const handlers = this.handlers.get(action.type);
      if (handlers && handlers.length > 0) {
        for (const handler of handlers) {
          await handler(action.data || action);
        }
      }
      
      // Update history
      const historyEntry = this.actionHistory[this.actionHistory.length - 1];
      historyEntry.status = 'completed';
      historyEntry.result = result;
      
      this.isExecuting = false;
      
      // Process queue
      this.processQueue();
      
      return { completed: true, result };
      
    } catch (error) {
      console.error(`[ActionDispatcher] Failed: ${action.type}`, error);
      
      // Update history
      const historyEntry = this.actionHistory[this.actionHistory.length - 1];
      historyEntry.status = 'failed';
      historyEntry.error = error.message;
      
      this.isExecuting = false;
      
      // Process queue
      this.processQueue();
      
      return { failed: true, error: error.message };
    }
  }
  
  /**
   * Process queued actions
   */
  async processQueue() {
    if (this.queue.length === 0) return;
    
    const action = this.queue.shift();
    await this.dispatch(action, { queueWhenBusy: true });
  }
  
  /**
   * Built-in action handlers
   */
  builtInHandlers = {
    'SET_STORE': async (action) => {
      const { storeName, key, value } = action;
      if (!storeName || !key) {
        throw new Error('SET_STORE requires storeName and key');
      }
      globalStoreManager.setKey(storeName, key, value);
      return { success: true };
    },
    
    'SHOW_TOAST': async (action) => {
      const { message, variant = 'info' } = action;
      // Emit event that toast component can listen to
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('noodl:toast', {
          detail: { message, variant }
        }));
      }
      return { success: true };
    },
    
    'TRIGGER_SIGNAL': async (action) => {
      const { signalName } = action;
      // Emit as custom event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(`noodl:signal:${signalName}`));
      }
      return { success: true };
    },
    
    'FETCH': async (action) => {
      const { url, method = 'GET', body, headers = {} } = action;
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: body ? JSON.stringify(body) : undefined
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return { success: true, data };
    }
  };
  
  /**
   * Get action history
   */
  getHistory(limit = 10) {
    return this.actionHistory.slice(-limit);
  }
  
  /**
   * Clear action queue
   */
  clearQueue() {
    this.queue = [];
  }
  
  /**
   * Get queue size
   */
  getQueueSize() {
    return this.queue.length;
  }
}

const actionDispatcherManager = new ActionDispatcherManager();

module.exports = { actionDispatcherManager };
```

### Action Dispatcher Node Implementation

```javascript
// actiondispatchernode.js

const { actionDispatcherManager } = require('./actiondispatcher');

var ActionDispatcherNode = {
  name: 'net.noodl.ActionDispatcher',
  displayNodeName: 'Action Dispatcher',
  category: 'Events',
  color: 'purple',
  
  initialize: function() {
    this._internal.isExecuting = false;
    this._internal.queueSize = 0;
  },
  
  inputs: {
    action: {
      type: 'object',
      displayName: 'Action',
      group: 'Action',
      set: function(value) {
        this._internal.action = value;
      }
    },
    
    dispatch: {
      type: 'signal',
      displayName: 'Dispatch',
      group: 'Actions',
      valueChangedToTrue: function() {
        this.doDispatch();
      }
    },
    
    queueWhenBusy: {
      type: 'boolean',
      displayName: 'Queue When Busy',
      group: 'Config',
      default: true,
      set: function(value) {
        this._internal.queueWhenBusy = value;
      }
    },
    
    timeout: {
      type: 'number',
      displayName: 'Timeout (ms)',
      group: 'Config',
      default: 30000,
      set: function(value) {
        this._internal.timeout = value;
      }
    }
  },
  
  outputs: {
    actionType: {
      type: 'string',
      displayName: 'Action Type',
      group: 'Data',
      getter: function() {
        return this._internal.actionType;
      }
    },
    
    actionData: {
      type: 'object',
      displayName: 'Action Data',
      group: 'Data',
      getter: function() {
        return this._internal.actionData;
      }
    },
    
    dispatched: {
      type: 'signal',
      displayName: 'Dispatched',
      group: 'Events'
    },
    
    completed: {
      type: 'signal',
      displayName: 'Completed',
      group: 'Events'
    },
    
    failed: {
      type: 'signal',
      displayName: 'Failed',
      group: 'Events'
    },
    
    queueSize: {
      type: 'number',
      displayName: 'Queue Size',
      group: 'Status',
      getter: function() {
        return actionDispatcherManager.getQueueSize();
      }
    },
    
    isExecuting: {
      type: 'boolean',
      displayName: 'Is Executing',
      group: 'Status',
      getter: function() {
        return this._internal.isExecuting;
      }
    },
    
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events',
      getter: function() {
        return this._internal.error;
      }
    },
    
    result: {
      type: '*',
      displayName: 'Result',
      group: 'Data',
      getter: function() {
        return this._internal.result;
      }
    }
  },
  
  methods: {
    async doDispatch() {
      const action = this._internal.action;
      
      if (!action) {
        this.setError('No action provided');
        return;
      }
      
      this._internal.actionType = action.type;
      this._internal.actionData = action;
      this._internal.isExecuting = true;
      this._internal.error = null;
      this._internal.result = null;
      
      this.flagOutputDirty('actionType');
      this.flagOutputDirty('actionData');
      this.flagOutputDirty('isExecuting');
      this.sendSignalOnOutput('dispatched');
      
      try {
        const result = await actionDispatcherManager.dispatch(action, {
          queueWhenBusy: this._internal.queueWhenBusy,
          timeout: this._internal.timeout
        });
        
        if (result.queued) {
          // Action was queued
          this.flagOutputDirty('queueSize');
          return;
        }
        
        if (result.completed) {
          this._internal.result = result.result;
          this._internal.isExecuting = false;
          
          this.flagOutputDirty('result');
          this.flagOutputDirty('isExecuting');
          this.sendSignalOnOutput('completed');
        } else if (result.failed) {
          this.setError(result.error);
          this._internal.isExecuting = false;
          this.flagOutputDirty('isExecuting');
          this.sendSignalOnOutput('failed');
        }
        
      } catch (e) {
        this.setError(e.message);
        this._internal.isExecuting = false;
        this.flagOutputDirty('isExecuting');
        this.sendSignalOnOutput('failed');
      }
    },
    
    setError: function(message) {
      this._internal.error = message;
      this.flagOutputDirty('error');
    }
  },
  
  getInspectInfo: function() {
    return {
      type: 'value',
      value: {
        lastAction: this._internal.actionType,
        isExecuting: this._internal.isExecuting,
        queueSize: actionDispatcherManager.getQueueSize()
      }
    };
  }
};

module.exports = {
  node: ActionDispatcherNode
};
```

### Register Action Handler Node

```javascript
// registeractionhandlernode.js

const { actionDispatcherManager } = require('./actiondispatcher');

var RegisterActionHandlerNode = {
  name: 'net.noodl.ActionDispatcher.RegisterHandler',
  displayNodeName: 'Register Action Handler',
  category: 'Events',
  color: 'purple',
  
  initialize: function() {
    this._internal.unregister = null;
    this._internal.pendingComplete = null;
  },
  
  inputs: {
    actionType: {
      type: 'string',
      displayName: 'Action Type',
      group: 'Handler',
      set: function(value) {
        // Re-register if type changes
        if (this._internal.unregister) {
          this._internal.unregister();
        }
        this._internal.actionType = value;
        this.registerHandler();
      }
    },
    
    register: {
      type: 'signal',
      displayName: 'Register',
      group: 'Actions',
      valueChangedToTrue: function() {
        this.registerHandler();
      }
    },
    
    complete: {
      type: 'signal',
      displayName: 'Complete',
      group: 'Actions',
      valueChangedToTrue: function() {
        if (this._internal.pendingComplete) {
          this._internal.pendingComplete();
          this._internal.pendingComplete = null;
        }
      }
    }
  },
  
  outputs: {
    trigger: {
      type: 'signal',
      displayName: 'Trigger',
      group: 'Events'
    },
    
    actionData: {
      type: 'object',
      displayName: 'Action Data',
      group: 'Data',
      getter: function() {
        return this._internal.actionData;
      }
    }
  },
  
  methods: {
    registerHandler: function() {
      const actionType = this._internal.actionType;
      if (!actionType) return;
      
      // Unregister previous
      if (this._internal.unregister) {
        this._internal.unregister();
      }
      
      // Register handler
      this._internal.unregister = actionDispatcherManager.registerHandler(
        actionType,
        (data) => {
          return new Promise((resolve) => {
            // Store data
            this._internal.actionData = data;
            this.flagOutputDirty('actionData');
            
            // Trigger handler
            this.sendSignalOnOutput('trigger');
            
            // Wait for complete signal
            this._internal.pendingComplete = resolve;
          });
        }
      );
      
      console.log(`[RegisterActionHandler] Registered: ${actionType}`);
    },
    
    _onNodeDeleted: function() {
      if (this._internal.unregister) {
        this._internal.unregister();
      }
    }
  }
};

module.exports = {
  node: RegisterActionHandlerNode
};
```

---

## Usage Examples

### Example 1: SSE Actions (Erleah AI Agent)

```
[SSE] connected to "/ai/stream"
  ↓
[SSE] data → { type: "OPEN_VIEW", view: "agenda" }
  ↓
[Action Dispatcher] action
  ↓
[Action Dispatcher] dispatch

// Built-in handler automatically opens agenda view!
```

### Example 2: Custom Action Handler

```
// Register handler for custom action
[Component Mounted]
  ↓
[Register Action Handler]
  actionType: "OPEN_SESSION_DETAIL"
  register
  
[Register Action Handler] trigger
  ↓
[Register Action Handler] actionData → { sessionId }
  ↓
[Navigate to Component] "SessionDetail"
  ↓
[Set Variable] selectedSession = actionData
  ↓
[Register Action Handler] complete signal

// Elsewhere, dispatch the action
[Action Dispatcher]
  action: { type: "OPEN_SESSION_DETAIL", sessionId: "123" }
  dispatch
```

### Example 3: Multi-Step Flow

```
// AI agent triggers workflow
[SSE] data → [
  { type: "SET_STORE", storeName: "app", key: "view", value: "timeline" },
  { type: "HIGHLIGHT_ELEMENT", elementId: "session-123" },
  { type: "SHOW_TOAST", message: "Here's the session I found" }
]
  ↓
[For Each] action in array
  ↓
[Action Dispatcher] action
[Action Dispatcher] dispatch
  ↓
[Action Dispatcher] completed
  → continue to next action
```

### Example 4: Guided Tour

```
// Backend provides tour steps
tourSteps = [
  { type: "HIGHLIGHT_ELEMENT", elementId: "search-bar", message: "Start by searching" },
  { type: "HIGHLIGHT_ELEMENT", elementId: "add-button", message: "Then add to timeline" },
  { type: "SHOW_TOAST", message: "Tour complete!" }
]

[Button: "Start Tour"] clicked
  ↓
[For Each Step]
  → [Delay] 2000ms
  → [Action Dispatcher] dispatch
  → wait for completed
  → next step
```

---

## Testing Checklist

### Functional Tests

- [ ] Built-in actions execute correctly
- [ ] Custom handlers register and trigger
- [ ] Actions queue when busy
- [ ] Queue processes in order
- [ ] Timeout works for slow actions
- [ ] Multiple handlers for same action type
- [ ] Handler unregistration works
- [ ] Action history records events
- [ ] Error handling works

### Edge Cases

- [ ] Dispatch without action object
- [ ] Action without type field
- [ ] Handler throws error
- [ ] Register duplicate action type
- [ ] Unregister non-existent handler
- [ ] Very long queue (100+ actions)
- [ ] Rapid dispatch (stress test)

### Performance

- [ ] No memory leaks with many actions
- [ ] Queue doesn't grow unbounded
- [ ] Handler execution is async-safe

---

## Security Considerations

### 1. Action Validation

Always validate actions from untrusted sources:

```javascript
// In dispatcher
if (!isValidActionType(action.type)) {
  throw new Error('Invalid action type');
}

if (!hasPermission(user, action.type)) {
  throw new Error('Unauthorized action');
}
```

### 2. Rate Limiting

Prevent action flooding:

```javascript
// Max 100 actions per minute per user
if (rateLimiter.check(userId) > 100) {
  throw new Error('Rate limit exceeded');
}
```

### 3. Sandboxing

Custom handlers run in controlled context - they can't access arbitrary code.

---

## Documentation Requirements

### User-Facing Docs

Create: `docs/nodes/events/action-dispatcher.md`

```markdown
# Action Dispatcher

Let your backend control your frontend. Perfect for AI agents, guided tours, and automated workflows.

## The Pattern

Instead of:
```
Backend: "Here's data"
Frontend: "What should I do with it?"
```

Do this:
```
Backend: "Open this view with this data"
Frontend: "Done!"
```

## Built-in Actions

- `OPEN_VIEW` - Navigate to view
- `SET_STORE` - Update global store
- `SHOW_TOAST` - Display notification
- `HIGHLIGHT_ELEMENT` - Draw attention
- `TRIGGER_SIGNAL` - Fire signal
- `FETCH` - Make HTTP request

## Custom Actions

Create your own:

```
[Register Action Handler]
  actionType: "MY_ACTION"
→ trigger
→ [Your logic here]
→ complete signal
```

## Example: AI Agent Navigation

[Full example with SSE + Action Dispatcher]

## Security

Actions from untrusted sources should be validated server-side before sending to frontend.
```

---

## Success Criteria

1. ✅ Built-in actions work out of box
2. ✅ Custom handlers easy to register
3. ✅ Queue prevents action conflicts
4. ✅ Integrates with SSE/WebSocket
5. ✅ No security vulnerabilities
6. ✅ Clear documentation
7. ✅ Works in Erleah for AI agent control

---

## Future Enhancements

1. **Action Middleware** - Intercept/transform actions
2. **Conditional Actions** - If/then logic in actions
3. **Action Composition** - Combine multiple actions
4. **Undo/Redo** - Reversible actions (with AGENT-006)
5. **Action Recording** - Record/replay user flows
6. **Permissions System** - Role-based action control

---

## References

- [Flux Architecture](https://facebook.github.io/flux/) - Action pattern inspiration
- [Redux Actions](https://redux.js.org/tutorials/fundamentals/part-2-concepts-data-flow)

---

## Dependencies

- AGENT-003 (Global State Store) - for SET_STORE action

## Blocked By

- AGENT-001 or AGENT-002 (for SSE/WebSocket integration)
- AGENT-003 (for store actions)

## Blocks

- None (enhances Erleah experience)

---

## Estimated Effort Breakdown

| Phase | Estimate | Description |
|-------|----------|-------------|
| Core Dispatcher | 1 day | Manager with built-in actions |
| Dispatcher Node | 0.5 day | Node implementation |
| Handler Node | 0.5 day | Registration system |
| Testing | 0.5 day | Unit tests, security tests |
| Documentation | 0.5 day | User docs, examples |
| Polish | 0.5 day | Edge cases, error handling |

**Total: 3.5 days**

Buffer: +0.5 day for security review = **4 days**

**Final: 2-4 days** (depending on built-in actions scope)
