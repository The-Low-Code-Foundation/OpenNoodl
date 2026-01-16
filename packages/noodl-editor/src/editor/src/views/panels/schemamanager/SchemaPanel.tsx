/**
 * SchemaPanel
 *
 * Main panel for viewing and managing database schemas in local backends.
 * Shows a list of tables with columns, record counts, and management options.
 *
 * @module schemamanager/SchemaPanel
 * @since 1.2.0
 */

import React, { useCallback, useEffect, useState } from 'react';

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
 * Invoke IPC handler with error handling
 */
async function invokeIPC<T>(channel: string, ...args: unknown[]): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { ipcRenderer } = (window as any).require('electron');
  return ipcRenderer.invoke(channel, ...args);
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

  // Render loading state
  if (loading) {
    return (
      <div className={css.Root}>
        <div className={css.Header}>
          <Text textType={TextType.Proud}>Schema: {backendName}</Text>
          <PrimaryButton
            label="Close"
            size={PrimaryButtonSize.Small}
            variant={PrimaryButtonVariant.Muted}
            onClick={onClose}
          />
        </div>
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
        <div className={css.Header}>
          <Text textType={TextType.Proud}>Schema: {backendName}</Text>
          <PrimaryButton
            label="Close"
            size={PrimaryButtonSize.Small}
            variant={PrimaryButtonVariant.Muted}
            onClick={onClose}
          />
        </div>
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
      {/* Header */}
      <div className={css.Header}>
        <VStack>
          <Text textType={TextType.Proud}>Schema: {backendName}</Text>
          <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
            {tables.length} {tables.length === 1 ? 'table' : 'tables'}
          </Text>
        </VStack>
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
          <PrimaryButton
            label="Close"
            size={PrimaryButtonSize.Small}
            variant={PrimaryButtonVariant.Muted}
            onClick={onClose}
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
