/**
 * FIX-008 D — `open_project` binds a project that was already there.
 *
 * ## What this suite is actually protecting
 *
 * BST-002's suite (`bindOnCreate.test.ts`) proves the *created* project path,
 * and its header names the three halves of a mid-session bind that are easy to
 * half-do: the store, the disclosure flip, and the briefing `initialize` already
 * spent. This tool reaches the same state by a second door, so every one of
 * those three is re-asserted **here** rather than assumed from there — a bind
 * that installs the store and forgets the briefing produces a session where the
 * tools appear, the calls succeed, and the pages are unreachable because nobody
 * mentioned the Router.
 *
 * 🔴 **The assertions that would catch a real regression are the negative ones,
 * and they are written to be capable of failing.** "Binds once" is checked by
 * its *consequence* — the server still answers about the first project — and not
 * by reading the refusal note, because a note is a string a broken build would
 * still return. Where a description is asserted to have changed, the pre-state
 * is asserted too: a one-sided "it contains the bound copy" passes just as well
 * on a server that was never in the bootstrap copy to begin with.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { BOOTSTRAP_INSTRUCTIONS, projectInstructions } from '../src/instructions';
import { createServer, type ServerOptions } from '../src/server';
import { BOOTSTRAP_ADVERTISED, BOOTSTRAP_TOOLS, TOOL_GROUPS, WRITE_ONLY_TOOLS } from '../src/toolGroups';
import { boundFindToolsDescription } from '../src/tools/disclosure';
import { noteFor } from '../src/tools/listProjects';
import { registrationCommandFor, type OpenProjectResponse } from '../src/tools/openProject';
import type { ListProjectsResponse } from '../src/tools/responses';
import { authoringServerName } from '../src/editor-deps';

interface Session {
  client: Client;
  instructions: string;
  close(): Promise<void>;
}

async function open(options: ServerOptions): Promise<Session> {
  const { server } = createServer(options);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'open-project-test', version: '0.0.0' });
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

async function describeTool(client: Client, name: string): Promise<string> {
  const found = (await client.listTools()).tools.find((t) => t.name === name);
  return found?.description ?? '';
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

interface ErrorPayload {
  error: { code: string; message: string };
}

const FIXTURE = path.join(__dirname, 'fixtures', 'demo-app');

/** A v2 project on disk at a directory this suite chose the name of. */
function copyProjectTo(root: string, name: string): string {
  const dir = path.join(root, name);
  fs.cpSync(FIXTURE, dir, { recursive: true });
  return dir;
}

