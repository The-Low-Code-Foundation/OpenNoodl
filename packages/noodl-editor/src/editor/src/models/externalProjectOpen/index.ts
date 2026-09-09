import { filesystem } from '@noodl/platform';

import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';
import { AppRouter } from '../../pages/AppRouter';
import { getIpc } from '../../utils/ipc';
import { ViewerConnection } from '../../ViewerConnection';
import { LocalProjectsModel } from '../../utils/LocalProjectsModel';
import { ProjectModel, flushPendingProjectSave } from '../projectmodel';
import { decideOpenDisposition, type OpenDisposition } from './decide';

/**
 * HLS-009 — the editor half of "something other than a mouse opens a project".
 *
 * ## The one writer
 *
 * 🔴 **Nothing here writes `recently_opened_project.json`, and that is the point of routing the
 * request through the editor at all.** The launcher store is `electron-store`, and
 * `LocalProjectsModel.store()` rewrites the whole `recentProjects` array from its in-memory
 * model on every change — so a second process appending a row does not append a row, it stages
 * one that the editor's next `store()` silently deletes. `noodl-mcp`'s `list_projects` already
 * documents this and reads the file without ever opening it for write.
 *
 * That leaves one writer after this task, exactly as it was before it: this window.
 * `openProjectFromFolder` is the same call the "Open project…" menu item makes, so an agent-
 * opened project is registered by the identical code path as a person-opened one, and #28 —
 * "a project created through the MCP server never appears in Recent projects" — closes as a
 * consequence rather than as a second mechanism.
 *
 * ## Why a project switch goes via the projects screen
 *
 * `AppRouter.route()` opens with `if (this._route == args.to) return;`, so an editor → editor
 * route is a **silent no-op**: a switch performed that way would report success and leave the
 * previous project on screen. The supported sequence is the one a person performs — back to the
 * projects screen, then in again — and `router.tsx` documents having fixed exactly that path
 * ("open one project, go back, open another"), including the disposal race that used to
 * white-screen the window. This reuses it rather than inventing a second way to change projects.
 *
 * ⚠️ **The flush is not optional and it is not the autosave.** `scheduleProjectSave()` debounces
 * by a second; an agent that edits through the MCP server and then asks for a different project
 * lands inside that window routinely, and unlike a person it does not pause. AC2's "does not lose
 * unsaved work" is this `await`.
 *
 * @module models/externalProjectOpen
 */

/** What the caller is told. `disposition` is the disposition's `action`, verbatim. */
export interface OpenInEditorResult {
  ok: boolean;
  disposition: OpenDisposition['action'];
  directory?: string;
  projectName?: string;
  /** Present on `switch`: the project that was flushed and closed. */
  leaving?: string;
  /** Present on `refuse`, and always a sentence the caller can act on without asking a person. */
  reason?: string;
}

/** `nodegx.project.json` is v2, `project.json` legacy. The launcher opens both. */
function looksLikeProject(directory: string): boolean {
  return (
    filesystem.exists(filesystem.join(directory, 'nodegx.project.json')) ||
    filesystem.exists(filesystem.join(directory, 'project.json'))
  );
}

function isCaseInsensitiveFilesystem(): boolean {
  return process.platform === 'darwin' || process.platform === 'win32';
}

/**
 * Bring the window to the front.
 *
 * ⚠️ Deliberately **after** the route, not before: the person is being shown a project, and a
 * window raised while it still shows the previous one is a worse experience than a window raised
 * a frame late. Best-effort — outside Electron there is no window and no error worth raising.
 */
function focusWindow(): void {
  getIpc()?.send('main-window-focus');
}

/**
 * Perform one request and answer it.
 *
 * Exported for the drive: HLS-011 needs to reach this without a socket, and a test that has to
 * stand up a relay to grade a routing decision is testing the relay.
 */
export async function performExternalOpen(directory: unknown, router: AppRouter): Promise<OpenInEditorResult> {
  const open = ProjectModel.instance?._retainedProjectDirectory;
  const asString = typeof directory === 'string' ? directory.trim() : '';

  const disposition = decideOpenDisposition({
    requested: directory,
    open,
    // ⚠️ Both probes are guarded by `asString`, because `filesystem.exists('')` is a question
    // about the process's working directory and answers `true`. That would have turned "no
    // directory given" into "not a NodeGX project", which is a true sentence about the wrong
    // folder — and `decideOpenDisposition` would never have reached its own empty-string branch.
    exists: asString !== '' && filesystem.exists(asString),
    isProject: asString !== '' && filesystem.exists(asString) && looksLikeProject(asString),
    caseInsensitive: isCaseInsensitiveFilesystem()
  });

  if (disposition.action === 'refuse') {
    return { ok: false, disposition: 'refuse', reason: disposition.reason };
  }

  if (disposition.action === 'already-open') {
    // 🔴 No load, no route, no `touchProject`. AC2 is that a second ask changes nothing, and the
    // cheapest way to be sure of that is for this branch to do nothing that could.
    focusWindow();
    return {
      ok: true,
      disposition: 'already-open',
      directory: open,
      projectName: ProjectModel.instance?.name
    };
  }

  if (disposition.action === 'switch') {
    // 🔴 **Measured, not assumed** (session 10's drive, both arms inside the debounce window).
    // With this line, a `setMetaData` released 4ms before the switch survives in the leaving
    // project's `nodegx.project.json`. With it disabled, released 3ms before the switch, the same
    // edit is **gone** — and `open_in_editor` reports the identical `disposition: "switch"` and the
    // identical success note in both arms. The report cannot see the difference; only the file can.
    await flushPendingProjectSave();
    router.route({ to: 'projects' });
    // One turn of the loop, so the projects route is the current one before the next `route()`
    // is asked to leave it. Without this the editor → projects → editor pair collapses into the
    // same-route early return the module note describes, and the switch silently does nothing.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const project = await LocalProjectsModel.instance.openProjectFromFolder(asString).catch(() => null);
  if (!project) {
    return {
      ok: false,
      disposition: 'refuse',
      reason: `"${asString}" could not be opened. The editor's log has the reason.`
    };
  }

  router.route({ to: 'editor', project });
  focusWindow();

  return {
    ok: true,
    disposition: disposition.action,
    directory: asString,
    projectName: project.name,
    ...(disposition.action === 'switch' ? { leaving: disposition.leaving } : {})
  };
}

/**
 * Listen for `openProject` on the relay, for the life of the window.
 *
 * Installed once, from `router.tsx`, because the router is the only thing that can route and
 * there is exactly one of it. Never removed: the window is the subscription's lifetime.
 */
export function installExternalProjectOpen(router: AppRouter): void {
  EventDispatcher.instance.on(
    'ViewerConnection.openProjectRequested',
    (args: { directory: unknown; requestId: string; replyTo: string }) => {
      performExternalOpen(args?.directory, router)
        .catch((e) => ({
          ok: false as const,
          disposition: 'refuse' as const,
          reason: 'The editor failed while opening it: ' + (e?.message || String(e))
        }))
        .then((result) => {
          ViewerConnection.instance?.sendOpenProjectResult(args?.replyTo, args?.requestId, result);
        });
    },
    null
  );
}
