# Breaking Changes Impact Matrix

This document assesses the impact of dependency updates on OpenNoodl functionality.

---

## Impact Assessment Scale

| Level | Description | Risk Mitigation |
|-------|-------------|-----------------|
| 🟢 Low | Minor changes, unlikely to cause issues | Normal testing |
| 🟡 Medium | Some code changes needed | Targeted testing of affected areas |
| 🔴 High | Significant refactoring required | Comprehensive testing, rollback plan |
| ⚫ Critical | May break production functionality | Extensive testing, staged rollout |

---

## Changes Already Applied (Previous Developer)

These changes are already in the codebase from branches 12 and 13:

### React 17 → 19 Migration

| Aspect | Impact | Status | Notes |
|--------|--------|--------|-------|
| ReactDOM.render() → createRoot() | 🔴 High | ✅ Done | Previous dev updated all calls |
| Concurrent rendering behavior | 🟡 Medium | ⚠️ Needs Testing | May affect timing-sensitive code |
| Strict mode changes | 🟡 Medium | ⚠️ Needs Testing | Double-renders in dev mode |
| useEffect cleanup timing | 🟡 Medium | ⚠️ Needs Testing | Cleanup now synchronous |
| Automatic batching | 🟢 Low | ✅ Done | Generally beneficial |
| Suspense changes | 🟡 Medium | ⚠️ Needs Testing | If using Suspense anywhere |

**Affected Files:**
- `packages/noodl-editor/src/editor/index.ts`
- `packages/noodl-editor/src/editor/src/router.tsx`
- `packages/noodl-editor/src/editor/src/views/commentlayer.ts`
- `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts`
- Various popup/dialog components

### react-instantsearch-hooks-web → react-instantsearch

| Aspect | Impact | Status | Notes |
|--------|--------|--------|-------|
| Package rename | 🟢 Low | ✅ Done | Import path changed |
| API compatibility | 🟢 Low | ⚠️ Needs Testing | Mostly compatible |
| Hook availability | 🟢 Low | ⚠️ Needs Testing | Verify all used hooks exist |

**Affected Files:**
- `packages/noodl-editor/src/editor/src/views/HelpCenter/HelpCenter.tsx`

### Algoliasearch 4.x → 5.x

| Aspect | Impact | Status | Notes |
|--------|--------|--------|-------|
| Client initialization | 🟡 Medium | ⚠️ Check | API may have changed |
| Search parameters | 🟢 Low | ⚠️ Check | Mostly compatible |
| Response format | 🟡 Medium | ⚠️ Check | May have minor changes |

---

## Pending Changes (TASK-001)

### Storybook 6.x → 9.x (Configuration Fix)

| Aspect | Impact | Status | Notes |
|--------|--------|--------|-------|
| CLI commands | 🔴 High | 🔲 TODO | start-storybook → storybook dev |
| Configuration format | 🔴 High | 🔲 Check | main.js format changed |
| Addon compatibility | 🟡 Medium | 🔲 Check | Some addons may need updates |
| Story format | 🟢 Low | 🔲 Check | CSF 3 format supported |

**Configuration Changes Required:**

Old `.storybook/main.js`:
```javascript
module.exports = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
};
```

New `.storybook/main.js` (Storybook 9):
```javascript
export default {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
};
```

### copy-webpack-plugin 4.x → 12.x

| Aspect | Impact | Status | Notes |
|--------|--------|--------|-------|
| Configuration API | 🔴 High | 🔲 TODO | Array → patterns object |
| Glob patterns | 🟡 Medium | 🔲 Check | Some patterns may differ |
| Options format | 🔴 High | 🔲 TODO | Many options renamed |

**Migration Example:**
```javascript
// Before (v4)
new CopyWebpackPlugin([
  { from: 'static', to: 'static' },
  { from: 'index.html', to: 'index.html' }
])

// After (v12)
new CopyWebpackPlugin({
  patterns: [
    { from: 'static', to: 'static' },
    { from: 'index.html', to: 'index.html' }
  ]
})
```

### clean-webpack-plugin 1.x → 4.x

| Aspect | Impact | Status | Notes |
|--------|--------|--------|-------|
| Constructor signature | 🔴 High | 🔲 TODO | No longer takes paths |
| Default behavior | 🟡 Medium | 🔲 Check | Auto-cleans output.path |
| Options | 🟡 Medium | 🔲 Check | Different options available |

**Migration Example:**
```javascript
// Before (v1)
new CleanWebpackPlugin(['dist', 'build'])

// After (v4)
new CleanWebpackPlugin()  // Automatically cleans output.path
// Or with options:
new CleanWebpackPlugin({
  cleanOnceBeforeBuildPatterns: ['**/*', '!static-files*'],
})
```

### webpack-dev-server 3.x → 4.x

| Aspect | Impact | Status | Notes |
|--------|--------|--------|-------|
| Configuration location | 🔴 High | 🔲 TODO | Changes in config structure |
| Hot reload | 🟢 Low | 🔲 Check | Improved in v4 |
| Proxy config | 🟡 Medium | 🔲 Check | Minor changes |

