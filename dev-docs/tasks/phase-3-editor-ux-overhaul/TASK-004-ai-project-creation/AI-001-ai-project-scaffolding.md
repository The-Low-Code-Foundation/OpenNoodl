# AI-001: AI Project Scaffolding

## Overview

Enable users to describe their project idea in natural language and have AI generate a complete project scaffold with pages, components, data models, and basic styling. This transforms the "blank canvas" experience into an intelligent starting point.

## Context

Currently, project creation offers:
- Blank "Hello World" template
- Pre-built template gallery (limited selection)
- Manual component-by-component building

New users face a steep learning curve:
- Don't know where to start
- Overwhelmed by node options
- No guidance on structure

AI scaffolding provides:
- Describe idea → Get working structure
- Industry best practices baked in
- Learning through example
- Faster time-to-prototype

### Existing Infrastructure

From `AiAssistantModel.ts`:
```typescript
// Existing AI templates
docsTemplates = [
  { label: 'REST API', template: 'rest' },
  { label: 'Form Validation', template: 'function-form-validation' },
  { label: 'AI Function', template: 'function' },
  // ...
]
```

From `TemplateRegistry`:
```typescript
// Download and extract project templates
templateRegistry.download({ templateUrl }) → zipPath
```

From `LocalProjectsModel`:
```typescript
// Create new project from template
newProject(callback, { name, path, projectTemplate })
```

## Requirements

### Functional Requirements

1. **Natural Language Input**
   - Free-form text description of project
   - Example prompts for inspiration
   - Clarifying questions from AI
   - Refinement through conversation

2. **Project Analysis**
   - Identify project type (app, dashboard, form, etc.)
   - Extract features and functionality
   - Determine data models needed
   - Suggest appropriate structure

3. **Scaffold Generation**
   - Create page structure
   - Generate component hierarchy
   - Set up navigation flow
   - Create placeholder data models
   - Apply appropriate styling

4. **Preview & Refinement**
   - Preview generated structure before creation
   - Modify/refine via chat
   - Accept or regenerate parts
   - Explain what was generated

5. **Project Creation**
   - Create actual Noodl project
   - Import generated components
   - Set up routing/navigation
   - Open in editor

### Non-Functional Requirements

- Generation completes in < 30 seconds
- Works with Claude API (Anthropic)
- Graceful handling of API errors
- Clear progress indication
- Cost-effective token usage

## Technical Approach

### 1. AI Scaffolding Service

```typescript
// packages/noodl-editor/src/editor/src/services/AiScaffoldingService.ts

interface ProjectDescription {
  rawText: string;
  clarifications?: Record<string, string>;
}

interface ScaffoldResult {
  projectType: ProjectType;
  pages: PageDefinition[];
  components: ComponentDefinition[];
  dataModels: DataModelDefinition[];
  navigation: NavigationDefinition;
  styling: StylingDefinition;
  explanation: string;
}

interface PageDefinition {
  name: string;
  route: string;
  description: string;
  components: string[];  // Component names used
  layout: 'stack' | 'grid' | 'sidebar' | 'tabs';
}

interface ComponentDefinition {
  name: string;
  type: 'visual' | 'logic' | 'data';
  description: string;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  children?: ComponentDefinition[];
  prefab?: string;  // Use existing prefab if available
}

class AiScaffoldingService {
  private static instance: AiScaffoldingService;
  
  // Main flow
  async analyzeDescription(description: string): Promise<AnalysisResult>;
  async generateScaffold(description: ProjectDescription): Promise<ScaffoldResult>;
  async refineScaffold(scaffold: ScaffoldResult, feedback: string): Promise<ScaffoldResult>;
  
  // Project creation
  async createProject(scaffold: ScaffoldResult, name: string, path: string): Promise<ProjectModel>;
  
  // Conversation
  async askClarification(description: string): Promise<ClarificationQuestion[]>;
  async chat(messages: ChatMessage[]): Promise<ChatResponse>;
}
```

### 2. Prompt Engineering

```typescript
// packages/noodl-editor/src/editor/src/services/ai/prompts/scaffolding.ts

const SYSTEM_PROMPT = `You are an expert Noodl application architect. 
Your task is to analyze project descriptions and generate detailed scaffolds
for visual low-code applications.

Noodl is a visual programming platform with:
- Pages (screens/routes)
- Components (reusable UI elements)
- Nodes (visual programming blocks)
- Data models (objects, arrays, variables)
- Logic nodes (conditions, loops, functions)

When generating scaffolds, consider:
1. User experience and navigation flow
2. Data management and state
3. Reusability of components
4. Mobile-first responsive design
5. Performance and loading states

