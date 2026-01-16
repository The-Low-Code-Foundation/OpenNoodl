# TASK-007J: Schema & Data Creation UX

## Status: 📋 Draft

## Summary

Add the missing creation UX to the Schema and Data Browser panels - create tables, add/edit/delete columns, and create data records with proper type handling.

---

## Problem

The current implementation (007H + 007I) provides excellent **viewing** and **inline editing** capabilities, but is missing the ability to **create new structures from scratch**:

- Schema Panel shows tables but no way to create a new table
- No way to add/edit/delete columns in existing tables
- Data Browser has "+ New Record" but useless without tables
- Field types need proper UI for creation (default values, constraints)

---

## Dependencies

**Backend (Already Exists ✅):**

- `backend:createTable` - IPC handler in BackendManager.js
- `backend:addColumn` - IPC handler in BackendManager.js
- LocalSQLAdapter has all CRUD methods for schema changes

**UI Components (Already Exists ✅):**

- SchemaPanel - just needs buttons and modals wired up
- DataBrowser - just needs better empty state

---

## Implementation Plan

### Part 1: Create Table Modal

**New Component: `CreateTableModal.tsx`**

Features:

- Table name input (validated: alphanumeric, no spaces, unique)
- Initial columns list with ability to add/remove
- For each column:
  - Name input
  - Type dropdown (String, Number, Boolean, Date, Object, Array)
  - Required checkbox
  - Default value input (type-aware)
- "Create Table" button calls `backend:createTable`

**Supported Field Types:**
| Type | SQLite | Default Input |
|------|--------|---------------|
| String | TEXT | Text input |
| Number | REAL | Number input |
| Boolean | INTEGER | Checkbox |
| Date | TEXT (ISO) | Date picker |
| Object | TEXT (JSON) | JSON editor |
| Array | TEXT (JSON) | JSON editor |

**Integration:**

- Add `showCreateTableModal` state to SchemaPanel
- Wire up "+ New Table" button (already in header)
- Call `loadSchema()` on success

### Part 2: Add Column to Existing Table

**New Component: `AddColumnForm.tsx`**

Features:

- Inline form that appears in expanded table view
- Column name input
- Type dropdown
- Required checkbox
- Default value (required for non-nullable columns if table has data)
- "Add Column" button calls `backend:addColumn`

**Integration:**

- Add to TableRow component's expanded view
- Add "+ Add Column" button to expanded section
- Handles the case where existing records need default values

### Part 3: Edit Column (Rename/Change Type)

**Note:** SQLite has limited ALTER TABLE support. Only RENAME COLUMN is safe.

**Features:**

- Edit icon next to each column in expanded view
- Opens inline editor for column name
- Type change is **not supported** (would need table recreation)
- Shows tooltip: "Type cannot be changed after creation"

### Part 4: Delete Column

**New IPC Handler Needed:** `backend:deleteColumn`

**Note:** SQLite doesn't support DROP COLUMN directly - needs table recreation.

**Implementation options:**

1. **Not supported** - show tooltip "SQLite doesn't support column deletion"
2. **Recreate table** - expensive but possible:
   - Create new table without column
   - Copy data
   - Drop old table
   - Rename new table

**Recommendation:** Option 1 for MVP, Option 2 as enhancement

### Part 5: Delete Table

**New IPC Handler Needed:** `backend:deleteTable` (or use existing drop)

**Features:**

- Delete/trash icon on each table row
- Confirmation dialog: "Delete table {name}? This will permanently delete all data."
- Calls `backend:deleteTable`

### Part 6: Improved Empty States

**Schema Panel (when no tables):**

```
┌─────────────────────────────────────┐
│  🗄️ No tables yet                  │
│                                     │
│  Create your first table to start  │
│  storing data in your backend.     │
│                                     │
│  [+ Create Table]                   │
└─────────────────────────────────────┘
```

**Data Browser (when no tables):**

```
┌─────────────────────────────────────┐
│  📊 No tables in database          │
│                                     │
│  Go to Schema panel to create      │
│  your first table, then return     │
│  here to browse and edit data.     │
│                                     │
│  [Open Schema Panel]                │
└─────────────────────────────────────┘
```

---

## Files to Create/Modify

### New Files:

```
panels/schemamanager/
├── CreateTableModal.tsx        - Modal for creating new tables
├── CreateTableModal.module.scss
├── AddColumnForm.tsx           - Inline form for adding columns
├── AddColumnForm.module.scss
├── ColumnEditor.tsx            - Inline column name editor
└── ColumnEditor.module.scss
```

### Modified Files:

```
main/src/local-backend/BackendManager.js
  - Add deleteColumn() if implementing column deletion
  - Add deleteTable() IPC handler

panels/schemamanager/SchemaPanel.tsx
  - Add showCreateTableModal state
  - Wire up modal

panels/schemamanager/TableRow.tsx
  - Add AddColumnForm integration
  - Add column edit/delete actions
  - Add table delete action

panels/databrowser/DataBrowser.tsx
  - Improve empty state with link to Schema panel
```

---

## Estimation

| Part                  | Complexity | Time Est    |
| --------------------- | ---------- | ----------- |
| CreateTableModal      | Medium     | 1-2 hrs     |
| AddColumnForm         | Medium     | 1 hr        |
| ColumnEditor (rename) | Simple     | 30 min      |
| Delete table          | Simple     | 30 min      |
| Empty states          | Simple     | 15 min      |
| Testing & polish      | -          | 1 hr        |
| **Total**             | -          | **4-5 hrs** |

---

## Acceptance Criteria

- [ ] Can create a new table with name and columns
- [ ] Can add columns to existing tables
- [ ] Can rename columns
- [ ] Can delete tables (with confirmation)
- [ ] Field types have proper UI controls
- [ ] Empty states guide users to create structures
- [ ] All actions refresh the panel after success
- [ ] Error states for invalid names/constraints
- [ ] Theme-compliant styling (no hardcoded colors)

---

## Technical Notes

### Table Name Validation

```javascript
const isValidTableName = (name) => {
  // Must start with letter, alphanumeric + underscore only
  // Cannot be SQLite reserved words
  return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(name) && !SQLITE_RESERVED_WORDS.includes(name.toUpperCase());
};
```

### Default Values for Types

```javascript
const getDefaultForType = (type) =>
  ({
    String: '',
    Number: 0,
    Boolean: false,
    Date: new Date().toISOString(),
    Object: {},
    Array: []
  }[type]);
```

### SQLite Limitations

- No DROP COLUMN (before SQLite 3.35.0)
- No ALTER COLUMN TYPE
- RENAME COLUMN supported (SQLite 3.25.0+)

---

## Related Tasks

- **007H**: Schema Panel (viewing) ✅
- **007I**: Data Browser (viewing/editing) ✅
- **007J**: Schema & Data Creation UX ← This task
