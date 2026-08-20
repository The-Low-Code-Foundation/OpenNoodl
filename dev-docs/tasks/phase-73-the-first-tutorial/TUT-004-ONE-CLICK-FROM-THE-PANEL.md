# TUT-004 — one click from the panel

**Surface:** editor + platform (`nodegx-community`) · **Tier 4** · **Effort:** S/M · 🔴 **R2 open**

> Richard's ruling, 2026-08-19:
>
> > *"One click install from the community panel should be possible, since we're rebuilding it
> > inside the editor (phase 72). But if someone accesses the tutorial from the community web page,
> > they have to download (it'd be a bigger job to beam it to their editor from their signed in web
> > account I'm guessing)."*

Two surfaces, two answers, and the asymmetry is deliberate. The editor is already a trusted local
process with a Learning folder; the browser is not, and closing that gap needs an account-to-machine
channel that does not exist.

## 🔴 This task builds a CALLER. The install mechanism is already there.

This is the BUILD-THE-CALLER pattern again, and the cheapest instance of it to get wrong:

| | Status |
|---|---|
| `LearningFolderModel.instance.install({ bundleDir, provenance })` | ✅ exists, and is **already called** from [`ProjectsPage.tsx:417`](../../../packages/noodl-editor/src/editor/src/pages/ProjectsPage/ProjectsPage.tsx) |
| `LearningSource = { kind:'local'; path } \| { kind:'platform'; url }` | ✅ the platform arm is **declared** — [`learningfolder.ts:98-100`](../../../packages/noodl-editor/src/editor/src/models/learningfolder.ts) |
| Production code constructing `kind: 'platform'` | 🔴 **none.** Two test files, and nothing else in `packages/**` |
| A fetcher that can re-pull a platform source | 🔴 **none** — which is what `ResetLessonOutcome`'s `'unavailable'` arm currently reports |

So the work is: **fetch the bundle → unpack to a staging dir → call the install that exists → record
`source: { kind:'platform', url }` → make `reset` able to re-pull.** A task that writes a second
install path has misread this table.

⚠️ `learningfolder.ts` is emphatic that **the editor process writes the register — never a sidecar,
never the platform.** The fetch may happen wherever is convenient; the install call may not move.

## The platform half is small

`articles` already carries a nullable `projectUrl`, rendered by `tutorials/[slug]/page.tsx` as
*"Download the starter project →"*. The web experience **does not change** — that link is the ruling,
already implemented. What the editor panel needs is the same URL reachable through NAT-006's read
API so the panel can offer a button instead of a link.

## R2 — the provenance question

[`lessoninstallpolicy.ts`](../../../packages/noodl-editor/src/editor/src/models/lessoninstallpolicy.ts)
grades an install by provenance, and `ProjectsPage` passes `'local'` for a hand-placed bundle and
`'local-ai'` for one an agent wrote. A **platform** bundle is a third profile: it was not written on
this machine, and it was not written by this user's agent.

The F1–F4 scorecard applies differently to each — that is the whole point of the field. R2 is: what
does a community bundle install under, and what does the panel show the user before it lands? A
bundle from the official account and a bundle from an arbitrary member are not obviously the same
answer, and this is the task where that gets decided rather than defaulted.

## Acceptance criteria

1. From the community panel in the editor, a tutorial with an attached bundle installs in one
   action and appears in the Learning section. No browser opens at any point (phase 72 **P1**).
2. The installed entry records `source: { kind: 'platform', url }` — 🔴 asserted, because that arm
   of the type has been declared and unconstructed since UNI-007.
3. **R2's answer is implemented and visible:** the provenance is passed explicitly, and what the
   scorecard checked is shown before the bundle lands — not after.
4. A bundle that the harness **refuses** is refused here too, with the reason, and nothing is
   written to the Learning folder. Driven with a deliberately-broken bundle.
5. `reset` on a platform-sourced lesson **re-pulls** a clean copy. A reset that cannot reach the
   network reports `'unavailable'` and leaves the installed copy standing — 🔴 both arms driven,
   because the failure arm is the one that exists today for the wrong reason.
6. The web page is **unchanged**: `projectUrl` still renders as a download link, and a tutorial
   with no bundle still shows no button (the page's existing "nullable column and no button is the
   honest pair" rule).
7. Offline: the panel says the tutorial cannot be installed right now and why, rather than failing
   silently — phase 72 **P3**, and NAT-013's `D8` caching ruling does not need to be settled for
   this, because a bundle is fetched on demand, not cached ahead.
8. The first official shared tutorial (TUT-003) is published to the local community instance and
   installs from it end-to-end, before anything is pushed live.

## Out of scope, explicitly

- **Beaming a tutorial from a signed-in web session to the user's editor.** Richard's ruling. It
  needs an account-to-machine channel and it is a phase of its own.
- **NAT-011's job.** That renders tutorial *bodies* in the editor. This installs *bundles*. They
  meet at the panel; neither owns the other. 🔴 Grep the behaviour before either task claims the
  other's ground — NAT-011 carries that warning for three phases' worth of reasons.
- Uninstall / disposal of a tutorial's backend. Named in README §1A as the real cost of per-tutorial
  databases and worth doing — but it is the lifecycle's other end and it should be scoped with the
  measurement in hand, not bolted here.
