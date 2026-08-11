/**
 * MCP-001 — everything the "Connect an AI agent" settings section needs from the main process.
 *
 * The section emits two `claude mcp add …` commands. Building those strings is pure and lives in
 * the renderer (`SettingsPanel/sections/mcpCommands.ts`); everything that needs the filesystem or
 * Electron lives here, behind one IPC channel:
 *
 *   - **where the two bundles are** — `resolveMcpServer`, which already knows the dev, app-path
 *     and `resourcesPath` layouts. This is the only path answer; nothing else guesses.
 *   - **whether the open project is one `noodl-mcp` will accept** — the same two-file check the
 *     server itself performs, so the button is unavailable for the same reason and with the same
 *     words rather than the command dying at spawn time.
 *
 * ⚠️ The renderer cannot call `resolveMcpServer` directly. It reads `__dirname` relative to the
 * *main* bundle and asks `require('electron').app` for the app path — neither of which means
 * anything in a renderer. Hence the round trip.
 *
 * @module main/src/mcp/mcpFrontDoor
 */

const fs = require('fs');
const path = require('path');

const { resolveMcpServers } = require('./resolveMcpServer');
const { resolveNodeRuntime, warmNodeRuntime } = require('./resolveNodeRuntime');

/**
 * The verdict on a project directory, in `noodl-mcp`'s own words.
 *
 * ⚠️ **Two copies of these strings, deliberately named at both ends.** The originals are
 * `ProjectStore`'s constructor
 * (packages/noodl-mcp/src/project/ProjectStore.ts — `not-found` and `not-a-v2-project`), which
 * has a comment pointing back here. They cannot be imported: `@noodl/mcp` is not a dependency of
 * the editor, and making it one to reach three sentences would drag the whole server bundle into
 * the editor's main process. If you change the wording there, change it here.
 *
 * @param {string|null|undefined} projectDir
 * @returns {{ dir: string, format: 'v2'|'legacy'|'not-a-project'|'missing', message?: string }|null}
 *   `null` when no project is open — which is a different state from "the open project is wrong",
 *   and the section says so differently.
 */
function describeProject(projectDir) {
  if (!projectDir) return null;

  const dir = path.resolve(projectDir);

  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    return { dir, format: 'missing', message: `Project directory does not exist: ${dir}` };
  }

  const isV2 =
    fs.existsSync(path.join(dir, 'components', '_registry.json')) ||
    fs.existsSync(path.join(dir, 'nodegx.project.json'));

  if (isV2) return { dir, format: 'v2' };

  if (fs.existsSync(path.join(dir, 'project.json'))) {
    return {
      dir,
      format: 'legacy',
      message:
        `${dir} holds a legacy monolithic project.json. Migrate it to the v2 format ` +
        `(NodeGX editor: project settings → migrate) before using the MCP server.`
    };
  }

  return {
    dir,
    format: 'not-a-project',
    message: `${dir} is not a NodeGX v2 project (no nodegx.project.json or components/_registry.json).`
  };
}

/**
 * Both server resolutions, the project verdict, and which runtime can run them — one answer for
 * one panel.
 *
 * ⚠️ **BST-004: `runtime` is why the renderer does no detection of its own.** Whether `node`
 * resolves is a property of the machine, and the renderer cannot see the machine. It is one more
 * field here on the exact model of `entry` and `probed`.
 *
 * @param {string|null|undefined} projectDir the open project's retained directory, or nothing.
 * @param {{ packagesRoots?: string[] }} [options] passed through to the resolvers, for tests.
 */
function describeMcpFrontDoor(projectDir, options) {
  return {
    servers: resolveMcpServers(options),
    project: describeProject(projectDir),
    runtime: resolveNodeRuntime(options),
    isPackaged: (options && typeof options.isPackaged === 'boolean' ? options.isPackaged : isPackagedApp())
  };
}

/**
 * Is this a shipped app or a checkout?
 *
 * Only the *advice* for a missing bundle depends on it — "run the build" is right in a checkout
 * and nonsense in an installed app, where the honest answer is that the download is incomplete.
 * Defaults to `false` (a checkout) when Electron is not around at all, which is only ever a test.
 */
function isPackagedApp() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron');
    return Boolean(app && app.isPackaged);
  } catch (e) {
    return false;
  }
}

/** The channel name, so the renderer and this file cannot drift apart on a string. */
const MCP_FRONT_DOOR_CHANNEL = 'mcp:front-door';

/**
 * Register the channel. Called once from `app.on('ready')`, beside the other `setup*IPC` calls.
 *
 * It re-resolves on every call rather than caching: the answer changes when someone runs
 * `npm run build:sidecars` in a checkout with the editor already open, and a cached "not built"
 * would then be wrong until the next restart with nothing on screen to say so.
 */
function setupMcpIPC(ipcMain) {
  ipcMain.handle(MCP_FRONT_DOOR_CHANNEL, (_event, projectDir) => describeMcpFrontDoor(projectDir));

  // ⚠️ BST-004: get the login-shell PATH probe out of the way before anyone opens the panel. On a
  // Finder-launched mac it costs ~2.3s, and this handler is synchronous — un-warmed, the first
  // person to open settings pays it as a freeze. Deliberately not awaited: nothing here blocks
  // startup, and if it fails the panel simply pays the cost itself.
  warmNodeRuntime();
}

module.exports = { MCP_FRONT_DOOR_CHANNEL, describeProject, describeMcpFrontDoor, setupMcpIPC };
