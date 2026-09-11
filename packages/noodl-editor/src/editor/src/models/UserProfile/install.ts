/**
 * FIX-021 slice B — boot wiring for the user profile, and the only part of this
 * feature that touches a disk.
 *
 * Installed from `router.setup.ts` beside `installProjectDocs()`, for the same
 * reason that one is: the authoring loop reads the profile at session
 * construction, long before anyone opens a panel, so a mount-time subscription
 * would mean the first build of a session never sees it.
 *
 * ## Why a poll, and why it is cheap
 *
 * *The document is the UI.* That promise only holds if editing `PREFERENCES.md`
 * in VS Code changes what the next build is told, without restarting NodeGX — so
 * this re-reads on a timer, exactly as `ProjectDocsModel` does, and for the
 * reason stated there: `IFileSystem` exposes no watcher and no mtime, so a
 * content-comparing poll is the exact instrument where a size heuristic is not.
 *
 * The cost is one `exists()` every two seconds, and a read of at most a couple
 * of kilobytes when the file is there at all. A user who has never opened the
 * settings section pays the `exists()` and nothing else.
 *
 * ## Nothing here ever rewrites the file
 *
 * `ensureUserProfileSeeded` writes only when there is no file, which keeps the
 * rule `CLAUDE.md` established and slice 0 leaned on — *the user's to own*. The
 * profile has no accept/reject flow, no distillation and no writer but the
 * person; FIX-021's Q1 was ruled "seeded and human-authored to begin with", and
 * this module is the whole of that ruling.
 *
 * @module UserProfile/install
 */

import { filesystem, platform } from '@noodl/platform';

import { writeTextAtomic } from '../ProjectFiles/projectFileIo';
import { setUserProfileProvider } from './currentProfile';
import { PROFILE_FILE, PROFILE_TEMPLATE } from './profileText';

/** How often the file is re-read once the provider is installed. */
const POLL_INTERVAL_MS = 2_000;

let snapshot = '';
let installed = false;
let timer: ReturnType<typeof setInterval> | undefined;

/** Absolute path of the profile. Resolved at ask-time, never cached. */
export function userProfilePath(): string {
  return filesystem.join(platform.getUserDataPath(), PROFILE_FILE);
}

/** The last text read from disk. `''` until the first refresh completes. */
export function userProfileSnapshot(): string {
  return snapshot;
}

/**
 * Re-read the profile into the synchronous snapshot.
 *
 * A file that is *gone* blanks the snapshot — deleting it is a real way to turn
 * the feature off. A read that *throws* keeps the previous value instead: a
 * transient failure is not the user saying anything, and forgetting their
 * preferences because one read failed is worse than being one poll stale.
 */
export async function refreshUserProfile(): Promise<void> {
  const path = userProfilePath();
  if (!filesystem.exists(path)) {
    snapshot = '';
    return;
  }
  try {
    snapshot = await filesystem.readFile(path);
  } catch (error) {
    console.warn('[user-profile] could not read', path, error);
  }
}

/**
 * Create the profile from its template if it does not exist, and report which
 * of those two happened. An existing file is never touched, whatever is in it.
 */
export async function ensureUserProfileSeeded(): Promise<{ path: string; created: boolean }> {
  const path = userProfilePath();
  if (filesystem.exists(path)) return { path, created: false };
  await writeTextAtomic(path, PROFILE_TEMPLATE);
  await refreshUserProfile();
  return { path, created: true };
}

/** Install the profile provider and keep it fresh. Idempotent. */
export function installUserProfile(): void {
  if (installed) return;
  installed = true;

  setUserProfileProvider(() => snapshot);

  void refreshUserProfile();
  timer = setInterval(() => void refreshUserProfile(), POLL_INTERVAL_MS);
}

/** Stop polling. Only the tests and HMR have a reason to call this. */
export function uninstallUserProfile(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
  installed = false;
  setUserProfileProvider(null);
}
