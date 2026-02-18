/**
 * UBA-004: ConfigSection
 *
 * Renders a single schema section — header + all its fields.
 * Fields that fail their `visible_when` condition are omitted.
 * Fields that fail a dependency condition are rendered but disabled.
 *
 * Hidden via CSS (display:none) when `visible` is false so the section
 * stays mounted and preserves form values, but only the active tab is shown.
 */

import React from 'react';

import { evaluateCondition } from '../../models/UBA/Conditions';
import { Field, Section } from '../../models/UBA/types';
import css from './ConfigSection.module.scss';
import { FieldRenderer } from './fields/FieldRenderer';
import { FormErrors, FormValues } from './hooks/useConfigForm';

export interface ConfigSectionProps {
  section: Section;
  values: FormValues;
  errors: FormErrors;
  onChange: (path: string, value: unknown) => void;
  /** Whether this section's tab is currently active */
  visible: boolean;
  disabled?: boolean;
}

interface FieldVisibility {
  visible: boolean;
  /** If false, field is rendered but disabled */
  enabled: boolean;
}

/**
 * Evaluates field visibility + enabled state based on its conditions.
 * We don't have a full `depends_on` in the current type spec,
 * so we only handle `visible_when` here (enough for UBA-004 scope).
 */
function resolveFieldVisibility(field: Field, values: FormValues): FieldVisibility {
  const visible = evaluateCondition(field.visible_when, values as Record<string, unknown>);
  return { visible, enabled: visible };
}

/** Returns true if any errors exist for fields in this section */
export function sectionHasErrors(sectionId: string, errors: FormErrors): boolean {
  return Object.keys(errors).some((path) => path.startsWith(`${sectionId}.`));
}

export function ConfigSection({ section, values, errors, onChange, visible, disabled }: ConfigSectionProps) {
  return (
    <div className={css.section} style={visible ? undefined : { display: 'none' }} aria-hidden={!visible}>
      {(section.description || section.name) && (
        <div className={css.sectionHeader}>
          <h3 className={css.sectionTitle}>{section.name}</h3>
          {section.description && <p className={css.sectionDescription}>{section.description}</p>}
        </div>
      )}

      <div className={css.sectionFields}>
        {section.fields.map((field) => {
          const { visible: fieldVisible, enabled } = resolveFieldVisibility(field, values);

          if (!fieldVisible) return null;

          const path = `${section.id}.${field.id}`;

          return (
            <div key={field.id} className={`${css.fieldContainer}${!enabled ? ` ${css.disabled}` : ''}`}>
              <FieldRenderer
                field={field}
                value={values[path]}
                onChange={(value) => onChange(path, value)}
                error={errors[path]}
                disabled={disabled || !enabled}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
