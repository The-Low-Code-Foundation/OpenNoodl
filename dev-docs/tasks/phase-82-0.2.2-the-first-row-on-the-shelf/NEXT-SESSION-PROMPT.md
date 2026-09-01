# Phase 82 — next session

_Opened 2026-08-31 (s1). Last updated **2026-09-01, session 11**, which did the one thing on this
board that was not waiting on Richard: **the 0.2.2 version bump** (row 8 §2), verified through the
production build gate and committed as `5c805978`. **Both remaining rows now wait on Richard and
nothing else.** The decisions are [`RICHARD-RULINGS-2026-09-01.md`](RICHARD-RULINGS-2026-09-01.md);
the runbook is [`../release-0.2.2/PUBLISH-0.2.2.md`](../release-0.2.2/PUBLISH-0.2.2.md)._

## 🔴 Read this first: this is the only board you open

Richard, 2026-08-31: *"can we work through the next session prompt in phase 82, rather than me
ending up driving unnecessary tasks in other phases by accident — just so we focus on the tasks we
need to launch, over several sessions all in phase 82."*

**So: every launch session opens THIS file, takes the next unstruck row from the run sheet below,
and finishes inside phase 82.** The look work that used to live in phase 81 (VIB-005, VIB-008) has
been **carried here** as REL-002a/b/c, with its verdict scale and close protocol **restated in
[`TASKS.md`](TASKS.md)** — you do not need to open phase 81 to build or close it.

🔴 **If a row is not on this board, it does not gate 0.2.2.** Do not open P75, P77, P78 or P81
boards "to check". Anything else you find is a **register row with an owner**, not this session's
job — see [`../../guidelines/PHASE-EXECUTION.md`](../../guidelines/PHASE-EXECUTION.md).

Then read [`README.md`](README.md) §1 and re-derive the board from `TASKS.md` and the artefacts.

## The run sheet — the whole path to launch

Take the topmost row that is not ✅. Strike it here when it closes.

| # | row | why here | needs |
|---|---|---|---|
| ~~1~~ | ~~**REL-007** price line + **REL-006** hold/doc fixes~~ | ✅ **BOTH CLOSED, s1** | — |
| ~~2~~ | ~~**REL-005** triage P75's four open rows~~ | ✅ **CLOSED, s2** — nine dispositions written into P75's board | — |
| ~~3~~ | ~~**REL-003** rebuild the stale bundles~~ | ✅ **CLOSED, s3** — DEF-023 and DEF-026 observed through bundles with control pairs | — |
| ~~4~~ | ~~**REL-002a** the ambush defaults~~ | ✅ **CLOSED, s4** — the defect was `settings.bodyScroll`; 0/7 → 7/7 reachable controls | — |
| ~~5~~ | ~~**REL-002b** fail closed + designed first run~~ | ✅ **CLOSED, s5** — `Denied` + `isSignedIn` + `waitingCard`; **37/37** on a real enforcing backend | — |
| ~~6~~ | ~~**REL-002c** the members' area, redeemed~~ | ✅ **CLOSED s10 BY INSTRUCTION** — ruled **FINE, not WORTHY**, and shipped anyway: *"we can't waste more time on this."* 🔴 The AC was **overridden, not met**; items 5 and 6 **declined on cost** | — |
| 7 | **REL-001** publish + drive the install | shelf's first row; also closes P75's FB-005 | 🟢 **PREPARED; re-verified s11** — [`REL-001-SUBMISSION.md`](REL-001-SUBMISSION.md). 🔴 **Richard runs it** — needs the community `DATABASE_URL` |
| 8 | **REL-004** cut, tag and publish `v0.2.2` | last | 🟡 **§2 now DONE** (`5c805978`). 🔴 **BLOCKED: `cline-dev` is `0 573` unpushed** — [runbook](../release-0.2.2/PUBLISH-0.2.2.md) |

## 🔴 The state of play: nothing on this board is a session's to do

**Both open rows are credential-and-permission acts that belong to Richard.** Session 11 checked
that this is genuinely true rather than inherited, and it is:

- **Row 7** needs the community `DATABASE_URL`. Everything around it is done.
- **Row 8** needs 573 commits pushed to a shared remote. The release workflow triggers on a tag
  push, so a tag on an unpushed branch points at commits GitHub has never seen.

