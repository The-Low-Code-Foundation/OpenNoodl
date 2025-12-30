# AGENT-004: Optimistic Update Pattern

## Overview

Create a pattern and helper nodes for implementing optimistic UI updates - updating the UI immediately before the server confirms the change, then rolling back if the server rejects it. This creates a more responsive user experience for network operations.

**Phase:** 3.5 (Real-Time Agentic UI)  
**Priority:** MEDIUM  
**Effort:** 2-3 days  
**Risk:** Low

---

## Problem Statement

### Current Pattern: Slow & Blocking

```
User clicks "Accept Connection"
  ↓
Show loading spinner
  ↓
Wait for server... (300-1000ms)
  ↓
Update UI to show "Connected"
  ↓
Hide spinner
```

**Problem:** User waits, UI feels sluggish.

### Desired Pattern: Fast & Optimistic

```
User clicks "Accept Connection"
  ↓
Immediately show "Connected" (optimistic)
  ↓
Send request to server (background)
  ↓
IF success: Do nothing (already updated!)
  ↓
IF failure: Roll back to "Pending", show error
```

**Benefit:** UI feels instant, even with slow network.

### Real-World Use Cases (Erleah)

1. **Accept Connection Request** - Show "Accepted" immediately
2. **Add to Timeline** - Item appears instantly
3. **Send Chat Message** - Message shows while sending
4. **Toggle Bookmark** - Star fills immediately
5. **Drag-Drop Reorder** - Items reorder before server confirms

---

## Goals

1. ✅ Apply optimistic update to variable/store
2. ✅ Commit if backend succeeds
3. ✅ Rollback if backend fails
4. ✅ Show pending state (optional)
5. ✅ Queue multiple optimistic updates
6. ✅ Handle race conditions (out-of-order responses)
7. ✅ Integrate with Global Store (AGENT-003)

---

## Technical Design

### Node Specification

```javascript
{
  name: 'net.noodl.OptimisticUpdate',
  displayNodeName: 'Optimistic Update',
  category: 'Data',
  color: 'orange',
  docs: 'https://docs.noodl.net/nodes/data/optimistic-update'
}
```

### Port Schema

#### Inputs

| Port Name | Type | Group | Description |
|-----------|------|-------|-------------|
| `apply` | signal | Actions | Apply optimistic update |
| `commit` | signal | Actions | Confirm update succeeded |
| `rollback` | signal | Actions | Revert update |
| `optimisticValue` | * | Update | Value to apply optimistically |
| `storeName` | string | Store | Global store name (if using store) |
| `key` | string | Store | Store key to update |
| `variableName` | string | Variable | Or Variable node to update |
| `transactionId` | string | Transaction | Unique ID for this update |
| `timeout` | number | Config | Auto-rollback after ms (default: 30000) |

#### Outputs

| Port Name | Type | Group | Description |
|-----------|------|-------|-------------|
| `value` | * | Data | Current value (optimistic or committed) |
| `isPending` | boolean | Status | Update awaiting confirmation |
| `isCommitted` | boolean | Status | Update confirmed |
| `isRolledBack` | boolean | Status | Update reverted |
| `applied` | signal | Events | Fires after optimistic apply |
| `committed` | signal | Events | Fires after commit |
| `rolledBack` | signal | Events | Fires after rollback |
| `timedOut` | signal | Events | Fires if timeout reached |
| `previousValue` | * | Data | Value before optimistic update |
| `error` | string | Events | Error message on rollback |

### State Machine

```
          ┌─────────┐
   START  │         │
   ────┬─→│  IDLE   │←──────────┐
       │  │         │           │
       │  └─────────┘           │
       │       │                │
       │  [apply]               │
       │       │                │
       │       ▼                │
       │  ┌─────────┐     [commit]
       │  │ PENDING │───────────┘
       │  │         │           
       │  └─────────┘           
       │       │                
       │  [rollback]            
       │  [timeout]             
       │       │                
       │       ▼                
       │  ┌─────────┐           
       └──│ROLLED   │           
          │BACK     │           
          └─────────┘
```

---

