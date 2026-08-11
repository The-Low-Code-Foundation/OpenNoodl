/**
 * BST-002 — `create_project` binds the live server.
 *
 * Without this, BST-001 gets a stranger from "no projects" to "a project on
 * disk" and that is where the session ends: the agent has made a project it
 * cannot open, and the user — who does not know what an MCP registration is,
 * which is why the phase exists — has to be told to run a second command and
 * restart their client. The first thing they ever built ends in a configuration
 * errand.
 *
 * ## What is asserted, and why these and not a tool count
 *
 * 1. The **same session** goes on to author into the new project.
 * 2. 🔴 The **briefing** travels in the result. `instructions` is fixed at
 *    `initialize` and cannot be revised, so a mid-session bind has already spent
 *    its one briefing on the bootstrap text. Every authoring paragraph it never
 *    sent is in that string because a measured model got it wrong without it —
 *    so an agent that binds and never reads them reproduces those failures, the
 *    tools appear, the calls succeed, and the pages are unreachable because
 *    nobody mentioned the Router. **That defect passes every other check here**,
 *    which is why it gets its own assertions and why they compare against the
 *    exported constant rather than against a phrase.
 * 3. 🔴 `find_tools`' description is chosen from the mode **at registration**, so
 *    a server that binds mid-session keeps advertising the bootstrap copy — the
 *    one that says the rest of the server cannot be revealed here. Of the three
 *    halves of this task, that is the one that gets missed.
 * 4. Bind **once**: a second `create_project` creates the project and does not
 *    repoint the server.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { BOOTSTRAP_INSTRUCTIONS, projectInstructions } from '../src/instructions';
import { ProjectBinding } from '../src/project/ProjectBinding';
import { createServer, type ServerOptions } from '../src/server';
import { BOOTSTRAP_ADVERTISED } from '../src/toolGroups';
import { boundFindToolsDescription } from '../src/tools/disclosure';
import type { CreateProjectResponse } from '../src/tools/createProject';

interface Session {
  client: Client;
  instructions: string;
  close(): Promise<void>;
}

async function open(options: ServerOptions): Promise<Session> {
  const { server } = createServer(options);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'bind-test', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    client,
    instructions: client.getInstructions() ?? '',
    close: async () => {
      await client.close();
      await server.close();
    }
  };
}

async function toolNames(client: Client): Promise<string[]> {
  return (await client.listTools()).tools.map((t) => t.name);
}

async function callJson<T>(
  client: Client,
  name: string,
  args: Record<string, unknown> = {}
): Promise<{ isError: boolean; data: T }> {
  const res = (await client.callTool({ name, arguments: args })) as {
    isError?: boolean;
    content: Array<{ type: string; text: string }>;
  };
  return { isError: !!res.isError, data: JSON.parse(res.content?.[0]?.text ?? 'null') as T };
}

const SCOPE = {
  name: 'Reading List',
  request: 'a reading list app where I track books and mark them finished',
  summary: 'A private reading list.',
  agreed: true
};

describe('BST-002 — create_project binds the live server', () => {
  let session: Session;
  let tmpRoot: string;

  beforeEach(async () => {
    session = await open({ allowWrites: true }); // no projectDir: the whole point
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bst002-'));
  });

  afterEach(async () => {
    await session.close();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('starts unbound, and says so', async () => {
    expect(session.instructions).toBe(BOOTSTRAP_INSTRUCTIONS);
    expect((await toolNames(session.client)).sort()).toEqual([...BOOTSTRAP_ADVERTISED].sort());
  });

  it('🔴 the same session can author into the project it just created', async () => {
    // The acceptance, and it is an end-to-end run rather than a tool count: one
    // server, launched with no project, that goes on to build into it. No second
    // registration, no restart.
    const directory = path.join(tmpRoot, 'reading-list');
    const res = await callJson<CreateProjectResponse>(session.client, 'create_project', { ...SCOPE, directory });

    expect(res.isError).toBe(false);
    expect(res.data.bound?.bound).toBe(true);
    expect(res.data.bound?.projectDir).toBe(directory);
    expect(res.data.bound!.toolsRevealed.length).toBeGreaterThan(0);

    const after = await toolNames(session.client);
    for (const tool of ['get_project_info', 'list_components', 'create_component', 'create_plan', 'validate_project']) {
      expect(after).toContain(tool);
    }

    // …and they are not merely listed. A tool that appears and then refuses is
    // the same dead end with a longer path to it.
    const info = await callJson<{ name: string }>(session.client, 'get_project_info');
    expect(info.isError).toBe(false);
    expect(info.data.name).toBe('Reading List');

    const components = await callJson<{ components: Array<{ path: string }> }>(session.client, 'list_components');
    expect(components.data.components.map((c) => c.path).sort()).toEqual(['App', 'Pages/Home']);
  });

  it('🔴 carries the briefing initialize could not send, verbatim', async () => {
    // ⚠️ The defect most likely to ship from this task, and it is invisible to
    // every other gate: the tools appear, the calls succeed, the project builds,
    // and the pages are unreachable because nobody mentioned the Router.
    const directory = path.join(tmpRoot, 'briefed');
    const res = await callJson<CreateProjectResponse>(session.client, 'create_project', { ...SCOPE, directory });

    const guidance = res.data.bound?.guidance;
    expect(typeof guidance).toBe('string');

    // One source, not a paraphrase. A second copy of a paragraph that exists
    // because a model failed without it is how one of them stops matching.
    expect(guidance).toBe(projectInstructions({ projectDir: directory, allowWrites: true, deferTools: true }));

    // The specific paragraphs the bootstrap briefing deliberately omits — each
    // one written because a measured model got it wrong without it.
    expect(guidance).toContain('PAGES:');
    expect(guidance).toContain('Router');
    expect(guidance).toContain('Static Data');
    expect(guidance).toContain('Component Inputs');
    expect(guidance).toContain('render_report');
    expect(BOOTSTRAP_INSTRUCTIONS).not.toContain('Router');
  });

  it('tells the agent to read it, rather than leaving it in the payload', async () => {
    // A field nothing points at is a field a model skips. The bootstrap briefing
    // names it, and so does the bind note.
    expect(BOOTSTRAP_INSTRUCTIONS).toContain('bound.guidance');

    const res = await callJson<CreateProjectResponse>(session.client, 'create_project', {
      ...SCOPE,
      directory: path.join(tmpRoot, 'pointed-at')
    });
    expect(res.data.bound!.note).toContain('guidance');
    // And it names the client behaviour that would make the reveal invisible.
    expect(res.data.bound!.note).toContain('list_changed');
  });

  it('🔴 revises find_tools’ description, which registration chose from the old mode', async () => {
    // The half that gets missed. Unbound, the description states that this tool
    // cannot reveal the project surface — true there, and a lie the moment a
    // project exists. Left stale, the door out of the deferred set is advertised
    // as bolted shut in the one place a model looks.
    const before = (await session.client.listTools()).tools.find((t) => t.name === 'find_tools');
    expect(before!.description).toContain('cannot reveal them here');

    await callJson<CreateProjectResponse>(session.client, 'create_project', {
      ...SCOPE,
      directory: path.join(tmpRoot, 'described')
    });

    const after = (await session.client.listTools()).tools.find((t) => t.name === 'find_tools');
    expect(after!.description).not.toContain('cannot reveal them here');
    expect(after!.description).toBe(boundFindToolsDescription());
  });

  it('holds the deferred groups back, exactly as a server started bound does', async () => {
    // The bind is not `--all-tools` by the back door: `deferTools` is honoured,
    // so the 60 backend tools stay behind find_tools until something asks.
    await callJson<CreateProjectResponse>(session.client, 'create_project', {
      ...SCOPE,
      directory: path.join(tmpRoot, 'deferred')
    });

    const after = await toolNames(session.client);
    expect(after).toContain('create_component');
    expect(after).not.toContain('provision_backend');

    // …and the door works, which is the whole point of revising its description.
    const found = await callJson<{ revealed: string[] }>(session.client, 'find_tools', { group: 'backend' });
    expect(found.data.revealed).toContain('provision_backend');
    expect(await toolNames(session.client)).toContain('provision_backend');
  });

  it('🔴 a second create_project does NOT repoint the server', async () => {
    // An agent tidying up mid-session would otherwise silently redirect every
    // later tool at a different project, and nothing in any response would say
    // which one it is describing.
    const first = path.join(tmpRoot, 'first');
    const second = path.join(tmpRoot, 'second');

    // Different names, so `get_project_info` can say which project the tools
    // are actually about — the whole question this refusal exists to settle.
    await callJson<CreateProjectResponse>(session.client, 'create_project', {
      ...SCOPE,
      name: 'First App',
      directory: first
    });
    const res = await callJson<CreateProjectResponse>(session.client, 'create_project', {
      ...SCOPE,
      name: 'Second App',
      directory: second
    });

    // The second project IS created — the refusal is about binding, not creating.
    expect(res.isError).toBe(false);
    expect(fs.existsSync(path.join(second, 'nodegx.project.json'))).toBe(true);

    expect(res.data.bound?.bound).toBe(false);
    expect(res.data.bound?.projectDir).toBe(first);
    expect(res.data.bound!.toolsRevealed).toEqual([]);
    // ⚠️ And it must SAY so. A silent refusal is the defect, not the fix.
    expect(res.data.bound!.note).toContain(first);
    expect(res.data.bound!.note).toContain('binds once');
    expect(res.data.bound!.guidance).toBeUndefined();

    // The server still serves the first project, and the tools agree — this is
    // the assertion that would catch a silent repoint.
    const info = await callJson<{ name: string }>(session.client, 'get_project_info');
    expect(info.data.name).toBe('First App');
  });

  it('a create_project that fails leaves the server unbound, bootstrap surface intact', async () => {
    const occupied = path.join(tmpRoot, 'occupied');
    fs.mkdirSync(occupied, { recursive: true });
    fs.writeFileSync(path.join(occupied, 'something.txt'), 'not empty');

    const res = await callJson<CreateProjectResponse>(session.client, 'create_project', {
      ...SCOPE,
      directory: occupied
    });

    expect(res.isError).toBe(true);
    expect((await toolNames(session.client)).sort()).toEqual([...BOOTSTRAP_ADVERTISED].sort());

    // Still the honest unbound description, not a half-bound one.
    const findTools = (await session.client.listTools()).tools.find((t) => t.name === 'find_tools');
    expect(findTools!.description).toContain('cannot reveal them here');
  });

  it('a bind failure does not become the creation’s failure', async () => {
    // ⚠️ The project is on disk by the time the bind runs. If a bind fault were
    // reported as a `create_project` error, the agent would retry into the
    // directory it just filled and be refused with "not empty" — a real project
    // lost to plumbing. Provoked by making the bind itself throw.
    const directory = path.join(tmpRoot, 'unbindable');
    const spy = jest.spyOn(ProjectBinding.prototype, 'bind').mockImplementation(() => {
      throw new Error('simulated store failure');
    });

    try {
      const res = await callJson<CreateProjectResponse>(session.client, 'create_project', { ...SCOPE, directory });

      // The creation is reported as the success it was.
      expect(res.isError).toBe(false);
      expect(fs.existsSync(path.join(directory, 'nodegx.project.json'))).toBe(true);

      // …and the bind says what went wrong, rather than being silently absent.
      expect(res.data.bound?.bound).toBe(false);
      expect(res.data.bound!.note).toContain('simulated store failure');
      expect(res.data.bound!.note).toContain('intact');
    } finally {
      spy.mockRestore();
    }
  });

  it('BST-005 and BST-002 land together: the folder is configured AND the session can build', async () => {
    // The two halves of "the first thing they ever built does not end in a
    // configuration errand" — this session can act, and tomorrow's can too.
    const directory = path.join(tmpRoot, 'both-halves');
    const res = await callJson<CreateProjectResponse>(session.client, 'create_project', { ...SCOPE, directory });

    expect(res.data.bound?.bound).toBe(true);
    expect(fs.existsSync(path.join(directory, '.mcp.json'))).toBe(true);
    expect(fs.existsSync(path.join(directory, 'CLAUDE.md'))).toBe(true);
  });
});

describe('BST-002 — the bound-from-the-start path is untouched', () => {
  it('a server given a project binds nothing and reports nothing', async () => {
    // This task's real risk is not to the new mode, which nobody uses yet; it is
    // to the path every existing user is on.
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bst002-bound-'));
    const unbound = await open({ allowWrites: true });
    const directory = path.join(tmpRoot, 'made-first');
    await callJson<CreateProjectResponse>(unbound.client, 'create_project', { ...SCOPE, directory });
    await unbound.close();

    const session = await open({ projectDir: directory, allowWrites: true });
    try {
      expect(session.instructions).toBe(
        projectInstructions({ projectDir: directory, allowWrites: true, deferTools: true })
      );

      // AWP-006 — on a BOUND server `create_project` lives in the deferred
      // `project` group, which is itself a difference between the two modes:
      // unbound it is advertised from the first `tools/list`, because it is the
      // reason that mode exists.
      await callJson(session.client, 'find_tools', { group: 'project' });

      const res = await callJson<CreateProjectResponse>(session.client, 'create_project', {
        ...SCOPE,
        directory: path.join(tmpRoot, 'elsewhere')
      });

      // Already bound, so the second-call refusal applies — and it names the
      // project this server actually serves, which is the field an agent would
      // otherwise get wrong for the rest of the session.
      expect(res.data.bound?.bound).toBe(false);
      expect(res.data.bound?.projectDir).toBe(directory);

      const findTools = (await session.client.listTools()).tools.find((t) => t.name === 'find_tools');
      expect(findTools!.description).toBe(boundFindToolsDescription());
    } finally {
      await session.close();
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
