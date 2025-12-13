# React 19 Migration System - Implementation Overview

## Feature Summary

A comprehensive migration system that allows users to safely upgrade legacy Noodl projects (React 17) to the new OpenNoodl runtime (React 19), with optional AI-assisted code migration.

## Core Principles

1. **Never modify originals** - All migrations create a copy first
2. **Transparent progress** - Users see exactly what's happening and why
3. **Graceful degradation** - Partial success is still useful
4. **Cost consent** - AI assistance is opt-in with explicit budgets
5. **No dead ends** - Every failure state has a clear next step

## Feature Components

| Spec | Description | Priority |
|------|-------------|----------|
| [01-PROJECT-DETECTION](./01-PROJECT-DETECTION.md) | Detecting legacy projects and visual indicators | P0 |
| [02-MIGRATION-WIZARD](./02-MIGRATION-WIZARD.md) | The migration flow UI and logic | P0 |
| [03-AI-MIGRATION](./03-AI-MIGRATION.md) | AI-assisted code migration system | P1 |
| [04-POST-MIGRATION-UX](./04-POST-MIGRATION-UX.md) | Editor experience after migration | P0 |
| [05-NEW-PROJECT-NOTICE](./05-NEW-PROJECT-NOTICE.md) | Messaging for new project creation | P2 |

## Implementation Order

### Phase 1: Core Migration (No AI)
1. Project detection and version checking
2. Migration wizard UI (scan, report, execute)
3. Automatic migrations (no code changes needed)
4. Post-migration indicators in editor

### Phase 2: AI-Assisted Migration
1. API key configuration and storage
2. Budget control system
3. Claude integration for code migration
4. Retry logic and failure handling

### Phase 3: Polish
1. New project messaging
2. Migration log viewer
3. "Dismiss" functionality for warnings
4. Help documentation links

## Data Structures

### Project Manifest Addition

```typescript
// Added to project.json
interface ProjectManifest {
  // Existing fields...
  
  // New migration tracking
  runtimeVersion?: 'react17' | 'react19';
  migratedFrom?: {
    version: 'react17';
    date: string;
    originalPath: string;
    aiAssisted: boolean;
  };
  migrationNotes?: {
    [componentId: string]: ComponentMigrationNote;
  };
}

interface ComponentMigrationNote {
  status: 'auto' | 'ai-migrated' | 'needs-review' | 'manually-fixed';
  issues?: string[];
  aiSuggestion?: string;
  dismissedAt?: string;
}
```

### Migration Session State

```typescript
interface MigrationSession {
  id: string;
  sourceProject: {
    path: string;
    name: string;
    version: 'react17';
  };
  targetPath: string;
  status: 'scanning' | 'reporting' | 'migrating' | 'complete' | 'failed';
  scan?: MigrationScan;
  progress?: MigrationProgress;
  result?: MigrationResult;
  aiConfig?: AIConfig;
}

interface MigrationScan {
  totalComponents: number;
  totalNodes: number;
  customJsFiles: number;
  categories: {
    automatic: ComponentInfo[];
    simpleFixes: ComponentInfo[];
    needsReview: ComponentInfo[];
  };
}

interface ComponentInfo {
  id: string;
  name: string;
  path: string;
  issues: MigrationIssue[];
}

interface MigrationIssue {
  type: 'componentWillMount' | 'componentWillReceiveProps' | 
        'componentWillUpdate' | 'stringRef' | 'legacyContext' | 
        'createFactory' | 'other';
  description: string;
  location: { file: string; line: number; };
  autoFixable: boolean;
  estimatedAiCost?: number;
}
```

## File Structure

```
packages/noodl-editor/src/
├── editor/src/
│   ├── models/
│   │   └── migration/
│   │       ├── MigrationSession.ts
│   │       ├── ProjectScanner.ts
│   │       ├── MigrationExecutor.ts
│   │       └── AIAssistant.ts
│   ├── views/
│   │   └── migration/
│   │       ├── MigrationWizard.tsx
│   │       ├── ScanProgress.tsx
│   │       ├── MigrationReport.tsx
│   │       ├── AIConfigPanel.tsx
│   │       ├── MigrationProgress.tsx
│   │       └── MigrationComplete.tsx
│   └── utils/
│       └── migration/
│           ├── codeAnalyzer.ts
│           ├── codeTransformer.ts
│           └── costEstimator.ts
```

## Dependencies

### New Dependencies Needed

```json
{
  "@anthropic-ai/sdk": "^0.24.0",
  "@babel/parser": "^7.24.0",
  "@babel/traverse": "^7.24.0",
  "@babel/generator": "^7.24.0"
}
```

### Why These Dependencies

- **@anthropic-ai/sdk** - Official Anthropic SDK for Claude API calls
- **@babel/*** - Parse and transform JavaScript/JSX for code analysis and automatic fixes

## Security Considerations

1. **API Key Storage**
   - Store in electron-store with encryption
   - Never log or transmit to OpenNoodl servers
   - Clear option to remove stored key

2. **Cost Controls**
   - Hard budget limits enforced client-side
   - Cannot be bypassed without explicit user action
   - Clear display of costs before and after

3. **Code Execution**
   - AI-generated code is shown to user before applying
   - Verification step before saving changes
   - Full undo capability via project copy

## Testing Strategy

### Unit Tests
- ProjectScanner correctly identifies all issue types
- Cost estimator accuracy within 20%
- Code transformer handles edge cases

### Integration Tests
- Full migration flow with mock AI responses
- Budget controls enforce limits
- Project copy is byte-identical to original

### Manual Testing
- Test with real legacy Noodl projects
- Test with projects containing various issue types
- Test AI migration with real API calls (budget: $5)

## Success Metrics

- 95% of projects with only built-in nodes migrate automatically
- AI successfully migrates 80% of custom code on first attempt
- Zero data loss incidents
- Average migration time < 5 minutes for typical project
