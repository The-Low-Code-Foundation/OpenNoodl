/**
 * UBA-003 / UBA-004: View layer — barrel export
 */

export { ConfigPanel } from './ConfigPanel';
export type { ConfigPanelProps } from './ConfigPanel';
export { ConfigSection, sectionHasErrors } from './ConfigSection';
export type { ConfigSectionProps } from './ConfigSection';
export { FieldRenderer } from './fields/FieldRenderer';
export type { FieldRendererProps } from './fields/FieldRenderer';
export { FieldWrapper } from './fields/FieldWrapper';
export type { FieldWrapperProps } from './fields/FieldWrapper';
export { useConfigForm, validateRequired, flatToNested } from './hooks/useConfigForm';
export type { ConfigFormState, FormValues, FormErrors } from './hooks/useConfigForm';
