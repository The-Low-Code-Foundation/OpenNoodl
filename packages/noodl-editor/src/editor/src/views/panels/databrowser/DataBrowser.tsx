/**
 * DataBrowser
 *
 * Main data browser panel for viewing and editing records in local backend tables.
 * Provides a spreadsheet-like interface with inline editing, search, and pagination.
 *
 * @module panels/databrowser/DataBrowser
 * @since 1.2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { SidebarModel } from '@noodl-models/sidebar';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton } from '@noodl-core-ui/components/inputs/IconButton';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { BACKEND_SERVICES_PANEL_ID } from '../BackendServicesPanel/backendServicesPanelId';

import { ACL_COLUMN_TYPE, ACL_FIELD } from './acl';
import css from './DataBrowser.module.scss';
import { DataGrid } from './DataGrid';
import { NewRecordModal } from './NewRecordModal';
import { BackendStatusLike, SchemaFailure, describeSchemaFailure, stripIpcErrorPrefix } from './schemaFailure';

const { ipcRenderer } = window.require('electron');

/** The bit of a backend's metadata this panel needs to offer it as a choice. */
interface SelectableBackend {
  id: string;
  name: string;
}

/** Column definition from schema */
export interface ColumnDef {
  name: string;
  type: string;
  required?: boolean;
  default?: unknown;
  targetClass?: string;
}

/** Table schema */
export interface TableSchema {
  name: string;
  columns: ColumnDef[];
}

export interface DataBrowserProps {
  /**
   * Backend ID to browse.
   *
   * AAQ-011/F11: optional, and honestly so. This panel is registered as a
   * *transient* side panel (`backendSurfaces.tsx`) whose props are written onto
   * the `SidebarItem` immediately before `switch()`. Anything that activates
   * `backend-data` without going through `openBackendSurface` — the
   * `router.setup` hot-reload handler in `EditorPage.tsx` re-registers every
   * panel and then switches back to the active id, and `useSetupSettings`
   * restores a saved panel id without excluding transient ones — mounts it with
   * no props at all. Typing this `string` did not prevent that; it only stopped
   * the component from being allowed to handle it.
   */
  backendId?: string;
  /** Backend display name */
  backendName?: string;
  /** Initial table to show (optional) */
  initialTable?: string;
  /** Close callback */
  onClose: () => void;
}

const PAGE_SIZE = 50;

/**
 * DataBrowser component - main data browsing UI
 */
