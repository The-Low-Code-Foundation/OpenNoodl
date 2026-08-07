# CF11-002: Error Handling Nodes (Try/Catch/Retry)

## Metadata

| Field              | Value                                |
| ------------------ | ------------------------------------ |
| **ID**             | CF11-002                             |
| **Phase**          | Phase 11                             |
| **Series**         | 1 - Advanced Workflow Nodes          |
| **Priority**       | 🟡 High                              |
| **Difficulty**     | 🟡 Medium                            |
| **Estimated Time** | 8-10 hours                           |
| **Prerequisites**  | Phase 5 TASK-007C (Workflow Runtime) |
| **Branch**         | `feature/cf11-002-error-nodes`       |

## Objective

Create error handling nodes for workflows: Try/Catch for graceful error recovery and Retry for transient failure handling - critical for building reliable automation.

## Background

External API calls fail. Databases timeout. Services go down. Production workflows need error handling:

- **Try/Catch**: Wrap operations and handle failures gracefully
- **Retry**: Automatically retry failed operations with configurable backoff
- **Stop/Error**: Explicitly fail a workflow with a message

Without these, any external failure crashes the entire workflow.

## Scope

### In Scope

- [ ] Try/Catch Node implementation
- [ ] Retry Node implementation
- [ ] Stop/Error Node implementation
- [ ] Configurable retry strategies

### Out of Scope

- Global error handlers (future)
- Error reporting/alerting (future)

## Technical Approach

### Try/Catch Node

```typescript
const TryCatchNode = {
  name: 'Workflow Try Catch',
  displayName: 'Try / Catch',
  category: 'Workflow Logic',

  inputs: {
    run: { type: 'signal', displayName: 'Try' }
  },

  outputs: {
    try: { type: 'signal', displayName: 'Try Block' },
    catch: { type: 'signal', displayName: 'Catch Block' },
    finally: { type: 'signal', displayName: 'Finally' },
    error: { type: 'object', displayName: 'Error' },
    success: { type: 'boolean', displayName: 'Success' }
  },

  async run(context) {
    try {
      await context.triggerOutputAndWait('try');
      context.outputs.success = true;
    } catch (error) {
      context.outputs.error = { message: error.message, stack: error.stack };
      context.outputs.success = false;
      context.triggerOutput('catch');
    } finally {
      context.triggerOutput('finally');
    }
  }
};
```

### Retry Node

```typescript
const RetryNode = {
  name: 'Workflow Retry',
  displayName: 'Retry',
  category: 'Workflow Logic',

  inputs: {
    run: { type: 'signal' },
    maxAttempts: { type: 'number', default: 3 },
    delayMs: { type: 'number', default: 1000 },
    backoffMultiplier: { type: 'number', default: 2 }
  },

  outputs: {
    attempt: { type: 'signal', displayName: 'Attempt' },
    success: { type: 'signal' },
    failure: { type: 'signal' },
    attemptNumber: { type: 'number' },
    lastError: { type: 'object' }
  },

  async run(context) {
    const maxAttempts = context.inputs.maxAttempts || 3;
    const baseDelay = context.inputs.delayMs || 1000;
    const multiplier = context.inputs.backoffMultiplier || 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      context.outputs.attemptNumber = attempt;

      try {
        await context.triggerOutputAndWait('attempt');
        context.triggerOutput('success');
        return;
      } catch (error) {
        context.outputs.lastError = { message: error.message };

        if (attempt < maxAttempts) {
          const delay = baseDelay * Math.pow(multiplier, attempt - 1);
          await sleep(delay);
        }
      }
    }

    context.triggerOutput('failure');
  }
};
```

### Stop/Error Node

```typescript
const StopNode = {
  name: 'Workflow Stop',
  displayName: 'Stop / Error',
  category: 'Workflow Logic',

  inputs: {
    run: { type: 'signal' },
    errorMessage: { type: 'string', default: 'Workflow stopped' },
    isError: { type: 'boolean', default: true }
  },

  run(context) {
    const message = context.inputs.errorMessage || 'Workflow stopped';
    if (context.inputs.isError) {
      throw new WorkflowError(message);
    }
    // Non-error stop - just terminates this path
  }
};
```

## Implementation Steps

1. **Try/Catch Node (3h)** - Error boundary, output routing
2. **Retry Node (3h)** - Attempt loop, backoff logic, timeout handling
3. **Stop/Error Node (1h)** - Simple error throwing
4. **Testing (2h)** - Unit tests, integration tests

## Success Criteria

- [ ] Try/Catch captures downstream errors
- [ ] Retry attempts with exponential backoff
- [ ] Stop/Error terminates workflow with message
- [ ] Error data captured in execution history

## References

- [CF11-001 Logic Nodes](../CF11-001-logic-nodes/README.md) - Same patterns
- [n8n Error Handling](https://docs.n8n.io/flow-logic/error-handling/)
