# Template System Documentation

This directory contains the embedded project template system implemented in TASK-009.

## Overview

The template system allows creating new Noodl projects from pre-defined templates that are embedded directly in the application code. This ensures templates work reliably in both development and production without file path resolution issues.

## Architecture

```
models/template/
├── ProjectTemplate.ts           # TypeScript interfaces for templates
├── EmbeddedTemplateProvider.ts  # Provider for embedded templates
├── templates/                   # Template definitions
│   └── hello-world.template.ts  # Default Hello World template
└── README.md                    # This file
```

## How It Works

1. **Template Definition**: Templates are defined as TypeScript objects using the `ProjectTemplate` interface
2. **Provider Registration**: The `EmbeddedTemplateProvider` is registered in `utils/forge/index.ts` with the highest priority
3. **Template Usage**: When creating a new project, templates are referenced via `embedded://template-id` URLs
4. **Project Creation**: The provider writes the template's `project.json` directly to the destination directory

## Creating a New Template

### Step 1: Define Your Template

Create a new file in `templates/` (e.g., `dashboard.template.ts`):

```typescript
import { ProjectTemplate } from '../ProjectTemplate';

export const dashboardTemplate: ProjectTemplate = {
  id: 'dashboard',
  name: 'Dashboard Template',
  description: 'A dashboard with navigation and multiple pages',
  category: 'Business Apps',
  version: '1.0.0',
  thumbnail: undefined,

  content: {
    name: 'Dashboard Project',
    components: [
      // Define your components here
      {
        name: 'App',
        visual: true,
        ports: [],
        visualStateTransitions: [],
        graph: {
          roots: [
            // Add your nodes here
          ],
          connections: []
        }
      }
    ],
    settings: {},
    metadata: {
      title: 'Dashboard Project',
      description: 'A complete dashboard template'
    }
  }
};
```

### Step 2: Register the Template

Add your template to `EmbeddedTemplateProvider.ts`:

```typescript
import { dashboardTemplate } from './templates/dashboard.template';

export class EmbeddedTemplateProvider implements ITemplateProvider {
  private templates: Map<string, ProjectTemplate> = new Map([
    ['hello-world', helloWorldTemplate],
    ['dashboard', dashboardTemplate] // Add your template here
  ]);
  // ...
}
```

### Step 3: Use Your Template

Create a project with your template:

```typescript
LocalProjectsModel.instance.newProject(
  (project) => {
    console.log('Project created:', project);
  },
  {
    name: 'My Dashboard',
    projectTemplate: 'embedded://dashboard'
  }
);
```

## Template Structure Reference

### Component Definition

```typescript
{
  name: 'ComponentName',        // Component name (use '/#__page__/Name' for pages)
  visual: true,                 // Whether this is a visual component
  ports: [],                    // Component ports
  visualStateTransitions: [],   // State transitions
  graph: {
    roots: [/* nodes */],       // Root-level nodes
    connections: []             // Connections between nodes
  }
}
```

### Node Definition

```typescript
{
  id: generateId(),            // Unique node ID
  type: 'NodeType',           // Node type (e.g., 'Text', 'Group', 'PageRouter')
  x: 100,                     // X position on canvas
  y: 100,                     // Y position on canvas
  parameters: {               // Node parameters
    text: 'Hello',
    fontSize: { value: 16, unit: 'px' }
  },
  ports: [],                  // Node-specific ports
  children: []                // Child nodes (for visual hierarchy)
}
```

## Best Practices

1. **Use the Helper Function**: Use the `generateId()` function for generating unique IDs
2. **Structure Over Data**: Define component structure, not specific user data
3. **Minimal & Clear**: Keep templates simple and focused on structure
4. **Test Both Modes**: Test templates in both development and production builds
5. **Document Purpose**: Add JSDoc comments explaining what the template provides

## Default Template

When no template is specified in `newProject()`, the system automatically uses `embedded://hello-world` as the default template.

## Advantages Over Previous System

✅ **No Path Resolution Issues**: Templates are embedded in code, bundled by webpack  
✅ **Dev/Prod Parity**: Works identically in development and production  
✅ **Type Safety**: Full TypeScript support with interfaces  
✅ **Easy to Extend**: Add new templates by creating a file and registering it  
✅ **No External Dependencies**: No need for external template files or URLs

## Migration from Old System

The old system used:

- Programmatic project creation (JSON literal in code)
- File-based templates (with path resolution issues)
- External template URLs

The new system:

- Uses embedded template objects
- Provides a consistent API via `templateRegistry`
- Maintains backward compatibility with external template URLs

---

**Last Updated**: January 9, 2026  
**Related**: TASK-009-template-system-refactoring