✅ **Session 11 therefore took the one piece of row 8 that was NOT blocked — §2, the version
bump — and closed it.** A future session opening this board should expect to find no unblocked
engineering work and should say so plainly rather than manufacturing some.

## Row 7 — the publish. **Richard runs it.**

```bash
cd /Users/richardosborne/vscode_projects/nodegx-community
DATABASE_URL=<the community DB url> \
  npx tsx scripts/publish-project-template.ts \
    members-area \
    /Users/richardosborne/vscode_projects/OpenNoodl/templates/members-area \
    starter \
    "members only site for a club, charity or church" \
    --title "Members' area" \
    --publish
```

✅ **Re-verified at session 11, at commit `5c805978`** — independently, not by reading s10's note:

- **The artefact is clean to publish.** Top level is exactly `components/`, `docs/`,
  `nodegx.project.json`, `nodegx.security.json`. **94 files.** No `.mcp.json`, no `CLAUDE.md`, no
  `.gitignore`, no `.env` anywhere beneath it.
- **The working tree matches the commit** — `git status --porcelain -- templates/members-area` is
  empty, so what would be published is what was reviewed.
- **The script's interface was re-read from source**, not relayed:
  `<slug> <projectDir> <category> "<summary>" [--publish] [--unpublish] [--title "…"]`.
- ⚠️ **`--publish` is opt-in.** Without it the row is written as a **draft** — the right first run
  if you want to look at the row before it is visible.

🔴 **`readBundleDirectory` HAS NO SKIP LIST OF ANY KIND.** It walks every file and directory
unconditionally. **So `templates/members-area` must NOT be opened in the editor before publishing**:
opening writes `.mcp.json` carrying absolute paths from the publishing machine, plus `CLAUDE.md` and
a `.gitignore` block, and all three would ship. It would also break AC7, which requires the artefact
to be byte-identical to a fresh generate.

Full derivation, the four ruled fields and AC8's excluded-files check are in
[`REL-001-SUBMISSION.md`](REL-001-SUBMISSION.md).

## Row 8 — the cut. §2 is done; the push is not.

✅ **`packages/noodl-editor/package.json` now reads `0.2.2`** (`5c805978`), gated on
`npm run ci:build:editor` **exit 0** after the change. That was the last thing in the runbook a
session could do alone.

🔴 **Still blocked:** `git rev-list --left-right --count origin/cline-dev...cline-dev` read
**`0 573`** at s11 and grows every session. `origin/cline-dev` is at **2026-08-21**; **CI has run on
none of this**. Derive the count again at cut time rather than quoting this file.

✅ **Tag at `5c805978` or later.** Anything earlier carries `0.2.0` in `artifactName`.

## 🔴 What to carry out of session 11

