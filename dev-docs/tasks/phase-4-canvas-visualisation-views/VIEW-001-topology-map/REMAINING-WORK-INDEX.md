# Topology Map Panel - Remaining Work Index

**Status:** In Progress  
**Last Updated:** April 1, 2026

## Overview

This index tracks remaining work for VIEW-001 (Topology Map Panel). Work is split into focused documents to prevent scope confusion.

---

## 📋 Document Index

### 1. **[CRITICAL-BUGS.md](./CRITICAL-BUGS.md)**

Visual bugs that must be fixed before continuing with new features.

**Priority:** 🔴 **HIGHEST - Fix First**

### 2. **[PHASE-3-DRAGGABLE.md](./PHASE-3-DRAGGABLE.md)**

Drag-and-drop functionality for cards with position persistence.

**Priority:** 🟡 After bugs fixed

### 3. **[PHASE-4-STICKY-NOTES.md](./PHASE-4-STICKY-NOTES.md)**

Markdown sticky notes with drag-and-drop positioning.

**Priority:** 🟡 After draggable cards

### 4. **[PHASE-5-DRILLDOWN.md](./PHASE-5-DRILLDOWN.md)**

Drilldown view redesign and navigation improvements.

**Priority:** 🟢 Future enhancement

---

## ✅ Completed Work

### Phase 1: Icons & Styling (✅ Complete)

- Replaced emojis with SVG icons from icon system
- Used `foreignObject` for React Icon components in SVG
- Applied design tokens throughout SCSS files
- Changed sidebar icon to `IconName.StructureCircle`

### Phase 2: Enhanced Information (✅ Complete)

- Added gradient-colored connector lines (folder type colors)
- Added X-Ray stats to component cards
- Added component name previews to folder cards
- Added connection counts ("X in • Y out")
- Increased card heights for better information display

### Infrastructure (✅ Complete)

- Created `folderColors.ts` - Color/icon mapping
- Created `componentStats.ts` - Lightweight stats extraction
- Created `topologyPersistence.ts` - Project metadata persistence
- Created `snapToGrid.ts` - 20px grid snapping
- Created `useDraggable.ts` - Drag-and-drop hook

---

## 🎯 Current Focus

**Fix critical bugs in CRITICAL-BUGS.md before proceeding to Phase 3**

---

## 📁 File Locations

All Topology Map Panel code is in:

```
packages/noodl-editor/src/editor/src/views/panels/TopologyMapPanel/
├── components/
│   ├── ComponentNode.tsx
│   ├── ComponentNode.module.scss
│   ├── FolderNode.tsx
│   ├── FolderNode.module.scss
│   ├── FolderEdge.tsx
│   └── TopologyMapView.tsx
├── hooks/
│   ├── useTopologyGraph.ts
│   ├── useFolderGraph.ts
│   ├── useTopologyLayout.ts
│   ├── useFolderLayout.ts
│   └── useDraggable.ts (infrastructure ready)
├── utils/
│   ├── topologyTypes.ts
│   ├── folderTypeDetection.ts
│   ├── tierAssignment.ts
│   ├── folderAggregation.ts
│   ├── folderColors.ts
│   ├── componentStats.ts
│   ├── topologyPersistence.ts
│   └── snapToGrid.ts
└── TopologyMapPanel.tsx (main panel)
```
