# TASK-006 Working Notes

## Background Research

### Why TypeScript 5 is Needed

Zod 3.25.x introduced a `v4/` folder with type definitions using TypeScript 5.0+ features:
- `const T` generic type parameters
- Modern conditional type patterns

The `@ai-sdk/*` packages import from `zod/v4` which triggers these TS5-only type definitions.

### Current Workaround

Added `transpileOnly: true` to ts-loader in `webpack.renderer.core.js`:
- Skips type-checking during bundling
- Allows build to succeed despite Zod type definition incompatibility
- Type errors are deferred (use `npm run typecheck` separately)

### Files Modified for Workaround
- `packages/noodl-editor/webpackconfigs/shared/webpack.renderer.core.js`

## TypeScript 5 New Features to Be Aware Of

### const Type Parameters (TS 5.0)
```typescript
// New TS5 syntax that Zod uses
type Const<T extends string> = T;
function foo<const T extends string>(x: T): Const<T> { ... }
```

### Decorator Changes (TS 5.0)
- New decorator standard (not backward compatible with experimental decorators)
- May need to update `experimentalDecorators` settings

### satisfies Operator (TS 4.9, refined in 5.x)
- Already available but with refinements

## Potential Issues

1. **ESLint Parser Compatibility**
   - @typescript-eslint v5 supports TS4
   - @typescript-eslint v7+ needed for TS5
   
2. **stricterFunctionTypes Changes**
   - TS5 has stricter checks that may reveal new errors

3. **Build Time Changes**
   - TS5 may be slightly faster or slower depending on codebase

## Useful Commands

```bash
# Check TypeScript version
npx tsc --version

# Run type-check without building
npm run typecheck

# Check specific package
npm run typecheck:editor
npm run typecheck:core-ui
npm run typecheck:viewer
```
