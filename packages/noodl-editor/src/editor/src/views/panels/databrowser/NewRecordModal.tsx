/**
 * NewRecordModal
 *
 * Modal dialog for creating a new record with type-aware form fields.
 *
 * @module panels/databrowser/NewRecordModal
 * @since 1.2.0
 */

import React, { useCallback, useState } from 'react';

import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { ColumnDef } from './DataBrowser';
import css from './NewRecordModal.module.scss';

const { ipcRenderer } = window.require('electron');

export interface NewRecordModalProps {
  /** Backend ID */
  backendId: string;
  /** Table name */
  tableName: string;
  /** Column definitions */
  columns: ColumnDef[];
  /** Called when modal closed */
  onClose: () => void;
  /** Called when record created */
  onSuccess: () => void;
}

/**
 * Get default value for a column type
 */
function getDefaultValue(type: string): unknown {
  switch (type) {
    case 'Boolean':
      return false;
    case 'Number':
      return 0;
    case 'Object':
      return {};
    case 'Array':
      return [];
    default:
      return '';
  }
}

/**
 * NewRecordModal component
 */
export function NewRecordModal({ backendId, tableName, columns, onClose, onSuccess }: NewRecordModalProps) {
  // Initialize form state with default values
  const [formData, setFormData] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    columns.forEach((col) => {
      initial[col.name] = col.default !== undefined ? col.default : getDefaultValue(col.type);
    });
    return initial;
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle field change
  const handleChange = useCallback((field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }, []);

  // Handle form submit
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Validate required fields
      for (const col of columns) {
        if (col.required) {
          const value = formData[col.name];
          if (value === null || value === undefined || value === '') {
            setError(`${col.name} is required`);
            return;
          }
        }
      }

      setSaving(true);
      setError(null);

      try {
        await ipcRenderer.invoke('backend:createRecord', backendId, tableName, formData);
        onSuccess();
      } catch (err) {
        console.error('Failed to create record:', err);
        setError('Failed to create record');
      } finally {
        setSaving(false);
      }
    },
    [backendId, tableName, formData, columns, onSuccess]
  );

  // Render form field based on type
  const renderField = (col: ColumnDef) => {
    const value = formData[col.name];

    switch (col.type) {
      case 'Boolean':
        return (
          <input type="checkbox" checked={value === true} onChange={(e) => handleChange(col.name, e.target.checked)} />
        );

      case 'Number':
        return (
          <input
            type="number"
            className={css.Input}
            value={String(value ?? '')}
            onChange={(e) => handleChange(col.name, e.target.value ? parseFloat(e.target.value) : null)}
            step="any"
          />
        );

      case 'Date':
        return (
          <input
            type="datetime-local"
            className={css.Input}
            value={value ? new Date(value as string).toISOString().slice(0, 16) : ''}
            onChange={(e) => handleChange(col.name, e.target.value ? new Date(e.target.value).toISOString() : null)}
          />
        );

      case 'Object':
      case 'Array':
        return (
          <textarea
            className={css.JsonInput}
            value={typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '')}
            onChange={(e) => {
              try {
                handleChange(col.name, JSON.parse(e.target.value));
              } catch {
                // Keep as string while editing, parse on blur
              }
            }}
            rows={3}
            spellCheck={false}
            placeholder={col.type === 'Array' ? '[]' : '{}'}
          />
        );

      default:
        // String
        return (
          <input
            type="text"
            className={css.Input}
            value={String(value ?? '')}
            onChange={(e) => handleChange(col.name, e.target.value)}
            placeholder={`Enter ${col.name}...`}
          />
        );
    }
  };

  return (
    <div className={css.Overlay} onClick={onClose}>
      <div className={css.Modal} onClick={(e) => e.stopPropagation()}>
        <div className={css.Header}>
          <Text textType={TextType.DefaultContrast}>New Record in {tableName}</Text>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={css.Content}>
            {columns.length === 0 ? (
              <Text textType={TextType.Shy}>No columns defined for this table</Text>
            ) : (
              columns.map((col) => (
                <div key={col.name} className={css.Field}>
                  <label className={css.Label}>
                    {col.name}
                    {col.required && <span className={css.Required}>*</span>}
                    <span className={css.TypeHint}>{col.type}</span>
                  </label>
                  {renderField(col)}
                </div>
              ))
            )}

            {error && (
              <div className={css.Error}>
                <Text textType={TextType.Default}>{error}</Text>
              </div>
            )}
          </div>

          <div className={css.Footer}>
            <PrimaryButton
              label="Cancel"
              size={PrimaryButtonSize.Small}
              variant={PrimaryButtonVariant.Muted}
              onClick={onClose}
            />
            <PrimaryButton
              label={saving ? 'Creating...' : 'Create Record'}
              size={PrimaryButtonSize.Small}
              isDisabled={saving || columns.length === 0}
              onClick={handleSubmit}
            />
          </div>
        </form>
      </div>
    </div>
  );
}