Output JSON following the ScaffoldResult schema.`;

const ANALYSIS_PROMPT = `Analyze this project description and identify:
1. Project type (app, dashboard, form, e-commerce, etc.)
2. Main features/functionality
3. User roles/personas
4. Data entities needed
5. Key user flows
6. Potential complexity areas

Description: {description}`;

const SCAFFOLD_PROMPT = `Generate a complete Noodl project scaffold for:

Project Type: {projectType}
Features: {features}
Data Models: {dataModels}

Create:
1. Page structure with routes
2. Component hierarchy
3. Navigation flow
4. Data model definitions
5. Styling theme

Use these available prefabs when appropriate:
{availablePrefabs}`;
```

### 3. Scaffold to Project Converter

```typescript
// packages/noodl-editor/src/editor/src/services/ai/ScaffoldConverter.ts

class ScaffoldConverter {
  // Convert scaffold definitions to actual Noodl components
  async convertToProject(scaffold: ScaffoldResult): Promise<ProjectFiles> {
    const project = new ProjectModel();
    
    // Create pages
    for (const page of scaffold.pages) {
      const pageComponent = await this.createPage(page);
      project.addComponent(pageComponent);
    }
    
    // Create reusable components
    for (const component of scaffold.components) {
      const comp = await this.createComponent(component);
      project.addComponent(comp);
    }
    
    // Set up navigation
    await this.setupNavigation(project, scaffold.navigation);
    
    // Apply styling
    await this.applyStyles(project, scaffold.styling);
    
    return project;
  }
  
  private async createPage(page: PageDefinition): Promise<ComponentModel> {
    // Create component with page layout
    const component = ComponentModel.create({
      name: page.name,
      type: 'page'
    });
    
    // Add layout container based on page.layout
    const layout = this.createLayout(page.layout);
    component.addChild(layout);
    
    // Add referenced components
    for (const compName of page.components) {
      const ref = this.createComponentReference(compName);
      layout.addChild(ref);
    }
    
    return component;
  }
  
  private async createComponent(def: ComponentDefinition): Promise<ComponentModel> {
    // Check if we can use a prefab
    if (def.prefab) {
      return await this.importPrefab(def.prefab, def);
    }
    
    // Create custom component
    const component = ComponentModel.create({
      name: def.name,
      type: def.type
    });
    
    // Add ports
    for (const input of def.inputs) {
      component.addInput(input);
    }
    for (const output of def.outputs) {
      component.addOutput(output);
    }
    
    // Add children
    if (def.children) {
      for (const child of def.children) {
        const childComp = await this.createComponent(child);
        component.addChild(childComp);
      }
    }
    
    return component;
  }
}
```

