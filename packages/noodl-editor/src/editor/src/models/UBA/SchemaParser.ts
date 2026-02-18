/**
 * UBA-002: SchemaParser
 *
 * Validates an unknown (already-parsed) object against the UBA schema v1.0
 * shape and returns a strongly-typed ParseResult<UBASchema>.
 *
 * Design: accepts a pre-parsed object rather than a raw YAML/JSON string.
 * The calling layer (BackendDiscovery, AddBackendDialog) is responsible for
 * deserialising the text.  This keeps the parser 100% dep-free and testable.
 *
 * Validation is intentional-but-not-exhaustive:
 *   - Required fields are checked; extra unknown keys are allowed (forward compat)
 *   - Field array entries are validated individually; partial errors are collected
 *   - Warnings are issued for deprecated or advisory patterns
 */

import type {
  AuthConfig,
  BackendMetadata,
  BaseField,
  BooleanField,
  Capabilities,
  Condition,
  DebugField,
  DebugSchema,
  Endpoints,
  Field,
  MultiSelectField,
  NumberField,
  ParseError,
  ParseResult,
  SecretField,
  Section,
  SelectField,
  SelectOption,
  StringField,
  TextField,
  UBASchema,
  UrlField
} from './types';

// ─── Public API ───────────────────────────────────────────────────────────────

export class SchemaParser {
  /**
   * Validate a pre-parsed object as a UBASchema.
   *
   * @param data - Already-parsed JavaScript object (from JSON.parse or yaml.load)
   */
  parse(data: unknown): ParseResult<UBASchema> {
    const errors: ParseError[] = [];
    const warnings: string[] = [];

    if (!isObject(data)) {
      return { success: false, errors: [{ path: '', message: 'Schema must be an object' }] };
    }

    // schema_version
    if (!isString(data['schema_version'])) {
      errors.push({
        path: 'schema_version',
        message: 'Required string field "schema_version" is missing or not a string'
      });
    } else {
      const [major] = (data['schema_version'] as string).split('.');
      if (major !== '1') {
        warnings.push(
          `schema_version "${data['schema_version']}" — only v1.x is supported; proceeding with best-effort parsing`
        );
      }
    }

    // backend
    const backendErrors: ParseError[] = [];
    const backend = parseBackendMetadata(data['backend'], backendErrors);
    errors.push(...backendErrors);

    // sections
    const sectionsErrors: ParseError[] = [];
    const sections = parseSections(data['sections'], sectionsErrors, warnings);
    errors.push(...sectionsErrors);

    // debug (optional)
    let debugSchema: DebugSchema | undefined;
    if (data['debug'] !== undefined) {
      const debugErrors: ParseError[] = [];
      debugSchema = parseDebugSchema(data['debug'], debugErrors);
      errors.push(...debugErrors);
    }

    if (errors.length > 0) {
      return { success: false, errors, ...(warnings.length > 0 ? { warnings } : {}) };
    }

    const schema: UBASchema = {
      schema_version: data['schema_version'] as string,
      backend: backend!,
      sections: sections ?? [],
      ...(debugSchema ? { debug: debugSchema } : {})
    };

    return {
      success: true,
      data: schema,
      ...(warnings.length > 0 ? { warnings } : {})
    };
  }
}

// ─── Internal validators ──────────────────────────────────────────────────────

