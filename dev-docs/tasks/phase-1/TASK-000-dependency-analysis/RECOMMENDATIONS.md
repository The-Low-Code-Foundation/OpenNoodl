# Dependency Update Recommendations

This document provides prioritized recommendations for updating dependencies in the OpenNoodl monorepo.

---

## Priority Levels

| Priority | Meaning | Timeline |
|----------|---------|----------|
| 🔴 P0 - Critical | Blocking issue, must fix immediately | Within TASK-001 |
| 🟡 P1 - High | Important for stability/dev experience | Within TASK-001 |
| 🟢 P2 - Medium | Should be done when convenient | Phase 1 or 2 |
| 🔵 P3 - Low | Future consideration | Phase 2+ |

---

## 🔴 P0 - Critical (Must Fix Immediately)

### 1. Fix Storybook Scripts in noodl-core-ui

**Impact:** Storybook completely broken - can't run component development
**Effort:** 5 minutes
**Risk:** None

**Current (Broken):**
```json
"scripts": {
  "start": "start-storybook -p 6006 -s public",
  "build": "build-storybook -s public"
}
```

**Fix:**
```json
"scripts": {
  "start": "storybook dev -p 6006",
  "build": "storybook build"
}
```

**Note:** Also need to create `.storybook/main.js` configuration if not present. Storybook 9 uses a different config format than 6.x.

---

### 2. Standardize TypeScript Version

**Impact:** Type checking inconsistency, potential build issues
**Effort:** 30 minutes
**Risk:** Low (if staying on 4.9.5)

**Current State:**
| Package | Version |
|---------|---------|
| Root | 4.9.5 |
| noodl-editor | 4.9.5 |
| noodl-core-ui | 4.9.5 |
| noodl-viewer-react | **5.1.3** |
| noodl-viewer-cloud | 4.9.5 |
| noodl-platform-node | **5.5.4** |

**Recommendation:** Standardize on **4.9.5** for now:
- Most packages already use it
- TypeScript 5.x has some breaking changes
- Can upgrade to 5.x as a separate effort later

**Changes Required:**
```bash
# In packages/noodl-viewer-react/package.json
"typescript": "^4.9.5"  # was 5.1.3

# In packages/noodl-platform-node/package.json
"typescript": "^4.9.5"  # was 5.5.4
```

---

## 🟡 P1 - High Priority (Important for TASK-001)

### 3. Update Webpack Plugins in noodl-viewer-react

**Impact:** Build configuration fragility, missing features
**Effort:** 1-2 hours
**Risk:** Medium (API changes)

