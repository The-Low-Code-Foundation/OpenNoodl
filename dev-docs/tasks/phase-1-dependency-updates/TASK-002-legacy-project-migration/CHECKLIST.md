# TASK-002 Checklist: Legacy Project Migration

## Prerequisites
- [ ] Read README.md completely
- [ ] Understand the scope and success criteria
- [ ] Ensure TASK-001 (Dependency Updates) is complete or in progress
- [ ] Create branch: `git checkout -b task/002-legacy-project-migration`
- [ ] Verify build works: `npm run build:editor`

---

## Phase 1: Research & Discovery

### Project Format Analysis
- [ ] Locate sample Noodl projects (old versions)
- [ ] Document the folder structure of a `.noodl` project
- [ ] Identify all JSON file types within projects
- [ ] Document schema for each file type
- [ ] Check for existing version metadata in project files
- [ ] Update NOTES.md with findings

### Node Definition Analysis
- [ ] Catalog all node types in `packages/noodl-runtime/src/nodes/`
- [ ] Document input/output schemas for nodes
- [ ] Identify any deprecated node types
- [ ] Note any node API changes over versions
- [ ] Update NOTES.md with findings

### Breaking Changes Audit
- [ ] Review TASK-001 dependency update list
- [ ] For each updated dependency, identify breaking changes:
  - [ ] React 17 → 19 impacts
  - [ ] react-instantsearch changes
  - [ ] Other dependency changes
- [ ] Map breaking changes to project file impact
- [ ] Create comprehensive migration requirements list
- [ ] Update NOTES.md with findings

---

## Phase 2: Version Detection System

### Design
- [ ] Define `ProjectVersion` interface
- [ ] Define version detection strategy
- [ ] Document how to infer version from project structure

### Implementation
- [ ] Create `packages/noodl-editor/src/editor/src/utils/migration/` folder
- [ ] Create `version-detect.ts` module
- [ ] Implement explicit version metadata check
- [ ] Implement file structure inference
- [ ] Implement node usage pattern inference
- [ ] Add fallback for "unknown/legacy" projects

### Testing
- [ ] Write unit tests for version detection
- [ ] Test with sample projects from different versions
- [ ] Document in CHANGELOG.md

---

## Phase 3: Migration Engine Core

### Design
- [ ] Define `Migration` interface
- [ ] Define `MigrationResult` interface
- [ ] Design migration path calculation algorithm
- [ ] Document migration registration pattern

### Implementation
- [ ] Create `migration-engine.ts` module
- [ ] Implement `MigrationEngine` class
- [ ] Implement `registerMigration()` method
- [ ] Implement `getMigrationPath()` method
- [ ] Implement `migrateProject()` method
- [ ] Implement rollback capability
- [ ] Add progress reporting hooks

### Testing
- [ ] Write unit tests for migration engine
- [ ] Test migration path calculation
- [ ] Test rollback functionality
- [ ] Document in CHANGELOG.md

---

## Phase 4: Individual Migrations

### Migration: React 17 → 19 Patterns
- [ ] Identify all React-specific patterns in project files
- [ ] Create `v17-to-v19-react.ts` migration
- [ ] Write migration transform logic
- [ ] Write validation logic
- [ ] Write unit tests

### Migration: Node Format Changes (if needed)
- [ ] Identify node format changes between versions
- [ ] Create `node-format-update.ts` migration
- [ ] Write migration transform logic
- [ ] Write validation logic
- [ ] Write unit tests

### Migration: Connection Schema (if needed)
- [ ] Identify connection schema changes
- [ ] Create `connection-schema.ts` migration
- [ ] Write migration transform logic
- [ ] Write validation logic
- [ ] Write unit tests

### Additional Migrations (as discovered)
- [ ] Document each new migration needed
- [ ] Implement migrations as needed
- [ ] Write tests for each

---

## Phase 5: Backup System

### Implementation
- [ ] Create `backup.ts` utility module
- [ ] Implement `backupProject()` function
- [ ] Implement `restoreFromBackup()` function
- [ ] Implement backup verification (checksums)
- [ ] Implement backup cleanup/rotation

### Testing
- [ ] Test backup creates valid copy
- [ ] Test restore works correctly
- [ ] Test with large projects
- [ ] Document in CHANGELOG.md

---

## Phase 6: CLI Tool

### Package Setup
- [ ] Create `packages/noodl-cli/` directory structure
- [ ] Create `package.json` with dependencies
- [ ] Create `tsconfig.json`
- [ ] Set up build scripts
- [ ] Add to root workspace configuration

### Commands Implementation
- [ ] Implement `validate` command
  - [ ] Parse project path argument
  - [ ] Run version detection
  - [ ] Report findings
  - [ ] Return exit code
