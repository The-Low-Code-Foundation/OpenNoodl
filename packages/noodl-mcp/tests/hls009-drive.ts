/**
 * HLS-009 — the drive, as a re-runnable instrument.
 *
 * Deliberately **not** a `.test.ts`: jest's `testMatch` is `tests/**\/*.test.ts`, and a spec that
 * needs a running editor would be red on every machine that does not have one. This is the same
 * split `hls010-spike/` made — the gate is the suite, the drive is a script you point at a live
 * app and read.
 *
 * It goes through the MCP client, not through the tool function, because the thing being graded is
 * the door a model actually has: registration, deferral, `find_tools`, argument schema and all.
 *
 *   npx ts-node -P packages/noodl-mcp/tsconfig.json packages/noodl-mcp/tests/hls009-drive.ts <dir>
 *
 * ⚠️ **The relay token and port are read off the RUNNING editor's argv, not off the default
 * user-data directory.** That is C70: a dev-launched editor gets its own `--user-data-dir`, and
 * the token sitting at `~/Library/Application Support/NodeGX/relay-token` is a stale one from some
 * previous launch. Presenting it reports "the relay rejected this token", which reads like a
 * restart problem and is actually a wrong-install problem.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createServer } from '../src/server';

/** The running editor's `--user-data-dir`, read off its own command line. */
function editorUserDataDir(): string {
  const ps = execSync('ps -Ao args', { encoding: 'utf8' });
  for (const line of ps.split('\n')) {
    if (!line.includes('--type=renderer')) continue;
    if (!line.includes('noodl-editor')) continue;
    // ⚠️ **Not `(\S+)`.** The default user-data directory on macOS is
    // `~/Library/Application Support/NodeGX` — it contains a space, and a non-greedy match to the
    // next ` --flag` is the only way to read it off a flat `ps` line. The `\S+` version silently
    // returned `/Users/…/Library/Application` and reported ENOENT on a path that has never
    // existed, which reads as "no token" rather than as "bad parse".
    const m = /--user-data-dir=(.*?)(?= --[a-z]|$)/.exec(line);
    if (m) return m[1];
  }
  throw new Error('No running noodl-editor renderer found. Launch the editor first (npm run dev:debug).');
}

async function main() {
  const directory = process.argv[2];
  if (!directory) throw new Error('usage: hls009-drive.ts <absolute project directory>');

  const userData = editorUserDataDir();
  const tokenFile = path.join(userData, 'relay-token');
  process.env.NODEGX_RELAY_TOKEN = fs.readFileSync(tokenFile, 'utf8').trim();
  console.log(`[drive] editor user-data: ${userData}`);
  console.log(`[drive] token from:       ${tokenFile}`);
  console.log(`[drive] relay port:       ${process.env.NODEGX_RELAY_PORT || process.env.NOODLPORT || 8574}`);

  // ⚠️ A static import, not a deferred one. `findRelayToken()` and `relayPort()` both read
  // `process.env` **per call**, so import order cannot matter — and a `await import()` under
  // ts-node's CJS mode escapes to real ESM resolution and fails to find a `.ts` file at all.
  const { server } = createServer({ projectDir: directory, allowWrites: true });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'hls009-drive', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  // The same door a model has: the tool is deferred, so it has to be found first.
  const found = (await client.callTool({ name: 'find_tools', arguments: { query: 'editor' } })) as {
    content: Array<{ text: string }>;
  };
  console.log('[drive] find_tools({query:"editor"}) ->', found.content[0].text.slice(0, 200));

  // 🔴 `HLS009_WAIT_FOR` exists for AC2's flush, and the reason is a self-healing defect.
  // `scheduleProjectSave()` debounces by **one second**. A drive that pays ts-node's startup
  // between the edit and the switch arrives after the autosave has already written — so the file
  // would contain the edit whether or not `flushPendingProjectSave()` was ever called, and the
  // arm would be green with the flush deleted. Arming the client first and releasing it with a
  // trigger file is what puts the call inside the window it is supposed to be tested in.
  const waitFor = process.env.HLS009_WAIT_FOR;
  if (waitFor) {
    console.log('[drive] armed — waiting for ' + waitFor);
    while (!fs.existsSync(waitFor)) await new Promise((r) => setTimeout(r, 5));
    console.log('[drive] released at ' + Date.now());
  }

  const res = (await client.callTool({ name: 'open_in_editor', arguments: { directory } })) as {
    isError?: boolean;
    content: Array<{ text: string }>;
  };
  console.log(`[drive] open_in_editor isError=${!!res.isError}`);
  console.log(res.content[0].text);

  await client.close();
}

main().catch((e) => {
  console.error('[drive] FAILED:', e.message);
  process.exit(1);
});
