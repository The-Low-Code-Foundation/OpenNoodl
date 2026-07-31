/**
 * BYOB Filter Builder
 *
 * Main component for building Directus-compatible filters visually.
 * Includes JSON preview and the ability to edit JSON directly.
 */

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';

import { IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton, IconButtonVariant } from '@noodl-core-ui/components/inputs/IconButton';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import css from './ByobFilterBuilder.module.scss';
import { DragProvider } from './DragContext';
import { FilterGroup } from './FilterGroup';
import { ByobFilterBuilderProps, createEmptyFilterGroup, FilterGroup as FilterGroupType, SchemaField } from './types';

/**
 * Ref interface for imperative access to ByobFilterBuilder
 * Used by FilterBuilderModal to save pending JSON edits before closing
 */
export interface ByobFilterBuilderRef {
  /**
   * If JSON edit mode is active, saves the current JSON text.
   * Returns the saved filter if successful, or null if not in edit mode or invalid.
   */
  saveJsonIfEditing: () => FilterGroupType | null;
}

/**
 * Convert filter to JSON string for display/editing (internal format)
 * This preserves IDs and structure so edits can be saved correctly
 */
function filterToJsonString(filter: FilterGroupType | null, pretty = true): string {
  if (!filter) return '';
  return JSON.stringify(filter, null, pretty ? 2 : 0);
}

/**
 * Parse JSON string to filter model (internal format)
 * Validates the structure has the required fields
 */
