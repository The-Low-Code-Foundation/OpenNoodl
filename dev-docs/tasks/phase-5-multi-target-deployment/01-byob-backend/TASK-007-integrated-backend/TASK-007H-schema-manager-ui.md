# TASK-007H: Schema Manager UI

## Overview

Build a native Nodegx UI for viewing and editing database schemas in local backends, providing a visual interface over the existing SchemaManager implementation.

**Parent Task:** TASK-007 (Integrated Local Backend)  
**Phase:** H (Schema Management)  
**Effort:** 16-20 hours (2-3 days)  
**Priority:** HIGH (Unblocks user productivity)  
**Dependencies:** TASK-007A (LocalSQL Adapter)

---

## Objectives

1. Create a schema browser panel showing all tables/collections
2. Build a visual schema editor for adding/modifying columns
3. Integrate with existing SchemaManager (no reimplementation)
4. Support all Nodegx field types (String, Number, Boolean, Date, Object, Array, Pointer, Relation)
5. Enable table creation from UI
6. Provide schema export (PostgreSQL, MySQL, Supabase formats)
7. Reuse existing Nodegx UI components (grid, forms, modals)

---

## Background

### Current State

Users can create local backends through the Backend Services panel, but have no way to:
- View existing tables/schema
- Add new tables
- Modify table structure (add/remove columns)
- Understand what data structures exist

The `SchemaManager` class in `TASK-007A` already provides all backend functionality:
```typescript
class SchemaManager {
  createTable(schema: TableSchema): void;
  addColumn(tableName: string, column: ColumnDefinition): void;
  getTableSchema(tableName: string): TableSchema | null;
  getSchema(): SchemaDefinition;
  exportToPostgres(): string;
  exportToSupabase(): string;
}
```

**We need to build the UI layer on top of this existing logic.**

### Design Principles

1. **No Backend Reimplementation** - Only UI, all logic delegates to SchemaManager
2. **Leverage Existing Components** - Reuse PropertyPanel, DataGrid, Modal patterns
3. **MVP First** - Ship basic functionality fast, enhance in Phase 3
4. **Consistent with Nodegx** - Match editor's visual language

---

## User Flows

### Flow 1: View Schema

```
User clicks "Manage Schema" on Backend Services panel
  ↓
Schema Manager panel opens
  ↓
Shows list of tables with:
  - Table name
  - Column count
  - Record count (async load)
  - Last modified
  ↓
User clicks table name
  ↓
Expands to show columns with types
```

### Flow 2: Create Table

```
User clicks "New Table" button
  ↓
Modal opens: "Create Table"
  - Table name input
  - Optional: Add initial columns
  ↓
User enters "Products"
  ↓
User clicks "Add Column"
  ↓
Column editor appears:
  - Name: "name"
  - Type: String (dropdown)
  - Required: checkbox
  ↓
User clicks "Create Table"
  ↓
SchemaManager.createTable() called
  ↓
Table appears in schema list
```

### Flow 3: Modify Schema

```
User clicks "Edit Schema" on table
  ↓
Schema editor opens:
  - List of existing columns (read-only editing)
  - Add column button
  - Remove column button (with warning)
  ↓
User clicks "Add Column"
  ↓
Column form appears
  ↓
User fills: name="price", type=Number, required=true
  ↓
SchemaManager.addColumn() called
  ↓
Column added to table
```

---

## Implementation Steps

### Step 1: Schema Panel Component (4 hours)

Create the main schema browser UI component.

