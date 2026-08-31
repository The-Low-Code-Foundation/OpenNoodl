/**
 * AIX-006 — style vocabulary MCP tools, end-to-end over a real client/server pair.
 *
 * get_style_vocabulary enumerates tokens/variants/presets; set_project_tokens
 * and set_style_preset persist overrides into nodegx.project.json → metadata,
 * which is exactly where the editor's importer reads them back.
 */
import type { StyleVocabulary } from '../src/editor-deps';
import { call, connect, copyFixture, readJson, reveal, TestSession } from './helpers';

interface ProjectFile {
  metadata?: { designTokens?: { version: number; customTokens: Array<{ name: string; value: string }> } };
}

describe('AIX-006 style MCP tools', () => {
  let session: TestSession;
  let projectDir: string;

  beforeEach(async () => {
    projectDir = copyFixture();
    session = await connect(projectDir, true);
    await reveal(session, 'theme'); // AWP-006 — the style writes are deferred; the read is not
  });

  afterEach(async () => {
    await session.close();
  });

  it('get_style_vocabulary enumerates tokens, elements and presets', async () => {
    const { isError, data } = await call<StyleVocabulary>(session, 'get_style_vocabulary', {});
    expect(isError).toBe(false);
    const tokenNames = data.categories.flatMap((c) => c.tokens.map((t) => t.name));
    expect(tokenNames).toContain('--primary');
    expect(tokenNames).toContain('--space-4');
    const button = data.elements.find((e) => e.nodeType === 'net.noodl.controls.button');
    expect(button).toBeDefined();
    expect(button!.variants).toContain('primary');
    expect(data.presets.map((p) => p.id)).toContain('minimal');
  });

  it('get_style_vocabulary detail=prompt returns the compact block', async () => {
    const { data } = await call<{ vocabulary: string }>(session, 'get_style_vocabulary', { detail: 'prompt' });
    expect(data.vocabulary).toContain('var(--name)');
    expect(data.vocabulary).toContain('--primary');
  });

  /**
   * DSG-005 — the external client gets the arrangements, not only the atoms.
   *
   * This is the "one substrate, two clients" half of the acceptance: the field
   * was added to `buildStyleVocabulary`/`renderStyleVocabulary` and reaches the
   * MCP surface with no second wiring. If a future change routes compositions
   * through a tool description or a second dialect instead, this fails.
   */
  it('get_style_vocabulary hands over the named compositions, each naming its recipe', async () => {
    const { data } = await call<StyleVocabulary>(session, 'get_style_vocabulary', {});
    const ids = data.compositions.map((c) => c.id);
    for (const required of ['card', 'shell', 'sectionHead', 'primaryButton', 'outlineButton']) {
      expect(ids).toContain(required);
    }

    const card = data.compositions.find((c) => c.id === 'card');
    expect(card).toBeDefined();
    expect(card!.nodeType).toBe('Group');
    expect(card!.parameters.borderRadius).toBe('var(--radius-xl)');
    expect(card!.recipe).toBe('ui-card-grid-repeater');

    // A dimension arrives as { value, unit } — a "100%" string is dropped by the
    // runtime, so the wire format has to be the one that survives.
    expect(card!.parameters.width).toEqual({ value: 100, unit: '%' });

    for (const c of data.compositions) {
      // Connection-only ports: setting either as a parameter is discarded AND rejected.
      expect(Object.keys(c.parameters)).not.toContain('variant');
      expect(Object.keys(c.parameters)).not.toContain('size');
    }

    // Ids, never an inlined graph — the recipes stay the single copy.
    const serialized = JSON.stringify(data.compositions);
    expect(serialized).not.toContain('"nodes"');
    expect(serialized).not.toContain('"connections"');
  });

  /**
   * DSG-005 — the wire size, measured where it is billed.
   *
   * MCP responses go out pretty-printed, so the cost of this tool is the cost of
   * `JSON.stringify(payload, null, 2)` and not of the object. Measured at the
   * point compositions landed: detail "prompt" 9.5k chars (~2.4k tokens),
   * detail "full" 36.8k chars (~9.2k tokens) — up from 5.1k/26.8k. The ceilings
   * are round numbers in the printed unit and exist to catch the next thing that
   * doubles the block, not to pin the current byte count.
   *
   * ═════════════════════════════════════════════════════════════════════════
   * 🔴 **RAISED 2026-08-31 (VIB-003), and the first of the two reasons is that
   * THIS GATE WAS ALREADY RED ON `main`.**
   *
   * Measured with VIB-003's own icon block removed entirely: prompt **3,161**
   * against 3,000, full **11,720** against 11,000. The cause is VIB-002, which
   * added ten decorative tokens (five gradients, two glass, three fluid display
   * sizes) and three compositions to the vocabulary this tool renders — a
   * legitimate growth, of exactly the kind this comment says to move the number
   * for. What went wrong is that nobody moved it: VIB-002's gate table
   * (`VIB-002-THE-CEILING.md` §8) ran the catalog gates, both typechecks, the
   * viewer suite and its own look file, and **never ran the noodl-mcp suite** —
   * so a red gate in another package shipped unnoticed. Filed as **V24**.
   *
   * ⚠️ The lesson is not "raise ceilings sooner". It is that a change to the
   * design-token model is a change to an MCP response, and the two live in
   * different packages with different suites. The vocabulary is rendered from
   * `DEFAULT_TOKENS` and `STYLE_COMPOSITIONS`; anything that adds to either is
   * billed here, on every turn, in a package its author may never run.
   *
   * VIB-003's own contribution is small by comparison — the `icons` block costs
   * ~3 tokens on `full` and ~40 on `prompt` for a project with **no** icon set
   * (the "none installed" sentence), and roughly 150 more for one that has
   * Lucide, because the glyph list is capped at 36 with the remainder counted
   * rather than listed (`iconSets.ts`, `GLYPH_SAMPLE`).
   *
   * New ceilings carry headroom for a project that actually has an icon set,
   * which the fixture here does not.
   * ═════════════════════════════════════════════════════════════════════════
   */
  it('stays inside its wire budget, in the shape the model is billed for', async () => {
    const promptResult = await session.client.callTool({
      name: 'get_style_vocabulary',
      arguments: { detail: 'prompt' }
    });
    const fullResult = await session.client.callTool({ name: 'get_style_vocabulary', arguments: {} });
    const wireChars = (r: unknown) =>
      ((r as { content: Array<{ text: string }> }).content ?? []).reduce((n, c) => n + (c.text?.length ?? 0), 0);
    // /4 to match `toolDisclosure`'s convention, so the two budgets are comparable.
    const promptTokens = Math.round(wireChars(promptResult) / 4);
    const fullTokens = Math.round(wireChars(fullResult) / 4);
    expect({
      prompt: promptTokens <= 3_500 ? 'within budget' : promptTokens,
      full: fullTokens <= 12_500 ? 'within budget' : fullTokens
    }).toEqual({ prompt: 'within budget', full: 'within budget' });
  });

  it('set_project_tokens persists overrides into nodegx.project.json metadata', async () => {
    const { isError, data } = await call<{ ok: boolean; updated: string[] }>(session, 'set_project_tokens', {
      tokens: [{ name: '--primary', value: '#7c3aed' }]
    });
    expect(isError).toBe(false);
    expect(data.updated).toContain('--primary');

    const project = readJson<ProjectFile>(projectDir, 'nodegx.project.json');
    const custom = project.metadata?.designTokens?.customTokens ?? [];
    expect(custom.find((t) => t.name === '--primary')?.value).toBe('#7c3aed');

    // The override is reflected on the next vocabulary read (same project source).
    const { data: vocab } = await call<StyleVocabulary>(session, 'get_style_vocabulary', {});
    const primary = vocab.categories.flatMap((c) => c.tokens).find((t) => t.name === '--primary');
    expect(primary?.isCustom).toBe(true);
  });

  it('set_project_tokens rejects a non-custom-property token name', async () => {
    const { isError, data } = await call<{ error?: { code: string } }>(session, 'set_project_tokens', {
      tokens: [{ name: 'primary', value: '#000' }]
    });
    expect(isError).toBe(true);
    expect(data.error?.code).toBe('invalid-argument');
  });

  it('set_style_preset applies a preset as token overrides', async () => {
    const { isError, data } = await call<{ ok: boolean; preset: string; customTokenCount: number }>(
      session,
      'set_style_preset',
      { preset_id: 'minimal' }
    );
    expect(isError).toBe(false);
    expect(data.preset).toBe('minimal');
    expect(data.customTokenCount).toBeGreaterThan(0);

    const project = readJson<ProjectFile>(projectDir, 'nodegx.project.json');
    expect((project.metadata?.designTokens?.customTokens ?? []).length).toBeGreaterThan(0);
  });

  it('set_style_preset rejects an unknown preset', async () => {
    const { isError, data } = await call<{ error?: { code: string } }>(session, 'set_style_preset', {
      preset_id: 'nope'
    });
    expect(isError).toBe(true);
    expect(data.error?.code).toBe('not-found');
  });

  it('style write tools are absent in read-only mode', async () => {
    await session.close();
    session = await connect(projectDir, false);
    const tools = await session.client.listTools();
    const names = tools.tools.map((t) => t.name);
    expect(names).toContain('get_style_vocabulary'); // read tool always present
    expect(names).not.toContain('set_project_tokens');
    expect(names).not.toContain('set_style_preset');
  });
});

