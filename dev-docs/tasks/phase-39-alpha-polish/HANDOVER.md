# Phase 39 — handover prompt

Written 2026-08-03 at the end of the first build session (`c6d5f9f8`…`e09989fd`).
Paste the block below into a fresh session.

---

Continue `dev-docs/tasks/phase-39-alpha-polish` (Track X — the twelve things I hit
driving the editor for an hour as an alpha user). Read `PROGRESS.md` first; it is
current as of commit `e09989fd` on `cline-dev`.

## Where it stands

Done and verified in the running editor: **POL-001** (the settings crash — this was
the alpha blocker), **POL-002** (links + Learn tab), **POL-003** (rail contrast +
five Lucide glyphs), **POL-004** (undefined CSS tokens + a new gate).

Built but **not verified**: **POL-005** slices 1–2 and **POL-009**. Their criteria
are live navigation and a running backend, and the last session ran out before
driving them.

Not started: **POL-006**, **POL-007**, **POL-008**, **POL-010**, **POL-011**,
**POL-012**, and **POL-013** (the `IconSize` sweep, split out of POL-003 on my call).

## Do these first, in this order

1. **Verify POL-005 and POL-009 live**, because they are committed as working and
   nobody has watched them work. POL-005 also has an unfinished slice 3: open all
   seven backend surfaces docked at 860px and record anything that is genuinely
   not fine there as its own finding — do **not** reach for full mode again.
   POL-009 needs the full navigation cycle: pin, navigate away, navigate back, pin
   a second run, unpin.

2. **POL-010 and POL-008 Part A are undiagnosed.** Their first slice is diagnosis,
   not repair. Do not estimate them and do not start writing a fix. POL-010's
   suspicious signal is a node id that equals the node name, which would break edge
   lookup entirely; POL-008 Part A is one of "never emitted", "wrong shape for a
   `User` node", or "the sandbox drops it".

3. Then the rest, cheapest first: POL-007 (the Build panel's row min-width exceeds
   its 400px panel), POL-012, POL-011, POL-006.

## Four things the last session found that the specs did not

- **POL-006's premise is half stale.** `library/modules/lucide-icons/` **already
  ships all ~1998 Lucide glyphs** as a bundled ISC webfont (`lucide.woff2`, a
  `type: "iconset"` manifest, imported 2026-07-25). No project *template* ships an
  icon set; the repo does. So POL-006 is wiring, not sourcing — which also makes my
  "let users add their own glyphs" ask much cheaper than it looked.

- **A dependency's ambient declarations are part of your build whether or not you
  import them.** Deleting `react-instantsearch` broke 18 files that never
  referenced it: its transitive `instantsearch-ui-components` was the only thing in
  the tree still declaring a global `JSX` namespace, and it was typed for *Preact's*
  `VNode`. Everything typechecked against it for months. Before believing a package
  is inert, `grep -rl "declare global"` its tree.

- **Write a check before you decide what it will find.** POL-004's spec named six
  undefined CSS tokens. `scripts/css-token-check.js`, written first, found 25 — six
  of which had no fallback and rendered nothing at all. `npm run tokens:css` is in
  the lint gate now; keep it at zero.

- **My reports name the symptom, not the extent.** "The hide-panel icon needs to be
  bigger" was one corner of a row that measured 16 / 24 / 24 / 16 px with one
  control 5px out of line. Measure the neighbours before fixing the one I named.

## Working rules

- Commit straight to `cline-dev`. No branches, no PRs.
- **Another session has uncommitted work** in `projectmodel.ts`,
  `projectmodel.editor.ts`, `LocalProjectsModel.ts`, `ProjectImporter.ts`,
  `analyze.ts`, `featureFlags.ts` and `VersionControlPanel/**`. Re-check whether it
  is still there and still theirs. **Never `git add -A`, never stash**, and
  pathspec-scope every commit — POL-006 needs a line in `LocalProjectsModel.ts`,
  which is on that list. If you must commit one hunk of a file they are also
  editing, stage it surgically (`git hash-object -w` + `git update-index
  --cacheinfo`) rather than sweeping their work into your commit; the last session
  did exactly that for `projectmodel.ts`.
- The editor suite is `npm run test:ci` from `packages/noodl-editor`. **Only the
  `Jasmine:` line counts** — a run that dies without one graded nothing. Baseline
  is 2137 specs, 0 failures.
- Gates to keep green: `npx tsc --noEmit -p tsconfig.json`, `npm run tokens:css`.
- Verify in the running editor, not only in jest — most of what is left is visual
  or navigational. The `run-editor` skill has the recipe. **HMR will not apply a
  change to an already-mounted panel; restart the stack before concluding a fix did
  nothing.** Stop the stack when you are done.
- Ask me if a decision is genuinely mine. My four earlier answers (Inter; you pick
  the icon list but ship a way for users to add their own; `IconSize` scoped and
  filed; a styling floor in CONVENTIONS after the font lands) are recorded in
  `PROGRESS.md` — don't re-ask them.