**File:** `packages/noodl-editor/src/editor/src/views/panels/schemamanager/SchemaPanel.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { ipcRenderer } from 'electron';
import styles from './SchemaPanel.module.css';

interface TableInfo {
  name: string;
  columns: ColumnDefinition[];
  recordCount?: number;
  lastModified?: string;
}

interface ColumnDefinition {
  name: string;
  type: string;
  required: boolean;
  default?: any;
}

export function SchemaPanel({ backendId }: { backendId: string }) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSchema();
  }, [backendId]);

  async function loadSchema() {
    setLoading(true);
    try {
      // Call IPC to get schema from backend
      const schema = await ipcRenderer.invoke('backend:getSchema', backendId);
      
      // Enrich with record counts (async, non-blocking)
      const tablesWithCounts = await Promise.all(
        schema.tables.map(async (table) => {
          const count = await ipcRenderer.invoke('backend:getRecordCount', backendId, table.name);
          return { ...table, recordCount: count };
        })
      );
      
      setTables(tablesWithCounts);
    } catch (error) {
      console.error('Failed to load schema:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleCreateTable() {
    // Open create table modal
    setShowCreateModal(true);
  }

  function handleEditTable(tableName: string) {
    setSelectedTable(tableName);
  }

  if (loading) {
    return <div className={styles.loading}>Loading schema...</div>;
  }

  return (
    <div className={styles.schemaPanel}>
      <div className={styles.header}>
        <h2>Database Schema</h2>
        <button 
          className={styles.createButton}
          onClick={handleCreateTable}
        >
          + New Table
        </button>
      </div>

      <div className={styles.tableList}>
        {tables.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No tables yet</p>
            <button onClick={handleCreateTable}>Create your first table</button>
          </div>
        ) : (
          tables.map((table) => (
            <TableRow
              key={table.name}
              table={table}
              onEdit={() => handleEditTable(table.name)}
              onExpand={() => setSelectedTable(
                selectedTable === table.name ? null : table.name
              )}
              expanded={selectedTable === table.name}
            />
          ))
        )}
      </div>

      {showCreateModal && (
        <CreateTableModal
          backendId={backendId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={loadSchema}
        />
      )}

      {selectedTable && (
        <SchemaEditor
          backendId={backendId}
          tableName={selectedTable}
          onClose={() => setSelectedTable(null)}
          onUpdate={loadSchema}
        />
      )}
    </div>
  );
}
```

**File:** `packages/noodl-editor/src/editor/src/views/panels/schemamanager/TableRow.tsx`

```typescript
import React from 'react';
import styles from './TableRow.module.css';

interface TableRowProps {
  table: TableInfo;
  expanded: boolean;
  onExpand: () => void;
  onEdit: () => void;
}

export function TableRow({ table, expanded, onExpand, onEdit }: TableRowProps) {
  return (
    <div className={styles.tableRow}>
      <div className={styles.header} onClick={onExpand}>
        <div className={styles.icon}>
          {expanded ? '▼' : '▶'}
        </div>
        <div className={styles.name}>{table.name}</div>
        <div className={styles.stats}>
          <span className={styles.columnCount}>
            {table.columns.length} {table.columns.length === 1 ? 'field' : 'fields'}
          </span>
          {table.recordCount !== undefined && (
            <span className={styles.recordCount}>
              {table.recordCount.toLocaleString()} {table.recordCount === 1 ? 'record' : 'records'}
            </span>
          )}
        </div>
        <button 
          className={styles.editButton}
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          Edit
        </button>
      </div>

      {expanded && (
        <div className={styles.columns}>
          <table className={styles.columnTable}>
            <thead>
              <tr>
                <th>Field Name</th>
                <th>Type</th>
                <th>Required</th>
                <th>Default</th>
              </tr>
            </thead>
            <tbody>
              {table.columns.map((col) => (
                <tr key={col.name}>
                  <td className={styles.columnName}>{col.name}</td>
                  <td className={styles.columnType}>
                    <TypeBadge type={col.type} />
                  </td>
                  <td className={styles.columnRequired}>
                    {col.required ? '✓' : ''}
                  </td>
                  <td className={styles.columnDefault}>
                    {col.default || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const typeColors = {
    String: '#3b82f6',
    Number: '#10b981',
    Boolean: '#f59e0b',
    Date: '#8b5cf6',
    Object: '#ec4899',
    Array: '#6366f1',
    Pointer: '#ef4444',
    Relation: '#ef4444',
  };

  return (
    <span 
      className={styles.typeBadge}
      style={{ backgroundColor: typeColors[type] || '#6b7280' }}
    >
      {type}
    </span>
  );
}
```

---

### Step 2: Create Table Modal (3 hours)

**File:** `packages/noodl-editor/src/editor/src/views/panels/schemamanager/CreateTableModal.tsx`

