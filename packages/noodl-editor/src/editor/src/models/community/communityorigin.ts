/**
 * Where the community platform lives. 🔴 ONE string, ONE owner — the FUN-001 shape D2 names.
 *
 * ⚠️ It used to live in `AskAboutNodeDialog.tsx`, which was fine while a dialog was the only
 * thing that talked to the platform. UNI-001 E1 added a second and a third caller (the device
 * sign-in, and sign-out), and a constant exported from a view is one a model cannot import
 * without pointing the dependency arrow the wrong way. The dialog re-exports it so no caller
 * had to move.
 *
 * ⚠️ **`.io`, not `.dev`**: the whole phase said `.dev` until 2026-08-17 and nobody checked it
 * against the registrar. It **resolves** (A → nexus-1, `49.12.102.195`); what serves it is E2,
 * which is still owned by no task.
 *
 * @module models/community/communityorigin
 */
export const COMMUNITY_URL = 'https://community.nodegx.io';
