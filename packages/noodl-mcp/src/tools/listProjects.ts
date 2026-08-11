/**
 * BST-006 — `list_projects`: has this person built something already?
 *
 * ## Why this is a bootstrap tool and not a project tool
 *
 * TALK-004 considered a `list_projects` and correctly argued it cannot help a
 * **bound** server choose anything: `ProjectStore` is constructed once and
 * nothing rebinds it, so a list of other projects is a list of places this
 * server will never look. Unbound, that objection inverts. There is nothing to
 * rebind and a real question to answer — and the alternative to answering it is
 * an agent reaching for `create_project` and building a second app beside the
 * one its user meant.
 *
 * ## Where the list comes from
 *
 * The launcher's recent-projects list is `electron-store`, not renderer
 * `localStorage`:
 *
 * ```ts
 * private recentProjectsStore = new Store({ name: 'recently_opened_project' });
 * ```
 * (`noodl-editor/src/editor/src/utils/LocalProjectsModel.ts`)
 *
 * — so it is a JSON file under the app's user-data directory, readable by an
 * external process. That is the same discovery pattern `nodegx-observe` already
 * uses for the relay token, and this product therefore already ships a sidecar
 * that reads NodeGX's user-data.
 *
 * ## ⚠️ Read it, never write it
 *
 * The editor owns that file and rewrites it **wholesale** on `store()` — the
 * whole `recentProjects` array, from its in-memory model. A server writing there
 * races the editor and loses, and the thing it loses is the user's project list.
 * Nothing in this module opens the file for anything but reading.
 *
 * @module noodl-mcp/tools/listProjects
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { ListProjectsResponse, ProjectListRow } from './responses';
import { guarded, jsonResult } from './util';

/** Basename `electron-store` gives `new Store({ name: 'recently_opened_project' })`. */
const STORE_FILENAME = 'recently_opened_project.json';

/**
 * Electron's `app.getPath('userData')`, reconstructed.
 *
 * ⚠️ The directory is named after Electron's `app.getName()` — `productName`
 * from `noodl-editor/package.json`, which is **`NodeGX`**, not the npm name.
 * The rebrand's earlier names are searched too, because a user upgrading from an
 * OpenNoodl build has projects recorded under the old directory and "you have no
 * projects" is a much worse answer than one extra `existsSync`.
 *
 * ⚠️ **This list is duplicated in `nodegx-observe/src/token.ts`**, which finds
 * the relay token the same way. Two sidecars, one convention: if a future
 * product name is added, add it in both. They are separate packages with
 * separate builds and neither depends on the other, which is why this is a
 * mirrored constant rather than a shared import — the same trade `ProjectStore`
 * documents for its two refusal messages.
 */
export function userDataCandidates(appNames: readonly string[] = ['NodeGX', 'Noodl Editor', 'OpenNoodl']): string[] {
  const home = os.homedir();
  return appNames.map((name) => {
    if (process.platform === 'darwin') return path.join(home, 'Library', 'Application Support', name);
    if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), name);
    return path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), name);
  });
}

/** As much of the launcher's stored row as this tool reads. `thumbURI` is deliberately not in it. */
interface StoredProjectRow {
  retainedProjectDirectory?: unknown;
  name?: unknown;
  latestAccessed?: unknown;
}

export interface ProjectScanResult {
  projects: ProjectListRow[];
  /** Every store file that was looked for, in order. Reported when nothing was found. */
  searched: string[];
  /** Recorded projects whose directory is gone. A count, not a list — see {@link scanRecentProjects}. */
  missing: number;
}

/**
 * Classify a directory the way `ProjectStore`'s constructor would, without
 * constructing one.
 *
 * ⚠️ **A legacy project is marked, not dropped.** It is a project the user has
 * and this server cannot open, and saying that is strictly more useful than an
 * omission an agent reads as "you have never built anything" — which is the
 * answer that produces a duplicate.
 */
function formatOf(dir: string): ProjectListRow['format'] {
  if (fs.existsSync(path.join(dir, 'nodegx.project.json')) || fs.existsSync(path.join(dir, 'components', '_registry.json'))) {
    return 'v2';
  }
  return fs.existsSync(path.join(dir, 'project.json')) ? 'legacy' : 'unrecognised';
}

