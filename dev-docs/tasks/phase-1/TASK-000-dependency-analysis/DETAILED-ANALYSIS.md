# Detailed Dependency Analysis by Package

This document provides a comprehensive breakdown of dependencies for each package in the OpenNoodl monorepo.

---

## Table of Contents

1. [Root Package](#1-root-package)
2. [noodl-editor](#2-noodl-editor)
3. [noodl-core-ui](#3-noodl-core-ui)
4. [noodl-viewer-react](#4-noodl-viewer-react)
5. [noodl-viewer-cloud](#5-noodl-viewer-cloud)
6. [noodl-runtime](#6-noodl-runtime)
7. [noodl-git](#7-noodl-git)
8. [noodl-platform](#8-noodl-platform)
9. [noodl-platform-electron](#9-noodl-platform-electron)
10. [noodl-platform-node](#10-noodl-platform-node)
11. [noodl-parse-dashboard](#11-noodl-parse-dashboard)
12. [noodl-types](#12-noodl-types)
13. [Cross-Package Issues](#13-cross-package-issues)

---

## 1. Root Package

**Location:** `/package.json`

### Current State

```json
{
  "name": "@thelowcodefoundation/repo",
  "engines": {
    "npm": ">=6.0.0",
    "node": ">=16.0.0"
  }
}
```

### Dev Dependencies

| Package | Current | Latest | Status | Notes |
|---------|---------|--------|--------|-------|
| @ianvs/prettier-plugin-sort-imports | 3.7.2 | 4.7.0 | 🟡 Major | Breaking changes in v4 |
| @types/keyv | 3.1.4 | 3.1.4 | ✅ OK | |
| @types/node | 18.19.123 | 24.10.1 | 🔴 Major | Node 24 types, significant jump |
| @typescript-eslint/eslint-plugin | 5.62.0 | 8.48.1 | 🔴 Major | 3 major versions behind |
| @typescript-eslint/parser | 5.62.0 | 8.48.1 | 🔴 Major | Must match plugin |
| eslint | 8.57.1 | 9.39.1 | 🔴 Major | ESLint 9 is flat config only |
| eslint-plugin-react | 7.37.5 | 7.37.5 | ✅ OK | |
| fs-extra | 10.1.0 | 11.3.2 | 🟡 Major | Minor breaking changes |
| lerna | 7.4.2 | 7.4.2 | ✅ OK | |
| rimraf | 3.0.2 | 3.0.2 | 🟡 Note | v5+ is ESM-only |
| ts-node | 10.9.2 | 10.9.2 | ✅ OK | |
| typescript | 4.9.5 | 5.8.3 | 🟡 Major | TS 5.x has minor breaking |
| webpack | 5.101.3 | 5.101.3 | ✅ OK | |
| webpack-cli | 5.1.4 | 5.1.4 | ✅ OK | |
| webpack-dev-server | 4.15.2 | 4.15.2 | ✅ OK | v5 available but major |

### Action Items
- [ ] Consider ESLint 9 migration (significant effort)
- [ ] Update @typescript-eslint/* when ESLint is updated
- [ ] TypeScript 5.x upgrade evaluate

---

## 2. noodl-editor

**Location:** `/packages/noodl-editor/package.json`

### Critical Dependencies

| Package | Current | Latest | Status | Notes |
|---------|---------|--------|--------|-------|
| react | 19.0.0 | 19.2.0 | ✅ OK | Updated by previous dev |
| react-dom | 19.0.0 | 19.2.0 | ✅ OK | Updated by previous dev |
| electron | 31.3.1 | 39.2.6 | 🔴 Major | 8 major versions behind |
| monaco-editor | 0.34.1 | 0.52.2 | 🟡 Outdated | Many features added |

### Production Dependencies

| Package | Current | Latest | Status | Notes |
|---------|---------|--------|--------|-------|
| @electron/remote | 2.1.3 | 2.1.3 | ✅ OK | |
| @jaames/iro | 5.5.2 | 5.5.2 | ✅ OK | Color picker |
| @microlink/react-json-view | 1.27.0 | 1.27.0 | ✅ OK | Fork of react-json-view |
| @microsoft/fetch-event-source | 2.0.1 | 2.0.1 | ✅ OK | SSE client |
| about-window | 1.15.2 | 1.15.2 | ✅ OK | |
| algoliasearch | 5.35.0 | 5.46.0 | 🟢 Minor | |
| archiver | 5.3.2 | 7.0.1 | 🟡 Major | Breaking changes |
| async | 3.2.6 | 3.2.6 | ✅ OK | |
| classnames | 2.5.1 | 2.5.1 | ✅ OK | |
| electron-store | 8.2.0 | 11.0.2 | 🟡 Major | Breaking changes |
| electron-updater | 6.6.2 | 6.6.2 | ✅ OK | |
| express | 4.21.2 | 5.2.1 | 🔴 Major | Express 5 breaking |
| highlight.js | 11.11.1 | 11.11.1 | ✅ OK | |
| isbinaryfile | 5.0.4 | 5.0.7 | 🟢 Patch | |
| mixpanel-browser | 2.69.1 | 2.69.1 | ✅ OK | Analytics |
| react-hot-toast | 2.6.0 | 2.6.0 | ✅ OK | |
| react-instantsearch | 7.16.2 | 7.18.0 | 🟢 Minor | Renamed from hooks-web |
| react-rnd | 10.5.2 | 10.5.2 | ✅ OK | |
| remarkable | 2.0.1 | 2.0.1 | ✅ OK | Markdown |
| underscore | 1.13.7 | 1.13.7 | ✅ OK | |
| ws | 8.18.3 | 8.18.3 | ✅ OK | WebSocket |

### Dev Dependencies

| Package | Current | Latest | Status | Notes |
|---------|---------|--------|--------|-------|
| @babel/core | 7.28.3 | 7.28.5 | 🟢 Patch | |
| @babel/preset-react | 7.27.1 | 7.28.5 | 🟢 Patch | |
| @svgr/webpack | 6.5.1 | 8.1.0 | 🟡 Major | |
| @types/react | 19.0.0 | 19.2.7 | 🟢 Minor | |
| @types/react-dom | 19.0.0 | 19.2.3 | 🟢 Minor | |
| babel-loader | 8.4.1 | 10.0.0 | 🟡 Major | |
| concurrently | 7.6.0 | 9.2.1 | 🟡 Major | |
| css-loader | 6.11.0 | 7.1.2 | 🟡 Major | |
| electron-builder | 24.13.3 | 26.0.12 | 🟡 Major | |
| html-loader | 3.1.2 | 5.1.0 | 🟡 Major | |
| monaco-editor-webpack-plugin | 7.1.0 | 7.1.0 | ✅ OK | |
| sass | 1.90.0 | 1.90.0 | ✅ OK | |
| style-loader | 3.3.4 | 3.3.4 | ✅ OK | v4 available |
| ts-loader | 9.5.4 | 9.5.4 | ✅ OK | |
| typescript | 4.9.5 | 5.8.3 | 🟡 Major | |
| webpack-merge | 5.10.0 | 5.10.0 | ✅ OK | |

### Action Items
- [ ] Update @types/react and @types/react-dom
- [ ] Evaluate electron upgrade path
- [ ] Update babel packages
- [ ] Consider css-loader 7.x

---

## 3. noodl-core-ui

**Location:** `/packages/noodl-core-ui/package.json`

### Critical Issue: Broken Storybook

```json
// CURRENT (BROKEN)
"scripts": {
  "start": "start-storybook -p 6006 -s public",
  "build": "build-storybook -s public"
}

// REQUIRED FIX
"scripts": {
  "start": "storybook dev -p 6006",
  "build": "storybook build"
}
```

### Dependencies

| Package | Current | Latest | Status | Notes |
|---------|---------|--------|--------|-------|
| classnames | 2.5.1 | 2.5.1 | ✅ OK | |

### Peer Dependencies

| Package | Current | Latest | Status | Notes |
|---------|---------|--------|--------|-------|
| react | 19.0.0 | 19.2.0 | ✅ OK | |
| react-dom | 19.0.0 | 19.2.0 | ✅ OK | |

### Dev Dependencies

| Package | Current | Latest | Status | Notes |
|---------|---------|--------|--------|-------|
| @types/jest | 27.5.2 | 30.0.0 | 🔴 Major | |
| @types/node | 16.11.42 | 24.10.1 | 🔴 Major | Very outdated |
| @types/react | 19.0.0 | 19.2.7 | 🟢 Minor | |
| @types/react-dom | 19.0.0 | 19.2.3 | 🟢 Minor | |
| sass | 1.90.0 | 1.90.0 | ✅ OK | |
| storybook | 9.1.3 | 9.1.3 | ✅ OK | But scripts broken! |
| ts-loader | 9.5.4 | 9.5.4 | ✅ OK | |
| typescript | 4.9.5 | 5.8.3 | 🟡 Major | |
| web-vitals | 3.5.2 | 3.5.2 | ✅ OK | v4 available |
| webpack | 5.101.3 | 5.101.3 | ✅ OK | |

### Action Items
- [ ] **FIX STORYBOOK SCRIPTS** (Critical)
- [ ] Update @types/node
- [ ] Update @types/jest
- [ ] Align typescript version

---

## 4. noodl-viewer-react

**Location:** `/packages/noodl-viewer-react/package.json`

### Version Inconsistencies

This package has several dependencies that are different versions from other packages:

| Package | This Package | noodl-editor | Status |
|---------|-------------|--------------|--------|
| typescript | **5.1.3** | 4.9.5 | ⚠️ Inconsistent |
| css-loader | **5.0.0** | 6.11.0 | ⚠️ Inconsistent |
| style-loader | **2.0.0** | 3.3.4 | ⚠️ Inconsistent |
| webpack-dev-server | **3.11.2** | 4.15.2 | ⚠️ Inconsistent |

### Dependencies

| Package | Current | Latest | Status | Notes |
|---------|---------|--------|--------|-------|
| @better-scroll/* | 2.5.1 | 2.5.1 | ✅ OK | Scroll library |
| bezier-easing | 1.1.1 | 2.1.0 | 🟡 Major | |
| buffer | 6.0.3 | 6.0.3 | ✅ OK | |
| core-js | 3.45.1 | 3.47.0 | 🟢 Minor | |
| events | 3.3.0 | 3.3.0 | ✅ OK | |
| lodash.difference | 4.5.0 | 4.5.0 | ✅ OK | |
| lodash.isequal | 4.5.0 | 4.5.0 | ✅ OK | |
| react-draggable | 4.5.0 | 4.5.0 | ✅ OK | |
| react-rnd | 10.5.2 | 10.5.2 | ✅ OK | |
| webfontloader | 1.6.28 | 1.6.28 | ✅ OK | |

### Dev Dependencies

| Package | Current | Latest | Status | Notes |
|---------|---------|--------|--------|-------|
| @babel/core | 7.28.3 | 7.28.5 | 🟢 Patch | |
| @babel/preset-env | 7.28.3 | 7.28.5 | 🟢 Patch | |
| @babel/preset-react | 7.27.1 | 7.28.5 | 🟢 Patch | |
| @types/jest | 27.5.2 | 30.0.0 | 🔴 Major | |
| babel-loader | 8.4.1 | 10.0.0 | 🟡 Major | |
| clean-webpack-plugin | 1.0.1 | 4.0.0 | 🔴 Major | Very outdated |
| copy-webpack-plugin | 4.6.0 | 13.0.1 | 🔴 Major | Very outdated |
| css-loader | 5.0.0 | 7.1.2 | 🔴 Major | |
| jest | 28.1.0 | 29.7.0 | 🟡 Major | |
| style-loader | 2.0.0 | 3.3.4 | 🟡 Major | |
| ts-jest | 28.0.3 | 29.3.4 | 🟡 Major | Must match jest |
| ts-loader | 9.5.4 | 9.5.4 | ✅ OK | |
| typescript | 5.1.3 | 5.8.3 | 🟢 Minor | |
| webpack | 5.101.3 | 5.101.3 | ✅ OK | |
| webpack-bundle-analyzer | 4.10.2 | 4.10.2 | ✅ OK | |
| webpack-cli | 4.10.0 | 5.1.4 | 🟡 Major | |
| webpack-dev-server | 3.11.2 | 5.3.0 | 🔴 Major | 2 versions behind |
| webpack-merge | 5.10.0 | 5.10.0 | ✅ OK | |

### Action Items
- [ ] Align TypeScript version (decide 4.9.5 or 5.x)
- [ ] Update webpack-dev-server to 4.x
- [ ] Update clean-webpack-plugin to 4.x
- [ ] Update copy-webpack-plugin (significant API changes)
- [ ] Update css-loader and style-loader
- [ ] Update Jest to 29.x

---

## 5. noodl-viewer-cloud

**Location:** `/packages/noodl-viewer-cloud/package.json`

### Dependencies

| Package | Current | Latest | Status | Notes |
|---------|---------|--------|--------|-------|
| @noodl/runtime | file: | - | ✅ OK | Local |

### Dev Dependencies

| Package | Current | Latest | Status | Notes |
|---------|---------|--------|--------|-------|
| copy-webpack-plugin | 4.6.0 | 13.0.1 | 🔴 Major | Very outdated |
| generate-json-webpack-plugin | 2.0.0 | 2.0.0 | ✅ OK | |
| ts-loader | 9.5.4 | 9.5.4 | ✅ OK | |
| typescript | 4.9.5 | 5.8.3 | 🟡 Major | |

### Action Items
- [ ] Update copy-webpack-plugin

---

## 6. noodl-runtime

**Location:** `/packages/noodl-runtime/package.json`

### Dependencies

| Package | Current | Latest | Status | Notes |
|---------|---------|--------|--------|-------|
| lodash.difference | 4.5.0 | 4.5.0 | ✅ OK | |
| lodash.isequal | 4.5.0 | 4.5.0 | ✅ OK | |

### Dev Dependencies

| Package | Current | Latest | Status | Notes |
|---------|---------|--------|--------|-------|
| jest | 28.1.0 | 29.7.0 | 🟡 Major | |

### Notes
- Very minimal dependencies
- Consider updating Jest to 29.x for consistency

---

## 7. noodl-git

**Location:** `/packages/noodl-git/package.json`

### Dependencies

| Package | Current | Latest | Status | Notes |
|---------|---------|--------|--------|-------|
| desktop-trampoline | 0.9.8 | 0.9.8 | ✅ OK | Git auth helper |
| double-ended-queue | 2.1.0-0 | 2.1.0-0 | ✅ OK | |
| dugite | 1.110.0 | 3.0.0 | 🔴 Major | Breaking API changes |
| split2 | 4.1.0 | 4.2.0 | 🟢 Minor | |

### Notes
- **dugite 3.0** has significant breaking changes
- Affects git operations throughout the editor
- Upgrade should be carefully planned

---

## 8. noodl-platform

**Location:** `/packages/noodl-platform/package.json`

### Dependencies
None (interface definitions only)

### Notes
- This is primarily a TypeScript definitions package
- No external dependencies

---

## 9. noodl-platform-electron

**Location:** `/packages/noodl-platform-electron/package.json`

### Dependencies

| Package | Current | Latest | Status | Notes |
|---------|---------|--------|--------|-------|
| @noodl/platform-node | file: | - | ✅ OK | Local |

### Peer Dependencies

| Package | Current | Latest | Status | Notes |
|---------|---------|--------|--------|-------|
| @electron/remote | >=2.1.3 | 2.1.3 | ✅ OK | |
| electron | >=20.1.0 | 39.2.6 | 🔴 Note | Peer constraint |

---

## 10. noodl-platform-node

**Location:** `/packages/noodl-platform-node/package.json`

### Dependencies

| Package | Current | Latest | Status | Notes |
|---------|---------|--------|--------|-------|
| @noodl/platform | file: | - | ✅ OK | Local |
| fs-extra | 10.0.1 | 11.3.2 | 🟡 Major | |

### Dev Dependencies

| Package | Current | Latest | Status | Notes |
|---------|---------|--------|--------|-------|
| @types/fs-extra | 9.0.13 | 11.0.4 | 🟡 Major | Should match fs-extra |
| @types/jest | 29.5.14 | 30.0.0 | 🟡 Major | |
| jest | 29.7.0 | 29.7.0 | ✅ OK | Latest jest here |
| ts-jest | 29.1.1 | 29.3.4 | 🟢 Patch | |
| typescript | 5.5.4 | 5.8.3 | 🟢 Minor | Different from others |

### Notes
- This package has Jest 29 (unlike others with 28)
- Consider aligning all packages to Jest 29

---

## 11. noodl-parse-dashboard

**Location:** `/packages/noodl-parse-dashboard/package.json`

### Dependencies

| Package | Current | Latest | Status | Notes |
|---------|---------|--------|--------|-------|
| bcryptjs | 2.4.3 | 3.0.3 | 🟡 Major | |
| connect-flash | 0.1.1 | 0.1.1 | ✅ OK | |
| cookie-session | 2.0.0 | 2.1.1 | 🟢 Minor | |
| express | 4.21.2 | 5.2.1 | 🔴 Major | Express 5 breaking |
| lodash | 4.17.21 | 4.17.21 | ✅ OK | |
| otpauth | 7.1.3 | 9.4.3 | 🟡 Major | |
| package-json | 7.0.0 | 10.0.2 | 🔴 Major | |
| parse-dashboard | 5.2.0 | 6.1.0 | 🟡 Major | |
| passport | 0.6.0 | 0.7.0 | 🟢 Minor | |
| passport-local | 1.0.0 | 1.0.0 | ✅ OK | |

### Dev Dependencies

| Package | Current | Latest | Status | Notes |
|---------|---------|--------|--------|-------|
| keyv | 4.5.4 | 5.5.5 | 🔴 Major | |

### Notes
- Parse Dashboard has many outdated dependencies
- Express 5.x migration is significant undertaking
- parse-dashboard 6.x may have breaking changes

---

## 12. noodl-types

**Location:** `/packages/noodl-types/package.json`

### Dependencies
None (type definitions only)

### Notes
- Purely TypeScript definition package
- No runtime dependencies

---

## 13. Cross-Package Issues

### TypeScript Version Matrix

| Package | Version | Notes |
|---------|---------|-------|
| Root | 4.9.5 | |
| noodl-editor | 4.9.5 | |
| noodl-core-ui | 4.9.5 | |
| noodl-viewer-react | **5.1.3** | ⚠️ Different |
| noodl-viewer-cloud | 4.9.5 | |
| noodl-platform-node | **5.5.4** | ⚠️ Different |

**Recommendation:** Standardize on either:
- 4.9.5 for stability (all packages)
- 5.x for latest features (requires testing)

### Jest Version Matrix

| Package | Version | Notes |
|---------|---------|-------|
| noodl-runtime | 28.1.0 | |
| noodl-viewer-react | 28.1.0 | |
| noodl-platform-node | **29.7.0** | ⚠️ Different |

**Recommendation:** Update all to Jest 29.7.0

### Webpack Ecosystem Matrix

| Package | webpack | dev-server | css-loader | style-loader |
|---------|---------|------------|------------|--------------|
| Root | 5.101.3 | 4.15.2 | - | - |
| noodl-editor | 5.101.3 | 4.15.2 | 6.11.0 | 3.3.4 |
| noodl-viewer-react | 5.101.3 | **3.11.2** | **5.0.0** | **2.0.0** |

**Issues:**
- noodl-viewer-react using webpack-dev-server 3.x (2 major behind)
- css-loader and style-loader versions mismatched
