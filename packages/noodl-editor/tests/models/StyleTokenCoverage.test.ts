/**
 * REV-009: the design-token system must actually define what it references.
 *
 * Two independent regressions are guarded here:
 *
 *  1. ElementConfigs stamp `var(--token)` strings straight into a user's
 *     project.json on node creation. If the token vocabulary the configs use
 *     ever drifts from the one DefaultTokens ships, those values silently
 *     resolve to nothing — which is exactly the state REV-008 found.
 *  2. The exported build gets its `:root` block from generateProjectTokenCss.
 *     If that stops emitting the full effective set, deployed projects break
 *     while the editor preview keeps working, which is very hard to notice.
 */

import { ElementConfigRegistry } from '../../src/editor/src/models/ElementConfigs/ElementConfigRegistry';
import { StateStyles } from '../../src/editor/src/models/ElementConfigs/ElementConfigTypes';
import { buildDefaultTokenMap } from '../../src/editor/src/models/StyleTokensModel/DefaultTokens';
import {
  generateProjectTokenCss,
  STYLE_TOKENS_METADATA_KEY
} from '../../src/editor/src/models/StyleTokensModel/ProjectTokenCss';

const VAR_REFERENCE = /var\((--[\w-]+)\)/g;

/** Collect every `--token` name referenced anywhere in a config's style values. */
function collectTokenReferences(value: unknown, into: Set<string>): void {
  if (typeof value === 'string') {
    for (const match of value.matchAll(VAR_REFERENCE)) {
      into.add(match[1]);
    }
    return;
  }

  if (value && typeof value === 'object') {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectTokenReferences(nested, into);
    }
  }
}

describe('ElementConfig token vocabulary', () => {
  const referenced = new Set<string>();

  beforeAll(() => {
    for (const config of ElementConfigRegistry.getAll()) {
      collectTokenReferences(config.defaults, referenced);
      collectTokenReferences(config.sizes, referenced);
      collectTokenReferences(config.variants, referenced);
    }
  });

  it('references at least some tokens (guards against a vacuous pass)', () => {
    expect(referenced.size).toBeGreaterThan(10);
  });

  it('references only tokens that DefaultTokens defines', () => {
    const defined = buildDefaultTokenMap();
    const undefinedTokens = Array.from(referenced)
      .filter((name) => !defined.has(name))
      .sort();

    expect(undefinedTokens).toEqual([]);
  });

  it('covers interaction states too, not just base styles', () => {
    // The `states` blocks are nested a level deeper than base styles; this is a
    // guard on the collector above rather than on the configs themselves.
    const stateTokens = new Set<string>();
    for (const config of ElementConfigRegistry.getAll()) {
      for (const variant of Object.values(config.variants)) {
        const states = variant.states as StateStyles | undefined;
        if (states) collectTokenReferences(states, stateTokens);
      }
    }

    expect(stateTokens.size).toBeGreaterThan(0);
    for (const name of stateTokens) {
      expect(referenced.has(name)).toBe(true);
    }
  });
});

describe('generateProjectTokenCss', () => {
  it('emits a :root block containing every default token', () => {
    const css = generateProjectTokenCss({ getMetaData: () => undefined });
    const defined = buildDefaultTokenMap();

    expect(css.startsWith(':root {')).toBe(true);
    for (const name of defined.keys()) {
      expect(css).toContain(`${name}:`);
    }
  });

  it('applies project overrides on top of the defaults', () => {
    const css = generateProjectTokenCss({
      getMetaData: (key: string) =>
        key === STYLE_TOKENS_METADATA_KEY
          ? {
              version: 1,
              customTokens: [{ name: '--primary', value: '#ff0000', category: 'color-semantic', isCustom: true }]
            }
          : undefined
    });

    expect(css).toContain('--primary: #ff0000;');
    // DEF-001 moved the default from `#3b82f6` (3.68:1 under white) to blue-600.
    expect(css).not.toContain('--primary: #2563eb;');
  });

  it('falls back to defaults when the stored block is malformed', () => {
    const css = generateProjectTokenCss({ getMetaData: () => ({ version: 1, customTokens: 'nonsense' }) });

    expect(css).toContain('--primary: #2563eb;');
  });

  it('tolerates a project with no metadata source at all', () => {
    expect(generateProjectTokenCss(null)).toContain('--primary:');
  });
});
