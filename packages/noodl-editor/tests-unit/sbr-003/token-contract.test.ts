/**
 * SBR-003 — the token contract: the floor is real, rides install, and stamps.
 *
 * What is graded here and what is not:
 *
 *  - HERE: the contract's names all resolve (every `THEME_TOKEN_FIELDS` token
 *    is either shipped vocabulary or the one minted custom token); the three
 *    presets are complete and colour-valid; `install()` writes the Studio
 *    block into project metadata and `docs/THEME.md` beside it — for the one
 *    template that declares them and for no other; and the deploy's stamping
 *    function (`generateProjectTokenCss`, the exact function html-processor
 *    calls) turns that metadata into `:root` values that differ from the
 *    shipped defaults.
 *  - NOT HERE (SBR-003 §2's drive probes, owed): that a `var(--token)` in a
 *    dimension port constrains a rendered box; that `applyTheme`'s element
 *    writes visibly beat the `:root` floor in a running viewer. Both are
 *    on-screen claims, and a source-text spec that "passed" on them would be
 *    the launcherHandoff trap again.
 *
 * Every absence assertion below sits beside a known-firing positive on the
 * same instrument — an absent token proves nothing unless the same read finds
 * a present one.
 */
import * as fs from 'fs';
import * as path from 'path';

import { buildDefaultTokenMap } from '@noodl-models/StyleTokensModel/DefaultTokens';
import { generateProjectTokenCss, STYLE_TOKENS_METADATA_KEY } from '@noodl-models/StyleTokensModel/ProjectTokenCss';
import { StyleTokensData } from '@noodl-models/StyleTokensModel/TokenCategories';
import { EmbeddedTemplateProvider } from '@noodl-models/template/EmbeddedTemplateProvider';
import { assertTemplateDocPath } from '@noodl-models/template/ProjectTemplate';
import { siteBuilderTemplate } from '@noodl-models/template/templates/site-builder.template';
import {
  buildSiteDesignTokens,
  buildThemeDoc,
  SITE_MEASURE_TOKEN,
  SITE_THEME_PRESETS,
  THEME_TOKEN_FIELDS,
  ThemeField
} from '@noodl-models/template/templates/siteTheme';

const written = new Map<string, string>();

jest.mock(
  '@noodl/platform',
  () => ({
    filesystem: {
      exists: () => false,
      join: (...parts: string[]) => parts.join('/'),
      makeDirectory: async () => undefined,
      writeFile: async (p: string, contents: string) => {
        written.set(p, contents);
      }
    }
  }),
  { virtual: true }
);

const FIELDS = Object.keys(THEME_TOKEN_FIELDS) as ThemeField[];
const HEX = /^#[0-9a-f]{6}$/;

describe('SBR-003 the contract names resolve against the shipped vocabulary', () => {
  const vocabulary = buildDefaultTokenMap();

  it('every field maps to a shipped token — except the one minted custom token, which is absent by design', () => {
    const rows = FIELDS.map((field) => {
      const token = THEME_TOKEN_FIELDS[field];
      const expected = token === SITE_MEASURE_TOKEN ? 'minted' : 'shipped';
      return `${field} → ${token}: ${vocabulary.has(token) ? 'shipped' : 'minted'} (want ${expected})`;
    });
    for (const row of rows) {
      const [head, tail] = row.split(': ');
      const [got, want] = tail.replace(')', '').split(' (want ');
      expect(`${head}: ${got}`).toBe(`${head}: ${want}`);
    }
    // The instrument can fail: the same read distinguishes a name nobody ships.
    expect(vocabulary.has('--no-such-token')).toBe(false);
    expect(vocabulary.has('--primary')).toBe(true);
  });
});

