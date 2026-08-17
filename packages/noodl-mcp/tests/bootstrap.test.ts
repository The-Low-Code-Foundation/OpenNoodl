/**
 * BST-001 — the server that starts with no project.
 *
 * Two properties, and the second one is the one that costs a session if it
 * breaks:
 *
 * 1. **The unbound surface is small and honest.** The capability tools plus
 *    `find_tools`, and everything else is *absent from `tools/list`* rather than
 *    present-and-erroring — because a model calls what it is shown, and an
 *    advertised `update_component` on a server with nothing to update buys a
 *    call, a refusal and a turn.
 *
 *    ⚠️ **It was four and FIX-008 D made it five** (`open_project`). The count is
 *    deliberately not written out here any more: every assertion below derives
 *    it from `BOOTSTRAP_TOOLS`, and a number in a comment is the one copy that
 *    cannot be checked. The *policy* — small, honest, everything in it works —
 *    is the invariant, and that module's header argues the fifth against it.
 * 2. **The bound surface is untouched.** This task's real risk is not to the new
 *    mode, which nobody uses yet; it is to the bound path, which is every
 *    existing user. Asserted here against the manifest and, in
 *    `toolDisclosure.test.ts`, against the whole disclosure contract.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { ProjectStore } from '../src/project/ProjectStore';
import { BOOTSTRAP_INSTRUCTIONS } from '../src/instructions';
import { BOOTSTRAP_ADVERTISED, BOOTSTRAP_TOOLS, TOOL_GROUPS, spellCount } from '../src/toolGroups';
import { createServer, type ServerOptions } from '../src/server';
import type { FindToolsResponse, ListProjectsResponse } from '../src/tools/responses';
// `CreateProjectResponse` lives with the tool, not in `responses.ts` — this
// import named the wrong module and had been failing `tsc` silently, because
// jest transpiles per file and never typechecks the graph.
import type { CreateProjectResponse } from '../src/tools/createProject';
import { copyFixture } from './helpers';

interface Session {
  client: Client;
  instructions: string;
  close(): Promise<void>;
}

async function open(options: ServerOptions): Promise<Session> {
  const { server } = createServer(options);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'bootstrap-test', version: '0.0.0' });
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

async function callJson<T>(client: Client, name: string, args: Record<string, unknown> = {}): Promise<{ isError: boolean; data: T }> {
  const res = (await client.callTool({ name, arguments: args })) as {
    isError?: boolean;
    content: Array<{ type: string; text: string }>;
  };
  return { isError: !!res.isError, data: JSON.parse(res.content?.[0]?.text ?? 'null') as T };
}

describe('BST-001 — the unbound surface', () => {
  let session: Session;

  beforeAll(async () => {
    session = await open({ allowWrites: true });
  });

  afterAll(async () => {
    await session.close();
  });

  it('every bootstrap tool is a name the manifest knows', () => {
    // A typo here would silently produce a three-tool server that still passes
    // every behavioural test below by accident.
    const manifest = new Set(TOOL_GROUPS.flatMap((g) => g.tools));
    expect(BOOTSTRAP_TOOLS.filter((n) => !manifest.has(n))).toEqual([]);
  });

  it('advertises the bootstrap tools and find_tools, and nothing else', async () => {
    expect([...(await toolNames(session.client))].sort()).toEqual([...BOOTSTRAP_ADVERTISED].sort());
  });

  it('🔴 F87 — the briefing counts the tools the server actually serves', async () => {
    // It said "four" and served five: the four capability tools plus
    // `find_tools`. That sentence is the first thing a cold agent reads and the
    // one that tells it what it has, so the count is asserted against
    // `tools/list` itself rather than against another constant.
    const served = [...(await toolNames(session.client))];
    expect(served).toHaveLength(BOOTSTRAP_ADVERTISED.length);
    expect(BOOTSTRAP_INSTRUCTIONS).toContain(`only ${spellCount(served.length)} tools are advertised`);
    expect(BOOTSTRAP_INSTRUCTIONS).not.toContain('only four tools are advertised');
  });

  it('every project-shaped tool is absent, not present-and-erroring', async () => {
    const names = await toolNames(session.client);
    for (const absent of [
      'get_project_info',
      'list_components',
      'get_component',
      'create_component',
      'update_component',
      'delete_component',
      'create_plan',
      'validate_project',
      'render_report',
      'get_style_vocabulary',
      'list_project_docs',
      'provision_backend',
      'get_node_type'
    ]) {
      expect(names).not.toContain(absent);
    }
  });

  it('find_tools reveals nothing and says what would bring the rest', async () => {
    const res = await callJson<FindToolsResponse>(session.client, 'find_tools', { group: 'backend' });
    expect(res.isError).toBe(false);
    expect(res.data.revealed).toEqual([]);
    // ⚠️ Empty rather than a list of groups marked `advertised: false`: that
    // shape reads as "ask again for one of these", which is precisely the turn
    // this mode exists to save.
    expect(res.data.groups).toEqual([]);
    expect(res.data.note).toContain('no project bound');
    expect(res.data.note).toContain('list_projects');
    expect(res.data.note).toContain('create_project');
    // And it genuinely revealed nothing — the payload is not the only thing that
    // has to be honest.
    expect(await toolNames(session.client)).not.toContain('provision_backend');
  });

  it('a free-text query cannot reveal a project tool either', async () => {
    // `revealNames` is the primitive both doors go through, so it is guarded
    // separately from `revealGroup`. Without that, a query match would re-enable
    // a tool the policy disabled.
    await callJson<FindToolsResponse>(session.client, 'find_tools', { query: 'component' });
    expect(await toolNames(session.client)).not.toContain('update_component');
  });

  it("find_tools' description does not offer what it cannot deliver", async () => {
    const tool = (await session.client.listTools()).tools.find((t) => t.name === 'find_tools');
    expect(tool?.description).toContain('no project bound');
    // The bound description ends "one call away". True there, a lie here.
    expect(tool?.description).not.toContain('one call away');
  });

  it('list_projects answers rather than failing on a machine with no store', async () => {
    // Shape only: the real user-data directory is whatever this machine has, and
    // a spec that asserted its contents would pass here and fail on CI. That the
    // *scan* filters and classifies correctly is `listProjects.test.ts`, against
    // fixtures.
    const res = await callJson<ListProjectsResponse>(session.client, 'list_projects');
    expect(res.isError).toBe(false);
    expect(Array.isArray(res.data.projects)).toBe(true);
    expect(typeof res.data.note).toBe('string');
  });
});

describe('BST-001 — create_project is reachable, and what it writes opens', () => {
  it('an unbound server creates a project a second server can serve', async () => {
    const session = await open({ allowWrites: true });
    const target = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bst-create-')), 'Reading List');
    try {
      const res = await callJson<CreateProjectResponse>(session.client, 'create_project', {
        directory: target,
        name: 'Reading List',
        request: 'A list of books I mean to read.'
      });
      expect(res.isError).toBe(false);
      expect(res.data.ok).toBe(true);

      // ⚠️ The acceptance ends at a project a person can open, not at a tool that
      // returned ok. `ProjectStore`'s constructor is the same gate the editor and
      // every other server apply, so constructing one is the real check.
      expect(() => new ProjectStore(res.data.projectDir)).not.toThrow();

      // And a full server serves it, with the whole authoring surface.
      const second = await open({ projectDir: res.data.projectDir, allowWrites: true });
      try {
        expect(await toolNames(second.client)).toContain('create_component');
      } finally {
        await second.close();
      }
    } finally {
      await session.close();
    }
  });
});

describe('BST-001 §4 — unbound and read-only is refused, not served', () => {
  it('refuses at startup, naming the flag', () => {
    // `create_project` is registered inside the write gate, so this combination
    // is a server with nothing in it. Failing here puts the reason in the
    // client's MCP status, where a person can see it; starting would present a
    // connected server that cannot act.
    expect(() => createServer({ allowWrites: false })).toThrow(/--allow-writes/);
  });

  it('a bound read-only server is unaffected', () => {
    expect(() => createServer({ projectDir: copyFixture(), allowWrites: false })).not.toThrow();
  });
});

describe('BST-001 — the bound surface is unchanged', () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = copyFixture();
  });

  it('bound and deferred still advertises the authoring set, and no bootstrap-only tool', async () => {
    const session = await open({ projectDir, allowWrites: true });
    try {
      const names = await toolNames(session.client);
      expect(names).toContain('create_component');
      expect(names).toContain('get_project_info');
      expect(names).toContain('find_tools');
      // `list_projects` is in the deferred `project` group when bound: a server
      // pointed at a project cannot be repointed, so a list of other projects is
      // a list of places it will never look. TALK-004's argument, unchanged.
      expect(names).not.toContain('list_projects');
      expect(names).not.toContain('create_project');
    } finally {
      await session.close();
    }
  });

  it('--all-tools still advertises everything the manifest names', async () => {
    const session = await open({ projectDir, allowWrites: true, deferTools: false });
    try {
      const names = await toolNames(session.client);
      expect(names.length).toBe(TOOL_GROUPS.flatMap((g) => g.tools).length);
      expect(names).toContain('list_projects');
    } finally {
      await session.close();
    }
  });

  it('--all-tools does NOT override the bootstrap surface', async () => {
    // ⚠️ The flag exists for a client that ignores `list_changed`, and there is
    // nothing to change into here. Letting it through would advertise 89 project
    // tools on a server with no project — this mode's whole failure, in one flag.
    const session = await open({ allowWrites: true, deferTools: false });
    try {
      expect([...(await toolNames(session.client))].sort()).toEqual([...BOOTSTRAP_TOOLS, 'find_tools'].sort());
    } finally {
      await session.close();
    }
  });
});
