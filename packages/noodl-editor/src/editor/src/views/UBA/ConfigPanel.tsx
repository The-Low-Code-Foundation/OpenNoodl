/**
 * UBA-004: ConfigPanel
 *
 * Top-level panel that renders a UBASchema as a tabbed configuration form.
 * Tabs = sections; fields rendered by ConfigSection.
 *
 * Usage:
 *   <ConfigPanel
 *     schema={parsedSchema}
 *     initialValues={savedConfig}
 *     onSave={async (values) => { await pushToBackend(values); }}
 *   />
 */

import React, { useState } from 'react';

import { evaluateCondition } from '../../models/UBA/Conditions';
import { UBASchema } from '../../models/UBA/types';
import css from './ConfigPanel.module.scss';
import { ConfigSection, sectionHasErrors } from './ConfigSection';
import { flatToNested, useConfigForm, validateRequired } from './hooks/useConfigForm';

export interface ConfigPanelProps {
  schema: UBASchema;
  /** Previously saved config values (flat-path or nested object) */
  initialValues?: Record<string, unknown>;
  /** Called with a nested-object representation of the form on save */
  onSave: (values: Record<string, unknown>) => Promise<void>;
  onReset?: () => void;
  disabled?: boolean;
}

export function ConfigPanel({ schema, initialValues, onSave, onReset, disabled }: ConfigPanelProps) {
  const { values, errors, isDirty, setValue, setErrors, reset } = useConfigForm(schema, initialValues);

  const [activeSection, setActiveSection] = useState<string>(schema.sections[0]?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Filter to sections whose visible_when is met
  const visibleSections = schema.sections.filter((section) =>
    evaluateCondition(section.visible_when, values as Record<string, unknown>)
  );

  // Ensure active tab stays valid if sections change
  const validActive = visibleSections.find((s) => s.id === activeSection)?.id ?? visibleSections[0]?.id ?? '';

  const handleSave = async () => {
    // Synchronous required-field validation
    const validationErrors = validateRequired(schema, values);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      // Switch to first tab with an error
      const firstErrorSection = schema.sections.find((s) =>
        Object.keys(validationErrors).some((p) => p.startsWith(`${s.id}.`))
      );
      if (firstErrorSection) setActiveSection(firstErrorSection.id);
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      await onSave(flatToNested(values));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    reset();
    setSaveError(null);
    onReset?.();
  };

  return (
    <div className={css.configPanel}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className={css.header}>
        <div className={css.headerInfo}>
          <h2 className={css.headerName}>{schema.backend.name}</h2>
          <p className={css.headerMeta}>
            v{schema.backend.version}
            {schema.backend.description ? ` · ${schema.backend.description}` : ''}
          </p>
        </div>

        <div className={css.headerActions}>
          <button
            type="button"
            className={css.resetButton}
            onClick={handleReset}
            disabled={!isDirty || saving || disabled}
            title="Reset to saved values"
          >
            Reset
          </button>
          <button
            type="button"
            className={css.saveButton}
            onClick={handleSave}
            disabled={!isDirty || saving || disabled}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* ── Save error banner ───────────────────────────────────────────── */}
      {saveError && (
        <div className={css.saveError} role="alert">
          {saveError}
        </div>
      )}

      {/* ── Section tabs ────────────────────────────────────────────────── */}
      {visibleSections.length > 1 && (
        <div className={css.sectionTabs} role="tablist">
          {visibleSections.map((section) => {
            const hasErrors = sectionHasErrors(section.id, errors);
            return (
              <button
                key={section.id}
                type="button"
                role="tab"
                aria-selected={validActive === section.id}
                className={`${css.tab}${validActive === section.id ? ` ${css.active}` : ''}`}
                onClick={() => setActiveSection(section.id)}
              >
                {section.name}
                {hasErrors && <span className={css.tabErrorDot} aria-label="has errors" />}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Section content ─────────────────────────────────────────────── */}
      <div className={css.sectionContent}>
        {visibleSections.length === 0 ? (
          <div className={css.emptyState}>No configuration sections available.</div>
        ) : (
          visibleSections.map((section) => (
            <ConfigSection
              key={section.id}
              section={section}
              values={values}
              errors={errors}
              onChange={setValue}
              visible={validActive === section.id}
              disabled={disabled || saving}
            />
          ))
        )}
      </div>
    </div>
  );
}
