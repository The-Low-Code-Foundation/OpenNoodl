# TASK-002: Legacy Project Migration & Backward Compatibility

## Metadata

| Field | Value |
|-------|-------|
| **ID** | TASK-002 |
| **Phase** | Phase 1 - Foundation |
| **Priority** | 🔴 Critical |
| **Difficulty** | 🔴 Hard |
| **Estimated Time** | 5-7 days |
| **Prerequisites** | TASK-001 (Dependency Updates) |
| **Branch** | `task/002-legacy-project-migration` |

## Objective

Develop a robust migration system that ensures all existing Noodl projects created with older versions of the editor (and older dependency versions) can be imported into the updated OpenNoodl editor without breaking changes or data loss.

## Background

### Why This Task Is Critical

Many Noodl users have **production projects** that they've built over months or years using previous versions of the Noodl editor. These projects may rely on:

- Older React version behavior (React 17 and earlier)
- Deprecated node APIs
- Legacy project file formats
- Older dependency APIs (e.g., react-instantsearch-hooks-web vs react-instantsearch)
- Previous runtime behaviors

When we update dependencies in TASK-001 (React 17 → 19, etc.), we risk breaking these existing projects. **This is unacceptable** for our user base. A user should be able to:

1. Install the new OpenNoodl editor
2. Open their 3-year-old Noodl project
3. Have it work exactly as before (or with minimal guided fixes)

### The Stakes

- Users have business-critical applications built in Noodl
- Some users may have hundreds of hours invested in their projects
- Breaking backward compatibility could permanently lose users
- Our credibility as a fork depends on being a seamless upgrade path

### How This Fits Into The Bigger Picture

This task ensures TASK-001 (dependency updates) doesn't create orphaned projects. It's a safety net that must be in place before we can confidently ship updated dependencies.

## Current State

### What We Know
- Projects are stored as JSON files (graph definitions, components, etc.)
- The runtime interprets these files at runtime
- Different Noodl versions may have different:
  - Node definitions
  - Property types
  - Connection formats
  - Metadata schemas

### What We Don't Know Yet
- Exactly which project format versions exist in the wild
- How many breaking changes exist between versions
- Which node APIs have changed over time
- Whether there's existing version metadata in project files

### Research Needed
- [ ] Analyze project file structure
- [ ] Document all project file schemas
- [ ] Compare old vs new node definitions
- [ ] Identify all breaking changes from dependency updates

## Desired State

After this task is complete:

1. **Seamless Import**: Users can open any legacy Noodl project in the new editor
2. **Auto-Migration**: Projects are automatically upgraded to the new format when opened
3. **CLI Tool**: A command-line utility exists for batch migration and validation
4. **No Breaking Changes**: All existing node connections and logic work as before
5. **Clear Warnings**: If manual intervention is needed, users see clear guidance
6. **Backup Safety**: Original projects are backed up before migration
7. **Validation**: A test suite verifies migration works with sample projects

## Scope

### In Scope
- [ ] Document all Noodl project file formats
- [ ] Create a version detection system for projects
- [ ] Build a migration engine for auto-upgrading projects
- [ ] Develop a CLI tool for import/validation of legacy projects
- [ ] Create migration handlers for known breaking changes
- [ ] Build a validation test suite with sample projects
- [ ] Add user-facing warnings and guidance for edge cases
- [ ] Implement automatic backup before migration

