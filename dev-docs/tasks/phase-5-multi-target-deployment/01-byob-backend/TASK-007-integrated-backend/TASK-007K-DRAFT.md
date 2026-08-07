# TASK-007K: Local Backend Bug Fixes & Polish

## Status: 📋 DRAFT

## Overview

This task addresses the known bugs and UX issues from TASK-007J. The Schema Manager and Data Browser are functional but have rough edges that need polish.

## Priority 1: Critical Bugs

### 1.1 Object/Array Field Editor

**Problem:** Can't type into Object/Array field text areas in CellEditor.

**Files:** `CellEditor.tsx`

**Fix:** Review the textarea handling, may need to prevent event bubbling or fix focus management.

### 1.2 Real SQLite Database

**Problem:** Falls back to in-memory mock because better-sqlite3 import fails in Electron renderer.

**Files:** `LocalSQLAdapter.js`, `BackendManager.js`

**Fix Options:**

- Move SQLite operations to main process via IPC
- Use sql.js (pure JS SQLite) in renderer
- Configure better-sqlite3 for Electron properly

### 1.3 Schema Persistence

**Problem:** Schema changes (new tables, columns) don't persist across restarts.

**Files:** `SchemaManager.js`, `LocalBackendServer.js`

**Fix:** Ensure schema table is properly created and migrations are stored.

## Priority 2: Missing Features

### 2.1 Edit Existing Tables

**Problem:** No UI for adding/removing columns from existing tables.

**Files:** `SchemaPanel.tsx`, `TableRow.tsx`

**Add:**

- "Add Column" button in expanded table row
- Delete column button per column
- Confirmation for destructive actions

### 2.2 Delete Tables

**Problem:** No way to delete a table.

**Files:** `SchemaPanel.tsx`, `TableRow.tsx`

**Add:**

- Delete button in table row
- Confirmation dialog
- Backend `backend:deleteTable` IPC handler

### 2.3 Better Boolean Toggle

**Problem:** Checkbox not intuitive for boolean fields.

**Files:** `CellEditor.tsx`

**Add:** Toggle switch component instead of checkbox.

### 2.4 Date Picker

**Problem:** Text input for dates is error-prone.

**Files:** `CellEditor.tsx`

**Add:** Date picker component (can use core-ui DateInput if available).

## Priority 3: UX Improvements

### 3.1 Pointer/Relation Field Editor

Add dropdown to select from related records.

### 3.2 File Field Editor

Add file picker/upload UI.

### 3.3 Search All Fields

Extend search to Number, Date fields (not just String).

### 3.4 Keyboard Navigation

- Arrow keys to navigate grid
- Enter to edit cell
- Escape to cancel
- Tab to move between cells

## Estimated Effort

| Priority  | Items | Effort        |
| --------- | ----- | ------------- |
| P1        | 3     | 4-6 hrs       |
| P2        | 4     | 3-4 hrs       |
| P3        | 4     | 4-6 hrs       |
| **Total** |       | **11-16 hrs** |

## Dependencies

- Core UI components (Toggle, DatePicker)
- May need main process changes for SQLite

## Notes

- Consider splitting this into multiple sub-tasks if scope is too large
- SQLite issue may require significant architecture change
- Focus on P1 bugs first for usable MVP
