# Phase 33 — handover prompt

Written **2026-08-06**, at the end of the seventh session that day (`42db349f`), which
landed five of phase 33's seven tasks' worth of engineering. Replaces the 2026-08-04
handover, which is superseded in full.

**The next session's job is to run the first hour for real and return a go/no-go.**
Nothing landed today has been driven by a human through the real UI, and the last time
someone ran the real UI against a fixture instead of trusting the suites it produced
F44, F46 and F62 — none of which a green suite could see.

Paste the block below into a fresh session.

---

Run **ALPHA-001 Part A** — the cold-install first hour — against
`dev-docs/tasks/phase-33-alpha-launch`, retest end to end everything that landed on
2026-08-06, and return a **go/no-go on cutting the alpha release**. Work on `cline-dev`,
commit straight to it, no branches and no PRs.

Read these first, in this order:

1. `dev-docs/tasks/phase-33-alpha-launch/ALPHA-001-FIRST-HOUR.md` — the run itself. Its
   two hard constraints are non-negotiable and one of them is currently violated (below).
2. `dev-docs/tasks/phase-33-alpha-launch/PROGRESS.md` — task status and the F63–F80
   register. Its head carries a standing warning: **re-measure a row before acting on it.**
   On 2026-08-06 four of eleven rows were already fixed and three understated what they
   described.
3. `dev-docs/tasks/phase-33-alpha-launch/HUMAN-GATED-ITEMS.md` — what only Richard can do.
4. `ALPHA-006-NOTES.md` and `ALPHA-007-NOTES.md` — what the merged work actually built,
   and the deviations its authors recorded.

## ⚠️ Two things to settle before the run starts

**1. The tree is not clean, and ALPHA-001 says it must be.** A live pass measures whatever
is on disk. At the time of writing, 26 files belong to a **concurrent session** —
`package-lock.json`, `nodegx-observe/bin/`, `ProjectImporter`, `projectmodel*`,
`LocalProjectsModel`, `featureFlags.ts`, `import-engine/analyze.ts`,
`VersionControlPanel/**`, `tests/versioning/**`, untracked `tests-unit/erg-005/` and
`snapshotProject.ts`.

⚠️ **That session is LIVE** — it committed twice during the 2026-08-06 session
(`9d98093a` 19:29, `3051de18`). Richard was asked and said to take ownership of the work
**before** those commits appeared, so **that answer was given on a false premise and must
be re-taken.** Do not touch, revert, stash or commit any of it on the strength of it.

Three of those files are directly in ALPHA-001's path — `ProjectImporter`,
`import-engine/analyze.ts` and `LocalProjectsModel` are the import flow, which is §2 of the
run and *"the single largest block of unverified surface in the product"*. **Auditing them
in an uncommitted intermediate state produces findings nobody can act on.**

**Ask Richard first**, and offer him the three real options: wait for that session to land;
run Part A and exclude §2 (import), reporting exactly what was skipped; or run everything
and record the precise dirty set beside every import finding. **Whatever happens, name the
commit you measured in the report** — the spec requires it.

**2. `tests-unit/erg-005/` is the only red in `test:main`,** a PR CI gate. Two suites fail
to compile (`ports` missing on `GraphComponent`). Same owner, same decision.

## What landed 2026-08-06 and has never been seen in a real editor

This is the retest list. Each is code-complete, gated green, and **unobserved**.

| What | Where | How to reach it |
|---|---|---|
| **The report composer** (ALPHA-007 Parts A+B) | `utils/report/*`, `views/DialogLayer/components/ReportProblemDialog/`, `main/src/report-window.js` | Help → Report a problem |
| **Node help from the bundled catalog** (ALPHA-006 §1) | `utils/nodeDocs.ts` — `docs-parser.ts` is **deleted** | Node picker preview; port docs in the connection popup |
| **The Help Center's new shape** (ALPHA-006 §6) | `HelpCenter.tsx` + `EXTERNAL_LINKS` | The `?` menu |
| **Log + crash folders** (ALPHA-003) | `main/src/debug-log.js` | Help → Open log folder / Open crash report folder |
| **The GitHub device flow** (F63) | `main/src/github-device-flow.js`, `GitHubDeviceCodeDialog` | Any Connect to GitHub button |

