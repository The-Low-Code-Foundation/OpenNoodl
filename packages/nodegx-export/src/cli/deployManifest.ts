/**
 * HLS-014 — the record a deploy leaves behind, so that the next one is an **update** rather than
 * a second first deploy.
 *
 * ## Why a folder needs a record at all
 *
 * `nodegx deploy` writes a site. Everything about that write is content-addressed — the export is
 * `index-<hash>.js`, each bundle is `<id>-<hash>.json` — which is exactly right for a CDN and
 * exactly wrong for a folder somebody deploys into twice. Nothing in the write path deletes, so
 * measured on a real redeploy of `templates/landing-pages` after a one-word edit:
 *
 * ```
 * index-842da8235ea3dad0.js      ← deploy 1, nothing serves it any more
 * index-b529d7656259c342.js      ← deploy 2, what index.html points at
 * noodl_bundles/b2-378e4cd5a13ab7f7.json   ← deploy 1's /Pages/Business
 * noodl_bundles/b2-6ac1955a1e568848.json   ← deploy 2's /Pages/Business
 * ```
 *
 * The served app was correct in that state. Three other things were not: the folder kept serving
 * the previous version of every changed page at its old URL, the blank-site reading that HLS-015
 * exists for was taken from **the stale export** (`readdirSync().find()` returned deploy 1's), and
 * the component count grew by one for every page that had ever been edited.
 *
 * ## 🔴 The record is not the answer to "what is live"
 *
 * This file is a record of **what this machine sent**. HLS-014 AC3 is deliberately not satisfied
 * by it: a client-side property is a fact about the client, and the only honest answer to "is the
 * live app the app I built" comes from fetching the served artefact — which is `cli/live.ts`. The
 * manifest's job is narrower and local: decide what this deploy is (a first one, an update, a
 * recovery), and know which files the previous deploy wrote so they can be swept.
 *
 * ## The two-phase write
 *
 * `state: 'in-progress'` goes in before the engine is spawned and `state: 'complete'` after the
 * folder has been read and graded. A deploy killed in between leaves the first one, which is the
 * only durable evidence that the folder holds half of a site — every other signal (a file count,
 * a timestamp, an exit code nobody caught) is equally consistent with a folder that is finished.
 *
 * Every function here except {@link writeManifest} and {@link readManifest} is pure, for the
 * reason the rest of this phase's decisions are: a spec grades the disposition of an interrupted
 * redeploy in a millisecond, and the drive proves the two agree.
 */
import type * as fsType from 'fs';
import * as path from 'path';

/**
 * The record's filename.
 *
 * A dotfile because it is written into a folder whose whole purpose is to be uploaded, and the
 * common static hosts do not serve dotfiles. It carries no secret — a name, two timestamps and a
 * list of files that are all publicly served anyway — but "harmless if published" and "meant to be
 * published" are different claims and only the first one is being made.
 */
export const MANIFEST_NAME = '.nodegx-deploy.json';

/** What one finished (or unfinished) deploy into a folder recorded about itself. */
export interface DeployManifest {
  /** Bumped when a field changes meaning. An unrecognised version is treated as unreadable. */
  version: 1;
  state: 'in-progress' | 'complete';
  /** The project's own name, not its path — the path is a fact about the machine that deployed. */
  projectName: string;
  startedAt: string;
  finishedAt?: string;
  /**
   * The hashed export the site serves, e.g. `index-b529d7656259c342.js`. It is a content hash of
   * the export, so two deploys with the same `buildId` shipped the same app.
   */
  buildId?: string;
  /** Every path this deploy wrote, out-dir-relative, `/`-separated, sorted. */
  entries?: string[];
}

export type ManifestReading =
  | { kind: 'none' }
  | { kind: 'manifest'; manifest: DeployManifest }
  | { kind: 'unreadable'; reason: string };