### 4. UI Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ Create New Project                                            [×]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ○ Start from scratch                                               │
│ ○ Use a template                                                    │
│ ● Describe your project (AI)                                       │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Describe what you want to build...                              │ │
│ │                                                                 │ │
│ │ I want to build a task management app where users can create   │ │
│ │ projects, add tasks with due dates, and track progress with    │ │
│ │ a kanban board view.                                           │ │
│ │                                                                 │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ 💡 Examples:                                                        │
│ • "A recipe app with categories and favorites"                     │
│ • "An e-commerce dashboard with sales charts"                      │
│ • "A booking system for a salon"                                   │
│                                                                     │
│                                       [Cancel]  [Generate Project]  │
└─────────────────────────────────────────────────────────────────────┘
```

### 5. Preview & Refinement

```
┌─────────────────────────────────────────────────────────────────────┐
│ Project Preview                                               [×]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ STRUCTURE                           │ CHAT                          │
│ ┌─────────────────────────────────┐ │ ┌─────────────────────────────┐│
│ │ 📁 Pages                        │ │ │ 🤖 I've created a task     ││
│ │   📄 HomePage                   │ │ │ management app with:        ││
│ │   📄 ProjectsPage               │ │ │                             ││
│ │   📄 KanbanBoard                │ │ │ • 4 pages for navigation    ││
│ │   📄 TaskDetail                 │ │ │ • Kanban board component    ││
│ │                                 │ │ │ • Task and Project models   ││
│ │ 📁 Components                   │ │ │ • Drag-and-drop ready       ││
│ │   🧩 TaskCard                   │ │ │                             ││
│ │   🧩 KanbanColumn               │ │ │ Want me to add anything?    ││
│ │   🧩 ProjectCard                │ │ ├─────────────────────────────┤│
│ │   🧩 NavBar                     │ │ │ Add a calendar view too     ││
│ │                                 │ │ │                        [Send]││
│ │ 📁 Data Models                  │ │ └─────────────────────────────┘│
│ │   📊 Task                       │ │                                │
│ │   📊 Project                    │ │                                │
│ │   📊 User                       │ │                                │
│ └─────────────────────────────────┘ │                                │
│                                                                     │
│                          [Regenerate]  [Edit Manually]  [Create]   │
└─────────────────────────────────────────────────────────────────────┘
```

## Files to Create

1. `packages/noodl-editor/src/editor/src/services/AiScaffoldingService.ts`
2. `packages/noodl-editor/src/editor/src/services/ai/prompts/scaffolding.ts`
3. `packages/noodl-editor/src/editor/src/services/ai/ScaffoldConverter.ts`
4. `packages/noodl-editor/src/editor/src/services/ai/AnthropicClient.ts`
5. `packages/noodl-core-ui/src/components/modals/AiProjectModal/AiProjectModal.tsx`
6. `packages/noodl-core-ui/src/components/modals/AiProjectModal/ProjectDescriptionInput.tsx`
7. `packages/noodl-core-ui/src/components/modals/AiProjectModal/ScaffoldPreview.tsx`
8. `packages/noodl-core-ui/src/components/modals/AiProjectModal/RefinementChat.tsx`

## Files to Modify

1. `packages/noodl-editor/src/editor/src/views/projectsview.ts`
   - Add "Describe your project" option
   - Launch AiProjectModal

2. `packages/noodl-core-ui/src/preview/launcher/Launcher/Launcher.tsx`
   - Add AI project creation button

3. `packages/noodl-editor/src/editor/src/utils/LocalProjectsModel.ts`
   - Add `newProjectFromScaffold()` method

## Implementation Steps

### Phase 1: AI Infrastructure
1. Create AnthropicClient wrapper
2. Implement prompt templates
3. Set up API key management
4. Create scaffolding service skeleton

### Phase 2: Scaffold Generation
1. Implement analyzeDescription
2. Implement generateScaffold
3. Test with various descriptions
4. Refine prompts based on results

### Phase 3: Scaffold Converter
1. Implement page creation
2. Implement component creation
3. Implement navigation setup
4. Implement styling application

### Phase 4: UI - Input Phase
1. Create AiProjectModal
2. Create ProjectDescriptionInput
3. Add example prompts
4. Integrate with launcher

### Phase 5: UI - Preview Phase
1. Create ScaffoldPreview
2. Create structure tree view
3. Create RefinementChat
4. Add edit/regenerate actions

### Phase 6: Project Creation
1. Implement createProject
2. Handle prefab imports
3. Open project in editor
4. Show success/onboarding

## Testing Checklist

- [ ] Description analysis extracts features correctly
- [ ] Scaffold generation produces valid structure
- [ ] Prefabs used when appropriate
- [ ] Converter creates valid components
- [ ] Pages have correct routing
- [ ] Navigation works between pages
- [ ] Styling applied consistently
- [ ] Refinement chat updates scaffold
- [ ] Project opens in editor
- [ ] Error handling for API failures
- [ ] Rate limiting handled gracefully

## Dependencies

- Anthropic API access (Claude)
- COMP-002 (Built-in Prefabs) - for scaffold components

## Blocked By

- None (can start immediately)

## Blocks

- AI-002 (Component Suggestions)
- AI-003 (Natural Language Editing)

## Estimated Effort

- AI infrastructure: 4-5 hours
- Scaffold generation: 6-8 hours
- Scaffold converter: 6-8 hours
- UI input phase: 4-5 hours
- UI preview phase: 5-6 hours
- Project creation: 3-4 hours
- Testing & refinement: 4-5 hours
- **Total: 32-41 hours**

## Success Criteria

1. Users can describe project in natural language
2. AI generates appropriate structure
3. Preview shows clear scaffold
4. Refinement chat enables adjustments
5. Created project is functional
6. Time from idea to working scaffold < 2 minutes

## Example Prompts & Outputs

### Example 1: Task Manager

**Input:** "A task management app where users can create projects, add tasks with due dates, and track progress with a kanban board"

**Output:**
- Pages: Home, Projects, Kanban, TaskDetail
- Components: TaskCard, KanbanColumn, ProjectCard, NavBar
- Data: Task (title, description, dueDate, status), Project (name, tasks[])

### Example 2: Recipe App

**Input:** "A recipe app with categories, favorites, and a shopping list generator"

**Output:**
- Pages: Home, Categories, RecipeDetail, Favorites, ShoppingList
- Components: RecipeCard, CategoryTile, IngredientList, AddToFavoritesButton
- Data: Recipe, Category, Ingredient, ShoppingItem

## Future Enhancements

- Voice input for description
- Screenshot/mockup to scaffold
- Integration with design systems
- Multi-language support
- Template learning from user projects
