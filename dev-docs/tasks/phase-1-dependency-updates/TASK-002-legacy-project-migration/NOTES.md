# TASK-002 Working Notes: Legacy Project Migration

## Research Findings

### Project File Structure
> Document findings about Noodl project structure here

**TODO:** Analyze sample .noodl project folders

```
Expected structure (to be verified):
my-project/
├── project.json          # Project metadata
├── components/           # Component definitions
│   └── component-name/
│       └── component.json
├── pages/                # Page definitions
├── styles/               # Style definitions
└── assets/               # Project assets (if any)
```

### Known Version Indicators
> Document where version information is stored

**TODO:** Check these locations for version metadata:
- [ ] `project.json` root object
- [ ] File header comments
- [ ] Metadata fields in component files
- [ ] Any `.noodl-version` or similar files

### Node Definition Changes
> Track changes to node definitions across versions

| Node Type | Old API | New API | Version Changed |
|-----------|---------|---------|-----------------|
| TBD | TBD | TBD | TBD |

---

## Breaking Changes Map

### From TASK-001 Dependency Updates

#### React 17 → 19
| Change | Impact on Projects | Migration Strategy |
|--------|-------------------|-------------------|
| `ReactDOM.render()` deprecated | May affect stored render patterns | TBD |
| New Suspense behavior | May affect loading states | TBD |
| Concurrent features | May affect event handling | TBD |

#### react-instantsearch-hooks-web → react-instantsearch
| Change | Impact on Projects | Migration Strategy |
|--------|-------------------|-------------------|
| Package rename | Import paths | N/A (editor code only) |
| API changes | TBD | TBD |

#### Other Dependencies
> Add findings here as TASK-001 progresses

---

## Design Decisions

### Migration Engine Architecture

**Decision:** [TBD]
**Alternatives Considered:**
1. Option A: ...
2. Option B: ...
**Rationale:** ...

### Backup Strategy

**Decision:** [TBD]
**Options:**
1. In-place backup (`.backup` folder in project)
2. External backup location (user-configurable)
3. Timestamped copies
**Rationale:** ...

### CLI Tool Location

**Decision:** [TBD]
**Options:**
1. New `packages/noodl-cli/` package
2. Add to existing `packages/noodl-platform-node/`
3. Scripts in `scripts/` directory
**Rationale:** ...

---

## Questions & Answers

### Q: Where is project version stored?
**A:** [TBD - needs research]

### Q: What's the oldest supported Noodl version?
**A:** [TBD - needs community input]

### Q: Do we have sample legacy projects for testing?
**A:** [TBD - need to source these]

### Q: Should migration be automatic or opt-in?
**A:** [TBD - needs UX decision]

---

## Gotchas & Surprises
> Document unexpected discoveries here

### [Discovery 1]
- **Date:** TBD
- **Finding:** ...
- **Impact:** ...
- **Resolution:** ...

---

## Debug Log

### Research Phase
```
[Date/Time] - Starting project format analysis
- Trying: ...
- Result: ...
- Next: ...
```

---

## Useful References

### Codebase Locations
```bash
# Project loading code
packages/noodl-editor/src/editor/src/models/projectmodel.js

# Node definitions
packages/noodl-runtime/src/nodes/

# Runtime context
packages/noodl-runtime/src/nodecontext.js

# Viewer React components
packages/noodl-viewer-react/src/nodes/
```

### Search Commands
```bash
# Find project loading logic
grep -r "loadProject\|openProject" packages/noodl-editor/ --include="*.ts" --include="*.js"

# Find version references
grep -r "version" packages/noodl-editor/src/editor/src/models/ --include="*.ts" --include="*.js"

# Find serialization logic
grep -r "serialize\|deserialize\|toJSON\|fromJSON" packages/ --include="*.ts" --include="*.js"
```

### External Documentation
- React 19 Migration: https://react.dev/blog/2024/04/25/react-19
- react-instantsearch v7: https://www.algolia.com/doc/guides/building-search-ui/upgrade-guides/react/

---

## Community Feedback
> Collect feedback from Noodl users about migration concerns

### User Concerns
1. [TBD]

### User Requests
1. [TBD]

### Known Legacy Projects in the Wild
1. [TBD - need to identify common project patterns]

---

## Test Project Inventory

| Name | Version | Complexity | Contains | Location |
|------|---------|------------|----------|----------|
| TBD | TBD | TBD | TBD | TBD |

---

## Migration Algorithm Pseudocode

```
function migrateProject(projectPath):
    1. detectVersion(projectPath)
    2. if currentVersion >= targetVersion:
        return SUCCESS (no migration needed)
    3. migrationPath = calculateMigrationPath(currentVersion, targetVersion)
    4. if migrationPath.length == 0:
        return ERROR (no migration path)
    5. backup = createBackup(projectPath)
    6. for migration in migrationPath:
        result = migration.execute(projectPath)
        if result.failed:
            restoreBackup(backup)
            return ERROR (migration failed)
        updateVersionMetadata(projectPath, migration.toVersion)
    7. validate(projectPath)
    8. return SUCCESS
```

---

## Open Items

- [ ] Get access to legacy Noodl projects for testing
- [ ] Confirm oldest version we need to support
- [ ] Determine if cloud configurations need migration
- [ ] Design migration dialog UX
- [ ] Decide on CLI package location and build strategy
