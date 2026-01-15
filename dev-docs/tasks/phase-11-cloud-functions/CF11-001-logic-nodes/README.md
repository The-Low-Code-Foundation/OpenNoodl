# CF11-001: Logic Nodes (IF/Switch/ForEach/Merge)

## Metadata

| Field              | Value                                |
| ------------------ | ------------------------------------ |
| **ID**             | CF11-001                             |
| **Phase**          | Phase 11                             |
| **Series**         | 1 - Advanced Workflow Nodes          |
| **Priority**       | 🟡 High                              |
| **Difficulty**     | 🟡 Medium                            |
| **Estimated Time** | 12-16 hours                          |
| **Prerequisites**  | Phase 5 TASK-007C (Workflow Runtime) |
| **Branch**         | `feature/cf11-001-logic-nodes`       |

## Objective

Create advanced workflow logic nodes that enable conditional branching, multi-way routing, array iteration, and parallel execution paths - essential for building non-trivial automation workflows.

## Background

Current Noodl nodes are designed for UI and data flow but lack the control-flow constructs needed for workflow automation. To compete with n8n/Zapier, we need:

- **IF Node**: Route data based on conditions
- **Switch Node**: Multi-way branching (like a switch statement)
- **For Each Node**: Iterate over arrays
- **Merge Node**: Combine multiple execution paths

## Current State

- Basic condition node exists but isn't suited for workflows
- No iteration nodes
- No way to merge parallel execution paths

## Desired State

- IF node with visual expression builder
- Switch node with multiple case outputs
- For Each node for array iteration
- Merge node to combine paths
- All nodes work in CloudRunner workflow context

## Scope

### In Scope

- [ ] IF Node implementation
- [ ] Switch Node implementation
- [ ] For Each Node implementation
- [ ] Merge Node implementation
- [ ] Property editor integrations
- [ ] CloudRunner execution support

### Out of Scope

- UI runtime nodes (frontend-only)
- Visual expression builder (can use existing or defer)

## Technical Approach

### IF Node

Routes execution based on a boolean condition.

```typescript
// packages/noodl-viewer-cloud/src/nodes/logic/IfNode.ts

const IfNode = {
  name: 'Workflow IF',
  displayName: 'IF',
  category: 'Workflow Logic',
  color: 'logic',

  inputs: {
    condition: {
      type: 'boolean',
      displayName: 'Condition',
      description: 'Boolean expression to evaluate'
    },
    data: {
      type: '*',
      displayName: 'Data',
      description: 'Data to pass through'
    },
    run: {
      type: 'signal',
      displayName: 'Run',
      description: 'Trigger to evaluate condition'
    }
  },

  outputs: {
    onTrue: {
      type: 'signal',
      displayName: 'True',
      description: 'Triggered when condition is true'
    },
    onFalse: {
      type: 'signal',
      displayName: 'False',
      description: 'Triggered when condition is false'
    },
    data: {
      type: '*',
      displayName: 'Data',
      description: 'Pass-through data'
    }
  },

  run(context) {
    const condition = context.inputs.condition;
    context.outputs.data = context.inputs.data;

    if (condition) {
      context.triggerOutput('onTrue');
    } else {
      context.triggerOutput('onFalse');
    }
  }
};
```

### Switch Node

Routes to one of multiple outputs based on value matching.

```typescript
// packages/noodl-viewer-cloud/src/nodes/logic/SwitchNode.ts

const SwitchNode = {
  name: 'Workflow Switch',
  displayName: 'Switch',
  category: 'Workflow Logic',
  color: 'logic',

  inputs: {
    value: {
      type: '*',
      displayName: 'Value',
      description: 'Value to switch on'
    },
    data: {
      type: '*',
      displayName: 'Data'
    },
    run: {
      type: 'signal',
      displayName: 'Run'
    }
  },

  outputs: {
    default: {
      type: 'signal',
      displayName: 'Default',
      description: 'Triggered if no case matches'
    },
    data: {
      type: '*',
      displayName: 'Data'
    }
  },

  // Dynamic outputs for cases - configured via property panel
  dynamicports: {
    outputs: {
      cases: {
        type: 'signal'
        // Generated from cases array: case_0, case_1, etc.
      }
    }
  },

  setup(context) {
    // Register cases from configuration
    const cases = context.parameters.cases || [];
    cases.forEach((caseValue, index) => {
      context.registerOutput(`case_${index}`, {
        type: 'signal',
        displayName: `Case: ${caseValue}`
      });
    });
  },

  run(context) {
    const value = context.inputs.value;
    const cases = context.parameters.cases || [];
    context.outputs.data = context.inputs.data;

    const matchIndex = cases.indexOf(value);
    if (matchIndex >= 0) {
      context.triggerOutput(`case_${matchIndex}`);
    } else {
      context.triggerOutput('default');
    }
  }
};
```

### For Each Node

Iterates over an array, executing the output for each item.