```typescript
import React, { useState } from 'react';
import { ipcRenderer } from 'electron';
import { Modal } from '@noodl-core-ui/components/modal';
import { TextInput } from '@noodl-core-ui/components/inputs/TextInput';
import { PrimaryButton, SecondaryButton } from '@noodl-core-ui/components/buttons';
import styles from './CreateTableModal.module.css';

interface CreateTableModalProps {
  backendId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateTableModal({ backendId, onClose, onSuccess }: CreateTableModalProps) {
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState<ColumnDefinition[]>([
    { name: 'name', type: 'String', required: true }
  ]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    // Validation
    if (!tableName.trim()) {
      setError('Table name is required');
      return;
    }

    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(tableName)) {
      setError('Table name must start with a letter and contain only letters, numbers, and underscores');
      return;
    }

    if (columns.length === 0) {
      setError('At least one column is required');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      await ipcRenderer.invoke('backend:createTable', backendId, {
        name: tableName,
        columns: columns
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create table');
    } finally {
      setCreating(false);
    }
  }

  function handleAddColumn() {
    setColumns([...columns, { name: '', type: 'String', required: false }]);
  }

  function handleRemoveColumn(index: number) {
    setColumns(columns.filter((_, i) => i !== index));
  }

  function handleColumnChange(index: number, field: string, value: any) {
    const newColumns = [...columns];
    newColumns[index] = { ...newColumns[index], [field]: value };
    setColumns(newColumns);
  }

  return (
    <Modal
      title="Create New Table"
      onClose={onClose}
      width={600}
    >
      <div className={styles.content}>
        <div className={styles.field}>
          <label>Table Name</label>
          <TextInput
            value={tableName}
            onChange={setTableName}
            placeholder="users, products, orders..."
            autoFocus
          />
          <div className={styles.hint}>
            Use lowercase with underscores (e.g., "blog_posts")
          </div>
        </div>

        <div className={styles.columnsSection}>
          <div className={styles.columnsHeader}>
            <h3>Initial Columns</h3>
            <button 
              className={styles.addColumnButton}
              onClick={handleAddColumn}
            >
              + Add Column
            </button>
          </div>

          <div className={styles.columnsList}>
            {columns.map((col, index) => (
              <ColumnEditor
                key={index}
                column={col}
                onChange={(field, value) => handleColumnChange(index, field, value)}
                onRemove={() => handleRemoveColumn(index)}
                canRemove={columns.length > 1}
              />
            ))}
          </div>

          <div className={styles.hint}>
            Note: objectId, createdAt, and updatedAt are added automatically
          </div>
        </div>

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
            label={creating ? 'Creating...' : 'Create Table'}
            onClick={handleCreate}
            disabled={creating}
          />
        </div>
      </div>
    </Modal>
  );
}
```

**File:** `packages/noodl-editor/src/editor/src/views/panels/schemamanager/ColumnEditor.tsx`

```typescript
import React from 'react';
import { TextInput } from '@noodl-core-ui/components/inputs/TextInput';
import { Select } from '@noodl-core-ui/components/inputs/Select';
import { Checkbox } from '@noodl-core-ui/components/inputs/Checkbox';
import styles from './ColumnEditor.module.css';

const FIELD_TYPES = [
  { value: 'String', label: 'String' },
  { value: 'Number', label: 'Number' },
  { value: 'Boolean', label: 'Boolean' },
  { value: 'Date', label: 'Date' },
  { value: 'Object', label: 'Object' },
  { value: 'Array', label: 'Array' },
  { value: 'Pointer', label: 'Pointer' },
  { value: 'Relation', label: 'Relation' },
];

interface ColumnEditorProps {
  column: ColumnDefinition;
  onChange: (field: string, value: any) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export function ColumnEditor({ column, onChange, onRemove, canRemove }: ColumnEditorProps) {
  return (
    <div className={styles.columnEditor}>
      <div className={styles.row}>
        <div className={styles.field}>
          <TextInput
            value={column.name}
            onChange={(value) => onChange('name', value)}
            placeholder="field_name"
          />
        </div>

        <div className={styles.field}>
          <Select
            value={column.type}
            options={FIELD_TYPES}
            onChange={(value) => onChange('type', value)}
          />
        </div>

        <div className={styles.checkbox}>
          <Checkbox
            checked={column.required}
            onChange={(value) => onChange('required', value)}
            label="Required"
          />
        </div>

        {canRemove && (
          <button 
            className={styles.removeButton}
            onClick={onRemove}
            title="Remove column"
          >
            ✕
          </button>
        )}
      </div>

      {(column.type === 'Pointer' || column.type === 'Relation') && (
        <div className={styles.relationConfig}>
          <label>Target Table</label>
          <TextInput
            value={column.relationTarget || ''}
            onChange={(value) => onChange('relationTarget', value)}
            placeholder="users, products..."
          />
        </div>
      )}
    </div>
  );
}
```

