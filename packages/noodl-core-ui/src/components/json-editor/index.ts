/**
 * JSON Editor Component
 *
 * Public exports for the JSON Editor component.
 *
 * @module json-editor
 */

export { JSONEditor } from './JSONEditor';
export type { JSONEditorProps, EditorMode, JSONValueType, ValidationResult } from './utils/types';
export { validateJSON, formatJSON, isValidJSON } from './utils/jsonValidator';
