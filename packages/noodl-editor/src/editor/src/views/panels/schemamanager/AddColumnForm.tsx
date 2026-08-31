/**
 * AddColumnForm
 *
 * Inline form for adding a new column to an existing table.
 * Also handles column renaming via inline edit.
 *
 * @module schemamanager/AddColumnForm
 * @since 1.2.0
 */

import React, { useCallback, useState } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton } from '@noodl-core-ui/components/inputs/IconButton';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import css from './AddColumnForm.module.scss';
import { validateColumnName } from './serverOwnedColumns';

const { ipcRenderer } = window.require('electron');

/** Supported column types */
const COLUMN_TYPES = ['String', 'Number', 'Boolean', 'Date', 'Object', 'Array'] as const;
type ColumnType = (typeof COLUMN_TYPES)[number];

export interface AddColumnFormProps {
  /** Backend ID */
  backendId: string;
  /** Table name */
  tableName: string;
  /** Existing column names (for validation) */
  existingColumns: string[];
  /** Called when column is added */
  onSuccess: () => void;
  /** Called when form is cancelled */
  onCancel: () => void;
}

/**
 * AddColumnForm component - inline form for adding columns
 */
export function AddColumnForm({ backendId, tableName, existingColumns, onSuccess, onCancel }: AddColumnFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ColumnType>('String');
  const [required, setRequired] = useState(false);
  const [defaultValue, setDefaultValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    setError(null);

    const nameError = validateColumnName(name, existingColumns, tableName);
    if (nameError) {
      setError(nameError);
      return;
    }

    const column = {
      name: name.trim(),
      type,
      required,
      defaultValue: defaultValue.trim() || undefined
    };

    setSaving(true);

    try {
      await ipcRenderer.invoke('backend:addColumn', backendId, tableName, column);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add column';
      setError(message);
      setSaving(false);
    }
  }, [backendId, tableName, name, type, required, defaultValue, existingColumns, onSuccess]);

  return (
    <div className={css.Root}>
      <div className={css.Row}>
        <div className={css.Field}>
          <input
            type="text"
            className={css.Input}
            placeholder="column_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className={css.Field}>
          <select className={css.Select} value={type} onChange={(e) => setType(e.target.value as ColumnType)}>
            {COLUMN_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className={css.FieldSmall}>
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
        </div>
        <div className={css.Field}>
          <input
            type="text"
            className={css.Input}
            placeholder="default"
            value={defaultValue}
            onChange={(e) => setDefaultValue(e.target.value)}
          />
        </div>
        <div className={css.Actions}>
          <PrimaryButton
            label={saving ? '...' : 'Add'}
            size={PrimaryButtonSize.Small}
            variant={PrimaryButtonVariant.Cta}
            onClick={handleSubmit}
            isDisabled={saving || !name.trim()}
          />
          <IconButton icon={IconName.Close} onClick={onCancel} />
        </div>
      </div>

      {error && (
        <div className={css.Error}>
          <Icon icon={IconName.WarningTriangle} size={IconSize.Tiny} />
          <Text textType={TextType.Default}>{error}</Text>
        </div>
      )}
    </div>
  );
}

/** Props for inline column rename */
export interface ColumnRenameProps {
  /** Backend ID */
  backendId: string;
  /** Table name */
  tableName: string;
  /** Current column name */
  columnName: string;
  /** Existing column names (for validation) */
  existingColumns: string[];
  /** Called when rename succeeds */
  onSuccess: () => void;
  /** Called when cancelled */
  onCancel: () => void;
}

/**
 * ColumnRenameInput - inline input for renaming a column
 */
export function ColumnRenameInput({
  backendId,
  tableName,
  columnName,
  existingColumns,
  onSuccess,
  onCancel
}: ColumnRenameProps) {
  const [newName, setNewName] = useState(columnName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    setError(null);

    // No change
    if (newName.trim() === columnName) {
      onCancel();
      return;
    }

    // Validate (exclude current name from existing list)
    const otherColumns = existingColumns.filter((c) => c !== columnName);
    const nameError = validateColumnName(newName, otherColumns);
    if (nameError) {
      setError(nameError);
      return;
    }

    setSaving(true);

    try {
      await ipcRenderer.invoke('backend:renameColumn', backendId, tableName, columnName, newName.trim());
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to rename column';
      setError(message);
      setSaving(false);
    }
  }, [backendId, tableName, columnName, newName, existingColumns, onSuccess, onCancel]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSubmit();
      } else if (e.key === 'Escape') {
        onCancel();
      }
    },
    [handleSubmit, onCancel]
  );

  return (
    <div className={css.RenameWrapper}>
      <input
        type="text"
        className={css.RenameInput}
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSubmit}
        autoFocus
        disabled={saving}
      />
      {error && <span className={css.RenameError}>{error}</span>}
    </div>
  );
}
