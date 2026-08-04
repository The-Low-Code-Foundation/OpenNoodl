# Phase 33 — handover prompt

Written 2026-08-04 at the end of the ALPHA-002 session (`45d540b6`).
Paste the block below into a fresh session.

---

Continue `dev-docs/tasks/phase-33-alpha-launch` (Track R — getting an alpha into strangers' hands).
Read `PROGRESS.md` and `HUMAN-GATED-ITEMS.md` first; both are current as of commit `45d540b6` on
`cline-dev`.

## Where it stands

**ALPHA-005 complete. ALPHA-002's engineering complete. ALPHA-006 and ALPHA-007 are built but
UNMERGED. ALPHA-001, -003, -004 not started.**

The phase is no longer blocked on engineering. It is blocked on **two jobs of Richard's that take
about two minutes each**, and everything downstream waits on them. Ask for both in your first
message — do not start work and ask later.

## Ask Richard these two things first

### 1. The repo rename has not happened

He chose "rename to NodeGX" on 2026-08-04. `The-Low-Code-Foundation/NodeGX` **does not exist**
(checked with `gh repo view`). The publish target in `packages/noodl-editor/package.json` was
therefore deliberately left as `The-Low-Code-Foundation/OpenNoodl` — pointing `publish` at a
repository that does not exist breaks releases outright.

Once he renames it on GitHub, it is a one-field change. **The feed URL is baked into every binary and
alpha testers will not re-download for months, so this must be settled before the first tag anyone
installs.** If he would rather not rename, that is a fine answer — record it and move on.

### 2. The five signing secrets — and the thing that is not obvious

**The Developer ID certificate already exists on his machine.** This was found by building with
signing enabled and letting electron-builder search the keychain:

```
$ security find-identity -v -p codesigning
  1) EADD3AB8… "Developer ID Application: Osborne Solutions (Y35J975HXR)"
```

`HUMAN-GATED-ITEMS.md` A1 used to budget "~£79/yr, D-U-N-S, days-to-weeks enrolment" for this. There
is nothing to enrol in — a Developer ID Application cert is only issued to a paid membership.
`APPLE_TEAM_ID` is **`Y35J975HXR`**. A1 has been rewritten with the six export steps.

**But do not conclude that signing solves it.** A build signed with that certificate verifies
perfectly — `valid on disk`, `satisfies its Designated Requirement`, hardened runtime, chain to Apple
Root CA, secure timestamp — and Gatekeeper *still* refuses to run it:

```
$ spctl -a -vvv -t exec NodeGX.app
  rejected
  source=Unnotarized Developer ID
```

**Notarisation is the gate, not signing.** The only genuinely missing credentials are `APPLE_ID` and
an `APPLE_APP_SPECIFIC_PASSWORD` (appleid.apple.com → Sign-In and Security → App-Specific Passwords,
about a minute). Richard's stated preference was "as signed as possible without long signups" — this
*is* that, and it still needs those two, or every macOS install is a support conversation.

Whenever you check signing, run `spctl`, not just `codesign`. `codesign` answers "is this signed",
which is not the question a user's Mac asks.

## Do these, in this order

1. **Merge `wt-alpha-006` and `wt-alpha-007`.** Both are built, committed and green in their own
   worktrees, 4 commits each, and **neither is merged into `cline-dev`**. `git merge-tree` reports
   **zero conflicts** against `45d540b6`, and a trial merge of the two together already exists on
   `wt-trial-alpha`. Read `ALPHA-006-NOTES.md` and `ALPHA-007-NOTES.md` on those branches before
   merging — each records deviations from its spec and what still needs the live editor.

   ALPHA-006 §1 closes all 54 undocumented nodes (F70) off the bundled catalog; §6 stops the Help
   Center shipping Noodl's links (F69). ALPHA-007 ships Help → Report a problem with a redactor.

2. **Then cut the release.** ALPHA-002 §1 and §2 are done and verified; §3–§5 are what remains.
   The workflow supports `workflow_dispatch` for a dry run, and Richard approved one — **but sequence
   it after the secrets land**, or the run burns on an artifact Gatekeeper rejects. Criteria 3 and 5
   need a human on a machine that has never built this project.

3. **ALPHA-001 — the cold-install first hour.** The phase's Tier-1 pass, and it discharges seven
   tasks' owed live-QA at once. Part A needs a clean working tree; Part B needs the build from step 2.
   Note the tree is *not* clean right now — see the concurrency warning below.

4. **ALPHA-003** (surface the existing log, `crashReporter`, the no-provider state) — unblocked,
   ALPHA-005 is done. Remember A4 in the register was **corrected**: packaged builds *do* write
   `<userData>/debug/log-<date>.txt`. The job is surfacing and scoping a log that already exists, not
   adding one.

5. **ALPHA-004** — blocked on ALPHA-006 landing.

## Two things that are release-blocking and not in the task list

- **F63 — a hardcoded GitHub OAuth client secret ships in every binary**
  (`src/main/github-oauth-handler.js:19`), in a public repo. `HUMAN-GATED-ITEMS.md` B2 calls this the
  one finding to treat as release-blocking. The code change (PKCE or device flow) is an agent's job;
  registering the app is not. **Raise it before a build reaches a stranger, not after.**
- **B4 — the `needs-triage` label still does not exist**, so every issue filed since 2026-07-30 is
  unlabelled and the queue the forms promise is empty by construction (F72). ALPHA-007 prepared
  `scripts/alpha-007/create-labels.sh` and deliberately did not run it. Thirty seconds behind one
  "yes".

## Traps

- **This is a shared checkout with concurrent sessions.** Several were live during the ALPHA-002
  session and one edited `autoupdater.js` underneath it mid-edit. **Never `git stash`, never
  `git add -A`, never `git add <directory>` — only explicit file pathspecs.** The working tree
  carries other sessions' uncommitted work (VersionControlPanel/snapshotProject, `tests-unit/erg-005`,
  phase-17 and phase-37 docs). Leave all of it alone. A clean `git status` proves nothing; check
  `git worktree list` and `ps aux | grep claude` before assuming you are alone.
