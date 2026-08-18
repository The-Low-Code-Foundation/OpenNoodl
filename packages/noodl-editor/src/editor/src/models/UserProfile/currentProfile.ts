/**
 * FIX-021 slice B — the synchronous seam between the user's profile on disk and
 * the authoring loop.
 *
 * A carbon copy of `ProjectDocs/currentDocs`, and deliberately so: the reason is
 * identical. `AuthoringSession` is constructed synchronously and must run in the
 * headless measurement bundle, where there is no Electron, no `platform` and no
 * `filesystem`. Reading a file is neither synchronous nor available there. So
 * the loop asks *this* module — a settable provider holding a snapshot — and the
 * editor installs a provider at boot (`installUserProfile`).
 *
 * With no provider installed the loop sees a user who has written nothing, which
 * is the correct answer for the harness and is byte-for-byte the pre-FIX-021
 * turn.
 *
 * @module UserProfile/currentProfile
 */

export type UserProfileProvider = () => string;

let provider: UserProfileProvider | null = null;

/** Install (or, with `null`, remove) the provider. Last call wins. */
export function setUserProfileProvider(next: UserProfileProvider | null): void {
  provider = next;
}

/**
 * The raw text of `<userData>/PREFERENCES.md`, or `''` when nothing is installed
 * and when the user has no such file. Never throws — a profile that cannot be
 * read must not be able to stop someone authoring a component.
 */
export function currentUserProfile(): string {
  if (!provider) return '';
  try {
    return provider() ?? '';
  } catch (error) {
    console.warn('[user-profile] provider failed; authoring without the user profile', error);
    return '';
  }
}
