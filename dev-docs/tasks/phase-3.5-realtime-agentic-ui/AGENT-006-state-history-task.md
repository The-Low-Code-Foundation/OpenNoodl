# AGENT-006: State History & Time Travel

## Overview

Create a state history tracking system that enables undo/redo, time-travel debugging, and state snapshots. This helps users recover from mistakes and developers debug complex state interactions.

**Phase:** 3.5 (Real-Time Agentic UI)  
**Priority:** LOW (nice-to-have)  
**Effort:** 1-2 days  
**Risk:** Low

---

## Problem Statement

### Current Limitation

State changes are permanent:

```
User makes mistake → State changes → Can't undo
Developer debugging → State changed 10 steps ago → Can't replay
```

No way to go back in time.

### Desired Pattern

```
User action → State snapshot → Change state
User: "Undo" → Restore previous snapshot
Developer: "Go back 5 steps" → Time travel to that state
```

### Real-World Use Cases

1. **Undo Mistakes** - User accidentally removes item from timeline
2. **Debug State** - Developer replays sequence that caused bug
3. **A/B Comparison** - Save state, test changes, restore to compare
4. **Session Recovery** - Reload state after browser crash
5. **Feature Flags** - Toggle features on/off with instant rollback

---

## Goals

1. ✅ Track state changes automatically
2. ✅ Undo/redo state changes
3. ✅ Jump to specific state in history
4. ✅ Save/restore state snapshots
5. ✅ Limit history size (memory management)
6. ✅ Integrate with Global Store (AGENT-003)
7. ✅ Export/import history (debugging)

---

## Technical Design

### Node Specifications

We'll create THREE nodes:

1. **State History** - Track and manage history
2. **Undo** - Revert to previous state
3. **State Snapshot** - Save/restore snapshots

### State History Node

```javascript
{
  name: 'net.noodl.StateHistory',
  displayNodeName: 'State History',
  category: 'Data',
  color: 'blue',
  docs: 'https://docs.noodl.net/nodes/data/state-history'
}
```

#### Ports: State History

| Port Name | Type | Group | Description |
|-----------|------|-------|-------------|
| **Inputs** |
| `storeName` | string | Store | Global store to track |
| `trackKeys` | string | Config | Comma-separated keys to track (blank = all) |
| `maxHistory` | number | Config | Max history entries (default: 50) |
| `enabled` | boolean | Config | Enable/disable tracking (default: true) |
| `clearHistory` | signal | Actions | Clear history |
| **Outputs** |
| `historySize` | number | Status | Number of entries in history |
| `canUndo` | boolean | Status | Can go back |
| `canRedo` | boolean | Status | Can go forward |
| `currentIndex` | number | Status | Position in history |
| `history` | array | Data | Full history array |
| `stateChanged` | signal | Events | Fires on any state change |

### Undo Node

```javascript
{
  name: 'net.noodl.StateHistory.Undo',
  displayNodeName: 'Undo',
  category: 'Data',
  color: 'blue'
}
```

#### Ports: Undo Node

| Port Name | Type | Group | Description |
|-----------|------|-------|-------------|
| **Inputs** |
| `storeName` | string | Store | Store to undo |
| `undo` | signal | Actions | Go back one step |
| `redo` | signal | Actions | Go forward one step |
| `jumpTo` | signal | Actions | Jump to specific index |
| `targetIndex` | number | Jump | Index to jump to |
| **Outputs** |
| `undone` | signal | Events | Fires after undo |
| `redone` | signal | Events | Fires after redo |
| `jumped` | signal | Events | Fires after jump |

### State Snapshot Node

```javascript
{
  name: 'net.noodl.StateSnapshot',
  displayNodeName: 'State Snapshot',
  category: 'Data',
  color: 'blue'
}
```

#### Ports: State Snapshot

| Port Name | Type | Group | Description |
|-----------|------|-------|-------------|
| **Inputs** |
| `storeName` | string | Store | Store to snapshot |
| `save` | signal | Actions | Save current state |
| `restore` | signal | Actions | Restore saved state |
| `snapshotName` | string | Snapshot | Name for this snapshot |
| `snapshotData` | object | Snapshot | Snapshot to restore (from export) |
| **Outputs** |
| `snapshot` | object | Data | Current saved snapshot |
| `saved` | signal | Events | Fires after save |
| `restored` | signal | Events | Fires after restore |

---

## Implementation Details

### File Structure

```
packages/noodl-runtime/src/nodes/std-library/data/
├── statehistorymanager.js    # History tracking
├── statehistorynode.js        # State History node
├── undonode.js                # Undo/Redo node  
├── statesnapshotnode.js       # Snapshot node
└── statehistory.test.js       # Tests
```

