/**
 * UNI-001 / D2 — the words the editor uses for the NodeGX account, in one place.
 *
 * 🔴 **ONE STRING, ONE OWNER — the FUN-001 shape D2 names in as many words:** *"four surfaces
 * disagreeing about one piece of copy is worse than blank."* There are now two editor surfaces
 * that offer a sign-in (the launcher card, and the composer in `AskAboutNodeDialog`) and a third
 * on the platform, so the literal stops being a literal.
 *
 * ⚠️ **Why this lives in `noodl-core-ui` and not beside the session model.** The launcher chrome
 * is in this package and renders in Storybook, where nothing from `noodl-editor` exists; the
 * dependency arrow only runs one way (`noodl-editor` → `noodl-core-ui`), so the only home both
 * surfaces can reach is this one. `constants/externalLinks.ts` is the precedent, and it is
 * deliberately dependency-free for the same reason.
 *
 * ⚠️ **What does NOT belong here.** The origin (`COMMUNITY_URL`) stays in
 * `models/community/communityorigin.ts`: it is a fact about where we talk to, read only by
 * models, and a constant this package exported would be one Storybook could dial.
 */

/**
 * D2's exact words. 🔴 Not "Sign in", not "Log in to NodeGX Community" — the ruling picked these
 * five and the platform's own header carries the same ones.
 */
export const COMMUNITY_SIGN_IN_LABEL = 'Sign in to NodeGX';

/** The other half. Plain, because a signed-in person looking for it should not have to read. */
export const COMMUNITY_SIGN_OUT_LABEL = 'Sign out';

/**
 * 🔴 The phase's first principle, said out loud on the surface that would otherwise imply the
 * opposite. A sign-in card on the launcher is exactly where a new user concludes that the thing
 * they just downloaded wants an account before it will work — so the card says, in the same
 * breath as the offer, that it does not.
 */
export const COMMUNITY_GATES_NOTHING = 'Everything in the editor works without an account, and always will.';
