/**
 * AIX-009 — project docs MCP tools, end-to-end over a real client/server pair
 * against a real project directory on disk.
 *
 * This is acceptance criterion 5: list/get/write work, and paths outside
 * `docs/` are rejected. Containment gets the most attention here because it is
 * the one failure that is not merely annoying — `write_project_doc` is a write
 * tool pointed at a user's project folder, and the path check is the whole of
 * what keeps it inside `docs/`.
 */
import * as fs from 'fs';
import * as path from 'path';

import { call, connect, copyFixture, exists, TestSession } from './helpers';
import type { ListProjectDocsResponse } from '../src/tools/docsTools';
import type { ToolErrorPayload } from '../src/tools/responses';

interface DocResponse {
  path: string;
  bytes: number;
  modified: string;
  content: string;
}

interface WriteResponse {
  ok: boolean;
  path: string;
  created: boolean;
  bytes: number;
}

function writeDoc(projectDir: string, rel: string, content: string): void {
  const abs = path.join(projectDir, ...rel.split('/'));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
}

describe('AIX-009 project docs MCP tools', () => {
  let session: TestSession;
  let projectDir: string;

  beforeEach(async () => {
    projectDir = copyFixture();
    session = await connect(projectDir, true);
  });

  afterEach(async () => {
    await session.close();
  });

  it('reports a project with no docs/ as having none, and names what is missing', async () => {
    const { isError, data } = await call<ListProjectDocsResponse>(session, 'list_project_docs');
    expect(isError).toBe(false);
    expect(data.hasDocs).toBe(false);
    expect(data.docs).toEqual([]);
    expect(data.missing.map((m) => m.path).sort()).toEqual([
      'docs/ARCHITECTURE.md',
      'docs/BRIEF.md',
      'docs/CONVENTIONS.md'
    ]);
  });

  it('lists known and unknown markdown, and keys hasDocs off CONVENTIONS.md alone', async () => {
    writeDoc(projectDir, 'docs/BRIEF.md', '# Brief\n');
    let { data } = await call<ListProjectDocsResponse>(session, 'list_project_docs');
    // A BRIEF without a CONVENTIONS is not a documented project — that single
    // predicate is what AIX-010's recommendation banner keys off.
    expect(data.hasDocs).toBe(false);

    writeDoc(projectDir, 'docs/CONVENTIONS.md', '# Conventions\n- Rule\n');
    writeDoc(projectDir, 'docs/decisions/0001-why-sqlite.md', '# Why SQLite\n');
    writeDoc(projectDir, 'docs/notes.txt', 'not markdown');

    ({ data } = await call<ListProjectDocsResponse>(session, 'list_project_docs'));
    expect(data.hasDocs).toBe(true);
    const paths = data.docs.map((d) => d.path);
    expect(paths).toContain('docs/BRIEF.md');
    expect(paths).toContain('docs/CONVENTIONS.md');
    expect(paths).toContain('docs/decisions/0001-why-sqlite.md');
    expect(paths).not.toContain('docs/notes.txt');
    expect(data.missing.map((m) => m.path)).toEqual(['docs/ARCHITECTURE.md']);

    const conventions = data.docs.find((d) => d.path === 'docs/CONVENTIONS.md');
    expect(conventions?.kind).toBe('conventions');
    // BLD-007: one vocabulary for both clients. `always` is what the editor
    // panel says of the same file; this used to be a second word, `default`.
    expect(conventions?.injection).toBe('always');
    // ARCHITECTURE is pull-only, which is a fact the agent needs to plan around.
    const architecture = data.missing.find((m) => m.path === 'docs/ARCHITECTURE.md');
    expect(architecture).toBeDefined();
  });

  it('BLD-007 — reports the injection a doc declared for itself, not a table lookup', async () => {
    writeDoc(projectDir, 'docs/CONVENTIONS.md', '# Conventions\n');
    writeDoc(
      projectDir,
      'docs/uk-vat.md',
      ['---', 'title: UK VAT rules', 'inject: always', 'when: tax, invoices', '---', '', '# VAT', '20% standard.'].join('\n')
    );
    writeDoc(projectDir, 'docs/brand-voice.md', '# Brand voice\n\nPlain words.\n');

    const { data } = await call<ListProjectDocsResponse>(session, 'list_project_docs');

    const vat = data.docs.find((d) => d.path === 'docs/uk-vat.md');
    expect(vat?.injection).toBe('always');
    expect(vat?.title).toBe('UK VAT rules');
    expect(vat?.when).toEqual(['tax', 'invoices']);

    // No front matter: the default that cannot cost an unrelated project
    // anything, and a title taken from the doc's own first heading.
    const voice = data.docs.find((d) => d.path === 'docs/brand-voice.md');
    expect(voice?.injection).toBe('pull');
    expect(voice?.title).toBe('Brand voice');
    // A user doc is no longer reported as a second-class file with no kind and
    // no injection at all — which is how D9 read on the wire.
    expect(voice?.kind).toBeUndefined();
  });

  it('reads a doc by full path and by bare name', async () => {
    writeDoc(projectDir, 'docs/CONVENTIONS.md', '# Conventions\n- Page Root\n');

    const full = await call<DocResponse>(session, 'get_project_doc', { path: 'docs/CONVENTIONS.md' });
    expect(full.isError).toBe(false);
    expect(full.data.content).toContain('Page Root');

    const bare = await call<DocResponse>(session, 'get_project_doc', { path: 'CONVENTIONS.md' });
    expect(bare.isError).toBe(false);
    expect(bare.data.path).toBe('docs/CONVENTIONS.md');
  });

  it('reports a missing doc as not-found, listing what does exist', async () => {
    writeDoc(projectDir, 'docs/BRIEF.md', '# Brief\n');
    const { isError, data } = await call<ToolErrorPayload>(session, 'get_project_doc', {
      path: 'docs/ARCHITECTURE.md'
    });
    expect(isError).toBe(true);
    expect(data.error.code).toBe('not-found');
    expect((data.error.details as { available: string[] }).available).toEqual(['docs/BRIEF.md']);
  });

  it('writes a whole doc, creating docs/ and reporting creation', async () => {
    const { isError, data } = await call<WriteResponse>(session, 'write_project_doc', {
      path: 'docs/CONVENTIONS.md',
      content: '# Conventions\n\n- Every page root is a Group named `Page Root`.\n'
    });
    expect(isError).toBe(false);
    expect(data.created).toBe(true);
    expect(exists(projectDir, 'docs/CONVENTIONS.md')).toBe(true);
    expect(fs.readFileSync(path.join(projectDir, 'docs/CONVENTIONS.md'), 'utf8')).toContain('Page Root');

    // Whole-file replacement, not a patch — a second write replaces, not appends.
    const again = await call<WriteResponse>(session, 'write_project_doc', {
      path: 'docs/CONVENTIONS.md',
      content: '# Conventions\n\n- Different rule.\n'
    });
    expect(again.data.created).toBe(false);
    const after = fs.readFileSync(path.join(projectDir, 'docs/CONVENTIONS.md'), 'utf8');
    expect(after).toContain('Different rule');
    expect(after).not.toContain('Page Root');
  });

  it('writes into docs/decisions/ and lists it back', async () => {
    await call<WriteResponse>(session, 'write_project_doc', {
      path: 'docs/decisions/0002-no-router.md',
      content: '# No router\nSingle page.\n'
    });
    const { data } = await call<ListProjectDocsResponse>(session, 'list_project_docs');
    expect(data.docs.map((d) => d.path)).toContain('docs/decisions/0002-no-router.md');
  });

  it('rejects every shape of path that escapes docs/, on read and on write', async () => {
    const escapes = [
      '../nodegx.project.json',
      'docs/../nodegx.project.json',
      '../../etc/passwd.md',
      '/etc/passwd.md',
      'docs/../../outside.md',
      './../outside.md'
    ];

    for (const bad of escapes) {
      const read = await call<ToolErrorPayload>(session, 'get_project_doc', { path: bad });
      expect(read.isError).toBe(true);
      expect(read.data.error.code).toBe('invalid-argument');

      const write = await call<ToolErrorPayload>(session, 'write_project_doc', {
        path: bad,
        content: 'pwned'
      });
      expect(write.isError).toBe(true);
      expect(write.data.error.code).toBe('invalid-argument');
    }

    // Nothing outside docs/ was created, and the project file is intact.
    expect(exists(projectDir, 'outside.md')).toBe(false);
    expect(fs.readFileSync(path.join(projectDir, 'nodegx.project.json'), 'utf8')).not.toContain('pwned');
  });

  it('rejects non-markdown targets rather than silently renaming them', async () => {
    const { isError, data } = await call<ToolErrorPayload>(session, 'write_project_doc', {
      path: 'docs/config.json',
      content: '{}'
    });
    expect(isError).toBe(true);
    expect(data.error.code).toBe('invalid-argument');
    expect(exists(projectDir, 'docs/config.json')).toBe(false);
  });

  it('seeds the three starter docs and never overwrites on a second call', async () => {
    const first = await call<{ ok: boolean; created: string[] }>(session, 'seed_project_docs');
    expect(first.data.created.sort()).toEqual(['docs/ARCHITECTURE.md', 'docs/BRIEF.md', 'docs/CONVENTIONS.md']);

    fs.writeFileSync(path.join(projectDir, 'docs/BRIEF.md'), 'MINE', 'utf8');
    const second = await call<{ ok: boolean; created: string[] }>(session, 'seed_project_docs');
    expect(second.data.created).toEqual([]);
    expect(fs.readFileSync(path.join(projectDir, 'docs/BRIEF.md'), 'utf8')).toBe('MINE');
  });

  it('does not register the write tools in read-only mode', async () => {
    await session.close();
    session = await connect(projectDir, false);
    const names = (await session.client.listTools()).tools.map((t) => t.name);
    expect(names).toContain('list_project_docs');
    expect(names).toContain('get_project_doc');
    expect(names).not.toContain('write_project_doc');
    expect(names).not.toContain('seed_project_docs');
  });
});