**Key Configuration Changes:**
```javascript
// Before (v3)
devServer: {
  contentBase: './dist',
  hot: true,
  inline: true
}

// After (v4)
devServer: {
  static: './dist',
  hot: true,
  // inline removed (always true in v4)
}
```

### Jest 28 → 29

| Aspect | Impact | Status | Notes |
|--------|--------|--------|-------|
| Mock hoisting | 🟡 Medium | 🔲 Check | Stricter hoisting behavior |
| Snapshot format | 🟢 Low | 🔲 Check | Minor formatting changes |
| jsdom version | 🟢 Low | 🔲 Check | Updated internal jsdom |

---

## Future Considerations (Not in TASK-001)

### Electron 31 → 39

| Aspect | Impact | Risk | Notes |
|--------|--------|------|-------|
| Chromium version | 🟡 Medium | Security | Many Chromium updates |
| Node.js version | 🟡 Medium | Compatibility | May affect native modules |
| Remote module | 🔴 High | Breaking | @electron/remote changes |
| Security policies | 🔴 High | Testing | CSP and other policies |
| Native APIs | 🔴 High | Testing | Some APIs deprecated |

**Recommendation:** Plan incremental upgrade path (31 → 33 → 35 → 39)

### Express 4 → 5

| Aspect | Impact | Risk | Notes |
|--------|--------|------|-------|
| Async error handling | 🔴 High | Breaking | Errors now propagate |
| Path route matching | 🟡 Medium | Breaking | Stricter path matching |
| req.query | 🟡 Medium | Check | May return different types |
| app.router | 🔴 High | Breaking | Removed |

**Affected Packages:**
- noodl-editor (development server)
- noodl-parse-dashboard

### Dugite 1.x → 3.x

| Aspect | Impact | Risk | Notes |
|--------|--------|------|-------|
| API changes | ⚫ Critical | Breaking | Major API overhaul |
| Git operations | ⚫ Critical | Testing | Affects all git functionality |
| Authentication | 🔴 High | Testing | May affect auth flow |

**Recommendation:** Extensive research required before planning upgrade

### ESLint 8 → 9

| Aspect | Impact | Risk | Notes |
|--------|--------|------|-------|
| Config format | 🔴 High | Breaking | Must use flat config |
| Plugin loading | 🔴 High | Breaking | Different loading syntax |
| Rules | 🟡 Medium | Check | Some rules moved/renamed |

**Migration Required:**
```javascript
// Before (.eslintrc.js)
module.exports = {
  extends: ['eslint:recommended'],
  plugins: ['react'],
  rules: { ... }
};

// After (eslint.config.js)
import react from 'eslint-plugin-react';
export default [
  { plugins: { react } },
  { rules: { ... } }
];
```

---

## Package Dependency Graph

Understanding how packages depend on each other is critical for impact assessment:

```
noodl-editor
├── @noodl/git (git operations)
├── @noodl/platform-electron (electron APIs)
│   └── @noodl/platform-node (file system)
│       └── @noodl/platform (interfaces)
├── @noodl/noodl-parse-dashboard (admin panel)
├── react 19.0.0
├── react-dom 19.0.0
└── electron 31.3.1

noodl-viewer-react
├── @noodl/runtime (node evaluation)
├── react (peer)
└── react-dom (peer)

noodl-core-ui
├── react 19.0.0 (peer)
├── react-dom 19.0.0 (peer)
└── storybook 9.1.3 (dev)
```

---

## Risk Mitigation Strategies

### For High-Impact Changes

1. **Create feature branch** for each major update
2. **Write regression tests** before making changes
3. **Test incrementally** - don't batch multiple breaking changes
4. **Document workarounds** if issues are found
5. **Have rollback plan** ready

### For Testing

| Area | Test Type | Priority |
|------|-----------|----------|
| React 19 behavior | Manual + Unit | 🔴 High |
| Build process | CI/CD | 🔴 High |
| Editor functionality | E2E | 🔴 High |
| Storybook components | Visual | 🟡 Medium |
| Git operations | Integration | 🟡 Medium |
| Help Center search | Manual | 🟢 Low |

### Rollback Procedures

1. **Git-based:** `git revert` the offending commit
2. **Package-based:** Pin to previous version in package.json
3. **Feature-flag-based:** Add runtime flag to disable new behavior

---

## Summary of Breaking Changes by Phase

### Phase 1 (TASK-001) - Low to Medium Risk

| Change | Impact | Complexity |
|--------|--------|------------|
| Storybook script fix | 🔴 Local | 🟢 Low |
| TypeScript alignment | 🟢 Low | 🟢 Low |
| Webpack plugins | 🟡 Medium | 🟡 Medium |
| Jest 29 | 🟢 Low | 🟢 Low |

### Future Phases - High Risk

| Change | Impact | Complexity |
|--------|--------|------------|
| Electron upgrade | ⚫ Critical | 🔴 High |
| Express 5 | 🔴 High | 🟡 Medium |
| Dugite 3 | ⚫ Critical | 🔴 High |
| ESLint 9 | 🟡 Medium | 🟡 Medium |
