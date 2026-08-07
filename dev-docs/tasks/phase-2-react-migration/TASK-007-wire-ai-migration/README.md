# TASK-007: Wire AI Migration Backend

## Metadata

| Field              | Value                        |
| ------------------ | ---------------------------- |
| **ID**             | TASK-007                     |
| **Phase**          | Phase 2                      |
| **Priority**       | 🟠 High                      |
| **Difficulty**     | 🟡 Medium                    |
| **Estimated Time** | 3-4 hours                    |
| **Prerequisites**  | TASK-004 (complete)          |
| **Branch**         | `task/007-wire-ai-migration` |

## Objective

Connect the fully-built AI migration infrastructure (AIMigrationOrchestrator, ClaudeClient, BudgetController) to the MigrationSession's `executeAIAssistedPhase()` stub to enable end-to-end AI-powered component migration.

## Background

TASK-004 implemented a comprehensive React 19 migration system with optional AI assistance. During development, all the AI infrastructure components were built and tested:

- **ClaudeClient**: Handles Anthropic API communication with proper prompt engineering
- **BudgetController**: Manages spending limits, pause increments, and approval flow
- **AIMigrationOrchestrator**: Coordinates component migration with retry logic, verification, and decision points
- **AIConfigPanel**: UI for configuring API key, budget, and preferences
- **BudgetApprovalDialog**: UI for budget pause confirmations
- **keyStorage**: Encrypted API key storage with Electron safeStorage

However, the actual integration point in `MigrationSession.executeAIAssistedPhase()` was intentionally left as a stub with a TODO comment. This was done to:

1. Allow the UI and scanning flow to be tested independently
2. Avoid consuming API credits during development
3. Defer the wiring work to a focused integration task

**Current Behavior:**
When a user clicks "Migrate with AI", the system:

- Immediately marks all `needsReview` components as "AI migration not yet implemented"
- Completes the migration instantly without calling Claude
- Logs warnings instead of performing actual migrations

**The Problem:**
Users who configure an API key and budget cannot actually use AI migration, making the entire AI feature non-functional.

## Current State

### Working Components

- ✅ AI configuration UI (AIConfigPanel)
- ✅ API key validation and encrypted storage
- ✅ Budget configuration UI
- ✅ ClaudeClient with prompt engineering
- ✅ BudgetController with spending tracking
- ✅ AIMigrationOrchestrator with retry logic
- ✅ BudgetApprovalDialog component
- ✅ Scan results correctly identify `needsReview` components

### Non-Working Code Path

- ❌ `MigrationSession.executeAIAssistedPhase()` is a stub (lines ~500-520)
- ❌ Orchestrator never initialized
- ❌ Claude API never called
- ❌ Budget approval dialog never shown
- ❌ Decision dialog for failed retries doesn't exist
- ❌ Migrated code never written to target files

### Current Stub Implementation

```typescript
private async executeAIAssistedPhase(): Promise<void> {
  if (!this.session?.scan || !this.session.ai?.enabled) return;

  this.updateProgress({ phase: 'ai-assisted' });
  this.addLogEntry({
    level: 'info',
    message: 'Starting AI-assisted migration...'
  });

  const { needsReview } = this.session.scan.categories;

  for (let i = 0; i < needsReview.length; i++) {
    const component = needsReview[i];

    this.updateProgress({
      currentComponent: component.name
    });

    // TODO: Implement actual AI migration using Claude API
    await this.simulateDelay(200);

    this.addLogEntry({
      level: 'warning',
      component: component.name,
      message: 'AI migration not yet implemented - marked for manual review'
    });
  }
}
```

## Desired State

When a user clicks "Migrate with AI" after configuring their API key and budget:

1. **Orchestrator Initialization**: AIMigrationOrchestrator is created with the user's API key and budget settings
2. **Component Processing**: Each `needsReview` component is sent to Claude for migration
3. **Budget Pauses**: BudgetApprovalDialog appears when spending reaches pause increments
4. **Retry Logic**: Failed migrations are automatically retried with different approaches
5. **Decision Points**: After max retries, user chooses to retry, skip, get help, or accept partial result
6. **Result Application**: Successfully migrated code is written to target files
7. **Accurate Reporting**: Final counts reflect actual migration outcomes, not stubs