## Implementation Details

### File Structure

```
packages/noodl-runtime/src/nodes/std-library/data/
├── optimisticupdatenode.js    # Main node
├── optimisticmanager.js       # Transaction manager
└── optimisticupdate.test.js   # Tests
```

### Transaction Manager

```javascript
// optimisticmanager.js

class OptimisticUpdateManager {
  constructor() {
    this.transactions = new Map();
  }
  
  /**
   * Apply optimistic update
   */
  apply(transactionId, currentValue, optimisticValue, options = {}) {
    if (this.transactions.has(transactionId)) {
      throw new Error(`Transaction ${transactionId} already exists`);
    }
    
    const transaction = {
      id: transactionId,
      previousValue: currentValue,
      optimisticValue: optimisticValue,
      appliedAt: Date.now(),
      status: 'pending',
      timeout: options.timeout || 30000,
      timer: null
    };
    
    // Set timeout for auto-rollback
    if (transaction.timeout > 0) {
      transaction.timer = setTimeout(() => {
        this.timeout(transactionId);
      }, transaction.timeout);
    }
    
    this.transactions.set(transactionId, transaction);
    
    console.log(`[OptimisticUpdate] Applied: ${transactionId}`);
    
    return {
      value: optimisticValue,
      isPending: true
    };
  }
  
  /**
   * Commit transaction (success)
   */
  commit(transactionId) {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      console.warn(`[OptimisticUpdate] Transaction not found: ${transactionId}`);
      return null;
    }
    
    // Clear timeout
    if (transaction.timer) {
      clearTimeout(transaction.timer);
    }
    
    transaction.status = 'committed';
    this.transactions.delete(transactionId);
    
    console.log(`[OptimisticUpdate] Committed: ${transactionId}`);
    
    return {
      value: transaction.optimisticValue,
      isPending: false,
      isCommitted: true
    };
  }
  
  /**
   * Rollback transaction (failure)
   */
  rollback(transactionId, error = null) {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      console.warn(`[OptimisticUpdate] Transaction not found: ${transactionId}`);
      return null;
    }
    
    // Clear timeout
    if (transaction.timer) {
      clearTimeout(transaction.timer);
    }
    
    transaction.status = 'rolled_back';
    transaction.error = error;
    
    const result = {
      value: transaction.previousValue,
      isPending: false,
      isRolledBack: true,
      error: error
    };
    
    this.transactions.delete(transactionId);
    
    console.log(`[OptimisticUpdate] Rolled back: ${transactionId}`, error);
    
    return result;
  }
  
  /**
   * Auto-rollback on timeout
   */
  timeout(transactionId) {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) return null;
    
    console.warn(`[OptimisticUpdate] Timeout: ${transactionId}`);
    
    return this.rollback(transactionId, 'Request timed out');
  }
  
  /**
   * Check if transaction is pending
   */
  isPending(transactionId) {
    const transaction = this.transactions.get(transactionId);
    return transaction && transaction.status === 'pending';
  }
  
  /**
   * Get transaction info
   */
  getTransaction(transactionId) {
    return this.transactions.get(transactionId);
  }
  
  /**
   * Clear all transactions (cleanup)
   */
  clear() {
    this.transactions.forEach(transaction => {
      if (transaction.timer) {
        clearTimeout(transaction.timer);
      }
    });
    this.transactions.clear();
  }
}

const optimisticUpdateManager = new OptimisticUpdateManager();

module.exports = { optimisticUpdateManager };
```

### Optimistic Update Node

