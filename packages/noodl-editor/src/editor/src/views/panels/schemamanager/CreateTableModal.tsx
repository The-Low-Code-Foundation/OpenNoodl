/**
 * CreateTableModal
 *
 * Modal for creating a new database table with columns.
 *
 * @module schemamanager/CreateTableModal
 * @since 1.2.0
 */

import React, { useCallback, useState } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton } from '@noodl-core-ui/components/inputs/IconButton';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { HStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import css from './CreateTableModal.module.scss';

const { ipcRenderer } = window.require('electron');

/** Supported column types */
const COLUMN_TYPES = ['String', 'Number', 'Boolean', 'Date', 'Object', 'Array'] as const;
type ColumnType = (typeof COLUMN_TYPES)[number];

/** SQLite reserved words to prevent as table names */
const SQLITE_RESERVED = [
  'ABORT',
  'ACTION',
  'ADD',
  'ALL',
  'ALTER',
  'AND',
  'AS',
  'ASC',
  'AUTOINCREMENT',
  'BETWEEN',
  'BY',
  'CASCADE',
  'CASE',
  'CHECK',
  'COLLATE',
  'COLUMN',
  'COMMIT',
  'CONFLICT',
  'CONSTRAINT',
  'CREATE',
  'CROSS',
  'DATABASE',
  'DEFAULT',
  'DELETE',
  'DESC',
  'DISTINCT',
  'DROP',
  'ELSE',
  'END',
  'ESCAPE',
  'EXCEPT',
  'EXISTS',
  'FOREIGN',
  'FROM',
  'GROUP',
  'HAVING',
  'IN',
  'INDEX',
  'INNER',
  'INSERT',
  'INTERSECT',
  'INTO',
  'IS',
  'ISNULL',
  'JOIN',
  'KEY',
  'LEFT',
  'LIKE',
  'LIMIT',
  'NATURAL',
  'NOT',
  'NOTNULL',
  'NULL',
  'ON',
  'OR',
  'ORDER',
  'OUTER',
  'PRIMARY',
  'REFERENCES',
  'REPLACE',
  'RIGHT',
  'ROLLBACK',
  'SELECT',
  'SET',
  'TABLE',
  'THEN',
  'TO',
  'TRANSACTION',
  'UNION',
  'UNIQUE',
  'UPDATE',
  'USING',
  'VALUES',
  'WHEN',
  'WHERE'
];

/** Column definition in the form */
interface ColumnDef {
  id: string;
  name: string;
  type: ColumnType;
  required: boolean;
  defaultValue: string;
}

export interface CreateTableModalProps {
  /** Backend ID */
  backendId: string;
  /** Callback when modal should close */
  onClose: () => void;
  /** Callback when table is created */
  onSuccess: () => void;
}

/**
 * Validate table name
 */
function validateTableName(name: string): string | null {
  if (!name.trim()) {
    return 'Table name is required';
  }
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
    return 'Must start with letter, only alphanumeric and underscore';
  }
  if (SQLITE_RESERVED.includes(name.toUpperCase())) {
    return `"${name}" is a reserved word`;
  }
  if (name.length > 64) {
    return 'Name too long (max 64 characters)';
  }
  return null;
}

/**
 * Validate column name
 */
function validateColumnName(name: string, existingNames: string[]): string | null {
  if (!name.trim()) {
    return 'Column name is required';
  }
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
    return 'Invalid column name';
  }
  if (['objectId', 'createdAt', 'updatedAt', 'ACL'].includes(name)) {
    return 'Reserved column name';
  }
  if (existingNames.includes(name)) {
    return 'Duplicate column name';
  }
  return null;
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * CreateTableModal component
 */
