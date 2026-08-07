/**
 * TableRow
 *
 * Expandable row showing table name, column count, and record count.
 * When expanded, shows all columns with their types.
 * Supports adding columns, renaming columns, and deleting tables.
 *
 * @module schemamanager/TableRow
 * @since 1.2.0
 */

import React, { useEffect, useMemo, useState } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { HStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { AddColumnForm, ColumnRenameInput } from './AddColumnForm';
import css from './TableRow.module.scss';

/** Column definition from schema */
export interface ColumnDefinition {
  name: string;
  type: string;
  required?: boolean;
  default?: unknown;
  targetClass?: string;
}

/** Table info from schema API */
export interface TableInfo {
  name: string;
  columns: ColumnDefinition[];
  createdAt?: string | null;
}

export interface TableRowProps {
  /** Table information */
  table: TableInfo;
  /** Backend ID — the inline schema-edit forms invoke IPC with it (F88) */
  backendId: string;
  /** Record count (undefined while loading) */
  recordCount?: number;
  /** Whether row is expanded */
  expanded: boolean;
  /** Whether this row is in schema-edit mode (F88) */
  editing: boolean;
  /** Called when expand/collapse is toggled */
  onToggleExpand: () => void;
  /** Called when edit is requested */
  onEdit: () => void;
  /** Called when the row should leave edit mode (F88) */
  onEndEdit: () => void;
  /** Called after a column was added or renamed, so the panel can reload (F88) */
  onSchemaChanged: () => void;
  /** Called when the table should be deleted (WF-004: wires backend:deleteTable) */
  onDelete: () => void;
}

/** Color mapping for data types */
const TYPE_COLORS: Record<string, string> = {
  String: 'var(--theme-color-primary)',
  Number: 'var(--theme-color-success)',
  Boolean: 'var(--theme-color-notice)',
  Date: '#8b5cf6',
  Object: '#ec4899',
  Array: '#6366f1',
  Pointer: 'var(--theme-color-danger)',
  Relation: 'var(--theme-color-danger)',
  GeoPoint: '#14b8a6',
  File: '#f97316'
};

/**
 * TypeBadge - Small colored badge showing column type
 */
function TypeBadge({ type }: { type: string }) {
  const color = TYPE_COLORS[type] || 'var(--theme-color-fg-default-shy)';

  return (
    <span className={css.TypeBadge} style={{ backgroundColor: color }}>
      {type}
    </span>
  );
}

/**
 * TableRow - Expandable table display row
 */
export function TableRow({
  table,
  backendId,
  recordCount,
  expanded,
  editing,
  onToggleExpand,
  onEdit,
  onEndEdit,
  onSchemaChanged,
  onDelete
}: TableRowProps) {
  const columnCount = table.columns?.length || 0;

  // Which of this row's own forms is open. Local because nothing outside the
  // row cares, and because a reload after a successful add/rename must not
  // reset the row's edit mode — only its transient form.
  const [renamingColumn, setRenamingColumn] = useState<string | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);

  const existingColumns = useMemo(() => (table.columns || []).map((c) => c.name), [table.columns]);

  // Leaving edit mode has to close the forms too. Without this, pressing Done
  // with a rename input open and then pressing Edit again reopens the row with
  // a stale input mounted on a column that may since have been renamed away.
  useEffect(() => {
    if (!editing) {
      setRenamingColumn(null);
      setAddingColumn(false);
    }
  }, [editing]);

  return (
    <div className={css.Root} data-expanded={expanded}>
      {/* Header row - always visible */}
      <div className={css.Header} onClick={onToggleExpand}>
        <HStack hasSpacing>
          <div className={css.ExpandIcon}>
            <Icon
              icon={expanded ? IconName.CaretDown : IconName.CaretRight}
              size={IconSize.Tiny}
              UNSAFE_style={{ color: 'var(--theme-color-fg-default-shy)' }}
            />
          </div>
          <div className={css.TableIcon}>
            <Text textType={TextType.Proud}>T</Text>
          </div>
          <div className={css.TableName}>
            <Text textType={TextType.DefaultContrast}>{table.name}</Text>
          </div>
        </HStack>

        <HStack hasSpacing>
          <div className={css.Stats}>
            <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
              {columnCount} {columnCount === 1 ? 'field' : 'fields'}
            </Text>
            {recordCount !== undefined && (
              <Text textType={TextType.Shy} style={{ fontSize: '11px', marginLeft: '8px' }}>
                • {recordCount.toLocaleString()} {recordCount === 1 ? 'record' : 'records'}
              </Text>
            )}
          </div>
          {/*
            F88: the label and variant both change, so the press is visible
            even on a row that was already expanded — the old handler's only
            effect was to set `expandedTable` to a value it already held, which
            React bails out of, so the click changed no DOM at all.
          */}
          <PrimaryButton
            label={editing ? 'Done' : 'Edit'}
            size={PrimaryButtonSize.Small}
            variant={editing ? PrimaryButtonVariant.Cta : PrimaryButtonVariant.Ghost}
            onClick={(e) => {
              e.stopPropagation();
              if (editing) onEndEdit();
              else onEdit();
            }}
          />
          <PrimaryButton
            label="Delete"
            size={PrimaryButtonSize.Small}
            variant={PrimaryButtonVariant.Danger}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          />
        </HStack>
      </div>

      {/* Expanded content - columns list */}
      {expanded && (
        <div className={css.Columns}>
          <table className={css.ColumnTable}>
            <thead>
              <tr>
                <th>Field Name</th>
                <th>Type</th>
                <th>Required</th>
                <th>Default</th>
              </tr>
            </thead>
            <tbody>
              {/* System columns - always present.
                  The primary key is `objectId`, not `id` — this row said `id`,
                  which is the one name a query against a local backend cannot
                  use (local-sql `SchemaManager` declares `"objectId" TEXT
                  PRIMARY KEY`, and it is what `AddColumnForm` reserves). */}
              <tr className={css.SystemColumn}>
                <td>objectId</td>
                <td>
                  <TypeBadge type="String" />
                </td>
                <td>✓</td>
                <td>UUID (auto)</td>
              </tr>
              <tr className={css.SystemColumn}>
                <td>createdAt</td>
                <td>
                  <TypeBadge type="Date" />
                </td>
                <td>✓</td>
                <td>auto</td>
              </tr>
              <tr className={css.SystemColumn}>
                <td>updatedAt</td>
                <td>
                  <TypeBadge type="Date" />
                </td>
                <td>✓</td>
                <td>auto</td>
              </tr>
              {/* User-defined columns */}
              {table.columns.map((col) => (
                <tr key={col.name}>
                  <td>
                    {editing && renamingColumn === col.name ? (
                      <ColumnRenameInput
                        backendId={backendId}
                        tableName={table.name}
                        columnName={col.name}
                        existingColumns={existingColumns}
                        onSuccess={() => {
                          setRenamingColumn(null);
                          onSchemaChanged();
                        }}
                        onCancel={() => setRenamingColumn(null)}
                      />
                    ) : editing ? (
                      <button
                        type="button"
                        className={css.RenameTrigger}
                        title={`Rename "${col.name}"`}
                        onClick={() => setRenamingColumn(col.name)}
                      >
                        {col.name}
                      </button>
                    ) : (
                      col.name
                    )}
                  </td>
                  <td>
                    <TypeBadge type={col.type} />
                    {col.targetClass && <span className={css.TargetClass}> → {col.targetClass}</span>}
                  </td>
                  <td>{col.required ? '✓' : ''}</td>
                  <td>{col.default !== undefined ? String(col.default) : '—'}</td>
                </tr>
              ))}
              {table.columns.length === 0 && (
                <tr>
                  <td colSpan={4} className={css.NoColumns}>
                    No custom fields defined yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/*
            F88: the edit surface itself. `AddColumnForm` and
            `ColumnRenameInput` were both complete, styled and wired to live
            IPC handlers (`backend:addColumn`, `backend:renameColumn`), and
            exported from the barrel — but no component rendered them, so
            pressing Edit on an existing table could not reach them.
          */}
          {editing &&
            (addingColumn ? (
              <AddColumnForm
                backendId={backendId}
                tableName={table.name}
                existingColumns={existingColumns}
                onSuccess={() => {
                  setAddingColumn(false);
                  onSchemaChanged();
                }}
                onCancel={() => setAddingColumn(false)}
              />
            ) : (
              <div className={css.EditActions}>
                <PrimaryButton
                  label="+ Add Field"
                  size={PrimaryButtonSize.Small}
                  variant={PrimaryButtonVariant.Cta}
                  onClick={() => setAddingColumn(true)}
                />
                <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
                  Click a field name to rename it. Enter saves, Esc cancels.
                </Text>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
