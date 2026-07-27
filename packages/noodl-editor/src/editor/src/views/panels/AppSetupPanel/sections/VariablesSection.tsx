import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigVariable, ConfigType, RESERVED_CONFIG_KEYS } from '@noodl/runtime/src/config/types';

import { JSONEditor } from '@noodl-core-ui/components/json-editor';
import { PropertyPanelTextInput } from '@noodl-core-ui/components/property-panel/PropertyPanelTextInput';
import { CollapsableSection } from '@noodl-core-ui/components/sidebar/CollapsableSection';
import { PanelRow } from '@noodl-core-ui/components/sidebar/PanelRow';

import PopupLayer from '../../../popuplayer';
import css from './sections.module.scss';

interface VariablesSectionProps {
  variables: ConfigVariable[];
  onChange: (variables: ConfigVariable[]) => void;
}

// Separate component for JSON editor button that manages its own ref
interface JSONEditorButtonProps {
  value: string;
  varType: 'array' | 'object';
  onSave: (value: string) => void;
}

function JSONEditorButton({ value, varType, onSave }: JSONEditorButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoutRef = useRef<any>(null);
  const rootRef = useRef<any>(null);

  // Cleanup editor on unmount
  useEffect(() => {
    return () => {
      if (rootRef.current) {
        rootRef.current.unmount();
        rootRef.current = null;
      }
      if (popoutRef.current) {
        popoutRef.current = null;
      }
    };
  }, []);

  const openEditor = () => {
    if (!buttonRef.current) {
      return;
    }

    // Close any existing editor
    if (rootRef.current) {
      rootRef.current.unmount();
      rootRef.current = null;
    }

    // Create popup container
    const popupDiv = document.createElement('div');
    const root = createRoot(popupDiv);
    rootRef.current = root;

    // Track current value for save
    let currentValue = value;

    const handleChange = (newValue: string) => {
      currentValue = newValue;
    };

    const handleClose = () => {
      try {
        // Parse and validate before saving
        const parsed = JSON.parse(currentValue);
        if (varType === 'array' && !Array.isArray(parsed)) {
          return;
        }
        if (varType === 'object' && (typeof parsed !== 'object' || Array.isArray(parsed))) {
          return;
        }
        onSave(currentValue);
      } catch {
        // Invalid JSON - don't save
      }

      root.unmount();
      rootRef.current = null;
    };

    root.render(
      <div style={{ padding: '16px', width: '600px', height: '500px', display: 'flex', flexDirection: 'column' }}>
        <JSONEditor value={value} onChange={handleChange} expectedType={varType} height="100%" />
      </div>
    );

    const popout = PopupLayer.instance.showPopout({
      content: { el: popupDiv },
      attachTo: buttonRef.current,
      position: 'right',
      onClose: handleClose
    });

    popoutRef.current = popout;
  };

  return (
    <button
      ref={buttonRef}
      onClick={(e) => {
        e.stopPropagation();
        openEditor();
      }}
      style={{
        width: '100%',
        padding: '10px',
        fontSize: '13px',
        fontFamily: 'monospace',
        backgroundColor: 'var(--theme-color-bg-3)',
        border: '1px solid var(--theme-color-border-default)',
        borderRadius: '4px',
        color: 'var(--theme-color-fg-default)',
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}
    >
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          color: 'var(--theme-color-fg-muted)'
        }}
      >
        {value || (varType === 'array' ? '[]' : '{}')}
      </span>
      <span style={{ marginLeft: '8px', color: 'var(--theme-color-primary)' }}>Edit JSON ➜</span>
    </button>
  );
}

const ALL_TYPES = [
  { value: 'string' as const, label: 'String' },
  { value: 'number' as const, label: 'Number' },
  { value: 'boolean' as const, label: 'Boolean' },
  { value: 'color' as const, label: 'Color' },
  { value: 'array' as const, label: 'Array' },
  { value: 'object' as const, label: 'Object' }
];

