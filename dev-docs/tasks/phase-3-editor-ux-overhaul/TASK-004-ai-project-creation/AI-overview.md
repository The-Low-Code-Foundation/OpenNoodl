# AI Series: AI-Powered Development

## Overview

The AI series transforms OpenNoodl from a visual development tool into an intelligent development partner. Users can describe what they want to build, receive contextual suggestions, edit with natural language, and get automatic design feedback—all powered by Claude AI.

## Target Environment

- **Editor**: React 19 version only
- **Runtime**: Not affected
- **API**: Anthropic Claude API
- **Fallback**: Graceful degradation without API

## Task Dependency Graph

```
AI-001 (Project Scaffolding)
    │
    ├──────────────────────────┐
    ↓                          ↓
AI-002 (Suggestions)     AI-003 (NL Editing)
    │                          │
    └──────────┬───────────────┘
               ↓
        AI-004 (Design Assistance)
```

## Task Summary

| Task ID | Name | Est. Hours | Priority |
|---------|------|------------|----------|
| AI-001 | AI Project Scaffolding | 32-41 | Critical |
| AI-002 | AI Component Suggestions | 27-34 | High |
| AI-003 | Natural Language Editing | 30-38 | High |
| AI-004 | AI Design Assistance | 32-41 | Medium |

**Total Estimated: 121-154 hours**

## Implementation Order

### Phase 1: Foundation (Weeks 1-3)
1. **AI-001** - Project scaffolding with AI
   - Establishes Anthropic API integration
   - Creates core AI services
   - Delivers immediate user value

### Phase 2: In-Editor Intelligence (Weeks 4-6)
2. **AI-002** - Component suggestions
   - Context-aware recommendations
   - Pattern library foundation
3. **AI-003** - Natural language editing
   - Command palette for AI edits
   - Change preview and application

### Phase 3: Design Quality (Weeks 7-8)
4. **AI-004** - Design assistance
   - Automated design review
   - Polish and improvements

## Existing Infrastructure

### AiAssistantModel

```typescript
// Current AI node system
class AiAssistantModel {
  templates: AiTemplate[];  // REST, Function, Form Validation, etc.
  
  createNode(templateId, parentModel, pos);
  createContext(node);
  send(context);
}
```

### AI Templates

```typescript
docsTemplates = [
  { label: 'REST API', template: 'rest' },
  { label: 'Form Validation', template: 'function-form-validation' },
  { label: 'AI Function', template: 'function' },
  { label: 'Write to database', template: 'function-crud' }
];
```

### Template Registry

```typescript
// Project template system
templateRegistry.list({});  // List available templates
templateRegistry.download({ templateUrl });  // Download template
```

### LocalProjectsModel

```typescript
// Project creation
LocalProjectsModel.newProject(callback, {
  name,
  path,
  projectTemplate
});
```

## New Architecture

### Core AI Services

```
packages/noodl-editor/src/editor/src/services/
├── ai/
│   ├── AnthropicClient.ts       # Claude API wrapper
│   ├── prompts/                  # Prompt templates
│   │   ├── scaffolding.ts
│   │   ├── suggestions.ts
│   │   └── editing.ts
│   ├── ContextAnalyzer.ts       # Component analysis
│   ├── PatternLibrary.ts        # Known patterns
│   ├── CommandParser.ts         # NL command parsing
│   ├── ChangeGenerator.ts       # Generate changes
│   └── analyzers/               # Design analyzers
│       ├── AccessibilityAnalyzer.ts
│       ├── ConsistencyAnalyzer.ts
│       └── ...
├── AiScaffoldingService.ts
├── AiSuggestionService.ts
├── NaturalLanguageService.ts
└── DesignAnalysisService.ts
```

### Service Hierarchy

| Service | Purpose |
|---------|---------|
| AnthropicClient | Claude API communication |
| AiScaffoldingService | Project generation |
| AiSuggestionService | Context-aware suggestions |
| NaturalLanguageService | Command parsing & execution |
| DesignAnalysisService | Design review & fixes |

## API Integration

### Anthropic Client

```typescript
class AnthropicClient {
  private apiKey: string;
  private model = 'claude-sonnet-4-20250514';
  
  async complete(prompt: string, options?: CompletionOptions): Promise<string>;
  async chat(messages: Message[]): Promise<Message>;
  async stream(prompt: string, onChunk: (chunk: string) => void): Promise<void>;
}
```

### API Key Management

```typescript
// Settings storage
interface AiSettings {
  apiKey: string;  // Stored securely
  enabled: boolean;
  features: {
    scaffolding: boolean;
    suggestions: boolean;
    naturalLanguage: boolean;
    designAssistance: boolean;
  };
}
```

## Key User Flows

### 1. Create Project from Description

```
User opens "New Project"
    ↓
Selects "Describe your project"
    ↓
Types: "A task management app with kanban board"
    ↓
AI generates scaffold
    ↓
User previews & refines via chat
    ↓
Creates actual project
```

### 2. Get Suggestions While Building

```
User adds TextInput node
    ↓
System detects incomplete form pattern
    ↓
Shows suggestion: "Add form validation?"
    ↓
User clicks "Apply"
    ↓
Validation nodes added automatically
```

### 3. Edit with Natural Language

```
User selects Button node
    ↓
Presses Cmd+K
    ↓
Types: "Make it larger with a hover effect"
    ↓
Preview shows changes
    ↓
User clicks "Apply"
```

