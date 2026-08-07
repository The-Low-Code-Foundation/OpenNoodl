# DEPLOY-000: Clean Up Old Hashed Files on Deploy

## Overview

Fix the deployment process to remove old hashed JavaScript files before creating new ones. Currently, each deployment generates a new `index-{hash}.js` file for cache-busting but never removes previous versions, causing the deployment folder to accumulate duplicate files and grow indefinitely.

## Context

### The Problem

When deploying to a local folder, the build process generates content-hashed filenames for cache-busting:

```typescript
// From deploy-index.ts
if (enableHash) {
  const hash = createHash();
  hash.update(content, 'utf8');
  const hex = hash.digest('hex');
  filename = addSuffix(url, '-' + hex);  // Creates index-abc123def.js
}
```

This is good practice—browsers fetch fresh code when the hash changes. However, **there's no cleanup step** to remove the previous hashed files. After 10 deployments, you have 10 `index-*.js` files. After 100 deployments, you have 100.

### Impact

- **Bloated project size**: Each index.js is ~500KB+ depending on project complexity
- **Confusing output folder**: Multiple index files make it unclear which is current
- **Upload waste**: Deploying to hosting platforms uploads unnecessary files
- **Git noise**: If committing builds, each deploy adds a new file

### Existing Infrastructure

**`deploy-index.ts`** - Handles file hashing and writing:
```typescript
// packages/noodl-editor/src/editor/src/utils/compilation/build/deploy-index.ts
export async function copyDeployFilesToFolder({
  project, direntry, files, exportJson, baseUrl, envVariables, runtimeType
}: CopyDeployFilesToFolderArgs)
```

**`cleanup.ts`** - Existing cleanup utility (only handles subfolders):
```typescript
// packages/noodl-editor/src/editor/src/utils/compilation/build/cleanup.ts
export async function clearFolders({ projectPath, outputPath, files }: ClearFoldersOptions)
```

**`deployer.ts`** - Main deployment orchestration:
```typescript
// packages/noodl-editor/src/editor/src/utils/compilation/build/deployer.ts
export async function deployToFolder({ project, direntry, environment, baseUrl, envVariables, runtimeType })
```

## Requirements

### Functional Requirements

1. **Remove old hashed files** before writing new ones during deployment
2. **Pattern matching** for `index-{hash}.js` files (hash is hex string from xxhash64)
3. **Preserve non-hashed files** like `index.html`, static assets, `noodl_bundles/`, etc.
4. **Work for all deploy types**: local folder, and as foundation for cloud deploys

### Non-Functional Requirements

- No user-facing changes (silent fix)
- Minimal performance impact (single directory scan)
- Backward compatible with existing projects

## Technical Approach

### Option A: Extend `cleanup.ts` (Recommended)

Add a new function to the existing cleanup module:

```typescript
// packages/noodl-editor/src/editor/src/utils/compilation/build/cleanup.ts

export interface CleanupHashedFilesOptions {
  /** The output directory path */
  outputPath: string;
  /** File patterns to clean (regex) */
  patterns?: RegExp[];
}

const DEFAULT_HASHED_PATTERNS = [
  /^index-[a-f0-9]+\.js$/,      // index-abc123.js
  /^index-[a-f0-9]+\.js\.map$/, // source maps if we add them later
];

export async function cleanupHashedFiles({
  outputPath,
  patterns = DEFAULT_HASHED_PATTERNS
}: CleanupHashedFilesOptions): Promise<string[]> {
  const removedFiles: string[] = [];
  
  if (!filesystem.exists(outputPath)) {
    return removedFiles;
  }
  
  const files = await filesystem.listDirectory(outputPath);
  
  for (const file of files) {
    // Skip directories
    if (file.isDirectory) continue;
    
    // Check against patterns
    const shouldRemove = patterns.some(pattern => pattern.test(file.name));
    
    if (shouldRemove) {
      const filePath = filesystem.join(outputPath, file.name);
      await filesystem.remove(filePath);
      removedFiles.push(file.name);
    }
  }
  
  return removedFiles;
}
```