### User Experience Flow

```
[Click "Migrate with AI"]
  ↓
[Orchestrator initializes]
  ↓
[For each component needing AI:]
  ├─ Read source code from original location
  ├─ Send to Claude with migration request
  ├─ [Budget pause?] → Show BudgetApprovalDialog
  ├─ [Success?] → Write migrated code to target
  └─ [Failed after retries?] → Show DecisionDialog
  ↓
[Display accurate results]
```

## Scope

### In Scope

- [x] Initialize AIMigrationOrchestrator in `executeAIAssistedPhase()`
- [x] Read source code for each `needsReview` component
- [x] Call `orchestrator.migrateComponent()` with proper callbacks
- [x] Implement `onBudgetPause` callback to show approval dialog
- [x] Implement `onDecisionRequired` callback for retry decisions
- [x] Create DecisionDialog component for failed migrations
- [x] Write successful migrations to target files
- [x] Update progress log with real results
- [x] Track actual budget spending
- [x] Handle orchestrator abort on session cancel

### Out of Scope

- Improving Claude prompts (already done in TASK-004)
- Changing budget UI (already done in TASK-004)
- Adding new migration strategies (orchestrator already supports them)
- Changing the scan logic (TASK-004 complete)
- Optimizing API costs (can be a future task)

## Technical Approach

### Key Files to Modify

| File                                                                           | Changes                                                                    |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `packages/noodl-editor/src/editor/src/models/migration/MigrationSession.ts`    | Replace `executeAIAssistedPhase()` stub with real orchestrator integration |
| `packages/noodl-editor/src/editor/src/views/migration/MigrationWizard.tsx`     | Add state for budget/decision dialogs, wire callbacks                      |
| `packages/noodl-editor/src/editor/src/views/migration/steps/MigratingStep.tsx` | Display budget approval and decision dialogs during migration              |

### New Files to Create

| File                                                                              | Purpose                                                   |
| --------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `packages/noodl-editor/src/editor/src/views/migration/DecisionDialog.tsx`         | UI for choosing what to do after failed migration retries |
| `packages/noodl-editor/src/editor/src/views/migration/DecisionDialog.module.scss` | Styles for DecisionDialog                                 |

### Dependencies

- ✅ `AIMigrationOrchestrator` (already exists)
- ✅ `ClaudeClient` (already exists)
- ✅ `BudgetController` (already exists)
- ✅ `BudgetApprovalDialog` (already exists)
- ✅ API key storage (already exists)
- ✅ Types for all interfaces (already exists in `types.ts`)

## Implementation Steps

### Step 1: Create DecisionDialog Component

Create the UI for handling failed migration retries. User can choose to:

- **Retry**: Start over with fresh retry attempts
- **Skip**: Mark component for manual review
- **Get Help**: Show AI's detailed manual migration instructions
- **Accept Partial**: Use the last attempted migration (may need fixes)

### Step 2: Wire Budget Approval Flow

Modify MigrationWizard and MigratingStep to:

- Store budget approval state
- Show BudgetApprovalDialog when orchestrator pauses
- Return approval decision to orchestrator
- Resume or abort based on user choice

### Step 3: Wire Decision Flow

Modify MigrationWizard and MigratingStep to:

- Store decision request state
- Show DecisionDialog when retries exhausted
- Handle user's choice (retry/skip/help/manual)
- Display AI help text if requested

### Step 4: Implement executeAIAssistedPhase()

Replace the stub with real implementation:

- Initialize AIMigrationOrchestrator with API key and budget
- Loop through `needsReview` components
- Read source code using filesystem
- Call `orchestrator.migrateComponent()` with callbacks
- Handle all possible result types (success/partial/failed/skipped)
- Write successful migrations to target files
- Update progress and logs accurately

### Step 5: Handle Session Abort

Ensure orchestrator stops cleanly if:

- User cancels migration
- Error occurs
- Budget exhausted

### Step 6: End-to-End Testing

Test the complete flow with real API calls:

- Small budget (e.g., $0.50) to test pause behavior
- Component that should succeed
- Component that might fail (to test retry/decision flow)
- Verify budget tracking is accurate
- Verify migrated code is written correctly

