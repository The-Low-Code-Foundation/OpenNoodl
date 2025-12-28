# TASK-007 Checklist

## Prerequisites

- [x] Read README.md completely
- [x] Understand the scope and success criteria
- [ ] Create branch: `git checkout -b task/007-wire-ai-migration`
- [ ] Verify build works: `npm run build:editor`
- [ ] Verify existing AI components work in isolation

## Phase 1: Create DecisionDialog Component

- [ ] Create `DecisionDialog.tsx`
  - [ ] Define props interface (componentName, attempts, costSpent, etc.)
  - [ ] Add UI for showing retry history
  - [ ] Add 4 action buttons (Retry, Skip, Get Help, Accept Partial)
  - [ ] Handle "Get Help" to display AI suggestions
  - [ ] Export component
- [ ] Create `DecisionDialog.module.scss`
  - [ ] Style the dialog layout
  - [ ] Style retry history display
  - [ ] Style action buttons
  - [ ] Add responsive layout
- [ ] Document in CHANGELOG.md

## Phase 2: Wire Budget Approval Flow

- [ ] Modify `MigrationWizard.tsx`
  - [ ] Add `budgetApprovalRequest` state
  - [ ] Create `handleBudgetApproval` callback
  - [ ] Create `handleBudgetDenial` callback
  - [ ] Pass callbacks to MigratingStep
- [ ] Modify `MigratingStep.tsx`
  - [ ] Import BudgetApprovalDialog
  - [ ] Receive budget callback props
  - [ ] Conditionally render BudgetApprovalDialog
  - [ ] Connect approve/deny to callbacks
- [ ] Test budget approval flow manually
- [ ] Document in CHANGELOG.md

## Phase 3: Wire Decision Flow

- [ ] Modify `MigrationWizard.tsx`
  - [ ] Add `decisionRequest` state
  - [ ] Create `handleDecision` callback
  - [ ] Pass callbacks to MigratingStep
- [ ] Modify `MigratingStep.tsx`
  - [ ] Import DecisionDialog
  - [ ] Receive decision callback props
  - [ ] Conditionally render DecisionDialog
  - [ ] Handle all 4 decision types
  - [ ] Display AI help text if provided
- [ ] Test decision flow manually
- [ ] Document in CHANGELOG.md

## Phase 4: Implement executeAIAssistedPhase()

- [ ] Open `MigrationSession.ts`
- [ ] Import required dependencies
  - [ ] Import AIMigrationOrchestrator
  - [ ] Import filesystem for reading/writing
  - [ ] Import types (DecisionRequest, ProgressUpdate, etc.)
- [ ] Replace stub implementation
  - [ ] Remove TODO comment and simulateDelay
  - [ ] Initialize AIMigrationOrchestrator with API key and budget
  - [ ] Create onBudgetPause callback that notifies listeners
  - [ ] Create onProgress callback that updates progress
  - [ ] Create onDecisionRequired callback that notifies listeners
- [ ] Loop through needsReview components
  - [ ] Get component file path
  - [ ] Read source code using filesystem
  - [ ] Call orchestrator.migrateComponent()
  - [ ] Handle 'success' result: write to target, log success
  - [ ] Handle 'partial' result: write code, log warning
  - [ ] Handle 'failed' result: log error, don't write
  - [ ] Handle 'skipped' result: log info
  - [ ] Update budget spending in session.ai.budget.spent
- [ ] Add error handling with try-catch
- [ ] Ensure orchestrator is cleaned up
- [ ] Document in CHANGELOG.md

## Phase 5: Handle Session Abort

- [ ] Add orchestrator instance tracking in MigrationSessionManager
- [ ] Modify `cancelSession()` method
  - [ ] Call orchestrator.abort() if exists
  - [ ] Clean up orchestrator reference
- [ ] Modify `startMigration()` error handling
  - [ ] Ensure orchestrator aborts on error
  - [ ] Clean up resources
- [ ] Test abort scenarios
- [ ] Document in CHANGELOG.md

## Phase 6: Manual Testing

### Scenario 1: Successful Migration

- [ ] Set up test project with 1 needsReview component
- [ ] Configure valid API key
- [ ] Set $2 budget
- [ ] Start migration
- [ ] Verify Claude API is called
- [ ] Verify migrated code is written to target
- [ ] Verify success log entry
- [ ] Verify budget spending tracked

### Scenario 2: Budget Pause

- [ ] Configure $2 budget with $0.50 pause increment
- [ ] Scan project with multiple components
- [ ] Start migration
- [ ] Wait for BudgetApprovalDialog
- [ ] Test "Stop Here" button
- [ ] Restart and test "Continue" button

### Scenario 3: Failed Migration

- [ ] Find or create complex component likely to fail
- [ ] Start migration
- [ ] Observe retry attempts in log
- [ ] Wait for DecisionDialog
- [ ] Test "Retry" button
- [ ] Test "Skip" button
- [ ] Test "Get Help" button (verify AI suggestions shown)
- [ ] Test "Accept Partial" button

### Scenario 4: Abort During Migration

- [ ] Start migration
- [ ] Click cancel mid-migration
- [ ] Verify orchestrator stops
- [ ] Verify partial results saved
- [ ] Verify budget tracking accurate

### Scenario 5: Invalid API Key

- [ ] Configure invalid/expired API key
- [ ] Try to migrate
- [ ] Verify clear error message
- [ ] Verify session not in broken state
- [ ] Verify can reconfigure and retry

## Phase 7: Code Quality

- [ ] Run type check: `npx tsc --noEmit`
- [ ] Fix any TypeScript errors
- [ ] Run linter: `npx eslint packages/noodl-editor/src/editor/src/models/migration/MigrationSession.ts --fix`
- [ ] Fix any ESLint warnings
- [ ] Add JSDoc comments to new public methods
- [ ] Remove any debug console.log statements
- [ ] Ensure all imports are used

## Phase 8: Documentation

- [ ] Update CHANGELOG.md with final summary
- [ ] Add discoveries to NOTES.md
- [ ] Update TASK-004 CHANGELOG noting TASK-007 completion
- [ ] Check if any dev-docs/reference/ files need updates

## Phase 9: Completion

- [ ] Self-review all changes
- [ ] Verify all success criteria met
- [ ] Verify all checklist items completed
- [ ] Commit changes with proper message
- [ ] Mark task as complete in phase-2 tracking
