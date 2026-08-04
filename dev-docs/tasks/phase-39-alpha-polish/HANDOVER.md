# Phase 39 — handover prompt

Written 2026-08-04 at the end of the **fourth** build session (`4c837e70`…`e50a3f92`).
Paste the block below into a fresh session.

---

Continue `dev-docs/tasks/phase-39-alpha-polish` (Track X — the twelve things I hit driving the editor
for an hour as an alpha user). Read `PROGRESS.md` first; it is current as of commit `e50a3f92` on
`cline-dev`.

## Where it stands

**10 done, 2 diagnosed-and-scoped, 3 not started.** Nothing is "built but unwatched" — every done
item has been driven in the running editor.

Done: **POL-001** (the settings crash — the alpha blocker), **POL-002** (links + Learn tab),
**POL-003** (rail contrast + Lucide glyphs), **POL-004** (undefined CSS tokens + a new gate),
**POL-005** (backend surfaces at 860 — now closed, see below), **POL-009** (a pin belongs to one
canvas), **POL-014** (the Data Browser), **POL-015** (the first workflow), and this session's
**POL-007** (the Build panel fits) and **POL-006** (a font and an icon set).

**All my open questions are now answered** and written into the specs with the rejected alternatives.
`PROGRESS.md` has them as items 5–7 under *Answered by Richard — 2026-08-04*. **Do not re-ask them
and do not re-derive the options.**

Not started: **POL-011**, **POL-012**, **POL-013**.

## Do these, in this order

1. **POL-010 — now scoped, and smaller than it was.** I chose **slice 3 + slice 2b; slice 2 is
   deferred.** The panel keeps its preview-sourced topology and stops presenting one row as a
   result: four distinguishable states, of which the fourth — *the queried node is not in the
   topology at all* — is the one I actually hit, is free to detect (`topology.nodes[id]` is there or
   it is not), and is currently **visible but unexplained** (it is the only state where `Node` and
   `Node id` print the same string). `explainTerminus` returns `undefined` for an unwired root today,
   so there is nowhere for any of this to render yet — *that*, not the wording, is the work.

   Slice 2b is a few lines and is a correctness bug in its own right: `TraceSession` is a singleton
   with **no reset path**, so after a project switch it reports `hasTopology: true` and serves the
   *previous* project's graph. Observed live.

   Do not build slice 2 (project-sourced topology). It is the right destination and it is written up
   in the spec, but it carries component scoping and a decision about component instances, and it is
   its own task.

2. **POL-008 Part A — signed in by default, with a toggle to sign out.** Diagnosed already; do not
   re-diagnose. The sandbox ships a complete signed-in user with a `sessionToken` and nothing ever
   signs in, because `installSandbox` intercepts the network and only the network while `UserService`
   asks for `/users/me` only if a session already exists. **The fix is to seed the session where
   `installSandbox` runs** and let the existing interception do the rest.

   The reason it needs a toggle: the `User` node's `authenticated` output is literally
   `this._internal.model !== undefined`, so seeding makes it true in *every* preview and the
   signed-out branch of every graph becomes unreachable. The toggle is preview state, never project
   state, and the strip has to say which state it is in — a preview whose `authenticated` is false
   under a strip reading "signed in as a sample user" is the same defect one layer down.

   Criterion 2 binds independently and is the non-negotiable: **"Sample data" must never silently
   show placeholders.**

3. **POL-008 Part B is no longer gated.** It was waiting on POL-006 ("re-judge after POL-006"). The
   font has landed, so genuinely rebuild the same Profile page and look at it before doing anything
   else — the re-judge is the first slice, not a formality.

4. Then **POL-012**, **POL-011**, **POL-013**. POL-013 is last on purpose: it is a ~130-call-site
   change *the moment the CSS rules exist*, with no incremental landing, and it is not
   alpha-blocking.

## What this session found that the specs did not

- **POL-006's font half was stale, and the real defect was not on anyone's list.** `--font-sans` was
  never dangling — REV-009 stamps `:root` into both surfaces, so criterion 5 was met before the task
  started. But with the token resolving to Inter and all four Inter faces registered in the preview,
  the Hello World text still rendered in **Times**: `TextConfig` *declares*
  `fontFamily: 'var(--font-sans)'`, and **a declared default never runs its setter** — the phase-30
  class, third time. The element reaches the DOM with no family and both viewer templates style
  `body` without one. Fixed in `TokenResolver.generateCss`, the one artifact the preview, a deploy
  and SSR/SSG all come through.

- **Inter and Lucide were both already in the repo.** `src/assets/Inter/` (nine weights, SIL OFL) is
  the editor's own UI font; `library/modules/lucide-icons/` is the full 1998-glyph ISC webfont,
  imported 2026-07-25. POL-006 was wiring, not sourcing. Check what the repo already has before
  sourcing anything.

