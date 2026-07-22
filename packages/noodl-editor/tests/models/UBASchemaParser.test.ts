/**
 * UBA-002: Unit tests for SchemaParser
 *
 * Tests run against pure JS objects (no YAML parsing needed).
 * Covers: happy path, required field errors, optional fields,
 * field type validation, warnings for unknown types/versions.
 */


import { SchemaParser } from '../../src/editor/src/models/UBA/SchemaParser';
import type { ParseResult } from '../../src/editor/src/models/UBA/types';

/** Type guard: narrows ParseResult to the failure branch (webpack ts-loader friendly) */
function isFailure<T>(result: ParseResult<T>): result is Extract<ParseResult<T>, { success: false }> {
  return !result.success;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const minimalValid = {
  schema_version: '1.0',
  backend: {
    id: 'test-backend',
    name: 'Test Backend',
    version: '1.0.0',
    endpoints: {
      config: 'https://example.com/config'
    }
  },
  sections: []
};

function makeValid(overrides: Record<string, unknown> = {}) {
  return { ...minimalValid, ...overrides };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SchemaParser', () => {
  let parser: SchemaParser;

  beforeEach(() => {
    parser = new SchemaParser();
  });

  // ─── Root validation ───────────────────────────────────────────────────────

  describe('root validation', () => {
    it('rejects null input', () => {
      const result = parser.parse(null);
      expect(result.success).toBe(false);
      if (isFailure(result)) {
        expect(result.errors[0].path).toBe('');
      }
    });

    it('rejects array input', () => {
      const result = parser.parse([]);
      expect(result.success).toBe(false);
    });

    it('rejects missing schema_version', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { schema_version: _, ...noVersion } = minimalValid;
      const result = parser.parse(noVersion);
      expect(result.success).toBe(false);
      if (isFailure(result)) {
        expect(result.errors.some((e) => e.path === 'schema_version')).toBe(true);
      }
    });

    it('warns on unknown major version', () => {
      const result = parser.parse(makeValid({ schema_version: '2.0' }));
      // Should still succeed (best-effort) but include a warning
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.warnings?.some((w) => w.includes('2.0'))).toBe(true);
      }
    });

    it('accepts a minimal valid schema', () => {
      const result = parser.parse(minimalValid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.schema_version).toBe('1.0');
        expect(result.data.backend.id).toBe('test-backend');
        expect(result.data.sections).toEqual([]);
      }
    });
  });

  // ─── Backend validation ────────────────────────────────────────────────────

  describe('backend validation', () => {
    it('errors when backend is missing', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { backend: _, ...noBackend } = minimalValid;
      const result = parser.parse(noBackend);
      expect(result.success).toBe(false);
      if (isFailure(result)) {
        expect(result.errors.some((e) => e.path === 'backend')).toBe(true);
      }
    });

    it('errors when backend.id is missing', () => {
      const data = makeValid({ backend: { ...minimalValid.backend, id: undefined } });
      const result = parser.parse(data);
      expect(result.success).toBe(false);
    });

    it('errors when backend.endpoints.config is missing', () => {
      const data = makeValid({
        backend: { ...minimalValid.backend, endpoints: { health: '/health' } }
      });
      const result = parser.parse(data);
      expect(result.success).toBe(false);
      if (isFailure(result)) {
        expect(result.errors.some((e) => e.path === 'backend.endpoints.config')).toBe(true);
      }
    });

    it('accepts optional backend fields', () => {
      const data = makeValid({
        backend: {
          ...minimalValid.backend,
          description: 'My backend',
          icon: 'https://example.com/icon.png',
          homepage: 'https://example.com',
          auth: { type: 'bearer' },
          capabilities: { hot_reload: true, debug: false }
        }
      });
      const result = parser.parse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.backend.description).toBe('My backend');
        expect(result.data.backend.auth?.type).toBe('bearer');
        expect(result.data.backend.capabilities?.hot_reload).toBe(true);
      }
    });

    it('errors on invalid auth type', () => {
      const data = makeValid({
        backend: { ...minimalValid.backend, auth: { type: 'oauth2' } }
      });
      const result = parser.parse(data);
      expect(result.success).toBe(false);
      if (isFailure(result)) {
        expect(result.errors.some((e) => e.path === 'backend.auth.type')).toBe(true);
      }
    });
  });

  // ─── Sections validation ───────────────────────────────────────────────────

  describe('sections validation', () => {
    it('errors when sections is not an array', () => {
      const data = makeValid({ sections: 'not-an-array' });
      const result = parser.parse(data);
      expect(result.success).toBe(false);
    });

    it('accepts a section with minimal fields', () => {
      const data = makeValid({
        sections: [{ id: 'general', name: 'General', fields: [] }]
      });
      const result = parser.parse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sections[0].id).toBe('general');
        expect(result.data.sections[0].fields).toEqual([]);
      }
    });

    it('skips section without id and collects error', () => {
      const data = makeValid({
        sections: [{ name: 'Missing ID', fields: [] }]
      });
      const result = parser.parse(data);
      expect(result.success).toBe(false);
      if (isFailure(result)) {
        expect(result.errors.some((e) => e.path.includes('id'))).toBe(true);
      }
    });
  });

  // ─── Field type validation ─────────────────────────────────────────────────

  describe('field types', () => {
    function sectionWith(fields: unknown[]) {
      return makeValid({ sections: [{ id: 's', name: 'S', fields }] });
    }

    it('parses a string field', () => {
      const result = parser.parse(sectionWith([{ id: 'host', name: 'Host', type: 'string', default: 'localhost' }]));
      expect(result.success).toBe(true);
      if (result.success) {
        const field = result.data.sections[0].fields[0];
        expect(field.type).toBe('string');
        if (field.type === 'string') expect(field.default).toBe('localhost');
      }
    });

    it('parses a boolean field', () => {
      const result = parser.parse(sectionWith([{ id: 'ssl', name: 'SSL', type: 'boolean', default: true }]));
      expect(result.success).toBe(true);
      if (result.success) {
        const field = result.data.sections[0].fields[0];
        expect(field.type).toBe('boolean');
        if (field.type === 'boolean') expect(field.default).toBe(true);
      }
    });

    it('parses a select field with options', () => {
      const result = parser.parse(
        sectionWith([
          {
            id: 'region',
            name: 'Region',
            type: 'select',
            options: [
              { value: 'eu-west-1', label: 'EU West' },
              { value: 'us-east-1', label: 'US East' }
            ],
            default: 'eu-west-1'
          }
        ])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        const field = result.data.sections[0].fields[0];
        expect(field.type).toBe('select');
        if (field.type === 'select') {
          expect(field.options).toHaveLength(2);
          expect(field.default).toBe('eu-west-1');
        }
      }
    });

    it('errors when select field has no options array', () => {
      const result = parser.parse(sectionWith([{ id: 'x', name: 'X', type: 'select' }]));
      expect(result.success).toBe(false);
    });

    it('warns on unknown field type and skips it', () => {
      const result = parser.parse(sectionWith([{ id: 'x', name: 'X', type: 'color_picker' }]));
      // Section-level parse succeeds (unknown field is skipped, not fatal)
      if (result.success) {
        expect(result.data.sections[0].fields).toHaveLength(0);
        expect(result.warnings?.some((w) => w.includes('color_picker'))).toBe(true);
      }
    });

    it('parses a number field with min/max', () => {
      const result = parser.parse(
        sectionWith([{ id: 'port', name: 'Port', type: 'number', default: 5432, min: 1, max: 65535 }])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        const field = result.data.sections[0].fields[0];
        if (field.type === 'number') {
          expect(field.default).toBe(5432);
          expect(field.min).toBe(1);
          expect(field.max).toBe(65535);
        }
      }
    });

    it('parses a secret field', () => {
      const result = parser.parse(sectionWith([{ id: 'api_key', name: 'API Key', type: 'secret' }]));
      expect(result.success).toBe(true);
      if (result.success) {
        const field = result.data.sections[0].fields[0];
        expect(field.type).toBe('secret');
      }
    });

    it('parses a multi_select field', () => {
      const result = parser.parse(
        sectionWith([
          {
            id: 'roles',
            name: 'Roles',
            type: 'multi_select',
            options: [
              { value: 'read', label: 'Read' },
              { value: 'write', label: 'Write' }
            ]
          }
        ])
      );
      expect(result.success).toBe(true);
      if (result.success) {
        const field = result.data.sections[0].fields[0];
        expect(field.type).toBe('multi_select');
      }
    });
  });

  // ─── Debug schema ──────────────────────────────────────────────────────────

  describe('debug schema', () => {
    it('parses an enabled debug block', () => {
      const data = makeValid({
        debug: {
          enabled: true,
          event_schema: [{ id: 'query_time', name: 'Query Time', type: 'number' }]
        }
      });
      const result = parser.parse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.debug?.enabled).toBe(true);
        expect(result.data.debug?.event_schema).toHaveLength(1);
      }
    });
  });
});
