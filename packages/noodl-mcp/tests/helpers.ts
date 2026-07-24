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
  const { server, store } = createServer({ projectDir, allowWrites });
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

export function readJson<T>(projectDir: string, rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(projectDir, rel), 'utf8')) as T;
}

export function exists(projectDir: string, rel: string): boolean {
  return fs.existsSync(path.join(projectDir, rel));
}