⚠️ **The device flow cannot be driven until Richard ticks "Enable Device Flow"** on OAuth
app `Ov23li2n9u3dwAhwoifb` — it is **off by default, GitHub gives no warning**, and the
app receives `device_flow_disabled` on the very first request. Check whether he has done
it before planning that test; if not, everything else still runs.

**ALPHA-003 was partly driven already** and those results stand, so do not redo them:
redaction proven live against a real `sk-ant-` key, an email and a repo path; a
`process.crash()` produced an 833 KB minidump in `Crashpad/pending/`; the retention sweep
deleted **424 stale files**. What is *not* driven is the two Help menu items and what a
user actually sees.

⚠️ **ALPHA-007's §2 prefill has never been checked by a human** (`HUMAN-GATED-ITEMS` B6).
`node scripts/alpha-007/prefill-probe.js` now exists at HEAD. **If GitHub does not honour
prefills into dropdowns, the field contract changes shape** — so run this *before* you
spend time testing the composer's payload. Note the item names a `severity` dropdown that
`bug_report.yml` does not have; check three, not four.

## ALPHA-001 Part A — the run

From the **primary checkout** (the editor cannot launch from a worktree, and `lerna exec`
runs the main checkout regardless), with **fresh `userData`** so first-run is genuinely
first-run. The spec's six sections:

1. Launcher and first run — empty state, create from each template, UIX-006's blank
   thumbnails under real conditions.
2. **The import flow, against `LIB-005-NOTES.md` §7 verbatim.** See the tree warning above.
3. Library install from `library-dist` — prefabs and modules, end to end.
4. **The app-name round trip with a real keystroke, then quit and reopen.** F44 was fixed
   and verified *synthetically*; the real-keystroke path against the 1s debounce is still
   owed, and the debounce is exactly where a data-loss defect hides.
5. PLAT-005 parts A, B and D.
6. **The AI panels with no provider configured.** What a user with no API key sees is a
   first-run question, not an AI question.

Known and to be worked around rather than rediscovered: **launching the dev editor rewrites
the `agent-chat` example project** — minifies `project.json`, drops `rootComponent`, on open
*and* shutdown. Revert after each run, and **do not let that revert quietly hide a real
defect in project saving.**

Carried-forward live-QA debt, each needing a **fresh** editor because the state is one-shot.
Take what the first hour naturally passes through; do not chase the rest:

1. **FH-011's preview-reload re-arm** — attempted twice and destroyed both times before the
   after-count could be read. **Needs a different approach, not another attempt.**
2. HUD-004's crashed-agent (slice 3) and legacy paths. The HUD one-shots passed in **dark
   theme only**.
3. FH-010 (VC dialogs — ⚠️ **drive only**, another session owns those files), FH-019
   (completions in a Function vs an Expression popout — the two `Noodl` objects genuinely
   differ, 4 properties vs 19), FH-023 (the four prefabs).
4. **CWF-004 S6's gesture** ("New cloud function from this step") — its 15 jasmine specs
   pass but the gesture has never been performed in a real editor.
5. **CWF-016's editor door** — the idempotency field in the Permissions panel, never seen.

## The verdict you owe

Report a **go / no-go on cutting the alpha**, and be precise about which question you are
answering, because there are two and only one is yours:

- ✅ **"Is the product ready to put in front of strangers?"** — you can answer this. Findings,
  severity, and for each: blocks the release / fix before strangers / file and ship.
- ❌ **"Is phase 33's exit criterion met?"** — **you cannot answer this, and must not imply
  you have.** The criterion is *"each of those three demonstrated by someone who is not
  Richard and did not build it"*. An agent driving the editor satisfies none of it. Say so
  plainly in the report rather than letting a green run read as a met criterion.

