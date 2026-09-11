/**
 * CMP-008 AC2 — which tokens the target cannot resolve, and the sentence that
 * says so.
 *
 * Everything here is the decision half. The wiring — that `apply()` actually
 * calls it, on every route, and exempts export staging — is graded in
 * `callers.test.ts` beside this file, because a correct function nothing calls
 * is the failure this phase has now found six times.
 */

import {
  describeUnresolvedTokens,
  tokensReferencedByPlan,
  tokenWarningsFor,
  unresolvedTokensForPlan,
  type SourceProjectJson
} from '../../src/editor/src/utils/import-engine/tokenGap';
import type { ImportPlan, ItemPolicy, PlannedComponent, PlannedItem } from '../../src/editor/src/utils/import-engine/types';

const ADD: ItemPolicy = { action: 'add' };
const SKIP: ItemPolicy = { action: 'skip' };

function component(name: string, policy: ItemPolicy = ADD): PlannedComponent {
  return { name, reason: 'requested', requiredBy: [], collides: false, policy };
}
function item(name: string, policy: ItemPolicy = ADD, typename?: string): PlannedItem {
  return { name, typename, reason: 'requested', requiredBy: [], collides: false, policy };
}
function plan(overrides: Partial<ImportPlan> = {}): ImportPlan {
  return {
    sourceDir: '/tmp/source',
    origin: { kind: 'local-project' },
    components: [],
    resources: [],
    modules: [],
    variants: [],
    styles: { colors: [], text: [] },
    renames: {},
    hasCollisions: false,
    ...overrides
  };
}

/** A serialised source project — `ProjectModel.toJSON()`'s shape. */
const source: SourceProjectJson = {
  components: [
    { name: '/Card', ...({ graph: { roots: [{ parameters: { backgroundColor: 'var(--brand-surface)' } }] } } as object) },
    { name: '/Sidebar', ...({ graph: { roots: [{ parameters: { color: 'var(--sidebar-ink)' } }] } } as object) }
  ],
  variants: [
    { name: 'Loud', typename: 'Text', ...({ parameters: { color: 'var(--brand-loud)' } } as object) }
  ],
  metadata: {
    styles: {
      colors: { Accent: 'var(--brand-accent)' },
      text: { Body: { color: 'var(--brand-body)' } }
    }
  }
};

describe('CMP-008 AC2 — tokensReferencedByPlan', () => {
  it('reads the tokens of a component the plan lands', () => {
    expect(tokensReferencedByPlan(source, plan({ components: [component('/Card')] }))).toEqual(['--brand-surface']);
  });

  it('🔴 does not cite a component the user chose to skip', () => {
    // The whole reason the scan is plan-scoped. A banner that names a token
    // from something the user deliberately left behind is the kind of note
    // people learn to skim past — ResultStage's own LIB-006 comment makes the
    // same argument about the legacy banner.
    const scoped = plan({ components: [component('/Card'), component('/Sidebar', SKIP)] });
    expect(tokensReferencedByPlan(source, scoped)).toEqual(['--brand-surface']);
  });

  it('reads both when both land', () => {
    const both = plan({ components: [component('/Card'), component('/Sidebar')] });
    expect(tokensReferencedByPlan(source, both)).toEqual(['--brand-surface', '--sidebar-ink']);
  });

  it('ignores a component the plan names but the source does not have', () => {
    expect(tokensReferencedByPlan(source, plan({ components: [component('/Nope')] }))).toEqual([]);
  });

  it('reads the tokens of a landing variant, keyed by typename and name', () => {
    expect(tokensReferencedByPlan(source, plan({ variants: [item('Loud', ADD, 'Text')] }))).toEqual(['--brand-loud']);
  });

  it('does not read a variant whose typename does not match', () => {
    expect(tokensReferencedByPlan(source, plan({ variants: [item('Loud', ADD, 'Group')] }))).toEqual([]);
  });

  it('reads a colour style whose definition IS a token reference', () => {
    // A style merges into the target's metadata, where nothing else will look
    // at it again — so if it carries the dependency, this is the only chance.
    expect(tokensReferencedByPlan(source, plan({ styles: { colors: [item('Accent')], text: [] } }))).toEqual([
      '--brand-accent'
    ]);
  });

  it('reads a text style definition too', () => {
    expect(tokensReferencedByPlan(source, plan({ styles: { colors: [], text: [item('Body')] } }))).toEqual([
      '--brand-body'
    ]);
  });

  it('does not read a style the plan skips', () => {
    expect(
      tokensReferencedByPlan(source, plan({ styles: { colors: [item('Accent', SKIP)], text: [] } }))
    ).toEqual([]);
  });

  it('reads an empty source without complaining', () => {
    expect(tokensReferencedByPlan({}, plan({ components: [component('/Card')] }))).toEqual([]);
  });

  it('🔴 takes the SERIALISED MODEL, so a v2-format source is not a silent zero', () => {
    // `noodl-mcp`'s `entryTokens` scans `project.json`, which is right for the
    // shelf (all 75 entries are legacy single-file projects) and wrong for the
    // editor: a v2 project keeps components in `components/**` and its
    // `project.json` holds almost nothing. Passing `ProjectModel.toJSON()` is
    // what makes format irrelevant — this source has no file behind it at all.
    const v2Shaped: SourceProjectJson = {
      components: [{ name: '/Page', ...({ graph: { roots: [{ parameters: { fill: 'var(--v2-only)' } }] } } as object) }]
    };
    expect(tokensReferencedByPlan(v2Shaped, plan({ components: [component('/Page')] }))).toEqual(['--v2-only']);
  });
});

