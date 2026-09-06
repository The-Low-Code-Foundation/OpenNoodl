import * as fs from 'fs';
import * as path from 'path';

import { Catalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';

/**
 * EXP-016 — the typeface that ships unused.
 *
 * An exported app downloaded four Inter weights, linked their stylesheet, defined `--font-sans`
 * naming Inter first, reported four faces loaded in `document.fonts` — and then rendered every word
 * in the platform UI font, with buttons falling through to `Arial`. Everything needed was present
 * and correct; `src/styles/base.css` wrote `font-family: system-ui, sans-serif` on `body` as a
 * literal, and nothing read the token.
 *
 * The runtime's own rule is two declarations, in `StyleTokensModel/TokenResolver.ts` `generateCss`,
 * appended after the `:root` block. This transcribes it, plus the `font: inherit` the form controls
 * need — a `<button>` does not inherit `font-family` from `body`, which is why the buttons were
 * wrong in a second, different way from everything else on the page.
 *
 * Graded on two projects: `puppy-test-3`, the only fixture in this package that carries design
 * tokens, and `ground-desk`, which carries none — the fallback arm.
 */

const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');
const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const emit = (fixture: string) => emitApp(parseProject(path.join(__dirname, 'fixtures', fixture), catalog), catalog);

const tokened = emit('puppy-test-3');
const tokenless = emit('ground-desk');
const BASE = 'src/styles/base.css';
const TOKENS = 'src/styles/tokens.css';

// ---------------------------------------------------------------------------------------------------
describe('§A the body rule is the runtime’s, both declarations', () => {
  test('A1 the body block, exactly', () => {
    expect(tokened.files[BASE]).toContain(
      'body {\n  margin: 0;\n  font-family: var(--font-sans);\n  color: var(--foreground);\n}'
    );
  });

  test('A2 the literal that caused this is gone — no bare system-ui declaration anywhere', () => {
    expect(tokened.files[BASE]).not.toContain('font-family: system-ui, sans-serif;');
  });

  test('A3 the colour floor travels with it — copying half a two-line rule is how the halves drift', () => {
    expect(tokened.files[BASE]).toContain('color: var(--foreground);');
  });

  test('A4 the runtime’s own rule still says both, so this transcription is still a transcription', () => {
    const resolver = fs.readFileSync(
      path.join(
        __dirname,
        '..',
        '..',
        'noodl-editor',
        'src',
        'editor',
        'src',
        'models',
        'StyleTokensModel',
        'TokenResolver.ts'
      ),
      'utf8'
    );
    expect(resolver).toContain('font-family: var(--font-sans);');
    expect(resolver).toContain('color: var(--foreground);');
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§B the form controls — the arm that was wrong in a second, different way', () => {
  test('B1 button, input, select and textarea inherit the body font', () => {
    expect(tokened.files[BASE]).toContain('button,\ninput,\nselect,\ntextarea {\n  font: inherit;\n}');
  });

  test('B2 all four are named — a rule that named only `button` would leave the text inputs on the UA default', () => {
    const rule = /button,\ninput,\nselect,\ntextarea \{\n  font: inherit;\n\}/.exec(tokened.files[BASE]);
    expect(rule).not.toBeNull();
  });

  test('B3 the reset is `font`, not `font-family` — the UA also overrides size and weight on a control', () => {
    expect(tokened.files[BASE]).toContain('font: inherit;');
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§C the token is the only name for the typeface', () => {
  test('C1 no literal "Inter" in any emitted CSS outside tokens.css’s own definition', () => {
    for (const [name, source] of Object.entries(tokened.files)) {
      if (!name.endsWith('.css') || name === TOKENS) continue;
      expect(source).not.toContain('Inter');
    }
  });

  test('C2 …and where the project defines it, tokens.css is where it is defined', () => {
    expect(tokened.files[TOKENS]).toContain('--font-sans');
    expect(tokened.files[TOKENS]).toContain('Inter');
  });

  test('C3 a project overriding --font-sans re-fonts the whole app: base.css names the token and nothing else', () => {
    const body = /body \{([^}]*)\}/.exec(tokened.files[BASE])![1];
    expect(body).toContain('var(--font-sans');
    expect(body).not.toMatch(/font-family:\s*["'][A-Za-z]/);
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§D the fallback — the bare var() is safe because every project defines the token', () => {
  test('D1 a project with NO token overrides of its own still emits --font-sans and --foreground', () => {
    // 🔴 This is the row that makes the bare `var()` legitimate, and it was nearly got wrong the
    // other way: a fixture whose `nodegx.project.json` carries no `designTokens` looks token-less,
    // and is not — `parseProject`'s `effectiveTokens` merges the shipped DEFAULT_TOKENS underneath.
    expect(tokenless.files[TOKENS]).toContain('--font-sans:');
    expect(tokenless.files[TOKENS]).toContain('--foreground:');
  });

  test('D2 base.css is byte-identical between the two projects — it is scaffold, not project, output', () => {
    expect(tokenless.files[BASE]).toBe(tokened.files[BASE]);
  });

  test('D3 a project with no noodl_modules links no stylesheet at all — nothing dangles', () => {
    expect(tokenless.files['index.html']).not.toContain('<link rel="stylesheet"');
    expect(tokenless.copies).toEqual([]);
  });

  test('D4 …and the shipped --font-sans names Inter FIRST and the platform font after it', () => {
    // The manifest's documented case: delete `noodl_modules/inter` and the token falls back to the
    // platform UI font, nothing breaks. That fallback lives in the token's own value, which is why
    // it keeps working for a project that never installed the font.
    const value = /--font-sans:\s*([^;]+);/.exec(tokenless.files[TOKENS])![1];
    expect(value.startsWith('Inter')).toBe(true);
    expect(value).toContain('system-ui');
    expect(value).toContain('sans-serif');
  });
});
