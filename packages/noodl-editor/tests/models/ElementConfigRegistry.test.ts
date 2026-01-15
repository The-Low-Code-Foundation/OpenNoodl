/**
 * ElementConfigRegistry Tests
 *
 * Unit tests for the ElementConfigRegistry and ButtonConfig.
 * Tests registration, retrieval, validation, and config application.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach } from '@jest/globals';

import { ButtonConfig } from '../../src/editor/src/models/ElementConfigs/configs/ButtonConfig';
import { ElementConfigRegistry } from '../../src/editor/src/models/ElementConfigs/ElementConfigRegistry';
import type { ElementConfig } from '../../src/editor/src/models/ElementConfigs/ElementConfigTypes';

describe('ElementConfigRegistry', () => {
  let registry: ElementConfigRegistry;

  beforeEach(() => {
    // Get fresh registry instance and clear it
    registry = ElementConfigRegistry.instance;
    registry.clear();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ElementConfigRegistry.instance;
      const instance2 = ElementConfigRegistry.instance;
      expect(instance1).toBe(instance2);
    });
  });

  describe('Config Registration', () => {
    it('should register ButtonConfig successfully', () => {
      const result = registry.register(ButtonConfig);
      expect(result).toBe(true);
      expect(registry.getCount()).toBe(1);
    });

    it('should retrieve registered config', () => {
      registry.register(ButtonConfig);
      const config = registry.get('net.noodl.visual.button');
      expect(config).toBeDefined();
      expect(config?.nodeType).toBe('net.noodl.visual.button');
    });

    it('should not register duplicate without override', () => {
      registry.register(ButtonConfig);
      const result = registry.register(ButtonConfig);
      expect(result).toBe(false);
      expect(registry.getCount()).toBe(1);
    });

    it('should override existing config when override is true', () => {
      registry.register(ButtonConfig);
      const result = registry.register(ButtonConfig, { override: true });
      expect(result).toBe(true);
      expect(registry.getCount()).toBe(1);
    });

    it('should check if config exists', () => {
      expect(registry.has('net.noodl.visual.button')).toBe(false);
      registry.register(ButtonConfig);
      expect(registry.has('net.noodl.visual.button')).toBe(true);
    });
  });

  describe('ButtonConfig Structure', () => {
    beforeEach(() => {
      registry.register(ButtonConfig);
    });

    it('should have 6 variants', () => {
      const variants = registry.getVariants('net.noodl.visual.button');
      expect(variants).toHaveLength(6);
      expect(variants).toContain('primary');
      expect(variants).toContain('secondary');
      expect(variants).toContain('outline');
      expect(variants).toContain('ghost');
      expect(variants).toContain('destructive');
      expect(variants).toContain('link');
    });

    it('should have 4 size presets', () => {
      const sizes = registry.getSizes('net.noodl.visual.button');
      expect(sizes).toHaveLength(4);
      expect(sizes).toContain('sm');
      expect(sizes).toContain('md');
      expect(sizes).toContain('lg');
      expect(sizes).toContain('xl');
    });

    it('should retrieve specific variant', () => {
      const primary = registry.getVariant('net.noodl.visual.button', 'primary');
      expect(primary).toBeDefined();
      expect(primary?.backgroundColor).toBe('var(--primary)');
      expect(primary?.color).toBe('var(--primary-foreground)');
    });

    it('should retrieve specific size', () => {
      const md = registry.getSize('net.noodl.visual.button', 'md');
      expect(md).toBeDefined();
      expect(md?.fontSize).toBe('var(--text-sm)');
      expect(md?.height).toBe('40px');
    });

    it('should have states in variants', () => {
      const primary = registry.getVariant('net.noodl.visual.button', 'primary');
      expect(primary?.states).toBeDefined();
      expect(primary?.states?.hover).toBeDefined();
      expect(primary?.states?.active).toBeDefined();
      expect(primary?.states?.disabled).toBeDefined();
    });
  });

  describe('Config Validation', () => {
    it('should validate ButtonConfig as valid', () => {
      const validation = registry.validate(ButtonConfig);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid config (missing nodeType)', () => {
      const invalidConfig = {
        defaults: {},
        variants: { test: {} }
      } as unknown as ElementConfig;

      const validation = registry.validate(invalidConfig);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('nodeType is required');
    });

    it('should detect invalid config (missing variants)', () => {
      const invalidConfig = {
        nodeType: 'test',
        defaults: {},
        variants: {}
      } as ElementConfig;

      const validation = registry.validate(invalidConfig);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('At least one variant is required');
    });
  });

  describe('Apply Defaults', () => {
    beforeEach(() => {
      registry.register(ButtonConfig);
    });

    it('should apply defaults to a mock node', () => {
      const mockNode = {
        type: 'net.noodl.visual.button',
        id: 'test-button-1',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parameters: {} as Record<string, any>
      };

      const result = registry.applyDefaults(mockNode);
      expect(result).toBe(true);
      expect(mockNode.parameters.fontSize).toBe('var(--text-sm)');
      expect(mockNode.parameters.borderRadius).toBe('var(--radius-md)');
      expect(mockNode.parameters._variant).toBe('primary');
    });

    it('should not override existing parameters', () => {
      const mockNode = {
        type: 'net.noodl.visual.button',
        id: 'test-button-2',
        parameters: {
          fontSize: 'custom-size'
        } as Record<string, any>
      };

      registry.applyDefaults(mockNode);
      expect(mockNode.parameters.fontSize).toBe('custom-size'); // Should not be overridden
      expect(mockNode.parameters.borderRadius).toBe('var(--radius-md)'); // Should be added
    });

    it('should return false for unknown node type', () => {
      const mockNode = {
        type: 'unknown.node.type',
        id: 'test-unknown',
        parameters: {} as Record<string, any>
      };

      const result = registry.applyDefaults(mockNode);
      expect(result).toBe(false);
    });
  });

  describe('Apply Variant', () => {
    beforeEach(() => {
      registry.register(ButtonConfig);
    });

    it('should apply variant to node', () => {
      const mockNode = {
        type: 'net.noodl.visual.button',
        id: 'test-button-3',
        parameters: {} as Record<string, any>
      };

      const result = registry.applyVariant(mockNode, 'secondary');
      expect(result).toBe(true);
      expect(mockNode.parameters.backgroundColor).toBe('var(--secondary)');
      expect(mockNode.parameters.color).toBe('var(--secondary-foreground)');
      expect(mockNode.parameters._variant).toBe('secondary');
    });

    it('should apply variant with size', () => {
      const mockNode = {
        type: 'net.noodl.visual.button',
        id: 'test-button-4',
        parameters: {} as Record<string, any>
      };

      const result = registry.applyVariant(mockNode, {
        variantName: 'outline',
        size: 'lg'
      });

      expect(result).toBe(true);
      expect(mockNode.parameters.backgroundColor).toBe('transparent');
      expect(mockNode.parameters.fontSize).toBe('var(--text-base)'); // From lg size
      expect(mockNode.parameters.height).toBe('48px'); // From lg size
      expect(mockNode.parameters._variant).toBe('outline');
      expect(mockNode.parameters._size).toBe('lg');
    });

    it('should preserve user overrides by default', () => {
      const mockNode = {
        type: 'net.noodl.visual.button',
        id: 'test-button-5',
        parameters: {
          customProperty: 'user-value',
          _variant: 'primary'
        } as Record<string, any>
      };

      registry.applyVariant(mockNode, 'secondary');
      expect(mockNode.parameters.customProperty).toBe('user-value'); // Preserved
      expect(mockNode.parameters._variant).toBe('secondary');
    });

    it('should return false for unknown variant', () => {
      const mockNode = {
        type: 'net.noodl.visual.button',
        id: 'test-button-6',
        parameters: {} as Record<string, any>
      };

      const result = registry.applyVariant(mockNode, 'unknown-variant');
      expect(result).toBe(false);
    });
  });

  describe('Resolve Styles', () => {
    beforeEach(() => {
      registry.register(ButtonConfig);
    });

    it('should resolve styles with defaults only', () => {
      const result = registry.resolveStyles({
        nodeType: 'net.noodl.visual.button'
      });

      expect(result).not.toBeNull();
      expect(result?.styles.base.fontSize).toBe('var(--text-sm)');
      expect(result?.hasUserOverrides).toBe(false);
    });

    it('should resolve styles with variant', () => {
      const result = registry.resolveStyles({
        nodeType: 'net.noodl.visual.button',
        variant: 'destructive'
      });

      expect(result).not.toBeNull();
      expect(result?.styles.base.backgroundColor).toBe('var(--destructive)');
      expect(result?.appliedVariant).toBe('destructive');
    });

    it('should resolve styles with size', () => {
      const result = registry.resolveStyles({
        nodeType: 'net.noodl.visual.button',
        variant: 'primary',
        size: 'xl'
      });

      expect(result).not.toBeNull();
      expect(result?.styles.base.fontSize).toBe('var(--text-lg)'); // From xl size
      expect(result?.styles.base.height).toBe('56px'); // From xl size
      expect(result?.appliedSize).toBe('xl');
    });

    it('should prioritize user overrides', () => {
      const result = registry.resolveStyles({
        nodeType: 'net.noodl.visual.button',
        variant: 'primary',
        userOverrides: {
          backgroundColor: '#custom-color'
        }
      });

      expect(result).not.toBeNull();
      expect(result?.styles.base.backgroundColor).toBe('#custom-color');
      expect(result?.hasUserOverrides).toBe(true);
      expect(result?.sources?.backgroundColor).toBe('user');
    });

    it('should track style sources', () => {
      const result = registry.resolveStyles({
        nodeType: 'net.noodl.visual.button',
        variant: 'primary',
        size: 'md'
      });

      expect(result?.sources).toBeDefined();
      expect(result?.sources?.fontSize).toBe('size'); // From size preset
      expect(result?.sources?.backgroundColor).toBe('variant'); // From variant
    });
  });

  describe('Registry Summary', () => {
    it('should provide empty summary initially', () => {
      const summary = registry.getSummary();
      expect(summary.totalConfigs).toBe(0);
      expect(summary.nodeTypes).toHaveLength(0);
    });

    it('should provide accurate summary after registration', () => {
      registry.register(ButtonConfig);
      const summary = registry.getSummary();

      expect(summary.totalConfigs).toBe(1);
      expect(summary.nodeTypes).toContain('net.noodl.visual.button');
      expect(summary.configDetails).toHaveLength(1);
      expect(summary.configDetails[0].variantCount).toBe(6);
      expect(summary.configDetails[0].sizeCount).toBe(4);
      expect(summary.configDetails[0].hasDescription).toBe(true);
    });
  });

  describe('Registry Operations', () => {
    it('should return all registered node types', () => {
      registry.register(ButtonConfig);
      const nodeTypes = registry.getRegisteredNodeTypes();
      expect(nodeTypes).toContain('net.noodl.visual.button');
    });

    it('should clear all configs', () => {
      registry.register(ButtonConfig);
      expect(registry.getCount()).toBe(1);

      registry.clear();
      expect(registry.getCount()).toBe(0);
    });
  });
});