1. 🔴 **A "the only literal in the repo" CLAIM IS A GREP RESULT, AND THE GREP DISAGREED.** The
   runbook said `packages/noodl-editor/package.json` held the only `0.2.x` version literal. Nine
   `library/prefabs/*/library.json` files also read `0.2.0`. They are correctly left alone — but
   only because sibling prefabs read `1.4.0`, `0.5.0`, `2.0.0`, which is what proves it is an
   independent per-prefab version space. ✅ **The disproof of a false hit is a MEASUREMENT (the
   siblings' spread), not the confidence of the sentence that omitted it.**
2. 🔴🔴 **A GATE THAT LOOKS DECISIVE CAN BE SETTLED BY THE LAST RELEASE.** `package-lock.json`
   carries its own editor version, and CI installs with **`npm ci`**
   ([`.github/actions/setup/action.yml:45`](../../../.github/actions/setup/action.yml#L45)) — the
   command that fails on an out-of-sync lock. It reads as a hard blocker. It is not:
   `git show v0.2.0:package-lock.json` reads **`0.1.7`** while
   `git show v0.2.0:packages/noodl-editor/package.json` reads **`0.2.0`**, and **that tag produced a
   real signed release.** ✅ **Before treating a mismatch as a gate, ask whether the last successful
   run already had it.** The shipped artefact is the strongest control available.
3. ⚠️ **AND THE CHEAP DIRECT TEST AGREED.** `npm ci --dry-run --ignore-scripts` against the bumped
   file exits 0. ✅ **Two independent instruments, because the historical one alone could have been
   explained by a cache.**
4. 🔴 **`timeout` DOES NOT EXIST ON THIS MAC, AND ITS ABSENCE READ AS A PASS.**
   `timeout 300 npm ci … 2>&1 | tail -20; echo "EXIT=$?"` printed **`command not found`** and then
   **`EXIT=0`** — the exit of `echo` at the end of a pipe, not of npm. This is the pipe trap in my
   memory firing on a *missing binary*. ✅ **`gtimeout` if you need it; and gate on an exit file the
   command writes itself.**
5. 🔴 **THE WRAPPER'S "exit code 0" — the third session in a row.** The background notification for
   the build said *completed (exit code 0)*; I believed my own `build.exit` file instead, which
   happened to agree this time. ✅ **Agreement is not evidence the wrapper is trustworthy.**
6. ⚠️ **SEVEN "Electron" PROCESSES WERE ALL `noodl-mcp.cjs`.** `ps` showed nine Electron-looking
   rows and not one was an editor. ✅ **`ps -o command=` before attributing a process** — exactly the
   trap already in memory, seen again at a larger count.
7. ✅ **THE PRODUCTION BUILD IS THE ONLY GATE THAT READS THIS FILE'S NEIGHBOURHOOD.**
   `getExcludedNodeModules()` is reached only when `production` is true, so `test:ci`, `typecheck`,
   `lint` and `test:main` would all have stayed green over a broken bump. The first `v0.2.0` build
   failed on all four platforms with every local gate passing, for exactly this reason.
8. ⚠️ **A RECORDED HASH WITHOUT ITS INSTRUMENT CANNOT BE RE-READ.** `TASKS.md` records the artefact
   as `8af2aeec` "hashed before and after a second run", but names no command. Session 11 could
   confirm **94 files, four top-level entries, no hazard files and no drift from the commit** — all
   of which is what actually matters — but could not reproduce that digest. ✅ **Write the command
   beside the number**, per the standing "mark the instrument on every row" rule.

## What did not get done, and what is not mine

⚠️ **The three tracked files modified from s4/s5 were AGAIN not swept**, for the third session.
Their mtimes are 08-31 and their content was not read: `packages/noodl-mcp/tests/renderReportModule.test.ts`,
`packages/noodl-mcp/tests/stagingDiagnostics.test.ts`, `packages/noodl-mcp/tests/sb007Template.test.ts`
(P80's known orphan; Richard confirmed it is not his). **Read them before committing.**

🔴 **The working tree carries a large amount of another session's in-flight work** — roughly forty
modified tracked files across `noodl-editor`, `noodl-mcp`, `noodl-core-ui`, `noodl-types` and
`package-lock.json`, with mtimes clustered at **09-01 11:35–11:50**, and three OpenNoodl peers were
live at s11. ✅ **Session 11 touched none of it** and committed by pathspec, one file. **Do the
same.** `package-lock.json` in particular carries a `@nodegx/export` workspace entry that is not
this lane's.

🔴 **Row 6's remainder is declined, not deferred.** Item 5 — `/directory` has no header row and
~250px between a name and its email at 1200 — is the biggest thing still visibly wrong and is
costed in [`REL-002c-WHAT-I-WOULD-CHANGE.md`](REL-002c-WHAT-I-WOULD-CHANGE.md). Item 6 is taste.
**The written bar was *"every page reads WORTHY in both states at all three widths"* and the
template is below it**; the row closed because the remaining distance was judged not worth its cost.
This is not a new bar.

⚠️ **Four pages remain unphotographed** — `Announcement`, `Meeting`, `Post`, `Unsubscribe`.
`vib001-members.look.ts` asks for nine of thirteen, so "every page" was never actually graded.
Registered, owner `NONE`.

🔴 **`git commit <pathspecs>`, never `git add`** — a sibling's commit sweeps staged files — except
for untracked paths, which a pathspec commit **skips silently** and which must be `git add`ed first
(`git status --porcelain | grep '^??'`, and check whether a `??` is a **directory**).
