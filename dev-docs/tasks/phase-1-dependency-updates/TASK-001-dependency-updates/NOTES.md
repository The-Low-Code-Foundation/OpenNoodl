# TASK-001 Working Notes

## Research

### Previous Developer's Work

**Branch**: `12-upgrade-dependencies`

**Commits found**:
1. Package.json updates across all packages
2. "Update rendering to use non-deprecated react-dom calls"

**What they changed**:
- React 17.0.2 → 19.0.0
- react-instantsearch-hooks-web → react-instantsearch
- Removed deprecated react-json-view, added @microlink/react-json-view
- Updated webpack 5.74.0 → 5.101.3
- Removed Node.js upper version cap (was <=18, now 16+)
- Removed Storybook 6.x packages

### React 19 Breaking Changes to Watch For

1. **Automatic Batching** - State updates are now automatically batched
2. **Concurrent Features** - May affect node graph rendering timing
3. **Strict Mode** - Double-renders effects for cleanup detection
4. **Removed APIs**:
   - `ReactDOM.render()` → `createRoot()`
   - `ReactDOM.hydrate()` → `hydrateRoot()`
   - `ReactDOM.unmountComponentAtNode()` → `root.unmount()`

### react-instantsearch Changes

The package was renamed from `react-instantsearch-hooks-web` to `react-instantsearch`.

Most APIs are compatible, but verify:
- `useHits`
- `useSearchBox`
- `InstantSearch` component props

### Files to Search

```bash
# Find ReactDOM.render usage
grep -rn "ReactDOM.render" packages/ --include="*.ts" --include="*.tsx" --include="*.js"

# Find old instantsearch imports
grep -rn "react-instantsearch-hooks-web" packages/

# Find any remaining TSFixme (for awareness, not this task)
grep -rn "TSFixme" packages/ --include="*.ts" --include="*.tsx"
```

---

## Assumptions

- [ ] Previous dev's changes are on `12-upgrade-dependencies` branch - **VERIFY**
- [ ] Build was working before their changes - **VERIFY by checking main**
- [ ] No other branches need to be merged first - **VERIFY**

---

## Implementation Notes

### Approach Decisions

[To be filled in during work]

### Gotchas / Surprises

[To be filled in during work]

---

## Debug Log

### [Date/Time]
- **Trying**: [what you're attempting]
- **Result**: [what happened]
- **Next**: [what to try next]

---

## Useful Commands

```bash
# Clean install
rm -rf node_modules packages/*/node_modules
npm install

# Build editor
npm run build:editor

# Run tests
npm run test:editor

# Type check
npx tsc --noEmit

# Start dev server
npm run dev

# Find files with pattern
grep -rn "pattern" packages/ --include="*.ts" --include="*.tsx"

# Check git status
git status
git diff --stat

# Compare with main
git diff main..HEAD --stat
```

---

## Questions to Resolve

- [ ] Are there any other branches that should be merged first?
- [ ] Did the previous dev test the build?
- [ ] Are there any known issues documented anywhere?

---

## Links & Resources

- [React 19 Blog Post](https://react.dev/blog/2024/04/25/react-19)
- [React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)
- [react-instantsearch Migration](https://www.algolia.com/doc/guides/building-search-ui/upgrade-guides/react/)