export function CreateTableModal({ backendId, onClose, onSuccess }: CreateTableModalProps) {
  // State
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState<ColumnDef[]>([
    { id: generateId(), name: '', type: 'String', required: false, defaultValue: '' }
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add a new column
  const handleAddColumn = useCallback(() => {
    setColumns((prev) => [...prev, { id: generateId(), name: '', type: 'String', required: false, defaultValue: '' }]);
  }, []);

  // Remove a column
  const handleRemoveColumn = useCallback((id: string) => {
    setColumns((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // Update a column field
  const handleUpdateColumn = useCallback((id: string, field: keyof ColumnDef, value: string | boolean) => {
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    setError(null);

    // Validate table name
    const tableNameError = validateTableName(tableName);
    if (tableNameError) {
      setError(tableNameError);
      return;
    }

    // Filter out empty columns and validate remaining
    const validColumns = columns.filter((c) => c.name.trim());
    const columnNames: string[] = [];

    for (const col of validColumns) {
      const colError = validateColumnName(col.name, columnNames);
      if (colError) {
        setError(`Column "${col.name}": ${colError}`);
        return;
      }
      columnNames.push(col.name);
    }

    // Build schema
    const tableSchema = {
      name: tableName.trim(),
      columns: validColumns.map((col) => ({
        name: col.name.trim(),
        type: col.type,
        required: col.required,
        defaultValue: col.defaultValue.trim() || undefined
      }))
    };

    setSaving(true);

    try {
      await ipcRenderer.invoke('backend:createTable', backendId, tableSchema);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create table';
      setError(message);
      setSaving(false);
    }
  }, [backendId, tableName, columns, onSuccess]);

  // Handle Enter key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && e.metaKey) {
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className={css.Overlay} onClick={onClose}>
      <div className={css.Modal} onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        {/* Header */}
        <div className={css.Header}>
          <Text textType={TextType.Proud}>Create New Table</Text>
          <IconButton icon={IconName.Close} onClick={onClose} />
        </div>

        {/* Content */}
        <div className={css.Content}>
          {/* Table Name */}
          <div className={css.Section}>
            <Text textType={TextType.DefaultContrast}>Table Name</Text>
            <input
              type="text"
              className={css.Input}
              placeholder="e.g., Products, Users, Orders"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Columns */}
          <div className={css.Section}>
            <HStack UNSAFE_style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Text textType={TextType.DefaultContrast}>Fields</Text>
              <PrimaryButton
                label="+ Add Field"
                size={PrimaryButtonSize.Small}
                variant={PrimaryButtonVariant.Ghost}
                onClick={handleAddColumn}
              />
            </HStack>

            <div className={css.ColumnsTable}>
              {/* Header */}
              <div className={css.ColumnRow}>
                <div className={css.ColName}>Name</div>
                <div className={css.ColType}>Type</div>
                <div className={css.ColRequired}>Required</div>
                <div className={css.ColDefault}>Default</div>
                <div className={css.ColActions}></div>
              </div>

              {/* System columns (info only) */}
              <div className={css.ColumnRow} data-system="true">
                <div className={css.ColName}>
                  <Text textType={TextType.Shy}>objectId</Text>
                </div>
                <div className={css.ColType}>
                  <Text textType={TextType.Shy}>String</Text>
                </div>
                <div className={css.ColRequired}>
                  <Text textType={TextType.Shy}>✓</Text>
                </div>
                <div className={css.ColDefault}>
                  <Text textType={TextType.Shy}>auto</Text>
                </div>
                <div className={css.ColActions}></div>
              </div>
              <div className={css.ColumnRow} data-system="true">
                <div className={css.ColName}>
                  <Text textType={TextType.Shy}>createdAt</Text>
                </div>
                <div className={css.ColType}>
                  <Text textType={TextType.Shy}>Date</Text>
                </div>
                <div className={css.ColRequired}>
                  <Text textType={TextType.Shy}>✓</Text>
                </div>
                <div className={css.ColDefault}>
                  <Text textType={TextType.Shy}>auto</Text>
                </div>
                <div className={css.ColActions}></div>
              </div>
              <div className={css.ColumnRow} data-system="true">
                <div className={css.ColName}>
                  <Text textType={TextType.Shy}>updatedAt</Text>
                </div>
                <div className={css.ColType}>
                  <Text textType={TextType.Shy}>Date</Text>
                </div>
                <div className={css.ColRequired}>
                  <Text textType={TextType.Shy}>✓</Text>
                </div>
                <div className={css.ColDefault}>
                  <Text textType={TextType.Shy}>auto</Text>
                </div>
                <div className={css.ColActions}></div>
              </div>

              {/* User columns */}
              {columns.map((col) => (
                <div key={col.id} className={css.ColumnRow}>
                  <div className={css.ColName}>
                    <input
                      type="text"
                      className={css.ColumnInput}
                      placeholder="field_name"
                      value={col.name}
                      onChange={(e) => handleUpdateColumn(col.id, 'name', e.target.value)}
                    />
                  </div>
                  <div className={css.ColType}>
                    <select
                      className={css.TypeSelect}
                      value={col.type}
                      onChange={(e) => handleUpdateColumn(col.id, 'type', e.target.value)}
                    >
                      {COLUMN_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={css.ColRequired}>
                    <input
                      type="checkbox"
                      checked={col.required}
                      onChange={(e) => handleUpdateColumn(col.id, 'required', e.target.checked)}
                    />
                  </div>
                  <div className={css.ColDefault}>
                    <input
                      type="text"
                      className={css.ColumnInput}
                      placeholder={col.type === 'Boolean' ? 'true/false' : ''}
                      value={col.defaultValue}
                      onChange={(e) => handleUpdateColumn(col.id, 'defaultValue', e.target.value)}
                    />
                  </div>
                  <div className={css.ColActions}>
                    <IconButton
                      icon={IconName.Trash}
                      onClick={() => handleRemoveColumn(col.id)}
                      UNSAFE_style={{ opacity: columns.length === 1 ? 0.3 : 1 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className={css.Error}>
              <Icon icon={IconName.WarningTriangle} size={IconSize.Tiny} />
              <Text textType={TextType.Default}>{error}</Text>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={css.Footer}>
          <PrimaryButton
            label="Cancel"
            size={PrimaryButtonSize.Small}
            variant={PrimaryButtonVariant.Muted}
            onClick={onClose}
          />
          <PrimaryButton
            label={saving ? 'Creating...' : 'Create Table'}
            size={PrimaryButtonSize.Small}
            variant={PrimaryButtonVariant.Cta}
            onClick={handleSubmit}
            isDisabled={saving || !tableName.trim()}
          />
        </div>
      </div>
    </div>
  );
}