- **electron-builder uploads as it goes, so a published artifact is not evidence of a green job.**
  This is why v0.1.0's Linux leg was misfiled for a week as "succeeded, no update feed" when it had
  actually failed on the `.deb` after the AppImage had already uploaded (F73).
- **`latest-linux.yml` is absent on purpose.** `autoupdater.js` returns early on Linux, so the feed
  would never be read. `RELEASE-PROCESS.md` now says so. Do not "fix" it.
- **Empty-string secrets are not absent secrets.** CI passes every signing secret unconditionally, so
  an unset one arrives as `''`, and electron-builder reads an empty `CSC_LINK` as a *path* —
  `resolve(cwd, '')` — which is what produced v0.1.0's baffling `⨯ .../noodl-editor not a file`.
  `scripts/build.ts:70-87` strips them; do not undo that.
- **A local mac build takes ~15 minutes and signing alone is several of them.** Run it in the
  background. Passing `CSC_IDENTITY_AUTO_DISCOVERY=false` reproduces CI (no keychain identity);
  omitting it reproduces a developer machine and will sign with Richard's real certificate.
- **`packages/noodl-editor/package.json` is no longer committed minified.** Earlier memory and notes
  say it is; that is stale as of this session. Normal edits are fine.
- **`autoupdater.js` reads `process.platform` inside `setupAutoUpdate`, not at require time.** A test
  that overrides it around the `require()` and restores in a `finally` tests nothing. The 9 tests in
  `tests-main/autoupdater.test.js` get this right — copy the pattern.

## Gates

`npx jest tests-main/` — **89/89 across 10 suites** at `45d540b6`. Do not run bare `npx jest`: it
also picks up `tests-unit/`, where another session's `erg-005` work has been red WIP.

`npx eslint packages/noodl-editor/src` — `autoupdater.js` carries 5 errors that are all pre-existing
(two `require` statements, three unused `event` params). Check a baseline against `HEAD` before
attributing any lint failure to your own change.
