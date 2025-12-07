# TASK-000: Dependency Analysis Report

## Metadata

| Field | Value |
|-------|-------|
| **ID** | TASK-000 |
| **Phase** | Phase 1 - Foundation |
| **Priority** | 📊 Research/Documentation |
| **Type** | Analysis Report |
| **Date Created** | July 12, 2025 |
| **Related Branches** | `12-upgrade-dependencies`, `13-remove-tsfixmes` |
| **Previous Developer** | Axel Wretman |

## Executive Summary

This report documents a comprehensive analysis of:
1. **Previous developer's dependency update attempts** (merged branches 12 and 13)
2. **Current state of all dependencies** across the OpenNoodl monorepo
3. **Recommendations** for completing the dependency modernization work

### Key Findings

| Category | Status | Action Required |
|----------|--------|-----------------|
| React 19 Migration | ✅ Done | Minor validation needed |
| Storybook 9 Migration | ⚠️ Broken | Scripts need fixing |
| Webpack Ecosystem | 🔶 Partial | Plugin updates needed |
| Electron | 🔴 Outdated | 31.3.1 → 39.x consideration |
| ESLint/TypeScript | 🔴 Outdated | Major version jump needed |
| Build Tools | 🔶 Mixed | Various version inconsistencies |

---

## Background: Previous Developer's Work

### Branch 12: `12-upgrade-dependencies`

**Developer:** Axel Wretman  
**Key Commits:**
- `162eb5f` - "Updated node version, react version and react dependant dependencies"
- `5bed0a3` - "Update rendering to use non deprecated react-dom calls"

**What Was Changed:**