### Option B: Inline in `copyDeployFilesToFolder`

Add cleanup directly in `deploy-index.ts` before writing files:

```typescript
export async function copyDeployFilesToFolder({
  project, direntry, files, exportJson, baseUrl, envVariables, runtimeType
}: CopyDeployFilesToFolderArgs) {
  // NEW: Clean up old hashed files first
  await cleanupOldHashedFiles(direntry);
  
  // ... existing logic
}

async function cleanupOldHashedFiles(direntry: string) {
  if (!filesystem.exists(direntry)) return;
  
  const files = await filesystem.listDirectory(direntry);
  const hashedPattern = /^index-[a-f0-9]+\.js$/;
  
  for (const file of files) {
    if (!file.isDirectory && hashedPattern.test(file.name)) {
      await filesystem.remove(filesystem.join(direntry, file.name));
    }
  }
}
```

### Recommendation

**Option A** is preferred because:
- Follows existing pattern of `cleanup.ts` module
- More extensible for future hashed assets (CSS, source maps)
- Can be reused by cloud deploy providers
- Easier to test in isolation

## Implementation Checklist

### Phase 1: Core Fix

- [ ] **Add `cleanupHashedFiles` function to `cleanup.ts`**
  - Accept output path and optional patterns array
  - Default patterns for `index-*.js` files
  - Return list of removed files (for logging/debugging)
  - Handle non-existent directories gracefully

- [ ] **Integrate into deployment flow**
  - Import in `deploy-index.ts`
  - Call before `writeIndexFiles()` in `copyDeployFilesToFolder()`
  - Only run when `enableHash` is true (matches current behavior)

- [ ] **Add logging** (optional but helpful)
  - Debug log removed files count
  - Integrate with existing deployment progress indicators

### Phase 2: Testing

- [ ] **Manual testing**
  - Deploy project to local folder
  - Verify single `index-{hash}.js` exists
  - Deploy again with code changes
  - Verify old hash file removed, new one exists
  - Deploy without changes, verify same hash retained

- [ ] **Edge cases**
  - Empty output directory (first deploy)
  - Output directory doesn't exist yet
  - Read-only files (if possible on target OS)
  - Very long hash patterns (shouldn't occur with xxhash64)

### Phase 3: Future Considerations (Out of Scope)

- [ ] Clean up other hashed assets when added (CSS, fonts)
- [ ] Manifest file tracking deployed assets
- [ ] Atomic deploys (write to temp, swap folders)

## Files to Modify

| File | Changes |
|------|---------|
| `packages/noodl-editor/src/editor/src/utils/compilation/build/cleanup.ts` | Add `cleanupHashedFiles()` function |
| `packages/noodl-editor/src/editor/src/utils/compilation/build/deploy-index.ts` | Import and call cleanup before writing |

## Estimated Effort

| Task | Hours |
|------|-------|
| Implement `cleanupHashedFiles` | 0.5 |
| Integrate into deploy flow | 0.5 |
| Testing & edge cases | 1.0 |
| **Total** | **2 hours** |

## Dependencies

- None (uses existing `@noodl/platform` filesystem APIs)

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Accidentally delete non-hashed files | Low | High | Strict regex pattern, only match expected format |
| Performance on large folders | Very Low | Low | Single directory scan, typically <100 files |
| Break existing deploys | Very Low | Medium | Pattern only matches hash format, preserves all other files |

## Success Criteria

1. After multiple deployments to the same folder, only ONE `index-{hash}.js` file exists
2. The correct (latest) hash file is retained
3. All other deployment files remain intact
4. No user-visible changes to deployment flow

## Related Tasks

- **DEPLOY-001**: One-Click Deploy (will benefit from clean output)
- **DEPLOY-002**: Preview Deployments (needs clean folders per preview)
- **DEPLOY-003**: Deploy Settings (may add "clean build" toggle)