---

### Step 3: Schema Editor (4 hours)

**File:** `packages/noodl-editor/src/editor/src/views/panels/schemamanager/SchemaEditor.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { ipcRenderer } from 'electron';
import { Modal } from '@noodl-core-ui/components/modal';
import { PrimaryButton, SecondaryButton } from '@noodl-core-ui/components/buttons';
import { ColumnEditor } from './ColumnEditor';
import styles from './SchemaEditor.module.css';

interface SchemaEditorProps {
  backendId: string;
  tableName: string;
  onClose: () => void;
  onUpdate: () => void;
}

export function SchemaEditor({ backendId, tableName, onClose, onUpdate }: SchemaEditorProps) {
  const [schema, setSchema] = useState<TableSchema | null>(null);
  const [newColumns, setNewColumns] = useState<ColumnDefinition[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSchema();
  }, [backendId, tableName]);

  async function loadSchema() {
    try {
      const tableSchema = await ipcRenderer.invoke('backend:getTableSchema', backendId, tableName);
      setSchema(tableSchema);
    } catch (err: any) {
      setError(err.message || 'Failed to load schema');
    }
  }

  async function handleSave() {
    if (newColumns.length === 0) {
      onClose();
      return;
    }

    // Validate new columns
    for (const col of newColumns) {
      if (!col.name.trim()) {
        setError('All columns must have a name');
        return;
      }

      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(col.name)) {
        setError(`Invalid column name: ${col.name}. Must start with a letter.`);
        return;
      }

      // Check for duplicates
      if (schema?.columns.some(c => c.name === col.name)) {
        setError(`Column "${col.name}" already exists`);
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      // Add each new column
      for (const col of newColumns) {
        await ipcRenderer.invoke('backend:addColumn', backendId, tableName, col);
      }

      onUpdate();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update schema');
    } finally {
      setSaving(false);
    }
  }

  function handleAddColumn() {
    setNewColumns([...newColumns, { name: '', type: 'String', required: false }]);
  }

  function handleRemoveNewColumn(index: number) {
    setNewColumns(newColumns.filter((_, i) => i !== index));
  }

  function handleColumnChange(index: number, field: string, value: any) {
    const updated = [...newColumns];
    updated[index] = { ...updated[index], [field]: value };
    setNewColumns(updated);
  }

  if (!schema) {
    return <div>Loading...</div>;
  }

  return (
    <Modal
      title={`Edit Schema: ${tableName}`}
      onClose={onClose}
      width={700}
    >
      <div className={styles.content}>
        <div className={styles.existingColumns}>
          <h3>Existing Columns</h3>
          <table className={styles.columnTable}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Required</th>
              </tr>
            </thead>
            <tbody>
              {schema.columns.map((col) => (
                <tr key={col.name}>
                  <td>{col.name}</td>
                  <td>{col.type}</td>
                  <td>{col.required ? '✓' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.newColumns}>
          <div className={styles.header}>
            <h3>Add Columns</h3>
            <button onClick={handleAddColumn}>+ Add Column</button>
          </div>

          {newColumns.length === 0 ? (
            <div className={styles.emptyState}>
              Click "Add Column" to add new fields to this table
            </div>
          ) : (
            <div className={styles.columnsList}>
              {newColumns.map((col, index) => (
                <ColumnEditor
                  key={index}
                  column={col}
                  onChange={(field, value) => handleColumnChange(index, field, value)}
                  onRemove={() => handleRemoveNewColumn(index)}
                  canRemove={true}
                />
              ))}
            </div>
          )}
        </div>

        <div className={styles.warning}>
          ⚠️ Note: Removing columns is not supported. You can only add new columns.
        </div>

        {error && (
          <div className={styles.error}>{error}</div>
        )}

        <div className={styles.actions}>
          <SecondaryButton 
            label="Cancel" 
            onClick={onClose}
            disabled={saving}
          />
          <PrimaryButton 
            label={saving ? 'Saving...' : 'Save Changes'}
            onClick={handleSave}
            disabled={saving || newColumns.length === 0}
          />
        </div>
      </div>
    </Modal>
  );
}
```

