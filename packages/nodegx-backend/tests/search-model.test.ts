/**
 * BAK-008 search config model — pure validation tests (mirrors
 * security-model.test.ts's style for security.json).
 */
import { defaultSearchConfig, validateSearchConfig, SUPPORTED_TOKENIZERS } from '../src/search/model';

describe('defaultSearchConfig', () => {
  it('starts with no collections opted in and is itself valid', () => {
    const cfg = defaultSearchConfig();
    expect(cfg.collections).toEqual({});
    expect(validateSearchConfig(cfg)).toEqual([]);
  });
});

describe('validateSearchConfig', () => {
  it('rejects non-object input', () => {
    expect(validateSearchConfig(null).length).toBeGreaterThan(0);
    expect(validateSearchConfig('nope').length).toBeGreaterThan(0);
    expect(validateSearchConfig([]).length).toBeGreaterThan(0);
  });

  it('rejects unknown top-level keys', () => {
    const errors = validateSearchConfig({ version: 1, collections: {}, extra: true });
    expect(errors.some((e) => e.includes('unknown top-level key "extra"'))).toBe(true);
  });

  it('rejects an unsupported version', () => {
    const errors = validateSearchConfig({ version: 2, collections: {} });
    expect(errors.some((e) => e.includes('unsupported version'))).toBe(true);
  });

  it('accepts a well-formed enabled collection', () => {
    const errors = validateSearchConfig({
      version: 1,
      collections: { Article: { enabled: true, fields: ['title', 'body'] } }
    });
    expect(errors).toEqual([]);
  });

  it('accepts a disabled collection with an empty field list', () => {
    const errors = validateSearchConfig({
      version: 1,
      collections: { Article: { enabled: false, fields: [] } }
    });
    expect(errors).toEqual([]);
  });

  it('rejects an enabled collection with no fields', () => {
    const errors = validateSearchConfig({
      version: 1,
      collections: { Article: { enabled: true, fields: [] } }
    });
    expect(errors.some((e) => e.includes('must be non-empty when enabled'))).toBe(true);
  });

  it('rejects a system collection', () => {
    const errors = validateSearchConfig({
      version: 1,
      collections: { _User: { enabled: true, fields: ['username'] } }
    });
    expect(errors.some((e) => e.includes('system collections cannot carry a search config'))).toBe(true);
  });

  it('rejects unknown keys inside a collection entry', () => {
    const errors = validateSearchConfig({
      version: 1,
      collections: { Article: { enabled: true, fields: ['title'], bogus: true } }
    });
    expect(errors.some((e) => e.includes('unknown key "bogus"'))).toBe(true);
  });

  it('rejects an invalid field name', () => {
    const errors = validateSearchConfig({
      version: 1,
      collections: { Article: { enabled: true, fields: ['title; DROP TABLE'] } }
    });
    expect(errors.some((e) => e.includes('is not a valid column name'))).toBe(true);
  });

  it('accepts every supported tokenizer and rejects an unknown one', () => {
    for (const tokenizer of SUPPORTED_TOKENIZERS) {
      const errors = validateSearchConfig({
        version: 1,
        collections: { Article: { enabled: true, fields: ['title'], tokenizer } }
      });
      expect(errors).toEqual([]);
    }
    const errors = validateSearchConfig({
      version: 1,
      collections: { Article: { enabled: true, fields: ['title'], tokenizer: 'klingon' } }
    });
    expect(errors.some((e) => e.includes('unknown tokenizer'))).toBe(true);
  });
});