State explicitly what is **still human-gated** at the end: A3 (recruit one macOS, one
Windows, one Linux tester who have never built this — the long pole, nothing shortens it),
A1 (the cert export + five secrets, ~15 minutes, the cert already exists), A2, B1 (entity /
contact / governing law, currently a TODO **inside the shipped binary**), B3 (the publish
name — the complete edit list is in `ALPHA-002-RELEASE-CUT.md` §4), B4, B5/B7, C1, plus
**revoking the leaked GitHub secret `c45276fa…`**, which removing from source did not
un-leak.

## Gate baselines — all green at `42db349f`

```
npm run typecheck:runtime|cloud|viewer|editor|editor-tests    # clean
npm run catalog:check && npm run cloud-library:check && npm run catalog:merge:check
                                            # 172 nodes / 81 cloud / 172-172 enriched
npm run library:check                       # 58/58
npx lerna run test --scope @noodl/runtime           # 2298
npx lerna run test --scope @noodl/cloud-runtime     # 172
npx lerna run test --scope @noodl/nodegx-backend    # 97 suites / 1056
npx lerna run test --scope @noodl/observe           # 23
npx lerna run test --scope @noodl/mcp               # 196
npm run test:main                           # 878 passing, 3 failing (erg-005, not ours)
npm run test:ci                             # Jasmine: 2391 specs, 0 failures
```

⚠️ **The editor spec count is a shared-checkout number** — treat the **failure** count as
the signal. ⚠️ **`test:main` reports `Tests: 0` for a suite that will not compile**, so
compare the **passing count**. `npm run typecheck:core-ui` is **not a gate** and is red on
files nobody owns. `npm run colors` is **red on `noodl-core-ui`'s `ListItem.module.scss`
(+2)**, pre-existing and unowned — do not fix it as part of this, do not make it worse.

## Driving traps — each has cost real time

- **Verify WHICH project actually opened, by name**, before believing anything.
- `--target=editor` **can attach to the launcher** — same file, first match wins.
- **An occluded preview repaints late; reading its DOM is not measuring the graph.** This
  cost an hour chasing a defect that did not exist — the Counter read 5 while the DOM read 0.
- **An occluded Electron window clamps timers ~1000×.** Pace drivers with `MessagePort`.
- A sibling's edit **full-reloads the editor** and kills every one-shot state.
- Each `npm run cdp` costs ~1.5s — collapse click-then-measure into one call.
- `screenshot`/`reload` on the viewer target are unsafe; **the in-editor preview cannot be
  closed on its own** — it is a `<webview>` guest and killing it white-screens the editor.
- **Restart the editor; do not trust HMR** — it will not reach a mounted panel.
- **Check both themes.** Use the `run-editor` skill.

## Rules of engagement

- **`git commit -m "…" -- <explicit paths>`. Never `git add -A`, never stash, never
  `git checkout`/`git restore` a file you did not write.** The one legitimate `git add` is a
  single exact path for a **new** file.
- **Commit incrementally, per slice.** An agent that has not committed has produced nothing.
- **Only one agent may own the Electron editor** — it is a queue, and a sibling `dev:stop`
  kills another session's `test:ci`. `npm run test:ci` cannot run while an agent holds the
  editor, so the orchestrator runs it at the end.
- ⚠️ **Before building anything this or any handover recommends: `git branch -a` and grep
  the log for the task ID.** On 2026-08-06 the previous handover's most confident
  instruction was to build ALPHA-006 and ALPHA-007 from scratch — **both were already
  built, tested and committed** on `wt-alpha-006`/`wt-alpha-007`, 215 commits stale. A
  finished branch is as invisible as uncommitted work if nothing names it.
- **Re-run the gates yourself on the settled tree at the end.** Every session that did this
  found something.
- Task docs are **researched but not infallible** — roughly two premises per doc are wrong.
  Verify at file:line and **fix the doc line**.