describe('CMP-008 AC2 — unresolvedTokensForPlan', () => {
  const landing = plan({ components: [component('/Card'), component('/Sidebar')] });

  it('subtracts the tokens the target defines', () => {
    const defined = new Set(['--brand-surface']);
    expect(unresolvedTokensForPlan(source, landing, defined)).toEqual(['--sidebar-ink']);
  });

  it('reports nothing when the target defines everything', () => {
    const defined = new Set(['--brand-surface', '--sidebar-ink']);
    expect(unresolvedTokensForPlan(source, landing, defined)).toEqual([]);
  });

  it('reports everything when the target defines nothing', () => {
    expect(unresolvedTokensForPlan(source, landing, new Set())).toEqual(['--brand-surface', '--sidebar-ink']);
  });
});

describe('CMP-008 AC2 — describeUnresolvedTokens', () => {
  it('says nothing at all when nothing is unresolved', () => {
    // Not an empty string: the caller pushes nothing, so a clean import has no
    // warning entry rather than a present-but-blank one.
    expect(describeUnresolvedTokens([])).toBeUndefined();
  });

  it('names every unresolved token', () => {
    const sentence = describeUnresolvedTokens(['--a', '--b'])!;
    expect(sentence).toContain('--a');
    expect(sentence).toContain('--b');
  });

  it('says what will happen, because nothing else ever will', () => {
    // The defect is that an unresolved token is an unset property, not an
    // error. A warning that only said "2 tokens missing" would leave the
    // person with no way to connect it to the thing they are looking at.
    const sentence = describeUnresolvedTokens(['--a'])!;
    expect(sentence).toMatch(/without reporting an error/);
    expect(sentence).toMatch(/draw unstyled/);
  });

  it('says what to do about it, in the person’s vocabulary', () => {
    // `install_prefab` tells an agent to call `set_project_tokens`. The
    // person's equivalent is the panel, not the tool.
    expect(describeUnresolvedTokens(['--a'])!).toContain('Design Tokens');
  });

  it('counts and agrees with itself in the singular', () => {
    const sentence = describeUnresolvedTokens(['--a'])!;
    expect(sentence).toContain('1 design token your project does not define');
    expect(sentence).toContain('It resolves to nothing');
    // Only the COUNT clause has to agree — "Design Tokens panel" and "tokens
    // your project has" are plural in both readings and correctly so.
    expect(sentence).not.toContain('design tokens');
    expect(sentence).not.toContain('They resolve');
  });

  it('counts and agrees with itself in the plural', () => {
    const sentence = describeUnresolvedTokens(['--a', '--b', '--c'])!;
    expect(sentence).toContain('3 design tokens your project does not define');
    expect(sentence).toContain('They resolve to nothing');
  });
});

describe('CMP-008 AC2 — tokenWarningsFor, the whole decision apply() makes', () => {
  const landing = plan({ components: [component('/Card')] });

  it('returns one warning when a landing component reads a token the target lacks', () => {
    const warnings = tokenWarningsFor(landing, source, new Set());
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('--brand-surface');
  });

  it('returns nothing when the target defines everything', () => {
    expect(tokenWarningsFor(landing, source, new Set(['--brand-surface']))).toEqual([]);
  });

  it('🔴 returns nothing for an export, however many tokens are unresolved', () => {
    /*
     * The exemption, graded by RUNNING it. `openExportFlow` stages the
     * selection into a throwaway project that defines no tokens at all, so
     * every token a part reads would read unresolved — a warning on every
     * export, about nothing.
     *
     * It lives in this function rather than in an `if` at the call site
     * because a guard there could be switched off with `if (false && …)`
     * while every static check on the caller still passed. See
     * `callers.test.ts`.
     */
    const exporting = plan({ components: [component('/Card')], origin: { kind: 'export-staging' } });
    expect(tokenWarningsFor(exporting, source, new Set())).toEqual([]);
  });

  it('does warn for every OTHER origin, so the exemption is not a blanket off-switch', () => {
    // Enumerated from `ImportOrigin` rather than sampled: `export-staging` is
    // the only exempt one, and a new origin added later must default to being
    // warned about, not to silence.
    const origins: ImportPlan['origin'][] = [
      { kind: 'local-project' },
      { kind: 'downloaded', url: 'https://example.test/accordion.zip', consents: [] }
    ];
    for (const origin of origins) {
      const p = plan({ components: [component('/Card')], origin });
      expect(tokenWarningsFor(p, source, new Set())).toHaveLength(1);
    }
  });
});