### State History Manager

```javascript
// statehistorymanager.js

const { globalStoreManager } = require('./globalstore');

class StateHistoryManager {
  constructor() {
    this.histories = new Map(); // storeName -> history
    this.snapshots = new Map(); // snapshotName -> state
  }
  
  /**
   * Start tracking a store
   */
  trackStore(storeName, options = {}) {
    if (this.histories.has(storeName)) {
      return; // Already tracking
    }
    
    const { maxHistory = 50, trackKeys = [] } = options;
    
    const history = {
      entries: [],
      currentIndex: -1,
      maxHistory,
      trackKeys,
      unsubscribe: null
    };
    
    // Get initial state
    const initialState = globalStoreManager.getState(storeName);
    history.entries.push({
      state: JSON.parse(JSON.stringify(initialState)),
      timestamp: Date.now(),
      description: 'Initial state'
    });
    history.currentIndex = 0;
    
    // Subscribe to changes
    history.unsubscribe = globalStoreManager.subscribe(
      storeName,
      (nextState, prevState, changedKeys) => {
        this.recordStateChange(storeName, nextState, changedKeys);
      },
      trackKeys
    );
    
    this.histories.set(storeName, history);
    
    console.log(`[StateHistory] Tracking store: ${storeName}`);
  }
  
  /**
   * Stop tracking a store
   */
  stopTracking(storeName) {
    const history = this.histories.get(storeName);
    if (!history) return;
    
    if (history.unsubscribe) {
      history.unsubscribe();
    }
    
    this.histories.delete(storeName);
  }
  
  /**
   * Record a state change
   */
  recordStateChange(storeName, newState, changedKeys) {
    const history = this.histories.get(storeName);
    if (!history) return;
    
    // If we're not at the end, truncate future
    if (history.currentIndex < history.entries.length - 1) {
      history.entries = history.entries.slice(0, history.currentIndex + 1);
    }
    
    // Add new entry
    history.entries.push({
      state: JSON.parse(JSON.stringify(newState)),
      timestamp: Date.now(),
      changedKeys: changedKeys,
      description: `Changed: ${changedKeys.join(', ')}`
    });
    
    // Enforce max history
    if (history.entries.length > history.maxHistory) {
      history.entries.shift();
    } else {
      history.currentIndex++;
    }
    
    console.log(`[StateHistory] Recorded change in ${storeName}`, changedKeys);
  }
  
  /**
   * Undo (go back)
   */
  undo(storeName) {
    const history = this.histories.get(storeName);
    if (!history || history.currentIndex <= 0) {
      return null; // Can't undo
    }
    
    history.currentIndex--;
    const entry = history.entries[history.currentIndex];
    
    // Restore state
    globalStoreManager.setState(storeName, entry.state);
    
    console.log(`[StateHistory] Undo in ${storeName} to index ${history.currentIndex}`);
    
    return {
      state: entry.state,
      index: history.currentIndex,
      canUndo: history.currentIndex > 0,
      canRedo: history.currentIndex < history.entries.length - 1
    };
  }
  
  /**
   * Redo (go forward)
   */
  redo(storeName) {
    const history = this.histories.get(storeName);
    if (!history || history.currentIndex >= history.entries.length - 1) {
      return null; // Can't redo
    }
    
    history.currentIndex++;
    const entry = history.entries[history.currentIndex];
    
    // Restore state
    globalStoreManager.setState(storeName, entry.state);
    
    console.log(`[StateHistory] Redo in ${storeName} to index ${history.currentIndex}`);
    
    return {
      state: entry.state,
      index: history.currentIndex,
      canUndo: history.currentIndex > 0,
      canRedo: history.currentIndex < history.entries.length - 1
    };
  }
  
  /**
   * Jump to specific point in history
   */
  jumpTo(storeName, index) {
    const history = this.histories.get(storeName);
    if (!history || index < 0 || index >= history.entries.length) {
      return null;
    }
    
    history.currentIndex = index;
    const entry = history.entries[index];
    
    // Restore state
    globalStoreManager.setState(storeName, entry.state);
    
    console.log(`[StateHistory] Jump to index ${index} in ${storeName}`);
    
    return {
      state: entry.state,
      index: history.currentIndex,
      canUndo: history.currentIndex > 0,
      canRedo: history.currentIndex < history.entries.length - 1
    };
  }
  
  /**
   * Get history info
   */
  getHistoryInfo(storeName) {
    const history = this.histories.get(storeName);
    if (!history) return null;
    
    return {
      size: history.entries.length,
      currentIndex: history.currentIndex,
      canUndo: history.currentIndex > 0,
      canRedo: history.currentIndex < history.entries.length - 1,
      entries: history.entries.map((e, i) => ({
        index: i,
        timestamp: e.timestamp,
        description: e.description,
        isCurrent: i === history.currentIndex
      }))
    };
  }
  
  /**
   * Clear history
   */
  clearHistory(storeName) {
    const history = this.histories.get(storeName);
    if (!history) return;
    
    const currentState = globalStoreManager.getState(storeName);
    history.entries = [{
      state: JSON.parse(JSON.stringify(currentState)),
      timestamp: Date.now(),
      description: 'Reset'
    }];
    history.currentIndex = 0;
  }
  
  /**
   * Save snapshot
   */
  saveSnapshot(snapshotName, storeName) {
    const state = globalStoreManager.getState(storeName);
    const snapshot = {
      name: snapshotName,
      storeName: storeName,
      state: JSON.parse(JSON.stringify(state)),
      timestamp: Date.now()
    };
    
    this.snapshots.set(snapshotName, snapshot);
    
    console.log(`[StateHistory] Saved snapshot: ${snapshotName}`);
    
    return snapshot;
  }
  
  /**
   * Restore snapshot
   */
  restoreSnapshot(snapshotName) {
    const snapshot = this.snapshots.get(snapshotName);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotName}`);
    }
    
    globalStoreManager.setState(snapshot.storeName, snapshot.state);
    
    console.log(`[StateHistory] Restored snapshot: ${snapshotName}`);
    
    return snapshot;
  }
  
  /**
   * Export history (for debugging)
   */
  exportHistory(storeName) {
    const history = this.histories.get(storeName);
    if (!history) return null;
    
    return {
      storeName,
      entries: history.entries,
      currentIndex: history.currentIndex,
      exportedAt: Date.now()
    };
  }
  
  /**
   * Import history (for debugging)
   */
  importHistory(historyData) {
    const { storeName, entries, currentIndex } = historyData;
    
    // Stop current tracking
    this.stopTracking(storeName);
    
    // Create new history
    const history = {
      entries: entries,
      currentIndex: currentIndex,
      maxHistory: 50,
      trackKeys: [],
      unsubscribe: null
    };
    
    this.histories.set(storeName, history);
    
    // Restore to current index
    const entry = entries[currentIndex];
    globalStoreManager.setState(storeName, entry.state);
  }
}

