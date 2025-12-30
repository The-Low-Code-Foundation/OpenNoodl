# Data Node Specifications

This document defines the four data nodes for BYOB backends.

## 1. Query Records Node

The primary node for fetching data from backends.

### Inputs

| Input      | Type          | Description                                     |
| ---------- | ------------- | ----------------------------------------------- |
| Backend    | dropdown      | Select configured backend (or "Active Backend") |
| Collection | dropdown      | Select table/collection from schema             |
| Filter     | FilterBuilder | Visual filter builder (see FILTER-BUILDER.md)   |
| Sort Field | dropdown      | Field to sort by                                |
| Sort Order | enum          | Ascending / Descending                          |
| Limit      | number        | Max records to return                           |
| Offset     | number        | Records to skip (pagination)                    |
| Fields     | multi-select  | Fields to return (default: all)                 |
| Do         | signal        | Trigger the query                               |

### Outputs

| Output       | Type    | Description                             |
| ------------ | ------- | --------------------------------------- |
| Records      | array   | Array of record objects                 |
| First Record | object  | First record (convenience)              |
| Count        | number  | Number of records returned              |
| Total Count  | number  | Total matching records (for pagination) |
| Loading      | boolean | True while request in progress          |
| Error        | object  | Error details if failed                 |
| Done         | signal  | Fires when query completes              |
| Failed       | signal  | Fires on error                          |

### Property Panel UI

```
┌─────────────────────────────────────────────────────────────────────┐
│ Query Records                                                       │
├─────────────────────────────────────────────────────────────────────┤
│ BACKEND                                                             │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ ○ Active Backend (Production Directus)                          │ │
│ │ ● Specific Backend: [Production Directus          ▾]            │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ COLLECTION                                                          │
│ [posts                                              ▾]              │
│                                                                     │
│ ▼ FILTER                                                            │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │  [Visual Filter Builder - see FILTER-BUILDER.md]                │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ▼ SORT                                                              │
│ [created_at ▾]  [Descending ▾]                                      │
│                                                                     │
│ ▼ PAGINATION                                                        │
│ Limit: [20   ]  Offset: [0    ]                                     │
│                                                                     │
│ ▶ FIELDS (optional)                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Create Record Node

Creates a new record in a collection.

### Inputs

| Input      | Type     | Description                             |
| ---------- | -------- | --------------------------------------- |
| Backend    | dropdown | Select configured backend               |
| Collection | dropdown | Select table/collection                 |
| Data       | object   | Record data (dynamic ports from schema) |
| Do         | signal   | Trigger creation                        |

### Dynamic Inputs

When a collection is selected, ports are dynamically generated for each writable field:

- `field_title` (string)
- `field_content` (text)
- `field_author` (relation → user ID)
- etc.

### Outputs

| Output  | Type   | Description          |
| ------- | ------ | -------------------- |
| Record  | object | The created record   |
| ID      | string | ID of created record |
| Success | signal | Fires on success     |
| Failed  | signal | Fires on error       |
| Error   | object | Error details        |

---

## 3. Update Record Node

Updates an existing record.

### Inputs

| Input      | Type     | Description                      |
| ---------- | -------- | -------------------------------- |
| Backend    | dropdown | Select configured backend        |
| Collection | dropdown | Select table/collection          |
| Record ID  | string   | ID of record to update           |
| Data       | object   | Fields to update (dynamic ports) |
| Do         | signal   | Trigger update                   |

### Dynamic Inputs

Same as Create Record - schema-driven field inputs.

### Outputs

| Output  | Type   | Description        |
| ------- | ------ | ------------------ |
| Record  | object | The updated record |
| Success | signal | Fires on success   |
| Failed  | signal | Fires on error     |
| Error   | object | Error details      |

---

## 4. Delete Record Node

Deletes a record from a collection.

### Inputs

| Input      | Type     | Description               |
| ---------- | -------- | ------------------------- |
| Backend    | dropdown | Select configured backend |
| Collection | dropdown | Select table/collection   |
| Record ID  | string   | ID of record to delete    |
| Do         | signal   | Trigger deletion          |

### Outputs

| Output  | Type   | Description      |
| ------- | ------ | ---------------- |
| Success | signal | Fires on success |
| Failed  | signal | Fires on error   |
| Error   | object | Error details    |

---

## Implementation Files

```
packages/noodl-runtime/src/nodes/std-library/data/
├── directus/
│   ├── query-records.js        # Query Records runtime
│   ├── create-record.js        # Create Record runtime
│   ├── update-record.js        # Update Record runtime
│   ├── delete-record.js        # Delete Record runtime
│   └── utils.js                # Shared utilities

packages/noodl-editor/src/editor/src/views/propertyeditor/
├── DataNodePropertyEditor/
│   ├── BackendSelector.tsx     # Backend dropdown
│   ├── CollectionSelector.tsx  # Collection dropdown
│   └── DynamicFieldInputs.tsx  # Schema-driven field inputs
```

## Node Registration

```javascript
// In node index/registration
module.exports = {
  node: QueryRecordsNode,
  setup: function (context, graphModel) {
    // Register dynamic ports based on schema
    graphModel.on('editorImportComplete', () => {
      // Set up schema-aware dropdowns
    });
  }
};
```

## HTTP Request Format (Directus)

### Query

```
GET /items/{collection}?filter={json}&sort={field}&limit={n}&offset={n}
```

### Create

```
POST /items/{collection}
Body: { field1: value1, field2: value2 }
```

### Update

```
PATCH /items/{collection}/{id}
Body: { field1: newValue }
```

### Delete

```
DELETE /items/{collection}/{id}
```
