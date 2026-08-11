/**
 * BST-006 — what the server says before any tool is called.
 *
 * ## Why the bound half is pinned to a byte
 *
 * BST-006 moved a 60-line string literal out of `server.ts` and into
 * `instructions.ts`. Every paragraph in it answers a measured failure — LAS-006's
 * planned-then-built-something-else, AAQ-005's unreachable pages, LAS-005's
 * confidently-wrong render — and the phase-55 replays that produced those numbers
 * were run against this exact text. A move that "tidied" a sentence would
 * invalidate them silently and nothing else in the suite would notice.
 *
 * So the fixtures in `fixtures/boundInstructions.*.txt` were captured from the
 * build **before** the move, with the project directory substituted out, and this
 * file compares against them. They are a record of a moment, not a spec: a
 * deliberate future change to the briefing edits the fixture in the same commit,
 * and the diff is then the review.
 */

import * as fs from 'fs';
import * as path from 'path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { BOOTSTRAP_INSTRUCTIONS, projectInstructions } from '../src/instructions';
import { createServer, type ServerOptions } from '../src/server';
import { copyFixture } from './helpers';

const PLACEHOLDER = '<PROJECT_DIR>';

function golden(name: string): string {
  return fs.readFileSync(path.join(__dirname, 'fixtures', `boundInstructions.${name}.txt`), 'utf8');
}

async function instructionsOf(options: ServerOptions): Promise<string> {
  const { server } = createServer(options);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'instructions-test', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  const text = client.getInstructions() ?? '';
  await client.close();
  await server.close();
  return text;
}

describe('BST-006 — the bound briefing is unchanged, character for character', () => {
  const cases = [
    { name: 'deferred', allowWrites: true, deferTools: true },
    { name: 'allTools', allowWrites: true, deferTools: false },
    { name: 'readOnly', allowWrites: false, deferTools: true }
  ] as const;

  it.each(cases)('$name mode matches the pre-move capture', async ({ name, allowWrites, deferTools }) => {
    const projectDir = copyFixture();
    const served = await instructionsOf({ projectDir, allowWrites, deferTools });
    expect(served.split(projectDir).join(PLACEHOLDER)).toBe(golden(name));
  });

  it('the exported function is what the server sends', () => {
    // The seam itself: three consumers, one source. A bind result (BST-002) will
    // be the third, and "the bind result must not duplicate the briefing" is only
    // assertable because this call and the server's agree.
    expect(projectInstructions({ projectDir: '/tmp/x', allowWrites: true, deferTools: true })).toContain(
      'NodeGX (OpenNoodl) project server for /tmp/x'
    );
  });

  it('every explanatory comment survived the move', () => {
    // ⚠️ The comments are the only record of which measured failure each
    // paragraph answers, and a paragraph whose reason is lost is a paragraph
    // somebody trims. Named by their task tags, which is how they are found.
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'instructions.ts'), 'utf8');
    for (const tag of ['LAS-006 §4', 'AAQ-005', 'AAQ-011/F13', 'AWP-006', 'LAS-005']) {
      expect(source).toContain(tag);
    }
  });
});

describe('BST-006 — the unbound briefing', () => {
  it('is what an unbound server sends', async () => {
    expect(await instructionsOf({ allowWrites: true })).toBe(BOOTSTRAP_INSTRUCTIONS);
  });

  it('does the four jobs: what NodeGX is, the state, the exits, what happens next', () => {
    expect(BOOTSTRAP_INSTRUCTIONS).toContain('NodeGX (OpenNoodl)');
    expect(BOOTSTRAP_INSTRUCTIONS).toContain('NO PROJECT IS BOUND');
    expect(BOOTSTRAP_INSTRUCTIONS).toContain('list_projects');
    expect(BOOTSTRAP_INSTRUCTIONS).toContain('create_project');
    expect(BOOTSTRAP_INSTRUCTIONS).toContain('AFTER CREATING');
  });

  it('names list_projects before create_project', () => {
    // ⚠️ §2's ordering claim, and the reason it is a claim rather than a
    // preference: an agent that reaches for creation by default builds a second
    // app beside the one the user meant, which is a destructive-feeling outcome
    // even though nothing was deleted. The order is the mitigation, so the order
    // is asserted.
    expect(BOOTSTRAP_INSTRUCTIONS.indexOf('list_projects')).toBeLessThan(BOOTSTRAP_INSTRUCTIONS.indexOf('create_project'));
  });

  it('teaches no authoring', () => {
    // The paragraphs about Routers, Static Data and plan-first order belong to a
    // project and arrive with one. Sent to an agent holding four tools they are
    // noise — and `instructions` is sent once and can never be revised, so by
    // the time they are relevant they are already stale.
    for (const authoring of [
      'Router',
      'Static Data',
      'Component Inputs',
      'create_plan',
      'get_project_info',
      'get_style_vocabulary',
      'render_report',
      'provision_backend'
    ]) {
      expect(BOOTSTRAP_INSTRUCTIONS).not.toContain(authoring);
    }
  });

  it('describes the bind this build DOES perform', () => {
    // ⚠️ This asserted the opposite until BST-002 landed, and the comment said
    // so: promising a bind the build does not make leaves an agent waiting for
    // tools that never arrive, which looks like a hang rather than an
    // instruction. The rule is symmetric, which is why the assertion flipped
    // rather than being deleted — the paragraph must always match the build.
    expect(BOOTSTRAP_INSTRUCTIONS).toContain('this server binds itself to the new project');
    expect(BOOTSTRAP_INSTRUCTIONS).not.toContain('this server stays unbound');
  });

  it('sends the agent to the one field carrying what initialize could not', () => {
    // 🔴 The silent half of BST-002. `instructions` is fixed at `initialize`, so
    // a server that binds mid-session has already spent its briefing on this
    // text — and the authoring paragraphs it never sent are the ones written
    // because measured models failed without them. They travel in the bind
    // result instead, and this is the sentence that makes an agent read them.
    expect(BOOTSTRAP_INSTRUCTIONS).toContain('bound.guidance');
  });

  it('says a second create_project does not repoint the server', () => {
    // Otherwise an agent tidying up mid-session describes its next twenty calls
    // as being about the new project when every one is about the old one.
    expect(BOOTSTRAP_INSTRUCTIONS).toContain('does NOT repoint this server');
  });

  it('is a fraction of the bound briefing', () => {
    // Not a budget, a shape check: if this ever approaches the bound text's
    // length, somebody has started teaching authoring here.
    expect(BOOTSTRAP_INSTRUCTIONS.length).toBeLessThan(golden('deferred').length * 0.7);
  });
});
