/**
 * STYLE-004: Unit tests for ElementConfigRegistry
 *
 * Covers: applyVariant, applySize, getSizeNames, resolveVariant,
 * getVariantNames, applyDefaults.
 */

import { describe, it, expect } from '@jest/globals';

import { ElementConfigRegistry, NodeModelLike } from '../../src/editor/src/models/ElementConfigs/ElementConfigRegistry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(): NodeModelLike {
  return { parameters: {} };
}

const BUTTON_TYPE = 'net.noodl.controls.button';
const TEXT_TYPE = 'net.noodl.visual.text';
const GROUP_TYPE = 'net.noodl.visual.group';

// ---------------------------------------------------------------------------
// applyVariant
// ---------------------------------------------------------------------------

describe('ElementConfigRegistry.applyVariant', () => {
  it('stamps base styles onto node parameters', () => {
    const node = makeNode();
    ElementConfigRegistry.applyVariant(node, BUTTON_TYPE, 'primary');

    expect(node.parameters['backgroundColor']).toBe('var(--primary)');
    expect(node.parameters['color']).toBe('var(--primary-foreground)');
    expect(node.parameters['_variant']).toBe('primary');
  });

  it('does not include the "states" key in stamped parameters', () => {
    const node = makeNode();
    ElementConfigRegistry.applyVariant(node, BUTTON_TYPE, 'primary');

    expect(node.parameters['states']).toBeUndefined();
  });

  it('updates _variant marker when switching variants', () => {
    const node = makeNode();
    ElementConfigRegistry.applyVariant(node, BUTTON_TYPE, 'primary');
    ElementConfigRegistry.applyVariant(node, BUTTON_TYPE, 'secondary');

    expect(node.parameters['_variant']).toBe('secondary');
    expect(node.parameters['backgroundColor']).toBe('var(--secondary)');
  });

  it('is a no-op for an unknown node type', () => {
    const node = makeNode();
    ElementConfigRegistry.applyVariant(node, 'unknown.type', 'primary');

    expect(node.parameters).toEqual({});
  });

  it('is a no-op for an unknown variant name', () => {
    const node = makeNode();
    ElementConfigRegistry.applyVariant(node, BUTTON_TYPE, 'nonexistent');

    expect(node.parameters).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// applySize (STYLE-004)
// ---------------------------------------------------------------------------

describe('ElementConfigRegistry.applySize', () => {
  it('stamps size preset styles onto node parameters', () => {
    const node = makeNode();
    ElementConfigRegistry.applySize(node, BUTTON_TYPE, 'sm');

    expect(node.parameters['fontSize']).toBe('var(--text-xs)');
    expect(node.parameters['_size']).toBe('sm');
  });

  it('stamps lg preset correctly', () => {
    const node = makeNode();
    ElementConfigRegistry.applySize(node, BUTTON_TYPE, 'lg');

    expect(node.parameters['fontSize']).toBe('var(--text-base)');
    expect(node.parameters['paddingTop']).toBe('var(--space-3)');
    expect(node.parameters['_size']).toBe('lg');
  });

  it('is a no-op for a node type with no sizes', () => {
    const node = makeNode();
    // Group has no sizes defined
    ElementConfigRegistry.applySize(node, GROUP_TYPE, 'sm');
    expect(node.parameters).toEqual({});
  });

  it('is a no-op for an unknown size name', () => {
    const node = makeNode();
    ElementConfigRegistry.applySize(node, BUTTON_TYPE, 'xxl');
    expect(node.parameters).toEqual({});
  });

  it('is a no-op for an unknown type', () => {
    const node = makeNode();
    ElementConfigRegistry.applySize(node, 'unknown.type', 'md');
    expect(node.parameters).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// getSizeNames (STYLE-004)
// ---------------------------------------------------------------------------

describe('ElementConfigRegistry.getSizeNames', () => {
  it('returns size keys in definition order for Button', () => {
    const sizes = ElementConfigRegistry.getSizeNames(BUTTON_TYPE);
    expect(sizes).toEqual(['sm', 'md', 'lg', 'xl']);
  });

  it('returns empty array for node types with no sizes', () => {
    expect(ElementConfigRegistry.getSizeNames(GROUP_TYPE)).toEqual([]);
    expect(ElementConfigRegistry.getSizeNames(TEXT_TYPE)).toEqual([]);
  });

  it('returns empty array for unknown type', () => {
    expect(ElementConfigRegistry.getSizeNames('unknown.type')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getVariantNames
// ---------------------------------------------------------------------------

describe('ElementConfigRegistry.getVariantNames', () => {
  it('returns all variant names for Button', () => {
    const variants = ElementConfigRegistry.getVariantNames(BUTTON_TYPE);
    expect(variants).toContain('primary');
    expect(variants).toContain('secondary');
    expect(variants).toContain('outline');
    expect(variants).toContain('ghost');
    expect(variants).toContain('destructive');
    expect(variants).toContain('link');
  });

  it('returns empty array for unknown type', () => {
    expect(ElementConfigRegistry.getVariantNames('unknown.type')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// resolveVariant
// ---------------------------------------------------------------------------

describe('ElementConfigRegistry.resolveVariant', () => {
  it('returns baseStyles and states', () => {
    const resolved = ElementConfigRegistry.resolveVariant(BUTTON_TYPE, 'primary');
    expect(resolved).toBeDefined();
    expect(resolved!.baseStyles['backgroundColor']).toBe('var(--primary)');
    expect(resolved!.states.hover).toBeDefined();
  });

  it('does not include "states" key inside baseStyles', () => {
    const resolved = ElementConfigRegistry.resolveVariant(BUTTON_TYPE, 'primary');
    expect('states' in resolved!.baseStyles).toBe(false);
  });

  it('returns undefined for unknown type', () => {
    expect(ElementConfigRegistry.resolveVariant('unknown.type', 'primary')).toBeUndefined();
  });

  it('returns undefined for unknown variant', () => {
    expect(ElementConfigRegistry.resolveVariant(BUTTON_TYPE, 'nonexistent')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// applyDefaults
// ---------------------------------------------------------------------------

describe('ElementConfigRegistry.applyDefaults', () => {
  it('applies default styles and stamps the default variant', () => {
    const node = makeNode();
    ElementConfigRegistry.applyDefaults(node, BUTTON_TYPE);

    // Default variant is 'primary', so its styles should be applied
    expect(node.parameters['_variant']).toBe('primary');
    expect(node.parameters['backgroundColor']).toBe('var(--primary)');
    // Base defaults
    expect(node.parameters['borderRadius']).toBe('var(--radius-md)');
    expect(node.parameters['cursor']).toBe('pointer');
  });

  it('does not overwrite already-set parameters', () => {
    const node = makeNode();
    node.parameters['cursor'] = 'default';
    ElementConfigRegistry.applyDefaults(node, BUTTON_TYPE);
    // Pre-existing value should be preserved
    expect(node.parameters['cursor']).toBe('default');
  });

  it('is a no-op for unknown type', () => {
    const node = makeNode();
    ElementConfigRegistry.applyDefaults(node, 'unknown.type');
    expect(node.parameters).toEqual({});
  });
});
