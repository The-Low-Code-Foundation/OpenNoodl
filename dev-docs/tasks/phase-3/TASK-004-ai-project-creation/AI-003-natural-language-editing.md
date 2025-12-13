# AI-003: Natural Language Editing

## Overview

Enable users to modify their projects using natural language commands. Instead of manually finding and configuring nodes, users can say "make this button blue" or "add a loading spinner when fetching data" and have AI make the changes.

## Context

Current editing workflow:
1. Select node in canvas
2. Find property in sidebar
3. Understand property options
4. Make change
5. Repeat for related nodes

Natural language editing:
1. Select component or node
2. Describe what you want
3. AI makes the changes
4. Review and accept/modify

This is especially powerful for:
- Styling changes across multiple elements
- Logic modifications that span nodes
- Refactoring component structure
- Complex multi-step changes

### Existing AI Foundation

From `AiAssistantModel.ts`:
```typescript
// Chat history for AI interactions
class ChatHistory {
  messages: ChatMessage[];
  add(message: ChatMessage): void;
}

// AI context per node
class AiCopilotContext {
  template: AiTemplate;
  chatHistory: ChatHistory;
  node: NodeGraphNode;
}
```

## Requirements

### Functional Requirements

1. **Command Input**
   - Command palette (Cmd+K style)
   - Inline text input on selection
   - Voice input (optional)
   - Recent commands history

2. **Command Understanding**
   - Style changes: "make it red", "add shadow"
   - Structure changes: "add a header", "wrap in a card"
   - Logic changes: "show loading while fetching"
   - Data changes: "sort by date", "filter active items"

3. **Change Preview**
   - Show what will change before applying
   - Highlight affected nodes
   - Before/after comparison
   - Explanation of changes

4. **Change Application**
   - Apply changes atomically
   - Support undo/redo
   - Handle errors gracefully
   - Learn from corrections

5. **Scope Selection**
   - Selected node(s) only
   - Current component
   - Related components
   - Entire project

### Non-Functional Requirements

- Response time < 3 seconds
- Changes are reversible
- Works on any component type
- Graceful degradation without API

## Technical Approach

### 1. Natural Language Command Service

```typescript
// packages/noodl-editor/src/editor/src/services/NaturalLanguageService.ts

interface CommandContext {
  selection: NodeGraphNode[];
  component: ComponentModel;
  project: ProjectModel;
  recentCommands: Command[];
}

interface Command {
  id: string;
  text: string;
  timestamp: Date;
  result: CommandResult;
}

interface CommandResult {
  success: boolean;
  changes: Change[];
  explanation: string;
  undoAction?: () => void;
}

interface Change {
  type: 'property' | 'node' | 'connection' | 'structure';
  target: string;
  before: any;
  after: any;
  description: string;
}

class NaturalLanguageService {
  private static instance: NaturalLanguageService;
  
  // Main API
  async parseCommand(text: string, context: CommandContext): Promise<ParsedCommand>;
  async previewChanges(command: ParsedCommand): Promise<ChangePreview>;
  async applyChanges(preview: ChangePreview): Promise<CommandResult>;
  async undoCommand(commandId: string): Promise<void>;
  
  // Command history
  getRecentCommands(): Command[];
  searchCommands(query: string): Command[];
  
  // Learning
  recordCorrection(commandId: string, correction: Change[]): void;
}
```

### 2. Command Parser

```typescript
// packages/noodl-editor/src/editor/src/services/ai/CommandParser.ts

interface ParsedCommand {
  intent: CommandIntent;
  targets: CommandTarget[];
  modifications: Modification[];
  confidence: number;
}

enum CommandIntent {
  STYLE_CHANGE = 'style_change',
  STRUCTURE_CHANGE = 'structure_change',
  LOGIC_CHANGE = 'logic_change',
  DATA_CHANGE = 'data_change',
  CREATE = 'create',
  DELETE = 'delete',
  CONNECT = 'connect',
  UNKNOWN = 'unknown'
}

interface CommandTarget {
  type: 'node' | 'component' | 'property' | 'connection';
  selector: string;  // How to find it
  resolved?: any;    // Actual reference
}

class CommandParser {
  private patterns: CommandPattern[];
  
  async parse(text: string, context: CommandContext): Promise<ParsedCommand> {
    // 1. Try local pattern matching first (fast)
    const localMatch = this.matchLocalPatterns(text);
    if (localMatch.confidence > 0.9) {
      return localMatch;
    }
    
    // 2. Use AI for complex commands
    const aiParsed = await this.aiParse(text, context);
    
    // 3. Merge and validate
    return this.mergeAndValidate(localMatch, aiParsed, context);
  }
  
  private matchLocalPatterns(text: string): ParsedCommand {
    // Pattern: "make [target] [color]"
    // Pattern: "add [element] to [target]"
    // Pattern: "connect [source] to [destination]"
    // etc.
  }
  
  private async aiParse(text: string, context: CommandContext): Promise<ParsedCommand> {
    const prompt = `Parse this Noodl editing command:
    Command: "${text}"
    
    Current selection: ${context.selection.map(n => n.type.localName).join(', ')}
    Component: ${context.component.name}
    
    Output JSON with: intent, targets, modifications`;
    
    const response = await this.anthropicClient.complete(prompt);
    return JSON.parse(response);
  }
}
```