const stateHistoryManager = new StateHistoryManager();

module.exports = { stateHistoryManager };
```

### State History Node (abbreviated)

```javascript
// statehistorynode.js

const { stateHistoryManager } = require('./statehistorymanager');

var StateHistoryNode = {
  name: 'net.noodl.StateHistory',
  displayNodeName: 'State History',
  category: 'Data',
  color: 'blue',
  
  initialize: function() {
    this._internal.tracking = false;
  },
  
  inputs: {
    storeName: {
      type: 'string',
      displayName: 'Store Name',
      default: 'app',
      set: function(value) {
        this._internal.storeName = value;
        this.startTracking();
      }
    },
    
    enabled: {
      type: 'boolean',
      displayName: 'Enabled',
      default: true,
      set: function(value) {
        if (value) {
          this.startTracking();
        } else {
          this.stopTracking();
        }
      }
    },
    
    maxHistory: {
      type: 'number',
      displayName: 'Max History',
      default: 50
    },
    
    clearHistory: {
      type: 'signal',
      displayName: 'Clear History',
      valueChangedToTrue: function() {
        stateHistoryManager.clearHistory(this._internal.storeName);
        this.updateOutputs();
      }
    }
  },
  
  outputs: {
    historySize: {
      type: 'number',
      displayName: 'History Size',
      getter: function() {
        const info = stateHistoryManager.getHistoryInfo(this._internal.storeName);
        return info ? info.size : 0;
      }
    },
    
    canUndo: {
      type: 'boolean',
      displayName: 'Can Undo',
      getter: function() {
        const info = stateHistoryManager.getHistoryInfo(this._internal.storeName);
        return info ? info.canUndo : false;
      }
    },
    
    canRedo: {
      type: 'boolean',
      displayName: 'Can Redo',
      getter: function() {
        const info = stateHistoryManager.getHistoryInfo(this._internal.storeName);
        return info ? info.canRedo : false;
      }
    }
  },
  
  methods: {
    startTracking: function() {
      if (this._internal.tracking) return;
      
      stateHistoryManager.trackStore(this._internal.storeName, {
        maxHistory: this._internal.maxHistory,
        trackKeys: this._internal.trackKeys
      });
      
      this._internal.tracking = true;
      this.updateOutputs();
    },
    
    stopTracking: function() {
      if (!this._internal.tracking) return;
      
      stateHistoryManager.stopTracking(this._internal.storeName);
      this._internal.tracking = false;
    },
    
    updateOutputs: function() {
      this.flagOutputDirty('historySize');
      this.flagOutputDirty('canUndo');
      this.flagOutputDirty('canRedo');
    }
  }
};
```

---

## Usage Examples

### Example 1: Undo Button

```
[Button: "Undo"] clicked
  ↓
