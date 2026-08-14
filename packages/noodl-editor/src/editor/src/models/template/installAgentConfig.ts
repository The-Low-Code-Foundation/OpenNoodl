/**
 * BST-005 — the editor's half of the two files a new project ships with.
 *
 * ⚠️ **Both project-creating paths, or the question is unanswerable.** A project
 * made at the launcher must carry the same files as one made by
 * `create_project`, otherwise the answer to *"why doesn't my agent know about
 * this project?"* is *"depends how you made it"* — which the user cannot check
 * and cannot fix. `LocalProjectsModel.newProject` is the one seam both the
 * manual wizard and the AI scoping wizard go through, the same hook
 * `installStarterAssets` uses for the same reason.
 *
 * ⚠️ **FIX-008 B: creating is no longer the only path.** Every project that existed before BST-005
 * shipped — and every checkout cloned from git — opens with neither file, which is most of the
 * projects on any real disk. {@link backfillProjectAgentConfig} is the same write on the *open*
 * seam, so "why doesn't my agent know about this project?" stops answering "depends when you made
 * it" as well as "depends how".
 *
 * The rendering and the never-overwrite rule are shared with `noodl-mcp` in
 * `./agentConfig`. What is here is the two things only the editor knows: the
 * `@noodl/platform` filesystem, and the front door — which is the only thing in
 * the product that can say where the server bundle is and what can run it
 * (BST-004: whether `node` resolves is a property of the machine, and a renderer
 * that guesses guesses wrong on exactly the installs this phase is written for).
 *
 * @module noodl-editor/models/template/installAgentConfig
 */

import { filesystem } from '@noodl/platform';

import { ipcInvoke } from '@noodl-utils/ipc';

import type { McpFrontDoor } from '../../views/panels/SettingsPanel/sections/mcpCommands';
import { buildProjectRegistration } from '../../views/panels/SettingsPanel/sections/mcpCommands';
import type { AgentConfigHost, AgentConfigReport } from './agentConfig';
import { backfillAgentConfig, installAgentConfig } from './agentConfig';

/** The shared installer's three primitives over `@noodl/platform`, rooted at one project. */
export function platformHost(projectDirectory: string): AgentConfigHost {
  const resolve = (relativePath: string): string =>
    relativePath.split('/').reduce((acc, part) => filesystem.join(acc, part), projectDirectory);

  return {
    exists: (relativePath) => filesystem.exists(resolve(relativePath)),
    read: (relativePath) => filesystem.readFile(resolve(relativePath)),
    write: async (relativePath, content) => {
      const target = resolve(relativePath);
      await filesystem.makeDirectory(filesystem.dirname(target));
      await filesystem.writeFile(target, content);
    }
  };
}

export interface InstallAgentConfigOptions {
  projectDirectory: string;
  projectName: string;
  /** Whether `create_project`-style docs exist. The launcher's templates do not write them. */
  hasDocs?: boolean;
  /** Injected by the suite, so a spec never depends on IPC or on this machine's install. */
  frontDoor?: McpFrontDoor | null;
}

/**
 * Write `.mcp.json` and `CLAUDE.md` into a freshly created project.
 *
 * ⚠️ **Never throws, and never blocks project creation.** The user asked for a
 * project; a project whose agent configuration could not be written is still a
 * project. But it is reported rather than swallowed — a folder that is silently
 * unconfigured looks exactly like one that is configured, which is the whole
 * failure BST-005 exists to remove.
 */
export async function installProjectAgentConfig(
  options: InstallAgentConfigOptions
): Promise<AgentConfigReport> {
  const { projectDirectory, projectName } = options;

  return await reportingFailures(async () => {
    const { serverName, registration } = await resolveRegistration(options);
    return await installAgentConfig(platformHost(projectDirectory), {
      projectName,
      serverName,
      registration,
      hasDocs: options.hasDocs ?? false
    });
  });
}

/**
 * FIX-008 B — write the same two files into a project that was merely **opened**.
 *
 * BST-005 shipped the write on creation and left backfill optional; the result is a disk full of
 * projects an agent cannot see (43 of 44, measured). This is the same installer with the same
 * never-overwrite rule, behind {@link backfillAgentConfig}'s extra refusal: a project the authoring
 * server would not open does not get a registration naming it.
 *
 * ⚠️ **`hasDocs` is not a parameter here.** The creating caller knows what it just wrote; a caller
 * opening a project from 2024 does not, so the folder is asked.
 */
export async function backfillProjectAgentConfig(
  options: Omit<InstallAgentConfigOptions, 'hasDocs'>
): Promise<AgentConfigReport> {
  const { projectDirectory, projectName } = options;

  return await reportingFailures(async () => {
    const { serverName, registration } = await resolveRegistration(options);
    return await backfillAgentConfig(platformHost(projectDirectory), {
      projectName,
      serverName,
      registration
    });
  });
}

/**
 * The front door, and the registration it implies for this directory.
 *
 * ⚠️ No front door at all is a different state from a front door that could not resolve the bundle,
 * and both end the same way: `CLAUDE.md` is still worth writing, and it says there is no server
 * rather than naming one.
 */
async function resolveRegistration(options: Omit<InstallAgentConfigOptions, 'hasDocs'>) {
  const frontDoor =
    options.frontDoor !== undefined
      ? options.frontDoor
      : await ipcInvoke<McpFrontDoor>('mcp:front-door', options.projectDirectory);

  return frontDoor
    ? buildProjectRegistration(frontDoor, options.projectDirectory)
    : { serverName: 'nodegx', registration: null };
}

/** Never throws, never silent — the posture both callers need, written once. */
async function reportingFailures(run: () => Promise<AgentConfigReport>): Promise<AgentConfigReport> {
  try {
    return await run();
  } catch (err) {
    console.error('Could not write the project’s agent configuration', err);
    return {
      files: [
        {
          path: '.mcp.json, CLAUDE.md',
          outcome: 'skipped',
          reason: `Could not write the agent configuration: ${(err as Error)?.message ?? String(err)}`
        }
      ],
      written: []
    };
  }
}