```typescript
// packages/noodl-viewer-cloud/src/nodes/logic/ForEachNode.ts

const ForEachNode = {
  name: 'Workflow For Each',
  displayName: 'For Each',
  category: 'Workflow Logic',
  color: 'logic',

  inputs: {
    items: {
      type: 'array',
      displayName: 'Items',
      description: 'Array to iterate over'
    },
    run: {
      type: 'signal',
      displayName: 'Run'
    }
  },

  outputs: {
    iteration: {
      type: 'signal',
      displayName: 'For Each Item',
      description: 'Triggered for each item'
    },
    currentItem: {
      type: '*',
      displayName: 'Current Item'
    },
    currentIndex: {
      type: 'number',
      displayName: 'Index'
    },
    completed: {
      type: 'signal',
      displayName: 'Completed',
      description: 'Triggered when iteration is complete'
    },
    allResults: {
      type: 'array',
      displayName: 'Results',
      description: 'Collected results from all iterations'
    }
  },

  async run(context) {
    const items = context.inputs.items || [];
    const results = [];

    for (let i = 0; i < items.length; i++) {
      context.outputs.currentItem = items[i];
      context.outputs.currentIndex = i;

      // Trigger and wait for downstream to complete
      const result = await context.triggerOutputAndWait('iteration');
      if (result !== undefined) {
        results.push(result);
      }
    }

    context.outputs.allResults = results;
    context.triggerOutput('completed');
  }
};
```

### Merge Node

Waits for all input paths before continuing.

```typescript
// packages/noodl-viewer-cloud/src/nodes/logic/MergeNode.ts

const MergeNode = {
  name: 'Workflow Merge',
  displayName: 'Merge',
  category: 'Workflow Logic',
  color: 'logic',

  inputs: {
    // Dynamic inputs based on configuration
  },

  outputs: {
    merged: {
      type: 'signal',
      displayName: 'Merged',
      description: 'Triggered when all inputs received'
    },
    data: {
      type: 'object',
      displayName: 'Data',
      description: 'Combined data from all inputs'
    }
  },

  dynamicports: {
    inputs: {
      branches: {
        type: 'signal'
        // Generated: branch_0, branch_1, etc.
      },
      branchData: {
        type: '*'
        // Generated: data_0, data_1, etc.
      }
    }
  },

  setup(context) {
    const branchCount = context.parameters.branchCount || 2;
    context._receivedBranches = new Set();
    context._branchData = {};

    for (let i = 0; i < branchCount; i++) {
      context.registerInput(`branch_${i}`, {
        type: 'signal',
        displayName: `Branch ${i + 1}`
      });
      context.registerInput(`data_${i}`, {
        type: '*',
        displayName: `Data ${i + 1}`
      });
    }
  },

  onInputChange(context, inputName, value) {
    if (inputName.startsWith('branch_')) {
      const index = parseInt(inputName.split('_')[1]);
      context._receivedBranches.add(index);
      context._branchData[index] = context.inputs[`data_${index}`];

      const branchCount = context.parameters.branchCount || 2;
      if (context._receivedBranches.size >= branchCount) {
        context.outputs.data = { ...context._branchData };
        context.triggerOutput('merged');

        // Reset for next execution
        context._receivedBranches.clear();
        context._branchData = {};
      }
    }
  }
};
```

### Key Files to Create

| File                         | Purpose                  |
| ---------------------------- | ------------------------ |
| `nodes/logic/IfNode.ts`      | IF node definition       |
| `nodes/logic/SwitchNode.ts`  | Switch node definition   |
| `nodes/logic/ForEachNode.ts` | For Each node definition |
| `nodes/logic/MergeNode.ts`   | Merge node definition    |
| `nodes/logic/index.ts`       | Module exports           |
| `tests/logic-nodes.test.ts`  | Unit tests               |

## Implementation Steps

### Step 1: IF Node (3h)

1. Create node definition
2. Implement run logic
3. Add to node registry
4. Test with CloudRunner

### Step 2: Switch Node (4h)

1. Create node with dynamic ports
2. Implement case matching logic
3. Property editor for case configuration
4. Test edge cases

### Step 3: For Each Node (4h)

1. Create node definition
2. Implement async iteration
3. Handle `triggerOutputAndWait` pattern
4. Test with arrays and objects

### Step 4: Merge Node (3h)

1. Create node with dynamic inputs
2. Implement branch tracking
3. Handle reset logic
4. Test parallel paths

### Step 5: Integration & Testing (2h)

1. Register all nodes
2. Integration tests
3. Manual testing in editor

## Testing Plan

### Unit Tests

- [ ] IF Node routes correctly on true/false
- [ ] Switch Node matches correct case
- [ ] Switch Node triggers default when no match
- [ ] For Each iterates all items
- [ ] For Each handles empty arrays
- [ ] For Each collects results
- [ ] Merge waits for all branches
- [ ] Merge combines data correctly

### Integration Tests

- [ ] IF → downstream nodes execute correctly
- [ ] Switch → multiple paths work
- [ ] For Each → nested workflows work
- [ ] Merge → parallel execution converges

## Success Criteria

- [ ] IF Node works in CloudRunner
- [ ] Switch Node with dynamic cases works
- [ ] For Each iterates and collects results
- [ ] Merge combines parallel paths
- [ ] All nodes appear in node picker
- [ ] Property panels work correctly
- [ ] All tests pass

## Risks & Mitigations

| Risk                     | Mitigation                              |
| ------------------------ | --------------------------------------- |
| For Each performance     | Limit max iterations, batch if needed   |
| Merge race conditions    | Use Set for tracking, atomic operations |
| Dynamic ports complexity | Follow existing patterns from BYOB      |

## References

- [Node Patterns Guide](../../../reference/NODE-PATTERNS.md)
- [LEARNINGS-NODE-CREATION](../../../reference/LEARNINGS-NODE-CREATION.md)
- [n8n IF Node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.if/) - Reference
