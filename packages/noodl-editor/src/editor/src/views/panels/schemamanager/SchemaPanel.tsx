/**
 * SchemaPanel
 *
 * Main panel for viewing and managing database schemas in local backends.
 * Shows a list of tables with columns, record counts, and management options.
 *
 * @module schemamanager/SchemaPanel
 * @since 1.2.0
 */

import { ipcInvoke } from '@noodl-utils/ipc';
import React, { useCallback, useEffect, useState } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton } from '@noodl-core-ui/components/inputs/IconButton';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { CreateTableModal } from './CreateTableModal';
import css from './SchemaPanel.module.scss';
import { TableRow, TableInfo } from './TableRow';

export interface SchemaPanelProps {
  /** Backend ID */
  backendId: string;
  /** Backend name for display */
  backendName: string;
  /** Whether backend is running */
  isRunning: boolean;
  /**
   * DEF-036 AC4 — the table to open on, for a caller that already knows which one.
   *
   * 🔴 The front door is not good enough, and that is the whole of AC4: an author who pressed
   * **Add a field** on a `Create Record` node pointed at `Puppy` asked about `Puppy`, and
   * landing them on a list of eleven tables to find it in again is the dead end the button was
   * added to remove.
   *
   * 🔴 **Not read once.** That was the first version and the drive found it wrong. A surface
   * that is already mounted is *reused*: `openBackendSurface` re-announces the panel and the
   * new props do arrive — the header changes to the new backend's name — but `useState`'s
   * initial value has already been latched, so the second **Add a field** press, on a node
   * pointed at a different table, landed on the first node's table. Measured 2026-08-31:
   * opened on `Person`, re-opened for `Orders`, header updated, `Person` still the expanded
   * row. That is the dead end AC4 exists to remove, reintroduced on the second use of the
   * button that removes it.
   */
  initialTable?: string;
  /**
   * Changes on every press of the control that opened this panel.
   *
   * ⚠️ Needed because `initialTable` alone is not enough: pressing **Add a field** twice on the
   * *same* node passes the same table, so an effect keyed on the table alone would not re-run —
   * and if the author had collapsed that row in between, the second press would appear to do
   * nothing. A button that does nothing is the failure mode, not a cosmetic one.
   */
  openToken?: string | number;
  /** Called when panel should close */
  onClose: () => void;
}

interface SchemaData {
  tables: TableInfo[];
}

/**
 * The header the other six backend surfaces share: icon, title, backend
 * subtitle, close X (POL-016).
 *
 * Schema had a bespoke one — a plain `Schema: {backendName}` title with a
 * `+ New Table / Refresh / Close` button group where the X belongs — which was
 * pre-existing and became conspicuous once POL-005 made a surface the only thing
 * in the panel. Its two real actions do not disappear; they move to a `.Toolbar`
 * row beneath, which is exactly what `DataBrowser` already does with its own
 * table selector, so this brings Schema onto the family rather than inventing a
 * third shape.
 *
 * Declared here rather than in all three returns because the loading and error
 * states rendered the bespoke header too, and a shared header that only two of
 * three states use is how they drifted apart in the first place.
 */
function SurfaceHeader({ backendName, subtitle, onClose }: {
  backendName: string;
  subtitle?: string;
  onClose: () => void;
}) {
  return (
    <div className={css.Header}>
      <HStack hasSpacing>
        <div className={css.HeaderIcon}>
          <Icon icon={IconName.Database} size={IconSize.Small} />
        </div>
        <VStack>
          <Text textType={TextType.DefaultContrast}>Schema</Text>
          <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
            {subtitle ? `${backendName} — ${subtitle}` : backendName}
          </Text>
        </VStack>
      </HStack>
      <IconButton icon={IconName.Close} onClick={onClose} />
    </div>
  );
}

/**
 * Invoke IPC handler with error handling
 */
async function invokeIPC<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcInvoke<T>(channel, ...args);
}

