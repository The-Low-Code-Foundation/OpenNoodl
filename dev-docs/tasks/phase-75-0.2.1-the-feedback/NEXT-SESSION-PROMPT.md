# Phase 75 — next session

**State as of 2026-08-24 (session 23).** Session 23 **closed FB-017's AC7** — the property
filter, including the ruling that a search must never write to persisted expansion, and a
`position: sticky` that was **inert and is now removed**. `7f8ca477`. FB-017 is now **🟡 AC4 and
the panel-width half of AC6 only**. Read *"What session 23 found"*, then FB-017's own file, then
session 22's notes, which still stand.

⚠️ **Peers, and a correction that matters more than the census.** Sockets at teardown
(`ls -l /tmp/cc-socks/`): `3878` (FB-023), `39469`, and mine.

🔴 **`39469` is `trybeup-prod-c0` — a DIFFERENT PROJECT in a different checkout.** It is not an
OpenNoodl session and never was. It was misidentified as "session 20, owner of FB-021" by
inferring identity from a socket timestamp, and three messages were routed to it and dropped.
**`ListAgents` had printed the project name the whole time and it was set aside because the start
time fitted.** A reading that fits is not one that excludes.

✅ **The rule: the socket census tells you HOW MANY and HOW TO REACH; only `ListAgents` tells you
WHICH PROJECT.** Do not attribute a task to a socket. ⚠️ MCP process args cannot save you either —
every session's MCP servers run from *OpenNoodl's* `electron/dist` whatever project they are on.

## What session 23 found

### 🔴 A SEARCH MUST NEVER WRITE TO PERSISTED EXPANSION

A hit inside the collapsed `Advanced CSS` has to open it. Doing that through
`propertyPanelViewState.setExpanded` would write a *searching keystroke* into the builder's
preferences — every node selected afterwards, in every later session, would open with Advanced CSS
expanded because they once looked for `transform origin`. **The tier split would erode itself one
search at a time.** `Ports._filterExpansion` is transient; a group collapsed *during* a search is
honoured until the box is cleared. Driven both ways against a known-firing control.

### 🔴 A FIXTURE PROVED A RULE IT COULD NOT TEST — AND ONLY MUTATION FOUND IT

The filter matches label, port **name**, and **group** name. The group-name rule was justified in
prose with `Margin and padding` — *"the rows are Left/Right/Top/Bottom, so typing margin finds
nothing"*. **False.** The real ports are `marginLeft` labelled `Margin Left`: the word is on every
row twice. The fixture was invented to fit the wrong claim, so **deleting the group-name branch
left all 24 assertions green.**

✅ Fixtures now read from `node-shared-port-definitions.ts` (58 shared CSS ports, 14 groups). The
groups that genuinely need the rule: `Style`, `Alignment`, `Dimensions`, `Layout`, `Placement`,
`Dimension Constraints`. All 10 mutations caught.

⚠️ **The first mutation sweep measured nothing** — a `cd` inside the helper broke the relative
jest config path, so every run errored and printed no summary line, which read exactly like a pass.

### 🔴 THREE SYMPTOMS, ONE CAUSE — AND THE THIRD IS NOW MEASURED

`position: sticky` on the filter box was **inert**. Driven: with `top: 0`, scrolling the panel to
400 put the box's top at **−16px**. Sticky binds to the nearest scrolling ancestor, and
`.sidebar-property-editor` (`overflow-y: auto`, **never overflows**) captures it and pins it to a
scrollport that never scrolls.

That is the **same element and the same reason** as session 22's scroll-restore defect, and the
same flex chain **AC6's panel-width half** is stuck in. A real fixed filter header must live
**outside `.sidebar-panel`, above the `ScrollArea` in `index.tsx`** — which is the shared sidebar
layout session AC6 is already waiting on. **Whoever takes AC6 should take all three at once.**

## First moves, in order

1. 🔴 **AC6's panel-width half, now the highest-value item in FB-017** — it has grown from one
   symptom to three, all in the `.sidebar-panel` / `.sidebar-property-editor` chain. Session 22's
   measurement stands: Group `0030` → **312px**, Image `0032` → **346px**; cause is
   `min-width: auto` on the flex chain, so the panel is content-driven. `min-width: 0` needs
   **every registered panel driven** before it can be believed. That is the session.
2. **AC4, the corner-radius-on-Image hint** — untouched, still wants a measured list of offenders
   rather than an open-ended system.
3. ⚠️ **Scope 2's "demote Source Set to the advanced tier"** — **still needs Richard**, unchanged.
   `Source Set` is in the `Image` subject group, so demoting one port is exactly the per-port
   tiering Ruling 1 rejected.
4. **FB-016** (M/L) — box-model overlay, transform-origin crosshair. ⚠️ `Placement` is inside
   `Advanced CSS` as of `879f2f4c`, and is now also reachable by typing `transform`.