function parseBackendMetadata(raw: unknown, errors: ParseError[]): BackendMetadata | undefined {
  if (!isObject(raw)) {
    errors.push({ path: 'backend', message: 'Required object "backend" is missing or not an object' });
    return undefined;
  }

  const requiredStrings = ['id', 'name', 'version'] as const;
  for (const key of requiredStrings) {
    if (!isString(raw[key])) {
      errors.push({ path: `backend.${key}`, message: `Required string "backend.${key}" is missing` });
    }
  }

  const endpointErrors: ParseError[] = [];
  const endpoints = parseEndpoints(raw['endpoints'], endpointErrors);
  errors.push(...endpointErrors);

  let auth: AuthConfig | undefined;
  if (raw['auth'] !== undefined) {
    if (!isObject(raw['auth'])) {
      errors.push({ path: 'backend.auth', message: '"backend.auth" must be an object' });
    } else {
      const validTypes = ['none', 'bearer', 'api_key', 'basic'];
      if (!validTypes.includes(raw['auth']['type'] as string)) {
        errors.push({
          path: 'backend.auth.type',
          message: `"backend.auth.type" must be one of: ${validTypes.join(', ')}`
        });
      } else {
        auth = { type: raw['auth']['type'] as AuthConfig['type'] };
        if (isString(raw['auth']['header'])) auth.header = raw['auth']['header'] as string;
      }
    }
  }

  let capabilities: Capabilities | undefined;
  if (isObject(raw['capabilities'])) {
    capabilities = {};
    if (typeof raw['capabilities']['hot_reload'] === 'boolean')
      capabilities.hot_reload = raw['capabilities']['hot_reload'] as boolean;
    if (typeof raw['capabilities']['debug'] === 'boolean') capabilities.debug = raw['capabilities']['debug'] as boolean;
    if (typeof raw['capabilities']['batch_config'] === 'boolean')
      capabilities.batch_config = raw['capabilities']['batch_config'] as boolean;
  }

  if (errors.some((e) => e.path.startsWith('backend'))) return undefined;

  return {
    id: raw['id'] as string,
    name: raw['name'] as string,
    version: raw['version'] as string,
    ...(isString(raw['description']) ? { description: raw['description'] as string } : {}),
    ...(isString(raw['icon']) ? { icon: raw['icon'] as string } : {}),
    ...(isString(raw['homepage']) ? { homepage: raw['homepage'] as string } : {}),
    endpoints: endpoints!,
    ...(auth ? { auth } : {}),
    ...(capabilities ? { capabilities } : {})
  };
}

function parseEndpoints(raw: unknown, errors: ParseError[]): Endpoints | undefined {
  if (!isObject(raw)) {
    errors.push({ path: 'backend.endpoints', message: 'Required object "backend.endpoints" is missing' });
    return undefined;
  }
  if (!isString(raw['config'])) {
    errors.push({ path: 'backend.endpoints.config', message: 'Required string "backend.endpoints.config" is missing' });
    return undefined;
  }
  return {
    config: raw['config'] as string,
    ...(isString(raw['health']) ? { health: raw['health'] as string } : {}),
    ...(isString(raw['debug_stream']) ? { debug_stream: raw['debug_stream'] as string } : {})
  };
}

function parseSections(raw: unknown, errors: ParseError[], warnings: string[]): Section[] {
  if (!Array.isArray(raw)) {
    errors.push({ path: 'sections', message: 'Required array "sections" is missing or not an array' });
    return [];
  }

  return raw
    .map((item: unknown, i: number): Section | null => {
      if (!isObject(item)) {
        errors.push({ path: `sections[${i}]`, message: `Section at index ${i} must be an object` });
        return null;
      }
      if (!isString(item['id'])) {
        errors.push({ path: `sections[${i}].id`, message: `sections[${i}].id is required and must be a string` });
      }
      if (!isString(item['name'])) {
        errors.push({ path: `sections[${i}].name`, message: `sections[${i}].name is required and must be a string` });
      }
      if (errors.some((e) => e.path === `sections[${i}].id` || e.path === `sections[${i}].name`)) {
        return null;
      }

      const fieldErrors: ParseError[] = [];
      const fields = parseFields(item['fields'], `sections[${i}]`, fieldErrors, warnings);
      errors.push(...fieldErrors);

      return {
        id: item['id'] as string,
        name: item['name'] as string,
        ...(isString(item['description']) ? { description: item['description'] as string } : {}),
        ...(isString(item['icon']) ? { icon: item['icon'] as string } : {}),
        ...(typeof item['collapsed'] === 'boolean' ? { collapsed: item['collapsed'] as boolean } : {}),
        ...(item['visible_when'] ? { visible_when: item['visible_when'] as Condition } : {}),
        fields
      };
    })
    .filter((s): s is Section => s !== null);
}

