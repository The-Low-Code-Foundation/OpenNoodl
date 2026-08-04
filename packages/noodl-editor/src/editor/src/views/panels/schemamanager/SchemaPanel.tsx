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
export function SchemaPanel({ backendId, backendName, isRunning, onClose }: SchemaPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schema, setSchema] = useState<SchemaData | null>(null);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [recordCounts, setRecordCounts] = useState<Record<string, number>>({});
  const [showCreateTable, setShowCreateTable] = useState(false);

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

  // Handle table expand/collapse
  const handleToggleExpand = useCallback((tableName: string) => {
    setExpandedTable((prev) => (prev === tableName ? null : tableName));
  }, []);

  // Handle edit table - expands table to show columns
  const handleEditTable = useCallback((tableName: string) => {
    // Expand the table to show columns - full editing (add/remove columns) will be added in a future task
    setExpandedTable((prev) => (prev === tableName ? tableName : tableName));
  }, []);

  // Delete a table and all its data (WF-004: wires the previously-dead
  // backend:deleteTable handler to a UI caller).
  const handleDeleteTable = useCallback(
    async (tableName: string) => {
      const count = recordCounts[tableName];
      const suffix = count ? ` and its ${count.toLocaleString()} ${count === 1 ? 'record' : 'records'}` : '';
      if (!window.confirm(`Delete table "${tableName}"${suffix}? This cannot be undone.`)) return;

      try {
        await invokeIPC('backend:deleteTable', backendId, tableName);
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
              recordCount={recordCounts[table.name]}
              expanded={expandedTable === table.name}
              onToggleExpand={() => handleToggleExpand(table.name)}
              onEdit={() => handleEditTable(table.name)}
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
