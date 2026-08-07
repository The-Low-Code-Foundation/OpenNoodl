# Next-session prompt — phase 21, Library & Import

Written 2026-08-02 at `53894f61`. First prompt for this phase; nothing to supersede.

**Read [`PROGRESS.md`](./PROGRESS.md) first — it is authoritative.** This file is the ordered plan;
that one is the record.

## Where the phase actually is

**4 of 6 tasks are Complete.** What remains is *content* work, not engineering.

| Task | State |
|---|---|
| **LIB-001** pipeline | ✅ **Complete.** Criterion 5 met live — 2 prefabs + 1 module installed from a locally served `library-dist` |
| **LIB-004** import engine | ✅ Complete. Live pass found and fixed one real defect (below) |
| **LIB-005** import UX | ✅ **Complete.** QA-1…QA-6 all executed or shown unreachable |
| **LIB-006** legacy import | ✅ **Built.** Criterion 4 open (no model was ever called) |
| **LIB-002** prefabs | ⚠️ **Headless half done. The visual pass is the headline gap** |
| **LIB-003** modules | ⚠️ Headless half done. **0 of 29 modules exercised on either React pairing** |

**Gates on this tree, all run:** root `typecheck` **0** · `typecheck:editor` **0** ·
`typecheck:editor-tests` **0** · `library:check` **58/58** · `catalog:check` green ·
`noodl-editor` jest `tests-unit` **16 suites / 203 passing** · **Jasmine 2077 specs / 0 failures**.

Do **not** re-derive any of that. If something is red, it is new.

## ⚠️ Concurrency — read before launching anything

Two sessions cannot share the editor, and each one's launch silently kills the other's. `start.ts`
sweeps leftovers before starting more, so a concurrent `npm run test:ci` reaps a running
`dev:debug` stack, and yours reaps their Jasmine run. **This cost the last session its first two
attempts** — the editor was acquired cleanly, the fixture opened, and the stack took SIGTERM ~90s
later, twice.

- Before a live pass, check for `webpack.test-ci`, `electron/dist` and `scripts/start.ts`, and wait
  for a **sustained** quiet window, not an instantaneous one.
- **Never `npm run dev:stop`** while anyone else is active — it kills by checkout *and* matches a
  running `test:ci` Electron.
- **Never `git stash`, never `git add -A`.** `git commit` needs a pathspec too, not just `git add`:
  `git commit -m "…" -- <paths>`.
- `dev-docs/tasks/phase-37-project-tabs/` is untracked and **not ours**. Leave it.

## The work, in the order it is worth doing

### A. LIB-002's visual restyle pass — the headline

The headless half tokenised 29 colour values across 13 prefabs and closed all five folder-hygiene
defects; **zero opaque hex colours remain on any node parameter in any of the 29 prefabs.** What is
left needs eyes on a canvas:

1. **Two edits deliberately *shift* a colour** rather than swap an exact value — `#B4B4B4` →
   `Grey - 400` on `table`'s divider, and `#3E3E3E` → `Grey - 700` on the pills icon. Everything
   else was exact. **Look at those two first**; they are the only ones that can look wrong.
2. **Icon regeneration.** Three inconsistent size families ship today, with `media-query` a
   1326×674 / 101 KB outlier.
3. **Install console-cleanliness on React 18 and 19**, per prefab.
4. **Spacing/radius re-layout** was deliberately not attempted headlessly — those are numeric
   parameters whose visual role cannot be read from JSON. This is real design work, not cleanup.
5. `toast`'s three different-alpha shadows; delete `table`'s dead border param and `stripe`'s dead
   `in-DefaultColor` input (both confirmed inert, left in place).

### B. LIB-003 — 0 of 29 modules exercised

**Priority four: `avatar`, `chart-js`, `mapbox`, `simple-tooltips.`** Their bundles need real
React/DOM, so their *declared vs actual* node types are still **unknown** — everything else was
measured in a `vm` sandbox. Then the rest of the 26, plus preview/deploy verification of the three
new modules (`confetti` installs cleanly — verified live).

### C. Decisions only Richard can make — ask, don't guess

1. **`material-icons` ships 4× in 2 incompatible versions.** 2122 glyphs standalone vs 1865 in
   `avatar` / `image-cropper` / `panning-and-zooming-control`, with 77 glyphs unique one way and
   334 the other — **neither is a subset**. Installing one over another changes the user's icon
   picker in *both* directions. Which copy wins?
2. **`mapbox-gl` v2+ is proprietary** and vendored with no licence text. A legal question,
   independent of the no-API-keys policy. (~9 seeded modules vendor third-party libs with no
   licence text; Mapbox is the sharp one.)
3. **The NodePicker no longer closes itself after an install.** Deliberate, reasoned, reversible in
   one line — but observable, and it has been waiting for his eye since LIB-005.
4. **Three "modules" register zero nodes** — `image-cropper`, `panning-and-zooming-control`,
   `shake-detector` are prefabs wearing a module label. Reclassify, or leave?

### D. LIB-006 Criterion 4, and the premise that changed