export function DataBrowser({
  backendId: backendIdProp,
  backendName: backendNameProp,
  initialTable,
  onClose
}: DataBrowserProps) {
  /**
   * AAQ-011/F11 — the backend the user picked here, when the panel arrived
   * without one. Kept apart from the prop so that a panel that *was* given a
   * backend can never be silently redirected at another one.
   */
  const [picked, setPicked] = useState<SelectableBackend | null>(null);
  /** What Backend Services could offer, loaded only when there is no selection. */
  const [selectable, setSelectable] = useState<SelectableBackend[] | null>(null);

  const backendId = backendIdProp || picked?.id;
  const backendName = backendIdProp ? backendNameProp : picked?.name;

  // State
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(initialTable || null);
  const [schema, setSchema] = useState<TableSchema | null>(null);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [showNewRecord, setShowNewRecord] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * A failed write, kept apart from `error` (a failed read) on purpose.
   *
   * POL-014 slice 2: `loadData` clears `error` on every run, and the realtime
   * subscription runs `loadData` on every change to this collection — including
   * the change that made the row stale in the first place. A delete failure
   * written into `error` was therefore on screen for about 300ms. It survives
   * here until the next write succeeds, or the table changes.
   */
  const [writeError, setWriteError] = useState<string | null>(null);
  /**
   * Why the table list could not be read — AAQ-011/F11.
   *
   * A *kind*, not a string, because the whole defect was that four unrelated
   * situations shared one sentence. `null` means the last attempt succeeded, and
   * `{ kind: 'no-selection' }` is not a failure at all: it is the state the
   * panel is in before anyone has said which backend to browse.
   */
  const [schemaFailure, setSchemaFailure] = useState<SchemaFailure | null>(null);

  // System columns shown for all tables
  const systemColumns: ColumnDef[] = useMemo(
    () => [
      // POL-014: `objectId`, not `id`. The backend, the IPC layer and the Parse
      // wire all name the primary key `objectId`; this column header used to say
      // `id` and render blank in every row because no record carries that field.
      { name: 'objectId', type: 'String', required: true },
      // SPR-001/F84: the ACL is a system column exactly like the three around
      // it — SchemaManager stamps it onto every table and keeps it out of
      // `_Schema`, so it appears in neither half of `allColumns` unless it is
      // named here. It sits second because the question it answers ("why can't
      // this user see this record?") is asked about a row you can already see,
      // and a column beyond the horizontal scroll answers nothing.
      { name: ACL_FIELD, type: ACL_COLUMN_TYPE },
      { name: 'createdAt', type: 'Date', required: true },
      { name: 'updatedAt', type: 'Date', required: true }
    ],
    []
  );

  // All columns = system + user columns (deduplicated by name)
  const allColumns = useMemo(() => {
    if (!schema) return systemColumns;
    // Deduplicate by column name, system columns first
    const seen = new Set(systemColumns.map((c) => c.name));
    const userColumns = (schema.columns || []).filter((c: ColumnDef) => !seen.has(c.name));
    return [...systemColumns, ...userColumns];
  }, [schema, systemColumns]);

  /** Where every "pick a backend" affordance in this panel goes. */
  const openBackendServices = useCallback(() => {
    SidebarModel.instance.switch(BACKEND_SERVICES_PANEL_ID);
  }, []);

  // Load table list
  const loadTables = useCallback(async () => {
    // AAQ-011/F11: a missing *selection* is not a broken *backend*. This used to
    // call straight through with `backendId === undefined`; the main process
    // rejects with `Backend must be running to get schema` (verified — it is the
    // same message for a missing id, an unknown id and a stopped backend), and
    // the panel reported "Failed to load tables" about a backend that was fine.
    if (!backendId) {
      setTables([]);
      setSchemaFailure({ kind: 'no-selection' });
      return;
    }

    try {
      const result = await ipcRenderer.invoke('backend:getSchema', backendId);
      const tableNames = (result?.tables || []).map((t: { name: string }) => t.name);
      setTables(tableNames);
      setSchemaFailure(null);

      // Auto-select first table if none selected
      if (!selectedTable && tableNames.length > 0) {
        setSelectedTable(tableNames[0]);
      }
    } catch (err) {
      console.error('Failed to load tables:', err);
      setTables([]);

      // Ask the two questions the rejection cannot answer: is the backend still
      // there, and is it running? `backend:get` returns `null` for an id that is
      // not on disk; `backend:status` reports `running` without throwing.
      // Either probe may itself fail, and neither failure is allowed to replace
      // the original one — `describeSchemaFailure` falls back to reporting the
      // real message when it is not told otherwise.
      const [exists, status] = await Promise.all([
        ipcRenderer
          .invoke('backend:get', backendId)
          .then((b: unknown) => b !== null && b !== undefined)
          .catch(() => true),
        ipcRenderer.invoke('backend:status', backendId).catch(() => null) as Promise<BackendStatusLike | null>
      ]);

      setSchemaFailure(
        describeSchemaFailure({
          backendId,
          backendName,
          exists,
          status,
          rawMessage: err instanceof Error ? err.message : String(err)
        })
      );
    }
  }, [backendId, backendName, selectedTable]);

  // Load data for selected table
  const loadData = useCallback(async () => {
    if (!backendId || !selectedTable) return;

    setLoading(true);
    setError(null);

    try {
      // Load schema for this table
      const tableSchema = await ipcRenderer.invoke('backend:getTableSchema', backendId, selectedTable);
      setSchema(tableSchema);

      // Build query
      const queryOptions: {
        collection: string;
        limit: number;
        skip: number;
        sort: string[];
        count: boolean;
        where?: Record<string, unknown>;
      } = {
        collection: selectedTable,
        limit: PAGE_SIZE,
        skip: page * PAGE_SIZE,
        sort: ['-createdAt'],
        count: true
      };

      // Apply search (simple contains search across string fields)
      if (searchQuery.trim()) {
        const stringColumns = tableSchema?.columns?.filter((c: ColumnDef) => c.type === 'String') || [];
        const searchConditions = stringColumns.map((col: ColumnDef) => ({
          [col.name]: { contains: searchQuery.trim() }
        }));

        // Also search the record id. This said `id`, which the adapter turns into
        // `"id" LIKE ?` against a table that has no such column — so every search
        // failed at the database, not just quietly matched nothing (POL-014).
        searchConditions.push({ objectId: { contains: searchQuery.trim() } });

        if (searchConditions.length > 0) {
          queryOptions.where = { $or: searchConditions };
        }
      }

      // Load records
      const result = await ipcRenderer.invoke('backend:queryRecords', backendId, queryOptions);
      setRecords(result.results || []);
      setTotalCount(result.count || 0);
    } catch (err) {
      console.error('Failed to load data:', err);
      // AAQ-011/F11, same class as the table list: the reason is the useful part.
      const detail = stripIpcErrorPrefix(err instanceof Error ? err.message : String(err));
      setError(detail ? `Could not load ${selectedTable}: ${detail}` : `Could not load ${selectedTable}.`);
    } finally {
      setLoading(false);
    }
  }, [backendId, selectedTable, page, searchQuery]);

  // Initial load
  useEffect(() => {
    loadTables();
  }, [loadTables]);

  /**
   * AAQ-011/F11 — what the empty state can offer when nothing is selected.
   *
   * Loaded only in that case, so a panel opened normally from a backend card
   * never makes this call. **Deliberately an offer and not an auto-selection**,
   * even when exactly one backend exists: this panel edits cells, deletes rows
   * and bulk-deletes them, and choosing on the user's behalf would make "the only
   * backend on this machine" the silent target of a destructive surface. Naming
   * the backend on a button is one click and no guessing — and the click is
   * recorded in `picked`, so the header stops claiming a name it was never given.
   */
  useEffect(() => {
    if (backendId) return;

    let cancelled = false;
    ipcRenderer
      .invoke('backend:list')
      .then((list: SelectableBackend[]) => {
        if (cancelled) return;
        setSelectable((list || []).map(({ id, name }) => ({ id, name })));
      })
      .catch((err: unknown) => {
        console.error('Failed to list backends:', err);
        if (!cancelled) setSelectable([]);
      });

    return () => {
      cancelled = true;
    };
  }, [backendId]);

  // Load data when table, page, or search changes
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset page when search or table changes
  useEffect(() => {
    setPage(0);
    setSelectedRecords(new Set());
    setWriteError(null); // a failure about another table's row is not news here
  }, [selectedTable, searchQuery]);

  // Live updates (BAK-001): ride the backend's realtime SSE stream so the grid
  // reflects changes made by other clients (or cloud functions) without a manual
  // refresh. Re-runs the current query, debounced, on each change/resync.
  useEffect(() => {
    if (!backendId || !selectedTable) return;

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const handleChange = (
      _event: unknown,
      payload: { backendId: string; collection: string }
    ) => {
      if (payload.backendId !== backendId || payload.collection !== selectedTable) return;
      if (refreshTimer) return; // coalesce bursts into one reload
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        loadData();
      }, 300);
    };

    ipcRenderer.on('backend:collectionChanged', handleChange);
    ipcRenderer.send('backend:subscribeCollection', backendId, selectedTable);

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      ipcRenderer.removeListener('backend:collectionChanged', handleChange);
      ipcRenderer.send('backend:unsubscribeCollection', backendId, selectedTable);
    };
  }, [backendId, selectedTable, loadData]);

  // Save cell (inline edit)
  const handleSaveCell = useCallback(
    async (recordId: string, field: string, value: unknown) => {
      if (!selectedTable) return;

      try {
        await ipcRenderer.invoke('backend:saveRecord', backendId, selectedTable, recordId, {
          [field]: value
        });

        // Update local state
        setRecords((prev) =>
          prev.map((r) => (r.objectId === recordId ? { ...r, [field]: value, updatedAt: new Date().toISOString() } : r))
        );
      } catch (err) {
        console.error('Failed to save cell:', err);
        throw err; // Re-throw so CellEditor can show error
      }
    },
    [backendId, selectedTable]
  );

  // Delete single record
  const handleDeleteRecord = useCallback(
    async (recordId: string) => {
      if (!selectedTable) return;
      // A row with no id cannot be deleted, and must not look as if it was
      // (POL-014, consequence 4 — the confirm was accepted and nothing happened).
      if (!recordId) {
        setWriteError('Cannot delete: this row has no objectId.');
        return;
      }
      if (!window.confirm('Delete this record?')) return;

      try {
        await ipcRenderer.invoke('backend:deleteRecord', backendId, selectedTable, recordId);
        setWriteError(null);
        loadData();
      } catch (err) {
        console.error('Failed to delete record:', err);
        setWriteError(`Failed to delete record: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [backendId, selectedTable, loadData]
  );

  // Bulk delete
  const handleBulkDelete = useCallback(async () => {
    if (selectedRecords.size === 0 || !selectedTable) return;
    if (!window.confirm(`Delete ${selectedRecords.size} records?`)) return;

    try {
      for (const recordId of selectedRecords) {
        await ipcRenderer.invoke('backend:deleteRecord', backendId, selectedTable, recordId);
      }
      setSelectedRecords(new Set());
      setWriteError(null);
      loadData();
    } catch (err) {
      console.error('Failed to bulk delete:', err);
      setWriteError(`Failed to delete some records: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [backendId, selectedTable, selectedRecords, loadData]);

  // Export to CSV
  const handleExport = useCallback(() => {
    if (records.length === 0 || !schema) return;

    // Build CSV
    const headers = allColumns.map((c) => c.name).join(',');
    const rows = records.map((record) =>
      allColumns
        .map((col) => {
          const value = record[col.name];
          if (value === null || value === undefined) return '';
          if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
          if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return String(value);
        })
        .join(',')
    );

    const csv = [headers, ...rows].join('\n');

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTable}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [records, allColumns, selectedTable, schema]);

  // Toggle record selection
  const handleSelectRecord = useCallback((recordId: string, selected: boolean) => {
    setSelectedRecords((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(recordId);
      } else {
        next.delete(recordId);
      }
      return next;
    });
  }, []);

  // Select/deselect all
  const handleSelectAll = useCallback(
    (selected: boolean) => {
      if (selected) {
        setSelectedRecords(new Set(records.map((r) => r.objectId as string)));
      } else {
        setSelectedRecords(new Set());
      }
    },
    [records]
  );

  // Pagination
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const startRecord = page * PAGE_SIZE + 1;
  const endRecord = Math.min((page + 1) * PAGE_SIZE, totalCount);

  return (
    <div className={css.Root}>
      {/* Header */}
      <div className={css.Header}>
        <HStack hasSpacing>
          <div className={css.HeaderIcon}>
            <Icon icon={IconName.CloudData} size={IconSize.Small} />
          </div>
          <VStack>
            <Text textType={TextType.DefaultContrast}>Data Browser</Text>
            <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
              {/* AAQ-011/F11: with no selection this was blank, which read as a
                  backend with no name rather than as no backend. */}
              {backendName || 'No backend selected'}
            </Text>
          </VStack>
        </HStack>
        <IconButton icon={IconName.Close} onClick={onClose} />
      </div>

      {/* Toolbar — AAQ-011/F11: a table picker, a search box and a refresh button
          are all inert without a backend, so they are not offered. */}
      {backendId && (
      <div className={css.Toolbar}>
        <HStack hasSpacing>
          {/* Table selector */}
          <select
            className={css.TableSelect}
            value={selectedTable || ''}
            onChange={(e) => setSelectedTable(e.target.value || null)}
          >
            <option value="" disabled>
              Select table...
            </option>
            {tables.map((table) => (
              <option key={table} value={table}>
                {table}
              </option>
            ))}
          </select>

          {/* Search */}
          <input
            type="text"
            className={css.SearchInput}
            placeholder="Search records..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {/* Refresh */}
          <IconButton icon={IconName.Refresh} onClick={loadData} />
        </HStack>

        <HStack hasSpacing>
          {selectedTable && (
            <>
              <PrimaryButton
                label="+ New Record"
                size={PrimaryButtonSize.Small}
                variant={PrimaryButtonVariant.Muted}
                onClick={() => setShowNewRecord(true)}
              />
              <PrimaryButton
                label="Export CSV"
                size={PrimaryButtonSize.Small}
                variant={PrimaryButtonVariant.Muted}
                onClick={handleExport}
                isDisabled={records.length === 0}
              />
            </>
          )}
        </HStack>
      </div>
      )}

      {/* Bulk actions bar */}
      {selectedRecords.size > 0 && (
        <div className={css.BulkActions}>
          <Text textType={TextType.Default}>{selectedRecords.size} records selected</Text>
          <HStack hasSpacing>
            <PrimaryButton
              label="Delete Selected"
              size={PrimaryButtonSize.Small}
              variant={PrimaryButtonVariant.Danger}
              onClick={handleBulkDelete}
            />
            <PrimaryButton
              label="Clear Selection"
              size={PrimaryButtonSize.Small}
              variant={PrimaryButtonVariant.Muted}
              onClick={() => setSelectedRecords(new Set())}
            />
          </HStack>
        </div>
      )}

      {/* AAQ-011/F11 — why the table list is missing, said once and said usefully.
          `no-selection` is deliberately absent here: it is not a failure, and it
          is answered by the picker in the content area below. */}
      {schemaFailure && schemaFailure.kind !== 'no-selection' && (
        <div className={schemaFailure.kind === 'failed' ? css.Error : css.Notice}>
          <Text textType={TextType.Default}>{schemaFailure.message}</Text>
          <HStack hasSpacing>
            {schemaFailure.kind !== 'failed' && (
              <PrimaryButton
                label="Backend Services"
                size={PrimaryButtonSize.Small}
                variant={PrimaryButtonVariant.Muted}
                onClick={openBackendServices}
              />
            )}
            {/* A stopped backend becomes a running one without this panel being
                told, and F10 may be starting one right now — so retrying has to
                be one click rather than a reopen. */}
            <PrimaryButton
              label="Try again"
              size={PrimaryButtonSize.Small}
              variant={PrimaryButtonVariant.Muted}
              onClick={loadTables}
            />
          </HStack>
        </div>
      )}

      {/* Error messages — a failed read and a failed write are different news. */}
      {error && (
        <div className={css.Error}>
          <Text textType={TextType.Default}>{error}</Text>
        </div>
      )}
      {writeError && (
        <div className={css.Error}>
          <Text textType={TextType.Default}>{writeError}</Text>
        </div>
      )}

      {/* Content area */}
      <div className={css.Content}>
        {loading ? (
          <div className={css.Loading}>
            <Text textType={TextType.Shy}>Loading...</Text>
          </div>
        ) : !backendId ? (
          /* AAQ-011/F11 — the state that used to say "Failed to load tables".
             Nothing is broken; nothing has been chosen. */
          <div className={css.EmptyState}>
            <Text textType={TextType.Shy}>
              {selectable === null
                ? 'Looking for backends…'
                : selectable.length === 0
                ? 'There are no backends yet. Create one in Backend Services, then come back here.'
                : 'Choose a backend to browse.'}
            </Text>
            <VStack hasSpacing UNSAFE_style={{ marginTop: '12px', alignItems: 'stretch' }}>
              {(selectable || []).map((candidate) => (
                <PrimaryButton
                  key={candidate.id}
                  label={candidate.name || candidate.id}
                  size={PrimaryButtonSize.Small}
                  variant={PrimaryButtonVariant.Muted}
                  onClick={() => setPicked(candidate)}
                />
              ))}
              <PrimaryButton
                label="Open Backend Services"
                size={PrimaryButtonSize.Small}
                variant={PrimaryButtonVariant.Muted}
                onClick={openBackendServices}
              />
            </VStack>
          </div>
        ) : !selectedTable ? (
          <div className={css.EmptyState}>
            <Text textType={TextType.Shy}>Select a table to browse data</Text>
          </div>
        ) : records.length === 0 ? (
          <div className={css.EmptyState}>
            <Text textType={TextType.Shy}>No records found</Text>
            {!searchQuery && (
              <PrimaryButton
                label="Create First Record"
                size={PrimaryButtonSize.Small}
                variant={PrimaryButtonVariant.Muted}
                onClick={() => setShowNewRecord(true)}
                UNSAFE_style={{ marginTop: '12px' }}
              />
            )}
          </div>
        ) : (
          <DataGrid
            columns={allColumns}
            records={records}
            selectedRecords={selectedRecords}
            onSelectRecord={handleSelectRecord}
            onSelectAll={handleSelectAll}
            onSaveCell={handleSaveCell}
            onDeleteRecord={handleDeleteRecord}
          />
        )}
      </div>

      {/* Pagination */}
      {selectedTable && totalCount > 0 && (
        <div className={css.Pagination}>
          <Text textType={TextType.Shy} style={{ fontSize: '12px' }}>
            Showing {startRecord.toLocaleString()}-{endRecord.toLocaleString()} of {totalCount.toLocaleString()} records
          </Text>
          <div className={css.PageControls}>
            <button className={css.PageButton} onClick={() => setPage(0)} disabled={page === 0}>
              First
            </button>
            <button className={css.PageButton} onClick={() => setPage(page - 1)} disabled={page === 0}>
              Previous
            </button>
            <Text textType={TextType.Shy} style={{ fontSize: '12px', margin: '0 8px' }}>
              Page {page + 1} of {totalPages}
            </Text>
            <button className={css.PageButton} onClick={() => setPage(page + 1)} disabled={page >= totalPages - 1}>
              Next
            </button>
            <button
              className={css.PageButton}
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1}
            >
              Last
            </button>
          </div>
        </div>
      )}

      {/* New Record Modal */}
      {showNewRecord && backendId && schema && selectedTable && (
        <NewRecordModal
          backendId={backendId}
          tableName={selectedTable}
          columns={schema.columns}
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
