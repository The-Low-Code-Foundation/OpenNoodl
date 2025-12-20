# TASK-007 Working Notes

## Research

### Existing Patterns Found

#### AIMigrationOrchestrator Interface

- Located in: `packages/noodl-editor/src/editor/src/models/migration/AIMigrationOrchestrator.ts`
- Constructor signature:

```typescript
constructor(
  apiKey: string,
  budgetConfig: AIConfig['budget'],
  config: OrchestratorConfig,
  onBudgetPause: (state: BudgetState) => Promise<boolean>
)
```

- Main method: `migrateComponent(component, code, preferences, onProgress, onDecisionRequired)`
- Returns: `ComponentMigrationResult`

#### Callback Patterns

The orchestrator expects two key callbacks:

1. **onBudgetPause**: `(state: BudgetState) => Promise<boolean>`

   - Called when spending reaches pause increment
   - Should show BudgetApprovalDialog
   - Returns true to continue, false to stop

2. **onDecisionRequired**: `(request: DecisionRequest) => Promise<Decision>`
   - Called after max retries exhausted
   - Should show DecisionDialog
   - Returns user's choice (retry/skip/getHelp/manual)

#### Event Flow in MigrationSession

MigrationSession uses EventDispatcher pattern:

- Notifies listeners with `this.notifyListeners(eventName, payload)`
- MigrationWizard subscribes to events
- Events include: 'sessionCreated', 'stepChanged', 'scanProgress', 'progressUpdated', 'logEntry', etc.

### Questions to Resolve

- [x] Where are DecisionRequest and Decision types defined?
  - Answer: Should be in `packages/noodl-editor/src/editor/src/models/migration/types.ts`
- [x] How does MigrationWizard subscribe to session events?
  - Answer: Uses `migrationSessionManager.on(eventName, handler)` pattern
- [x] Where do we read source code files from?
  - Answer: From `session.source.path` (original project), not target (copy)
- [x] How do we construct file paths for components?
  - Answer: ComponentMigrationInfo should have a `filePath` property from scan results

### Assumptions

- Assumption 1: ComponentMigrationInfo includes `filePath` property - ✅ Need to verify in types.ts
- Assumption 2: Target path already has directory structure copied - ✅ Validated (executeCopyPhase does this)
- Assumption 3: BudgetApprovalDialog can be shown during migration - ✅ Validated (async callback pattern supports this)
- Assumption 4: filesystem.readFile returns string content - ✅ Need to verify API

## Implementation Notes

### Approach Decisions

#### Why Not Use React State for Budget/Decision Dialogs?

**Decision**: Use EventDispatcher pattern instead of lifting state to MigrationWizard

**Reasoning**:

- Keeps orchestrator decoupled from React
- Follows existing pattern used for scan progress
- Makes testing easier (can test orchestrator without UI)

#### Where to Store Orchestrator Instance?

**Decision**: Store as class property in MigrationSessionManager

**Reasoning**:

- Needs to be accessible to cancelSession() for abort
- Scoped to migration lifecycle
- Follows pattern used for session state

### File Reading Strategy

```typescript
// Read from SOURCE (original project)
const sourcePath = `${this.session.source.path}/${component.filePath}`;
const code = await filesystem.readFile(sourcePath);

// Write to TARGET (copy)
const targetPath = `${this.session.target.path}/${component.filePath}`;
await filesystem.writeFile(targetPath, migratedCode);
```

### Event Names to Add

Need to add new events to MigrationSessionManager:

- `budgetPauseRequired` - When orchestrator needs budget approval
- `decisionRequired` - When orchestrator needs retry decision
- `componentMigrated` - After each component completes (for progress updates)

### Gotchas / Surprises

- None yet - implementation not started

### Useful Commands

```bash
# Search for ComponentMigrationInfo type definition
grep -r "interface ComponentMigrationInfo" packages/noodl-editor/

# Find how filesystem API is used
grep -r "filesystem.readFile" packages/noodl-editor/src/editor/

# Check existing event listener patterns
grep -r "migrationSessionManager.on" packages/noodl-editor/src/editor/

# Test build after changes
npm run build:editor

# Type check only
npx tsc --noEmit -p packages/noodl-editor/tsconfig.json
```

## Debug Log

_Add entries as you work through implementation_

### [Date/Time] - Phase 1: DecisionDialog Component

- Trying: [what you're attempting]
- Result: [what happened]
- Next: [what to try next]

### [Date/Time] - Phase 2: Budget Approval Flow

- Trying: [what you're attempting]
- Result: [what happened]
- Next: [what to try next]

### [Date/Time] - Phase 3: Decision Flow

- Trying: [what you're attempting]
- Result: [what happened]
- Next: [what to try next]

### [Date/Time] - Phase 4: executeAIAssistedPhase Implementation

- Trying: [what you're attempting]
- Result: [what happened]
- Next: [what to try next]

## Discoveries for LEARNINGS.md

_Note any non-obvious patterns or gotchas discovered during implementation that should be added to dev-docs/reference/LEARNINGS.md_

### Example Discovery Template

**Context**: What were you trying to do?

**Discovery**: What did you learn?

**Location**: What files/areas does this apply to?

**Keywords**: [searchable terms for future reference]

---

## References

- [AIMigrationOrchestrator.ts](../../../packages/noodl-editor/src/editor/src/models/migration/AIMigrationOrchestrator.ts)
- [BudgetController.ts](../../../packages/noodl-editor/src/editor/src/models/migration/BudgetController.ts)
- [MigrationSession.ts](../../../packages/noodl-editor/src/editor/src/models/migration/MigrationSession.ts)
- [types.ts](../../../packages/noodl-editor/src/editor/src/models/migration/types.ts)