### 3. Change Generator

```typescript
// packages/noodl-editor/src/editor/src/services/ai/ChangeGenerator.ts

class ChangeGenerator {
  // Generate actual changes from parsed command
  async generateChanges(command: ParsedCommand, context: CommandContext): Promise<Change[]> {
    const changes: Change[] = [];
    
    switch (command.intent) {
      case CommandIntent.STYLE_CHANGE:
        changes.push(...this.generateStyleChanges(command, context));
        break;
      case CommandIntent.STRUCTURE_CHANGE:
        changes.push(...await this.generateStructureChanges(command, context));
        break;
      case CommandIntent.LOGIC_CHANGE:
        changes.push(...await this.generateLogicChanges(command, context));
        break;
      // ...
    }
    
    return changes;
  }
  
  private generateStyleChanges(command: ParsedCommand, context: CommandContext): Change[] {
    const changes: Change[] = [];
    
    for (const target of command.targets) {
      const node = this.resolveTarget(target, context);
      
      for (const mod of command.modifications) {
        const propertyName = this.mapToNoodlProperty(mod.property);
        const newValue = this.parseValue(mod.value, propertyName);
        
        changes.push({
          type: 'property',
          target: node.id,
          before: node.parameters[propertyName],
          after: newValue,
          description: `Change ${propertyName} to ${newValue}`
        });
      }
    }
    
    return changes;
  }
  
  private async generateStructureChanges(
    command: ParsedCommand, 
    context: CommandContext
  ): Promise<Change[]> {
    // Use AI to generate node structure
    const prompt = `Generate Noodl node structure for:
    "${command.modifications.map(m => m.description).join(', ')}"
    
    Current context: ${JSON.stringify(context.selection.map(n => n.type.localName))}
    
    Output JSON array of nodes to create and connections`;
    
    const response = await this.anthropicClient.complete(prompt);
    return this.parseStructureResponse(response);
  }
}
```

### 4. UI Components

#### Command Palette

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🔮 What do you want to do?                                    [×]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Make the button larger and add a hover effect                  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ Selected: Button, Text                                             │
│                                                                     │
│ Recent:                                                             │
│ • "Add loading spinner to the form"                                │
│ • "Make all headers blue"                                          │
│ • "Connect the submit button to the API"                           │
│                                                                     │
│ Examples:                                                           │
│ • "Wrap this in a card with shadow"                                │
│ • "Add validation to all inputs"                                   │
│ • "Show error message when API fails"                              │
│                                                                     │
│                                                   [Preview Changes] │
└─────────────────────────────────────────────────────────────────────┘
```

#### Change Preview

```
┌─────────────────────────────────────────────────────────────────────┐
│ Preview Changes                                               [×]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Command: "Make the button larger and add a hover effect"           │
│                                                                     │
│ Changes to apply:                                                   │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ ✓ Button                                                        │ │
│ │   • width: 100px → 150px                                        │ │
│ │   • height: 40px → 50px                                         │ │
│ │   • fontSize: 14px → 16px                                       │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ + New: HoverState                                               │ │
│ │   • scale: 1.05                                                 │ │
│ │   • transition: 200ms                                           │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ 🤖 "I'll increase the button size by 50% and add a subtle scale   │
│    effect on hover with a smooth transition."                       │
│                                                                     │
│                          [Cancel]  [Modify]  [Apply Changes]       │
└─────────────────────────────────────────────────────────────────────┘
```

#### Inline Command

```
┌─────────────────────────────────────────────────────────────────────┐
│ Canvas                                                              │
│                                                                     │
│   ┌─────────────────┐                                              │
│   │    [Button]     │ ← Selected                                   │
│   │   Click me      │                                              │
│   └─────────────────┘                                              │
│          │                                                          │
│   ┌──────┴──────────────────────────────────────────────┐          │
│   │ 🔮 Make it red with rounded corners        [Enter] │          │
│   └─────────────────────────────────────────────────────┘          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 5. Command Patterns

