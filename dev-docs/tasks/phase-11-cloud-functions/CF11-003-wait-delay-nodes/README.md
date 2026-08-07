# CF11-003: Wait/Delay Nodes

## Metadata

| Field              | Value                                |
| ------------------ | ------------------------------------ |
| **ID**             | CF11-003                             |
| **Phase**          | Phase 11                             |
| **Series**         | 1 - Advanced Workflow Nodes          |
| **Priority**       | 🟢 Medium                            |
| **Difficulty**     | 🟢 Low                               |
| **Estimated Time** | 4-6 hours                            |
| **Prerequisites**  | Phase 5 TASK-007C (Workflow Runtime) |
| **Branch**         | `feature/cf11-003-delay-nodes`       |

## Objective

Create timing-related workflow nodes: Wait for explicit delays, Wait Until for scheduled execution, and debounce utilities - essential for rate limiting and scheduled workflows.

## Background

Workflows often need timing control:

- **Wait**: Pause execution for a duration (rate limiting APIs)
- **Wait Until**: Execute at a specific time (scheduled tasks)
- **Debounce**: Prevent rapid repeated execution

## Scope

### In Scope

- [ ] Wait Node (delay for X milliseconds)
- [ ] Wait Until Node (wait until specific time)
- [ ] Debounce Node (rate limit execution)

### Out of Scope

- Cron scheduling (handled by triggers)
- Throttle node (future)

## Technical Approach

### Wait Node

```typescript
const WaitNode = {
  name: 'Workflow Wait',
  displayName: 'Wait',
  category: 'Workflow Logic',

  inputs: {
    run: { type: 'signal' },
    duration: { type: 'number', displayName: 'Duration (ms)', default: 1000 },
    unit: {
      type: 'enum',
      options: ['milliseconds', 'seconds', 'minutes', 'hours'],
      default: 'milliseconds'
    }
  },

  outputs: {
    done: { type: 'signal', displayName: 'Done' }
  },

  async run(context) {
    let ms = context.inputs.duration || 1000;
    const unit = context.inputs.unit || 'milliseconds';

    // Convert to milliseconds
    const multipliers = {
      milliseconds: 1,
      seconds: 1000,
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000
    };
    ms = ms * (multipliers[unit] || 1);

    await new Promise((resolve) => setTimeout(resolve, ms));
    context.triggerOutput('done');
  }
};
```

### Wait Until Node

```typescript
const WaitUntilNode = {
  name: 'Workflow Wait Until',
  displayName: 'Wait Until',
  category: 'Workflow Logic',

  inputs: {
    run: { type: 'signal' },
    targetTime: { type: 'string', displayName: 'Target Time (ISO)' },
    targetDate: { type: 'date', displayName: 'Target Date' }
  },

  outputs: {
    done: { type: 'signal' },
    skipped: { type: 'signal', displayName: 'Already Passed' }
  },

  async run(context) {
    const target = context.inputs.targetDate || new Date(context.inputs.targetTime);
    const now = Date.now();
    const targetMs = target.getTime();

    if (targetMs <= now) {
      // Time already passed
      context.triggerOutput('skipped');
      return;
    }

    const waitTime = targetMs - now;
    await new Promise((resolve) => setTimeout(resolve, waitTime));
    context.triggerOutput('done');
  }
};
```

### Debounce Node

```typescript
const DebounceNode = {
  name: 'Workflow Debounce',
  displayName: 'Debounce',
  category: 'Workflow Logic',

  inputs: {
    run: { type: 'signal' },
    delay: { type: 'number', default: 500 }
  },

  outputs: {
    trigger: { type: 'signal' }
  },

  setup(context) {
    context._debounceTimer = null;
  },

  run(context) {
    if (context._debounceTimer) {
      clearTimeout(context._debounceTimer);
    }

    context._debounceTimer = setTimeout(() => {
      context.triggerOutput('trigger');
      context._debounceTimer = null;
    }, context.inputs.delay || 500);
  }
};
```

## Implementation Steps

1. **Wait Node (2h)** - Simple delay, unit conversion
2. **Wait Until Node (2h)** - Date parsing, time calculation
3. **Debounce Node (1h)** - Timer management
4. **Testing (1h)** - Unit tests

## Success Criteria

- [ ] Wait delays for specified duration
- [ ] Wait supports multiple time units
- [ ] Wait Until triggers at target time
- [ ] Wait Until handles past times gracefully
- [ ] Debounce prevents rapid triggers

## References

- [CF11-001 Logic Nodes](../CF11-001-logic-nodes/README.md)
- [n8n Wait Node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.wait/)
