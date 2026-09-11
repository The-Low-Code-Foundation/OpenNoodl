/**
 * FLD-010 — the drive, as a re-runnable instrument. AC1 and AC3.
 *
 * Deliberately **not** a `.test.ts`, for `hls009-drive.ts`'s reason: a spec that needs a running
 * editor would be red on every machine that does not have one. The gate is the suite; this is the
 * script you point at a live app and read.
 *
 * It goes through the MCP client rather than the tool function, so what is graded is the door a
 * model actually has — registration, deferral, `find_tools`, argument schema and all.
 *
 *   npx ts-node -P packages/noodl-mcp/tsconfig.json packages/noodl-mcp/tests/fld010-drive.ts <dir>
 *
 * ## 🔴 Why it arms and waits instead of just calling
 *
 * AC3 wants `unsavedBuffers` true *while an edit is held* and false after the save — both arms in
 * one drive. `scheduleProjectSave()` debounces by **one second**, and ts-node's startup is several.
 * A drive that made the edit and then started would arrive after the autosave had already written,
 * read `false`, and be unable to tell that from a broken feature. So the client connects FIRST and
 * blocks on a trigger file; the CDP side makes the edit and touches the file, which puts the call
 * inside the window it is meant to measure. Same instrument, same reason, as `HLS009_WAIT_FOR`.
 *
 * ⚠️ **The token and port come off the RUNNING editor's argv, not the default user-data
 * directory** — C70. A dev-launched editor gets its own `--user-data-dir`, and the token at
 * `~/Library/Application Support/NodeGX/relay-token` is a stale one from some previous launch.
 * With `FLD010_EXPECT_NO_EDITOR=1` there is deliberately no editor to read it from, so the lookup
 * is skipped and a *stale* token is presented on purpose — that is AC4's live half.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createServer } from '../src/server';

/** The running editor's `--user-data-dir`, read off its own command line. */
function editorUserDataDir(): string | undefined {
  const ps = execSync('ps -Ao args', { encoding: 'utf8' });
  for (const line of ps.split('\n')) {
    if (!line.includes('--type=renderer')) continue;
    if (!line.includes('noodl-editor')) continue;
    // Not `(\S+)` — the default path contains a space. See `hls009-drive.ts`.
    const m = /--user-data-dir=(.*?)(?= --[a-z]|$)/.exec(line);
    if (m) return m[1];
  }
  return undefined;
}

async function main() {
  const directory = process.argv[2];
  if (!directory) throw new Error('usage: fld010-drive.ts <absolute project directory>');

  const expectNoEditor = process.env.FLD010_EXPECT_NO_EDITOR === '1';
  const userData = editorUserDataDir();

  if (userData && !expectNoEditor) {
    const tokenFile = path.join(userData, 'relay-token');
    process.env.NODEGX_RELAY_TOKEN = fs.readFileSync(tokenFile, 'utf8').trim();
    console.log(`[drive] editor user-data: ${userData}`);
    console.log(`[drive] token from:       ${tokenFile}`);
  } else {
    // 🔴 **AC4's live half, and it is deliberately NOT a fabricated token.** With no editor
    // running there is no argv to read a user-data directory off, so this falls back to the
    // default one — where the token the LAST launch wrote is still sitting, because the editor
    // never unlinks it on quit. That is not a contrived state: it is the state every machine with
    // NodeGX installed is in whenever the app is closed, and it is the exact input that makes the
    // obvious "does the token file exist?" implementation answer `editorAttached: true`.
    const fallback = path.join(
      process.env.HOME || '',
      'Library',
      'Application Support',
      'NodeGX',
      'relay-token'
    );
    let stale: string | undefined;
    try {
      stale = fs.readFileSync(fallback, 'utf8').trim();
    } catch {
      /* no previous launch on this machine */
    }
    if (stale) process.env.NODEGX_RELAY_TOKEN = stale;
    console.log(
      `[drive] no running editor; using the token the LAST launch left at ${fallback} ` +
        `(present: ${Boolean(stale)})`
    );
  }
  console.log(`[drive] relay port:       ${process.env.NODEGX_RELAY_PORT || process.env.NOODLPORT || 8574}`);

  const { server } = createServer({ projectDir: directory, allowWrites: true });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'fld010-drive', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  // The same door a model has: the tool is deferred, so it has to be found first.
  const found = (await client.callTool({ name: 'find_tools', arguments: { query: 'unsaved' } })) as {
    content: Array<{ text: string }>;
  };
  console.log('[drive] find_tools({query:"unsaved"}) ->', found.content[0].text.slice(0, 240));

  async function status(label: string) {
    const res = (await client.callTool({ name: 'session_status', arguments: { directory } })) as {
      isError?: boolean;
      content: Array<{ text: string }>;
    };
    console.log(`\n[drive] ===== ${label} (isError=${!!res.isError}) =====`);
    console.log(res.content[0].text);
    return JSON.parse(res.content[0].text) as Record<string, unknown>;
  }

  const waitFor = process.env.FLD010_WAIT_FOR;
  if (waitFor) {
    console.log('[drive] armed — waiting for ' + waitFor);
    while (!fs.existsSync(waitFor)) await new Promise((r) => setTimeout(r, 5));
    console.log('[drive] released at ' + Date.now());
  }

  const first = await status(waitFor ? 'AC3 arm A — inside the debounce window' : 'AC1');

  if (waitFor) {
    // Past the 1s debounce and the write. Deliberately read from the clock rather than from an
    // event: the point of the second arm is that the flag clears on its own once the write lands.
    await new Promise((r) => setTimeout(r, 3000));
    const second = await status('AC3 arm B — after the save has landed');
    console.log(
      `\n[drive] AC3: unsavedBuffers ${String(first.unsavedBuffers)} -> ${String(second.unsavedBuffers)}`
    );
  }

  await client.close();
}

main().catch((e) => {
  console.error('[drive] FAILED:', e.message);
  process.exit(1);
});