```typescript
// packages/noodl-editor/src/editor/src/services/ai/CommandPatterns.ts

const COMMAND_PATTERNS: CommandPattern[] = [
  // Style patterns
  {
    pattern: /make (?:it |this |the )?(.+?) (red|blue|green|...)/i,
    intent: CommandIntent.STYLE_CHANGE,
    extract: (match) => ({
      target: match[1] || 'selection',
      property: 'backgroundColor',
      value: match[2]
    })
  },
  {
    pattern: /(?:set |change )?(?:the )?(.+?) (?:to |=) (.+)/i,
    intent: CommandIntent.STYLE_CHANGE,
    extract: (match) => ({
      property: match[1],
      value: match[2]
    })
  },
  
  // Structure patterns
  {
    pattern: /add (?:a |an )?(.+?) (?:to |inside |in) (.+)/i,
    intent: CommandIntent.STRUCTURE_CHANGE,
    extract: (match) => ({
      nodeType: match[1],
      target: match[2]
    })
  },
  {
    pattern: /wrap (?:it |this |selection )?in (?:a |an )?(.+)/i,
    intent: CommandIntent.STRUCTURE_CHANGE,
    extract: (match) => ({
      action: 'wrap',
      wrapper: match[1]
    })
  },
  
  // Logic patterns
  {
    pattern: /show (.+?) when (.+)/i,
    intent: CommandIntent.LOGIC_CHANGE,
    extract: (match) => ({
      action: 'conditional_show',
      target: match[1],
      condition: match[2]
    })
  },
  {
    pattern: /connect (.+?) to (.+)/i,
    intent: CommandIntent.CONNECT,
    extract: (match) => ({
      source: match[1],
      destination: match[2]
    })
  }
];
```

## Files to Create

1. `packages/noodl-editor/src/editor/src/services/NaturalLanguageService.ts`
2. `packages/noodl-editor/src/editor/src/services/ai/CommandParser.ts`
3. `packages/noodl-editor/src/editor/src/services/ai/ChangeGenerator.ts`
4. `packages/noodl-editor/src/editor/src/services/ai/CommandPatterns.ts`
5. `packages/noodl-core-ui/src/components/ai/CommandPalette/CommandPalette.tsx`
6. `packages/noodl-core-ui/src/components/ai/ChangePreview/ChangePreview.tsx`
7. `packages/noodl-core-ui/src/components/ai/InlineCommand/InlineCommand.tsx`

## Files to Modify

1. `packages/noodl-editor/src/editor/src/views/nodegrapheditor.js`
   - Add command palette trigger (Cmd+K)
   - Add inline command on selection
   - Handle change application

2. `packages/noodl-editor/src/editor/src/pages/EditorPage/EditorPage.tsx`
   - Add keyboard shortcut handler
   - Mount command palette

3. `packages/noodl-editor/src/editor/src/models/NodeGraphModel.ts`
   - Add atomic change application
   - Support undo for AI changes

## Implementation Steps

### Phase 1: Command Infrastructure
1. Create NaturalLanguageService
2. Implement command history
3. Set up undo/redo support

### Phase 2: Command Parser
1. Create CommandParser
2. Define local patterns
3. Implement AI parsing
4. Test parsing accuracy

### Phase 3: Change Generator
1. Create ChangeGenerator
2. Implement style changes
3. Implement structure changes
4. Implement logic changes

### Phase 4: UI - Command Palette
1. Create CommandPalette component
2. Add keyboard shortcut
3. Show recent/examples
4. Handle input

### Phase 5: UI - Change Preview
1. Create ChangePreview component
2. Show before/after
3. Add explanation
4. Handle apply/cancel

### Phase 6: UI - Inline Command
1. Create InlineCommand component
2. Position near selection
3. Handle quick commands

### Phase 7: Learning & Improvement
1. Track command success
2. Record corrections
3. Improve pattern matching

## Testing Checklist

- [ ] Style commands work correctly
- [ ] Structure commands create nodes
- [ ] Logic commands set up conditions
- [ ] Preview shows accurate changes
- [ ] Apply actually makes changes
- [ ] Undo reverts changes
- [ ] Keyboard shortcuts work
- [ ] Recent commands saved
- [ ] Error handling graceful
- [ ] Complex commands work
- [ ] Multi-target commands work

## Dependencies

- AI-001 (AI Project Scaffolding) - for AnthropicClient
- AI-002 (Component Suggestions) - for context analysis

## Blocked By

- AI-001

## Blocks

- AI-004 (AI Design Assistance)

## Estimated Effort

- Command service: 4-5 hours
- Command parser: 5-6 hours
- Change generator: 6-8 hours
- UI command palette: 4-5 hours
- UI change preview: 4-5 hours
- UI inline command: 3-4 hours
- Testing & refinement: 4-5 hours
- **Total: 30-38 hours**

## Success Criteria

1. Natural language commands understood
2. Preview shows accurate changes
3. Changes applied correctly
4. Undo/redo works
5. < 3 second response time
6. 80%+ command success rate

## Command Examples

### Style Changes
- "Make it red"
- "Add a shadow"
- "Increase font size to 18"
- "Round the corners"
- "Make all buttons blue"

### Structure Changes
- "Add a header"
- "Wrap in a card"
- "Add a loading spinner"
- "Create a sidebar"
- "Split into two columns"

### Logic Changes
- "Show loading while fetching"
- "Hide when empty"
- "Disable until form is valid"
- "Navigate to home on click"
- "Show error message on failure"

### Data Changes
- "Sort by date"
- "Filter completed items"
- "Group by category"
- "Limit to 10 items"

## Future Enhancements

- Voice input
- Multi-language support
- Command macros
- Batch changes
- Command sharing
- Context-aware autocomplete