- [ ] Implement `upgrade` command
  - [ ] Parse arguments (project path, options)
  - [ ] Create backup
  - [ ] Run migrations
  - [ ] Report results
- [ ] Implement `batch-upgrade` command
  - [ ] Parse folder argument
  - [ ] Discover all projects
  - [ ] Process each project
  - [ ] Generate summary report
- [ ] Implement `report` command
  - [ ] Analyze project
  - [ ] Generate markdown report
  - [ ] Output to stdout

### CLI UX
- [ ] Add help messages for all commands
- [ ] Add `--dry-run` option
- [ ] Add `--verbose` option
- [ ] Add `--no-backup` option (with warning)
- [ ] Add progress indicators
- [ ] Add colored output

### Testing
- [ ] Write integration tests for CLI
- [ ] Test each command
- [ ] Test error handling
- [ ] Document in CHANGELOG.md

### Documentation
- [ ] Create CLI README.md
- [ ] Document all commands and options
- [ ] Add usage examples

---

## Phase 7: Editor Integration

### Migration Dialog UI
- [ ] Design migration dialog mockup
- [ ] Create `MigrationDialog/` component folder
- [ ] Implement `MigrationDialog.tsx`
- [ ] Implement `MigrationDialog.module.scss`
- [ ] Add progress indicator
- [ ] Add backup confirmation
- [ ] Add cancel option

### Project Loading Integration
- [ ] Locate project loading code (likely `projectmodel.js`)
- [ ] Add version detection on project open
- [ ] Add migration check logic
- [ ] Trigger migration dialog when needed
- [ ] Handle user choices (migrate/cancel)
- [ ] Show progress during migration
- [ ] Handle migration errors gracefully

### Testing
- [ ] Test opening legacy project triggers dialog
- [ ] Test migration completes successfully
- [ ] Test cancellation works
- [ ] Test error handling
- [ ] Manual testing scenarios
- [ ] Document in CHANGELOG.md

---

## Phase 8: Validation & Testing

### Test Project Corpus
- [ ] Collect/create minimal test project
- [ ] Collect/create complex test project
- [ ] Collect/create project with deprecated nodes
- [ ] Collect/create project with custom JavaScript
- [ ] Collect/create project from each known version
- [ ] Document all test projects

### Integration Testing
- [ ] Run CLI migration on all test projects
- [ ] Verify each migrated project opens correctly
- [ ] Verify node graphs render correctly
- [ ] Verify connections work correctly
- [ ] Verify preview runs correctly
- [ ] Document any failures

### Edge Cases
- [ ] Test with corrupted project files
- [ ] Test with missing files
- [ ] Test with extremely large projects
- [ ] Test with read-only filesystem
- [ ] Test interrupted migration (power loss scenario)
- [ ] Document findings

---

## Phase 9: Documentation

### User Documentation
- [ ] Create migration guide for users
- [ ] Document what changes during migration
- [ ] Document how to manually fix issues
- [ ] Add FAQ section
- [ ] Add troubleshooting guide

### Developer Documentation
- [ ] Document migration engine architecture
- [ ] Document how to add new migrations
- [ ] Document testing procedures
- [ ] Update NOTES.md with learnings

### Update Existing Docs
- [ ] Update main README if needed
- [ ] Update dev-docs if needed
- [ ] Link to this task from relevant docs

---

## Phase 10: Completion

### Final Validation
- [ ] All success criteria from README.md met
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Manual testing complete
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] No console warnings/errors

### Cleanup
- [ ] Remove any debug code
- [ ] Remove any TODO comments (or convert to issues)
- [ ] Clean up NOTES.md
- [ ] Finalize CHANGELOG.md

### Submission
- [ ] Self-review all changes
- [ ] Create pull request
- [ ] Update task status
- [ ] Notify stakeholders

---

## Quick Reference

### Key Files
```
packages/noodl-cli/                  # CLI tool package
packages/noodl-editor/src/editor/src/utils/migration/
├── version-detect.ts               # Version detection
├── migration-engine.ts             # Core engine
├── backup.ts                       # Backup utilities
└── migrations/                     # Individual migrations
    ├── index.ts
    ├── v17-to-v19-react.ts
    └── ...
packages/noodl-editor/src/editor/src/views/MigrationDialog/
├── MigrationDialog.tsx
└── MigrationDialog.module.scss
```

### Useful Commands
```bash
# Build editor
npm run build:editor

# Run tests
npm run test:editor

# Type check
npx tsc --noEmit

# Search for patterns
grep -r "pattern" packages/ --include="*.ts"

# Run CLI locally
node packages/noodl-cli/bin/noodl-migrate.js validate ./test-project
```

### Emergency Rollback
If migration breaks something:
1. Restore from backup folder
2. Disable migration in project loading code
3. Document the issue in NOTES.md