- **POL-007's scrollbar came from `ScrollArea`**, not from the rows the spec measured. It sets
  `overflow-y: auto` and leaves `overflow-x` at `visible` — **which CSS computes to `auto`**. Nothing
  had to opt into a horizontal scrollbar; leaving overflow-x alone *was* opting in.

- **`isGrowing` is `flex: 1`, and its basis is 0.** So three `isGrowing` buttons split a row into
  equal thirds at *any* width regardless of their labels — which is why "This component" got 106px
  for a 120px label and wrapped onto a second line while "Docs" kept 36px it had no use for.
  `flex: 1 1 auto` starts from each label's own width and shares only the slack.

## Harness facts worth keeping

- **Write the measurement before the fix, and run it against `HEAD`.** POL-007's driver did, and
  reported `Drop from plan` laid out at `[461..576]` against a panel ending at `451`. That is the
  difference between "the check passes" and "the check catches the defect", and it took one extra
  stack restart.

- **`getBoundingClientRect()` reports layout, not paint.** A child clipped by `overflow: hidden`
  still reports its real position outside the clip — so "does any descendant cross the panel's own
  edges?" proves the layout genuinely *fits*, rather than that the overflow was hidden. That
  distinction is the whole difference between "no scrollbar" and "the row ellipsises".

- **`document.fonts.check()` answers false for a webface nothing has rendered yet.** It sits at
  status `unloaded`. The first version of POL-006's driver reported four perfectly good Inter faces
  as missing. `await document.fonts.load(...)` first, *then* check. And
  `getComputedStyle(el).fontFamily` returns the *declared* stack whether or not a byte was fetched —
  only the pair of them is evidence.

- **A stylesheet that compiles is not a stylesheet that applies.** The first scope-tab fix passed
  `tokens:css`, typechecked, and changed nothing on screen, because `.is-growing` is a second class
  on the same element and outranked it. Only the screenshot caught that.

- **`LocalProjectsModel.openProjectFromFolder` loads the model but does not route the editor to it**,
  so `ProjectModel.instance` stays null. Drive the launcher's own "Open project" button with
  `filesystem.openDialog` stubbed — and note it returns the directory **string**, not
  `{ filePaths: [...] }`.

- **A backtick inside a comment inside a CDP template literal terminates the literal.** Cost one
  confusing `SyntaxError`. Don't quote code with backticks inside an evaluated string.

- **`git hash-object -w` + `git update-index --cacheinfo` stages part of a file without touching the
  working tree.** That is how this session committed two hunks of `LocalProjectsModel.ts` while
  another session's uncommitted work sat in the same file, with no checkout window at all. Better
  than any patch arithmetic.

- Two reusable drivers, both no-provider and both offline:
  `scripts/pol39-live/pol007-layout.js` (a four-operation plan, one of which fails for real through
  the SUB-006 gate; measures seven panel states in either theme and writes a PNG per state) and
  `scripts/pol39-live/pol006-starter-assets.js` (creates a project, opens it, reads the running
  preview, runs a real deploy build; 12 checks).

## Working rules

- Commit straight to `cline-dev`. No branches, no PRs.
- **Another session still has uncommitted work** in `projectmodel.ts`, `projectmodel.editor.ts`,
  `LocalProjectsModel.ts` (a `_adoptV2Format` conversion), `ProjectImporter.ts`, `analyze.ts`,
  `featureFlags.ts`, `VersionControlPanel/**` and `nodegx-observe`. Untouched across **four**
  sessions now — re-check whether it is still there and still theirs. **Never `git add -A`, never
  stash**, and pathspec-scope every commit.
- The editor suite is `npm run test:ci` from `packages/noodl-editor`. **Only the `Jasmine:` line
  counts.** Baseline is **2148 specs, 0 failures** — unchanged this session.
- **`nodegx-backend`'s jest suite is NOT green at baseline** — `tests/email-flows.test.ts` fails two
  specs on 30s timeouts. Confirmed pre-existing. Do not spend time proving it is not yours.
- Gates to keep green: `npx tsc --noEmit -p tsconfig.json` (in both `noodl-editor` and
  `nodegx-backend`), `npm run tokens:css` **from the repo root**, and new this session
  `npm run starter-iconset:check` (also from the root — it regenerates the starter icon set from the
  library module and fails if the committed output has drifted).
- Verify in the running editor, not only in jest. The `run-editor` skill has the recipe. **HMR will
  not apply a change to an already-mounted panel; restart the stack before concluding a fix did
  nothing.** Stop the stack when you are done (`npm run dev:stop`, from the repo root).
- **Work on a copy of any project you drive.** This session drove temp copies throughout and left no
  tracked project modified.
- Ask me if a decision is genuinely mine. My seven answers are recorded in `PROGRESS.md` — don't
  re-ask them.

## No open questions

For the first time in this phase there are none. If one appears, it goes in `PROGRESS.md` under a
new dated heading with the alternatives you rejected, not just the one you took.