```javascript
// optimisticupdatenode.js

const { optimisticUpdateManager } = require('./optimisticmanager');
const { globalStoreManager } = require('./globalstore');

var OptimisticUpdateNode = {
  name: 'net.noodl.OptimisticUpdate',
  displayNodeName: 'Optimistic Update',
  category: 'Data',
  color: 'orange',
  
  initialize: function() {
    this._internal.transactionId = null;
    this._internal.currentValue = null;
    this._internal.isPending = false;
  },
  
  inputs: {
    apply: {
      type: 'signal',
      displayName: 'Apply',
      group: 'Actions',
      valueChangedToTrue: function() {
        this.doApply();
      }
    },
    
    commit: {
      type: 'signal',
      displayName: 'Commit',
      group: 'Actions',
      valueChangedToTrue: function() {
        this.doCommit();
      }
    },
    
    rollback: {
      type: 'signal',
      displayName: 'Rollback',
      group: 'Actions',
      valueChangedToTrue: function() {
        this.doRollback();
      }
    },
    
    optimisticValue: {
      type: '*',
      displayName: 'Optimistic Value',
      group: 'Update',
      set: function(value) {
        this._internal.optimisticValue = value;
      }
    },
    
    storeName: {
      type: 'string',
      displayName: 'Store Name',
      group: 'Store',
      set: function(value) {
        this._internal.storeName = value;
      }
    },
    
    key: {
      type: 'string',
      displayName: 'Key',
      group: 'Store',
      set: function(value) {
        this._internal.key = value;
      }
    },
    
    transactionId: {
      type: 'string',
      displayName: 'Transaction ID',
      group: 'Transaction',
      set: function(value) {
        this._internal.transactionId = value;
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
    value: {
      type: '*',
      displayName: 'Value',
      group: 'Data',
      getter: function() {
        return this._internal.currentValue;
      }
    },
    
    isPending: {
      type: 'boolean',
      displayName: 'Is Pending',
      group: 'Status',
      getter: function() {
        return this._internal.isPending;
      }
    },
    
    isCommitted: {
      type: 'boolean',
      displayName: 'Is Committed',
      group: 'Status',
      getter: function() {
        return this._internal.isCommitted;
      }
    },
    
    isRolledBack: {
      type: 'boolean',
      displayName: 'Is Rolled Back',
      group: 'Status',
      getter: function() {
        return this._internal.isRolledBack;
      }
    },
    
    applied: {
      type: 'signal',
      displayName: 'Applied',
      group: 'Events'
    },
    
    committed: {
      type: 'signal',
      displayName: 'Committed',
      group: 'Events'
    },
    
    rolledBack: {
      type: 'signal',
      displayName: 'Rolled Back',
      group: 'Events'
    },
    
    timedOut: {
      type: 'signal',
      displayName: 'Timed Out',
      group: 'Events'
    },
    
    previousValue: {
      type: '*',
      displayName: 'Previous Value',
      group: 'Data',
      getter: function() {
        return this._internal.previousValue;
      }
    },
    
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events',
      getter: function() {
        return this._internal.error;
      }
    }
  },
  
  methods: {
    doApply: function() {
      const transactionId = this._internal.transactionId || this.generateTransactionId();
      const optimisticValue = this._internal.optimisticValue;
      
      // Get current value from store
      let currentValue;
      if (this._internal.storeName && this._internal.key) {
        const store = globalStoreManager.getState(this._internal.storeName);
        currentValue = store[this._internal.key];
      } else {
        currentValue = this._internal.currentValue;
      }
      
      // Apply optimistic update
      const result = optimisticUpdateManager.apply(
        transactionId,
        currentValue,
        optimisticValue,
        { timeout: this._internal.timeout }
      );
      
      // Update store if configured
      if (this._internal.storeName && this._internal.key) {
        globalStoreManager.setKey(
          this._internal.storeName,
          this._internal.key,
          optimisticValue
        );
      }
      
      // Update internal state
      this._internal.previousValue = currentValue;
      this._internal.currentValue = optimisticValue;
      this._internal.isPending = true;
      this._internal.isCommitted = false;
      this._internal.isRolledBack = false;
      this._internal.transactionId = transactionId;
      
      this.flagOutputDirty('value');
      this.flagOutputDirty('isPending');
      this.flagOutputDirty('previousValue');
      this.sendSignalOnOutput('applied');
    },
    
    doCommit: function() {
      const transactionId = this._internal.transactionId;
      if (!transactionId) {
        console.warn('[OptimisticUpdate] No transaction to commit');
        return;
      }
      
      const result = optimisticUpdateManager.commit(transactionId);
      if (!result) return;
      
      this._internal.isPending = false;
      this._internal.isCommitted = true;
      
      this.flagOutputDirty('isPending');
      this.flagOutputDirty('isCommitted');
      this.sendSignalOnOutput('committed');
    },
    
    doRollback: function(error = null) {
      const transactionId = this._internal.transactionId;
      if (!transactionId) {
        console.warn('[OptimisticUpdate] No transaction to rollback');
        return;
      }
      
      const result = optimisticUpdateManager.rollback(transactionId, error);
      if (!result) return;
      
      // Revert store if configured
      if (this._internal.storeName && this._internal.key) {
        globalStoreManager.setKey(
          this._internal.storeName,
          this._internal.key,
          result.value
        );
      }
      
      this._internal.currentValue = result.value;
      this._internal.isPending = false;
      this._internal.isRolledBack = true;
      this._internal.error = result.error;
      
      this.flagOutputDirty('value');
      this.flagOutputDirty('isPending');
      this.flagOutputDirty('isRolledBack');
      this.flagOutputDirty('error');
      this.sendSignalOnOutput('rolledBack');
      
      if (result.error === 'Request timed out') {
        this.sendSignalOnOutput('timedOut');
      }
    },
    
    generateTransactionId: function() {
      return 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },
    
    _onNodeDeleted: function() {
      // Clean up pending transaction
      if (this._internal.transactionId) {
        optimisticUpdateManager.rollback(this._internal.transactionId);
      }
    }
  },
  
  getInspectInfo: function() {
    return {
      type: 'value',
      value: {
        status: this._internal.isPending ? 'Pending' : 'Idle',
        value: this._internal.currentValue,
        transactionId: this._internal.transactionId
      }
    };
  }
};

module.exports = {
  node: OptimisticUpdateNode
};
```

