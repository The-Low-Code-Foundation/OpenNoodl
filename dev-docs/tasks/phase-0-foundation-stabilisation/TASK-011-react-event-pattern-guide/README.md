# TASK-011: React Event Pattern Guide Documentation

## Status: ✅ COMPLETED

## Summary

Document the React + EventDispatcher pattern in all relevant locations so future developers follow the correct approach and avoid the silent subscription failure pitfall.

## Changes Made

### 1. Created GOLDEN-PATTERN.md ✅

**Location:** `dev-docs/tasks/phase-0-foundation-stabalisation/TASK-011-react-event-pattern-guide/GOLDEN-PATTERN.md`

Comprehensive pattern guide including:

- Quick start examples
- Problem explanation
- API reference
- Common patterns
- Debugging guide
- Anti-patterns to avoid
- Migration examples

### 2. Updated .clinerules ✅

**File:** `.clinerules` (root)

Added React + EventDispatcher section:

```markdown
## Section: React + EventDispatcher Integration

### CRITICAL: Always use useEventListener hook

When subscribing to EventDispatcher events from React components, ALWAYS use the `useEventListener` hook.
Direct subscriptions silently fail.

**✅ CORRECT:**
import { useEventListener } from '@noodl-hooks/useEventListener';
useEventListener(ProjectModel.instance, 'componentRenamed', (data) => {
// This works!
});

**❌ BROKEN:**
useEffect(() => {
const context = {};
ProjectModel.instance.on('event', handler, context);
return () => ProjectModel.instance.off(context);
}, []);
// Compiles and runs without errors, but events are NEVER received

### Why this matters

EventDispatcher uses context-object cleanup pattern incompatible with React closures.
Direct subscriptions fail silently - no errors, no events, just confusion.

### Available dispatchers

- ProjectModel.instance
- NodeLibrary.instance
- WarningsModel.instance
- EventDispatcher.instance
- UndoQueue.instance

### Full documentation

See: dev-docs/tasks/phase-0-foundation-stabalisation/TASK-011-react-event-pattern-guide/GOLDEN-PATTERN.md
```

### 3. Updated LEARNINGS.md ✅

**File:** `dev-docs/reference/LEARNINGS.md`

Added entry documenting the discovery and solution.

## Documentation Locations

The pattern is now documented in:

1. **Primary Reference:** `GOLDEN-PATTERN.md` (this directory)
2. **AI Instructions:** `.clinerules` (root) - Section on React + EventDispatcher
3. **Institutional Knowledge:** `dev-docs/reference/LEARNINGS.md`
4. **Investigation Details:** `TASK-008-eventdispatcher-react-investigation/`

## Success Criteria

- [x] GOLDEN-PATTERN.md created with comprehensive examples
- [x] .clinerules updated with critical warning and examples
- [x] LEARNINGS.md updated with pattern entry
- [x] Pattern is searchable and discoverable
- [x] Clear anti-patterns documented

## For Future Developers

When working with EventDispatcher from React components:

1. **Search first:** `grep -r "useEventListener" .clinerules`
2. **Read the pattern:** `GOLDEN-PATTERN.md` in this directory
3. **Never use direct `.on()` in React:** It silently fails
4. **Follow the examples:** Copy from GOLDEN-PATTERN.md

## Time Spent

**Actual:** ~1 hour (documentation writing and organization)

## Next Steps

- TASK-012: Create health check script to validate patterns automatically
- Use this pattern in all future React migrations
- Update existing components that use broken patterns
