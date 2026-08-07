# TASK-002: Data Nodes Integration

**Task ID:** TASK-002  
**Phase:** 5 - Multi-Target Deployment (BYOB)  
**Priority:** 🔴 Critical  
**Difficulty:** 🔴 Hard  
**Estimated Time:** 1-2 weeks  
**Prerequisites:** TASK-001 (Backend Services Panel)  
**Branch:** `feature/byob-data-nodes`

## Objective

Create visual data nodes (Query, Create, Update, Delete) that connect to the configured Backend Services, with a **Visual Filter Builder** as the hero feature.

## Background

Users can now configure backend connections (TASK-001), but there's no way to actually USE them. This task bridges that gap by creating data nodes that:

- Read from the cached schema to populate field dropdowns
- Execute queries against the configured backend
- Provide a visual way to build complex filters (the key differentiator)

The **Visual Filter Builder** eliminates the pain of writing Directus filter JSON manually.

## User Story

> As a Noodl user, I want to visually build queries against my Directus backend, so I don't have to learn the complex filter JSON syntax.

## Current State

- Backend Services Panel exists (TASK-001 ✅)
- Schema introspection works for Directus
- No data nodes exist for BYOB backends
- Users would have to use raw HTTP nodes

## Desired State

- Query Records node with visual filter builder
- Create/Update/Delete Record nodes
- All nodes populate dropdowns from cached schema
- Filters generate correct Directus JSON

## Scope

### In Scope

- Query Records node (most complex - has filter builder)
- Create Record node
- Update Record node
- Delete Record node
- Directus backend support (primary focus)

### Out of Scope

- Supabase/Pocketbase adapters (future task)
- Realtime subscriptions
- Batch operations
- File upload nodes

---

## System Table Support (Resolved - Dec 2025)

### Directus System Collections Now Supported ✅

All BYOB data nodes now support Directus system tables through an **API Path Mode** dropdown:

**Available Modes**:

- **Items (User Collections)** - Uses `/items/{collection}` endpoint for regular tables
- **System (Directus Tables)** - Uses appropriate system endpoints for `directus_*` tables

**Supported System Collections**:

- `directus_users` → `/users`
- `directus_roles` → `/roles`
- `directus_files` → `/files`
- `directus_folders` → `/folders`
- `directus_activity` → `/activity`
- `directus_permissions` → `/permissions`
- `directus_settings` → `/settings`
- `directus_webhooks` → `/webhooks`
- `directus_flows` → `/flows`
- And more...

**Auto-Detection**: The API Path Mode automatically defaults to "System" when a `directus_*` collection is selected.

**Applies To**: Query Data, Create Record, Update Record, and Delete Record nodes.

---

## Implementation Status

**Status**: ✅ **Complete** (December 2025)

All four BYOB data nodes are fully implemented and tested:

- ✅ **Query Records Node** - With visual filter builder
- ✅ **Create Record Node** - With schema-driven field inputs
- ✅ **Update Record Node** - With schema-driven field inputs
- ✅ **Delete Record Node** - Simple ID-based deletion

### Key Features Delivered

1. **Schema-Aware Field Inputs** - Dynamic ports generated from backend schema
2. **Visual Filter Builder** - Complex query filters without JSON syntax
3. **System Table Support** - Full CRUD on Directus system collections
4. **Type-Aware Inputs** - Numbers, booleans, dates, and enums mapped correctly
5. **Date Normalization** - Automatic ISO 8601 conversion
6. **Field Filtering** - Hides presentation elements and readonly fields

### Implementation Files

```
packages/noodl-runtime/src/nodes/std-library/data/
├── byob-utils.js              # Shared utilities (NEW)
├── byob-query-data.js         # Query Records node
├── byob-create-record.js      # Create Record node
├── byob-update-record.js      # Update Record node
└── byob-delete-record.js      # Delete Record node

packages/noodl-editor/src/editor/src/views/panels/propertyeditor/
├── components/ByobFilterBuilder/  # Visual filter builder UI
└── DataTypes/ByobFilterType.ts    # Filter builder integration
```

### Recent Bug Fixes

See [CHANGELOG.md](./CHANGELOG.md) for detailed bug fix documentation including:

- Collection filtering by API path mode
- Field type mapping
- System table schema support
- Critical runtime errors resolved

---

## Documentation

- [NODES-SPEC.md](./NODES-SPEC.md) - Node specifications and API reference
- [FILTER-BUILDER.md](./FILTER-BUILDER.md) - Visual filter builder details
- [CHANGELOG.md](./CHANGELOG.md) - Bug fixes and implementation timeline
