# UndoQueue Usage Patterns

This guide documents the correct patterns for using OpenNoodl's undo system.

---

## Overview

The OpenNoodl undo system consists of two main classes:

- **`UndoQueue`**: Manages the global undo/redo stack
- **`UndoActionGroup`**: Represents a single undoable action (or group of actions)

### Critical Bug Warning

There's a subtle but dangerous bug in `UndoActionGroup` that causes silent failures. This guide will show you the **correct patterns** that avoid this bug.

---

## The Golden Rule

**✅ ALWAYS USE: `UndoQueue.instance.pushAndDo(new UndoActionGroup({...}))`**

**❌ NEVER USE: `undoGroup.push({...}); undoGroup.do();`**

Why? The second pattern fails silently due to an internal pointer bug. See [LEARNINGS.md](./LEARNINGS.md#-critical-undoactiongroupdo-silent-failure-dec-2025) for full technical details.

---

## Pattern 1: Simple Single Action (Recommended)

This is the most common pattern and should be used for 95% of cases.

```typescript
import { ProjectModel } from '@noodl-models/projectmodel';
import { UndoQueue, UndoActionGroup } from '@noodl-models/undo-queue-model';

function renameComponent(component: ComponentModel, newName: string) {
  const oldName = component.name;

  // ✅ CORRECT - Action executes immediately and is added to undo stack
  UndoQueue.instance.pushAndDo(
    new UndoActionGroup({
      label: `Rename ${component.localName} to ${newName}`,
      do: () => {
        ProjectModel.instance.renameComponent(component, newName);
      },
      undo: () => {
        ProjectModel.instance.renameComponent(component, oldName);
      }
    })
  );
}
```

**What happens:**

1. `UndoActionGroup` is created with action in constructor (ptr = 0)
2. `pushAndDo()` adds it to the queue
3. `pushAndDo()` calls `action.do()` which executes immediately
4. User can now undo with Cmd+Z

---

## Pattern 2: Multiple Related Actions

When you need multiple actions in a single undo group:

```typescript
function moveFolder(sourcePath: string, targetPath: string) {
  const componentsToMove = ProjectModel.instance
    .getComponents()
    .filter((comp) => comp.name.startsWith(sourcePath + '/'));

  const renames: Array<{ component: ComponentModel; oldName: string; newName: string }> = [];

  componentsToMove.forEach((comp) => {
    const relativePath = comp.name.substring(sourcePath.length);
    const newName = targetPath + relativePath;
    renames.push({ component: comp, oldName: comp.name, newName });
  });

  // ✅ CORRECT - Single undo group for multiple related actions
  UndoQueue.instance.pushAndDo(
    new UndoActionGroup({
      label: `Move folder ${sourcePath} to ${targetPath}`,
      do: () => {
        renames.forEach(({ component, newName }) => {
          ProjectModel.instance.renameComponent(component, newName);
        });
      },
      undo: () => {
        renames.forEach(({ component, oldName }) => {
          ProjectModel.instance.renameComponent(component, oldName);
        });
      }
    })
  );
}
```

**What happens:**

- All renames execute as one operation
- Single undo reverts all changes
- Clean, atomic operation

---

## Pattern 3: Building Complex Undo Groups (Advanced)

Sometimes you need to build undo groups dynamically. Use `pushAndDo` on the group itself:

```typescript
function complexOperation() {
  const undoGroup = new UndoActionGroup({ label: 'Complex operation' });

  // Add to queue first
  UndoQueue.instance.push(undoGroup);

  // ✅ CORRECT - Use pushAndDo on the group, not push + do
  undoGroup.pushAndDo({
    do: () => {
      console.log('First action executes');
      // ... do first thing
    },
    undo: () => {
      // ... undo first thing
    }
  });

  // Another action
  undoGroup.pushAndDo({
    do: () => {
      console.log('Second action executes');
      // ... do second thing
    },
    undo: () => {
      // ... undo second thing
    }
  });
}
```

**Key Point**: Use `undoGroup.pushAndDo()`, NOT `undoGroup.push()` + `undoGroup.do()`

---

## Anti-Pattern: What NOT to Do

This pattern looks correct but **fails silently**:

```typescript
// ❌ WRONG - DO NOT USE
function badRename(component: ComponentModel, newName: string) {
  const oldName = component.name;

  const undoGroup = new UndoActionGroup({
    label: `Rename to ${newName}`
  });

  UndoQueue.instance.push(undoGroup);

  undoGroup.push({
    do: () => {
      ProjectModel.instance.renameComponent(component, newName);
      // ☠️ THIS NEVER RUNS ☠️
    },
    undo: () => {
      ProjectModel.instance.renameComponent(component, oldName);
    }
  });

  undoGroup.do(); // Loop condition is already false

  // Result:
  // - Function returns successfully ✅
  // - Undo/redo stack is populated ✅
  // - But the action NEVER executes ❌
  // - Component name doesn't change ❌
}
```

**Why it fails:**

1. `undoGroup.push()` increments internal `ptr` to `actions.length`
2. `undoGroup.do()` loops from `ptr` to `actions.length`
3. Since they're equal, loop never runs
4. Action is recorded but never executed

---

## Pattern Comparison Table

| Pattern                                                         | Executes? | Undoable? | Use Case                       |
| --------------------------------------------------------------- | --------- | --------- | ------------------------------ |
| `UndoQueue.instance.pushAndDo(new UndoActionGroup({do, undo}))` | ✅ Yes    | ✅ Yes    | **Use this 95% of the time**   |
| `undoGroup.pushAndDo({do, undo})`                               | ✅ Yes    | ✅ Yes    | Building complex groups        |
| `UndoQueue.instance.push(undoGroup); undoGroup.do()`            | ❌ No     | ⚠️ Yes\*  | **Never use - silent failure** |
| `undoGroup.push({do, undo}); undoGroup.do()`                    | ❌ No     | ⚠️ Yes\*  | **Never use - silent failure** |

\* Undo/redo works only if action is manually triggered first

---

## Debugging Tips

If your undo action isn't executing:

### 1. Add Debug Logging

```typescript
UndoQueue.instance.pushAndDo(
  new UndoActionGroup({
    label: 'My Action',
    do: () => {
      console.log('🔥 ACTION EXECUTING'); // Should print immediately
      // ... your action
    },
    undo: () => {
      console.log('↩️ ACTION UNDOING');
      // ... undo logic
    }
  })
);
```

If `🔥 ACTION EXECUTING` doesn't print, you have the `push + do` bug.

### 2. Check Your Pattern

Search your code for:

```typescript
undoGroup.push(
undoGroup.do(
```

If you find this pattern, you have the bug. Replace with `pushAndDo`.

### 3. Verify Success

After your action:

```typescript
// Should see immediate result
console.log('New name:', component.name); // Should be changed
```

---

## Migration Guide

If you have existing code using the broken pattern:

### Before (Broken):

```typescript
const undoGroup = new UndoActionGroup({ label: 'Action' });
UndoQueue.instance.push(undoGroup);
undoGroup.push({ do: () => {...}, undo: () => {...} });
undoGroup.do();
```

### After (Fixed):

```typescript
UndoQueue.instance.pushAndDo(
  new UndoActionGroup({
    label: 'Action',
    do: () => {...},
    undo: () => {...}
  })
);
```

---

## Real-World Examples

### Example 1: Component Deletion

```typescript
function deleteComponent(component: ComponentModel) {
  const componentJson = component.toJSON(); // Save for undo

  UndoQueue.instance.pushAndDo(
    new UndoActionGroup({
      label: `Delete ${component.name}`,
      do: () => {
        ProjectModel.instance.removeComponent(component);
      },
      undo: () => {
        const restored = ComponentModel.fromJSON(componentJson);
        ProjectModel.instance.addComponent(restored);
      }
    })
  );
}
```

### Example 2: Node Property Change

```typescript
function setNodeProperty(node: NodeGraphNode, propertyName: string, newValue: any) {
  const oldValue = node.parameters[propertyName];

  UndoQueue.instance.pushAndDo(
    new UndoActionGroup({
      label: `Change ${propertyName}`,
      do: () => {
        node.setParameter(propertyName, newValue);
      },
      undo: () => {
        node.setParameter(propertyName, oldValue);
      }
    })
  );
}
```

### Example 3: Drag and Drop (Multiple Items)

```typescript
function moveComponents(components: ComponentModel[], targetFolder: string) {
  const moves = components.map((comp) => ({
    component: comp,
    oldPath: comp.name,
    newPath: `${targetFolder}/${comp.localName}`
  }));

  UndoQueue.instance.pushAndDo(
    new UndoActionGroup({
      label: `Move ${components.length} components`,
      do: () => {
        moves.forEach(({ component, newPath }) => {
          ProjectModel.instance.renameComponent(component, newPath);
        });
      },
      undo: () => {
        moves.forEach(({ component, oldPath }) => {
          ProjectModel.instance.renameComponent(component, oldPath);
        });
      }
    })
  );
}
```

---

## See Also

- [LEARNINGS.md](./LEARNINGS.md#-critical-undoactiongroupdo-silent-failure-dec-2025) - Full technical explanation of the bug
- [COMMON-ISSUES.md](./COMMON-ISSUES.md) - Troubleshooting guide
- `packages/noodl-editor/src/editor/src/models/undo-queue-model.ts` - Source code

---

**Last Updated**: December 2025 (Phase 0 Foundation Stabilization)
