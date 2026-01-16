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

import React from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { HStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

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
  /** Record count (undefined while loading) */
  recordCount?: number;
  /** Whether row is expanded */
  expanded: boolean;
  /** Called when expand/collapse is toggled */
  onToggleExpand: () => void;
  /** Called when edit is requested */
  onEdit: () => void;
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
export function TableRow({ table, recordCount, expanded, onToggleExpand, onEdit }: TableRowProps) {
  const columnCount = table.columns?.length || 0;

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
          <PrimaryButton
            label="Edit"
            size={PrimaryButtonSize.Small}
            variant={PrimaryButtonVariant.Ghost}
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
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
              {/* System columns - always present */}
              <tr className={css.SystemColumn}>
                <td>id</td>
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
                  <td>{col.name}</td>
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
        </div>
      )}
    </div>
  );
}
