/**
 * FIX-021 slice B — the global user profile.
 *
 * One markdown file per person, per machine: `<userData>/PREFERENCES.md`. It is
 * about *the builder*, not about any project, which is why it lives outside every
 * project directory and outside git — FIX-021's Q4, ruled "per-user and
 * gitignored" rather than a committed `docs/` file, because *"I prefer Visual
 * Functions"* is about me and my colleagues did not agree to it.
 *
 * NOTE for headless consumers: import `./profileText` or `./currentProfile`
 * directly rather than this barrel — the barrel pulls `@noodl/platform`, which
 * the authoring measurement bundle cannot have. Same rule as the `ProjectDocs`
 * and `StyleVocabulary` submodules.
 *
 * @module UserProfile
 */

export { PROFILE_CAP, PROFILE_FILE, PROFILE_TEMPLATE, profileSections, renderProfileForPrompt } from './profileText';
export type { ProfileSection } from './profileText';

export { currentUserProfile, setUserProfileProvider } from './currentProfile';
export type { UserProfileProvider } from './currentProfile';

export {
  ensureUserProfileSeeded,
  installUserProfile,
  refreshUserProfile,
  uninstallUserProfile,
  userProfilePath,
  userProfileSnapshot
} from './install';