export type FsLike = Pick<
  typeof fsType,
  'existsSync' | 'readFileSync' | 'writeFileSync' | 'readdirSync' | 'statSync' | 'rmSync'
>;

/** Read a folder's deploy record, or say why there isn't one. */
export function readManifest(outDir: string, fs: FsLike): ManifestReading {
  const file = path.join(outDir, MANIFEST_NAME);
  if (!fs.existsSync(file)) return { kind: 'none' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8') as string);
  } catch (error) {
    return { kind: 'unreadable', reason: `${MANIFEST_NAME} is not JSON (${(error as Error).message}).` };
  }
  const manifest = parsed as DeployManifest;
  if (!manifest || manifest.version !== 1 || (manifest.state !== 'in-progress' && manifest.state !== 'complete')) {
    return { kind: 'unreadable', reason: `${MANIFEST_NAME} is not a record this version of nodegx wrote.` };
  }
  return { kind: 'manifest', manifest };
}

/** Write one, whole. Small enough that a partial write is not a case worth designing around. */
export function writeManifest(outDir: string, manifest: DeployManifest, fs: FsLike): void {
  fs.writeFileSync(path.join(outDir, MANIFEST_NAME), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

/**
 * What kind of deploy is this?
 *
 * - `fresh` — an empty folder, or one holding nothing but a record of a deploy that wrote nothing.
 * - `update` — this binary deployed here before and finished.
 * - `recover` — this binary deployed here before and **did not finish**. The folder holds part of
 *   a site. Proceeding is the fix, so this does not need `--force`; it needs saying out loud.
 * - `foreign` — the folder holds files and no record. It might be somebody's website.
 *
 * 🔴 A different project's finished deploy is `update`, not `foreign`. The distinction the refusal
 * is protecting is *"is this folder something nodegx made"*, and it is: sweeping the previous
 * deploy's files out of it is right whatever project they came from. The project name is reported
 * so a person who pointed at the wrong folder sees it, because a name in a sentence is a much
 * cheaper warning than a refusal a pipeline has to be taught to pass.
 */
export type Disposition =
  | { kind: 'fresh' }
  | { kind: 'update'; previous: DeployManifest }
  | { kind: 'recover'; previous: DeployManifest }
  | { kind: 'foreign'; existing: number; reason?: string };

export function disposition(existing: number, reading: ManifestReading): Disposition {
  if (reading.kind === 'manifest') {
    return reading.manifest.state === 'complete'
      ? { kind: 'update', previous: reading.manifest }
      : { kind: 'recover', previous: reading.manifest };
  }
  if (reading.kind === 'unreadable') {
    return { kind: 'foreign', existing, reason: reading.reason };
  }
  return existing === 0 ? { kind: 'fresh' } : { kind: 'foreign', existing };
}

/**
 * What the caller should say before writing, and whether it should write at all.
 *
 * `stop` is separate from the words on purpose: `recover` and `update` both produce a sentence and
 * neither stops, and a caller that inferred "there is something to say" from "this is a refusal"
 * would print nothing in the two cases that most need a line in the log.
 */
export function announce(what: Disposition, outDir: string, force: boolean): { stop: boolean; lines: string[] } {
  switch (what.kind) {
    case 'fresh':
      return { stop: false, lines: [] };

    case 'update':
      return {
        stop: false,
        lines: [
          `Updating the deploy already in ${outDir} (${what.previous.projectName}, ` +
            `${(what.previous.entries ?? []).length} files, ${what.previous.finishedAt ?? 'time unknown'}). ` +
            'Files it wrote and this one does not are removed; anything else in the folder is left alone.'
        ]
      };

    case 'recover':
      return {
        stop: false,
        lines: [
          `The last deploy into ${outDir} did not finish (started ${what.previous.startedAt}), so the ` +
            'folder holds part of a site. This deploy rewrites it — that is the recovery, and there is ' +
            'nothing else to do about it.'
        ]
      };

    case 'foreign':
      if (force) {
        return {
          stop: false,
          lines: [
            `${outDir} holds ${what.existing} item(s) and no record of a deploy, and --force was given. ` +
              'Files with the same names are overwritten; nothing else is touched, and nothing is swept — ' +
              'this command has no list of what it may remove from a folder it did not write.'
          ]
        };
      }
      return {
        stop: true,
        lines: [
          `${outDir} already holds ${what.existing} item${what.existing === 1 ? '' : 's'} and no record of a ` +
            'deploy by this command' +
            (what.reason ? ` (${what.reason})` : '') +
            '. The editor asks before overwriting; there is nobody to ask here, so this is a refusal. ' +
            'Pass --force to write into it anyway, or choose an empty folder.'
        ]
      };
  }
}

/**
 * Which of the previous deploy's files should this one remove?
 *
 * 🔴 **Only files the previous deploy recorded writing.** Not "everything in the folder that is
 * not in `current`" — that would delete a `CNAME`, a `robots.txt`, a `.well-known/`, anything the
 * person put there themselves, and a deploy command that quietly empties a web root is a much
 * worse failure than the stale file it was cleaning up.
 */
export function sweepPlan(previous: readonly string[] | undefined, current: readonly string[]): string[] {
  const keep = new Set(current);
  return (previous ?? []).filter((entry) => !keep.has(entry) && entry !== MANIFEST_NAME).sort();
}

/**
 * Did this deploy change what the folder serves?
 *
 * `buildId` alone is not enough: the export can be byte-identical while a copied project asset has
 * changed, been added, or gone. Both halves have to match for "identical" to mean what a person
 * reads it as, which is *nothing about this site moved*.
 */
export function compareDeploys(
  previous: DeployManifest | undefined,
  current: { buildId: string; entries: readonly string[] }
): 'first' | 'identical' | 'changed' {
  if (!previous || previous.state !== 'complete' || !previous.buildId) return 'first';
  const sameEntries =
    (previous.entries ?? []).length === current.entries.length &&
    (previous.entries ?? []).every((entry, index) => entry === current.entries[index]);
  return previous.buildId === current.buildId && sameEntries ? 'identical' : 'changed';
}

/** Every file under `dir`, out-dir-relative and `/`-separated, sorted. The manifest is not one. */
export function listEntries(dir: string, fs: FsLike): string[] {
  const found: string[] = [];
  const walk = (current: string, prefix: string) => {
    for (const name of fs.readdirSync(current)) {
      const full = path.join(current, name);
      const relative = prefix ? `${prefix}/${name}` : name;
      if (fs.statSync(full).isDirectory()) walk(full, relative);
      else if (relative !== MANIFEST_NAME) found.push(relative);
    }
  };
  walk(dir, '');
  return found.sort();
}

/**
 * Remove the paths a sweep decided on, and the directories they empty.
 *
 * Returns what was actually removed rather than what was asked for: a file the person deleted by
 * hand between two deploys is not a failure, and a sweep that threw on one would leave the folder
 * in the state the sweep exists to prevent.
 */
export function sweep(outDir: string, plan: readonly string[], fs: FsLike): string[] {
  const removed: string[] = [];
  for (const entry of plan) {
    const target = path.join(outDir, entry);
    if (!fs.existsSync(target)) continue;
    fs.rmSync(target, { force: true });
    removed.push(entry);
  }
  // Directories the sweep emptied. `noodl_bundles/` is the one that matters and the loop is
  // general because a project that stops shipping a folder of assets is the same shape.
  const directories = new Set(removed.map((entry) => path.dirname(entry)).filter((directory) => directory !== '.'));
  for (const directory of directories) {
    const full = path.join(outDir, directory);
    if (fs.existsSync(full) && fs.readdirSync(full).length === 0) fs.rmSync(full, { recursive: true, force: true });
  }
  return removed;
}
