# Template System Documentation

This directory contains the embedded project template system implemented in TASK-009.

## Overview

The template system allows creating new Noodl projects from pre-defined templates that are embedded directly in the application code. This ensures templates work reliably in both development and production without file path resolution issues.

## Architecture

```
models/template/
├── ProjectTemplate.ts           # TypeScript interfaces for templates
├── EmbeddedTemplateProvider.ts  # Provider for embedded templates
├── createFromTemplate.ts        # What a new project directory gets, and in what order
├── templates/                   # Template definitions
│   └── hello-world.template.ts  # Default Hello World template
└── README.md                    # This file
```

## How It Works

1. **Template Definition**: Templates are defined as TypeScript objects using the `ProjectTemplate` interface
2. **Provider Registration**: The `EmbeddedTemplateProvider` is registered in `utils/forge/index.ts`, which is the only
   place the set of providers is composed
3. **Template Usage**: When creating a new project, templates are referenced via `embedded://template-id` URLs
4. **Project Creation**: `LocalProjectsModel.newProject` calls `createProjectFromTemplate`, which asks
   `templateRegistry.install(url, directory)` for the template, then adds the starter assets and the agent
   configuration. The provider writes the template's `project.json` directly into the project directory.

### 🔴 What changed in FB-005 T1 (2026-08-26)

This document used to describe step 3 as something you could do, and you could not. `newProject` had two
branches: an `if (projectTemplate)` branch that went through `templateRegistry`, and an `else` that
constructed an `EmbeddedTemplateProvider` directly and bypassed it. The single caller passed
`projectTemplate: ''` — falsy — so **the registry branch never ran**, and had it run it would have failed:
`TemplateRegistry.download` fetched a **zip** to a path and unzipped it next door, while
`EmbeddedTemplateProvider` writes a `project.json` **into a directory**. Both are
`(url: string, destination: string) => Promise<void>`, so nothing caught it.

A type signature is not a contract. The method is now called `install`, its contract is written down on
`ITemplateProvider`, the zip transport and its three providers are deleted, and `newProject` has one branch.
The recipe in "Step 3" below now works. `tests-unit/fb-005/template-install-path.test.ts` grades the chain
from the wizard to the registry, because a spec over the registry alone stayed green through all of it.

### ✅ What FB-005 T3 added (2026-08-26)

Two things, and the first is the one that had been missing since the registry was written.

1. **A picker.** `templateRegistry.list()` had zero callers; it now has one —
   `hooks/useProjectTemplates.ts`, feeding the create wizard's `template` mode. Adding a template to
   `EmbeddedTemplateProvider`'s map is finally a change a user can see.
2. **A second provider.** `PlatformTemplateProvider` offers the community's curated shelf under
   `community://<slug>`, so a template can reach a builder **without shipping a new editor**.

⚠️ **`TemplateRegistry.listing()` is what a user-facing surface should call**, not `list()`. `list()`
drops the providers that failed, and a shelf that is short because the network is down looks exactly
like a shelf that is short because nobody has published anything.

🔴 **The platform's category vocabulary is canonical, and that includes embedded templates.**
Ruled 2026-08-26 between FB-005 T4 and phase 76. An embedded `category` is a plain `string` and the
vocabulary is a CHECK constraint in another repository, so the type cannot enforce it — a spec does
(`EMBEDDED_TEMPLATE_CATEGORIES`, `tests-unit/fb-005/template-shelf.test.ts`). Use one of `starter`,
`data-app`, `dashboard`, `site`, `form`, `integration`.

⚠️ It was free text until the ruling, and `hello-world` said `'Getting Started'`. The picker draws
embedded and platform templates in **one list**, so T4's category facet bar would have shown a prose
title beside six slugs — as a facet of exactly one row.

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
    // Called with the project, or with nothing if it could not be created —
    // on every path, including a template that refused.
    console.log('Project created:', project);
  },
  {
    name: 'My Dashboard',
    projectTemplate: 'embedded://dashboard'
  }
);
```

Omitting `projectTemplate` (or passing `''`) uses `DEFAULT_PROJECT_TEMPLATE` from `utils/forge`, which is
`embedded://hello-world`.

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

## Adding a template source that is not embedded

Implement `ITemplateProvider` (`utils/forge/template/template.ts`) and register it in
`utils/forge/index.ts`. `install(url, destination)` must leave a loadable project in `destination`;
it is not a download hook, and there is no unzip step waiting downstream any more.

⚠️ **Templates that carry their own binaries do not travel yet.** The curated transport FB-005 builds on
(`stageBundleFiles`, from TUT-004) takes `Record<string, string>` — text only. See `FB-005-SCOPE.md` §3.

---

**Last Updated**: August 26, 2026  
**Related**: TASK-009-template-system-refactoring, FB-005 T1
