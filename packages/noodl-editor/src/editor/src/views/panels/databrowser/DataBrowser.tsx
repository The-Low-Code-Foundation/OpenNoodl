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

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton } from '@noodl-core-ui/components/inputs/IconButton';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import css from './DataBrowser.module.scss';
import { DataGrid } from './DataGrid';
import { NewRecordModal } from './NewRecordModal';

const { ipcRenderer } = window.require('electron');

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
  /** Backend ID to browse */
  backendId: string;
  /** Backend display name */
  backendName: string;
  /** Initial table to show (optional) */
  initialTable?: string;
  /** Close callback */
  onClose: () => void;
}

const PAGE_SIZE = 50;

/**
 * DataBrowser component - main data browsing UI
 */
export function DataBrowser({ backendId, backendName, initialTable, onClose }: DataBrowserProps) {
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

  // System columns shown for all tables
  const systemColumns: ColumnDef[] = useMemo(
    () => [
      { name: 'id', type: 'String', required: true },
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

  // Load table list
  const loadTables = useCallback(async () => {
    try {
      const result = await ipcRenderer.invoke('backend:getSchema', backendId);
      const tableNames = result.tables.map((t: { name: string }) => t.name);
      setTables(tableNames);

      // Auto-select first table if none selected
      if (!selectedTable && tableNames.length > 0) {
        setSelectedTable(tableNames[0]);
      }
    } catch (err) {
      console.error('Failed to load tables:', err);
      setError('Failed to load tables');
    }
  }, [backendId, selectedTable]);

  // Load data for selected table
  const loadData = useCallback(async () => {
    if (!selectedTable) return;

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

        // Also search id
        searchConditions.push({ id: { contains: searchQuery.trim() } });

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
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [backendId, selectedTable, page, searchQuery]);

  // Initial load
  useEffect(() => {
    loadTables();
  }, [loadTables]);

  // Load data when table, page, or search changes
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset page when search or table changes
  useEffect(() => {
    setPage(0);
    setSelectedRecords(new Set());
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
          prev.map((r) => (r.id === recordId ? { ...r, [field]: value, updatedAt: new Date().toISOString() } : r))
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
      if (!window.confirm('Delete this record?')) return;

      try {
        await ipcRenderer.invoke('backend:deleteRecord', backendId, selectedTable, recordId);
        loadData();
      } catch (err) {
        console.error('Failed to delete record:', err);
        setError('Failed to delete record');
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
      loadData();
    } catch (err) {
      console.error('Failed to bulk delete:', err);
      setError('Failed to delete some records');
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
        setSelectedRecords(new Set(records.map((r) => r.id as string)));
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
              {backendName}
            </Text>
          </VStack>
        </HStack>
        <IconButton icon={IconName.Close} onClick={onClose} />
      </div>

      {/* Toolbar */}
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

      {/* Error message */}
      {error && (
        <div className={css.Error}>
          <Text textType={TextType.Default}>{error}</Text>
        </div>
      )}

      {/* Content area */}
      <div className={css.Content}>
        {loading ? (
          <div className={css.Loading}>
            <Text textType={TextType.Shy}>Loading...</Text>
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
      {showNewRecord && schema && selectedTable && (
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