function jsonStringToFilter(json: string): FilterGroupType | null {
  try {
    const parsed = JSON.parse(json);
    // Validate it has the required structure
    if (parsed && typeof parsed === 'object' && 'id' in parsed && 'type' in parsed && 'conditions' in parsed) {
      if ((parsed.type === 'and' || parsed.type === 'or') && Array.isArray(parsed.conditions)) {
        // Recursively validate conditions
        if (validateFilterGroup(parsed)) {
          return parsed as FilterGroupType;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Validate a filter group structure recursively
 */
function validateFilterGroup(group: unknown): boolean {
  if (!group || typeof group !== 'object') return false;

  const g = group as Record<string, unknown>;
  if (!g.id || !g.type || !Array.isArray(g.conditions)) return false;
  if (g.type !== 'and' && g.type !== 'or') return false;

  // Validate each condition
  for (const item of g.conditions) {
    if (!item || typeof item !== 'object') return false;
    const i = item as Record<string, unknown>;
    if (!i.id) return false;

    // Is it a group?
    if ('conditions' in i) {
      if (!validateFilterGroup(i)) return false;
    } else {
      // It's a condition - must have field and operator. A relation rule names
      // no field, so it is validated on carrying its relation instead; without
      // this, hand-editing the JSON of a relation filter rejects it silently.
      if (i.kind === 'relation') {
        if (!('relationClass' in i) && !('relationProperty' in i)) return false;
      } else if (!('field' in i) || !('operator' in i)) {
        return false;
      }
    }
  }

  return true;
}

export const ByobFilterBuilder = forwardRef<ByobFilterBuilderRef, ByobFilterBuilderProps>(function ByobFilterBuilder(
  { value, schema, onChange, capabilities, valuePortPrefix },
  ref
) {
  // Initialize filter state
  const [filter, setFilter] = useState<FilterGroupType>(() => {
    return value || createEmptyFilterGroup();
  });

  // Show/hide JSON preview
  const [showJson, setShowJson] = useState(false);

  // JSON editing mode
  const [jsonEditMode, setJsonEditMode] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Expose imperative methods via ref
  useImperativeHandle(
    ref,
    () => ({
      saveJsonIfEditing: (): FilterGroupType | null => {
        if (jsonEditMode) {
          try {
            const parsed = jsonStringToFilter(jsonText);
            if (parsed) {
              setFilter(parsed);
              onChange(parsed);
              setJsonEditMode(false);
              setJsonError(null);
              return parsed;
            }
          } catch {
            // Invalid JSON - return null
          }
        }
        return null;
      }
    }),
    [jsonEditMode, jsonText, onChange]
  );

  // Sync external value changes
  useEffect(() => {
    if (value) {
      setFilter(value);
    }
  }, [value]);

  // Update JSON text when filter changes
  useEffect(() => {
    if (!jsonEditMode) {
      setJsonText(filterToJsonString(filter));
    }
  }, [filter, jsonEditMode]);

  // Handle filter changes from visual builder
  const handleFilterChange = useCallback(
    (newFilter: FilterGroupType) => {
      setFilter(newFilter);
      onChange(newFilter);
    },
    [onChange]
  );

  // Toggle JSON preview
  const handleToggleJson = useCallback(() => {
    setShowJson((prev) => !prev);
    setJsonEditMode(false);
    setJsonError(null);
  }, []);

  // Enter JSON edit mode
  const handleEditJson = useCallback(() => {
    setJsonEditMode(true);
    setJsonText(filterToJsonString(filter));
    setJsonError(null);
  }, [filter]);

  // Save JSON edits
  const handleSaveJson = useCallback(() => {
    try {
      const parsed = jsonStringToFilter(jsonText);
      if (parsed) {
        setFilter(parsed);
        onChange(parsed);
        setJsonEditMode(false);
        setJsonError(null);
      } else {
        setJsonError('Invalid filter JSON structure');
      }
    } catch (e) {
      setJsonError('Invalid JSON syntax');
    }
  }, [jsonText, onChange]);

  // Cancel JSON edits
  const handleCancelJson = useCallback(() => {
    setJsonEditMode(false);
    setJsonText(filterToJsonString(filter));
    setJsonError(null);
  }, [filter]);

  // Copy JSON to clipboard
  const handleCopyJson = useCallback(() => {
    const json = filterToJsonString(filter);
    navigator.clipboard.writeText(json).catch(console.error);
  }, [filter]);

  // Get fields from schema
  const fields: SchemaField[] = schema?.fields || [];

  return (
    <div className={css.ByobFilterBuilder}>
      {/* Header */}
      <div className={css.ByobFilterBuilderHeader}>
        <Text textType={TextType.DefaultContrast}>Filter Conditions</Text>
        <div className={css.ByobFilterBuilderActions}>
          <IconButton
            icon={IconName.Code}
            size={IconSize.Small}
            variant={showJson ? IconButtonVariant.Default : IconButtonVariant.Transparent}
            onClick={handleToggleJson}
          />
        </div>
      </div>

      {/* Visual Filter Builder - Wrapped in DragProvider for drag & drop */}
      <DragProvider rootFilter={filter} onFilterChange={handleFilterChange}>
        <div className={css.ByobFilterBuilderContent}>
          <FilterGroup
            group={filter}
            fields={fields}
            onChange={handleFilterChange}
            isRoot={true}
            capabilities={capabilities}
            valuePortPrefix={valuePortPrefix}
            relations={schema?.relations}
          />
        </div>
      </DragProvider>

      {/* JSON Preview Panel */}
      {showJson && (
        <div className={css.ByobFilterBuilderJson}>
          <div className={css.ByobFilterBuilderJsonHeader}>
            <Text textType={TextType.Shy}>Filter JSON (editable)</Text>
            <div className={css.ByobFilterBuilderJsonActions}>
              {!jsonEditMode ? (
                <>
                  <IconButton
                    icon={IconName.Copy}
                    size={IconSize.Small}
                    variant={IconButtonVariant.Transparent}
                    onClick={handleCopyJson}
                  />
                  <IconButton
                    icon={IconName.Pencil}
                    size={IconSize.Small}
                    variant={IconButtonVariant.Transparent}
                    onClick={handleEditJson}
                  />
                </>
              ) : (
                <>
                  <IconButton
                    icon={IconName.Check}
                    size={IconSize.Small}
                    variant={IconButtonVariant.Transparent}
                    onClick={handleSaveJson}
                  />
                  <IconButton
                    icon={IconName.Close}
                    size={IconSize.Small}
                    variant={IconButtonVariant.Transparent}
                    onClick={handleCancelJson}
                  />
                </>
              )}
            </div>
          </div>

          {jsonError && (
            <Box hasXSpacing={2} hasYSpacing={1}>
              <span className={css.ByobFilterBuilderJsonError}>{jsonError}</span>
            </Box>
          )}

          {jsonEditMode ? (
            <textarea
              className={css.ByobFilterBuilderJsonEditor}
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              spellCheck={false}
            />
          ) : (
            <pre className={css.ByobFilterBuilderJsonPreview}>{jsonText || '(empty filter)'}</pre>
          )}
        </div>
      )}
    </div>
  );
});

// Export for module
export default ByobFilterBuilder;
