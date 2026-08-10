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
