/**
 * Which locally known projects point their `cloudservices` at which backend.
 *
 * `LocalProjectsModel` only caches {id, name, latestAccessed, thumbURI,
 * retainedProjectDirectory} — never a project's `cloudservices` pointer — so
 * answering "which projects use this backend" means reading each project's
 * own root file directly rather than opening every known project through
 * `projectFromDirectory` just to read one field. That would be enormously
 * more expensive than the question being asked, and would fight whichever
 * project the user actually has open.
 *
 * @module noodl-editor/utils/backendProjectLinks
 */

import { filesystem } from '@noodl/platform';

import { LocalProjectsModel } from './LocalProjectsModel';

interface ProjectRootFileShape {
  metadata?: {
    cloudservices?: {
      instanceId?: string;
    };
  };
}

/**
 * Backend id -> names of every known local project whose `cloudservices`
 * points at it. Projects this editor cannot currently read (moved, deleted,
 * mid-write) are silently excluded — an unreadable project is not evidence of
 * a link, and this is advisory information, not a gate.
 */
export async function mapBackendsToProjectNames(): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  const projects = LocalProjectsModel.instance.getProjects();

  await Promise.all(
    projects.map(async (entry) => {
      const dir = entry.retainedProjectDirectory;
      if (!dir) return;

      // v2 projects keep only `nodegx.project.json` + `components/`; legacy
      // ones are the single `project.json` this same `metadata` key has
      // always lived on. Try v2 first — that is the default format today.
      const v2Path = filesystem.join(dir, 'nodegx.project.json');
      const legacyPath = filesystem.join(dir, 'project.json');
      const path = filesystem.exists(v2Path) ? v2Path : legacyPath;
      if (!filesystem.exists(path)) return;

      try {
        const data = await filesystem.readJson<ProjectRootFileShape>(path);
        const backendId = data?.metadata?.cloudservices?.instanceId;
        if (!backendId) return;

        const names = map.get(backendId) ?? [];
        names.push(entry.name);
        map.set(backendId, names);
      } catch {
        // Unreadable or mid-write — say nothing rather than guess.
      }
    })
  );

  return map;
}
