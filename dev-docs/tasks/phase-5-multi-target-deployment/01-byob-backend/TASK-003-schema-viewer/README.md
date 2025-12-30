# TASK-003: Schema Viewer Component

**Task ID:** TASK-003  
**Phase:** 5 - Multi-Target Deployment (BYOB)  
**Priority:** 🟡 Medium  
**Difficulty:** 🟢 Easy  
**Estimated Time:** 2-3 days  
**Prerequisites:** TASK-001 (Backend Services Panel)  
**Branch:** `feature/byob-schema-viewer`

## Objective

Create a dedicated Schema Viewer component that displays the cached schema from connected backends in an interactive, collapsible tree view.

## Background

TASK-001 implemented basic schema introspection, but the current UI only shows collection names in a simple list. Users need to:

- See all fields in each collection
- Understand field types and constraints
- Easily copy field names for use in nodes
- Refresh schema when backend changes

## User Story

> As a Noodl user, I want to browse my backend's data schema visually, so I can understand what data is available and use correct field names.

## Current State

- Schema is fetched and cached (TASK-001 ✅)
- Only collection names shown in Backend Services Panel
- No field details visible
- No way to copy field paths

## Desired State

- Expandable tree view of collections → fields
- Field type icons and badges
- Copy field path on click
- Relation indicators
- Search/filter collections
- Refresh button

## UI Design

```
┌─────────────────────────────────────────────────────────────────────┐
│ SCHEMA BROWSER                              [🔍 Search] [↻ Refresh] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ▼ users (12 fields)                                                 │
│   ├─ 🔑 id (uuid) PRIMARY                                           │
│   ├─ 📧 email (email) REQUIRED UNIQUE                               │
│   ├─ 📝 name (string)                                               │
│   ├─ 🖼️ avatar (image)                                              │
│   ├─ 🔗 role → roles (relation-one)                                 │
│   ├─ 📅 created_at (datetime) READ-ONLY                             │
│   └─ 📅 updated_at (datetime) READ-ONLY                             │
│                                                                     │
│ ▶ posts (8 fields)                                                  │
│ ▶ comments (6 fields)                                               │
│ ▶ categories (4 fields)                                             │
│ ▶ media (7 fields)                                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Features

### 1. Collapsible Tree Structure

- Collections at root level
- Fields as children
- Expand/collapse with animation
- "Expand All" / "Collapse All" buttons

### 2. Field Information Display

Each field shows:

- Name
- Type (with icon)
- Constraints (REQUIRED, UNIQUE, PRIMARY)
- Default value (if set)
- Relation target (for relation fields)

### 3. Field Type Icons

| Type           | Icon | Color   |
| -------------- | ---- | ------- |
| string         | 📝   | default |
| text           | 📄   | default |
| number/integer | 🔢   | blue    |
| boolean        | ✅   | green   |
| datetime       | 📅   | purple  |
| email          | 📧   | blue    |
| url            | 🔗   | blue    |
| image/file     | 🖼️   | orange  |
| relation       | 🔗   | cyan    |
| json           | {}   | gray    |
| uuid           | 🔑   | yellow  |

### 4. Copy Field Path

- Click on field name → copies to clipboard
- For nested paths: `collection.field`
- Toast notification: "Copied: author.name"

### 5. Search/Filter

- Filter collections by name
- Filter fields within collections
- Highlight matching text

### 6. Refresh Schema

- Manual refresh button
- Shows last synced timestamp
- Loading indicator during refresh

## Implementation

### File Structure

```
packages/noodl-editor/src/editor/src/views/panels/BackendServicesPanel/
├── SchemaViewer/
│   ├── SchemaViewer.tsx           # Main component
│   ├── SchemaViewer.module.scss
│   ├── CollectionTree.tsx         # Collection list
│   ├── FieldRow.tsx               # Single field display
│   ├── FieldTypeIcon.tsx          # Type icon component
│   └── types.ts
```

### Component API

```typescript
interface SchemaViewerProps {
  backend: BackendConfig;
  onRefresh: () => Promise<void>;
}
```

### Integration Point

The SchemaViewer should be embedded in the BackendServicesPanel, shown when a backend is selected or expanded.

## Success Criteria

- [ ] Tree view displays all collections from schema
- [ ] Fields expand/collapse per collection
- [ ] Field types shown with appropriate icons
- [ ] Constraints (REQUIRED, UNIQUE) visible
- [ ] Click to copy field path works
- [ ] Search filters collections and fields
- [ ] Refresh button fetches fresh schema
- [ ] Last synced timestamp displayed
