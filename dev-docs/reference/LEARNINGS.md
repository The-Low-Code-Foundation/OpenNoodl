# OpenNoodl Development Learnings

This document records discoveries, gotchas, and non-obvious patterns found while working on OpenNoodl. Search this file before tackling complex problems.

---

## Project Migration & Versioning

### [2025-07-12] - Legacy Projects Are Already at Version 4

**Context**: Investigating what migration work is needed for legacy Noodl v1.1.0 projects.

**Discovery**: Legacy projects from Noodl v1.1.0 are already at project format version "4", which is the current version expected by the editor. This significantly reduces migration scope.

**Location**: 
- `packages/noodl-editor/src/editor/src/models/projectmodel.ts` - Contains `Upgraders` object for format 0→1→2→3→4
- `packages/noodl-editor/src/editor/src/models/ProjectPatches/` - Node-level patches (e.g., `RouterNavigate`)

**Key Points**:
- Project format version is stored in `project.json` as `"version": "4"`
- The existing `ProjectPatches/` system handles node-level migrations automatically on load
- No major version migration infrastructure is needed for v1.1.0→v2.0.0
- The `Upgraders` object has handlers for versions 0-4, upgrading sequentially

**Keywords**: project migration, version upgrade, legacy project, project.json, upgraders

---

### [2025-07-12] - @noodl/platform FileInfo Interface

**Context**: Writing utility functions that use `filesystem.listDirectory()`.

**Discovery**: The `listDirectory()` function returns `FileInfo[]`, not strings. Each FileInfo has:
- `name: string` - Just the filename
- `fullPath: string` - Complete path
- `isDirectory: boolean`

**Location**: `packages/noodl-platform/src/filesystem/IFilesystem.ts`

**Keywords**: filesystem, listDirectory, FileInfo, platform API

---

## Template for Future Entries

```markdown
### [YYYY-MM-DD] - Brief Title

**Context**: What were you trying to do?

**Discovery**: What did you learn?

**Location**: What files/areas does this apply to?

**Keywords**: [searchable terms]
```
