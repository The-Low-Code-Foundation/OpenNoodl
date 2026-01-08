/**
 * Tests for ConfigManager
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

import { ConfigManager } from './config-manager';
import { DEFAULT_APP_CONFIG } from './types';

describe('ConfigManager', () => {
  let manager: ConfigManager;

  beforeEach(() => {
    manager = ConfigManager.getInstance();
    manager.reset(); // Reset state between tests
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ConfigManager.getInstance();
      const instance2 = ConfigManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('should initialize with default config', () => {
      manager.initialize({});
      const config = manager.getRawConfig();
      expect(config.identity.appName).toBe(DEFAULT_APP_CONFIG.identity.appName);
    });

    it('should merge partial config with defaults', () => {
      manager.initialize({
        identity: {
          appName: 'My App',
          description: 'Test'
        }
      });
      const config = manager.getRawConfig();
      expect(config.identity.appName).toBe('My App');
      expect(config.variables).toEqual([]);
    });

    it('should store custom variables', () => {
      manager.initialize({
        identity: DEFAULT_APP_CONFIG.identity,
        seo: {},
        variables: [{ key: 'apiKey', type: 'string', value: 'secret123' }]
      });
      const config = manager.getRawConfig();
      expect(config.variables.length).toBe(1);
      expect(config.variables[0].key).toBe('apiKey');
    });
  });

  describe('getConfig', () => {
    it('should return flattened config object', () => {
      manager.initialize({
        identity: {
          appName: 'Test App',
          description: 'Test Description'
        },
        seo: {},
        variables: [
          { key: 'apiKey', type: 'string', value: 'key123' },
          { key: 'maxRetries', type: 'number', value: 3 }
        ]
      });

      const config = manager.getConfig();
      expect(config.appName).toBe('Test App');
      expect(config.description).toBe('Test Description');
      expect(config.apiKey).toBe('key123');
      expect(config.maxRetries).toBe(3);
    });

    it('should apply smart defaults for SEO', () => {
      manager.initialize({
        identity: {
          appName: 'Test App',
          description: 'Test Description',
          coverImage: 'cover.jpg'
        },
        seo: {}, // Empty SEO
        variables: []
      });

      const config = manager.getConfig();
      // Should default to identity values
      expect(config.ogTitle).toBe('Test App');
      expect(config.ogDescription).toBe('Test Description');
      expect(config.ogImage).toBe('cover.jpg');
    });

    it('should use explicit SEO values when provided', () => {
      manager.initialize({
        identity: {
          appName: 'Test App',
          description: 'Test Description'
        },
        seo: {
          ogTitle: 'Custom OG Title',
          ogDescription: 'Custom OG Description'
        },
        variables: []
      });

      const config = manager.getConfig();
      expect(config.ogTitle).toBe('Custom OG Title');
      expect(config.ogDescription).toBe('Custom OG Description');
    });

    it('should return frozen object', () => {
      manager.initialize({
        identity: DEFAULT_APP_CONFIG.identity,
        seo: {},
        variables: []
      });

      const config = manager.getConfig();
      expect(Object.isFrozen(config)).toBe(true);

      // Attempt to modify should fail silently (or throw in strict mode)
      expect(() => {
        (config as any).appName = 'Modified';
      }).toThrow();
    });
  });

  describe('getVariable', () => {
    beforeEach(() => {
      manager.initialize({
        identity: DEFAULT_APP_CONFIG.identity,
        seo: {},
        variables: [
          { key: 'apiKey', type: 'string', value: 'key123', description: 'API Key' },
          { key: 'maxRetries', type: 'number', value: 3 }
        ]
      });
    });

    it('should return variable by key', () => {
      const variable = manager.getVariable('apiKey');
      expect(variable).toBeDefined();
      expect(variable?.value).toBe('key123');
      expect(variable?.description).toBe('API Key');
    });

    it('should return undefined for non-existent key', () => {
      const variable = manager.getVariable('nonExistent');
      expect(variable).toBeUndefined();
    });
  });

  describe('getVariableKeys', () => {
    it('should return all variable keys', () => {
      manager.initialize({
        identity: DEFAULT_APP_CONFIG.identity,
        seo: {},
        variables: [
          { key: 'apiKey', type: 'string', value: 'key123' },
          { key: 'maxRetries', type: 'number', value: 3 },
          { key: 'enabled', type: 'boolean', value: true }
        ]
      });

      const keys = manager.getVariableKeys();
      expect(keys).toEqual(['apiKey', 'maxRetries', 'enabled']);
    });

    it('should return empty array when no variables', () => {
      manager.initialize({
        identity: DEFAULT_APP_CONFIG.identity,
        seo: {},
        variables: []
      });

      const keys = manager.getVariableKeys();
      expect(keys).toEqual([]);
    });
  });

  describe('immutability', () => {
    it('should not allow mutation of returned config', () => {
      manager.initialize({
        identity: {
          appName: 'Original',
          description: ''
        },
        seo: {},
        variables: [{ key: 'apiKey', type: 'string', value: 'original' }]
      });

      const config1 = manager.getConfig();

      // Attempt mutations should fail
      expect(() => {
        (config1 as any).apiKey = 'modified';
      }).toThrow();

      // Getting config again should still have original value
      const config2 = manager.getConfig();
      expect(config2.apiKey).toBe('original');
    });
  });

  describe('reset', () => {
    it('should reset to default state', () => {
      manager.initialize({
        identity: {
          appName: 'Custom App',
          description: 'Custom'
        },
        seo: {},
        variables: [{ key: 'test', type: 'string', value: 'value' }]
      });

      manager.reset();

      const config = manager.getRawConfig();
      expect(config.identity.appName).toBe(DEFAULT_APP_CONFIG.identity.appName);
      expect(config.variables).toEqual([]);
    });
  });
});
