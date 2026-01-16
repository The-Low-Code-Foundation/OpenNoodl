# TASK-007I: Data Browser & Editor UI

## Overview

Build a native Nodegx UI for browsing, searching, and editing records in local backend tables, providing a visual interface similar to Parse Dashboard's data browser.

**Parent Task:** TASK-007 (Integrated Local Backend)  
**Phase:** I (Data Management)  
**Effort:** 16-20 hours (2-3 days)  
**Priority:** HIGH (Unblocks user productivity)  
**Dependencies:** TASK-007A (LocalSQL Adapter), TASK-007H (Schema Manager)

---

## Objectives

1. Create a data browser panel for viewing records in tables
2. Build inline editing capabilities for all field types
3. Implement search and filtering
4. Support pagination for large datasets
5. Enable record creation, update, and deletion
6. Handle all Nodegx field types (String, Number, Boolean, Date, Object, Array, Pointer, Relation)
7. Provide bulk operations (delete multiple, export)
8. Integrate with SchemaManager for type-aware editing

---

## Background

### Current State

With TASK-007H, users can now manage database schemas, but they cannot:
- View the actual data in tables
- Add/edit/delete records
- Search or filter data
- Import/export data

The `LocalSQLAdapter` already provides all backend CRUD operations:
```typescript
class LocalSQLAdapter {
  async query(options: QueryOptions): Promise<QueryResult>;
  async fetch(options: FetchOptions): Promise<Record>;
  async create(options: CreateOptions): Promise<Record>;
  async save(options: SaveOptions): Promise<Record>;
  async delete(options: DeleteOptions): Promise<void>;
}
```

**We need to build the UI layer on top of these existing operations.**

### Design Principles

1. **Spreadsheet-like Interface** - Users think of databases as tables
2. **Inline Editing** - Click to edit, no separate forms for simple edits
3. **Type-Aware Editors** - Each field type gets appropriate input (date picker, JSON editor, etc.)
4. **Performance** - Handle tables with 100K+ records via pagination
5. **Safety** - Confirm destructive operations

---

## User Flows

### Flow 1: Browse Data

```
User clicks "Browse Data" on Backend Services panel
  ↓
Table selector appears (list of all tables)
  ↓
User selects "products" table
  ↓
Data Browser opens showing:
  - Table name
  - Total record count
  - Paginated grid (50 records per page)
  - Search bar
  - Action buttons (New Record, Export, etc.)
  ↓
User scrolls through records
User clicks page 2
```

### Flow 2: Edit Record

```
User clicks on a cell in the grid
  ↓
Cell becomes editable
  ↓
Type-specific editor appears:
  - String: Text input
  - Number: Number input
  - Boolean: Checkbox
  - Date: Date picker
  - Object/Array: JSON editor modal
  - Pointer: Table selector + record picker
  ↓
User edits value
  ↓
User presses Enter or clicks outside
  ↓
Value saves to database
  ↓
Cell shows updated value
```

### Flow 3: Create Record

```
User clicks "New Record" button
  ↓
Modal opens with form fields for all columns
  ↓
User fills in:
  - name: "Widget Pro"
  - price: 99.99
  - inStock: true
  ↓
User clicks "Create"
  ↓
Record saved to database
  ↓
Grid refreshes with new record
```

### Flow 4: Search & Filter

```
User types "pro" in search bar
  ↓
Grid filters to show only records with "pro" in any field
  ↓
User clicks "Advanced Filters"
  ↓
Filter builder opens:
  - Field: "price"
  - Operator: "greater than"
  - Value: 50
  ↓
Grid shows only records where price > 50
```

### Flow 5: Bulk Operations

```
User clicks checkboxes on multiple records
  ↓
Bulk action bar appears: "3 records selected"
  ↓
User clicks "Delete Selected"
  ↓
Confirmation dialog: "Delete 3 records?"
  ↓
User confirms
  ↓
Records deleted, grid refreshes
```

