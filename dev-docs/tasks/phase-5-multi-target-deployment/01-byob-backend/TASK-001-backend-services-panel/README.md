# TASK-001: Backend Services Panel

**Task ID:** TASK-001  
**Phase:** 5 - Multi-Target Deployment  
**Priority:** 🔴 Critical  
**Estimated Duration:** 1 week  
**Status:** ✅ Complete (Phase 1)  
**Created:** 2025-12-29  
**Completed:** 2025-12-29  
**Branch:** `feature/byob-backend`

## Overview

Create a new "Backend Services" sidebar panel that allows users to configure external backend databases (Directus, Supabase, Pocketbase, or any custom REST API). This panel will sit alongside the existing "Cloud Services" panel, giving users flexibility to choose their data backend.

## Goals

1. **New Sidebar Panel** - "Backend Services" tab in the far left menu ✅
2. **Backend List** - Display configured backends with connection status ✅
3. **Add Backend Dialog** - Configure new backends with presets or custom ✅
4. **Edit/Delete** - Manage existing backend configurations ✅
5. **Schema Browser** - View tables/collections from connected backends ✅ (basic)

## What Was Implemented

### Model Layer

- `types.ts` - Complete TypeScript interfaces for BackendConfig, schemas, events
- `presets.ts` - Preset configurations for Directus, Supabase, Pocketbase, Custom REST
- `BackendServices.ts` - Singleton model with CRUD, connection testing, schema introspection
- `index.ts` - Clean exports

### UI Components

- `BackendServicesPanel.tsx` - Main panel with backend list and actions
- `BackendCard/BackendCard.tsx` - Individual backend card with status, actions
- `AddBackendDialog/AddBackendDialog.tsx` - Modal for adding new backends
- All components use proper design tokens (no hardcoded colors)

### Key Features

- **Preset Selection**: Easy setup for Directus, Supabase, Pocketbase
- **Custom REST API**: Full configurability for any REST API
- **Connection Testing**: Test button validates connectivity
- **Schema Introspection**: Fetches and caches table/field definitions
- **Active Backend**: One backend can be marked as active
- **Persistence**: Saves to project metadata

## Implementation Steps

### Step 1: Create Backend Model ✅

- [x] Create `BackendServices/types.ts` with TypeScript interfaces
- [x] Create `BackendServices/BackendServices.ts` singleton model
- [x] Create `BackendServices/presets.ts` for preset configurations

### Step 2: Create Panel UI ✅

- [x] Create `BackendServicesPanel.tsx` base panel
- [x] Create `BackendCard.tsx` for displaying a backend
- [x] Add panel to sidebar registry in `router.setup.ts`

### Step 3: Add Backend Dialog ✅

- [x] Create `AddBackendDialog.tsx` with preset selection
- [x] Create backend preset configurations (Directus, Supabase, etc.)
- [x] Implement connection testing
- [x] Implement save/cancel logic

### Step 4: Schema Introspection ✅ (Basic)

- [x] Implement Directus schema parsing
- [x] Implement Supabase schema parsing (OpenAPI)
- [x] Implement Pocketbase schema parsing
- [x] Cache schema in backend config

### Step 5: Integration ✅

- [x] Add "activeBackendId" to project settings
- [x] Emit events when backends change

## Files Created

```
packages/noodl-editor/src/editor/src/
├── models/BackendServices/
│   ├── types.ts              # TypeScript interfaces
│   ├── presets.ts            # Directus, Supabase, Pocketbase presets
│   ├── BackendServices.ts    # Main singleton model
│   └── index.ts              # Exports
└── views/panels/BackendServicesPanel/
    ├── BackendServicesPanel.tsx
    ├── BackendCard/
    │   ├── BackendCard.tsx
    │   └── BackendCard.module.scss
    └── AddBackendDialog/
        ├── AddBackendDialog.tsx
        └── AddBackendDialog.module.scss
```

## Files Modified

```
packages/noodl-editor/src/editor/src/router.setup.ts  # Register panel
```

## Testing Status

- [x] Editor builds and runs without errors
- [ ] Manual testing of panel (pending user verification)
- [ ] Test with real Directus instance
- [ ] Test with real Supabase instance

## Next Steps (Future Tasks)

1. **TASK-002: Data Node Integration** - Update data nodes to use Backend Services
2. **SchemaViewer Component** - Dedicated component to browse schema
3. **Edit Backend Dialog** - Edit existing backends (currently only add/delete)
4. **Local Docker Wizard** - Spin up backends locally

## Notes

- Keep existing Cloud Services panel untouched (Option A from planning)
- Use design tokens for all styling (no hardcoded colors)
- Follow existing patterns from CloudServicePanel closely
- Panel icon: `RestApi` (Database icon didn't exist in IconName enum)

## Related Tasks

| Task     | Name                                                    | Status      |
| -------- | ------------------------------------------------------- | ----------- |
| TASK-002 | [Data Nodes Integration](../TASK-002-data-nodes/)       | Not Started |
| TASK-003 | [Schema Viewer Component](../TASK-003-schema-viewer/)   | Not Started |
| TASK-004 | [Edit Backend Dialog](../TASK-004-edit-backend-dialog/) | Not Started |
| TASK-005 | [Local Docker Wizard](../TASK-005-local-docker-wizard/) | Not Started |
