/**
 * BST-005 — this server's half of the two files a new project ships with.
 *
 * The rendering, the never-overwrite rule and the `.gitignore` merge are shared
 * with the editor and live in `editor-deps`' `agentConfig`. What is here is the
 * two things only this process knows: how to reach a real filesystem, and **how
 * this server was launched**.
 *
 * ## ⚠️ Why the registration comes from `process`, and not from a resolver
 *
 * BST-005 §4: the runtime and the bundle path are known in different processes.
 * The editor resolves them through the front door; this server has no idea what
 * BST-004 decided and must not guess. But it does not have to — **it is the
 * server being registered**, so `process.execPath` + `process.argv[1]` is the
 * launch that is currently working, reproduced. Correct by construction rather
 * than re-derived, which is the one property a path answer here can have.
 *
 * ⚠️ **Windows is expectation, not measurement** — the same debt BST-004 carries.
 * The strings compose correctly (`NodeGX.exe`, `ELECTRON_RUN_AS_NODE=1`); that
 * the client spawns them and gets clean stdio has never been run on a Windows
 * machine, because there is not one.
 *
 * @module noodl-mcp/project/agentConfig
 */

import * as fs from 'fs';
import * as path from 'path';

import type { AgentConfigHost, AgentConfigReport, AgentServerRegistration } from '../editor-deps';
import { authoringServerName, installAgentConfig } from '../editor-deps';

/**
 * How this process was started, as a registration for the project at `projectDir`.
 *
 * `env` carries `ELECTRON_RUN_AS_NODE` only when this *is* an Electron binary
 * pretending to be Node — 🔴 the flag is load-bearing and the naive test says
 * otherwise (BST-004/F80): without it the binary boots a GUI app and serves
 * stdio anyway, so a registration that dropped it would look fine and leave a
 * dock icon and an event loop that never exits.
 *
 * @returns `null` when there is no entry script to name — a server started
 *   through a REPL or an embedding host. Nothing is written rather than a
 *   registration pointing at nothing.
 */
export function selfRegistration(projectDir: string): AgentServerRegistration | null {
  const entry = process.argv[1];
  if (!entry) return null;

  const isElectron = Boolean((process.versions as Record<string, string | undefined>).electron);

  return {
    type: 'stdio',
    command: process.execPath,
    args: [path.resolve(entry), projectDir, '--allow-writes'],
    env: isElectron ? { ELECTRON_RUN_AS_NODE: '1' } : {}
  };
}

/** The shared installer's three primitives, over `fs`, rooted at one directory. */
export function nodeHost(projectDir: string): AgentConfigHost {
  const resolve = (relativePath: string): string => path.join(projectDir, ...relativePath.split('/'));
  return {
    exists: (relativePath) => fs.existsSync(resolve(relativePath)),
    read: (relativePath) => fs.readFileSync(resolve(relativePath), 'utf8'),
    write: (relativePath, content) => {
      const abs = resolve(relativePath);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      // Atomic, like every other write in this package: a half-written
      // `.mcp.json` is a client that refuses to start rather than one that
      // starts without a server.
      const tmp = `${abs}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
      fs.writeFileSync(tmp, content, 'utf8');
      fs.renameSync(tmp, abs);
    }
  };
}

export interface WriteAgentConfigOptions {
  projectDir: string;
  projectName: string;
  summary?: string;
  hasDocs: boolean;
  /** Injectable so the suite is not registering jest's own binary. */
  registration?: AgentServerRegistration | null;
}

/**
 * Write `.mcp.json` and `CLAUDE.md` into a project this server just created.
 *
 * ⚠️ **Never throws.** Project creation must not fail because a `CLAUDE.md`
 * could not be written — the caller asked for a project, and a project without
 * a `CLAUDE.md` is still a project. It must not be silent either, so a failure
 * comes back as a `skipped` row carrying the reason, which the tool result
 * reports. `starterAssets.ts` settled this posture for the same question.
 */
export async function writeAgentConfig(options: WriteAgentConfigOptions): Promise<AgentConfigReport> {
  const registration =
    options.registration === undefined ? selfRegistration(options.projectDir) : options.registration;

  try {
    return await installAgentConfig(nodeHost(options.projectDir), {
      projectName: options.projectName,
      serverName: authoringServerName(options.projectDir),
      registration,
      summary: options.summary,
      hasDocs: options.hasDocs
    });
  } catch (err) {
    return {
      files: [
        {
          path: '.mcp.json, CLAUDE.md',
          outcome: 'skipped',
          reason: `Could not write the agent configuration: ${(err as Error).message}`
        }
      ],
      written: []
    };
  }
}