| Plugin | Current | Target | Notes |
|--------|---------|--------|-------|
| copy-webpack-plugin | 4.6.0 | 12.0.2 | [Migration Guide](https://github.com/webpack-contrib/copy-webpack-plugin/blob/master/CHANGELOG.md) |
| clean-webpack-plugin | 1.0.1 | 4.0.0 | API completely changed |
| webpack-dev-server | 3.11.2 | 4.15.2 | Config format changed |

**Migration Notes:**

**copy-webpack-plugin:**
```javascript
// Old (v4)
new CopyWebpackPlugin([{ from: 'src', to: 'dest' }])

// New (v12)
new CopyWebpackPlugin({
  patterns: [{ from: 'src', to: 'dest' }]
})
```

**clean-webpack-plugin:**
```javascript
// Old (v1)
new CleanWebpackPlugin(['dist'])

// New (v4)
new CleanWebpackPlugin()  // Auto-cleans output.path
```

---

### 4. Align Webpack Dev Tooling Versions

**Impact:** Inconsistent development experience
**Effort:** 1 hour
**Risk:** Low

Update in `noodl-viewer-react`:
```json
{
  "css-loader": "^6.11.0",      // was 5.0.0
  "style-loader": "^3.3.4",     // was 2.0.0  
  "webpack-dev-server": "^4.15.2"  // was 3.11.2
}
```

---

### 5. Update Jest to v29 Across All Packages

**Impact:** Test inconsistency, missing features
**Effort:** 1-2 hours
**Risk:** Low-Medium

**Current State:**
| Package | Jest Version |
|---------|-------------|
| noodl-runtime | 28.1.0 |
| noodl-viewer-react | 28.1.0 |
| noodl-platform-node | 29.7.0 ✅ |

**Target:** Jest 29.7.0 everywhere

**Migration Notes:**
- Jest 29 has minor breaking changes in mock behavior
- ts-jest must be updated to match (29.x)
- @types/jest should be updated to match

```json
{
  "jest": "^29.7.0",
  "ts-jest": "^29.3.4",
  "@types/jest": "^29.5.14"
}
```

---

### 6. Update copy-webpack-plugin in noodl-viewer-cloud

**Impact:** Same as #3 above
**Effort:** 30 minutes
**Risk:** Medium

Same migration as noodl-viewer-react.

---

## 🟢 P2 - Medium Priority (Phase 1 or 2)

### 7. Update @types/react and @types/react-dom

**Impact:** Better type inference, fewer type errors
**Effort:** 15 minutes
**Risk:** None

```json
{
  "@types/react": "^19.2.7",      // was 19.0.0
  "@types/react-dom": "^19.2.3"   // was 19.0.0
}
```

---

### 8. Update Babel Ecosystem

**Impact:** Better compilation, newer JS features
**Effort:** 30 minutes
**Risk:** Low

```json
{
  "@babel/core": "^7.28.5",
  "@babel/preset-env": "^7.28.5",
  "@babel/preset-react": "^7.28.5",
  "babel-loader": "^9.2.1"  // Note: 10.x exists but may have issues
}
```

---

### 9. Consider ESLint 9 Migration

**Impact:** Modern linting, flat config
**Effort:** 2-4 hours
**Risk:** Medium (significant config changes)

**Current:** ESLint 8.57.1 + @typescript-eslint 5.62.0
**Target:** ESLint 9.x + @typescript-eslint 8.x

**Key Changes:**
- ESLint 9 requires "flat config" format (eslint.config.js)
- No more .eslintrc files
- Different plugin loading syntax

**Recommendation:** Defer to Phase 2 unless blocking issues found.

---

### 10. Update @types/node

**Impact:** Better Node.js type support
**Effort:** 10 minutes
**Risk:** Low

```json
{
  "@types/node": "^20.17.0"  // Match LTS Node.js version
}
```

Note: Don't go to @types/node@24 unless using Node 24.

---

### 11. Consider Electron Upgrade Path

**Impact:** Security updates, new features, performance
**Effort:** 2-4 hours (testing intensive)
**Risk:** High (many potential breaking changes)

**Current:** 31.3.1
**Latest:** 39.2.6

**Recommendation:** 
1. Evaluate if any security issues in Electron 31
2. Plan incremental upgrade (31 → 33 → 35 → 39)
3. Test thoroughly between each jump
4. This is a separate task, not part of TASK-001

---

## 🔵 P3 - Low Priority (Future Consideration)

### 12. Express 5.x Migration

**Impact:** Modern Express, async error handling
**Effort:** 4-8 hours
**Risk:** High (breaking changes)

Affects:
- noodl-editor
- noodl-parse-dashboard

**Recommendation:** Defer to Phase 2 or later. Express 4.x is stable and secure.

---

### 13. Dugite 3.0 Upgrade

**Impact:** Git operations
**Effort:** Unknown
**Risk:** High (breaking API changes)

**Recommendation:** Research dugite 3.0 changes before planning upgrade.

---

### 14. Monaco Editor Upgrade

**Impact:** Code editing experience
**Effort:** 2-4 hours
**Risk:** Medium

**Current:** 0.34.1
**Latest:** 0.52.2

Many new features, but check webpack plugin compatibility.

---

### 15. Parse Dashboard Modernization

**Impact:** Admin panel functionality
**Effort:** High
**Risk:** High

Many outdated dependencies in noodl-parse-dashboard. Consider:
- Upgrading parse-dashboard 5.2.0 → 6.x
- express 4.x → 5.x
- Other dependencies

This should be a separate task.

---

## Summary: TASK-001 Scope Update

Based on this analysis, TASK-001 scope should include:

### Must Do (P0)
- [ ] Fix Storybook scripts in noodl-core-ui
- [ ] Standardize TypeScript version to 4.9.5

### Should Do (P1)
- [ ] Update webpack plugins in noodl-viewer-react
- [ ] Align css-loader, style-loader, webpack-dev-server versions
- [ ] Update Jest to v29 across all packages
- [ ] Update copy-webpack-plugin in noodl-viewer-cloud

### Nice to Have (P2)
- [ ] Update @types/react and @types/react-dom
- [ ] Update Babel packages

### Explicitly Out of Scope
- ESLint 9 migration
- Electron upgrade (separate task)
- Express 5.x migration
- Dugite 3.0 upgrade
- Parse Dashboard modernization

---

## Estimated Time Impact

| Priority | Items | Time |
|----------|-------|------|
| P0 | 2 | 35 min |
| P1 | 4 | 3-5 hours |
| P2 (if included) | 2 | 45 min |
| **Total** | **8** | **4-6 hours** |

This fits within the original TASK-001 estimate of 2-3 days.