### Out of Scope
- Creating new node types (that's feature work)
- Fixing bugs in legacy projects (that's user responsibility)
- Supporting unofficial Noodl forks
- Migrating cloud/backend configurations (separate concern)

## Technical Approach

### Phase 1: Research & Analysis

#### Key Areas to Investigate

| Area | Files to Examine | Goal |
|------|------------------|------|
| Project Structure | Sample `.noodl` project folders | Understand file organization |
| Graph Format | `*.json` graph files | Document schema |
| Node Definitions | `packages/noodl-runtime/src/nodes/` | Map all node types |
| Component Format | Component JSON files | Document structure |
| Metadata | Project metadata files | Find version indicators |

#### Questions to Answer
1. Where is project version stored? (if at all)
2. What changed between Noodl releases?
3. Which nodes have breaking API changes?
4. What React 17 → 19 patterns affect project files?

### Phase 2: Version Detection System

Create a system to identify what version of Noodl created a project:

```typescript
interface ProjectVersion {
  editorVersion: string;      // e.g., "2.8.0"
  formatVersion: string;      // e.g., "1.2"
  runtimeVersion: string;     // e.g., "1.0.0"
  detectedFeatures: string[]; // Feature flags found
}

function detectProjectVersion(projectPath: string): ProjectVersion {
  // 1. Check explicit version metadata
  // 2. Infer from file structure
  // 3. Infer from node usage patterns
  // 4. Default to "unknown/legacy"
}
```

### Phase 3: Migration Engine

Build a pluggable migration system:

```typescript
interface Migration {
  id: string;
  fromVersion: string;
  toVersion: string;
  description: string;
  migrate: (project: ProjectData) => ProjectData;
  validate: (project: ProjectData) => ValidationResult;
}

class MigrationEngine {
  private migrations: Migration[] = [];
  
  registerMigration(migration: Migration): void;
  getMigrationPath(from: string, to: string): Migration[];
  migrateProject(project: ProjectData, targetVersion: string): MigrationResult;
}
```

#### Known Migrations Needed

| From | To | Migration |
|------|-----|-----------|
| React 17 patterns | React 19 | Update any stored component patterns |
| Old node format | New node format | Transform node definitions |
| Legacy connections | New connections | Update connection schema |

### Phase 4: CLI Tool

Create a command-line tool for migration:

```bash
# Validate a project without modifying it
noodl-migrate validate ./my-project

# Migrate a project (creates backup first)
noodl-migrate upgrade ./my-project

# Migrate with specific target version
noodl-migrate upgrade ./my-project --to-version 3.0

# Batch migrate multiple projects
noodl-migrate batch-upgrade ./projects-folder

# Generate migration report
noodl-migrate report ./my-project > migration-report.md
```

#### CLI Implementation Location

```
packages/noodl-cli/
├── package.json
├── bin/
│   └── noodl-migrate.js
├── src/
│   ├── commands/
│   │   ├── validate.ts
│   │   ├── upgrade.ts
│   │   ├── batch-upgrade.ts
│   │   └── report.ts
│   ├── migrations/
│   │   ├── index.ts
│   │   ├── v17-to-v19-react.ts
│   │   ├── legacy-node-format.ts
│   │   └── ...
│   └── utils/
│       ├── backup.ts
│       ├── version-detect.ts
│       └── validation.ts
└── tests/
    └── ...
```

### Phase 5: Editor Integration

Integrate migration into the editor's project opening flow:

```typescript
// In project loading code
async function openProject(projectPath: string): Promise<Project> {
  const version = detectProjectVersion(projectPath);
  
  if (needsMigration(version)) {
    const result = await showMigrationDialog(projectPath, version);
    
    if (result === 'migrate') {
      await backupProject(projectPath);
      await migrateProject(projectPath);
    } else if (result === 'cancel') {
      return null;
    }
  }
  
  return loadProject(projectPath);
}
```

### Key Files to Create

| File | Purpose |
|------|---------|
| `packages/noodl-cli/` | New package for CLI tool |
| `packages/noodl-editor/src/editor/src/utils/migration/` | Migration engine |
| `packages/noodl-editor/src/editor/src/utils/migration/migrations/` | Individual migrations |
| `packages/noodl-editor/src/editor/src/views/MigrationDialog/` | UI for migration prompts |

### Key Files to Modify

| File | Changes |
|------|---------|
| `packages/noodl-editor/src/editor/src/models/projectmodel.js` | Add migration check on load |
| Various node definitions | Document version requirements |
| `package.json` (root) | Add noodl-cli workspace |

## Implementation Steps

### Step 1: Project Format Research (Day 1)

1. Collect sample projects from different Noodl versions
2. Document JSON schema for each file type
3. Identify version indicators in existing projects
4. Create comprehensive format documentation
5. Document in NOTES.md

### Step 2: Breaking Changes Audit (Day 1-2)

1. List all dependency updates from TASK-001
2. For each update, identify breaking changes
3. Map breaking changes to project file impact
4. Create migration requirement list
5. Update README with findings

### Step 3: Version Detection System (Day 2)

1. Create `ProjectVersion` type definitions
2. Implement version detection logic
3. Add fallback for unknown/legacy projects
4. Write unit tests for detection
5. Document in CHANGELOG.md

### Step 4: Migration Engine Core (Day 3)

1. Design migration interface
2. Implement `MigrationEngine` class
3. Create migration registration system
4. Build migration path calculator
5. Add rollback capability
6. Write unit tests

### Step 5: Individual Migrations (Day 3-4)

1. Create migration for React 17 → 19 patterns
2. Create migration for node format changes
3. Create migration for connection schema changes
4. Create migration for each identified breaking change
5. Write tests for each migration

### Step 6: CLI Tool (Day 4-5)

1. Create `noodl-cli` package structure
2. Implement `validate` command
3. Implement `upgrade` command
4. Implement `batch-upgrade` command
5. Implement `report` command
6. Add backup functionality
7. Write CLI tests
8. Create user documentation

### Step 7: Editor Integration (Day 5-6)

1. Create MigrationDialog component
2. Add migration check to project loading
3. Implement automatic backup
4. Add migration progress UI
5. Handle edge cases and errors
6. Manual testing

### Step 8: Validation & Testing (Day 6-7)

1. Create test project corpus (various versions)
2. Run migration on all test projects
3. Verify migrated projects work correctly
4. Fix any discovered issues
5. Document edge cases

## Testing Plan

### Unit Tests
- [ ] Version detection correctly identifies project versions
- [ ] Migration engine calculates correct migration paths
- [ ] Each individual migration transforms data correctly
- [ ] Backup system creates valid copies
- [ ] Rollback restores original state

### Integration Tests
- [ ] CLI tool works end-to-end
- [ ] Editor integration opens legacy projects
- [ ] Migration dialog flows work correctly
- [ ] Batch migration handles multiple projects

### Manual Testing Scenarios
- [ ] Open a project from Noodl 2.0
- [ ] Open a project from Noodl 2.5
- [ ] Open a project from the last official release
- [ ] Open a project with complex node graphs
- [ ] Open a project with custom components
- [ ] Verify all nodes still work after migration
- [ ] Verify all connections still work
- [ ] Verify preview renders correctly
- [ ] Test CLI on real legacy projects

### Test Project Corpus

Create or collect test projects representing:
- [ ] Minimal project (single page)
- [ ] Complex project (multiple pages, components)
- [ ] Project using deprecated nodes
- [ ] Project with custom JavaScript
- [ ] Project with cloud functions
- [ ] Project from each known Noodl version

## Success Criteria

- [ ] Any legacy Noodl project can be opened in the new editor
- [ ] Migration happens automatically without data loss
- [ ] CLI tool successfully migrates 100% of test corpus
- [ ] Users receive clear guidance if manual action needed
- [ ] Original projects are backed up before modification
- [ ] All migrated projects pass validation
- [ ] No runtime errors in migrated projects
- [ ] Documentation explains the migration process

## Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Unknown project formats exist | High | Medium | Comprehensive testing, graceful fallbacks |
| Some migrations are impossible | High | Low | Document limitations, provide manual guides |
| Performance issues with large projects | Medium | Medium | Streaming migration, progress indicators |
| Users don't understand prompts | Medium | Medium | Clear UX, detailed documentation |
| Edge cases cause data corruption | Critical | Low | Always backup first, validation checks |
| Can't find sample legacy projects | Medium | Medium | Reach out to community, create synthetic tests |

## Rollback Plan

If migration causes issues:

1. **User-level**: Restore from automatic backup
2. **System-level**: Revert migration code, keep projects in legacy mode
3. **Feature flag**: Add ability to disable auto-migration
4. **Support path**: Document manual migration steps for edge cases

## Open Questions

1. Do we have access to legacy Noodl projects for testing?
2. Is there documentation of past Noodl version changes?
3. Should we support projects from unofficial Noodl forks?
4. What's the oldest Noodl version we need to support?
5. Should the CLI be a separate npm package or bundled?

## References

- TASK-001: Dependency Updates (lists breaking changes)
- Noodl project file documentation (if exists)
- React 19 migration guide
- Community feedback on pain points

## Notes for Future Developers

This task is **foundational** for OpenNoodl's success. Take the time to:
- Document everything you discover
- Be conservative with assumptions
- Test with real-world projects when possible
- Err on the side of not breaking things

If you're ever unsure whether a change might break legacy projects, **don't make it** without adding a migration path first.
