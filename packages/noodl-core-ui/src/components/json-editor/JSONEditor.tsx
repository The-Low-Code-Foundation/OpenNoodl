/**
 * JSONEditor Component
 *
 * A modern, dual-mode JSON editor with:
 * - Easy Mode: Visual tree builder (no-code friendly)
 * - Advanced Mode: Text editor with validation
 *
 * @module json-editor
 */

import React, { useState, useEffect, useMemo } from 'react';

import css from './JSONEditor.module.scss';
import { AdvancedMode } from './modes/AdvancedMode/AdvancedMode';
import { EasyMode } from './modes/EasyMode/EasyMode';
import { validateJSON } from './utils/jsonValidator';
import { valueToTreeNode, treeNodeToValue } from './utils/treeConverter';
import { JSONEditorProps, EditorMode, JSONTreeNode } from './utils/types';

/**
 * Main JSONEditor Component
 */
export function JSONEditor({
  value,
  onChange,
  onSave,
  defaultMode = 'easy',
  mode: forcedMode,
  expectedType = 'any',
  disabled = false,
  height,
  placeholder,
  transformForMode
}: JSONEditorProps) {
  // Current editor mode
  const [currentMode, setCurrentMode] = useState<EditorMode>(forcedMode || defaultMode);

  // Internal JSON string state
  const [jsonString, setJsonString] = useState<string>(() => {
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return expectedType === 'array' ? '[]' : '{}';
    }
  });

  // Sync with external value changes
  useEffect(() => {
    if (typeof value === 'string') {
      setJsonString(value);
    } else {
      try {
        setJsonString(JSON.stringify(value, null, 2));
      } catch {
        // Invalid value, keep current
      }
    }
  }, [value]);

  // Parse JSON to tree node for Easy Mode
  const treeNode: JSONTreeNode | null = useMemo(() => {
    try {
      const parsed = JSON.parse(jsonString || (expectedType === 'array' ? '[]' : '{}'));
      return valueToTreeNode(parsed);
    } catch {
      // Invalid JSON - return empty structure
      return valueToTreeNode(expectedType === 'array' ? [] : {});
    }
  }, [jsonString, expectedType]);

  // Validate current JSON
  const validation = useMemo(() => {
    return validateJSON(jsonString, expectedType);
  }, [jsonString, expectedType]);

  // Handle mode toggle
  const handleModeChange = (newMode: EditorMode) => {
    if (forcedMode) return; // Can't change if forced
    setCurrentMode(newMode);

    // The host may spell the same value differently per mode — see `transformForMode`. Emitted
    // through `onChange` as well as stored, or the host would save the pre-switch spelling.
    if (transformForMode) {
      const respelled = transformForMode(jsonString, newMode);
      if (respelled !== jsonString) {
        setJsonString(respelled);
        onChange(respelled);
      }
    }

    // Save preference to localStorage
    try {
      localStorage.setItem('json-editor-preferred-mode', newMode);
    } catch {
      // Ignore storage errors
    }
  };

  // Handle tree changes from Easy Mode
  const handleTreeChange = (newNode: JSONTreeNode) => {
    try {
      const newValue = treeNodeToValue(newNode);
      const newJson = JSON.stringify(newValue, null, 2);
      setJsonString(newJson);
      onChange(newJson);
    } catch (error) {
      console.error('Failed to convert tree to JSON:', error);
    }
  };

  // Handle text changes from Advanced Mode
  const handleTextChange = (newText: string) => {
    setJsonString(newText);
    onChange(newText);
  };

  // Container style
  const containerStyle: React.CSSProperties = {
    height: height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : '400px'
  };

  return (
    <div className={css['Root']} style={containerStyle}>
      {/* Header with mode toggle */}
      <div className={css['Header']}>
        <div className={css['Title']}>JSON Editor</div>
        {!forcedMode && (
          <div className={css['ModeToggle']}>
            <button
              className={currentMode === 'easy' ? css['Active'] : ''}
              onClick={() => handleModeChange('easy')}
              disabled={disabled}
            >
              Easy
            </button>
            <button
              className={currentMode === 'advanced' ? css['Active'] : ''}
              onClick={() => handleModeChange('advanced')}
              disabled={disabled}
            >
              Advanced
            </button>
          </div>
        )}
      </div>

      {/* Validation Status */}
      {!validation.valid && (
        <div className={css['ValidationError']}>
          <div className={css['ErrorIcon']}>⚠️</div>
          <div className={css['ErrorContent']}>
            <div className={css['ErrorMessage']}>{validation.error}</div>
            {validation.suggestion && <div className={css['ErrorSuggestion']}>💡 {validation.suggestion}</div>}
          </div>
        </div>
      )}

      {/* Editor Content */}
      <div className={css['EditorContent']}>
        {currentMode === 'easy' ? (
          <EasyMode rootNode={treeNode!} onChange={handleTreeChange} disabled={disabled} />
        ) : (
          <AdvancedMode value={jsonString} onChange={handleTextChange} disabled={disabled} />
        )}
      </div>
    </div>
  );
}
