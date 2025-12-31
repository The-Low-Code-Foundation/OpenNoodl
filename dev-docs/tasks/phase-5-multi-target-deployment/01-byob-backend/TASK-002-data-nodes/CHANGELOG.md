# TASK-002 Data Nodes - Change Log

## December 30, 2025 - Bug Fixes & System Table Support

### Critical Bugs Fixed

#### 1. Collection Dropdown Not Filtering by API Path Mode

**Problem**: When selecting "System" as the API Path Mode, the Collection dropdown still showed all collections (both user tables and system tables).

**Root Cause**: The `updatePorts()` function was not filtering collections based on the selected `apiPathMode`.

**Solution**: Created `ByobUtils.filterCollectionsByMode()` function that filters collections appropriately:

- `items` mode: Shows only non-system tables
- `system` mode: Shows only `directus_*` tables

**Files Modified**:

- `packages/noodl-runtime/src/nodes/std-library/data/byob-utils.js` (created)
- `packages/noodl-runtime/src/nodes/std-library/data/byob-query-data.js`
- `packages/noodl-runtime/src/nodes/std-library/data/byob-create-record.js`
- `packages/noodl-runtime/src/nodes/std-library/data/byob-update-record.js`
- `packages/noodl-runtime/src/nodes/std-library/data/byob-delete-record.js`

---

#### 2. API Path Dropdown Positioned After Collection (UX Issue)

**Problem**: The "Collection" dropdown appeared before "API Path Mode", making the UI confusing since users had to select a collection before understanding which API path would be used.

**Solution**: Reordered port definitions in all BYOB nodes to place `apiPathMode` before `collection`.

**Files Modified**: All four BYOB data nodes (Query, Create, Update, Delete)

---

#### 3. All Field Types Showing as Generic String Inputs

**Problem**: All database fields appeared as plain text inputs regardless of their actual type (numbers, dates, booleans, enums, etc.).

**Root Cause**: No field type mapping from Directus schema types to Noodl input types.

**Solution**: Created `ByobUtils.getEnhancedFieldType()` function that maps Directus types to appropriate Noodl types:

| Directus Type                               | Noodl Type | Notes                        |
| ------------------------------------------- | ---------- | ---------------------------- |
| `integer`, `bigInteger`, `float`, `decimal` | `number`   | Numeric input                |
| `boolean`                                   | `boolean`  | Checkbox/toggle              |
| `date`, `dateTime`, `time`, `timestamp`     | `string`   | With date normalization      |
| `uuid`                                      | `string`   | Standard text input          |
| `json`, `csv`                               | `string`   | Multi-line text              |
| `text`, `string`                            | `string`   | Standard text input          |
| `select`, `dropdown`                        | `enum`     | Dropdown with schema options |

**Files Modified**:

- `packages/noodl-runtime/src/nodes/std-library/data/byob-utils.js`
- `packages/noodl-runtime/src/nodes/std-library/data/byob-create-record.js`
- `packages/noodl-runtime/src/nodes/std-library/data/byob-update-record.js`

---

#### 4. Presentation Elements Appearing in Field Lists

**Problem**: Non-data fields (dividers, notices, aliases) were appearing in the field input lists.

**Root Cause**: No filtering of presentation-only fields from the schema.

**Solution**: Created `ByobUtils.shouldShowField()` function that filters out:

- Fields with `interface` starting with `'presentation-'`
- Hidden fields (`hidden: true`)
- Readonly meta fields (e.g., `id`, `user_created`, `date_created`)

**Files Modified**:

- `packages/noodl-runtime/src/nodes/std-library/data/byob-utils.js`
- Applied in Create and Update nodes during field port generation

---

#### 5. Critical Error: `Cannot set properties of undefined (setting 'fieldSchema')`

**Problem**: Runtime error when selecting certain collections in Create/Update nodes.

**Root Cause**: Attempting to set `node._internal.fieldSchema` before `node._internal` object was initialized.

**Solution**: Added null checks to ensure `_internal` exists:

```javascript
if (!node._internal) {
  node._internal = {};
}
node._internal.fieldSchema = fieldSchema;
```

**Files Modified**:

- `packages/noodl-runtime/src/nodes/std-library/data/byob-create-record.js` (2 locations)
- `packages/noodl-runtime/src/nodes/std-library/data/byob-update-record.js` (2 locations)

---

#### 6. System Tables Not Appearing in Schema

**Problem**: Even after fixing collection filtering, system tables weren't showing in the dropdown at all.

**Root Cause**: `BackendServices.ts` was explicitly filtering OUT `directus_*` collections during schema parsing:

```typescript
// OLD CODE:
if (!field.collection || field.collection.startsWith('directus_')) continue;
```

**Solution**: Changed to only skip fields with no collection name:

```typescript
// NEW CODE:
if (!field.collection) continue;
```

**Important**: Users must **re-fetch the backend schema** after this change for system tables to appear.

**Files Modified**:

- `packages/noodl-editor/src/editor/src/models/BackendServices/BackendServices.ts` (line ~500)

---

### Enhancements Added

#### Date Value Normalization

Added automatic conversion of date inputs to ISO 8601 format in Create and Update nodes:

```javascript
const normalizedData = {};
for (const [key, value] of Object.entries(data)) {
  normalizedData[key] = ByobUtils.normalizeValue(value, fieldSchema[key]);
}
```

This ensures date fields are always sent in the correct format regardless of user input format.

---

#### System Endpoint Mapping

Created comprehensive mapping of Directus system collections to their API endpoints:

| Collection             | API Endpoint        |
| ---------------------- | ------------------- |
| `directus_users`       | `/users`            |
| `directus_roles`       | `/roles`            |
| `directus_files`       | `/files`            |
| `directus_folders`     | `/folders`          |
| `directus_activity`    | `/activity`         |
| `directus_permissions` | `/permissions`      |
| `directus_settings`    | `/settings`         |
| `directus_webhooks`    | `/webhooks`         |
| `directus_flows`       | `/flows`            |
| And 8 more...          | (see byob-utils.js) |

---

### Files Created

**`packages/noodl-runtime/src/nodes/std-library/data/byob-utils.js`**

- Shared utility module for all BYOB data nodes
- Contains all helper functions mentioned above
- Prevents code duplication across the four BYOB nodes

---

### Testing Notes

1. **System Tables**: After updating BackendServices.ts, you MUST re-fetch the backend schema from the Backend Services Panel
2. **Field Types**: Verify that number fields show number inputs, booleans show toggles, and select fields show dropdowns
3. **Collection Filtering**: Verify that switching API Path Mode updates the Collection dropdown appropriately
4. **Date Fields**: Test that date inputs are converted to ISO 8601 format in API requests

---

### Known Limitations

- Only Directus backend is fully supported
- Filter builder is implemented but not yet fully tested with all operator types
- Relation fields show as ID inputs (not yet a searchable dropdown of related records)
- No support for file upload fields yet

---

### Next Steps

- Complete testing of visual filter builder with complex nested conditions
- Add support for relation field dropdowns (search related records)
- Extend system endpoint support to Supabase and Pocketbase
- Add file upload field support
