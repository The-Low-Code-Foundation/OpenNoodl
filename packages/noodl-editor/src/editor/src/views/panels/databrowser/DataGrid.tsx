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

import { ACL_COLUMN_TYPE, describeAcl, formatAclCell } from './acl';
import { CellEditor } from './CellEditor';
import { ColumnDef } from './DataBrowser';
import css from './DataGrid.module.scss';
import { stripIpcErrorPrefix } from './schemaFailure';

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

/**
 * System fields that are read-only.
 *
 * POL-014: the record's primary key is `objectId` — that is what the backend
 * stores, what `/api/:collection` returns, and what every write channel names
 * (`backend:saveRecord(id, collection, objectId, data)`). This grid used to read
 * `record.id`, which no row carries.
 */
const READ_ONLY_FIELDS = new Set(['objectId', 'createdAt', 'updatedAt']);

/** Which cell, if any, is being edited. */
export interface EditingCell {
  recordId: string;
  field: string;
}

/**
 * The identity of a row, or `undefined` when the record has none.
 *
 * Exported and separate from the render so it can be tested without React
 * infra, which this repo's editor suite does not have (see
 * `tests/sidepanel/hideTransitions.spec.ts` for the same shape).
 */
export function recordKey(record: Record<string, unknown>): string | undefined {
  const key = record.objectId;
  return typeof key === 'string' && key.length > 0 ? key : undefined;
}

/**
 * Whether this cell is the one being edited.
 *
 * The `recordId == null` arm is the whole point: comparing two absent ids with
 * `===` says *true*, so a grid whose records carry no identity opened an editor
 * in every row on a single click (POL-014, consequence 3). An unidentified row
 * is never the edited one.
 */
export function isCellEditing(editing: EditingCell | null, recordId: string | undefined, field: string): boolean {
  if (recordId == null || editing == null) return false;
  return editing.recordId === recordId && editing.field === field;
}

/**
 * Format a cell value for display
 */
export function formatCellValue(value: unknown, type: string): string {
  // The ACL is the one column where *absent* has to be rendered, not left
  // blank: no ACL means public and `{}` means nobody, and a blank cell would
  // read as either (SPR-001/F84).
  if (type === ACL_COLUMN_TYPE) return formatAclCell(value);

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
    case ACL_COLUMN_TYPE:
      return css.TypeAcl;
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
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [savingError, setSavingError] = useState<string | null>(null);

  // Check if all records are selected
  const allSelected = records.length > 0 && selectedRecords.size === records.length;

  // Handle cell click - start editing if editable
  const handleCellClick = useCallback((recordId: string | undefined, field: string) => {
    if (READ_ONLY_FIELDS.has(field)) return;
    if (recordId == null) return; // a row with no identity cannot be edited
    setEditingCell({ recordId, field });
    setSavingError(null);
  }, []);

  // Handle save from CellEditor
  const handleSave = useCallback(
    async (recordId: string | undefined, field: string, value: unknown) => {
      if (recordId == null) return; // unreachable while an editor only opens on an identified row
      try {
        await onSaveCell(recordId, field, value);
        setEditingCell(null);
        setSavingError(null);
      } catch (err) {
        // SPR-001/F84: say what the backend said. This was a flat "Failed to
        // save", which throws away the only useful sentence in the failure —
        // `Invalid ACL: ACL flag alice.read must be a boolean` — and leaves an
        // editable ACL cell with no way to learn why an edit was refused. The
        // message arrives wrapped in Electron's IPC framing, hence the strip.
        const detail = stripIpcErrorPrefix(err instanceof Error ? err.message : String(err));
        setSavingError(detail || 'Failed to save');
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
          {records.map((record, rowIndex) => {
            const recordId = recordKey(record);
            const isSelected = recordId != null && selectedRecords.has(recordId);

            return (
              // `rowIndex` only backs up a missing key; with `objectId` present it is
              // never reached. Before POL-014 the key was `undefined` for every row,
              // which is what React was warning about on every load.
              <tr key={recordId ?? `row-${rowIndex}`} className={isSelected ? css.SelectedRow : ''}>
                {/* Checkbox */}
                <td className={css.CheckboxCol}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={recordId == null}
                    onChange={(e) => recordId != null && onSelectRecord(recordId, e.target.checked)}
                  />
                </td>
                {/* Data cells */}
                {columns.map((col) => {
                  const value = record[col.name];
                  const isEditing = isCellEditing(editingCell, recordId, col.name);
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
                        <div
                          className={css.CellValue}
                          // The ACL's tooltip is the answer to F84's question,
                          // in words — `[object Object]` was what `String()`
                          // made of it.
                          title={col.type === ACL_COLUMN_TYPE ? describeAcl(value) : String(value ?? '')}
                        >
                          {formatCellValue(value, col.type)}
                        </div>
                      )}
                    </td>
                  );
                })}
                {/* Actions */}
                <td className={css.ActionsCol}>
                  <IconButton
                    icon={IconName.Trash}
                    size={IconSize.Small}
                    isDisabled={recordId == null}
                    onClick={() => recordId != null && onDeleteRecord(recordId)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
