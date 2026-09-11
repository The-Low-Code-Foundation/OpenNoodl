import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createServer } from '../src/server';
import type { ProjectStore } from '../src/project/ProjectStore';

const FIXTURE = path.join(__dirname, 'fixtures', 'demo-app');

/** Copy the fixture project into a fresh temp directory. */
export function copyFixture(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'noodl-mcp-test-'));
  fs.cpSync(FIXTURE, dir, { recursive: true });
  return dir;
}

export interface TestSession {
  client: Client;
  store: ProjectStore;
  projectDir: string;
  close(): Promise<void>;
}

export async function connect(projectDir: string, allowWrites = true): Promise<TestSession> {
  const { server, binding } = createServer({ projectDir, allowWrites });
  // BST-001 — every suite that uses this helper serves a real fixture project,
  // so the binding is always bound here and `require()` is the honest read.
  const store = binding.require();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    client,
    store,
    projectDir,
    close: async () => {
      await client.close();
      await server.close();
    }
  };
}

/**
 * `T` is the tool's success payload — see `src/tools/responses.ts`. A failing call
 * returns `ToolErrorPayload` instead, so callers that assert on both name the
 * union: `call<CreateComponentResponse | ToolErrorPayload>(...)`. `RawText` covers
 * the third case below.
 */
export interface ToolCallResult<T> {
  isError: boolean;
  data: T;
}

/** A protocol-level failure (e.g. zod rejecting an argument) arrives as prose. */
export interface RawText {
  raw?: string;
}

/** Call a tool and parse its JSON payload. */
export async function call<T>(
  session: TestSession,
  name: string,
  args: Record<string, unknown> = {}
): Promise<ToolCallResult<T>> {
  const res = (await session.client.callTool({ name, arguments: args })) as {
    isError?: boolean;
    content: Array<{ type: string; text: string }>;
  };
  const text = res.content?.[0]?.text;
  let data: T;
  try {
    data = (text ? JSON.parse(text) : undefined) as T;
  } catch {
    data = { raw: text } as T; // protocol-level errors (e.g. zod arg rejection) are plain text
  }
  return { isError: !!res.isError, data };
}

/**
 * The tool's response *as it goes on the wire* — `JSON.stringify(payload, null, 2)`,
 * whitespace included. `call()` parses and discards this, which is right for
 * asserting on content and wrong for asserting on cost: pretty-printing is
 * roughly half the bytes a client is billed for. AWP-005's budgets measure this.
 */
export async function callRawText(
  session: TestSession,
  name: string,
  args: Record<string, unknown> = {}
): Promise<string> {
  const res = (await session.client.callTool({ name, arguments: args })) as {
    content: Array<{ type: string; text: string }>;
  };
  return res.content?.[0]?.text ?? '';
}

/**
 * AWP-006 — bring a deferred group into the advertised surface.
 *
 * `connect()` deliberately reproduces the shipped default (the backend, docs,
 * project and theme groups deferred), so the seven suites that exercise those
 * tools reach them **through `find_tools`, the same door a model has** — rather
 * than through an `--all-tools` bypass that would prove only that the tools
 * still exist. Their green is now evidence that the disclosure path works, which
 * is the property AWP-006's warning is about.
 */
export async function reveal(session: TestSession, group: 'backend' | 'docs' | 'explore' | 'project' | 'theme'): Promise<void> {
  const res = await call<{ revealed: string[] }>(session, 'find_tools', { group });
  if (res.isError) throw new Error(`find_tools({group:"${group}"}) failed: ${JSON.stringify(res.data)}`);
}

export function readJson<T>(projectDir: string, rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(projectDir, rel), 'utf8')) as T;
}

export function exists(projectDir: string, rel: string): boolean {
  return fs.existsSync(path.join(projectDir, rel));
}

/**
 * CN-003 — bundle the kit extractor from source into `outDir`, the way
 * `build.mjs` does, and return the path.
 *
 * 🔴 **Deliberately not `dist/kit-extract.cjs`.** `dist/` is gitignored, so a
 * suite that read it would be *skipped* in a fresh checkout and would silently
 * grade a **stale** artifact in a working one — this repo's most expensive
 * recurring failure. Building per run costs ~110 ms and always grades the
 * source. Callers set `process.env.NODEGX_KIT_EXTRACT` to the result.
 *
 * Async because `extractorBuildOptions` carries the type-only-module stub as an
 * esbuild plugin, and esbuild refuses plugins in `buildSync`.
 */
export async function buildKitExtractor(outDir: string): Promise<string> {
  const outfile = path.join(outDir, 'kit-extract.cjs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const esbuild = require('esbuild');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { extractorBuildOptions } = require('../../../scripts/node-catalog/lib/bundle.js');
  await esbuild.build({
    ...extractorBuildOptions(path.resolve(__dirname, '..', 'src', 'kitExtract', 'entry.js'), outfile),
    target: 'node18',
    logLevel: 'silent'
  });
  return outfile;
}