---

## Usage Examples

### Example 1: Accept Connection (Erleah)

```
[Button: "Accept"] clicked
  ↓
[Optimistic Update]
  optimisticValue: { status: "accepted" }
  storeName: "connections"
  key: "connection-{id}"
  timeout: 5000
  ↓
[Optimistic Update] apply signal
  ↓
[HTTP Request] POST /connections/{id}/accept
  ↓
[HTTP Request] success
  → [Optimistic Update] commit
  
[HTTP Request] failure
  → [Optimistic Update] rollback
  → [Show Toast] "Failed to accept connection"
```

### Example 2: Add to Timeline

```
[AI Agent] suggests session
  ↓
[Button: "Add to Timeline"] clicked
  ↓
[Optimistic Update]
  optimisticValue: { ...sessionData, id: tempId }
  storeName: "agenda"
  key: "timeline"
  ↓
[Optimistic Update] value
  → [Array] push to timeline array
  → [Optimistic Update] optimisticValue
  → [Optimistic Update] apply
  
// Timeline immediately shows item!

[HTTP Request] POST /agenda/sessions
  → returns real session ID
  ↓
[Success]
  → [Replace temp ID with real ID]
  → [Optimistic Update] commit
  
[Failure]
  → [Optimistic Update] rollback
  → [Show Error] "Could not add session"
```

### Example 3: Chat Message Send

```
[Text Input] → messageText
[Send Button] clicked
  ↓
[Object] create message
  id: tempId
  text: messageText
  status: "sending"
  timestamp: now
  ↓
[Optimistic Update]
  storeName: "chat"
  key: "messages"
  ↓
[Optimistic Update] value (current messages)
  → [Array] push new message
  → [Optimistic Update] optimisticValue
  → [Optimistic Update] apply

// Message appears immediately with "sending" indicator

[HTTP Request] POST /messages
  ↓
[Success] → real message from server
  → [Update message status to "sent"]
  → [Optimistic Update] commit
  
[Failure]
  → [Optimistic Update] rollback
  → [Update message status to "failed"]
  → [Show Retry Button]
```

### Example 4: Toggle Bookmark