describe('SBR-003 the presets are complete and colour-valid', () => {
  const presetNames = Object.keys(SITE_THEME_PRESETS) as Array<keyof typeof SITE_THEME_PRESETS>;

  it('three presets, each carrying every field, no empty values', () => {
    expect(presetNames.sort()).toEqual(['night', 'press', 'studio']);
    for (const name of presetNames) {
      const preset = SITE_THEME_PRESETS[name];
      const missing = FIELDS.filter((f) => typeof preset[f] !== 'string' || preset[f].length === 0);
      expect(`${name} missing: ${missing.join(', ')}`).toBe(`${name} missing: `);
    }
  });

  it('every colour field is six-digit hex — and the matcher rejects a non-colour', () => {
    for (const name of presetNames) {
      const preset = SITE_THEME_PRESETS[name];
      for (const field of FIELDS.filter((f) => f.startsWith('color'))) {
        expect(`${name}.${field} hex: ${HEX.test(preset[field])}`).toBe(`${name}.${field} hex: true`);
      }
    }
    // The can-fail control: a keyword and an 8-digit value both fail.
    expect(HEX.test('serif')).toBe(false);
    expect(HEX.test('#1e4d8c00')).toBe(false);
  });

  it('the artifact anchors: Studio #1e4d8c on #fbfaf8 r6, Press #8c2f22, Night #d9a441 on #14161a', () => {
    expect(SITE_THEME_PRESETS.studio.colorPrimary).toBe('#1e4d8c');
    expect(SITE_THEME_PRESETS.studio.colorBackground).toBe('#fbfaf8');
    expect(SITE_THEME_PRESETS.studio.radius).toBe('6px');
    expect(SITE_THEME_PRESETS.press.colorPrimary).toBe('#8c2f22');
    expect(SITE_THEME_PRESETS.night.colorPrimary).toBe('#d9a441');
    expect(SITE_THEME_PRESETS.night.colorBackground).toBe('#14161a');
  });
});

describe('SBR-003 the designTokens block IS the Studio preset', () => {
  const block = buildSiteDesignTokens();
  const byName = new Map(block.customTokens.map((t) => [t.name, t]));

  it('every record field appears with the Studio value', () => {
    for (const field of FIELDS) {
      const token = THEME_TOKEN_FIELDS[field];
      expect(`${token}: ${byName.get(token)?.value}`).toBe(`${token}: ${SITE_THEME_PRESETS.studio[field]}`);
    }
  });

  it('token names are unique and only the measure is custom', () => {
    expect(byName.size).toBe(block.customTokens.length);
    const customs = block.customTokens.filter((t) => t.isCustom).map((t) => t.name);
    expect(customs).toEqual([SITE_MEASURE_TOKEN]);
  });

  it('the companions ride the floor: hover, ring, accent-foreground, raised, border steps, muted', () => {
    for (const name of [
      '--primary-hover',
      '--ring',
      '--accent-foreground',
      '--surface-raised',
      '--border-subtle',
      '--border-strong',
      '--muted'
    ]) {
      expect(`${name} on floor: ${byName.has(name)}`).toBe(`${name} on floor: true`);
    }
  });
});

describe('SBR-003 install writes the floor and the doc', () => {
  beforeEach(() => written.clear());

  const provider = new EmbeddedTemplateProvider();

  it('site-builder’s project.json carries metadata.designTokens = the Studio block', async () => {
    await provider.install('embedded://site-builder', '/tmp/sbr003-sb');
    const project = JSON.parse(written.get('/tmp/sbr003-sb/project.json'));
    const metadata = project.metadata as Record<string, unknown>;
    expect(metadata[STYLE_TOKENS_METADATA_KEY]).toEqual(buildSiteDesignTokens());
    // …without disturbing SBR-002's key on the same object.
    expect(metadata.initialOpenComponent).toBe('/Pages/Setup');
  });

  it('hello-world installs as before: no designTokens, no docs — the unconditional-write control', async () => {
    await provider.install('embedded://hello-world', '/tmp/sbr003-hw');
    const project = JSON.parse(written.get('/tmp/sbr003-hw/project.json'));
    const metadata = project.metadata as Record<string, unknown> | undefined;
    expect(metadata === undefined || !(STYLE_TOKENS_METADATA_KEY in metadata)).toBe(true);
    expect([...written.keys()].filter((p) => p.includes('/docs/'))).toEqual([]);
    // The absence reads against a writer that demonstrably fires:
    expect(written.has('/tmp/sbr003-hw/project.json')).toBe(true);
  });

  it('docs/THEME.md lands, and it states the whole contract: every field, every preset primary', async () => {
    await provider.install('embedded://site-builder', '/tmp/sbr003-doc');
    const doc = written.get('/tmp/sbr003-doc/docs/THEME.md');
    expect(doc).toBeDefined();
    expect(doc).toBe(buildThemeDoc());
    for (const field of FIELDS) {
      expect(`doc names ${field}: ${doc.includes(field)}`).toBe(`doc names ${field}: true`);
    }
    for (const hex of ['#1e4d8c', '#8c2f22', '#d9a441']) {
      expect(`doc carries ${hex}: ${doc.includes(hex)}`).toBe(`doc carries ${hex}: true`);
    }
    // The rule the contract exists to hold:
    expect(doc).toContain('var(--x, fallback)');
  });

  it('the doc declares pull-injection front matter, so listing it costs no always-block tokens', () => {
    const doc = buildThemeDoc();
    expect(doc.startsWith('---\n')).toBe(true);
    expect(doc).toContain('inject: pull');
  });
});

