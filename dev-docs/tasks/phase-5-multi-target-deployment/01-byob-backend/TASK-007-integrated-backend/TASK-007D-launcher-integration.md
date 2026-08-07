# TASK-007D: Launcher Integration

## Overview

Add backend management UI to the Nodegex launcher, enabling users to create, manage, and monitor local backends independently of projects.

**Parent Task:** TASK-007 (Integrated Local Backend)
**Phase:** D (Launcher Integration)
**Effort:** 8-10 hours
**Priority:** MEDIUM
**Depends On:** TASK-007B (Backend Server)

---

## Objectives

1. Add backend management section to launcher
2. Create backend list with status indicators
3. Implement create/delete backend dialogs
4. Add start/stop controls for backends
5. Implement project-backend association UI
6. Create simple data administration panel

---

## Design

### Launcher Layout Update

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  NODEGEX                                                    [_] [□] [×]     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │         PROJECTS                │  │         BACKENDS                │  │
│  ├─────────────────────────────────┤  ├─────────────────────────────────┤  │
│  │                                 │  │                                 │  │
│  │  ┌───────────────────────────┐  │  │  ┌───────────────────────────┐  │  │
│  │  │ 📁 My Todo App            │  │  │  │ ⚡ My Todo Backend        │  │  │
│  │  │    Backend: My Todo...    │  │  │  │    ● Running on :8577     │  │  │
│  │  │    Last opened: 2h ago    │  │  │  │    [Stop] [Admin]         │  │  │
│  │  └───────────────────────────┘  │  │  └───────────────────────────┘  │  │
│  │                                 │  │                                 │  │
│  │  ┌───────────────────────────┐  │  │  ┌───────────────────────────┐  │  │
│  │  │ 📁 E-commerce Proto       │  │  │  │ ⚡ E-commerce Data        │  │  │
│  │  │    Backend: E-commerce... │  │  │  │    ○ Stopped              │  │  │
│  │  │    Last opened: 1d ago    │  │  │  │    [Start] [Delete]       │  │  │
│  │  └───────────────────────────┘  │  │  └───────────────────────────┘  │  │
│  │                                 │  │                                 │  │
│  │  [+ New Project]                │  │  [+ New Backend]                │  │
│  │                                 │  │                                 │  │
│  └─────────────────────────────────┘  └─────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Backend Card States

```
Running:                          Stopped:                         Error:
┌─────────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
│ ⚡ My Backend           │      │ ⚡ My Backend           │      │ ⚡ My Backend           │
│ ● Running on :8577      │      │ ○ Stopped               │      │ ⚠ Error: Port in use   │
│ 2 projects connected    │      │ 2 projects connected    │      │ 2 projects connected    │
│ ─────────────────────── │      │ ─────────────────────── │      │ ─────────────────────── │
│ [Stop] [Admin] [Export] │      │ [Start] [Delete]        │      │ [Retry] [Config]        │
└─────────────────────────┘      └─────────────────────────┘      └─────────────────────────┘
```

---

## Implementation Steps

### Step 1: Backend List Component (2 hours)

**File:** `packages/noodl-editor/src/editor/src/views/Launcher/BackendManager/BackendList.tsx`

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { BackendCard } from './BackendCard';
import { CreateBackendDialog } from './CreateBackendDialog';
import { IconPlus } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton } from '@noodl-core-ui/components/inputs/PrimaryButton';
import styles from './BackendList.module.scss';

interface Backend {
  id: string;
  name: string;
  createdAt: string;
  port: number;
  projectIds: string[];
  status: 'running' | 'stopped' | 'error';
  error?: string;
}