```
[Star Icon] clicked
  ↓
[Variable: isBookmarked] current value
  → [Expression] !value (toggle)
  → [Optimistic Update] optimisticValue
  ↓
[Optimistic Update] apply
  ↓
[Star Icon] filled = [Optimistic Update] value

// Star fills immediately

[HTTP Request] POST /bookmarks
  ↓
[Success]
  → [Optimistic Update] commit
  
[Failure]
  → [Optimistic Update] rollback
  → [Show Toast] "Couldn't save bookmark"

// Star unfills on failure
```

---

## Testing Checklist

### Functional Tests

- [ ] Apply sets value optimistically
- [ ] Commit keeps optimistic value
- [ ] Rollback reverts to previous value
- [ ] Timeout triggers automatic rollback
- [ ] isPending reflects correct state
- [ ] Store integration works
- [ ] Multiple transactions don't interfere
- [ ] Transaction IDs are unique
- [ ] Signals fire at correct times

### Edge Cases

- [ ] Commit without apply (no-op)
- [ ] Rollback without apply (no-op)
- [ ] Apply twice with same transaction ID (error)
- [ ] Commit after timeout (no-op)
- [ ] Very fast success (commit before timeout)
- [ ] Network reconnect scenarios
- [ ] Component unmount cleans up transaction

### Performance

- [ ] No memory leaks with many transactions
- [ ] Timeout cleanup works correctly
- [ ] Multiple optimistic updates in quick succession

---

## Documentation Requirements

### User-Facing Docs

Create: `docs/nodes/data/optimistic-update.md`

```markdown
# Optimistic Update

Make your UI feel instant by updating immediately, then confirming with the server later. Perfect for actions like liking, bookmarking, or accepting requests.

## The Problem

Without optimistic updates:
```
User clicks button → Show spinner → Wait... → Update UI
                     (feels slow)
```

With optimistic updates:
```
User clicks button → Update UI immediately → Confirm in background
                     (feels instant!)
```

## Basic Pattern

1. Apply optimistic update (UI changes immediately)
2. Send request to server (background)
3. If success: Commit (keep the change)
4. If failure: Rollback (undo the change)

## Example: Like Button

[Full example with visual diagrams]

## With Global Store

For shared state, use with Global Store:

```
[Optimistic Update]
  storeName: "posts"
  key: "likes"
  optimisticValue: likesCount + 1
```

All components subscribing to the store update automatically!

## Timeout

If server doesn't respond:
```
[Optimistic Update]
  timeout: 5000  // Auto-rollback after 5s
```

## Best Practices

1. **Always handle rollback**: Show error message
2. **Show pending state**: "Saving..." indicator (optional)
3. **Use unique IDs**: Let node generate, or provide your own
4. **Set reasonable timeout**: 5-30 seconds depending on operation
```

---

## Success Criteria

1. ✅ Optimistic updates apply immediately
2. ✅ Rollback works on failure
3. ✅ Timeout prevents stuck pending states
4. ✅ Integrates with Global Store
5. ✅ No memory leaks
6. ✅ Clear documentation with examples
7. ✅ Works in Erleah for responsive interactions

---

## Future Enhancements

1. **Retry Logic** - Auto-retry failed operations
2. **Conflict Resolution** - Handle concurrent updates
3. **Offline Queue** - Queue updates when offline
4. **Animation Hooks** - Smooth transitions on rollback
5. **Batch Commits** - Commit multiple related transactions

---

## References

- [Optimistic UI](https://www.apollographql.com/docs/react/performance/optimistic-ui/) - Apollo GraphQL docs
- [React Query Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)

---

## Dependencies

- AGENT-003 (Global State Store) - for store integration

## Blocked By

- AGENT-003

## Blocks

- None (optional enhancement for Erleah)

---

## Estimated Effort Breakdown

| Phase | Estimate | Description |
|-------|----------|-------------|
| Transaction Manager | 0.5 day | Core state machine |
| Optimistic Update Node | 1 day | Main node with store integration |
| Testing | 0.5 day | Unit tests, edge cases |
| Documentation | 0.5 day | User docs, examples |

**Total: 2.5 days**

Buffer: +0.5 day for edge cases = **3 days**

**Final: 2-3 days**