/**
 * DEF-006 (b) — AC1's sentence, as a test.
 *
 * > *"when I ask the thing I am building for the tools that change how my app
 * > looks, using the words I would actually use, it shows me them."*
 *
 * The style writes are deferred behind `find_tools`, and `find_tools` searched
 * tool *names* only — so the group titled "Design tokens", whose purpose is
 * "change the design system", was reachable by `group: "theme"` and by nothing a
 * person would type. An agent instructed to style on-system asked for a theme
 * and was told there was nothing there, which is a named contributing cause of
 * phase 78's D10 (*the template generators bypass the design system*).
 *
 * ⚠️ This connects **without** `reveal(session, 'theme')` — the whole point is
 * the door, so pre-opening it would test nothing.
 */
describe('DEF-006 (b) — finding the tools that change how the app looks', () => {
  let session: TestSession;

  beforeEach(async () => {
    session = await connect(copyFixture(), true);
  });

  afterEach(async () => {
    await session.close();
  });

  it('reveals both style writes for every word somebody would search with', async () => {
    // AC3. Each in its own call on a fresh needle — a reveal is sticky, so
    // asserting the second query after the first has already opened the group
    // would pass on a server where only the first works.
    for (const query of ['theme', 'design', 'colour', 'color', 'palette', 'style', 'style guide', 'branding']) {
      const s = await connect(copyFixture(), true);
      try {
        const found = await call<{ revealed: string[] }>(s, 'find_tools', { query });
        expect({ query, revealed: found.data.revealed.sort() }).toEqual({
          query,
          revealed: expect.arrayContaining(['set_project_tokens', 'set_style_preset'])
        });
        // And advertised for real, not merely named in a payload.
        const names = (await s.client.listTools()).tools.map((t) => t.name);
        expect({ query, has: names.includes('set_project_tokens') }).toEqual({ query, has: true });
      } finally {
        await s.close();
      }
    }
  });

  it('⚠️ CONTROL — the same door stays shut for a query that means nothing here', async () => {
    // AC4. Without this the test above passes on a `find_tools` that reveals
    // everything for any input, which is the deferral deleted rather than fixed.
    for (const query of ['zzzznotathing', 'spreadsheet formulas', 'book a flight']) {
      const found = await call<{ revealed: string[] }>(session, 'find_tools', { query });
      expect({ query, revealed: found.data.revealed }).toEqual({ query, revealed: [] });
    }
  });

  it('⚠️ CONTROL — a query about roles still reveals four backend tools, not sixty', async () => {
    // The reason group matching reads ids, titles and keywords and NOT the
    // `purpose` prose. `backend`'s purpose contains the word "roles"; searching
    // it would turn this partial reveal into the whole group and report it
    // advertised, breaking the written contract that a partial reveal must leave
    // a model a reason to ask for the rest.
    const found = await call<{ revealed: string[]; groups: Array<{ group: string; advertised: boolean }> }>(
      session,
      'find_tools',
      { query: 'role' }
    );
    expect(found.data.revealed).toContain('create_backend_role');
    expect(found.data.revealed).not.toContain('provision_backend');
    expect(found.data.groups.find((g) => g.group === 'backend')).toMatchObject({ advertised: false });
  });
});
