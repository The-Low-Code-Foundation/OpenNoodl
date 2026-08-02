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

/** ERG-003: the storage-format boundary for the four list-shaped port types. */
export {
  expectedTypeFor,
  decodeForEditor,
  encodeFromEditor,
  decodeStringList,
  encodeStringList,
  decodePropList,
  encodePropList
} from './utils/listValueCodec';
export type { ListPortType, PropListEntry, DecodeResult, EncodeResult } from './utils/listValueCodec';