/**
 * Read every candidate store and merge.
 *
 * ⚠️ **Entries are verified before being reported**, because the list goes
 * stale: `LocalProjectsModel.fetch()` filters to folders that still exist for
 * exactly this reason, and a tool that reports a deleted directory sends an
 * agent to open nothing. The count of what was dropped is reported rather than
 * the paths — a stale row is not information, but "three of your projects have
 * moved" stops the user thinking the tool is broken.
 *
 * ⚠️ Never returns `thumbURI`. Each row in the store carries a base64 PNG
 * screenshot, and a dozen of them is roughly a megabyte of tokens for a picture
 * nothing here can look at.
 */
export function scanRecentProjects(candidates: readonly string[] = userDataCandidates()): ProjectScanResult {
  const searched: string[] = [];
  const byDirectory = new Map<string, ProjectListRow>();
  let missing = 0;

  for (const dir of candidates) {
    const file = path.join(dir, STORE_FILENAME);
    searched.push(file);
    let rows: StoredProjectRow[];
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { recentProjects?: unknown };
      if (!Array.isArray(parsed.recentProjects)) continue;
      rows = parsed.recentProjects as StoredProjectRow[];
    } catch {
      // Absent, unreadable or not JSON. All three mean the same thing to the
      // caller — this install has nothing to say — and none of them is an error.
      continue;
    }

    for (const row of rows) {
      const directory = typeof row.retainedProjectDirectory === 'string' ? row.retainedProjectDirectory : undefined;
      if (!directory) continue;
      const resolved = path.resolve(directory);
      if (byDirectory.has(resolved)) continue;
      if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
        missing += 1;
        continue;
      }
      const accessed = typeof row.latestAccessed === 'number' ? row.latestAccessed : undefined;
      byDirectory.set(resolved, {
        name: typeof row.name === 'string' && row.name.trim() ? row.name : path.basename(resolved),
        directory: resolved,
        format: formatOf(resolved),
        ...(accessed !== undefined ? { lastOpened: new Date(accessed).toISOString() } : {})
      });
    }
  }

  const projects = [...byDirectory.values()].sort((a, b) => (b.lastOpened ?? '').localeCompare(a.lastOpened ?? ''));
  return { projects, searched, missing };
}

/**
 * The sentence attached to the result.
 *
 * ⚠️ **Absent is a real answer, not an error.** A machine where NodeGX has never
 * run has no store file at all, and the right response is an empty list and the
 * way forward — the same posture the editor's `resolveMcpServer` takes for a
 * missing entry. Throwing here would turn "you are new" into "something is
 * broken".
 */
function noteFor(result: ProjectScanResult): string {
  const openable = result.projects.filter((p) => p.format === 'v2').length;
  const legacy = result.projects.length - openable;
  if (result.projects.length === 0) {
    return (
      'No NodeGX projects recorded on this machine — either nothing has been built yet, or NodeGX has never ' +
      'been opened here. create_project is the way forward; scope the app with the user first.'
    );
  }
  return (
    `${openable} project(s) this server can open` +
    (legacy > 0
      ? `, and ${legacy} in the legacy format, which must be migrated in the NodeGX editor (project settings → ` +
        'migrate) before a server can be pointed at it'
      : '') +
    (result.missing > 0 ? `. ${result.missing} recorded project(s) are no longer on disk and are not listed` : '') +
    '. To work in one, start a server with its `directory` as the argument, plus --allow-writes. ' +
    'Editing the project the user already has is almost always what they meant — only create a new one when ' +
    'they have asked for something new.'
  );
}

export function registerListProjectsTools(server: McpServer): void {
  server.registerTool(
    'list_projects',
    {
      title: 'List NodeGX projects on this machine',
      description:
        'The NodeGX projects this machine has opened, newest first: name, directory, format and when it was ' +
        'last opened. Read from the launcher\'s own recent-projects list, and never written to. Call this ' +
        'BEFORE create_project when the user talks about their app as something that already exists — building ' +
        'a second copy beside the real one is not undoable by a tool call. An empty list is a valid answer and ' +
        'means this is a fresh machine.',
      inputSchema: {}
    },
    guarded(() => {
      const result = scanRecentProjects();
      const payload: ListProjectsResponse = {
        projects: result.projects,
        note: noteFor(result),
        // Only when there is nothing, and then it is the whole diagnosis: a
        // person whose projects are missing needs to know which file was read,
        // and a build under a different product name writes to a different one.
        ...(result.projects.length === 0 ? { searched: result.searched } : {})
      };
      return jsonResult(payload);
    })
  );
}
