# AI-002: AI Component Suggestions

## Overview

Provide intelligent, context-aware component suggestions as users build their projects. When a user is working on a component, AI analyzes the context and suggests relevant nodes, connections, or entire sub-components that would complement what they're building.

## Context

Currently, users must:
- Know what node they need
- Search through the node picker
- Understand which nodes work together
- Manually create common patterns

This creates friction for:
- New users learning the platform
- Experienced users building repetitive patterns
- Anyone implementing common UI patterns

AI suggestions provide:
- "What you might need next" recommendations
- Common pattern recognition
- Learning through suggestion
- Faster workflow for experts

### Integration with Existing AI

From `AiAssistantModel.ts`:
```typescript
// Existing AI node templates
templates: AiTemplate[] = docsTemplates.map(...)

// Activity tracking
addActivity({ id, type, title, prompt, node, graph })
```

This task extends the AI capabilities to work alongside normal editing, not just through dedicated AI nodes.

## Requirements

### Functional Requirements

1. **Context Analysis**
   - Analyze current component structure
   - Identify incomplete patterns
   - Detect user intent from recent actions
   - Consider project-wide context

2. **Suggestion Types**
   - **Node suggestions**: "Add a Loading state?"
   - **Connection suggestions**: "Connect this to..."
   - **Pattern completion**: "Complete this form with validation?"
   - **Prefab suggestions**: "Use the Form Input prefab?"

3. **Suggestion Display**
   - Non-intrusive inline hints
   - Expandable detail panel
   - One-click insertion
   - Keyboard shortcuts

4. **Learning & Relevance**
   - Learn from user accepts/rejects
   - Improve relevance over time
   - Consider user skill level
   - Avoid repetitive suggestions

5. **Control & Settings**
   - Enable/disable suggestions
   - Suggestion frequency
   - Types of suggestions
   - Reset learned preferences

### Non-Functional Requirements

- Suggestions appear within 500ms
- No blocking of user actions
- Minimal API calls (batch/cache)
- Works offline (basic patterns)

## Technical Approach

### 1. Suggestion Service

```typescript
// packages/noodl-editor/src/editor/src/services/AiSuggestionService.ts

interface SuggestionContext {
  component: ComponentModel;
  selectedNodes: NodeGraphNode[];
  recentActions: EditorAction[];
  projectContext: ProjectContext;
  userPreferences: UserPreferences;
}

interface Suggestion {
  id: string;
  type: 'node' | 'connection' | 'pattern' | 'prefab';
  confidence: number;  // 0-1
  title: string;
  description: string;
  preview?: string;  // Visual preview
  action: SuggestionAction;
  dismissable: boolean;
}

interface SuggestionAction {
  type: 'insert_node' | 'create_connection' | 'insert_pattern' | 'import_prefab';
  payload: any;
}

class AiSuggestionService {
  private static instance: AiSuggestionService;
  private suggestionCache: Map<string, Suggestion[]> = new Map();
  private userFeedback: UserFeedbackStore;
  
  // Main API
  async getSuggestions(context: SuggestionContext): Promise<Suggestion[]>;
  async applySuggestion(suggestion: Suggestion): Promise<void>;
  async dismissSuggestion(suggestion: Suggestion): Promise<void>;
  
  // Feedback
  recordAccept(suggestion: Suggestion): void;
  recordReject(suggestion: Suggestion): void;
  recordIgnore(suggestion: Suggestion): void;
  
  // Settings
  setEnabled(enabled: boolean): void;
  setFrequency(frequency: SuggestionFrequency): void;
  getSuggestionSettings(): SuggestionSettings;
}
```

### 2. Context Analyzer

```typescript
// packages/noodl-editor/src/editor/src/services/ai/ContextAnalyzer.ts

interface AnalysisResult {
  componentType: ComponentType;
  currentPattern: Pattern | null;
  incompletePatterns: IncompletePattern[];
  missingConnections: MissingConnection[];
  suggestedEnhancements: Enhancement[];
}

class ContextAnalyzer {
  // Pattern detection
  detectPatterns(component: ComponentModel): Pattern[];
  detectIncompletePatterns(component: ComponentModel): IncompletePattern[];
  
  // Connection analysis
  findMissingConnections(nodes: NodeGraphNode[]): MissingConnection[];
  findOrphanedNodes(component: ComponentModel): NodeGraphNode[];
  
  // Intent inference
  inferUserIntent(recentActions: EditorAction[]): UserIntent;
  
  // Project context
  getRelatedComponents(component: ComponentModel): ComponentModel[];
  getDataModelContext(component: ComponentModel): DataModel[];
}

// Common patterns to detect
const PATTERNS = {
  FORM_INPUT: {
    nodes: ['TextInput', 'Label'],
    missing: ['Validation', 'ErrorDisplay'],
    suggestion: 'Add form validation?'
  },
  LIST_ITEM: {
    nodes: ['Repeater', 'Group'],
    missing: ['ItemClick', 'DeleteAction'],
    suggestion: 'Add item interactions?'
  },
  DATA_FETCH: {
    nodes: ['REST'],
    missing: ['LoadingState', 'ErrorState'],
    suggestion: 'Add loading and error states?'
  },
  // ... more patterns
};
```