export function BackendList() {
  const [backends, setBackends] = useState<Backend[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const loadBackends = useCallback(async () => {
    setLoading(true);
    try {
      const list = await window.electronAPI.backend.list();

      // Get status for each backend
      const withStatus = await Promise.all(
        list.map(async (backend) => {
          const status = await window.electronAPI.backend.status(backend.id);
          return {
            ...backend,
            status: status.running ? 'running' as const : 'stopped' as const,
            port: status.port || backend.port
          };
        })
      );

      setBackends(withStatus);
    } catch (error) {
      console.error('Failed to load backends:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBackends();

    // Refresh every 5 seconds while launcher is open
    const interval = setInterval(loadBackends, 5000);
    return () => clearInterval(interval);
  }, [loadBackends]);

  const handleStart = async (id: string) => {
    try {
      await window.electronAPI.backend.start(id);
      await loadBackends();
    } catch (error: any) {
      console.error('Failed to start backend:', error);
      // Update status to show error
      setBackends(prev => prev.map(b => 
        b.id === id ? { ...b, status: 'error' as const, error: error.message } : b
      ));
    }
  };

  const handleStop = async (id: string) => {
    try {
      await window.electronAPI.backend.stop(id);
      await loadBackends();
    } catch (error) {
      console.error('Failed to stop backend:', error);
    }
  };

  const handleDelete = async (id: string) => {
    const backend = backends.find(b => b.id === id);
    if (!backend) return;

    const confirmed = await showConfirmDialog({
      title: 'Delete Backend',
      message: `Are you sure you want to delete "${backend.name}"? All data will be permanently lost.`,
      confirmLabel: 'Delete',
      confirmVariant: 'danger'
    });

    if (confirmed) {
      try {
        await window.electronAPI.backend.delete(id);
        await loadBackends();
      } catch (error) {
        console.error('Failed to delete backend:', error);
      }
    }
  };

  const handleCreate = async (name: string) => {
    try {
      await window.electronAPI.backend.create(name);
      setShowCreateDialog(false);
      await loadBackends();
    } catch (error) {
      console.error('Failed to create backend:', error);
      throw error; // Let dialog handle the error
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Local Backends</h2>
        <PrimaryButton
          label="New Backend"
          icon={IconPlus}
          onClick={() => setShowCreateDialog(true)}
        />
      </div>

      {loading && backends.length === 0 ? (
        <div className={styles.loading}>
          <span className={styles.spinner} />
          Loading backends...
        </div>
      ) : backends.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>⚡</div>
          <h3>No Local Backends</h3>
          <p>Create a backend to start building full-stack apps with zero configuration.</p>
          <PrimaryButton
            label="Create Your First Backend"
            onClick={() => setShowCreateDialog(true)}
          />
        </div>
      ) : (
        <div className={styles.list}>
          {backends.map(backend => (
            <BackendCard
              key={backend.id}
              backend={backend}
              onStart={() => handleStart(backend.id)}
              onStop={() => handleStop(backend.id)}
              onDelete={() => handleDelete(backend.id)}
              onRefresh={loadBackends}
            />
          ))}
        </div>
      )}

      {showCreateDialog && (
        <CreateBackendDialog
          onClose={() => setShowCreateDialog(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}

// Helper for confirm dialog - would use existing dialog system
async function showConfirmDialog(options: {
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant: 'danger' | 'primary';
}): Promise<boolean> {
  // Implementation would use existing dialog infrastructure
  return window.confirm(options.message);
}
```

**File:** `packages/noodl-editor/src/editor/src/views/Launcher/BackendManager/BackendList.module.scss`

```scss
.container {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.title {
  font-size: 18px;
  font-weight: 600;
  color: var(--theme-color-text-default);
  margin: 0;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px;
  color: var(--theme-color-text-secondary);
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--theme-color-border);
  border-top-color: var(--theme-color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  text-align: center;
  color: var(--theme-color-text-secondary);

  h3 {
    margin: 16px 0 8px;
    color: var(--theme-color-text-default);
  }

  p {
    margin: 0 0 24px;
    max-width: 300px;
  }
}

.emptyIcon {
  font-size: 48px;
  opacity: 0.5;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  flex: 1;
}
```

---

### Step 2: Backend Card Component (2 hours)

**File:** `packages/noodl-editor/src/editor/src/views/Launcher/BackendManager/BackendCard.tsx`

```tsx
import React, { useState } from 'react';
import { 
  IconPlay, 
  IconStop, 
  IconTrash, 
  IconDatabase,
  IconExport,
  IconSettings
} from '@noodl-core-ui/components/common/Icon';
import { IconButton } from '@noodl-core-ui/components/inputs/IconButton';
import { ExportDialog } from './ExportDialog';
import { AdminPanel } from './AdminPanel';
import styles from './BackendCard.module.scss';

interface Backend {
  id: string;
  name: string;
  createdAt: string;
  port: number;
  projectIds: string[];
  status: 'running' | 'stopped' | 'error';
  error?: string;
}

interface Props {
  backend: Backend;
  onStart: () => void;
  onStop: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}

export function BackendCard({ backend, onStart, onStop, onDelete, onRefresh }: Props) {
  const [showExport, setShowExport] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  const statusColor = {
    running: 'var(--theme-color-success)',
    stopped: 'var(--theme-color-text-secondary)',
    error: 'var(--theme-color-danger)'
  }[backend.status];

  const statusIcon = {
    running: '●',
    stopped: '○',
    error: '⚠'
  }[backend.status];

  const statusText = {
    running: `Running on :${backend.port}`,
    stopped: 'Stopped',
    error: backend.error || 'Error'
  }[backend.status];

  const projectCount = backend.projectIds?.length || 0;

  return (
    <>
      <div className={styles.card}>
        <div className={styles.icon}>
          <IconDatabase size={24} />
        </div>

        <div className={styles.info}>
          <div className={styles.name}>{backend.name}</div>
          <div className={styles.status} style={{ color: statusColor }}>
            <span className={styles.statusIcon}>{statusIcon}</span>
            {statusText}
          </div>
          <div className={styles.meta}>
            {projectCount} project{projectCount !== 1 ? 's' : ''} connected
            {' • '}
            Created {formatRelativeTime(backend.createdAt)}
          </div>
        </div>

        <div className={styles.actions}>
          {backend.status === 'running' ? (
            <>
              <IconButton
                icon={IconStop}
                title="Stop Backend"
                onClick={onStop}
              />
              <IconButton
                icon={IconDatabase}
                title="Open Admin Panel"
                onClick={() => setShowAdmin(true)}
              />
              <IconButton
                icon={IconExport}
                title="Export Schema"
                onClick={() => setShowExport(true)}
              />
            </>
          ) : backend.status === 'stopped' ? (
            <>
              <IconButton
                icon={IconPlay}
                title="Start Backend"
                onClick={onStart}
              />
              <IconButton
                icon={IconTrash}
                title="Delete Backend"
                variant="danger"
                onClick={onDelete}
              />
            </>
          ) : (
            <>
              <IconButton
                icon={IconPlay}
                title="Retry Start"
                onClick={onStart}
              />
              <IconButton
                icon={IconSettings}
                title="Configure"
                onClick={() => {/* TODO: Config dialog */}}
              />
            </>
          )}
        </div>
      </div>

      {showExport && (
        <ExportDialog
          backendId={backend.id}
          backendName={backend.name}
          onClose={() => setShowExport(false)}
        />
      )}

      {showAdmin && (
        <AdminPanel
          backendId={backend.id}
          backendName={backend.name}
          port={backend.port}
          onClose={() => setShowAdmin(false)}
        />
      )}
    </>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
}
```

**File:** `packages/noodl-editor/src/editor/src/views/Launcher/BackendManager/BackendCard.module.scss`

```scss
.card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--theme-color-bg-2);
  border: 1px solid var(--theme-color-border);
  border-radius: 8px;
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--theme-color-border-hover);
  }
}

.icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: var(--theme-color-bg-3);
  border-radius: 8px;
  color: var(--theme-color-primary);
}

.info {
  flex: 1;
  min-width: 0;
}

.name {
  font-size: 16px;
  font-weight: 600;
  color: var(--theme-color-text-default);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  margin-bottom: 2px;
}

.statusIcon {
  font-size: 10px;
}

.meta {
  font-size: 12px;
  color: var(--theme-color-text-secondary);
}

.actions {
  display: flex;
  gap: 8px;
}
```

---

### Step 3: Create Backend Dialog (1 hour)

**File:** `packages/noodl-editor/src/editor/src/views/Launcher/BackendManager/CreateBackendDialog.tsx`

```tsx
import React, { useState } from 'react';
import { Dialog } from '@noodl-core-ui/components/layout/Dialog';
import { TextInput } from '@noodl-core-ui/components/inputs/TextInput';
import { PrimaryButton } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { SecondaryButton } from '@noodl-core-ui/components/inputs/SecondaryButton';
import styles from './CreateBackendDialog.module.scss';

interface Props {
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

export function CreateBackendDialog({ onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Please enter a name');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      await onCreate(name.trim());
    } catch (e: any) {
      setError(e.message || 'Failed to create backend');
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !creating) {
      handleCreate();
    }
  };

  return (
    <Dialog
      title="Create New Backend"
      onClose={onClose}
      width={400}
    >
      <div className={styles.content}>
        <p className={styles.description}>
          Create a new local backend with SQLite database. 
          You can connect this backend to any of your projects.
        </p>

        <div className={styles.field}>
          <label className={styles.label}>Backend Name</label>
          <TextInput
            value={name}
            onChange={setName}
            onKeyDown={handleKeyDown}
            placeholder="e.g., My App Backend"
            autoFocus
            disabled={creating}
          />
          {error && <div className={styles.error}>{error}</div>}
        </div>

        <div className={styles.actions}>
          <SecondaryButton
            label="Cancel"
            onClick={onClose}
            disabled={creating}
          />
          <PrimaryButton
            label={creating ? 'Creating...' : 'Create Backend'}
            onClick={handleCreate}
            disabled={creating || !name.trim()}
          />
        </div>
      </div>
    </Dialog>
  );
}
```

---

### Step 4: Backend Selector for Projects (2 hours)

**File:** `packages/noodl-editor/src/editor/src/views/Launcher/ProjectCard/BackendSelector.tsx`

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { IconDatabase, IconChevronDown, IconPlus } from '@noodl-core-ui/components/common/Icon';
import styles from './BackendSelector.module.scss';

interface Backend {
  id: string;
  name: string;
  status: 'running' | 'stopped';
}

interface Props {
  currentBackendId?: string;
  onSelect: (backendId: string | null) => void;
  onCreateNew: () => void;
}

export function BackendSelector({ currentBackendId, onSelect, onCreateNew }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [backends, setBackends] = useState<Backend[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadBackends();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadBackends = async () => {
    try {
      const list = await window.electronAPI.backend.list();
      const withStatus = await Promise.all(
        list.map(async (b) => {
          const status = await window.electronAPI.backend.status(b.id);
          return {
            id: b.id,
            name: b.name,
            status: status.running ? 'running' as const : 'stopped' as const
          };
        })
      );
      setBackends(withStatus);
    } catch (e) {
      console.error('Failed to load backends:', e);
    }
  };

  const currentBackend = backends.find(b => b.id === currentBackendId);

  const handleSelect = (backendId: string | null) => {
    onSelect(backendId);
    setIsOpen(false);
  };

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
      >
        <IconDatabase size={16} />
        <span className={styles.label}>
          {currentBackend ? currentBackend.name : 'No Backend'}
        </span>
        {currentBackend && (
          <span 
            className={styles.status}
            data-status={currentBackend.status}
          >
            {currentBackend.status === 'running' ? '●' : '○'}
          </span>
        )}
        <IconChevronDown size={14} />
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <button
            className={styles.option}
            onClick={() => handleSelect(null)}
          >
            <span className={styles.optionLabel}>No Backend</span>
            {!currentBackendId && <span className={styles.check}>✓</span>}
          </button>

          {backends.length > 0 && <div className={styles.divider} />}

          {backends.map(backend => (
            <button
              key={backend.id}
              className={styles.option}
              onClick={() => handleSelect(backend.id)}
            >
              <span 
                className={styles.statusDot}
                data-status={backend.status}
              >
                {backend.status === 'running' ? '●' : '○'}
              </span>
              <span className={styles.optionLabel}>{backend.name}</span>
              {backend.id === currentBackendId && (
                <span className={styles.check}>✓</span>
              )}
            </button>
          ))}

          <div className={styles.divider} />

          <button
            className={styles.option}
            onClick={() => {
              setIsOpen(false);
              onCreateNew();
            }}
          >
            <IconPlus size={14} />
            <span className={styles.optionLabel}>Create New Backend</span>
          </button>
        </div>
      )}
    </div>
  );
}
```

---

### Step 5: Simple Admin Panel (2 hours)

**File:** `packages/noodl-editor/src/editor/src/views/Launcher/BackendManager/AdminPanel.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { Dialog } from '@noodl-core-ui/components/layout/Dialog';
import { Tabs, Tab } from '@noodl-core-ui/components/layout/Tabs';
import styles from './AdminPanel.module.scss';

interface Props {
  backendId: string;
  backendName: string;
  port: number;
  onClose: () => void;
}

interface TableInfo {
  name: string;
  count: number;
}

export function AdminPanel({ backendId, backendName, port, onClose }: Props) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSchema();
  }, [backendId]);

  const loadSchema = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:${port}/api/_schema`);
      const schema = await response.json();

      const tableInfos: TableInfo[] = [];
      for (const table of schema.tables || []) {
        const countRes = await fetch(
          `http://localhost:${port}/api/${table.name}?count=true&limit=0`
        );
        const countData = await countRes.json();
        tableInfos.push({
          name: table.name,
          count: countData.count || 0
        });
      }

      setTables(tableInfos);
      if (tableInfos.length > 0 && !selectedTable) {
        setSelectedTable(tableInfos[0].name);
      }
    } catch (e) {
      console.error('Failed to load schema:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTable) {
      loadRecords(selectedTable);
    }
  }, [selectedTable]);

  const loadRecords = async (table: string) => {
    try {
      const response = await fetch(
        `http://localhost:${port}/api/${table}?limit=100`
      );
      const data = await response.json();
      setRecords(data.results || []);
    } catch (e) {
      console.error('Failed to load records:', e);
      setRecords([]);
    }
  };

  return (
    <Dialog
      title={`Admin: ${backendName}`}
      onClose={onClose}
      width={800}
      height={600}
    >
      <div className={styles.container}>
        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>Tables</div>
          {loading ? (
            <div className={styles.loading}>Loading...</div>
          ) : tables.length === 0 ? (
            <div className={styles.empty}>No tables yet</div>
          ) : (
            <div className={styles.tableList}>
              {tables.map(table => (
                <button
                  key={table.name}
                  className={styles.tableItem}
                  data-selected={table.name === selectedTable}
                  onClick={() => setSelectedTable(table.name)}
                >
                  <span className={styles.tableName}>{table.name}</span>
                  <span className={styles.tableCount}>{table.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.main}>
          {selectedTable ? (
            <>
              <div className={styles.toolbar}>
                <h3>{selectedTable}</h3>
                <span className={styles.recordCount}>
                  {records.length} record{records.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className={styles.tableContainer}>
                {records.length === 0 ? (
                  <div className={styles.noRecords}>No records</div>
                ) : (
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        {Object.keys(records[0] || {}).map(key => (
                          <th key={key}>{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record, i) => (
                        <tr key={record.objectId || i}>
                          {Object.values(record).map((value: any, j) => (
                            <td key={j}>
                              {typeof value === 'object' 
                                ? JSON.stringify(value)
                                : String(value ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ) : (
            <div className={styles.noSelection}>
              Select a table to view records
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
```

---

### Step 6: Integrate into Launcher (1 hour)

**File:** `packages/noodl-editor/src/editor/src/views/Launcher/Launcher.tsx` (modifications)

```tsx
// Add import
import { BackendList } from './BackendManager/BackendList';

// In the Launcher component, add backends section alongside projects:

return (
  <div className={styles.launcher}>
    <div className={styles.content}>
      {/* Existing projects section */}
      <div className={styles.section}>
        <ProjectList 
          projects={projects}
          onOpen={handleOpenProject}
          // ... other props
        />
      </div>

      {/* New backends section */}
      <div className={styles.section}>
        <BackendList />
      </div>
    </div>
  </div>
);
```

---

## Files to Create

```
packages/noodl-editor/src/editor/src/views/Launcher/BackendManager/
├── BackendList.tsx
├── BackendList.module.scss
├── BackendCard.tsx
├── BackendCard.module.scss
├── CreateBackendDialog.tsx
├── CreateBackendDialog.module.scss
├── ExportDialog.tsx
├── ExportDialog.module.scss
├── AdminPanel.tsx
├── AdminPanel.module.scss
└── index.ts

packages/noodl-editor/src/editor/src/views/Launcher/ProjectCard/
├── BackendSelector.tsx
└── BackendSelector.module.scss
```

## Files to Modify

```
packages/noodl-editor/src/editor/src/views/Launcher/Launcher.tsx
  - Add BackendList section

packages/noodl-editor/src/editor/src/views/Launcher/Launcher.module.scss
  - Add styles for two-column layout
```

---

## Testing Checklist

### Backend List
- [ ] List loads on launcher open
- [ ] Status indicators show correctly
- [ ] Auto-refresh works
- [ ] Empty state displays correctly

### Backend Card
- [ ] Start button works
- [ ] Stop button works
- [ ] Delete button shows confirmation
- [ ] Admin panel opens
- [ ] Export dialog opens

### Create Dialog
- [ ] Validation works
- [ ] Creates backend successfully
- [ ] Error handling works
- [ ] Dialog closes on success

### Backend Selector
- [ ] Shows in project cards
- [ ] Lists available backends
- [ ] Selection persists
- [ ] Create new option works

### Admin Panel
- [ ] Tables list loads
- [ ] Record viewing works
- [ ] Handles empty tables
- [ ] Handles large datasets

---

## Success Criteria

1. Users can manage backends without opening any project
2. Clear visual indication of backend status
3. Project-backend association is intuitive
4. Basic data exploration is possible
5. All actions have loading/error states

---

## Dependencies

**Internal:**
- TASK-007B (Backend Server + IPC handlers)

**Blocks:**
- None (UI layer)

---

## Estimated Session Breakdown

| Session | Focus | Hours |
|---------|-------|-------|
| 1 | BackendList + BackendCard | 3 |
| 2 | Create dialog + Backend selector | 2 |
| 3 | Admin panel | 2 |
| 4 | Integration + polish | 2 |
| **Total** | | **9** |