## Testing Plan

### Manual Testing Scenarios

#### Scenario 1: Successful Migration

- [ ] Configure API key and $2 budget
- [ ] Scan project with 1-2 simple `needsReview` components
- [ ] Click "Migrate with AI"
- [ ] Verify Claude is called
- [ ] Verify migrated code is written to target
- [ ] Verify success log entries
- [ ] Verify budget spending is tracked

#### Scenario 2: Budget Pause

- [ ] Configure API key with $2 budget and $0.50 pause increment
- [ ] Scan project with 5+ components needing AI
- [ ] Click "Migrate with AI"
- [ ] Verify BudgetApprovalDialog appears after ~$0.50 spent
- [ ] Click "Stop Here" and verify migration stops
- [ ] Retry, click "Continue" and verify migration resumes

#### Scenario 3: Failed Migration with Retry

- [ ] Configure API key
- [ ] Scan project with complex component likely to fail
- [ ] Click "Migrate with AI"
- [ ] Verify retry attempts are logged
- [ ] Verify DecisionDialog appears after max retries
- [ ] Test each decision option:
  - "Retry" → migration starts over
  - "Skip" → component marked for manual review
  - "Get Help" → AI suggestions displayed
  - "Accept Partial" → last attempt code is used

#### Scenario 4: Abort During Migration

- [ ] Start AI migration
- [ ] Click cancel button mid-migration
- [ ] Verify orchestrator stops cleanly
- [ ] Verify partial results are saved
- [ ] Verify budget tracking is correct

#### Scenario 5: API Key Invalid

- [ ] Configure invalid API key
- [ ] Try to migrate
- [ ] Verify clear error message
- [ ] Verify session doesn't enter broken state

### Integration Tests

- [ ] Mock ClaudeClient and test orchestrator integration
- [ ] Test budget controller callback flow
- [ ] Test decision flow callback
- [ ] Test file writing with mock filesystem

## Success Criteria

- [x] AIMigrationOrchestrator initializes with correct API key and budget
- [x] Each `needsReview` component is sent to Claude API
- [x] Budget approval dialog appears at spending thresholds
- [x] User can approve/deny additional spending
- [x] Decision dialog appears after failed retries
- [x] All decision actions (retry/skip/help/manual) work
- [x] Successful migrations are written to target files
- [x] Migration log shows accurate results (not stub warnings)
- [x] Budget spending is tracked accurately
- [x] Orchestrator aborts cleanly on session cancel
- [x] End-to-end test with real Claude API succeeds
- [x] All TypeScript types are satisfied
- [x] No console errors during migration

## Risks & Mitigations

| Risk                                        | Mitigation                                                     |
| ------------------------------------------- | -------------------------------------------------------------- |
| API costs during testing                    | Use small budgets ($0.50-$1.00), test with minimal projects    |
| API rate limits                             | Implement exponential backoff in ClaudeClient (already exists) |
| Invalid API key at runtime                  | Validate key before starting migration, clear error handling   |
| Budget dialog blocks UI thread              | Use async callbacks, ensure dialogs are dismissible            |
| Failed migrations corrupt files             | Write to target (copy) not source, verify before writing       |
| Orchestrator memory leak on long migrations | Ensure orchestrator is disposed after migration                |

## Rollback Plan

If issues are discovered after wiring:

1. **Immediate Rollback**:

   ```typescript
   // In executeAIAssistedPhase(), wrap in try-catch
   try {
     // New orchestrator code
   } catch (error) {
     // Fall back to stub behavior
     this.addLogEntry({ level: 'error', message: error.message });
   }
   ```

2. **File Restoration**: Target files are in a copy, source never modified
3. **Re-disable AI**: Set `ai.enabled = false` in config if orchestrator fails
4. **Revert Commits**: `git revert` the wiring changes

## References

- [TASK-004: Runtime Migration System](./TASK-004-runtime-migration-system/README.md) - Prerequisite task
- [03-AI-MIGRATION.md](./TASK-004-runtime-migration-system/03-AI-MIGRATION.md) - Full AI architecture spec
- [Anthropic API Documentation](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)
- [React 19 Migration Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)
