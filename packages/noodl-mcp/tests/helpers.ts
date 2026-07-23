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

export interface ToolCallResult {
  isError: boolean;
  data: any;
}

/** Call a tool and parse its JSON payload. */
export async function call(session: TestSession, name: string, args: Record<string, unknown> = {}): Promise<ToolCallResult> {
  const res = (await session.client.callTool({ name, arguments: args })) as {
    isError?: boolean;
    content: Array<{ type: string; text: string }>;
  };
  const text = res.content?.[0]?.text;
  let data: any;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = { raw: text }; // protocol-level errors (e.g. zod arg rejection) are plain text
  }
  return { isError: !!res.isError, data };
}

export function readJson(projectDir: string, rel: string): any {
  return JSON.parse(fs.readFileSync(path.join(projectDir, rel), 'utf8'));
}

export function exists(projectDir: string, rel: string): boolean {
  return fs.existsSync(path.join(projectDir, rel));
}