---

### Step 4: IPC Handlers (2 hours)

**File:** `packages/noodl-editor/src/main/src/ipc/backend-schema-handlers.ts`

```typescript
import { ipcMain } from 'electron';
import { BackendManager } from '../local-backend/BackendManager';

export function registerSchemaHandlers(backendManager: BackendManager) {
  
  /**
   * Get full schema for a backend
   */
  ipcMain.handle('backend:getSchema', async (event, backendId: string) => {
    const backend = backendManager.getBackend(backendId);
    if (!backend) {
      throw new Error(`Backend not found: ${backendId}`);
    }

    const adapter = backend.getAdapter();
    return await adapter.getSchema();
  });

  /**
   * Get schema for a specific table
   */
  ipcMain.handle('backend:getTableSchema', async (event, backendId: string, tableName: string) => {
    const backend = backendManager.getBackend(backendId);
    if (!backend) {
      throw new Error(`Backend not found: ${backendId}`);
    }

    const adapter = backend.getAdapter();
    const schema = await adapter.getSchema();
    const table = schema.tables.find(t => t.name === tableName);
    
    if (!table) {
      throw new Error(`Table not found: ${tableName}`);
    }

    return table;
  });

  /**
   * Get record count for a table
   */
  ipcMain.handle('backend:getRecordCount', async (event, backendId: string, tableName: string) => {
    const backend = backendManager.getBackend(backendId);
    if (!backend) {
      throw new Error(`Backend not found: ${backendId}`);
    }

    const adapter = backend.getAdapter();
    const result = await adapter.query({
      collection: tableName,
      count: true,
      limit: 0
    });

    return result.count || 0;
  });

  /**
   * Create a new table
   */
  ipcMain.handle('backend:createTable', async (event, backendId: string, schema: TableSchema) => {
    const backend = backendManager.getBackend(backendId);
    if (!backend) {
      throw new Error(`Backend not found: ${backendId}`);
    }

    const adapter = backend.getAdapter();
    await adapter.createTable(schema);

    return { success: true };
  });

  /**
   * Add a column to existing table
   */
  ipcMain.handle('backend:addColumn', async (event, backendId: string, tableName: string, column: ColumnDefinition) => {
    const backend = backendManager.getBackend(backendId);
    if (!backend) {
      throw new Error(`Backend not found: ${backendId}`);
    }

    const adapter = backend.getAdapter();
    await adapter.addColumn(tableName, column);

    return { success: true };
  });

  /**
   * Export schema to SQL
   */
  ipcMain.handle('backend:exportSchema', async (event, backendId: string, dialect: 'postgres' | 'mysql' | 'sqlite') => {
    const backend = backendManager.getBackend(backendId);
    if (!backend) {
      throw new Error(`Backend not found: ${backendId}`);
    }

    const adapter = backend.getAdapter();
    return await adapter.exportToSQL(dialect);
  });
}
```

---

### Step 5: Integration with Backend Services Panel (2 hours)

**File:** Modifications to `packages/noodl-editor/src/editor/src/views/panels/BackendServicesPanel/BackendCard.tsx`

