# Phase 33 — handover prompt

Written **2026-08-07**, at the end of a long session that closed nearly all of ALPHA-006's
engineering (§2/§3/§4/§5's code half, on top of §1/§6 already done), fixed a real
node-catalog enrichment gap, got B5 **decided** by Richard, and — while live-driving
ALPHA-007 for the first time — found a real, currently-live regression that a real user
hit. Measured at `e3922d58`. Replaces the same-day `e0894ad8` handover, superseded in
full: ALPHA-001 Part A is now **fully closed** (that handover's "§4/§5/§6 owed" is stale
— see `9ad5d71b`), and everything that handover listed as "ALPHA-006 §2 onward, once
ALPHA-004's content exists" is now built.

**The next session's job, in priority order: (1) fix the live regression below — it's
small, diagnosed, and real users are hitting it right now; (2) drive ALPHA-007's actual
composer correctly this time, now that its real location is known; (3) once Richard has
done B5's two GitHub actions, do the actual `opennoodl-docs` repo strip and repoint
`getDocsEndpoint()`/`nodeDocsPath()`.**

Paste the block below into a fresh session.

---

Continue phase 33 alpha-launch work against `dev-docs/tasks/phase-33-alpha-launch`. Work
on `cline-dev`, commit straight to it, no branches, no PRs.

Read these first, in this order:

1. `dev-docs/tasks/phase-33-alpha-launch/PROGRESS.md` — task status and the full findings
   register. Its head carries a standing warning, still true: **re-measure a row before
   acting on it.** The three 2026-08-07 log entries at the bottom (B5 decided, §4 done,
   plus the enrichment-gap fix) are the most recent state.
2. `dev-docs/tasks/phase-33-alpha-launch/HUMAN-GATED-ITEMS.md` B5 — **decided**, two
   GitHub admin actions owed, in order. Not yet done as of this handover.
3. `dev-docs/tasks/phase-33-alpha-launch/ALPHA-007-FEEDBACK-LOOP.md` and
   `ALPHA-007-NOTES.md` — before touching the composer again, given what this session
   got wrong about where it lives (below).

## 🔴 Fix this first — a live regression a real user just hit

While live-testing the Help menu, Richard clicked "Report a bug" himself and got **a
blank GitHub issue with no template, no labels, nothing applied** — not a test artifact,
a real observed failure. Root cause, found and confirmed, **not yet fixed**:

`packages/noodl-editor/src/editor/src/views/HelpCenter/HelpCenter.tsx:49` —

```ts
const REPO_URL = 'https://github.com/The-Low-Code-Foundation/OpenNoodl';
```

Still the **old** repo name, from before B3's rename to `NodeGX` (`dev-docs/tasks/
phase-33-alpha-launch/HUMAN-GATED-ITEMS.md` B3, done 2026-08-07 earlier the same day).
GitHub's repo-rename redirect carries the path but **drops the `?template=` query
param**, which is exactly the blank-issue symptom Richard saw. B3's own rename session
apparently grepped for `OpenNoodl` and missed this file (it wasn't caught until a human
actually clicked the button).

**Same bug, same fix, one more site, also unfixed:**
`packages/noodl-editor/src/editor/src/views/migration/steps/FailedStep.tsx:94` — a
"check the issues" link on a migration-failure screen, same hardcoded old URL.

Fix: change both to `https://github.com/The-Low-Code-Foundation/NodeGX`. Re-grep
`The-Low-Code-Foundation/OpenNoodl` across `packages/*/src` after, excluding the
gitignored `*.bundle.js` build artifacts (both already appear there too — those
regenerate on the next dev launch, don't hand-edit them). Verify by actually clicking
"Report a bug" live and confirming the template + labels load — that's the only way
this bug was ever going to be caught, and it's the only way to confirm the fix.

The real issue Richard filed while testing this is closed:
`github.com/The-Low-Code-Foundation/NodeGX/issues/18`.

## ALPHA-007 — you were looking in the wrong place; here's the right one

This session tried to live-drive the report composer via `npm run cdp` and repeatedly
failed to make it appear, despite clicking what looked like the right menu items. The
reason: **the Help Center's `?` icon (in-app, renderer DOM) does not open the composer
at all.** Its "Report a bug" / "Report a node behaving wrongly" / "Suggest a feature"
items (`HelpCenter.tsx`, the ones with the stale-URL bug above) are deliberately *plain*
GitHub issue-template links — POL-002/ALPHA-006 §6 built them that way on purpose,
because a screenshot capture can't be triggered from the renderer.

**The actual composer (`ReportProblemDialog`, the rich one with diagnostics/redaction/
screenshot) lives at `Help → Report a problem…` in the native OS application menu bar**
— registered in `packages/noodl-editor/src/main/main.js:767`
(`{ label: 'Report a problem…', click: () => openReportComposer() }`). That is a real
native `Menu`/`MenuItem`, not DOM — `npm run cdp -- click`/`eval` only reach the
renderer and will never find it, no matter how the selector is phrased. Two ways to
actually trigger it next time:

- **`npm run dev:debug -- --inspect-main`**, attach to the main-process inspector on
  `:9229`, and call `openReportComposer()` directly (it's a named function in
  `main.js`) or find and `.click()` the `MenuItem` on the built `Menu` — this is the
  clean path, no OS automation needed.
- Native OS menu automation (`osascript` on macOS) as a fallback, if the above proves
  awkward — slower and platform-specific, prefer the inspector route first.

**None of ALPHA-007's acceptance criteria were actually exercised this session** —
criterion 4 (redaction against a hostile fixture) was set up (a plan for injecting a
composite hostile string via `console.error` into the error-tail ring buffer, covering
an API key, a backend endpoint, a component named after a client, and a path outside the
project root — see `errorTail.ts`/`redact.ts` if re-deriving this) but never run, because
the composer never opened. Redo it once the composer is reachable. **B6** (verify the
GitHub prefill lands in the real dropdowns) is *also* still open — what Richard did
today tested the broken plain-template path, not the composer's prefill, so it doesn't
discharge B6. It needs the composer specifically, with a signed-in browser.

## ALPHA-006 — nearly all engineering done; B5 decided

Everything except the actual repo strip and two things sequenced behind it is done: §1,
§2 (`docs-site/`, a real Docusaurus 3 site, wired into `workspaces`/`lerna.json`), §3
(`scripts/generate-node-docs.js`, `npm run docs:nodes`/`docs:nodes:check`), §4
(`docs-site/MIGRATION.md`, all 431 `opennoodl-docs` files classified, zero
unclassified), §5's code half (`getContentEndpoint()` split from `getDocsEndpoint()`),
and §6. Commits: `307967a5`, `84b4934e`, `c5c5a784`, `6165691e`, `e3922d58`.

**B5 is decided** (Richard, 2026-08-07): the payload repo (`opennoodl-docs`) stays
separate from the main monorepo — measured that ~336 MB of its 518 MB is genuinely live
payload (prefab/lesson/template zips the app fetches), not deletable doc media, and this
repo has no git-lfs, so dragging it in would be permanent history growth. Two GitHub
admin actions owed, **in this order** — don't do the second before the first, and don't
do either without Richard:

1. **Rename `opennoodl-docs`** to reflect what it now is (he said something like
   `nodegx-content`, not finalised). Old name redirects, but `getContentEndpoint()`
   must not be repointed until this has actually happened.
2. **Enable GitHub Pages on the `NodeGX` repo itself** for `docs-site/` — no third repo
   needed, a workflow here can use the repo's own built-in Actions token.
   `docusaurus.config.js` already targets the real URL
   (`the-low-code-foundation.github.io/NodeGX/`), but nothing publishes there yet.

**Once docs-site is actually live**, two more things need fixing (found while answering
a question about them today, not yet done):

- `getDocsEndpoint()` still returns the old `opennoodl-docs` origin — repoint it.
- `nodeDocsPath()` (`utils/nodeDocs.ts`) derives a node's docs URL from the catalog's
  legacy `docs` field verbatim (old site's URL shape, e.g.
  `/nodes/data/object/object-node`) — this **does not match** `docs-site`'s generated
  structure (`/docs/nodes/<category-slug>/<type-slug>`, from `generate-node-docs.js`).
  Repointing the origin alone will 404 every node's "Open docs" link. Rewrite
  `nodeDocsPath()` to derive the same way the generator does (category + typeName slug),
  not from the legacy field.

`docs-site-content/` (ALPHA-004's staging dir) is still an unremoved stale duplicate of
`docs-site/docs/` — `git rm -r docs-site-content` was blocked by the permission
classifier as destructive, twice now across sessions. Needs a human to do it or
explicitly authorise an agent to.

§4's migration table found and documented **a fifth fate the spec's own "four fates"
framing never named**: 193 of the 431 files (library prose, repo meta, a
prefab-authoring boilerplate) are neither migrated nor deleted — they stay in the
renamed content repo. Read `docs-site/MIGRATION.md`'s own summary table, not the spec,
if reasoning about this again.

## The enrichment coverage fix, if it comes up again

Richard asked directly "is everything documented" and it wasn't — `catalog:merge:check
--require-coverage` had been failing all day. Fixed same session (`c5c5a784`): 3 cloud
role-management nodes (`noodl.cloud.addusertorole`/`getuserroles`/`removeuserfromrole`)
had zero enrichment authored, so they were silently absent from
`node-catalog-enriched.json` entirely; separately the committed catalog was stale
relative to an already-authored wording fix in `docs/node-catalog/enrichment/*.json`
(same failure class as F76 — a generation script existed, nobody re-ran it). **Catalog
is now 175/175, `catalog:merge:check` green.** Don't re-investigate this; it's closed.

## Gate baselines — full sweep run repeatedly today, all clean at `e3922d58`

```
npm run typecheck:runtime|cloud|viewer|editor|editor-tests    # clean
npm run catalog:check                       # 175 nodes, up to date (structural catalog)
npm run cloud-library:check                 # 84 nodes, up to date
npm run catalog:merge:check --require-coverage   # 175/175 documented, up to date — GREEN for the first time today
npm run library:check                       # 58/58
npm run docs:nodes:check                    # 194 generated files match 175 catalog nodes
npx jest (from packages/noodl-editor)       # 933/933, 67 suites
npm run lint:ci                             # 860 errors vs 3916 baseline
npm run test:ci                             # Jasmine: 2418 specs, 0 failures
npm run docs-site:build                     # clean, onBrokenLinks: 'throw'
```

⚠️ `node-catalog.json` (structural, 175) and `node-catalog-enriched.json` (enriched,
also 175 as of this session — previously 172) are **two different files** with
historically different counts; don't conflate them if they drift again.
**`npm run typecheck:core-ui` is still not a gate**, red on files nobody owns.
**Re-run the full sweep yourself on the settled tree at the end** — every session that's
done this has found something, including this one (the enrichment gap).

## Driving traps — including two new ones from today

- **Native OS menus (the application menu bar) are invisible to `npm run cdp`.** It only
  reaches the renderer's DOM. If a menu item isn't findable by any selector or text
  search, check whether it's actually a `Menu`/`MenuItem` in `main.js` before spending
  more time guessing DOM structure — this cost most of a live-drive attempt today.
- **A live session can trigger a real external side effect with no undo.** Clicking a
  "Report a bug"-shaped button in a running editor can genuinely open a real browser tab
  and, if a human is present and completes it, file a real issue on the real repo — which
  is exactly what happened this session. Warn the human before clicking anything
  report/submit-shaped, or find a way to inspect the composed output without triggering
  the send.
- Finding an element by visible text (not exposed as a CSS selector) needs an `eval`
  round-trip: `[...document.querySelectorAll('*')].find(e => e.children.length===0 &&
  e.textContent.trim()==='exact text')`, then `.closest('button,[role=button]')` or the
  nearest clickable ancestor class before `.click()`. Plain `npm run cdp -- click
  "text=..."` is not valid syntax — it's CSS selectors only.
- Repeated `eval` calls in the same CDP session can hit `Identifier 'x' has already been
  declared` on a shared `const`/`let` — wrap each eval body in an IIFE
  (`(function(){ ... })()`) to avoid this.
- **Verify WHICH project actually opened, by name**, before believing anything.
- `--target=editor` **can attach to the launcher** — same file, first match wins.
- **An occluded Electron window clamps timers ~1000×.** Pace drivers with `MessagePort`.
- A sibling's edit **full-reloads the editor** and kills every one-shot state.
- `screenshot`/`reload` on the viewer target are unsafe; the in-editor preview is a
  `<webview>` guest and killing it white-screens the editor.
- **Restart the editor; do not trust HMR** — it will not reach a mounted panel.
- Check both themes. Use the `run-editor` skill — it has all of the above baked in
  already; read it before re-deriving any of it by hand.

## What's still human-gated, unchanged from before

**A1/A2** (signing secrets), **A3** (recruit testers — the long pole), **B1** (legal
entity/contact/governing law), **B2** (revoke the leaked GitHub secret, enable Device
Flow), **B4** (permission to run `scripts/alpha-007/create-labels.sh`), **B6** (verify
the prefill by hand — needs the *actual* composer per above, not the broken plain-link
path), **C1** (outside reader for `PRIVACY.md`/`TERMS.md`). **B5's two actions** (repo
rename, enable Pages) are new to this list — see above.

## Rules of engagement

- **`git commit -m "…" -- <explicit paths>`. Never `git add -A`, never stash, never
  `git checkout`/`git restore` a file you did not write.**
- **Commit incrementally, per slice.** An agent that has not committed has produced
  nothing.
- **Only one agent may own the Electron editor** — it is a queue, and a sibling
  `dev:stop` kills another session's `test:ci`. **Always `npm run dev:stop` when done**
  — this session left the stack running once and had to be reminded.
- ⚠️ **Before building anything a handover recommends: `git branch -a` and grep the log
  for the task ID.** This repo has shipped the "rebuild something that already existed"
  mistake twice now.
- **Re-run the gates yourself on the settled tree at the end.**
- Task docs are researched but not infallible — re-measure, don't inherit. This session's
  own numbers (175/175, 431 files, ~336 MB payload) are real measurements as of
  `e3922d58` — re-verify if much time has passed before trusting them further.