[Undo]
  storeName: "app"
  undo signal
  ↓
[Undo] undone
  → [Show Toast] "Undone"
  
[State History] canUndo
  → [Button] disabled = !canUndo
```

### Example 2: Timeline Slider

```
[State History]
  storeName: "app"
  historySize → maxValue
  currentIndex → value
  
[Slider] value changed
  → [Undo] targetIndex
  → [Undo] jumpTo signal
  
// User can scrub through history!
```

### Example 3: Save/Restore Checkpoint

```
[Button: "Save Checkpoint"] clicked
  ↓
[State Snapshot]
  storeName: "app"
  snapshotName: "checkpoint-1"
  save
  
// Later...
[Button: "Restore Checkpoint"] clicked
  ↓
[State Snapshot]
  snapshotName: "checkpoint-1"
  restore
```

### Example 4: Debug Mode

```
// Dev tools panel
[State History] history
  → [Repeater] show each entry
  
[Entry] clicked
  → [Undo] jumpTo with entry.index
  
[Button: "Export History"]
  → [State History] exportHistory
  → [File Download] history.json
```

---

## Testing Checklist

### Functional Tests

- [ ] History tracks state changes
- [ ] Undo reverts to previous state
- [ ] Redo goes forward
- [ ] Jump to specific index works
- [ ] Max history limit enforced
- [ ] Clear history works
- [ ] Snapshots save/restore correctly
- [ ] Export/import preserves history

### Edge Cases

- [ ] Undo at beginning (no-op)
- [ ] Redo at end (no-op)
- [ ] Jump to invalid index
- [ ] Change state while not at end (truncate future)
- [ ] Track empty store
- [ ] Very rapid state changes
- [ ] Large state objects (>1MB)

### Performance

- [ ] No memory leaks with long history
- [ ] History doesn't slow down app
- [ ] Deep cloning doesn't block UI

---

## Documentation Requirements

### User-Facing Docs

Create: `docs/nodes/data/state-history.md`

```markdown
# State History

Add undo/redo and time travel to your app. Track state changes and let users go back in time.

## Use Cases

- **Undo Mistakes**: User accidentally deletes something
- **Debug Complex State**: Developer traces bug through history
- **A/B Testing**: Save state, test, restore to compare
- **Session Recovery**: Reload after crash

## Basic Usage

**Step 1: Track State**
```
[State History]
  storeName: "app"
  maxHistory: 50
```

**Step 2: Add Undo**
```
[Button: "Undo"] clicked
→ [Undo] storeName: "app", undo signal
```

**Step 3: Disable When Can't Undo**
```
[State History] canUndo
→ [Button] disabled = !canUndo
```

## Time Travel

Build a history slider:
```
[State History] history → entries
→ [Slider] 0 to historySize
→ value changed
→ [Undo] jumpTo
```

## Snapshots

Save points you can return to:
```
[State Snapshot] save → checkpoint
[State Snapshot] restore ← checkpoint
```

## Best Practices

1. **Limit history size**: 50 entries prevents memory issues
2. **Track only what you need**: Use trackKeys for large stores
3. **Disable in production**: Enable only for dev/debug
```

---

## Success Criteria

1. ✅ Undo/redo works reliably
2. ✅ History doesn't leak memory
3. ✅ Snapshots save/restore correctly
4. ✅ Export/import for debugging
5. ✅ Clear documentation
6. ✅ Optional enhancement for Erleah

---

## Future Enhancements

1. **Diff Viewer** - Show what changed between states
2. **Branching History** - Tree instead of linear
3. **Selective Undo** - Undo specific changes only
4. **Persistence** - Save history to localStorage
5. **Collaborative Undo** - Undo others' changes

---

## Dependencies

- AGENT-003 (Global State Store)

## Blocked By

- AGENT-003

## Blocks

- None (optional feature)

---

## Estimated Effort Breakdown

| Phase | Estimate | Description |
|-------|----------|-------------|
| History Manager | 0.5 day | Core tracking system |
| Undo/Redo Node | 0.5 day | Node implementation |
| Snapshot Node | 0.5 day | Save/restore system |
| Testing | 0.5 day | Edge cases, memory leaks |
| Documentation | 0.5 day | User docs, examples |

**Total: 2.5 days**

Buffer: None needed

**Final: 1-2 days** (if scope kept minimal)
