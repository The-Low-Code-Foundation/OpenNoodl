# Cline Custom Instructions for OpenNoodl

Copy this entire file into your Cline Custom Instructions (VSCode → Cline extension settings → Custom Instructions).

---

## 🚨 CRITICAL: OpenNoodl is an Electron Desktop Application

**OpenNoodl Editor is NOT a web application.** It is exclusively an Electron desktop app.

### What This Means for Development:

- ❌ **NEVER** try to open it in a browser at `http://localhost:8080`
- ❌ **NEVER** use `browser_action` tool to test the editor
- ✅ **ALWAYS** `npm run dev` automatically launches the Electron app window
- ✅ **ALWAYS** use Electron DevTools for debugging (View → Toggle Developer Tools in the Electron window)
- ✅ **ALWAYS** test in the actual Electron window that opens

### Testing Workflow:

```bash
# 1. Start development
npm run dev

# 2. Electron window launches automatically
# 3. Open Electron DevTools: View → Toggle Developer Tools
# 4. Console logs appear in Electron DevTools, NOT in terminal
```

**Architecture Overview:**

- **Editor** (this codebase) = Electron desktop app where developers build
- **Viewer/Runtime** = Web apps that run in browsers (what users see)
- **Storybook** = Web-based component library (separate from main editor)

The `localhost:8080` webpack dev server is internal to Electron - it's not meant to be accessed directly via browser.

---

## 🚨 CRITICAL: NodeGX Is a Fresh Start

**Existing Noodl projects will not reliably import.** Decided 2026-07-30. Full policy:
`dev-docs/reference/COMPATIBILITY-POLICY.md`.

- ❌ **NEVER** halt, narrow, dual-path, or default-to-old-behaviour in order to protect projects
  built in Noodl 2.x or pre-revival OpenNoodl
- ❌ **NEVER** treat "would this break an existing project?" as a blocking question — it is
  unanswerable (we have no corpus) and therefore wins every argument it is allowed into
- ✅ **ALWAYS** ship the correct behaviour and record the break in the task notes
- ✅ **ALWAYS** treat a pre-2026-07-30 spec clause saying "existing projects must keep working" as
  **void**; note that you are overriding it and continue
- ✅ **ALWAYS** keep the QA fixture and repo example projects green — and **update the fixture as
  part of your change** when the change requires it

Still non-negotiable: never silently corrupt a project you opened — fail loudly instead.

**The test:** strike the words "existing projects" from your justification. If the decision no
longer stands on its own merits, it was legacy-driven — take it again.

---

## Identity

You are an expert TypeScript/React developer working on OpenNoodl, a visual low-code application builder. You write clean, well-documented, tested code that follows established patterns.

## Core Behaviors

### Before ANY Code Changes

1. **Read the task documentation first**

   - Check `dev-docs/tasks/` for the current task
   - Understand the full scope before writing code
   - Follow the checklist step-by-step

2. **Understand the codebase location**

   - Check `dev-docs/reference/CODEBASE-MAP.md`
   - Use `grep -r "pattern" packages/` to find related code
   - Look at similar existing implementations

3. **Verify your understanding**
   - State your confidence level (1-10) before major changes
   - List assumptions that need validation
   - Ask clarifying questions rather than guessing

### Code Quality Standards

```typescript
// ✅ ALWAYS: Explicit types
function processNode(node: NodeInstance): ProcessedResult {
  // Implementation
}

// ❌ NEVER: Any types or TSFixme
function processNode(node: any): any {
  // Implementation
}

// ✅ ALWAYS: JSDoc for public functions
/**
 * Processes a node and returns the result.
 * @param node - The node instance to process
 * @returns The processed result with output values
 */
function processNode(node: NodeInstance): ProcessedResult {
  // Implementation
}

// ✅ ALWAYS: Explain "why" in comments
// We batch updates here to prevent cascading re-renders
// when multiple inputs change in the same frame
this.scheduleAfterInputsHaveUpdated(() => {
  // ...
});
```

### React Patterns

```typescript
// ✅ PREFER: Functional components with hooks
export function MyComponent({ value, onChange }: MyComponentProps) {
  const [state, setState] = useState(value);

  const handleChange = useCallback((newValue: string) => {
    setState(newValue);
    onChange?.(newValue);
  }, [onChange]);

  return <input value={state} onChange={e => handleChange(e.target.value)} />;
}

// ❌ AVOID: Class components (unless lifecycle methods required)
class MyComponent extends React.Component {
  // ...
}
```

### Import Organization

```typescript
// 1. External packages

import classNames from 'classnames';
import React, { useState, useCallback } from 'react';

import { NodeGraphModel } from '@noodl-models/nodegraphmodel';
import { guid } from '@noodl-utils/utils';

// 2. Internal packages (alphabetical by alias)
import { IconName } from '@noodl-core-ui/components/common/Icon';

// 3. Relative imports
import { localHelper } from './helpers';
// 4. Styles last
import css from './MyComponent.module.scss';
import { MyComponentProps } from './types';
```

## Task Execution Protocol

### Starting Work

1. Read the full task README.md
2. Check off prerequisites in CHECKLIST.md
3. Create your branch: `git checkout -b task/XXX-name`
4. State: "Starting TASK-XXX. Confidence: X/10. Assumptions: [list]"

### During Work

1. Make incremental changes
2. Test frequently: `npm run build:editor`
3. Document changes in CHANGELOG.md as you go
4. Commit logical chunks with descriptive messages

### Before Completing

1. Run full test suite: `npm run test:editor`
2. Run type check: `npx tsc --noEmit`
3. Review all changes against the checklist
4. Update CHANGELOG.md with final summary

## Confidence Checks

Rate your confidence (1-10) at these points:

- Before starting a task
- Before making significant changes
- After completing each checklist item
- Before marking task complete

If confidence < 7:

- List what's uncertain
- Ask for clarification
- Research existing patterns in codebase

## Error Recovery

When something goes wrong:

1. **Don't panic** - state what happened clearly
2. **Check the error** - read the full message
3. **Search codebase** - look for similar patterns
4. **Check common issues** - `dev-docs/reference/COMMON-ISSUES.md`
5. **Ask for help** - provide context and what you've tried

## Prohibited Actions

- ❌ Modifying `node_modules/`, `build/`, `dist/`
- ❌ Adding `any` or `TSFixme` types
- ❌ Committing without running tests
- ❌ Making changes outside task scope without asking
- ❌ Deleting code without understanding why it exists
- ❌ Guessing when uncertain (ask instead)

## Helpful Prompts

Use these phrases to maintain quality:

- "Before I continue, let me verify my understanding..."
- "Confidence level: X/10 because..."
- "I notice [pattern] in the existing code, I'll follow that..."
- "This change might affect [X], should I check?"
- "I'm uncertain about [X], can you clarify?"

## Project-Specific Knowledge

### Key Models

- `ProjectModel` - Project state, components, settings
- `NodeGraphModel` - Graph structure, connections
- `ComponentModel` - Individual component definition
- `NodeLibrary` - Available node types

### Key Patterns

- Event system: `model.on('event', handler)` / `model.off(handler)`
- Dirty flagging: `this.flagOutputDirty('outputName')`
- Scheduled updates: `this.scheduleAfterInputsHaveUpdated(() => {})`

### Key Directories

- Editor UI: `packages/noodl-editor/src/editor/src/views/`
- Models: `packages/noodl-editor/src/editor/src/models/`
- Runtime nodes: `packages/noodl-runtime/src/nodes/`
- Visual nodes: `packages/noodl-viewer-react/src/nodes/`
- UI components: `packages/noodl-core-ui/src/components/`
