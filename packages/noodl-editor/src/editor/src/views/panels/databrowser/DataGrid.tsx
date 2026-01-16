/**
 * DataGrid
 *
 * Spreadsheet-style grid for displaying and editing records.
 * Supports inline editing, selection, and type-aware cell rendering.
 *
 * @module panels/databrowser/DataGrid
 * @since 1.2.0
 */

import React, { useCallback, useState } from 'react';

import { IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton } from '@noodl-core-ui/components/inputs/IconButton';

import { CellEditor } from './CellEditor';
import { ColumnDef } from './DataBrowser';
import css from './DataGrid.module.scss';

export interface DataGridProps {
  /** Column definitions */
  columns: ColumnDef[];
  /** Records to display */
  records: Record<string, unknown>[];
  /** Set of selected record IDs */
  selectedRecords: Set<string>;
  /** Called when record selection changes */
  onSelectRecord: (recordId: string, selected: boolean) => void;
  /** Called when select all toggled */
  onSelectAll: (selected: boolean) => void;
  /** Called when cell value saved */
  onSaveCell: (recordId: string, field: string, value: unknown) => Promise<void>;
  /** Called when delete requested */
  onDeleteRecord: (recordId: string) => void;
}

/** System fields that are read-only */
const READ_ONLY_FIELDS = new Set(['id', 'createdAt', 'updatedAt']);

/**
 * Format a cell value for display
 */
function formatCellValue(value: unknown, type: string): string {
  if (value === null || value === undefined) return '';

  switch (type) {
    case 'Boolean':
      return value ? '✓' : '';
    case 'Date':
      try {
        return new Date(value as string).toLocaleString();
      } catch {
        return String(value);
      }
    case 'Object':
    case 'Array':
      return JSON.stringify(value);
    default:
      return String(value);
  }
}

/**
 * Get CSS class for type badge
 */
function getTypeBadgeClass(type: string): string {
  switch (type) {
    case 'String':
      return css.TypeString;
    case 'Number':
      return css.TypeNumber;
    case 'Boolean':
      return css.TypeBoolean;
    case 'Date':
      return css.TypeDate;
    case 'Object':
      return css.TypeObject;
    case 'Array':
      return css.TypeArray;
    case 'Pointer':
    case 'Relation':
      return css.TypePointer;
    default:
      return '';
  }
}

/**
 * DataGrid component
 */
export function DataGrid({
  columns,
  records,
  selectedRecords,
  onSelectRecord,
  onSelectAll,
  onSaveCell,
  onDeleteRecord
}: DataGridProps) {
  const [editingCell, setEditingCell] = useState<{ recordId: string; field: string } | null>(null);
  const [savingError, setSavingError] = useState<string | null>(null);

  // Check if all records are selected
  const allSelected = records.length > 0 && selectedRecords.size === records.length;

  // Handle cell click - start editing if editable
  const handleCellClick = useCallback((recordId: string, field: string) => {
    if (READ_ONLY_FIELDS.has(field)) return;
    setEditingCell({ recordId, field });
    setSavingError(null);
  }, []);

  // Handle save from CellEditor
  const handleSave = useCallback(
    async (recordId: string, field: string, value: unknown) => {
      try {
        await onSaveCell(recordId, field, value);
        setEditingCell(null);
        setSavingError(null);
      } catch (err) {
        setSavingError('Failed to save');
        // Don't close editor on error
      }
    },
    [onSaveCell]
  );

  // Handle cancel editing
  const handleCancel = useCallback(() => {
    setEditingCell(null);
    setSavingError(null);
  }, []);

  return (
    <div className={css.GridContainer}>
      <table className={css.Grid}>
        <thead>
          <tr>
            {/* Checkbox column */}
            <th className={css.CheckboxCol}>
              <input type="checkbox" checked={allSelected} onChange={(e) => onSelectAll(e.target.checked)} />
            </th>
            {/* Data columns */}
            {columns.map((col) => (
              <th key={col.name} className={css.HeaderCell}>
                <div className={css.HeaderContent}>
                  <span className={css.HeaderName}>{col.name}</span>
                  <span className={`${css.TypeBadge} ${getTypeBadgeClass(col.type)}`}>{col.type}</span>
                </div>
              </th>
            ))}
            {/* Actions column */}
            <th className={css.ActionsCol}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const recordId = record.id as string;
            const isSelected = selectedRecords.has(recordId);

            return (
              <tr key={recordId} className={isSelected ? css.SelectedRow : ''}>
                {/* Checkbox */}
                <td className={css.CheckboxCol}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => onSelectRecord(recordId, e.target.checked)}
                  />
                </td>
                {/* Data cells */}
                {columns.map((col) => {
                  const value = record[col.name];
                  const isEditing = editingCell?.recordId === recordId && editingCell?.field === col.name;
                  const isReadOnly = READ_ONLY_FIELDS.has(col.name);

                  return (
                    <td
                      key={col.name}
                      className={`${css.Cell} ${isReadOnly ? css.ReadOnlyCell : css.EditableCell}`}
                      onClick={() => !isEditing && handleCellClick(recordId, col.name)}
                    >
                      {isEditing ? (
                        <CellEditor
                          value={value}
                          type={col.type}
                          onSave={(newValue) => handleSave(recordId, col.name, newValue)}
                          onCancel={handleCancel}
                          error={savingError}
                        />
                      ) : (
                        <div className={css.CellValue} title={String(value ?? '')}>
                          {formatCellValue(value, col.type)}
                        </div>
                      )}
                    </td>
                  );
                })}
                {/* Actions */}
                <td className={css.ActionsCol}>
                  <IconButton icon={IconName.Trash} size={IconSize.Small} onClick={() => onDeleteRecord(recordId)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
