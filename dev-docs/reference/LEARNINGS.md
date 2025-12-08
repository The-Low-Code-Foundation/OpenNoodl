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

## Webpack DevServer & Electron

### [2025-08-12] - Webpack devServer `onListening` vs `compiler.hooks.done` Timing

**Context**: Debugging why `npm run dev` showed a black Electron window, took ages to load, and caused high CPU usage.

**Discovery**: The webpack dev configuration used `devServer.onListening()` to start Electron. This hook fires when the HTTP server port opens, NOT when webpack finishes compiling. This is a race condition:

1. `npm run dev` starts webpack-dev-server
2. Server starts listening on port 8080 → `onListening` fires
3. Electron launches and loads `http://localhost:8080/src/editor/index.bundle.js`
4. But webpack is still compiling! Bundle doesn't exist yet
5. Black screen + high CPU until compilation finishes

**Fix**: Use `devServer.compiler.hooks.done.tap()` inside `onListening` to wait for the first successful compilation before spawning Electron:

```javascript
onListening(devServer) {
  devServer.compiler.hooks.done.tap('StartElectron', (stats) => {
    if (!electronStarted && !stats.hasErrors()) {
      electronStarted = true;
      child_process.spawn('npm', ['run', 'start:_dev'], ...);
    }
  });
}
```

**Why It Became Noticeable**: This was a latent bug that existed from initial commit. It became visible after the Storybook 8 migration added ~91 files to process, increasing compilation time enough to consistently "lose" the race.

**Location**: `packages/noodl-editor/webpackconfigs/webpack.renderer.dev.js`

**Keywords**: webpack, devServer, onListening, electron, black screen, compilation, hooks.done, race condition, slow startup

---

### [2025-08-12] - Webpack devtool Settings Impact on Compilation Speed

**Context**: Investigating slow development startup.

**Discovery**: The `devtool: 'eval-source-map'` setting provides the most accurate sourcemaps but is very slow for large codebases. Using `'eval-cheap-module-source-map'` is significantly faster while still providing usable debugging:

| devtool | Rebuild Speed | Quality |
|---------|---------------|---------|
| `eval` | +++++ | Poor |
| `eval-cheap-source-map` | ++++ | OK |
| `eval-cheap-module-source-map` | +++ | Good |
| `eval-source-map` | + | Best |

For development where fast iteration matters more than perfect column accuracy in stack traces, `eval-cheap-module-source-map` is a good balance.

**Location**: `packages/noodl-editor/webpackconfigs/webpack.renderer.dev.js`

**Keywords**: webpack, devtool, sourcemap, performance, compilation speed, development

---

### [2025-08-12] - TypeScript Path Resolution Requires baseUrl in Child tsconfig

**Context**: Build was failing with "Cannot find module '@noodl-hooks/...' or '@noodl-core-ui/...'" errors despite webpack aliases being correctly configured.

**Discovery**: When a child tsconfig.json extends a parent and overrides the `paths` property, the paths become relative to the child's directory. However, if `baseUrl` is not explicitly set in the child, path resolution fails.

The noodl-editor's tsconfig.json had:
```json
{
  "extends": "../../tsconfig.json",
  "paths": {
    "@noodl-core-ui/*": ["../noodl-core-ui/src/*"],
    // ... other paths relative to packages/noodl-editor/
  }
}
```

Without `baseUrl: "."` in the child, TypeScript couldn't resolve the relative paths correctly.

**Fix**: Always set `baseUrl` explicitly when overriding `paths` in a child tsconfig:
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { ... }
  }
}
```

**Location**: `packages/noodl-editor/tsconfig.json`

**Keywords**: typescript, tsconfig, paths, baseUrl, module resolution, extends, cannot find module

---

### [2025-08-12] - @ai-sdk Packages Require Zod v4 for zod/v4 Import

**Context**: After fixing webpack timing, Electron showed black screen. DevTools console showed: "Cannot find module 'zod/v4/index.cjs'"

**Discovery**: The `@ai-sdk/provider-utils`, `@ai-sdk/gateway`, and `ai` packages import from `zod/v4`. Zod version 3.25.x only has `v4-mini` folder (a transitional export), not the full `v4` folder. Only Zod 4.x has the proper `v4` subpath export.

The error chain was:
1. `ai` package loads on startup
2. It tries to `require('zod/v4')`
3. Zod 3.25.76 doesn't have `/v4` export → crash
4. Black screen because editor fails to initialize

**Fix**: Upgrade to Zod 4.x by adding it as a direct dependency in root `package.json`:
```json
"dependencies": {
  "zod": "^4.1.0"
}
```

Using `overrides` for this case can conflict with other version specifications. A direct dependency with a semver range works cleanly in npm workspaces.

**Location**: Root `package.json`, affects all packages using AI SDK

**Keywords**: zod, zod/v4, @ai-sdk, ai, black screen, cannot find module, module resolution

---

## Template for Future Entries

```markdown
### [YYYY-MM-DD] - Brief Title

**Context**: What were you trying to do?

**Discovery**: What did you learn?

**Location**: What files/areas does this apply to?

**Keywords**: [searchable terms]
```