function parseFields(raw: unknown, path: string, errors: ParseError[], warnings: string[]): Field[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item: unknown, i: number): Field | null => {
      if (!isObject(item)) {
        errors.push({ path: `${path}.fields[${i}]`, message: `Field at index ${i} must be an object` });
        return null;
      }

      const fieldPath = `${path}.fields[${i}]`;
      if (!isString(item['id'])) {
        errors.push({ path: `${fieldPath}.id`, message: `${fieldPath}.id is required` });
        return null;
      }
      if (!isString(item['name'])) {
        errors.push({ path: `${fieldPath}.name`, message: `${fieldPath}.name is required` });
        return null;
      }

      const base: BaseField = {
        id: item['id'] as string,
        name: item['name'] as string,
        ...(isString(item['description']) ? { description: item['description'] as string } : {}),
        ...(typeof item['required'] === 'boolean' ? { required: item['required'] as boolean } : {}),
        ...(item['visible_when'] ? { visible_when: item['visible_when'] as Condition } : {})
      };

      const type = item['type'] as string;
      switch (type) {
        case 'string':
          return {
            ...base,
            type: 'string',
            ...(isString(item['placeholder']) ? { placeholder: item['placeholder'] as string } : {}),
            ...(isString(item['default']) ? { default: item['default'] as string } : {})
          } as StringField;
        case 'text':
          return {
            ...base,
            type: 'text',
            ...(isString(item['placeholder']) ? { placeholder: item['placeholder'] as string } : {}),
            ...(isString(item['default']) ? { default: item['default'] as string } : {}),
            ...(typeof item['rows'] === 'number' ? { rows: item['rows'] as number } : {})
          } as TextField;
        case 'number':
          return {
            ...base,
            type: 'number',
            ...(typeof item['default'] === 'number' ? { default: item['default'] as number } : {}),
            ...(typeof item['min'] === 'number' ? { min: item['min'] as number } : {}),
            ...(typeof item['max'] === 'number' ? { max: item['max'] as number } : {})
          } as NumberField;
        case 'boolean':
          return {
            ...base,
            type: 'boolean',
            ...(typeof item['default'] === 'boolean' ? { default: item['default'] as boolean } : {})
          } as BooleanField;
        case 'secret':
          return {
            ...base,
            type: 'secret',
            ...(isString(item['placeholder']) ? { placeholder: item['placeholder'] as string } : {})
          } as SecretField;
        case 'url':
          return {
            ...base,
            type: 'url',
            ...(isString(item['placeholder']) ? { placeholder: item['placeholder'] as string } : {}),
            ...(isString(item['default']) ? { default: item['default'] as string } : {})
          } as UrlField;
        case 'select': {
          if (!Array.isArray(item['options'])) {
            errors.push({
              path: `${fieldPath}.options`,
              message: `select field "${base.id}" requires an "options" array`
            });
            return null;
          }
          const options = (item['options'] as unknown[]).map((o) =>
            isObject(o)
              ? ({ value: String(o['value'] ?? ''), label: String(o['label'] ?? '') } as SelectOption)
              : { value: '', label: '' }
          );
          return {
            ...base,
            type: 'select',
            options,
            ...(isString(item['default']) ? { default: item['default'] as string } : {})
          } as SelectField;
        }
        case 'multi_select': {
          if (!Array.isArray(item['options'])) {
            errors.push({
              path: `${fieldPath}.options`,
              message: `multi_select field "${base.id}" requires an "options" array`
            });
            return null;
          }
          const options = (item['options'] as unknown[]).map((o) =>
            isObject(o)
              ? ({ value: String(o['value'] ?? ''), label: String(o['label'] ?? '') } as SelectOption)
              : { value: '', label: '' }
          );
          return { ...base, type: 'multi_select', options } as MultiSelectField;
        }
        default:
          warnings.push(`Unknown field type "${type}" at ${fieldPath} — skipping`);
          return null;
      }
    })
    .filter((f): f is Field => f !== null);
}

function parseDebugSchema(raw: unknown, errors: ParseError[]): DebugSchema | undefined {
  if (!isObject(raw)) {
    errors.push({ path: 'debug', message: '"debug" must be an object' });
    return undefined;
  }
  const enabled = typeof raw['enabled'] === 'boolean' ? (raw['enabled'] as boolean) : true;
  const eventSchema: DebugField[] = Array.isArray(raw['event_schema'])
    ? (raw['event_schema'] as unknown[]).filter(isObject).map((f) => ({
        id: String(f['id'] ?? ''),
        name: String(f['name'] ?? ''),
        type: (['string', 'number', 'boolean', 'json'].includes(f['type'] as string)
          ? f['type']
          : 'string') as DebugField['type'],
        ...(isString(f['description']) ? { description: f['description'] as string } : {})
      }))
    : [];
  return { enabled, ...(eventSchema.length > 0 ? { event_schema: eventSchema } : {}) };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}
