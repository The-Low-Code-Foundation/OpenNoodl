# TASK-006: TypeScript 5 Upgrade

## Metadata

| Field | Value |
|-------|-------|
| **ID** | TASK-006 |
| **Phase** | Phase 1 |
| **Priority** | 🟠 High |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 4-8 hours |
| **Prerequisites** | None |
| **Branch** | `task/006-typescript5-upgrade` |

## Objective

Upgrade TypeScript from 4.9.5 to 5.x to enable Zod v4 compatibility and modern type features.

## Background

The project currently uses TypeScript 4.9.5. Several modern packages now require TypeScript 5.x for their type definitions:

- **Zod 3.25.x** - Transitional version that includes a `v4/` folder with TS5 syntax
- **Zod 4.x** - Full Zod 4 requiring TS5 completely  
- **@ai-sdk/*** packages - Import from `zod/v4` which needs modern TS features

Zod's `.d.cts` type definition files in the `v4/` folder use syntax like:
- `const T` generic type parameters (TS 5.0 feature)
- New `satisfies` operator patterns

TypeScript 4.9.5 cannot parse these files, causing webpack build failures.

## Current State

- TypeScript 4.9.5 in root `package.json`
- ts-loader configured with `transpileOnly: true` as a workaround
- Zod 3.25.76 installed (has `v4/` folder with TS5-incompatible types)
- AI features that use @ai-sdk may have runtime issues with zod/v4 imports

## Desired State

- TypeScript 5.4+ (or latest stable 5.x)
- Full type-checking enabled in webpack builds
- Zod 4.x properly installed and working
- AI SDK fully functional with zod/v4 imports
- All packages compile without errors

## Scope

### In Scope
- [ ] Upgrade TypeScript to 5.x
- [ ] Upgrade @typescript-eslint/* packages for TS5 compatibility
- [ ] Fix any new type errors from stricter TS5 checks
- [ ] Upgrade Zod to 4.x
- [ ] Re-enable type-checking in webpack (remove transpileOnly)
- [ ] Update related dev dependencies

### Out of Scope
- Major architectural changes
- Upgrading other unrelated dependencies

## Technical Approach

### Key Files to Modify

| File | Changes |
|------|---------|
| `package.json` | Upgrade TypeScript, eslint parsers |
| `packages/*/tsconfig.json` | Review for any needed TS5 adjustments |
| `webpackconfigs/shared/webpack.renderer.core.js` | Remove `transpileOnly: true` |

### Dependencies to Update

| Package | Current | Target |
|---------|---------|--------|
| `typescript` | 4.9.5 | 5.4.x |
| `@typescript-eslint/parser` | 5.62.0 | 7.x |
| `@typescript-eslint/eslint-plugin` | 5.62.0 | 7.x |
| `zod` | 3.25.76 | 4.x |

## Implementation Steps

### Step 1: Upgrade TypeScript
```bash
npm install typescript@^5.4.0 -D -w
```

### Step 2: Upgrade ESLint TypeScript Support
```bash
npm install @typescript-eslint/parser@^7.0.0 @typescript-eslint/eslint-plugin@^7.0.0 -D -w
```

### Step 3: Fix Type Errors
Run `npm run typecheck` and fix any new errors from TS5's stricter checks.

### Step 4: Upgrade Zod
```bash
npm install zod@^4.0.0 -w
```

### Step 5: Re-enable Type Checking in Webpack
Remove `transpileOnly: true` from `webpack.renderer.core.js`.

### Step 6: Test Full Build
```bash
npm run dev
npm run build:editor
```

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking type changes in TS5 | Fix incrementally, run typecheck frequently |
| ESLint compatibility issues | Update all eslint packages together |
| Third-party type issues | Use `skipLibCheck: true` temporarily if needed |

## Rollback Plan

1. Revert TypeScript to 4.9.5
2. Restore `transpileOnly: true` in webpack config
3. Keep Zod at 3.25.x

## References

- [TypeScript 5.0 Release Notes](https://devblogs.microsoft.com/typescript/announcing-typescript-5-0/)
- [Zod v4 Migration Guide](https://zod.dev/v4)
- [ts-loader transpileOnly docs](https://github.com/TypeStrong/ts-loader#transpileonly)