export function VariablesSection({ variables, onChange }: VariablesSectionProps) {
  // Local state for optimistic updates
  const [localVariables, setLocalVariables] = useState<ConfigVariable[]>(variables);
  const [isAdding, setIsAdding] = useState(false);

  // Sync with props when they change externally
  useEffect(() => {
    setLocalVariables(variables);
  }, [variables]);

  // New variable form state
  const [newKey, setNewKey] = useState('');
  const [newType, setNewType] = useState<ConfigType>('string');
  const [newValue, setNewValue] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [error, setError] = useState('');
  const [jsonError, setJsonError] = useState('');

  const validateKey = (key: string, excludeIndex?: number): string | null => {
    if (!key.trim()) {
      return 'Key is required';
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      return 'Key must start with letter or underscore, and contain only letters, numbers, and underscores';
    }

    if (RESERVED_CONFIG_KEYS.includes(key as (typeof RESERVED_CONFIG_KEYS)[number])) {
      return `"${key}" is a reserved key`;
    }

    const isDuplicate = localVariables.some((v, index) => v.key === key && index !== excludeIndex);
    if (isDuplicate) {
      return `Key "${key}" already exists`;
    }

    return null;
  };

  const parseValue = (type: ConfigType, valueStr: string): unknown => {
    if (type === 'string') return valueStr;
    if (type === 'number') {
      const num = Number(valueStr);
      return isNaN(num) ? 0 : num;
    }
    if (type === 'boolean') return valueStr === 'true';
    if (type === 'color') return valueStr || '#000000';
    if (type === 'array') {
      try {
        const parsed = JSON.parse(valueStr || '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    if (type === 'object') {
      try {
        const parsed = JSON.parse(valueStr || '{}');
        return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      } catch {
        return {};
      }
    }
    return valueStr;
  };

  const serializeValue = (variable: ConfigVariable): string => {
    if (variable.type === 'string') return String(variable.value || '');
    if (variable.type === 'number') return String(variable.value || 0);
    if (variable.type === 'boolean') return String(variable.value);
    if (variable.type === 'color') return String(variable.value || '#000000');
    if (variable.type === 'array' || variable.type === 'object') {
      try {
        return JSON.stringify(variable.value, null, 2);
      } catch {
        return variable.type === 'array' ? '[]' : '{}';
      }
    }
    return String(variable.value || '');
  };

  const handleAdd = () => {
    const keyError = validateKey(newKey);
    if (keyError) {
      setError(keyError);
      return;
    }

    // Validate JSON for array/object types
    if ((newType === 'array' || newType === 'object') && newValue) {
      try {
        JSON.parse(newValue);
        setJsonError('');
      } catch {
        setJsonError('Invalid JSON');
        return;
      }
    }

    const newVariable: ConfigVariable = {
      key: newKey.trim(),
      type: newType,
      value: parseValue(newType, newValue),
      description: newDescription.trim() || undefined,
      category: newCategory.trim() || undefined
    };

    // Update local state immediately (optimistic update)
    const updated = [...localVariables, newVariable];
    setLocalVariables(updated);

    // Persist in background
    onChange(updated);

    // Reset form
    setNewKey('');
    setNewType('string');
    setNewValue('');
    setNewDescription('');
    setNewCategory('');
    setError('');
    setJsonError('');
    setIsAdding(false);
  };

  const handleUpdate = (index: number, updates: Partial<ConfigVariable>) => {
    // Update local state immediately (optimistic update)
    const updated = [...localVariables];
    updated[index] = { ...updated[index], ...updates };
    setLocalVariables(updated);

    // Persist in background
    onChange(updated);
  };

  const handleDelete = (index: number) => {
    // Update local state immediately (optimistic update)
    const updated = localVariables.filter((_, i) => i !== index);
    setLocalVariables(updated);

    // Persist in background
    onChange(updated);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setNewKey('');
    setNewType('string');
    setNewValue('');
    setNewDescription('');
    setNewCategory('');
    setError('');
    setJsonError('');
  };

  // Returns an element rather than a `ReactNode` so it satisfies core-ui's
  // `Slot`, which deliberately excludes bare numbers.
  const renderValueInput = (type: ConfigType, value: string, onValueChange: (v: string) => void): JSX.Element => {
    if (type === 'boolean') {
      return (
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontSize: '13px',
            color: 'var(--theme-color-fg-default)'
          }}
        >
          <input
            type="checkbox"
            checked={value === 'true'}
            onChange={(e) => onValueChange(e.target.checked ? 'true' : 'false')}
            style={{
              width: '16px',
              height: '16px',
              cursor: 'pointer'
            }}
          />
          Enabled
        </label>
      );
    }

    if (type === 'number') {
      return (
        <input
          type="number"
          className={css.NumberInput}
          value={value || ''}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder="0"
        />
      );
    }

    if (type === 'color') {
      return (
        <div className={css.ColourField}>
          <input
            type="color"
            aria-label="Colour swatch"
            className={css.ColourSwatch}
            value={value || '#000000'}
            onChange={(e) => onValueChange(e.target.value)}
          />
          <div className={css.ColourText}>
            <PropertyPanelTextInput value={value || '#000000'} onChange={onValueChange} />
          </div>
        </div>
      );
    }

    if (type === 'array' || type === 'object') {
      return (
        <JSONEditorButton
          value={value || (type === 'array' ? '[]' : '{}')}
          varType={type}
          onSave={(newValue) => {
            onValueChange(newValue);
            setJsonError('');
          }}
        />
      );
    }

    return <PropertyPanelTextInput value={value} onChange={onValueChange} />;
  };

  // Group variables by category
  const groupedVariables: { [category: string]: ConfigVariable[] } = {};
  localVariables.forEach((variable) => {
    const cat = variable.category || 'Uncategorized';
    if (!groupedVariables[cat]) {
      groupedVariables[cat] = [];
    }
    groupedVariables[cat].push(variable);
  });

  const categories = Object.keys(groupedVariables).sort((a, b) => {
    // Uncategorized always first
    if (a === 'Uncategorized') return -1;
    if (b === 'Uncategorized') return 1;
    return a.localeCompare(b);
  });

  return (
    <CollapsableSection title="Custom Variables" hasGutter hasVisibleOverflow hasTopDivider>
      <div
        style={{
          fontSize: '11px',
          color: 'var(--theme-color-fg-muted)',
          marginBottom: '12px'
        }}
      >
        Define custom config variables accessible via Noodl.Config.get(&apos;key&apos;)
      </div>

      {/* Add Variable Button + Clear All */}
      {!isAdding && (
        <div className={css.ButtonRow}>
          <button
            onClick={() => setIsAdding(true)}
            style={{
              padding: '8px',
              fontSize: '13px',
              fontWeight: 500,
              backgroundColor: 'var(--theme-color-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            + Add Variable
          </button>
          {localVariables.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm(`Delete all ${localVariables.length} variables?`)) {
                  setLocalVariables([]);
                  onChange([]);
                }
              }}
              style={{
                padding: '8px 12px',
                fontSize: '13px',
                fontWeight: 500,
                backgroundColor: 'var(--theme-color-danger)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Clear All
            </button>
          )}
        </div>
      )}

      {/* Add Variable Form */}
      {isAdding && (
        <div
          style={{
            padding: '12px',
            marginBottom: '12px',
            backgroundColor: 'var(--theme-color-bg-2)',
            border: '1px solid var(--theme-color-border-default)',
            borderRadius: '4px'
          }}
        >
          <PanelRow label="Key *">
            <PropertyPanelTextInput
              value={newKey}
              onChange={(value) => {
                setNewKey(value);
                setError('');
              }}
            />
          </PanelRow>

          <PanelRow label="Type" htmlFor="app-setup-variable-type">
            <select
              id="app-setup-variable-type"
              className={css.NativeSelect}
              value={newType}
              onChange={(e) => {
                const newT = e.target.value as ConfigType;
                setNewType(newT);
                // Set appropriate default values
                if (newT === 'boolean') setNewValue('false');
                else if (newT === 'number') setNewValue('0');
                else if (newT === 'color') setNewValue('#000000');
                else if (newT === 'array') setNewValue('[]');
                else if (newT === 'object') setNewValue('{}');
                else setNewValue('');
                setJsonError('');
              }}
            >
              {ALL_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </PanelRow>

          <PanelRow label="Value">{renderValueInput(newType, newValue, setNewValue)}</PanelRow>

          <PanelRow label="Category" helpText="Optional. Groups the variable in this list.">
            <PropertyPanelTextInput value={newCategory} onChange={setNewCategory} />
          </PanelRow>

          <PanelRow label="Description">
            <PropertyPanelTextInput value={newDescription} onChange={setNewDescription} />
          </PanelRow>

          {error && (
            <div
              style={{
                padding: '8px',
                marginBottom: '8px',
                fontSize: '12px',
                color: 'var(--theme-color-error)',
                backgroundColor: 'var(--theme-color-error-bg)',
                border: '1px solid var(--theme-color-error)',
                borderRadius: '4px'
              }}
            >
              {error}
            </div>
          )}

          {jsonError && (
            <div
              style={{
                padding: '8px',
                marginBottom: '8px',
                fontSize: '12px',
                color: 'var(--theme-color-error)',
                backgroundColor: 'var(--theme-color-error-bg)',
                border: '1px solid var(--theme-color-error)',
                borderRadius: '4px'
              }}
            >
              {jsonError}
            </div>
          )}

          <div className={css.ButtonRow}>
            <button
              onClick={handleAdd}
              disabled={!!error || !!jsonError}
              style={{
                padding: '8px',
                fontSize: '13px',
                fontWeight: 500,
                backgroundColor: error || jsonError ? 'var(--theme-color-bg-3)' : 'var(--theme-color-primary)',
                color: error || jsonError ? 'var(--theme-color-fg-muted)' : 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: error || jsonError ? 'not-allowed' : 'pointer'
              }}
            >
              Add
            </button>
            <button
              onClick={handleCancel}
              style={{
                padding: '8px',
                fontSize: '13px',
                fontWeight: 500,
                backgroundColor: 'var(--theme-color-bg-3)',
                color: 'var(--theme-color-fg-default)',
                border: '1px solid var(--theme-color-border-default)',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Variables List - Grouped by Category */}
      {localVariables.length === 0 && !isAdding && (
        <div
          style={{
            padding: '16px',
            textAlign: 'center',
            fontSize: '13px',
            color: 'var(--theme-color-fg-muted)',
            backgroundColor: 'var(--theme-color-bg-2)',
            border: '1px dashed var(--theme-color-border-default)',
            borderRadius: '4px'
          }}
        >
          No variables defined yet
        </div>
      )}

      {categories.map((category) => (
        <div key={category} style={{ marginBottom: '16px' }}>
          {categories.length > 1 && (
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                color: 'var(--theme-color-fg-muted)',
                marginBottom: '8px',
                letterSpacing: '0.5px'
              }}
            >
              {category}
            </div>
          )}

          {groupedVariables[category].map((variable) => {
            const index = localVariables.indexOf(variable);
            return (
              <div key={index} className={css.VariableCard}>
                <div className={css.VariableHeader}>
                  <div className={css.VariableIdentity}>
                    <span className={css.VariableKey} title={variable.key}>
                      {variable.key}
                    </span>
                    <span className={css.VariableType}>{variable.type}</span>
                  </div>
                  <button
                    onClick={() => handleDelete(index)}
                    title="Delete variable"
                    style={{
                      padding: '4px 10px',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      backgroundColor: 'var(--theme-color-danger)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      minWidth: '28px',
                      lineHeight: 1
                    }}
                  >
                    ✕
                  </button>
                </div>

                <PanelRow label="Value" helpText={variable.description || undefined}>
                  {renderValueInput(variable.type, serializeValue(variable), (value) =>
                    handleUpdate(index, { value: parseValue(variable.type, value) })
                  )}
                </PanelRow>
              </div>
            );
          })}
        </div>
      ))}
    </CollapsableSection>
  );
}