### 4. Design Review & Polish

```
User opens Design Review panel
    ↓
AI analyzes component
    ↓
Shows: "2 accessibility issues, 3 warnings"
    ↓
User clicks "Fix All" or "Polish"
    ↓
Changes applied automatically
```

## UI Components to Create

| Component | Package | Purpose |
|-----------|---------|---------|
| AiProjectModal | noodl-core-ui | Project scaffolding UI |
| ScaffoldPreview | noodl-core-ui | Preview generated structure |
| SuggestionHint | noodl-core-ui | Inline suggestion display |
| SuggestionPanel | noodl-core-ui | Full suggestions list |
| CommandPalette | noodl-core-ui | NL command input |
| ChangePreview | noodl-core-ui | Show pending changes |
| DesignReviewPanel | noodl-core-ui | Design issues list |
| PolishPreview | noodl-core-ui | Before/after comparison |

## Prompt Engineering

### System Prompts

```typescript
// Scaffolding
const SCAFFOLD_SYSTEM = `You are an expert Noodl application architect.
Generate detailed project scaffolds for visual low-code applications.
Consider: UX flow, data management, reusability, performance.`;

// Suggestions
const SUGGESTION_SYSTEM = `You analyze Noodl components and suggest
improvements. Focus on: pattern completion, best practices, 
common UI patterns, data handling.`;

// Natural Language
const NL_SYSTEM = `You parse natural language commands for editing
Noodl visual components. Output structured changes that can be
applied to the node graph.`;

// Design
const DESIGN_SYSTEM = `You are a design expert analyzing Noodl
components for accessibility, consistency, and visual quality.
Suggest concrete property changes.`;
```

### Context Serialization

```typescript
// Serialize component for AI context
function serializeForAi(component: ComponentModel): string {
  return JSON.stringify({
    name: component.name,
    nodes: component.nodes.map(n => ({
      type: n.type.localName,
      id: n.id,
      parameters: n.parameters,
      children: n.children?.map(c => c.id)
    })),
    connections: component.connections.map(c => ({
      from: `${c.sourceNode.id}.${c.sourcePort}`,
      to: `${c.targetNode.id}.${c.targetPort}`
    }))
  }, null, 2);
}
```

## Performance Considerations

### Token Management
- Keep prompts concise
- Truncate large components
- Cache common patterns locally
- Batch similar requests

### Response Times
- Scaffold generation: < 30 seconds
- Suggestions: < 500ms (local), < 3s (AI)
- NL parsing: < 3 seconds
- Design analysis: < 5 seconds

### Offline Support
- Local pattern library for suggestions
- Cached design rules
- Basic NL patterns
- Graceful degradation

## Settings & Configuration

```typescript
interface AiConfiguration {
  // API
  apiKey: string;
  apiEndpoint: string;  // For custom/proxy
  model: string;
  
  // Features
  features: {
    scaffolding: boolean;
    suggestions: boolean;
    naturalLanguage: boolean;
    designAssistance: boolean;
  };
  
  // Suggestions
  suggestions: {
    enabled: boolean;
    frequency: 'always' | 'sometimes' | 'manual';
    showInline: boolean;
    showPanel: boolean;
  };
  
  // Design
  design: {
    autoAnalyze: boolean;
    showInCanvas: boolean;
    strictAccessibility: boolean;
  };
}
```

## Testing Strategy

### Unit Tests
- Prompt generation
- Response parsing
- Pattern matching
- Change generation

### Integration Tests
- Full scaffold flow
- Suggestion pipeline
- NL command execution
- Design analysis

### Manual Testing
- Various project descriptions
- Edge case components
- Complex NL commands
- Accessibility scenarios

## Cline Usage Notes

### Before Starting Each Task

1. Read existing AI infrastructure:
   - `AiAssistantModel.ts`
   - Related AI components in `noodl-core-ui`
2. Understand prompt patterns from existing templates
3. Review how changes are applied to node graph

### Key Integration Points

1. **Node Graph**: All changes go through `NodeGraphModel`
2. **Undo/Redo**: Must integrate with `UndoManager`
3. **Project Model**: Scaffolds create full project structure
4. **Settings**: Store in `EditorSettings`

### API Key Handling

- Never log API keys
- Store securely (electron safeStorage)
- Clear from memory after use
- Support environment variable override

## Success Criteria (Series Complete)

1. ✅ Users can create projects from descriptions
2. ✅ Contextual suggestions appear while building
3. ✅ Natural language commands modify components
4. ✅ Design issues automatically detected
5. ✅ One-click fixes for common issues
6. ✅ Works offline with reduced functionality

## Future Work (Post-AI Series)

The AI series enables:
- **Voice Control**: Voice input for commands
- **Image to Project**: Screenshot to scaffold
- **Code Generation**: Export to React/Vue
- **AI Debugging**: Debug logic issues
- **Performance Optimization**: AI-suggested optimizations

## Files in This Series

- `AI-001-ai-project-scaffolding.md`
- `AI-002-ai-component-suggestions.md`
- `AI-003-natural-language-editing.md`
- `AI-004-ai-design-assistance.md`
- `AI-OVERVIEW.md` (this file)

## External Dependencies

### Anthropic API
- Model: claude-sonnet-4-20250514 (default)
- Rate limits: Handle gracefully
- Costs: Optimize token usage

### No Additional Packages Required
- Uses existing HTTP infrastructure
- No additional AI libraries needed