| Package | Before | After | Breaking? |
|---------|--------|-------|-----------|
| react | 17.0.2 | 19.0.0 | ✅ Yes |
| react-dom | 17.0.0 | 19.0.0 | ✅ Yes |
| react-instantsearch-hooks-web | 6.38.0 | react-instantsearch 7.16.2 | ✅ Yes (renamed) |
| webpack | 5.74.0 | 5.101.3 | No |
| typescript | 4.8.3 | 4.9.5 | No |
| @types/react | 17.0.50 | 19.0.0 | ✅ Yes |
| @types/react-dom | 18.0.0 | 19.0.0 | No |
| node engine | >=16 <=18 | >=16 | No (relaxed) |
| Storybook | @storybook/* 6.5.x | storybook 9.1.3 | ✅ Yes |
| electron-builder | 24.9.1 | 24.13.3 | No |
| electron-updater | 6.1.7 | 6.6.2 | No |
| algoliasearch | 4.14.2 | 5.35.0 | ✅ Yes |
| express | 4.17.3/4.18.1 | 4.21.2 | No |
| ws | 8.9.0 | 8.18.3 | No |
| sass | 1.53.0/1.55.0 | 1.90.0 | No |
| dugite | 1.106.0 | 1.110.0 | No |

**Code Changes (React 19 Migration):**
- Updated `ReactDOM.render()` calls to use `createRoot()` pattern
- Files modified:
  - `packages/noodl-editor/src/editor/index.ts`
  - `packages/noodl-editor/src/editor/src/router.tsx`
  - `packages/noodl-editor/src/editor/src/views/commentlayer.ts`
  - `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts`
  - Several popup/dialog components

### Branch 13: `13-remove-tsfixmes`

**Developer:** Axel Wretman  
**Key Commit:** `960f38c` - "Remove TSFixme from property panel UI"

**What Was Changed:**
- Type safety improvements in `noodl-core-ui` property panel components
- No dependency changes
- Focused on removing `TSFixme` type escapes from:
  - `Checkbox.tsx`
  - `MenuDialog.tsx`
  - `PropertyPanelInput.tsx`
  - `PropertyPanelNumberInput.tsx`
  - `PropertyPanelSliderInput.tsx`
  - And other property panel components

---

## Current State: Critical Issues

### 1. 🔴 Storybook Scripts Broken

**Location:** `packages/noodl-core-ui/package.json`

**Problem:** The package uses Storybook 9.x but has Storybook 6.x commands:
```json
"scripts": {
  "start": "start-storybook -p 6006 -s public",  // WRONG
  "build": "build-storybook -s public"           // WRONG
}
```

**Required Fix:**
```json
"scripts": {
  "start": "storybook dev -p 6006",
  "build": "storybook build"
}
```

**Impact:** Storybook cannot run for component development/testing.

### 2. 🔴 Major Version Gaps

Several critical dependencies are multiple major versions behind:

| Package | Current | Latest | Gap |
|---------|---------|--------|-----|
| electron | 31.3.1 | 39.2.6 | 8 major |
| eslint | 8.57.1 | 9.39.1 | 1 major |
| @typescript-eslint/* | 5.62.0 | 8.48.1 | 3 major |
| dugite | 1.110.0 | 3.0.0 | 2 major |
| express | 4.21.2 | 5.2.1 | 1 major |
| jest | 28.1.3 | 29.7.0 | 1 major |

### 3. 🟡 Version Inconsistencies Across Packages

| Dependency | Root | noodl-editor | noodl-viewer-react | noodl-core-ui |
|------------|------|-------------|-------------------|---------------|
| typescript | 4.9.5 | 4.9.5 | **5.1.3** | 4.9.5 |
| css-loader | - | 6.11.0 | **5.0.0** | - |
| webpack-dev-server | 4.15.2 | 4.15.2 | **3.11.2** | - |
| @types/jest | - | - | 27.5.2 | 27.5.2 |
| style-loader | - | 3.3.4 | **2.0.0** | - |

### 4. 🟡 Outdated Webpack Plugins

| Plugin | Current | Latest | Status |
|--------|---------|--------|--------|
| copy-webpack-plugin | 4.6.0 | 13.0.1 | 🔴 Very outdated |
| clean-webpack-plugin | 1.0.1 | 4.0.0 | 🔴 Very outdated |
| html-loader | 3.1.2 | 5.1.0 | 🟡 Outdated |
| babel-loader | 8.4.1 | 10.0.0 | 🟡 Outdated |
| @svgr/webpack | 6.5.1 | 8.1.0 | 🟡 Outdated |

---

## Recommendations

See [RECOMMENDATIONS.md](./RECOMMENDATIONS.md) for detailed prioritized recommendations.

### Quick Summary

| Priority | Item | Effort |
|----------|------|--------|
| 🔴 P0 | Fix Storybook scripts | 5 min |
| 🔴 P0 | Standardize TypeScript version | 30 min |
| 🟡 P1 | Update webpack plugins | 2 hours |
| 🟡 P1 | Update Jest to v29 | 1 hour |
| 🟢 P2 | Consider Electron upgrade | TBD |
| 🟢 P2 | Consider ESLint 9 migration | 2-4 hours |
| 🔵 P3 | Express 5.x (future) | TBD |
| 🔵 P3 | Dugite 3.x (future) | TBD |

---

## Impact on Other Tasks

### Updates for TASK-001 (Dependency Updates)

The following items should be added to TASK-001's scope:
- [x] ~~React 19 migration~~ (Already done by previous dev)
- [ ] **FIX: Storybook scripts in noodl-core-ui**
- [ ] Webpack plugins update (copy-webpack-plugin, clean-webpack-plugin)
- [ ] TypeScript version alignment (standardize on 4.9.5 or upgrade to 5.x)
- [ ] css-loader/style-loader version alignment
- [ ] webpack-dev-server version alignment

### Updates for TASK-002 (Legacy Project Migration)

Additional considerations for backward compatibility:
- Express 5.x migration would break Parse Dashboard
- Electron 31→39 upgrade requires testing all native features
- Dugite 3.0 has breaking API changes affecting git operations
- Algoliasearch 5.x has different API patterns

---

## Related Files

- [DETAILED-ANALYSIS.md](./DETAILED-ANALYSIS.md) - Full package-by-package breakdown
- [RECOMMENDATIONS.md](./RECOMMENDATIONS.md) - Prioritized action items
- [IMPACT-MATRIX.md](./IMPACT-MATRIX.md) - Breaking changes impact assessment

---

## Methodology

This analysis was conducted by:
1. Examining git history for branches 12 and 13
2. Reading all `package.json` files across the monorepo
3. Running `npm outdated` to identify version gaps
4. Comparing the previous developer's intended changes with current state
5. Cross-referencing with existing TASK-001 and TASK-002 documentation