```typescript
// Add to BackendCard component

function BackendCard({ backend }: { backend: LocalBackend }) {
  const [showSchemaManager, setShowSchemaManager] = useState(false);

  return (
    <div className={styles.backendCard}>
      {/* ... existing status, start/stop buttons ... */}

      <div className={styles.actions}>
        <button 
          className={styles.actionButton}
          onClick={() => setShowSchemaManager(true)}
          disabled={backend.status !== 'running'}
        >
          📋 Manage Schema
        </button>

        <button 
          className={styles.actionButton}
          onClick={() => openDataBrowser(backend.id)}
          disabled={backend.status !== 'running'}
        >
          📊 Browse Data
        </button>

        {/* ... existing export, delete buttons ... */}
      </div>

      {showSchemaManager && (
        <SchemaPanel 
          backendId={backend.id}
          onClose={() => setShowSchemaManager(false)}
        />
      )}
    </div>
  );
}
```

---

### Step 6: Schema Export Dialog (2 hours)

**File:** `packages/noodl-editor/src/editor/src/views/panels/schemamanager/ExportSchemaDialog.tsx`

```typescript
import React, { useState } from 'react';
import { ipcRenderer } from 'electron';
import { Modal } from '@noodl-core-ui/components/modal';
import { Select } from '@noodl-core-ui/components/inputs/Select';
import { PrimaryButton, SecondaryButton } from '@noodl-core-ui/components/buttons';
import styles from './ExportSchemaDialog.module.css';

const EXPORT_FORMATS = [
  { value: 'postgres', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'sqlite', label: 'SQLite' },
  { value: 'supabase', label: 'Supabase (PostgreSQL + RLS)' },
];

interface ExportSchemaDialogProps {
  backendId: string;
  onClose: () => void;
}

export function ExportSchemaDialog({ backendId, onClose }: ExportSchemaDialogProps) {
  const [format, setFormat] = useState('postgres');
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    try {
      const sql = await ipcRenderer.invoke('backend:exportSchema', backendId, format);
      setResult(sql);
    } catch (err: any) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  }

  function handleCopy() {
    if (result) {
      navigator.clipboard.writeText(result);
    }
  }

  function handleDownload() {
    if (!result) return;

    const blob = new Blob([result], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schema-${format}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal
      title="Export Schema"
      onClose={onClose}
      width={700}
    >
      <div className={styles.content}>
        {!result ? (
          <>
            <p>Export your database schema to SQL for use with other platforms.</p>

            <div className={styles.field}>
              <label>Export Format</label>
              <Select
                value={format}
                options={EXPORT_FORMATS}
                onChange={setFormat}
              />
            </div>

            <div className={styles.actions}>
              <SecondaryButton label="Cancel" onClick={onClose} />
              <PrimaryButton 
                label={exporting ? 'Exporting...' : 'Export'}
                onClick={handleExport}
                disabled={exporting}
              />
            </div>
          </>
        ) : (
          <>
            <div className={styles.result}>
              <pre>{result}</pre>
            </div>

            <div className={styles.actions}>
              <SecondaryButton label="Close" onClick={onClose} />
              <SecondaryButton label="Copy to Clipboard" onClick={handleCopy} />
              <PrimaryButton label="Download SQL File" onClick={handleDownload} />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
```

---

## Files to Create

```
packages/noodl-editor/src/editor/src/views/panels/schemamanager/
├── SchemaPanel.tsx                 # Main schema browser
├── SchemaPanel.module.css
├── TableRow.tsx                    # Individual table display
├── TableRow.module.css
├── CreateTableModal.tsx            # New table creation
├── CreateTableModal.module.css
├── SchemaEditor.tsx                # Edit existing table schema
├── SchemaEditor.module.css
├── ColumnEditor.tsx                # Column configuration UI
├── ColumnEditor.module.css
├── ExportSchemaDialog.tsx          # Export to SQL
├── ExportSchemaDialog.module.css
└── index.ts                        # Public exports

packages/noodl-editor/src/main/src/ipc/
└── backend-schema-handlers.ts      # IPC handlers for schema operations
```

## Files to Modify

```
packages/noodl-editor/src/editor/src/views/panels/BackendServicesPanel/BackendCard.tsx
  - Add "Manage Schema" button
  - Add "Browse Data" button

packages/noodl-editor/src/main/src/ipc/index.ts
  - Register backend-schema-handlers

packages/noodl-editor/src/editor/src/views/panels/index.ts
  - Export SchemaPanel for use in other panels
```

---

## Testing Checklist