5. **FB-022** (M/L) — drag-to-scrub numerics; FB-017's rows are now settled.
6. 🔴 **FB-021 is UNOWNED and available** — there is no live session 20; see the census note
   above. Its file now carries **an ended session's measured correction, committed at `13ecc573`
   as theirs and unverified by me**: a `sizeMode`-gated port is *not* absent. `basic` suppresses
   only the property row, so **328 gated input ports on the shipped catalog are live, wireable,
   and have their value delivered then discarded** — against 21 genuinely-absent `extended` ones.
   That inverts the task's own ground truth and its scope 2. **Re-check those numbers before
   building on them.**
   ✅ The AC7 overlap is **measured and closed**: `ModelProxy.getPorts` splices condition-filtered
   ports out *before* `Ports._getPorts`, so a gated port never becomes a view and the filter can
   neither hide nor reveal one. Precondition, also in the phase handover at `627bd8c4`: if FB-021
   reveals those rows, each must be a **real view carrying `name`/`displayName`**, not only a
   decorated element, or the filter will not reach it.
7. ⚠️ **Deliberate remainders, unchanged**: FB-011 AC1 superseded; FB-007's composer undriven in a
   browser; `apisurfaces.ts`' `personProfile` flat disc — **still nobody's decision**.
8. **Still needing Richard**: FIX-026 (a)/(b), FIX-027 14/15/16 + 22, tsfixme baseline, prod
   `ANTHROPIC_API_KEY` (⚠️ intro pricing ends **2026-08-31 — one week**), the 15 lessons' prose,
   Discord's row in the `?` menu, `/rfps` search.

## Found while working, owned by nobody

- ⚠️ **A `Number` node draws a top-level group literally called `ADVANCED`**, expanded, beside the
  synthetic `Advanced CSS`. Correct under Ruling 2 but the vocabulary now shows two different
  "advanced" things. For whoever revisits `propertyPanelTiers.ts`.
- ⚠️ **The `AskAboutNodeDialog.module.scss` fix is STILL uncommitted — fifth session running**,
  belongs to no session, not touched. Richard's call. Same for the phase-70/71/72 working files.
- 🔴 **The orphaning has a named cause now, and it is not laziness.** FB-021's analysis sat
  uncommitted for a day because **both parties agreed it mattered and each treated delivery as the
  other's**. The same symmetry is what has kept `AskAboutNodeDialog.module.scss` orphaned for five
  sessions. ✅ **Respecting someone's task boundary means not deciding FOR them — it does not mean
  declining to TELL them.** Deferring a decision is right; withholding a measurement is not, and a
  finding costs nothing to receive.
- ⚠️ Unchanged and unchased: `getConnectionSourceLabel` returns nothing for the checkbox row;
  `check:css` in `nodegx-community` has one pre-existing non-ours violation; the editor mirror
  never renders port DIRECTION.

## ⚠️ Harness corrections, session 23 — all cost a false reading

1. 🔴 **Never write `input.value` directly on a React-controlled input.** It updates React's value
   tracker, so the next legitimate `input` event is deduped and **`onChange` never fires**. Cost
   two false readings: a panel that looked stuck filtered, and a "clear" that did nothing. Use
   `cdp -- type`, or native-setter + `dispatchEvent` — never both.
2. 🔴 **`editorSettings.json` nests everything under a `settings` key, and writes ASYNCHRONOUSLY.**
   Reading the top level returns `null` for every key, which reads exactly like "nothing
   persisted" — it invalidated this session's first absence check. Settle-loop the file, and
   always pair an absence with a known-firing control.
3. ⚠️ **`cdp -- type` APPENDS**; it does not replace.
4. ⚠️ **A DOM attribute used as a click target does not survive a re-render** — re-tag before every
   click or the second click lands on nothing.
5. ⚠️ **`cdp -- reload` closes the project** and returns to the launcher.

## Gates, this tree (OpenNoodl, `cline-dev`) — 🔴 re-measure, never quote

Measured at `7f8ca477`, after the final CSS edit:

- `npm run test:main`: **323 files / 5210 specs / 0 failures**. Exactly s22's 322/5181 plus this
  task (+1 file, +29 specs) — no drift, no flakes.
- `typecheck:editor` / `:editor-tests` / `:viewer` / `:runtime` / `:mcp`: **0 errors**.
- ✅ Typechecker **proved to see both new files** (2 planted → 0).
- ✅ The filter's judgements **proved to be gradeable**: 10 source mutations, 10 caught.
- **Not run** — nothing touched them: `test:ci` (Electron), `noodl-runtime`, `noodl-viewer-react`,
  `noodl-core-ui`, all of `nodegx-community`. ⚠️ `typecheck:core-ui` not run; s21 measured 44
  pre-existing `TS2307`.

## Gates, `nodegx-community`

Unchanged since session 18 and **not re-run**: 58 files / 1398 specs / 0 failures, `tsc` clean,
`build` clean, `check:css` 1 pre-existing violation. nexus-1 serves `acd4a9a`. **FB-017 is
editor-side and does not deploy.**

## Session notes

- ✅ **Drive harness**: `npm run dev:debug -- --quiet` (no `&`), wait for `9222` LISTEN, then
  `cdp -- health`. Editor webpack took **93s**.
- ✅ **`dev:stop` spared all 3 peers' MCP helpers** — verified by `ps` after, not assumed, and
  independently confirmed by `3878`. Announced launch and teardown to both reachable peers.
- ✅ **Restored as found**: `recently_opened_project.json` back to **56 rows**; theme back to dark.
  ⚠️ `propertyPanel.groupExpansion` left as `{}` (= the shipping default, Advanced CSS collapsed);
  I never read the correct path before touching it, so I cannot claim I restored a prior value.
- Fixture kept: `NodeGX test projects/fb017-drive`.