### 3. Suggestion Engine

```typescript
// packages/noodl-editor/src/editor/src/services/ai/SuggestionEngine.ts

class SuggestionEngine {
  private contextAnalyzer: ContextAnalyzer;
  private patternLibrary: PatternLibrary;
  private prefabMatcher: PrefabMatcher;
  
  async generateSuggestions(context: SuggestionContext): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];
    
    // 1. Local pattern matching (no API)
    const localSuggestions = this.getLocalSuggestions(context);
    suggestions.push(...localSuggestions);
    
    // 2. AI-powered suggestions (API call)
    if (this.shouldCallApi(context)) {
      const aiSuggestions = await this.getAiSuggestions(context);
      suggestions.push(...aiSuggestions);
    }
    
    // 3. Prefab matching
    const prefabSuggestions = this.getPrefabSuggestions(context);
    suggestions.push(...prefabSuggestions);
    
    // 4. Rank and filter
    return this.rankSuggestions(suggestions, context);
  }
  
  private getLocalSuggestions(context: SuggestionContext): Suggestion[] {
    const analysis = this.contextAnalyzer.analyze(context.component);
    const suggestions: Suggestion[] = [];
    
    // Pattern completion
    for (const incomplete of analysis.incompletePatterns) {
      suggestions.push({
        type: 'pattern',
        title: incomplete.completionTitle,
        description: incomplete.description,
        confidence: incomplete.confidence,
        action: {
          type: 'insert_pattern',
          payload: incomplete.completionNodes
        }
      });
    }
    
    // Missing connections
    for (const missing of analysis.missingConnections) {
      suggestions.push({
        type: 'connection',
        title: `Connect ${missing.from} to ${missing.to}`,
        confidence: missing.confidence,
        action: {
          type: 'create_connection',
          payload: missing
        }
      });
    }
    
    return suggestions;
  }
}
```

### 4. UI Components

#### Inline Suggestion Hint

```
┌─────────────────────────────────────────────────────────────────────┐
│ Canvas                                                              │
│                                                                     │
│   ┌─────────────┐      ┌─────────────┐                             │
│   │ TextInput   │──────│ Variable    │                             │
│   └─────────────┘      └─────────────┘                             │
│          │                                                          │
│          ▼                                                          │
│   ┌─────────────────────────────────────────┐                      │
│   │ 💡 Add form validation?          [+ Add]│                      │
│   │    Validate input and show errors       │                      │
│   └─────────────────────────────────────────┘                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Suggestion Panel

```
┌─────────────────────────────────────────────────────────────────────┐
│ 💡 Suggestions                                              [×]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Based on your current component:                                   │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 🧩 Complete Form Pattern                              [+ Apply] │ │
│ │    Add validation, error states, and submit handling            │ │
│ │    Confidence: ████████░░ 85%                                   │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ 📦 Use "Form Input" Prefab                            [+ Apply] │ │
│ │    Replace with pre-built form input component                  │ │
│ │    Confidence: ███████░░░ 75%                                   │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ 🔗 Connect to Submit button                           [+ Apply] │ │
│ │    Wire up the form submission flow                             │ │
│ │    Confidence: ██████░░░░ 65%                                   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ [⚙️ Suggestion Settings]                                            │
└─────────────────────────────────────────────────────────────────────┘
```

### 5. Pattern Library

```typescript
// packages/noodl-editor/src/editor/src/services/ai/PatternLibrary.ts

interface PatternDefinition {
  id: string;
  name: string;
  description: string;
  trigger: PatternTrigger;
  completion: PatternCompletion;
  examples: string[];
}