### Schema Viewing
- [ ] Schema panel opens for running backend
- [ ] All tables displayed with accurate counts
- [ ] Table expand/collapse works
- [ ] Column details show correct types
- [ ] Record counts load asynchronously
- [ ] Empty state shows when no tables exist

### Table Creation
- [ ] Create table modal opens
- [ ] Table name validation works
- [ ] Can add multiple initial columns
- [ ] Column removal works
- [ ] Type dropdown shows all types
- [ ] Required checkbox toggles
- [ ] Pointer/Relation shows target selector
- [ ] Table created successfully
- [ ] Schema refreshes after creation

### Schema Editing
- [ ] Schema editor opens for existing table
- [ ] Existing columns displayed (read-only)
- [ ] Can add new columns
- [ ] Column validation works
- [ ] Duplicate column names rejected
- [ ] Columns saved successfully
- [ ] Schema refreshes after save

### Schema Export
- [ ] Export dialog opens
- [ ] Format selector shows all options
- [ ] PostgreSQL export generates valid SQL
- [ ] MySQL export generates valid SQL
- [ ] SQLite export generates valid SQL
- [ ] Supabase export includes RLS policies
- [ ] Copy to clipboard works
- [ ] Download file works

### Integration
- [ ] "Manage Schema" button disabled when backend stopped
- [ ] Schema panel only accessible for running backends
- [ ] Schema changes reflected in data browser
- [ ] Schema changes reflected in node property dropdowns

### Edge Cases
- [ ] Schema panel handles backend with no tables
- [ ] Create table handles name conflicts
- [ ] Schema editor handles invalid column types
- [ ] Export handles large schemas (100+ tables)
- [ ] UI handles backend disconnect gracefully

---

## Success Criteria

1. Users can view all tables and columns in their local backend
2. Users can create new tables with initial columns
3. Users can add columns to existing tables
4. Users can export schema to PostgreSQL, MySQL, or Supabase
5. Schema changes are immediately reflected in the UI
6. All operations properly delegate to existing SchemaManager
7. UI follows Nodegx design patterns and component standards
8. Performance: Schema loads in <500ms for 50 tables
9. Zero reimplementation of backend logic (only UI layer)

---

## Dependencies

**Requires:**
- TASK-007A (LocalSQL Adapter with SchemaManager)
- TASK-007B (Backend Server with IPC)
- TASK-007C (Backend Services Panel)

**Blocked by:** None

**Blocks:**
- TASK-007I (Data Browser) - needs schema info for table selection
- Phase 3 AI features - schema used for AI-powered suggestions

---

## Estimated Session Breakdown

| Session | Focus | Hours |
|---------|-------|-------|
| 1 | SchemaPanel + TableRow components | 4 |
| 2 | CreateTableModal + ColumnEditor | 3 |
| 3 | SchemaEditor component | 4 |
| 4 | IPC handlers + integration | 2 |
| 5 | ExportSchemaDialog + polish | 3 |
| 6 | Testing + bug fixes | 4 |
| **Total** | | **20** |

---

## Future Enhancements (Phase 3)

These features are **out of scope for MVP** but should be considered for Phase 3:

1. **Visual Relationship Diagram** - Canvas view showing table relationships
2. **Schema Migrations UI** - Track and apply schema changes over time
3. **AI Schema Suggestions** - Claude suggests optimal schema based on description
4. **Schema Versioning** - Integrate with git for schema history
5. **Column Removal** - Safe column deletion with data migration
6. **Index Management** - UI for creating/managing database indexes
7. **Virtual Fields** - Define computed columns using Nodegx expressions
8. **Schema Templates** - Pre-built schemas for common use cases (users, posts, products)
9. **Validation Rules UI** - Visual editor for field validation
10. **Schema Diff** - Compare schemas between dev/staging/prod

---

## Notes

- This task focuses **only** on schema management UI
- Data browsing/editing is covered in TASK-007I
- All backend logic already exists in SchemaManager (TASK-007A)
- Reuse existing Nodegx UI components wherever possible
- Follow Storybook patterns from noodl-core-ui
- Schema panel should feel like a natural extension of Backend Services panel
- Export feature enables migration path to production databases