describe('SBR-003 the doc path validator refuses an escape', () => {
  it('accepts the shipped path and plain nested paths', () => {
    expect(() => assertTemplateDocPath('docs/THEME.md')).not.toThrow();
    expect(() => assertTemplateDocPath('docs/decisions/0001-tokens.md')).not.toThrow();
  });

  it('refuses everything that is not a .md inside docs/', () => {
    for (const bad of ['../evil.md', 'docs/../evil.md', 'docs/', 'docs', 'evil.md', 'docs/x.txt', 'docs//x.md', '/docs/x.md', 'docs\\x.md']) {
      expect(() => assertTemplateDocPath(bad)).toThrow();
    }
  });
});

describe('SBR-003 the deploy stamp: metadata in, :root out', () => {
  /** The exact reader html-processor hands to the stamp. */
  const projectWith = (data: StyleTokensData | undefined) => ({
    getMetaData: (key: string) => (key === STYLE_TOKENS_METADATA_KEY ? data : undefined)
  });

  it('an installed project stamps Studio values over the shipped defaults', () => {
    const css = generateProjectTokenCss(projectWith(siteBuilderTemplate.designTokens));
    expect(css).toContain('--primary: #1e4d8c;');
    expect(css).toContain('--radius-md: 6px;');
    expect(css).toContain(`${SITE_MEASURE_TOKEN}: 44rem;`);
    // The value it replaced must be GONE — same instrument, opposite reading.
    expect(css).not.toContain('--primary: #3b82f6;');
  });

  it('a bare project stamps the shipped defaults and no site token — the floor-is-the-fallback control', () => {
    const css = generateProjectTokenCss(projectWith(undefined));
    expect(css).toContain('--primary: #3b82f6;');
    expect(css).not.toContain(SITE_MEASURE_TOKEN);
  });
});

describe('SBR-003 the shipped declaration matches the artefact on disk', () => {
  it('the applier in the generated content reads exactly the contract fields (post-regeneration gate)', () => {
    // 🔴 Reads the artefact directly, like SBR-002's declaration spec: the
    // component sets are the source, but what installs is this JSON — an edit
    // to `sb006Components.ts` not followed by `npm run template:site-builder`
    // reddens HERE as well as in the byte gate, with the missing keys named.
    const shipped = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'editor', 'src', 'models', 'template', 'templates', 'site-builder.content.json'),
        'utf-8'
      )
    );
    const scripts: string[] = [];
    const walk = (nodes: Array<{ type?: string; children?: unknown[]; parameters?: { functionScript?: string } }>) => {
      for (const node of nodes || []) {
        if (node.parameters?.functionScript) scripts.push(node.parameters.functionScript);
        walk((node.children as typeof nodes) || []);
      }
    };
    for (const component of shipped.components as Array<{ graph: { roots: never[] } }>) {
      walk(component.graph.roots);
    }
    const applier = scripts.find((s) => s.includes('document.documentElement'));
    expect(applier).toBeDefined();
    for (const field of FIELDS) {
      expect(`shipped applier reads ${field}: ${applier.includes(`t.${field}`)}`).toBe(
        `shipped applier reads ${field}: true`
      );
    }
  });
});
