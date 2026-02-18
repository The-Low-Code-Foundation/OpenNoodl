/**
 * UBA-001 / UBA-002: Universal Backend Adapter — TypeScript type definitions
 *
 * These types mirror the UBA schema specification v1.0. The SchemaParser
 * validates an unknown object against these shapes and returns a typed result.
 *
 * Design notes:
 * - Field types use a discriminated union on `type` so exhaustive switch()
 *   statements work correctly in renderers.
 * - Optional fields are marked `?` — do NOT add runtime defaults here;
 *   defaults are handled by the UI layer (buildInitialValues in ConfigPanel).
 * - All arrays that could be omitted in the schema default to `[]` in the
 *   parsed output (see SchemaParser.normalise).
 */

// ─── Schema Root ─────────────────────────────────────────────────────────────

export interface UBASchema {
  schema_version: string;
  backend: BackendMetadata;
  sections: Section[];
  debug?: DebugSchema;
}

// ─── Backend Metadata ────────────────────────────────────────────────────────

export interface BackendMetadata {
  id: string;
  name: string;
  description?: string;
  version: string;
  icon?: string;
  homepage?: string;
  endpoints: Endpoints;
  auth?: AuthConfig;
  capabilities?: Capabilities;
}

export interface Endpoints {
  config: string;
  health?: string;
  debug_stream?: string;
}

export interface AuthConfig {
  type: 'none' | 'bearer' | 'api_key' | 'basic';
  header?: string;
}

export interface Capabilities {
  hot_reload?: boolean;
  debug?: boolean;
  batch_config?: boolean;
}

// ─── Sections ────────────────────────────────────────────────────────────────

export interface Section {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  collapsed?: boolean;
  visible_when?: Condition;
  fields: Field[];
}

// ─── Conditions ──────────────────────────────────────────────────────────────

export interface Condition {
  /** e.g. "auth.type" */
  field: string;
  /** e.g. "=" | "!=" | "in" | "not_in" */
  operator: '=' | '!=' | 'in' | 'not_in' | 'exists' | 'not_exists';
  value?: string | string[] | boolean | number;
}

// ─── Field Discriminated Union ───────────────────────────────────────────────

export type Field =
  | StringField
  | TextField
  | NumberField
  | BooleanField
  | SecretField
  | UrlField
  | SelectField
  | MultiSelectField;

/** Common base shared by all field types */
export interface BaseField {
  /** Unique identifier within the section */
  id: string;
  /** Display label */
  name: string;
  description?: string;
  required?: boolean;
  visible_when?: Condition;
  ui?: UIHints;
}

export interface UIHints {
  help_link?: string;
  placeholder?: string;
  width?: 'full' | 'half' | 'third';
  monospace?: boolean;
}

// ─── Concrete Field Types ────────────────────────────────────────────────────

export interface StringField extends BaseField {
  type: 'string';
  placeholder?: string;
  default?: string;
  validation?: StringValidation;
}

export interface StringValidation {
  min_length?: number;
  max_length?: number;
  pattern?: string;
  pattern_message?: string;
}

export interface TextField extends BaseField {
  type: 'text';
  placeholder?: string;
  default?: string;
  rows?: number;
  validation?: StringValidation;
}

export interface NumberField extends BaseField {
  type: 'number';
  placeholder?: string;
  default?: number;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
}

export interface BooleanField extends BaseField {
  type: 'boolean';
  default?: boolean;
  /** Text shown next to the toggle */
  toggle_label?: string;
}

export interface SecretField extends BaseField {
  type: 'secret';
  placeholder?: string;
  /** If true, disable copy-paste on the masked input */
  no_paste?: boolean;
}

export interface UrlField extends BaseField {
  type: 'url';
  placeholder?: string;
  default?: string;
  /** Restrict to specific protocols, e.g. ['https', 'wss'] */
  protocols?: string[];
}

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface SelectField extends BaseField {
  type: 'select';
  options: SelectOption[];
  default?: string;
}

export interface MultiSelectField extends BaseField {
  type: 'multi_select';
  options: SelectOption[];
  default?: string[];
  max_selections?: number;
}

// ─── Debug Schema ────────────────────────────────────────────────────────────

export interface DebugSchema {
  enabled: boolean;
  event_schema?: DebugField[];
}

export interface DebugField {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
}

// ─── Parser Result Types ──────────────────────────────────────────────────────

export type ParseResult<T> =
  | { success: true; data: T; warnings?: string[] }
  | { success: false; errors: ParseError[]; warnings?: string[] };

export interface ParseError {
  path: string;
  message: string;
}
