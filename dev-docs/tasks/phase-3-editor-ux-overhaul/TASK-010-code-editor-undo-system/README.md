# TASK-010: Code Editor Undo/Versioning System

**Status:** 📝 Planned  
**Priority:** Medium  
**Estimated Effort:** 2-3 days  
**Dependencies:** TASK-009 (Monaco Replacement)

---

## Problem Statement

When editing code in Expression/Function/Script nodes, users cannot:

- Undo changes after saving and closing the editor
- Roll back to previous working versions when code breaks
- See a history of code changes
- Compare versions

This leads to frustration when:

- A working expression gets accidentally modified
- Code is saved with a typo that breaks functionality
- Users want to experiment but fear losing working code

---

## Proposed Solution

### Auto-Snapshot System

Implement automatic code snapshots that are:

1. **Saved on every successful save** (not on every keystroke)
2. **Stored per-node** (each node has its own history)
3. **Time-stamped** (know when each version was created)
4. **Limited** (keep last N versions to avoid bloat)

### User Interface

**Option A: Simple History Dropdown**

```
Code Editor Toolbar:
┌─────────────────────────────────────┐
│ Expression  ✓ Valid  [History ▼]   │
│                      [Format] [Save]│
└─────────────────────────────────────┘

History dropdown:
┌─────────────────────────────────┐
│ ✓ Current (just now)            │
│ • 5 minutes ago                 │
│ • 1 hour ago                    │
│ • Yesterday at 3:15 PM          │
│ • 2 days ago                    │
└─────────────────────────────────┘
```

**Option B: Side Panel**

```
┌────────────────┬──────────────────┐
│ History        │ Code             │
│                │                  │
│ ✓ Current      │ const x = 1;     │
│                │ return x + 2;    │
│ • 5 min ago    │                  │
│ • 1 hour ago   │                  │
│ • Yesterday    │                  │
│                │                  │
│ [Compare]      │ [Format] [Save]  │
└────────────────┴──────────────────┘
```

---

## Technical Architecture

### Data Storage

**Storage Location:** Project file (under each node)

```json
{
  "nodes": [
    {
      "id": "node-123",
      "type": "Expression",
      "parameters": {
        "code": "a + b", // Current code
        "codeHistory": [
          // NEW: History array
          {
            "code": "a + b",
            "timestamp": "2024-12-31T22:00:00Z",
            "hash": "abc123" // For deduplication
          },
          {
            "code": "a + b + c",
            "timestamp": "2024-12-31T21:00:00Z",
            "hash": "def456"
          }
        ]
      }
    }
  ]
}
```

### Snapshot Logic

```typescript
class CodeHistoryManager {
  /**
   * Take a snapshot of current code
   */
  saveSnapshot(nodeId: string, code: string): void {
    const hash = this.hashCode(code);
    const lastSnapshot = this.getLastSnapshot(nodeId);

    // Only save if code actually changed
    if (lastSnapshot?.hash === hash) {
      return;
    }

    const snapshot = {
      code,
      timestamp: new Date().toISOString(),
      hash
    };

    this.addSnapshot(nodeId, snapshot);
    this.pruneOldSnapshots(nodeId); // Keep only last N
  }

  /**
   * Restore from a snapshot
   */
  restoreSnapshot(nodeId: string, timestamp: string): string {
    const snapshot = this.getSnapshot(nodeId, timestamp);
    return snapshot.code;
  }

  /**
   * Keep only last N snapshots
   */
  private pruneOldSnapshots(nodeId: string, maxSnapshots = 20): void {
    // Keep most recent 20 snapshots
    // Older ones are deleted to avoid project file bloat
  }
}
```

### Integration Points

**1. Save Hook**

```typescript
// In CodeEditorType.ts → save()
function save() {
  let source = _this.model.getValue();
  if (source === '') source = undefined;

  // NEW: Save snapshot before updating
  CodeHistoryManager.instance.saveSnapshot(nodeId, source);

  _this.value = source;
  _this.parent.setParameter(scope.name, source !== _this.default ? source : undefined);
  _this.isDefault = source === undefined;
}
```

**2. UI Component**

```tsx
// New component: CodeHistoryButton
function CodeHistoryButton({ nodeId, onRestore }) {
  const history = CodeHistoryManager.instance.getHistory(nodeId);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={css.HistoryButton}>
      <button onClick={() => setIsOpen(!isOpen)}>History ({history.length})</button>
      {isOpen && (
        <HistoryDropdown
          history={history}
          onSelect={(snapshot) => {
            onRestore(snapshot.code);
            setIsOpen(false);
          }}
        />
      )}
    </div>
  );
}
```

---

## Implementation Plan

### Phase 1: Data Layer (Day 1)

- [ ] Create `CodeHistoryManager` class
- [ ] Implement snapshot save/restore logic
- [ ] Add history storage to project model
- [ ] Implement pruning (keep last 20 snapshots)
- [ ] Add unit tests

### Phase 2: UI Integration (Day 2)

- [ ] Add History button to JavaScriptEditor toolbar
- [ ] Create HistoryDropdown component
- [ ] Implement restore functionality
- [ ] Add confirmation dialog ("Restore to version from X?")
- [ ] Test with real projects

### Phase 3: Polish (Day 3)

- [ ] Add visual diff preview (show what changed)
- [ ] Add keyboard shortcut (Cmd+H for history?)
- [ ] Improve timestamp formatting ("5 minutes ago", "Yesterday")
- [ ] Add loading states
- [ ] Documentation

### Phase 4: Advanced Features (Optional)

- [ ] Compare two versions side-by-side
- [ ] Add version labels/tags ("working version")
- [ ] Export/import history
- [ ] Merge functionality

---

## User Experience

### Happy Path

1. User edits code in Expression node
2. Clicks Save (or Cmd+S)
3. Snapshot is automatically taken
4. Later, user realizes code is broken
5. Opens History dropdown
6. Sees "5 minutes ago" version
7. Clicks to restore
8. Code is back to working state!

### Edge Cases

- **Empty history:** Show "No previous versions"
- **Identical code:** Don't create duplicate snapshots
- **Large code:** Warn if code >10KB (rare for expressions)
- **Project file size:** Pruning keeps it manageable

---

## Benefits

✅ **Safety net** - Never lose working code  
✅ **Experimentation** - Try changes without fear  
✅ **Debugging** - Roll back to find when it broke  
✅ **Learning** - See how code evolved  
✅ **Confidence** - Users feel more secure

---

## Risks & Mitigations

| Risk               | Mitigation                              |
| ------------------ | --------------------------------------- |
| Project file bloat | Prune to 20 snapshots, store compressed |
| Performance impact | Async save, throttle snapshots          |
| Confusing UI       | Clear timestamps, preview diffs         |
| Data corruption    | Validate snapshots on load              |

---

## Success Metrics

- [ ] Users can restore previous versions
- [ ] No noticeable performance impact
- [ ] Project file size increase <5%
- [ ] Positive user feedback
- [ ] Zero data loss incidents

---

## Future Enhancements

- Cloud sync of history (if/when cloud features added)
- Branch/merge for code variations
- Collaborative editing history
- AI-powered "suggest fix" based on history

---

**Next Action:** Implement Phase 1 data layer after TASK-009 is complete and stable.
