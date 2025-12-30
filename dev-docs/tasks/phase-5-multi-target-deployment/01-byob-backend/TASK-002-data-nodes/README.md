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

## Known Limitations (Dec 2025)

### Directus System Collections Not Supported

**Issue**: The Query Data node only uses `/items/{collection}` API endpoint, which doesn't work for Directus system tables.

**Affected Collections**:

- `directus_users` - User management (use `/users` endpoint)
- `directus_roles` - Role management (use `/roles` endpoint)
- `directus_files` - File management (use `/files` endpoint)
- `directus_folders` - Folder management (use `/folders` endpoint)
- `directus_activity` - Activity log (use `/activity` endpoint)
- `directus_permissions` - Permissions (use `/permissions` endpoint)
- And other `directus_*` system tables

**Current Behavior**: These collections may appear in the Collection dropdown (if schema introspection includes them), but queries will fail with 404 or forbidden errors.

**Future Enhancement**: Add an "API Path Type" dropdown to the Query node:

- **Items** (default) - Uses `/items/{collection}` for user collections
- **System** - Uses `/{collection_without_directus_prefix}` for system tables

**Alternative Workaround**: Use the HTTP Request node with manual endpoint construction for system table access.

**Related**: This limitation also affects Create/Update/Delete Record nodes (when implemented).