const PATTERNS: PatternDefinition[] = [
  {
    id: 'form-validation',
    name: 'Form Validation',
    description: 'Add input validation with error display',
    trigger: {
      hasNodes: ['TextInput', 'Variable'],
      missingNodes: ['Function', 'Condition', 'Text'],
      nodeCount: { min: 2, max: 5 }
    },
    completion: {
      nodes: [
        { type: 'Function', name: 'Validate' },
        { type: 'Condition', name: 'IsValid' },
        { type: 'Text', name: 'ErrorMessage' }
      ],
      connections: [
        { from: 'TextInput.value', to: 'Validate.input' },
        { from: 'Validate.result', to: 'IsValid.condition' },
        { from: 'IsValid.false', to: 'ErrorMessage.visible' }
      ]
    }
  },
  {
    id: 'loading-state',
    name: 'Loading State',
    description: 'Add loading indicator during async operations',
    trigger: {
      hasNodes: ['REST'],
      missingNodes: ['Condition', 'Group'],
    },
    completion: {
      nodes: [
        { type: 'Variable', name: 'IsLoading' },
        { type: 'Group', name: 'LoadingSpinner' },
        { type: 'Condition', name: 'ShowContent' }
      ],
      connections: [
        { from: 'REST.fetch', to: 'IsLoading.set(true)' },
        { from: 'REST.success', to: 'IsLoading.set(false)' },
        { from: 'IsLoading.value', to: 'LoadingSpinner.visible' }
      ]
    }
  },
  // ... more patterns
];
```

## Files to Create

1. `packages/noodl-editor/src/editor/src/services/AiSuggestionService.ts`
2. `packages/noodl-editor/src/editor/src/services/ai/ContextAnalyzer.ts`
3. `packages/noodl-editor/src/editor/src/services/ai/SuggestionEngine.ts`
4. `packages/noodl-editor/src/editor/src/services/ai/PatternLibrary.ts`
5. `packages/noodl-editor/src/editor/src/services/ai/PrefabMatcher.ts`
6. `packages/noodl-core-ui/src/components/ai/SuggestionHint/SuggestionHint.tsx`
7. `packages/noodl-core-ui/src/components/ai/SuggestionPanel/SuggestionPanel.tsx`
8. `packages/noodl-core-ui/src/components/ai/SuggestionCard/SuggestionCard.tsx`

## Files to Modify

1. `packages/noodl-editor/src/editor/src/views/nodegrapheditor.js`
   - Hook into node selection/creation
   - Trigger suggestion generation
   - Display suggestion hints

2. `packages/noodl-editor/src/editor/src/pages/EditorPage/EditorPage.tsx`
   - Add suggestion panel toggle
   - Handle suggestion keybindings

3. `packages/noodl-editor/src/editor/src/models/AiAssistant/AiAssistantModel.ts`
   - Integrate suggestion service
   - Share context with AI nodes

4. `packages/noodl-editor/src/editor/src/stores/EditorSettings.ts`
   - Add suggestion settings

## Implementation Steps

### Phase 1: Context Analysis
1. Create ContextAnalyzer
2. Implement pattern detection
3. Implement connection analysis
4. Test with various components

### Phase 2: Pattern Library
1. Define pattern schema
2. Create initial patterns (10-15)
3. Implement pattern matching
4. Test pattern triggers

### Phase 3: Suggestion Engine
1. Create SuggestionEngine
2. Implement local suggestions
3. Implement AI suggestions
4. Add ranking/filtering

### Phase 4: UI - Inline Hints
1. Create SuggestionHint component
2. Position near relevant nodes
3. Add apply/dismiss actions
4. Animate appearance

### Phase 5: UI - Panel
1. Create SuggestionPanel
2. Create SuggestionCard
3. Add settings access
4. Handle keyboard shortcuts

### Phase 6: Feedback & Learning
1. Track accept/reject
2. Adjust confidence scores
3. Improve relevance
4. Add user settings

## Testing Checklist

- [ ] Patterns detected correctly
- [ ] Suggestions appear at right time
- [ ] Apply action works correctly
- [ ] Dismiss removes suggestion
- [ ] Inline hint positions correctly
- [ ] Panel shows all suggestions
- [ ] Settings persist
- [ ] Works offline (local patterns)
- [ ] API suggestions enhance local
- [ ] Feedback recorded
- [ ] Performance < 500ms

## Dependencies

- AI-001 (AI Project Scaffolding) - for AI infrastructure
- COMP-002 (Built-in Prefabs) - for prefab matching

## Blocked By

- AI-001 (for AnthropicClient)

## Blocks

- AI-003 (Natural Language Editing)

## Estimated Effort

- Context analyzer: 4-5 hours
- Pattern library: 4-5 hours
- Suggestion engine: 5-6 hours
- UI inline hints: 3-4 hours
- UI panel: 4-5 hours
- Feedback system: 3-4 hours
- Testing & refinement: 4-5 hours
- **Total: 27-34 hours**

## Success Criteria

1. Suggestions appear contextually
2. Pattern completion works smoothly
3. Prefab matching finds relevant prefabs
4. Apply action inserts correctly
5. Users can control suggestions
6. Suggestions improve over time

## Pattern Categories

### Forms
- Form validation
- Form submission
- Input formatting
- Error display

### Data
- Loading states
- Error handling
- Refresh/retry
- Pagination

### Navigation
- Page transitions
- Breadcrumbs
- Tab navigation
- Modal flows

### Lists
- Item selection
- Delete/edit actions
- Drag and drop
- Filtering

## Future Enhancements

- Real-time suggestions while typing
- Team-shared patterns
- Auto-apply for obvious patterns
- Pattern creation from selection
- AI-powered custom patterns