describe('FIX-008 D — open_project', () => {
  let tmpRoot: string;
  let session: Session;

  beforeEach(async () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fix008d-'));
    session = await open({ allowWrites: true });
  });

  afterEach(async () => {
    await session.close();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  // ── the surface ───────────────────────────────────────────────────────────

  it('is advertised on an unbound server, where it is the only way into an existing project', async () => {
    const names = await toolNames(session.client);
    expect(names).toContain('open_project');
    // The whole surface, not just the presence of the new name: a tool that
    // arrived by accidentally un-deferring the `project` group would satisfy the
    // line above and would have dragged `get_import_report` and
    // `create_node_kit` in with it.
    expect([...names].sort()).toEqual([...BOOTSTRAP_ADVERTISED].sort());
  });

  it('is in the manifest and is declared write-only, so the completeness guards see it', () => {
    const manifest = TOOL_GROUPS.flatMap((g) => g.tools);
    expect(manifest).toContain('open_project');
    // Exactly one home. A tool listed in two groups is revealed twice and
    // reported twice by `groupStates`.
    expect(manifest.filter((n) => n === 'open_project')).toHaveLength(1);
    expect(BOOTSTRAP_TOOLS).toContain('open_project');
    expect(WRITE_ONLY_TOOLS.has('open_project')).toBe(true);
  });

  // ── the acceptance ────────────────────────────────────────────────────────

  it('🔴 the same session goes on to read the project it opened', async () => {
    const directory = copyProjectTo(tmpRoot, 'existing-app');

    // ✅ The pre-state, so the assertions below cannot pass vacuously: this
    // server genuinely could not see the project a moment ago.
    expect(await toolNames(session.client)).not.toContain('get_project_info');

    const res = await callJson<OpenProjectResponse>(session.client, 'open_project', { directory });
    expect(res.isError).toBe(false);
    expect(res.data.bound).toBe(true);
    expect(res.data.projectDir).toBe(directory);
    expect(res.data.toolsRevealed.length).toBeGreaterThan(0);

    const after = await toolNames(session.client);
    for (const tool of ['get_project_info', 'list_components', 'create_component', 'create_plan', 'validate_project']) {
      expect(after).toContain(tool);
    }

    // …and they answer, rather than appearing and refusing — which is the same
    // dead end with a longer path to it.
    const info = await callJson<{ projectDirectory: string }>(session.client, 'get_project_info');
    expect(info.isError).toBe(false);
    // Fix E put the bound directory in this payload precisely so a mis-bound
    // server is detectable from any tool call. This is that check, used in
    // anger: it is the only assertion here that would catch a bind to the right
    // *name* and the wrong *folder*.
    expect(info.data.projectDirectory).toBe(directory);

    const components = await callJson<{ components: Array<{ path: string }> }>(session.client, 'list_components');
    expect(components.data.components.length).toBeGreaterThan(0);
  });

  it('🔴 carries the briefing initialize could not send, verbatim from instructions.ts', async () => {
    const directory = copyProjectTo(tmpRoot, 'briefed');
    expect(session.instructions).toBe(BOOTSTRAP_INSTRUCTIONS);

    const res = await callJson<OpenProjectResponse>(session.client, 'open_project', { directory });

    // Compared against the exported constant, not a phrase: a paraphrase of the
    // bound briefing is the defect this field exists to prevent, and every
    // paragraph missing from it is one a measured model got wrong without it.
    expect(res.data.guidance).toBe(projectInstructions({ projectDir: directory, allowWrites: true, deferTools: true }));
    // The session-level instructions are still the bootstrap text — MCP has no
    // notification that revises them, which is the entire reason `guidance`
    // exists. If this ever stops being true the field can go.
    expect(session.instructions).toBe(BOOTSTRAP_INSTRUCTIONS);
  });

  it('🔴 flips find_tools off the bootstrap copy — the half that gets missed', async () => {
    const directory = copyProjectTo(tmpRoot, 'flipped');

    const before = await describeTool(session.client, 'find_tools');
    // ✅ Both halves. Asserting only the "after" would pass on a server that had
    // never been in bootstrap mode at all.
    expect(before).toContain('This tool cannot reveal them here');
    expect(before).not.toBe(boundFindToolsDescription());

    await callJson<OpenProjectResponse>(session.client, 'open_project', { directory });

    expect(await describeTool(session.client, 'find_tools')).toBe(boundFindToolsDescription());
  });

  // ── binds once ────────────────────────────────────────────────────────────

  it('🔴 binds ONCE: a second call reports where it is bound and the server still answers about the first', async () => {
    const first = copyProjectTo(tmpRoot, 'first-app');
    const second = copyProjectTo(tmpRoot, 'second-app');

    await callJson<OpenProjectResponse>(session.client, 'open_project', { directory: first });
    const res = await callJson<OpenProjectResponse>(session.client, 'open_project', { directory: second });

    expect(res.isError).toBe(false);
    expect(res.data.bound).toBe(false);
    expect(res.data.projectDir).toBe(first);
    expect(res.data.toolsRevealed).toEqual([]);

    // 🔴 The assertion that matters, and it is a consequence rather than a
    // string: the tools must still be answering about the FIRST project. A
    // build that repointed the store would return a perfectly worded refusal
    // above and fail here — which is the whole failure mode
    // `ProjectBinding.bind`'s header describes, where twenty subsequent calls
    // are silently about somewhere else.
    const info = await callJson<{ projectDirectory: string }>(session.client, 'get_project_info');
    expect(info.data.projectDirectory).toBe(first);
  });

  it('answers the same-directory case as the success it is, not as a conflict', async () => {
    const directory = copyProjectTo(tmpRoot, 'same-app');
    await callJson<OpenProjectResponse>(session.client, 'open_project', { directory });

    const again = await callJson<OpenProjectResponse>(session.client, 'open_project', { directory });
    expect(again.isError).toBe(false);
    expect(again.data.projectDir).toBe(directory);
    // Re-asking for the project you already have is not a refusal, and must not
    // read as one: the recovery from a refusal is a different project.
    expect(again.data.note).toContain('already bound');
    expect(again.data.note).toContain('nothing needed to');
    expect(again.data.note).not.toContain('did NOT open');
  });

  it('names a runnable registration command when it is bound somewhere else', async () => {
    const first = copyProjectTo(tmpRoot, 'held');
    const wanted = copyProjectTo(tmpRoot, 'wanted-elsewhere');
    await callJson<OpenProjectResponse>(session.client, 'open_project', { directory: first });

    const res = await callJson<OpenProjectResponse>(session.client, 'open_project', { directory: wanted });

    // The note has to carry a command, because this is the one branch where
    // there is no in-session way on and prose cannot be actioned.
    expect(res.data.note).toContain(registrationCommandFor(wanted));
    expect(res.data.note).toContain('did NOT open');
  });

  // ── refusals ──────────────────────────────────────────────────────────────

  it('refuses a legacy project with the migration sentence the editor mirrors', async () => {
    const legacy = path.join(tmpRoot, 'legacy-app');
    fs.mkdirSync(legacy);
    fs.writeFileSync(path.join(legacy, 'project.json'), '{}', 'utf8');

    const res = await callJson<ErrorPayload>(session.client, 'open_project', { directory: legacy });
    expect(res.isError).toBe(true);
    expect(res.data.error.code).toBe('not-a-v2-project');
    expect(res.data.error.message).toContain('project settings → migrate');

    // 🔴 And the refusal left the server unbound rather than half-bound — the
    // one state `ProjectBinding` exists to make unrepresentable. Checked from
    // outside, through the surface, because that is where a half-bind would be
    // visible to a caller.
    expect(await toolNames(session.client)).not.toContain('get_project_info');
  });

  it('refuses a directory that is not there, and says which call has the real list', async () => {
    const res = await callJson<ErrorPayload>(session.client, 'open_project', {
      directory: path.join(tmpRoot, 'no-such-project')
    });
    expect(res.isError).toBe(true);
    expect(res.data.error.code).toBe('not-found');
    expect(res.data.error.message).toContain('list_projects');
  });

  it('refuses an empty directory argument without reaching the binding', async () => {
    const res = await callJson<ErrorPayload>(session.client, 'open_project', { directory: '   ' });
    expect(res.isError).toBe(true);
    expect(res.data.error.code).toBe('invalid-argument');
  });

  it('🔴 reports a bad path as a bad path even when it is already bound', async () => {
    // `bind()` answers "already bound" without ever looking at its argument, so
    // the validation has to run first. Otherwise a typo'd directory on a bound
    // server is reported as a binding conflict: true, and it sends the reader
    // after the wrong problem entirely.
    const first = copyProjectTo(tmpRoot, 'bound-already');
    await callJson<OpenProjectResponse>(session.client, 'open_project', { directory: first });

    const res = await callJson<ErrorPayload>(session.client, 'open_project', {
      directory: path.join(tmpRoot, 'typo-project')
    });
    expect(res.isError).toBe(true);
    expect(res.data.error.code).toBe('not-found');
  });

  // ── the sentence that sends the model here ────────────────────────────────

  it('list_projects still answers on an unbound server, whatever this machine holds', async () => {
    // ⚠️ Deliberately weak, and paired with the deterministic pair below. This
    // one proves the tool is wired and does not throw; it cannot prove which
    // sentence came back, because that depends on whether the machine running
    // it has ever opened NodeGX. `noteFor` is asserted directly instead.
    const res = await callJson<ListProjectsResponse>(session.client, 'list_projects');
    expect(res.isError).toBe(false);
    expect(typeof res.data.note).toBe('string');
  });
});

/**
 * 🔴 The sentence that decides whether a model ever calls `open_project`.
 *
 * Asserted against `noteFor` directly rather than through the tool, because the
 * tool reads the *real* launcher store: on a machine that has never run NodeGX
 * — which is every CI runner, and was very nearly the shape this suite shipped
 * in — the empty-list branch is taken and the branch under test is never
 * evaluated at all. A passing run would have meant nothing.
 */
describe('FIX-008 D — what list_projects tells the model to do next', () => {
  const scan = {
    projects: [{ name: 'Recipes', directory: '/tmp/recipes', format: 'v2' as const }],
    searched: [],
    missing: 0
  };

  it('unbound: names open_project, and no longer sends the reader to a terminal', () => {
    const note = noteFor(scan, false);
    expect(note).toContain('open_project');
    expect(note).toContain('no second registration and no restart');
    // The prose this replaced. Its survival anywhere in the unbound note is the
    // regression: it is a configuration errand handed to a model mid-call.
    expect(note).not.toContain('start a server with its `directory` as the argument');
  });

  it('🔴 bound: does NOT name open_project, because there it would refuse', () => {
    const note = noteFor(scan, true);
    expect(note).not.toContain('open_project');
    expect(note).toContain('a server binds once');
  });

  it('an empty machine is told to create, on both servers', () => {
    for (const isBound of [false, true]) {
      const note = noteFor({ projects: [], searched: [], missing: 0 }, isBound);
      expect(note).toContain('create_project');
      expect(note).not.toContain('open_project');
    }
  });
});

describe('FIX-008 D — the emitted registration command', () => {
  it('uses the editor\'s own server name and quotes a path with spaces', () => {
    const dir = '/tmp/NodeGX test projects/my app';
    const command = registrationCommandFor(dir);

    // One spelling of the server name, imported from the module that owns the
    // rule — not a second slugger that would eventually disagree with the
    // Settings panel about what this project's server is called.
    expect(command).toContain(authoringServerName(dir));
    expect(command).toContain('claude mcp add --scope project ');
    expect(command).toContain('--allow-writes');
    // The default project location has a space in it, so this is not
    // theoretical: unquoted, the command points the runtime at `/tmp/NodeGX`.
    expect(command).toContain(`"${dir}"`);
  });

  it('🔴 puts -e AFTER the server name, the only order claude mcp add parses', () => {
    // `-e, --env <env...>` is variadic, so an `-e` before the name swallows the
    // name as a second variable and the command dies with
    // `Invalid environment variable format: nodegx`. Found by MCP-001 running
    // the emitted command against the real client.
    const previous = process.env.ELECTRON_RUN_AS_NODE;
    process.env.ELECTRON_RUN_AS_NODE = '1';
    try {
      const dir = '/tmp/electron-launched';
      const command = registrationCommandFor(dir);
      expect(command).toContain('-e ELECTRON_RUN_AS_NODE=1');
      expect(command.indexOf(authoringServerName(dir))).toBeLessThan(command.indexOf('-e '));
      // …and before the `--`, which ends the flags.
      expect(command.indexOf('-e ')).toBeLessThan(command.indexOf(' -- '));
    } finally {
      if (previous === undefined) delete process.env.ELECTRON_RUN_AS_NODE;
      else process.env.ELECTRON_RUN_AS_NODE = previous;
    }
  });

  it('omits the env flag entirely when the runtime is plain node', () => {
    const previous = process.env.ELECTRON_RUN_AS_NODE;
    delete process.env.ELECTRON_RUN_AS_NODE;
    try {
      expect(registrationCommandFor('/tmp/node-launched')).not.toContain('-e ');
    } finally {
      if (previous !== undefined) process.env.ELECTRON_RUN_AS_NODE = previous;
    }
  });
});