/**
 * SchemaPanel - View and manage database schemas
 */
export function SchemaPanel({
  backendId,
  backendName,
  isRunning,
  initialTable,
  openToken,
  onClose
}: SchemaPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schema, setSchema] = useState<SchemaData | null>(null);
  // DEF-036 AC4 — opened on the table the caller named, expanded rather than in edit mode: the
  // author asked to *add a field*, and `AddColumnForm` is inside the expanded row. Arming edit
  // mode as well would put a rename input under every existing column of a table they have only
  // just arrived at. The initial value covers a fresh mount; the effect below covers a reuse.
  const [expandedTable, setExpandedTable] = useState<string | null>(initialTable ?? null);
  const [recordCounts, setRecordCounts] = useState<Record<string, number>>({});
  const [showCreateTable, setShowCreateTable] = useState(false);
  // Which table's schema is open for editing (F88). Separate from
  // `expandedTable` because expanding is a read and editing is a write; the
  // two were conflated, which is how Edit came to mean "expand, again".
  const [editingTable, setEditingTable] = useState<string | null>(null);

  // Load schema from backend
  const loadSchema = useCallback(async () => {
    if (!isRunning) {
      setError('Backend must be running to view schema');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const schemaData = await invokeIPC<SchemaData>('backend:getSchema', backendId);
      setSchema(schemaData);

      // Load record counts asynchronously
      loadRecordCounts(schemaData.tables);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load schema';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [backendId, isRunning]);

  // Load record counts for all tables
  const loadRecordCounts = useCallback(
    async (tables: TableInfo[]) => {
      const counts: Record<string, number> = {};

      for (const table of tables) {
        try {
          const count = await invokeIPC<number>('backend:getRecordCount', backendId, table.name);
          counts[table.name] = count;
        } catch {
          counts[table.name] = 0;
        }
      }

      setRecordCounts(counts);
    },
    [backendId]
  );

  // Load schema on mount and when backend changes
  useEffect(() => {
    loadSchema();
  }, [loadSchema]);

  /**
   * DEF-036 AC4 — land on the caller's table, on a reused mount as well as a fresh one.
   *
   * Keyed on `openToken` as well as the table, so pressing the same node's button twice works
   * even if the author collapsed the row in between; see the props for what the drive measured.
   *
   * ⚠️ Deliberately does **not** touch `editingTable`. Arriving somewhere is not the same as
   * being armed to rename every column there, and on `_User` half of them are the backend's
   * anyway (`serverOwnedColumns.ts`).
   */
  useEffect(() => {
    if (initialTable) setExpandedTable(initialTable);
  }, [initialTable, openToken]);

  // Handle table expand/collapse
  const handleToggleExpand = useCallback((tableName: string) => {
    setExpandedTable((prev) => (prev === tableName ? null : tableName));
    // Only one row is open at a time, so any toggle closes whatever was being
    // edited. Leaving `editingTable` set would put a collapsed row straight
    // back into edit mode the next time it was merely opened to be read.
    setEditingTable(null);
  }, []);

  /**
   * F88 — press Edit on an existing table.
   *
   * This was a stub:
   *
   * ```
   * setExpandedTable((prev) => (prev === tableName ? tableName : tableName));
   * ```
   *
   * Both ternary branches are the same value, so the handler's whole effect
   * was `setExpandedTable(tableName)`. On a row that was already expanded —
   * which it is, as soon as you have clicked it once to look at its fields —
   * React bails out of a set to the identical value and nothing renders. The
   * button was bound, could not throw, and opened no dialog: it simply had no
   * edit path behind it. Meanwhile `AddColumnForm` and `ColumnRenameInput`
   * were finished, styled, exported from `index.ts`, and rendered by nothing.
   *
   * Editing is only meaningful on an open row, so this expands as well as
   * arms edit mode.
   */
  const handleEditTable = useCallback((tableName: string) => {
    setExpandedTable(tableName);
    setEditingTable(tableName);
  }, []);

  const handleEndEdit = useCallback(() => setEditingTable(null), []);

  // Delete a table and all its data (WF-004: wires the previously-dead
  // backend:deleteTable handler to a UI caller).
  const handleDeleteTable = useCallback(
    async (tableName: string) => {
      const count = recordCounts[tableName];
      const suffix = count ? ` and its ${count.toLocaleString()} ${count === 1 ? 'record' : 'records'}` : '';
      if (!window.confirm(`Delete table "${tableName}"${suffix}? This cannot be undone.`)) return;

      try {
        await invokeIPC('backend:deleteTable', backendId, tableName);
        setEditingTable((prev) => (prev === tableName ? null : prev));
        await loadSchema();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to delete table';
        setError(message);
      }
    },
    [backendId, recordCounts, loadSchema]
  );

  // Render loading state
  if (loading) {
    return (
      <div className={css.Root}>
        <SurfaceHeader backendName={backendName} onClose={onClose} />
        <div className={css.Loading}>
          <Text textType={TextType.Shy}>Loading schema...</Text>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={css.Root}>
        <SurfaceHeader backendName={backendName} onClose={onClose} />
        <div className={css.Error}>
          <Text textType={TextType.Shy}>{error}</Text>
          <PrimaryButton
            label="Retry"
            size={PrimaryButtonSize.Small}
            variant={PrimaryButtonVariant.Muted}
            onClick={loadSchema}
          />
        </div>
      </div>
    );
  }

  const tables = schema?.tables || [];

  return (
    <div className={css.Root}>
      {/* Header — the shared surface header; the actions live in the toolbar below. */}
      <SurfaceHeader
        backendName={backendName}
        subtitle={`${tables.length} ${tables.length === 1 ? 'table' : 'tables'}`}
        onClose={onClose}
      />

      {/* Toolbar */}
      <div className={css.Toolbar}>
        <HStack hasSpacing>
          <PrimaryButton
            label="+ New Table"
            size={PrimaryButtonSize.Small}
            variant={PrimaryButtonVariant.Cta}
            onClick={() => setShowCreateTable(true)}
          />
          <PrimaryButton
            label="Refresh"
            size={PrimaryButtonSize.Small}
            variant={PrimaryButtonVariant.Muted}
            onClick={loadSchema}
          />
        </HStack>
      </div>

      {/* Table List */}
      <div className={css.TableList}>
        {tables.length === 0 ? (
          <div className={css.EmptyState}>
            <Text textType={TextType.DefaultContrast}>No tables yet</Text>
            <Text textType={TextType.Shy} style={{ marginTop: '8px' }}>
              Create your first table to start storing data.
            </Text>
            <PrimaryButton
              label="Create First Table"
              size={PrimaryButtonSize.Small}
              variant={PrimaryButtonVariant.Cta}
              onClick={() => setShowCreateTable(true)}
              UNSAFE_style={{ marginTop: '16px' }}
            />
          </div>
        ) : (
          tables.map((table) => (
            <TableRow
              key={table.name}
              table={table}
              backendId={backendId}
              recordCount={recordCounts[table.name]}
              expanded={expandedTable === table.name}
              editing={editingTable === table.name}
              onToggleExpand={() => handleToggleExpand(table.name)}
              onEdit={() => handleEditTable(table.name)}
              onEndEdit={handleEndEdit}
              onSchemaChanged={loadSchema}
              onDelete={() => handleDeleteTable(table.name)}
            />
          ))
        )}
      </div>

      {/* Create Table Modal */}
      {showCreateTable && (
        <CreateTableModal
          backendId={backendId}
          onClose={() => setShowCreateTable(false)}
          onSuccess={() => {
            setShowCreateTable(false);
            loadSchema();
          }}
        />
      )}
    </div>
  );
}