---

## Implementation Steps

### Step 1: Data Browser Component (5 hours)

**File:** `packages/noodl-editor/src/editor/src/views/panels/databrowser/DataBrowser.tsx`

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { ipcRenderer } from 'electron';
import { DataGrid } from './DataGrid';
import { TableSelector } from './TableSelector';
import { SearchBar } from './SearchBar';
import { FilterBuilder } from './FilterBuilder';
import styles from './DataBrowser.module.css';

interface DataBrowserProps {
  backendId: string;
  initialTable?: string;
  onClose?: () => void;
}

export function DataBrowser({ backendId, initialTable, onClose }: DataBrowserProps) {
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(initialTable || null);
  const [schema, setSchema] = useState<TableSchema | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<any>(null);
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [showNewRecord, setShowNewRecord] = useState(false);

  // Load table list on mount
  useEffect(() => {
    loadTables();
  }, [backendId]);

  // Load data when table, page, search, or filters change
  useEffect(() => {
    if (selectedTable) {
      loadData();
    }
  }, [selectedTable, page, searchQuery, filters]);

  async function loadTables() {
    try {
      const schema = await ipcRenderer.invoke('backend:getSchema', backendId);
      setTables(schema.tables.map((t: any) => t.name));
      
      if (!selectedTable && schema.tables.length > 0) {
        setSelectedTable(schema.tables[0].name);
      }
    } catch (error) {
      console.error('Failed to load tables:', error);
    }
  }

  async function loadData() {
    if (!selectedTable) return;

    setLoading(true);
    try {
      // Load schema for this table
      const tableSchema = await ipcRenderer.invoke('backend:getTableSchema', backendId, selectedTable);
      setSchema(tableSchema);

      // Build query
      const query: any = {
        collection: selectedTable,
        limit: pageSize,
        skip: page * pageSize,
        sort: ['-createdAt'] // Newest first
      };

      // Apply search
      if (searchQuery) {
        // Search across all string fields
        query.where = {
          $or: tableSchema.columns
            .filter((col: any) => col.type === 'String')
            .map((col: any) => ({
              [col.name]: { contains: searchQuery }
            }))
        };
      }

      // Apply filters
      if (filters) {
        query.where = { ...query.where, ...filters };
      }

      // Load records
      const result = await ipcRenderer.invoke('backend:query', backendId, query);
      setRecords(result.results);

      // Load total count
      const countQuery = { ...query, count: true, limit: 0 };
      const countResult = await ipcRenderer.invoke('backend:query', backendId, countQuery);
      setTotalCount(countResult.count || 0);

    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveCell(recordId: string, field: string, value: any) {
    try {
      await ipcRenderer.invoke('backend:saveRecord', backendId, selectedTable, recordId, {
        [field]: value
      });
      
      // Update local state
      setRecords(records.map(r => 
        r.objectId === recordId ? { ...r, [field]: value } : r
      ));
    } catch (error) {
      console.error('Failed to save cell:', error);
      throw error;
    }
  }

  async function handleDeleteRecord(recordId: string) {
    if (!confirm('Delete this record?')) return;

    try {
      await ipcRenderer.invoke('backend:deleteRecord', backendId, selectedTable, recordId);
      loadData(); // Refresh
    } catch (error) {
      console.error('Failed to delete record:', error);
    }
  }

  async function handleBulkDelete() {
    if (selectedRecords.size === 0) return;

    if (!confirm(`Delete ${selectedRecords.size} records?`)) return;

    try {
      for (const recordId of selectedRecords) {
        await ipcRenderer.invoke('backend:deleteRecord', backendId, selectedTable, recordId);
      }
      setSelectedRecords(new Set());
      loadData(); // Refresh
    } catch (error) {
      console.error('Failed to bulk delete:', error);
    }
  }

  function handleExport() {
    // Export to CSV
    const csv = recordsToCSV(records, schema!);
    downloadCSV(csv, `${selectedTable}.csv`);
  }

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className={styles.dataBrowser}>
      <div className={styles.header}>
        <TableSelector
          tables={tables}
          selected={selectedTable}
          onChange={setSelectedTable}
        />

        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search records..."
        />

        <div className={styles.actions}>
          <button onClick={() => setShowNewRecord(true)}>
            + New Record
          </button>
          <button onClick={handleExport}>
            Export CSV
          </button>
        </div>
      </div>

      {selectedRecords.size > 0 && (
        <div className={styles.bulkActions}>
          <span>{selectedRecords.size} records selected</span>
          <button onClick={handleBulkDelete}>Delete Selected</button>
          <button onClick={() => setSelectedRecords(new Set())}>Clear Selection</button>
        </div>
      )}

      <div className={styles.content}>
        {loading ? (
          <div className={styles.loading}>Loading...</div>
        ) : schema ? (
          <DataGrid
            schema={schema}
            records={records}
            selectedRecords={selectedRecords}
            onSelectRecord={(id, selected) => {
              const newSelected = new Set(selectedRecords);
              if (selected) {
                newSelected.add(id);
              } else {
                newSelected.delete(id);
              }
              setSelectedRecords(newSelected);
            }}
            onSaveCell={handleSaveCell}
            onDeleteRecord={handleDeleteRecord}
          />
        ) : (
          <div className={styles.emptyState}>
            Select a table to browse data
          </div>
        )}
      </div>

      <div className={styles.pagination}>
        <span>
          Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, totalCount)} of {totalCount.toLocaleString()} records
        </span>
        <div className={styles.pageControls}>
          <button 
            onClick={() => setPage(0)}
            disabled={page === 0}
          >
            First
          </button>
          <button 
            onClick={() => setPage(page - 1)}
            disabled={page === 0}
          >
            Previous
          </button>
          <span>Page {page + 1} of {totalPages}</span>
          <button 
            onClick={() => setPage(page + 1)}
            disabled={page >= totalPages - 1}
          >
            Next
          </button>
          <button 
            onClick={() => setPage(totalPages - 1)}
            disabled={page >= totalPages - 1}
          >
            Last
          </button>
        </div>
      </div>

      {showNewRecord && schema && (
        <NewRecordModal
          backendId={backendId}
          table={selectedTable!}
          schema={schema}
          onClose={() => setShowNewRecord(false)}
          onSuccess={() => {
            setShowNewRecord(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}

function recordsToCSV(records: any[], schema: TableSchema): string {
  const headers = schema.columns.map(c => c.name).join(',');
  const rows = records.map(record => 
    schema.columns.map(col => {
      const value = record[col.name];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
      return value;
    }).join(',')
  );
  
  return [headers, ...rows].join('\n');
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

---

### Step 2: Data Grid Component (5 hours)

**File:** `packages/noodl-editor/src/editor/src/views/panels/databrowser/DataGrid.tsx`

```typescript
import React, { useState } from 'react';
import { CellEditor } from './CellEditor';
import styles from './DataGrid.module.css';

interface DataGridProps {
  schema: TableSchema;
  records: any[];
  selectedRecords: Set<string>;
  onSelectRecord: (id: string, selected: boolean) => void;
  onSaveCell: (recordId: string, field: string, value: any) => Promise<void>;
  onDeleteRecord: (recordId: string) => void;
}

export function DataGrid({ 
  schema, 
  records, 
  selectedRecords, 
  onSelectRecord, 
  onSaveCell,
  onDeleteRecord 
}: DataGridProps) {
  const [editingCell, setEditingCell] = useState<{ recordId: string; field: string } | null>(null);

  // Show system fields + user fields
  const displayColumns = [
    { name: 'objectId', type: 'String', readOnly: true },
    { name: 'createdAt', type: 'Date', readOnly: true },
    { name: 'updatedAt', type: 'Date', readOnly: true },
    ...schema.columns
  ];

  async function handleCellSave(recordId: string, field: string, value: any) {
    try {
      await onSaveCell(recordId, field, value);
      setEditingCell(null);
    } catch (error) {
      console.error('Failed to save cell:', error);
      alert('Failed to save changes');
    }
  }

  function handleCellClick(recordId: string, field: string, readOnly: boolean) {
    if (readOnly) return;
    setEditingCell({ recordId, field });
  }

  function formatCellValue(value: any, type: string): string {
    if (value === null || value === undefined) return '';
    
    switch (type) {
      case 'Boolean':
        return value ? '✓' : '';
      case 'Date':
        return new Date(value).toLocaleString();
      case 'Object':
      case 'Array':
        return JSON.stringify(value);
      default:
        return String(value);
    }
  }

  return (
    <div className={styles.gridContainer}>
      <table className={styles.dataGrid}>
        <thead>
          <tr>
            <th className={styles.checkboxCol}>
              <input
                type="checkbox"
                checked={selectedRecords.size === records.length && records.length > 0}
                onChange={(e) => {
                  records.forEach(r => onSelectRecord(r.objectId, e.target.checked));
                }}
              />
            </th>
            {displayColumns.map(col => (
              <th key={col.name}>
                <div className={styles.columnHeader}>
                  <span>{col.name}</span>
                  <span className={styles.columnType}>{col.type}</span>
                </div>
              </th>
            ))}
            <th className={styles.actionsCol}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map(record => (
            <tr key={record.objectId}>
              <td className={styles.checkboxCol}>
                <input
                  type="checkbox"
                  checked={selectedRecords.has(record.objectId)}
                  onChange={(e) => onSelectRecord(record.objectId, e.target.checked)}
                />
              </td>
              {displayColumns.map(col => {
                const isEditing = editingCell?.recordId === record.objectId && 
                                 editingCell?.field === col.name;
                const value = record[col.name];
                const readOnly = col.readOnly || col.name === 'objectId';

                return (
                  <td 
                    key={col.name}
                    className={readOnly ? styles.readOnlyCell : styles.editableCell}
                    onClick={() => handleCellClick(record.objectId, col.name, readOnly)}
                  >
                    {isEditing ? (
                      <CellEditor
                        value={value}
                        type={col.type}
                        onSave={(newValue) => handleCellSave(record.objectId, col.name, newValue)}
                        onCancel={() => setEditingCell(null)}
                      />
                    ) : (
                      <div className={styles.cellValue}>
                        {formatCellValue(value, col.type)}
                      </div>
                    )}
                  </td>
                );
              })}
              <td className={styles.actionsCol}>
                <button
                  className={styles.deleteButton}
                  onClick={() => onDeleteRecord(record.objectId)}
                  title="Delete record"
                >
                  🗑️
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {records.length === 0 && (
        <div className={styles.emptyTable}>
          No records found
        </div>
      )}
    </div>
  );
}
```

---

### Step 3: Cell Editor Component (4 hours)

**File:** `packages/noodl-editor/src/editor/src/views/panels/databrowser/CellEditor.tsx`

```typescript
import React, { useState, useEffect, useRef } from 'react';
import { TextInput } from '@noodl-core-ui/components/inputs/TextInput';
import { Checkbox } from '@noodl-core-ui/components/inputs/Checkbox';
import { DatePicker } from '@noodl-core-ui/components/inputs/DatePicker';
import styles from './CellEditor.module.css';

interface CellEditorProps {
  value: any;
  type: string;
  onSave: (value: any) => void;
  onCancel: () => void;
}

export function CellEditor({ value, type, onSave, onCancel }: CellEditorProps) {
  const [editValue, setEditValue] = useState(value);
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  }

  function handleSave() {
    let finalValue = editValue;

    // Type conversion
    switch (type) {
      case 'Number':
        finalValue = parseFloat(editValue);
        if (isNaN(finalValue)) {
          alert('Invalid number');
          return;
        }
        break;
      case 'Boolean':
        finalValue = Boolean(editValue);
        break;
      case 'Date':
        if (typeof editValue === 'string') {
          finalValue = new Date(editValue).toISOString();
        }
        break;
      case 'Object':
      case 'Array':
        try {
          finalValue = JSON.parse(editValue);
        } catch (err) {
          alert('Invalid JSON');
          return;
        }
        break;
    }

    onSave(finalValue);
  }

  // Type-specific editors
  switch (type) {
    case 'Boolean':
      return (
        <div className={styles.cellEditor}>
          <Checkbox
            checked={editValue}
            onChange={(checked) => {
              setEditValue(checked);
              onSave(checked);
            }}
          />
        </div>
      );

    case 'Date':
      return (
        <div className={styles.cellEditor}>
          <input
            ref={inputRef}
            type="datetime-local"
            value={editValue ? new Date(editValue).toISOString().slice(0, 16) : ''}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
          />
        </div>
      );

    case 'Object':
    case 'Array':
      return (
        <div className={styles.cellEditor}>
          {showJsonEditor ? (
            <JsonEditorModal
              value={value}
              onSave={onSave}
              onCancel={() => {
                setShowJsonEditor(false);
                onCancel();
              }}
            />
          ) : (
            <button onClick={() => setShowJsonEditor(true)}>
              Edit JSON
            </button>
          )}
        </div>
      );

    case 'Number':
      return (
        <div className={styles.cellEditor}>
          <input
            ref={inputRef}
            type="number"
            value={editValue ?? ''}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
          />
        </div>
      );

    case 'String':
    default:
      return (
        <div className={styles.cellEditor}>
          <input
            ref={inputRef}
            type="text"
            value={editValue ?? ''}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
          />
        </div>
      );
  }
}
```

**File:** `packages/noodl-editor/src/editor/src/views/panels/databrowser/JsonEditorModal.tsx`

```typescript
import React, { useState } from 'react';
import { Modal } from '@noodl-core-ui/components/modal';
import { PrimaryButton, SecondaryButton } from '@noodl-core-ui/components/buttons';
import styles from './JsonEditorModal.module.css';

interface JsonEditorModalProps {
  value: any;
  onSave: (value: any) => void;
  onCancel: () => void;
}

export function JsonEditorModal({ value, onSave, onCancel }: JsonEditorModalProps) {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    try {
      const parsed = JSON.parse(text);
      onSave(parsed);
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <Modal
      title="Edit JSON"
      onClose={onCancel}
      width={600}
    >
      <div className={styles.content}>
        <textarea
          className={styles.editor}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          spellCheck={false}
          rows={20}
        />

        {error && (
          <div className={styles.error}>Invalid JSON: {error}</div>
        )}

        <div className={styles.actions}>
          <SecondaryButton label="Cancel" onClick={onCancel} />
          <PrimaryButton label="Save" onClick={handleSave} />
        </div>
      </div>
    </Modal>
  );
}
```

---

### Step 4: New Record Modal (3 hours)

**File:** `packages/noodl-editor/src/editor/src/views/panels/databrowser/NewRecordModal.tsx`

```typescript
import React, { useState } from 'react';
import { ipcRenderer } from 'electron';
import { Modal } from '@noodl-core-ui/components/modal';
import { TextInput } from '@noodl-core-ui/components/inputs/TextInput';
import { Checkbox } from '@noodl-core-ui/components/inputs/Checkbox';
import { PrimaryButton, SecondaryButton } from '@noodl-core-ui/components/buttons';
import styles from './NewRecordModal.module.css';

interface NewRecordModalProps {
  backendId: string;
  table: string;
  schema: TableSchema;
  onClose: () => void;
  onSuccess: () => void;
}

export function NewRecordModal({ backendId, table, schema, onClose, onSuccess }: NewRecordModalProps) {
  const [data, setData] = useState<Record<string, any>>({});
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    // Validation
    for (const col of schema.columns) {
      if (col.required && !data[col.name]) {
        setError(`${col.name} is required`);
        return;
      }
    }

    setCreating(true);
    setError(null);

    try {
      await ipcRenderer.invoke('backend:createRecord', backendId, table, data);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create record');
    } finally {
      setCreating(false);
    }
  }

  function handleFieldChange(fieldName: string, value: any) {
    setData({ ...data, [fieldName]: value });
  }

  return (
    <Modal
      title={`New ${table} Record`}
      onClose={onClose}
      width={600}
    >
      <div className={styles.content}>
        <form className={styles.form}>
          {schema.columns.map(col => (
            <div key={col.name} className={styles.field}>
              <label>
                {col.name}
                {col.required && <span className={styles.required}>*</span>}
                <span className={styles.type}>{col.type}</span>
              </label>
              
              <FieldInput
                type={col.type}
                value={data[col.name]}
                onChange={(value) => handleFieldChange(col.name, value)}
              />
            </div>
          ))}
        </form>

        {error && (
          <div className={styles.error}>{error}</div>
        )}

        <div className={styles.actions}>
          <SecondaryButton 
            label="Cancel" 
            onClick={onClose}
            disabled={creating}
          />
          <PrimaryButton 
            label={creating ? 'Creating...' : 'Create Record'}
            onClick={handleCreate}
            disabled={creating}
          />
        </div>
      </div>
    </Modal>
  );
}

function FieldInput({ type, value, onChange }: { 
  type: string; 
  value: any; 
  onChange: (value: any) => void;
}) {
  switch (type) {
    case 'Boolean':
      return (
        <Checkbox
          checked={value || false}
          onChange={onChange}
        />
      );

    case 'Number':
      return (
        <input
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
      );

    case 'Date':
      return (
        <input
          type="datetime-local"
          value={value ? new Date(value).toISOString().slice(0, 16) : ''}
          onChange={(e) => onChange(new Date(e.target.value).toISOString())}
        />
      );

    case 'Object':
    case 'Array':
      return (
        <textarea
          value={value ? JSON.stringify(value, null, 2) : ''}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              // Invalid JSON, ignore
            }
          }}
          rows={5}
        />
      );

    default:
      return (
        <TextInput
          value={value || ''}
          onChange={onChange}
        />
      );
  }
}
```

---

### Step 5: IPC Handlers (2 hours)

**File:** `packages/noodl-editor/src/main/src/ipc/backend-data-handlers.ts`

```typescript
import { ipcMain } from 'electron';
import { BackendManager } from '../local-backend/BackendManager';

export function registerDataHandlers(backendManager: BackendManager) {
  
  /**
   * Query records with pagination, search, filters
   */
  ipcMain.handle('backend:query', async (event, backendId: string, options: QueryOptions) => {
    const backend = backendManager.getBackend(backendId);
    if (!backend) {
      throw new Error(`Backend not found: ${backendId}`);
    }

    const adapter = backend.getAdapter();
    return await adapter.query(options);
  });

  /**
   * Create a new record
   */
  ipcMain.handle('backend:createRecord', async (event, backendId: string, collection: string, data: any) => {
    const backend = backendManager.getBackend(backendId);
    if (!backend) {
      throw new Error(`Backend not found: ${backendId}`);
    }

    const adapter = backend.getAdapter();
    return await adapter.create({ collection, data });
  });

  /**
   * Update an existing record
   */
  ipcMain.handle('backend:saveRecord', async (event, backendId: string, collection: string, objectId: string, data: any) => {
    const backend = backendManager.getBackend(backendId);
    if (!backend) {
      throw new Error(`Backend not found: ${backendId}`);
    }

    const adapter = backend.getAdapter();
    return await adapter.save({ collection, objectId, data });
  });

  /**
   * Delete a record
   */
  ipcMain.handle('backend:deleteRecord', async (event, backendId: string, collection: string, objectId: string) => {
    const backend = backendManager.getBackend(backendId);
    if (!backend) {
      throw new Error(`Backend not found: ${backendId}`);
    }

    const adapter = backend.getAdapter();
    await adapter.delete({ collection, objectId });

    return { success: true };
  });

  /**
   * Get single record by ID
   */
  ipcMain.handle('backend:getRecord', async (event, backendId: string, collection: string, objectId: string) => {
    const backend = backendManager.getBackend(backendId);
    if (!backend) {
      throw new Error(`Backend not found: ${backendId}`);
    }

    const adapter = backend.getAdapter();
    return await adapter.fetch({ collection, objectId });
  });
}
```

---

### Step 6: Integration & Polish (2 hours)

**File:** Modifications to `packages/noodl-editor/src/editor/src/views/panels/BackendServicesPanel/BackendCard.tsx`

```typescript
// Add to BackendCard component

import { DataBrowser } from '../databrowser/DataBrowser';

function BackendCard({ backend }: { backend: LocalBackend }) {
  const [showDataBrowser, setShowDataBrowser] = useState(false);

  return (
    <div className={styles.backendCard}>
      {/* ... existing UI ... */}

      <div className={styles.actions}>
        <button 
          onClick={() => setShowDataBrowser(true)}
          disabled={backend.status !== 'running'}
        >
          📊 Browse Data
        </button>
      </div>

      {showDataBrowser && (
        <Modal
          title="Data Browser"
          onClose={() => setShowDataBrowser(false)}
          fullScreen
        >
          <DataBrowser 
            backendId={backend.id}
            onClose={() => setShowDataBrowser(false)}
          />
        </Modal>
      )}
    </div>
  );
}
```

---

## Files to Create

```
packages/noodl-editor/src/editor/src/views/panels/databrowser/
├── DataBrowser.tsx                # Main data browser component
├── DataBrowser.module.css
├── DataGrid.tsx                   # Spreadsheet-style grid
├── DataGrid.module.css
├── CellEditor.tsx                 # Inline cell editing
├── CellEditor.module.css
├── JsonEditorModal.tsx            # JSON editor for complex types
├── JsonEditorModal.module.css
├── NewRecordModal.tsx             # Create new record form
├── NewRecordModal.module.css
├── TableSelector.tsx              # Dropdown to select table
├── TableSelector.module.css
├── SearchBar.tsx                  # Search input
├── SearchBar.module.css
├── FilterBuilder.tsx              # Advanced filtering (Phase 3)
└── index.ts                       # Public exports

packages/noodl-editor/src/main/src/ipc/
└── backend-data-handlers.ts       # IPC handlers for CRUD operations
```

## Files to Modify

```
packages/noodl-editor/src/editor/src/views/panels/BackendServicesPanel/BackendCard.tsx
  - Add "Browse Data" button

packages/noodl-editor/src/main/src/ipc/index.ts
  - Register backend-data-handlers
```

---

## Testing Checklist

### Data Viewing
- [ ] Data browser opens for running backend
- [ ] Table selector shows all tables
- [ ] Records load with pagination
- [ ] Empty tables show appropriate message
- [ ] Large datasets (100K+ records) paginate correctly
- [ ] Record counts display accurately

### Cell Editing
- [ ] Click cell to enter edit mode
- [ ] String fields editable as text
- [ ] Number fields editable as numbers
- [ ] Boolean fields toggle with checkbox
- [ ] Date fields show date picker
- [ ] Object/Array fields open JSON editor
- [ ] Enter key saves, Escape cancels
- [ ] Blur saves changes
- [ ] Invalid values rejected with error

### Record Creation
- [ ] "New Record" modal opens
- [ ] All fields shown with correct types
- [ ] Required fields validated
- [ ] Record created successfully
- [ ] Grid refreshes after creation
- [ ] Modal closes on success

### Record Deletion
- [ ] Single record delete works
- [ ] Confirmation dialog shown
- [ ] Grid refreshes after deletion
- [ ] Bulk delete works for multiple records
- [ ] Select all checkbox works

### Search & Filtering
- [ ] Search filters records across all string fields
- [ ] Search is case-insensitive
- [ ] Clear search shows all records
- [ ] Search works with pagination

### Export
- [ ] CSV export includes all columns
- [ ] CSV export handles special characters
- [ ] CSV export handles commas in data
- [ ] Downloaded file opens correctly

### Performance
- [ ] 50 records load in <500ms
- [ ] 1000 records paginate smoothly
- [ ] 100K records browseable via pagination
- [ ] Cell editing is responsive (<100ms)

### Edge Cases
- [ ] Empty tables handled gracefully
- [ ] Tables with 1 record work
- [ ] Tables with 100+ columns scrollable
- [ ] Null values display correctly
- [ ] Very long strings truncated in grid
- [ ] Complex JSON objects editable
- [ ] Dates in various formats handled

---

## Success Criteria

1. Users can browse all records in any table
2. Users can edit records inline with type-appropriate editors
3. Users can create new records via form
4. Users can delete single or multiple records
5. Users can search across records
6. Users can export data to CSV
7. Grid handles 100K+ records via pagination
8. All operations properly delegate to existing LocalSQLAdapter
9. UI is responsive and performant
10. Data changes immediately reflect in UI

---

## Dependencies

**Requires:**
- TASK-007A (LocalSQL Adapter with CRUD operations)
- TASK-007H (Schema Manager for type information)

**Blocked by:** None

**Blocks:**
- Phase 3 AI features - AI can suggest data based on existing records
- Import/export features - CSV/JSON import

---

## Estimated Session Breakdown

| Session | Focus | Hours |
|---------|-------|-------|
| 1 | DataBrowser + TableSelector + SearchBar | 5 |
| 2 | DataGrid component with inline editing | 5 |
| 3 | CellEditor + JsonEditorModal | 4 |
| 4 | NewRecordModal | 3 |
| 5 | IPC handlers + integration | 2 |
| 6 | Testing + bug fixes + polish | 4 |
| **Total** | | **23** |

*Note: Estimated 23 hours, but can be trimmed to 20 by deferring advanced filtering (FilterBuilder) to Phase 3*

---

## Future Enhancements (Phase 3)

These features are **out of scope for MVP** but should be considered for Phase 3:

1. **Advanced Filtering** - Visual query builder with AND/OR logic
2. **CSV/JSON Import** - Bulk import records from files
3. **Inline Relationships** - Click pointer to navigate to related record
4. **Duplicate Record** - Copy existing record as template
5. **Bulk Edit** - Edit multiple records at once
6. **Column Reordering** - Drag to reorder columns
7. **Column Hiding** - Hide columns from view
8. **Sort by Column** - Click header to sort
9. **Keyboard Navigation** - Arrow keys, Tab, Enter for spreadsheet-like UX
10. **Undo/Redo** - Revert data changes
11. **View History** - See audit trail of changes
12. **Rich Text Editor** - For HTML/Markdown fields
13. **File Upload** - For file/image fields (requires file storage)

---

## Notes

- This task focuses on **data browsing and editing UI**
- Schema management is covered in TASK-007H
- All backend CRUD logic already exists in LocalSQLAdapter (TASK-007A)
- Grid performance is critical - use virtualization if >50 columns
- Inline editing provides better UX than modal forms
- Type-aware editing prevents data corruption
- Export enables migration and analysis workflows
- Future: Consider react-data-grid or ag-grid for advanced features in Phase 3
