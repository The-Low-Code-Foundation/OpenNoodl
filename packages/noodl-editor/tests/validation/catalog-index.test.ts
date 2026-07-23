/**
 * SUB-006 — CatalogIndex unit tests
 *
 * Covers the primitives the rules rely on: edit-distance suggestions, port
 * lookup (including declared-port-group folding), dynamic detection, and the
 * typecast compatibility matrix.
 */

import { CatalogIndex, levenshtein, nearest } from '../../src/editor/src/validation/CatalogIndex';
import { loadDefaultCatalog } from '../../src/editor/src/validation/catalog';

describe('SUB-006 CatalogIndex', () => {
  const index = loadDefaultCatalog();

  describe('levenshtein', () => {
    it('computes basic distances', () => {
      expect(levenshtein('', 'abc')).toBe(3);
      expect(levenshtein('abc', 'abc')).toBe(0);
      expect(levenshtein('Butonn', 'Button')).toBe(2);
      expect(levenshtein('kitten', 'sitting')).toBe(3);
    });
  });

  describe('nearest', () => {
    it('returns a close near-miss', () => {
      expect(nearest('Butonn', ['Button', 'Group', 'Text'])).toBe('Button');
    });
    it('returns undefined when nothing is close enough', () => {
      expect(nearest('Xylophone', ['Button', 'Group', 'Text'])).toBeUndefined();
    });
    it('prefers a case-only difference', () => {
      expect(nearest('group', ['Group', 'Text'])).toBe('Group');
    });
    it('returns undefined for empty candidates', () => {
      expect(nearest('foo', [])).toBeUndefined();
    });
  });

  describe('type lookup', () => {
    it('knows real catalog types and rejects invented ones', () => {
      expect(index.hasType('Group')).toBe(true);
      expect(index.hasType('Text')).toBe(true);
      expect(index.hasType('Butonn')).toBe(false);
    });

    it('suggests a real type for a near-miss', () => {
      expect(index.suggestType('Butonn')).toBe('Button');
      expect(index.suggestType('Groop')).toBe('Group');
    });
  });

  describe('port lookup', () => {
    it('finds a static input and output', () => {
      expect(index.hasPort('Boolean', 'input', 'value')).toBe(true);
      expect(index.hasPort('Group', 'output', 'onClick')).toBe(true);
    });

    it('folds declared-port-group members into the known port set', () => {
      // `width`/`height` are conditionally-declared group inputs on Group.
      expect(index.hasPort('Group', 'input', 'width')).toBe(true);
    });

    it('reports signal inputs', () => {
      const signals = index.signalInputNames('Boolean');
      expect(Array.isArray(signals)).toBe(true);
    });
  });

  describe('dynamic detection', () => {
    it('flags runtime-dynamic nodes', () => {
      expect(index.isDynamicNode('Expression')).toBe(true);
      expect(index.isDynamicNode('JavaScriptFunction')).toBe(true);
      expect(index.hasRuntimeDynamicPorts('Expression')).toBe(true);
    });
    it('does not flag a purely static node', () => {
      expect(index.isDynamicNode('Boolean')).toBe(false);
    });
  });

  describe('type compatibility', () => {
    it('treats identical and wildcard types as compatible', () => {
      expect(index.isTypeCompatible('string', 'string')).toBe(true);
      expect(index.isTypeCompatible('*', 'number')).toBe(true);
      expect(index.isTypeCompatible('color', '*')).toBe(true);
    });
    it('honours documented typecasts', () => {
      expect(index.isTypeCompatible('string', 'number')).toBe(true); // string→number is a documented cast
    });
    it('rejects a pair with no conversion', () => {
      expect(index.isTypeCompatible('color', 'number')).toBe(false);
    });
    it('is conservative about unknown types', () => {
      expect(index.isTypeCompatible(undefined, 'number')).toBe(true);
      expect(index.isTypeCompatible('number', undefined)).toBe(true);
    });
  });

  describe('port type name extraction', () => {
    it('reads a string or object type', () => {
      expect(CatalogIndex.portTypeName({ type: 'string' } as any)).toBe('string');
      expect(CatalogIndex.portTypeName({ type: { name: 'number' } } as any)).toBe('number');
      expect(CatalogIndex.portTypeName(undefined)).toBeUndefined();
    });
  });
});
