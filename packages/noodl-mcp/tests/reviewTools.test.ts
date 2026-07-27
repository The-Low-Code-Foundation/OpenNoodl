/**
 * AIX-010 — `review_project`, end to end over a real client/server pair against
 * a real project directory.
 *
 * The contract worth pinning is what this tool is NOT: it does not draft, it
 * does not write, and it does not carry its own copy of the "never describe the
 * graph" rules. The per-document guidance it returns comes from the editor's own
 * prompt module, so the two consumers cannot drift — a spec asserts the returned
 * text still contains the anti-goals rather than merely being non-empty.
 */
import * as fs from 'fs';
import * as path from 'path';

import { call, connect, TestSession, copyFixture } from './helpers';
import type { ReviewProjectResponse } from '../src/tools/review';

function writeDoc(projectDir: string, rel: string, content: string): void {
  const abs = path.join(projectDir, ...rel.split('/'));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
}

describe('AIX-010 review_project', () => {
  let session: TestSession;
  let projectDir: string;

  beforeEach(async () => {
    projectDir = copyFixture();
    session = await connect(projectDir, true);
  });

  afterEach(async () => {
    await session.close();
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it('returns assembled context and an honest coverage record', async () => {
    const result = await call<ReviewProjectResponse>(session, 'review_project', {});
    expect(result.isError).toBe(false);

    const payload = result.data;
    expect(payload.context).toContain('--- PROJECT OVERVIEW ---');
    expect(payload.coverage.componentsTotal).toBeGreaterThan(0);
    expect(payload.coverage.charsUsed).toBeGreaterThan(0);
    expect(payload.coverage.charsUsed).toBeLessThanOrEqual(payload.coverage.charsBudget);
    expect(payload.summary).toContain('components');
  });

  it('is registered without --allow-writes: reviewing is a read', async () => {
    const readOnly = await connect(projectDir, false);
    try {
      const result = await call<ReviewProjectResponse>(readOnly, 'review_project', {});
      expect(result.isError).toBe(false);
    } finally {
      await readOnly.close();
    }
  });

  it('returns the editor\'s own per-document guidance, anti-goals included', async () => {
    const { data } = await call<ReviewProjectResponse>(session, 'review_project', {});

    expect(data.documents.map((d) => d.kind)).toEqual(['brief', 'architecture', 'conventions']);
    const architecture = data.documents.find((d) => d.kind === 'architecture')!;
    expect(architecture.path).toBe('docs/ARCHITECTURE.md');
    // Not a restatement here — the same string the editor's drafting turn reads.
    expect(architecture.guidance).toContain('node-by-node inventory');
    expect(architecture.guidance).toContain('> TODO:');
    const brief = data.documents.find((d) => d.kind === 'brief')!;
    expect(brief.guidance).toContain('invented product goal stated as fact');
  });

  it('tells the caller to draft and write back, and not to describe the graph', async () => {
    const { data } = await call<ReviewProjectResponse>(session, 'review_project', {});
    expect(data.next).toContain('write_project_doc');
    expect(data.next).toContain('> TODO:');
    expect(data.next).toContain('Never describe the graph');
  });

  it('reports which documents already exist, so a re-run is an edit', async () => {
    const before = await call<ReviewProjectResponse>(session, 'review_project', {});
    expect(before.data.documents.every((d) => d.exists === false)).toBe(true);

    writeDoc(projectDir, 'docs/ARCHITECTURE.md', '# Architecture\n\nWritten by a human.\n');
    const after = await call<ReviewProjectResponse>(session, 'review_project', {});
    const architecture = after.data.documents.find((d) => d.kind === 'architecture')!;
    expect(architecture.exists).toBe(true);
    // And the existing body is folded into the assembly, not ignored.
    expect(after.data.coverage.text.length).toBeGreaterThan(0);
  });

  it('honours a tighter budget and records what it therefore did not read', async () => {
    const { data } = await call<ReviewProjectResponse>(session, 'review_project', {
      maxComponentReads: 1
    });
    expect(data.coverage.read.length).toBeLessThanOrEqual(1);
    if (data.coverage.componentsTotal > 1) {
      expect(data.coverage.notRead.length).toBeGreaterThan(0);
      expect(data.coverage.text).toContain('NOT read');
    }
  });

  it('writes nothing — a review of a project leaves its directory untouched', async () => {
    const listing = () =>
      fs
        .readdirSync(projectDir, { recursive: true } as { recursive: true })
        .map(String)
        .sort();
    const before = listing();
    await call<ReviewProjectResponse>(session, 'review_project', {});
    expect(listing()).toEqual(before);
  });

  it('ranks the components it chose and says why', async () => {
    const { data } = await call<ReviewProjectResponse>(session, 'review_project', {});
    expect(data.ranking.length).toBe(data.coverage.componentsTotal);
    expect(data.ranking[0].rank).toBe(0);
    for (const entry of data.ranking) expect(entry.reason.length).toBeGreaterThan(0);
  });
});