The hand-off is wired and unit-tested on both surfaces (`ContextBuilder.importReport()` and MCP
`get_import_report`), but **no model was ever called**, so *"an assistant repairs a real construct
as a reviewable diff"* is undemonstrated. Also untested: the composed `apply()` path against a real
`ProjectModel` — the largest untested seam in the task.

⚠️ **Know this before planning legacy work:** LIB-006 found the spec's central premise stale.
PLAT-003 kept every deprecated node *registered*, and **no legacy Noodl node type was ever
removed** — of 26 deleted node files in history, 19 are `.js`→`.ts` renames and 6 of the remaining 7
are `byob-*` (pre-BCN-004 NodeGX, not Noodl). A Noodl 2.x graph imports as `converted` almost in
full. The unconvertible surface is **modules, backend config and user JavaScript** — not nodes.

### E. Smaller, high-leverage

- **`views/ImportFlow` has zero `data-test` hooks** across all six components. Every QA pass has had
  to drive it by visible button text, and that is a large part of why the checklist took four
  sessions. Adding hooks would make the next pass mechanical.
- **QA-6.1 and QA-6.3 are unreachable from the shipped UI** — all three import entry points take a
  library entry, a known local project, or a URL, and **none uses a directory chooser**. Either
  rewrite those steps against a known-but-broken project, or treat the missing affordance as the
  finding. Needs a decision before anyone "completes" them.
- The three new modules' `docsPath` **404s**, and it is not fixable in `library.json` —
  `build.js:101` falls back to the same path. They need real docs pages (ALPHA-006 territory).
- Two style-system limits, reported not fixed: **α-over-token is not expressible**
  (`resolveColor` is name→value with no alpha form) and **text styles cannot reference colour
  tokens at all** (`setStyles` bypasses `resolveColor`). Both are feature requests the style
  charter assumes already exist.

## The live-QA recipe that worked — reuse it, it saves an hour

```bash
npm run library:build
npx ts-node -P ./scripts/tsconfig.json ./scripts/library/verify-dist.ts --port 3000 --serve
```

`main.js` probes `127.0.0.1:3000/{major}.{minor}/version.json` for `{"kind":"noodl-docs"}` and
adopts a local docs origin. **One prefab install against it discharges LIB-001 Criterion 5, QA-3,
and a live look at LIB-002/003 content simultaneously.** Confirm adoption with
`getDocsEndpoint()` → `http://localhost:3000`.

⚠️ **Kill the stub when you finish.** Any editor probing 3000 silently adopts it instead of the real
CDN — including another session's.

**Entry points:** stub `filesystem.openDialog` via the webpack-require handle and click the **real**
button (keeps you inside React's event handling, so nothing you observe is an eval artefact);
import-from-URL is `EventDispatcher.instance.emit('importFromUrl', url)`.

**Fixtures** are at `scratchpad/qa/` — `qa3-target` carries a `Primary` colour style so the `tags`
prefab collides on it; `loading-spinner` is the ships-no-styles prefab for the no-dialog case.
Committed equivalents: `packages/noodl-editor/tests/testfs/import_collide_{target,source}`.

**Driving traps that cost time:**

- CSS-module names prefix **every** descendant — `[class*=ImportFlow]` matched **85** elements.
  Select by visible button text.
- The **DONE stage is wider** than SELECT/REVIEW, so a fixed-width selector misses it and reads as
  *"the flow closed"*. **Screenshot before believing a negative.**
- Editor icons expose **no glyph, mask or text** in the DOM. A probe finds nothing and it looks
  exactly like a rendering defect. It is not — a screenshot showed them rendering fine. **Do not
  file it.**
- A synthetic `KeyboardEvent` is not trusted input and will not dismiss the flow; `cdp.js` has no
  key-dispatch command. That is why QA-6.4 is unverified.

## The lesson from this batch, worth carrying to any phase

**A fake that cannot express a state leaves that state untested, however green the suite is.**

The live pass found that an overwrite **duplicated any component carrying no id** instead of
replacing it — and every real project has exactly one such component, its root `/App` (measured:
76/77, 74/75, 1/2, 11/12, 333/334 carry ids; the missing one is `/App` every time). So importing any
project into any other and accepting the default Overwrite duplicated the target's root.

2017 specs passed over that code. They could not have caught it: `FakeTarget` keyed components as
`Record<string, string>` — name→id — so *"exists without an id"* was unrepresentable. Fixed in
`ebf5f05f`; the fake now takes `string | undefined` and asks `hasComponent` separately.

Second lesson, from the orchestration: **do not use `isolation: "worktree"` on this repo** — the
harness roots every worktree branch at `origin/main`, ~660 commits stale. Build them by hand off
`cline-dev`, and make `node_modules` a real directory of per-entry symlinks with a real `@noodl/`
dir pointing at the *worktree's* `packages/*`; a blanket symlink makes `@noodl/runtime` load twice
and `collection.ts` throws `Cannot redefine property: items`, which presents as a whole suite
failing on your branch. Verify with
`require.resolve('@noodl/runtime/package.json', {paths:[wt]})` before launching any agent.
