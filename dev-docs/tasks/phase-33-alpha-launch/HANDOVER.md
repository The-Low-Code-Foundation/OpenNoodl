# Phase 33 — handover prompt

Written **2026-08-07**, end of a third same-day session that closed ALPHA-007
criterion 4 live (a real hostile-fixture project driven through the real composer —
see `PROGRESS.md`'s third 2026-08-07 log entry and `ALPHA-007-NOTES.md` item G).
Measured at `b83a464c`. Supersedes the same-day `7d640495` handover in full.

**The honest state of the phase, stated plainly so it doesn't get re-discovered
every session: there is now almost no pure engineering left that isn't blocked on
Richard.** The exit criterion itself — "demonstrated by someone who is not Richard
and did not build it" — cannot be satisfied by an agent at all, no matter how much
more driving happens. Getting phase 33 **done and live** from here is mostly a
sequence of Richard actions with an agent picking up the engineering that unlocks
after each one, not a bigger engineering push.

**The next session's job, in priority order:**

1. **Surface the human-gated queue to Richard explicitly, don't just document it
   again.** Five items are outstanding and none of them wait on more code — see
   "What only Richard can do" below. If he's present, ask for them directly,
   starting with B6 (2 minutes) and the B5/B2 GitHub admin toggles (2 minutes each).
2. **Fix D4 now** (`NDA-014` criterion 1 — a Function `object` output wired to a Text
   node renders `[object Object]`) — it's unblocked, untouched, and a first-ten-minutes
   defect ALPHA-001 will otherwise rediscover for free.
3. **The moment any human item lands, do the engineering it unlocks — same
   session, don't wait for a new one:**
   - B5 done → strip `opennoodl-docs`'s old doc content, repoint
     `getDocsEndpoint()`/`nodeDocsPath()` (mind the URL-shape mismatch noted below).
   - B2 done → one live pass of the GitHub device flow against the real API
     (Connect from the version-control panel, confirm the code + completion +
     the distinct Cancel-vs-timeout message).
   - A1's `CSC_LINK`/`APPLE_ID`/`APPLE_APP_SPECIFIC_PASSWORD`/`APPLE_TEAM_ID` land as
     GitHub secrets → this is the actual release-readiness moment. Trigger
     `.github/workflows/release.yml`, confirm a **signed and notarised** macOS
     artifact comes out, and check it actually opens past Gatekeeper on a machine
     that isn't this one if at all possible.
4. **Once a real installable build exists, that's when A3 (testers) stops being
   "recruit someone" and starts being "hand them a URL and a checklist."** ALPHA-001,
   ALPHA-002 criterion 3, and ALPHA-007 criterion 1 all resolve in one coordinated
   pass with the same one-per-platform testers — bundle the ask.

Paste the block below into a fresh session.

---

Continue phase 33 alpha-launch work against `dev-docs/tasks/phase-33-alpha-launch`,
with the actual goal of reaching the phase's exit criterion — a stranger on each
platform can download, reach a working app, and report a problem, **demonstrated by
someone who is not Richard and did not build it.** Work on `cline-dev`, commit
straight to it, no branches, no PRs.

Read these first, in this order:

1. `dev-docs/tasks/phase-33-alpha-launch/PROGRESS.md` — task status and the full
   findings register. Its head carries a standing warning, still true: **re-measure
   a row before acting on it.** The three 2026-08-07 log entries at the bottom (the
   stale-URL fix + ALPHA-007's first live drive + F104, then criterion 4 closed
   live) are the most recent state.
2. `dev-docs/tasks/phase-33-alpha-launch/HUMAN-GATED-ITEMS.md` — read in full, it is
   short. B6, B5, B2, A1/A2/A3, B1, C1 are the complete remaining list; the summary
   below trims detail that matters, especially A1's exact secret names.
3. `dev-docs/tasks/phase-33-alpha-launch/ALPHA-007-NOTES.md` — item G (added this
   session) has the criterion-4 account, including a process trap worth reading
   before touching `shell.openExternal` again (see below).

## What this session did

**ALPHA-007 criterion 4, demonstrated live, not argued.** The prior two sessions
both deferred it to the existing 87-test unit suite, which is exactly the "argued
rather than demonstrated" shape the criterion rules out. This session built a real,
openable hostile-fixture project (`~/vscode_projects/NodeGX test projects/alpha007-hostile-fixture`,
not committed) carrying an API key in a node parameter, a fake backend endpoint, a
component named after a client, an unregistered private-module node type, and paths
outside the project root — opened it for real (patched `dialog.showOpenDialog` on
the main-process inspector to skip the unscriptable native picker, then clicked the
launcher's real "Open project…" button), injected matching hostile console errors so
the live error-tail ring buffer held them, drove `Help → Report a problem…` through
the real native menu, and clicked "Open GitHub with this filled in" for real —
capturing the actual composed URL off the OS clipboard and closing the tab
unsubmitted rather than filing anything. Decoded and grepped the real URL, the
on-disk `report.md`, and `diagnostics.json` for all twelve hostile strings, raw and
decoded. **None survived.** Full account in `PROGRESS.md` and `ALPHA-007-NOTES.md`
item G; a corrected driving recipe is now in memory
(`editor-cdp-driving-traps.md`).

**One process trap worth carrying forward**: `shell.openExternal` must be patched in
the **renderer** (`npm run cdp -- eval "require('electron').shell.openExternal = ..."`),
not the main-process inspector — `platform-electron.ts` imports `shell` directly into
renderer code, a different binding than `process.mainModule.require('electron').shell`.
Patching the main-process one silently no-ops and a real browser tab opens anyway.
This session recovered via the OS clipboard (`Cmd+L`/`Cmd+C` via `osascript`), but
patch the right process next time and avoid the side effect altogether.

Full gate sweep not re-run this session (only two doc files changed, no code) — the
`7d640495` baselines below still hold; re-run them before trusting anything if more
than a few hours have passed.

## What only Richard can do — nothing here waits on more code

In lead-time order. **All five of the first group are minutes of his time, not
days** — worth asking for directly rather than filing away again:

1. **B6 — verify the GitHub prefill by hand (2 min).** `node
   scripts/alpha-007/prefill-probe.js`, open the URL in a signed-in browser, check
   the four dropdowns land filled, close without submitting. The only remaining gap
   on ALPHA-007 criterion 3.
2. **B5 — two GitHub admin actions, in order (2 min):** rename `opennoodl-docs` →
   e.g. `nodegx-content`, then enable GitHub Pages on `NodeGX` for `docs-site/`.
   Decided already; just needs doing. Unlocks the docs repo strip (item 3 above).
3. **B2 — revoke the leaked OAuth secret and enable Device Flow (2 min).** Still a
   live security exposure — `c45276fa80b0618de06e5e2b09c1019ca150baef` stays valid
   until regenerated. Same OAuth app settings page for both actions.
4. **A1 — export the signing cert and generate one app-specific password (~15 min
   total, mostly already done).** The Developer ID cert already exists in Richard's
   keychain (`Y35J975HXR`). What's left: Keychain Access export → `.p12` → base64 →
   `CSC_LINK`/`CSC_KEY_PASSWORD` GitHub secrets, plus `APPLE_ID` and one
   app-specific password (`APPLE_APP_SPECIFIC_PASSWORD`, ~1 min at
   appleid.apple.com). This is the one that actually turns "no macOS artifact" into
   a real signed release.
5. **A2 — a decision, not an action:** buy Windows signing for the alpha, or ship
   unsigned behind the install guide like the unsigned-macOS fallback. Windows
   already has a working artifact either way.
6. **A3 — recruit one tester per platform who has never built this.** The actual
   long pole and the phase's literal exit criterion. Can start **now**, in parallel
   with everything else — doesn't wait on A1/A2. Once recruited, the same testers
   can also close ALPHA-004 criteria 1 and 4 (a stranger builds the getting-started
   app from the docs; the doc vocabulary matches what they actually see) — bundle
   the ask rather than recruiting twice.
7. **B1 — publishing entity, contact address, governing law** for `PRIVACY.md`/
   `TERMS.md`. Coupled to A1's Apple enrolment (same entity).
8. **C1 — an outside reader for `PRIVACY.md`/`TERMS.md`**, half an hour, answering
   "if I never touch AI features, does anything leave my machine?" from the
   documents alone.

## The one piece of engineering that's genuinely unblocked right now

**D4** (`dev-docs/tasks/phase-33-alpha-launch/HUMAN-GATED-ITEMS.md` Tier D): a
Function node's `object` output wired to a Text node renders `[object Object]`
instead of something readable. Recorded as "fix before ALPHA-001" because it's a
first-ten-minutes-visible defect on a contract otherwise believed closed, and a real
tester will hit it for free the moment A3 lands. Nothing else on the board is both
unblocked and worth doing preemptively — everything else either waits on a human
action above or only becomes real once one of them lands (see the numbered sequence
in the cover note).

## Gate baselines — last full sweep at `7d640495` (2026-08-07, earlier the same day)

```
npm run typecheck:runtime|cloud|viewer|editor|editor-tests   # clean
npm run catalog:check                       # 175 nodes, up to date
npm run cloud-library:check                 # 84 nodes, up to date
npm run catalog:merge:check -- --require-coverage   # 175/175 documented, up to date
npx jest (from packages/noodl-editor)       # 933/933, 67 suites
npm run lint:ci                             # 860 errors vs 3916 baseline — unchanged
npm run test:ci                             # Jasmine: 2418 specs, 0 failures — unchanged
```

Not re-run since: `docs:nodes:check`, `docs-site:build`, `typecheck:core-ui` (still
not a gate). Re-run the full sweep before trusting it, especially after touching D4.

## Driving traps — everything from `run-editor` plus two from this phase's live passes

- **`shell.openExternal` is a renderer-side patch, not a main-process one** — see
  above. This is new; the memory (`editor-cdp-driving-traps.md`) has the corrected
  recipe.
- **The main-process inspector needs `process.mainModule.require`, not bare
  `require`.** `npm run dev:debug -- --inspect-main`, connect on `:9229`.
  `Menu.getApplicationMenu().items.find(...).submenu.items.find(...).click()`
  reaches any native menu item without displaying the menu itself.
- `BaseDialog` renders every dialog **twice** (a hidden zero-height measuring copy)
  — scope selectors to `[class*=VisibleDialog] > [class*=ChildContainer]` or filter
  by `getBoundingClientRect().width > 0`, per `editor-cdp-driving-traps.md`.
- Opening a project without the native file dialog: patch
  `dialog.showOpenDialog` on the main-process inspector to return a path directly,
  then click the launcher's own `[data-test=launcher-open-project]` button — the
  real `openDialog → openProjectFromFolder → router.route` path runs unmodified.
- Everything else already in the `run-editor` skill and prior handovers still
  holds — native menus invisible to `npm run cdp`, verify which project opened by
  name, occluded-Electron timer clamp, don't trust HMR for a mounted panel.
- **A live session can trigger a real, non-undoable external side effect** — still
  true. Patch the send/open call before clicking anything shaped like Send/Submit,
  and patch it on the process that actually makes the call.

## Rules of engagement

- **`git commit -m "…" -- <explicit paths>`. Never `git add -A`, never stash, never
  `git checkout`/`git restore` a file you did not write.**
- **Commit incrementally, per slice.** An agent that has not committed has produced
  nothing.
- **Only one agent may own the Electron editor** — it is a queue, and a sibling
  `dev:stop` kills another session's `test:ci`. **Always `npm run dev:stop` when
  done.**
- ⚠️ **Before building anything a handover recommends: `git branch -a` and grep the
  log for the task ID.** This repo has shipped the "rebuild something that already
  existed" mistake twice.
- **Re-run the gates yourself on the settled tree at the end.**
- Task docs are researched but not infallible — re-measure, don't inherit. Verify a
  claim against the live system before repeating it in a new handover.
