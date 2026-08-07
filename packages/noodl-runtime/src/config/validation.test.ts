/**
 * Tests for Config Validation
 */

import { describe, it, expect } from '@jest/globals';

import { DEFAULT_APP_CONFIG } from './types';
import { validateConfigKey, validateConfigValue, validateAppConfig } from './validation';

describe('validateConfigKey', () => {
  it('should accept valid JavaScript identifiers', () => {
    expect(validateConfigKey('apiKey').valid).toBe(true);
    expect(validateConfigKey('API_KEY').valid).toBe(true);
    expect(validateConfigKey('_privateKey').valid).toBe(true);
    expect(validateConfigKey('$special').valid).toBe(true);
    expect(validateConfigKey('key123').valid).toBe(true);
  });

  it('should reject empty keys', () => {
    const result = validateConfigKey('');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('cannot be empty');
  });

  it('should reject invalid identifiers', () => {
    expect(validateConfigKey('123key').valid).toBe(false);
    expect(validateConfigKey('my-key').valid).toBe(false);
    expect(validateConfigKey('my key').valid).toBe(false);
    expect(validateConfigKey('my.key').valid).toBe(false);
  });

  it('should reject reserved keys', () => {
    const result = validateConfigKey('appName');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('reserved');
  });
});

describe('validateConfigValue', () => {
  describe('number type', () => {
    it('should accept valid numbers', () => {
      expect(validateConfigValue(42, 'number').valid).toBe(true);
      expect(validateConfigValue(0, 'number').valid).toBe(true);
      expect(validateConfigValue(-10.5, 'number').valid).toBe(true);
    });

    it('should reject non-numbers', () => {
      expect(validateConfigValue('42', 'number').valid).toBe(false);
      expect(validateConfigValue(NaN, 'number').valid).toBe(false);
    });

    it('should enforce min/max validation', () => {
      expect(validateConfigValue(5, 'number', { min: 0, max: 10 }).valid).toBe(true);
      expect(validateConfigValue(-1, 'number', { min: 0 }).valid).toBe(false);
      expect(validateConfigValue(11, 'number', { max: 10 }).valid).toBe(false);
    });
  });

  describe('string type', () => {
    it('should accept valid strings', () => {
      expect(validateConfigValue('hello', 'string').valid).toBe(true);
      expect(validateConfigValue('', 'string').valid).toBe(true);
    });

    it('should reject non-strings', () => {
      expect(validateConfigValue(42, 'string').valid).toBe(false);
    });

    it('should enforce pattern validation', () => {
      const result = validateConfigValue('abc', 'string', { pattern: '^[0-9]+$' });
      expect(result.valid).toBe(false);

      const validResult = validateConfigValue('123', 'string', { pattern: '^[0-9]+$' });
      expect(validResult.valid).toBe(true);
    });
  });

  describe('boolean type', () => {
    it('should accept booleans', () => {
      expect(validateConfigValue(true, 'boolean').valid).toBe(true);
      expect(validateConfigValue(false, 'boolean').valid).toBe(true);
    });

    it('should reject non-booleans', () => {
      expect(validateConfigValue('true', 'boolean').valid).toBe(false);
      expect(validateConfigValue(1, 'boolean').valid).toBe(false);
    });
  });

  describe('color type', () => {
    it('should accept valid hex colors', () => {
      expect(validateConfigValue('#ff0000', 'color').valid).toBe(true);
      expect(validateConfigValue('#FF0000', 'color').valid).toBe(true);
      expect(validateConfigValue('#ff0000ff', 'color').valid).toBe(true);
    });

    it('should reject invalid colors', () => {
      expect(validateConfigValue('red', 'color').valid).toBe(false);
      expect(validateConfigValue('#ff00', 'color').valid).toBe(false);
      expect(validateConfigValue('ff0000', 'color').valid).toBe(false);
    });
  });

  describe('array type', () => {
    it('should accept arrays', () => {
      expect(validateConfigValue([], 'array').valid).toBe(true);
      expect(validateConfigValue([1, 2, 3], 'array').valid).toBe(true);
    });

    it('should reject non-arrays', () => {
      expect(validateConfigValue('[]', 'array').valid).toBe(false);
      expect(validateConfigValue({}, 'array').valid).toBe(false);
    });
  });

  describe('object type', () => {
    it('should accept objects', () => {
      expect(validateConfigValue({}, 'object').valid).toBe(true);
      expect(validateConfigValue({ key: 'value' }, 'object').valid).toBe(true);
    });

    it('should reject non-objects', () => {
      expect(validateConfigValue([], 'object').valid).toBe(false);
      expect(validateConfigValue('{}', 'object').valid).toBe(false);
    });

    it('treats null as an absent optional value, like every other type', () => {
      // Policy (recorded by DEBT-003): the empty-and-not-required guard runs
      // before type validation, so null is valid unless `required: true` —
      // identical to the string/number behaviour asserted under "required
      // validation" below.
      expect(validateConfigValue(null, 'object').valid).toBe(true);
      expect(validateConfigValue(null, 'object', { required: true }).valid).toBe(false);
    });
  });

  describe('required validation', () => {
    it('should require non-empty values', () => {
      expect(validateConfigValue('', 'string', { required: true }).valid).toBe(false);
      expect(validateConfigValue(null, 'string', { required: true }).valid).toBe(false);
      expect(validateConfigValue(undefined, 'string', { required: true }).valid).toBe(false);
    });

    it('should allow empty values when not required', () => {
      expect(validateConfigValue('', 'string').valid).toBe(true);
      expect(validateConfigValue(null, 'string').valid).toBe(true);
    });
  });
});

describe('validateAppConfig', () => {
  it('should accept valid config', () => {
    const config = {
      ...DEFAULT_APP_CONFIG,
      identity: {
        appName: 'Test App',
        description: 'Test Description'
      }
    };
    expect(validateAppConfig(config).valid).toBe(true);
  });

  it('should require app name', () => {
    const config = {
      ...DEFAULT_APP_CONFIG,
      identity: {
        appName: '',
        description: ''
      }
    };
    const result = validateAppConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('App name');
  });

  it('should detect duplicate variable keys', () => {
    const config = {
      ...DEFAULT_APP_CONFIG,
      identity: { appName: 'Test', description: '' },
      variables: [
        { key: 'apiKey', type: 'string' as const, value: 'key1' },
        { key: 'apiKey', type: 'string' as const, value: 'key2' }
      ]
    };
    const result = validateAppConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Duplicate'))).toBe(true);
  });

  it('should validate individual variables', () => {
    const config = {
      ...DEFAULT_APP_CONFIG,
      identity: { appName: 'Test', description: '' },
      variables: [{ key: 'my-invalid-key', type: 'string' as const, value: 'test' }]
    };
    const result = validateAppConfig(config);
    expect(result.valid).toBe(false);
  });

  it('should reject non-object configs', () => {
    const result = validateAppConfig(null);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('must be an object');
  });
});
