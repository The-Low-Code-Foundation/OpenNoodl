# TASK-009: Template System Refactoring

**Status**: 📋 Planned  
**Priority**: Medium  
**Complexity**: Medium  
**Estimated Effort**: 2-3 days

## Context

The current project template system has several issues:

- Path resolution fails in webpack bundles (`__dirname` doesn't work correctly)
- No proper template provider for local/bundled templates
- Template loading depends on external URLs or fragile file paths
- New projects currently use a programmatic workaround (minimal project.json generation)

## Current Temporary Solution

As of January 2026, new projects are created programmatically in `LocalProjectsModel.ts`:

```typescript
// Create a minimal Hello World project programmatically
const minimalProject = {
  name: name,
  components: [
    /* basic App component with Text node */
  ],
  settings: {},
  metadata: {
    /* ... */
  }
};
```

This works but is not ideal for:

- Creating rich starter templates
- Allowing custom/community templates
- Supporting multiple bundled templates (e.g., "Hello World", "Dashboard", "E-commerce")

## Goals

### Primary Goals

1. **Robust Template Loading**: Support templates in both development and production
2. **Local Templates**: Bundle templates with the editor that work reliably
3. **Template Gallery**: Support multiple built-in templates
4. **Custom Templates**: Allow users to create and share templates

### Secondary Goals

1. Template versioning and migration
2. Template metadata (screenshots, descriptions, categories)
3. Template validation before project creation
4. Template marketplace integration (future)

## Proposed Architecture

### 1. Template Storage Options

**Option A: Embedded Templates (Recommended)**

- Store templates as JSON structures in TypeScript files
- Import and use directly (no file I/O)
- Bundle with webpack automatically
- Example:

```typescript
export const helloWorldTemplate: ProjectTemplate = {
  name: 'Hello World',
  components: [
    /* ... */
  ],
  settings: {
    /* ... */
  }
};
```

**Option B: Asset-Based Templates**

- Store templates in `packages/noodl-editor/assets/templates/`
- Copy to build output during webpack build
- Use proper asset loading (webpack copy plugin)
- Access via runtime asset path resolution

**Option C: Hybrid Approach**

- Small templates: embedded in code
- Large templates: assets with proper bundling
- Choose based on template size/complexity

### 2. Template Provider Architecture

```typescript
interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  thumbnail?: string;

  // Template content
  components: ComponentDefinition[];
  settings: ProjectSettings;
  metadata?: Record<string, unknown>;
}

interface TemplateProvider {
  name: string;
  list(): Promise<ProjectTemplate[]>;
  get(id: string): Promise<ProjectTemplate>;
  canHandle(id: string): boolean;
}

class EmbeddedTemplateProvider implements TemplateProvider {
  // Returns templates bundled with the editor
}

class RemoteTemplateProvider implements TemplateProvider {
  // Fetches templates from Noodl docs/CDN
}

class LocalFileTemplateProvider implements TemplateProvider {
  // Loads templates from user's filesystem (for custom templates)
}
```

### 3. Template Manager

```typescript
class TemplateManager {
  private providers: TemplateProvider[];

  async listTemplates(filter?: TemplateFilter): Promise<ProjectTemplate[]> {
    // Aggregates from all providers
  }

  async getTemplate(id: string): Promise<ProjectTemplate> {
    // Finds the right provider and fetches template
  }

  async createProjectFromTemplate(template: ProjectTemplate, projectPath: string, projectName: string): Promise<void> {
    // Creates project structure from template
  }
}
```

## Implementation Plan

### Phase 1: Foundation (1 day)

- [ ] Define `ProjectTemplate` interface
- [ ] Create `TemplateProvider` interface
- [ ] Implement `EmbeddedTemplateProvider`
- [ ] Create `TemplateManager` class

### Phase 2: Built-in Templates (1 day)

- [ ] Convert current Hello World to embedded template
- [ ] Add "Blank" template (truly empty)
- [ ] Add "Dashboard" template (with nav + pages)
- [ ] Add template metadata and thumbnails

### Phase 3: Integration (0.5 days)

- [ ] Update `LocalProjectsModel` to use `TemplateManager`
- [ ] Remove programmatic project creation workaround
- [ ] Update project creation UI to show template gallery
- [ ] Add template preview/selection dialog

### Phase 4: Advanced Features (0.5 days)

- [ ] Implement template validation
- [ ] Add template export functionality (for users to create templates)
- [ ] Support template variables/parameters
- [ ] Add template upgrade/migration system

## Files to Modify

### New Files

- `packages/noodl-editor/src/editor/src/models/template/ProjectTemplate.ts`
- `packages/noodl-editor/src/editor/src/models/template/TemplateProvider.ts`
- `packages/noodl-editor/src/editor/src/models/template/TemplateManager.ts`
- `packages/noodl-editor/src/editor/src/models/template/providers/EmbeddedTemplateProvider.ts`
- `packages/noodl-editor/src/editor/src/models/template/templates/` (folder for template definitions)
  - `hello-world.ts`
  - `blank.ts`
  - `dashboard.ts`

### Existing Files to Update

- `packages/noodl-editor/src/editor/src/utils/LocalProjectsModel.ts`
  - Replace programmatic project creation with template system
- `packages/noodl-editor/src/editor/src/pages/ProjectsPage/ProjectsPage.tsx`
  - Add template selection UI
- `packages/noodl-editor/src/editor/src/utils/forge/` (might be refactored or replaced)

## Testing Strategy

### Unit Tests

- Template provider loading
- Template validation
- Project creation from template
- Template merging/variables

### Integration Tests

- Create project from each bundled template
- Verify all templates load correctly
- Test template provider fallback

### Manual Tests

- Create projects from templates in dev mode
- Create projects from templates in production build
- Verify all components and nodes are created correctly
- Test custom template import/export

## Success Criteria

- [ ] New projects can be created from bundled templates reliably
- [ ] Templates work identically in dev and production
- [ ] At least 3 high-quality bundled templates available
- [ ] Template system is extensible for future templates
- [ ] No file path resolution issues
- [ ] User can export their project as a template
- [ ] Documentation for creating custom templates

## Future Enhancements

- **Template Marketplace**: Browse and download community templates
- **Template Packages**: Include external dependencies/modules
- **Template Generator**: AI-powered template creation
- **Template Forking**: Modify and save as new template
- **Template Versioning**: Update templates without breaking existing projects

## References

- Current implementation: `packages/noodl-editor/src/editor/src/utils/LocalProjectsModel.ts` (lines 295-360)
- Failed attempt: `packages/noodl-editor/src/editor/src/utils/forge/template/providers/local-template-provider.ts`
- Template registry: `packages/noodl-editor/src/editor/src/utils/forge/index.ts`

## Related Tasks

- None yet (this is the first comprehensive template system task)

---

**Created**: January 8, 2026  
**Last Updated**: January 8, 2026  
**Assignee**: TBD
