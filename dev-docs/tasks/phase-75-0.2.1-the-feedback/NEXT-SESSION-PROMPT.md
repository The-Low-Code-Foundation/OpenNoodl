# Phase 75 — next session

**State as of 2026-08-24 (session 21).** Session 21 **built, specced and drove FB-015** — the
image picker's empty state, an import path into `assets/`, the walk that stopped offering your
dependencies' images as your own, and Source Set's placeholder. **Closed, all five ACs.**
`df672c91`. Read *"What session 21 found"*, then session 19's notes below, which still stand.

⚠️ **This checkout is busy.** Session 21 counted **five live sessions** via `ls -l /tmp/cc-socks/`
(one socket per session, addressable as `uds:/tmp/cc-socks/<pid>.sock`). `ListAgents` showed only
two of the five. **FB-021 belongs to another live session** — its file carries uncommitted edits
that name themselves *"session 20"*, and they are deliberately left uncommitted here.

## What session 21 found

### 🔴 A PORT'S METADATA CROSSES FIVE HAND-WRITTEN FIELD LISTS, AND FOUR DROPPED IT

Adding `placeholder` to a port — AC4, nominally the small half of the task — meant naming it in
`nodedefinition.registerInput`, `InputPortMetadata`, `nodelibraryexport.formatPort`,
`PropertyPanelInput`'s explicit prop hand-off, and `PropertyPanelTextInput`'s. Only list 3 was
already correct after the obvious edit.

⚠️ **ERG-004 documented list 3 and only list 3.** Its note in `nodelibraryexport.ts` explains at
length how a hand-copied duplicate deleted every output-port description in the library, and
concludes by delegating "so the same trap is not set for the next field". The trap was set four
more times in four other files. **`formatPort` is the famous list, not the first one** — list 1
runs earlier and drops the field before the export can see it.

🔴 **Every intermediate state read as *done* from the source.** Two files both correct, field
arriving `undefined`. Only the drive separated them. If you add a port field, expect five edits and
verify at the field, not at the export.

### 🔴 THE DRIVE FOUND WHAT 32 GREEN SPECS COULD NOT

The Import button lived inside the empty state. Import the first image → the empty state goes away
→ **the Import button goes with it**, and a second image can never be imported. Every spec arm had
rendered an *empty* picker, so the broken state was the one nothing looked at. Actions are a
permanent `ContentPicker` footer now, with three specs over non-empty and filtered-to-nothing.

✅ **AC3 was measured beside a known-firing signal.** 7 image files on disk, 3 listed — the two in
`assets/` plus `my.node_modules.backup/mine.png`. The lookalike folder proves segment matching
rather than substring; the two thumbnailed rows prove the walk *works*, so the four absent ones are
excluded rather than a loader that found nothing. "0 items" alone fits both readings.

### ⚠️ TWO INSTRUMENT TRAPS, BOTH NEW

1. **`cdp reload` does not recreate the viewer webview.** `http://localhost:8574/` is what runs
   `nodelibraryexport`, and it survives an editor reload holding the node library it loaded
   minutes earlier. Two *"the change did not work"* readings were that. `reload --target=viewer` is
   the already-known trap (it reloads the editor); reload the webview target over raw CDP.
2. **A native file dialog needs a TRUSTED click.** `<input type=file>.click()` requires transient
   user activation, so `el.click()` from `Runtime.evaluate` opens nothing — indistinguishable from
   an unwired button. `Input.dispatchMouseEvent` + `Page.setInterceptFileChooserDialog` +
   `DOM.setFileInputFiles`, all on **one** connection. The driver is in session 21's scratchpad
   pattern and is the only thing in this repo that answers a native dialog.

## First moves, in order

1. **FB-017** (L) — basics-first panel + per-node view state. It revives STYLE-004's deferral and
   is worth scoping before starting. FB-015's scope 3 deliberately left *"demote Source Set to the
   advanced tier"* to it, referenced rather than duplicated.
2. **FB-016** (M/L) — box-model overlay, transform-origin crosshair, radius-following highlight.
3. **FB-022** (M/L) — drag-to-scrub numeric fields; wants FB-017 in the same rows first.
4. ⚠️ **FB-021 is somebody else's right now.** Check `/tmp/cc-socks/` before touching it.
5. ⚠️ **Deliberate remainders**: FB-011's AC1 is superseded — reopening it is *"give the composer a
   second rendering"*, a real decision. FB-007's composer is still not driven in a browser, and
   `apisurfaces.ts`' `personProfile` still has its flat disc — **still nobody's decision**.
   FB-015's `getInspectInfo` change is specced by neither suite and not driven (it needs a running
   preview); its two middle editor hops are covered by the drive alone, since both components call
   hooks and `tests-unit` cannot render them.
6. **Still needing Richard**: FIX-026 (a)/(b), FIX-027 14/15/16 + 22, tsfixme baseline, prod
   `ANTHROPIC_API_KEY` (⚠️ intro pricing ends **2026-08-31** — one week), the 15 lessons' prose,
   Discord's row in the `?` menu, `/rfps` search.

## Found while working, owned by nobody

- ⚠️ **`FileSystem.chooseFile` had zero callers and an ignored `options` parameter**, so any caller
  would have got a JSON-only dialog whatever it asked for. It honours `options.accept` now,
  defaulting to the old behaviour. The 24th *build the caller*.
- ⚠️ **`getConnectionSourceLabel` returns nothing for the checkbox row** (s19's finding, unchased).
- ⚠️ **`npm run check:css` in `nodegx-community` still has ONE violation and it is still not ours**:
  `--site-avatar-ink`'s literal, added in `d205b47` (UNI-013), re-pointed by NAT-003. Left alone
  deliberately — the justification has to be NAT-003's.
- ⚠️ **The editor mirror never renders port DIRECTION** (`attachmentPorts` returns it,
  `CommunityThreadView` uses it only as a React key). Pre-existing.
- ⚠️ **The orphaned `AskAboutNodeDialog.module.scss` fix is STILL uncommitted**, belongs to no
  session, **not touched** for the third session running. Richard's call. Same for the phase-70/71/72
  working files.

## Gates, this tree (OpenNoodl, `cline-dev`) — 🔴 re-measure, never quote

- `npm run test:main`: **319 files / 5137 specs / 0 failures** (FB-015: 4 files, 38 specs).
  ⚠️ `bld-004/reasoningChannel` failed **once** under load — *"nothing arrived for 0 seconds"* —
  and passed 8/8 alone and in the clean run. A timing-sensitive stall detector, not a regression.
- `noodl-runtime`: **141 passed / 1 skipped, 2560 specs, 0 failures** (FB-015: 1 file, 6 specs).
- `noodl-viewer-react`: **75 files / 965 specs / 0 failures**.
- `typecheck:editor` / `:viewer` / `:runtime` / `:editor-tests` / `:mcp`: **0 errors**.
  `typecheck:core-ui`: **44**, all `TS2307`, all pre-existing, none in a touched file.
- ✅ The typechecker was **proved to see the new files** by planting an error in each
  (editor 2 → 0, viewer 1 → 0).
- **Not run** — nothing touched them: `test:ci` (the Electron suite), `noodl-core-ui`'s own suite,
  the whole `nodegx-community` side.

## Gates, `nodegx-community`

Unchanged since session 18 and **not re-run**: 58 files / 1398 specs / 0 failures, `tsc` clean,
`build` clean, `check:css` 1 pre-existing violation. nexus-1 serves `acd4a9a`; nothing is ahead of
the box. **FB-015 is editor-side and does not deploy** — it ships with the app.

## Session notes

- ✅ **The drive harness works as session 19 described it.** `npm run dev:debug -- --quiet` writes
  no `.logs/dev.log`; go straight to `npm run cdp -- health` once an `Electron . --dev` process
  appears. `__nodeGraphEditor` was the live graph again.
- ✅ **Open a project by path**: back up `~/Library/Application Support/NodeGX/
  recently_opened_project.json` (a `{recentProjects: [...]}` dict, ~3.7 MB of thumbnails), prepend
  a row, `cdp reload`, click `[data-test=launcher-project-card]`. Remove the row after `dev:stop`.
  Done; restored to **56 rows**, as found.
- ✅ **`dev:stop` spared 14 MCP/peer helpers** across both teardowns — verified by `ps` after, not
  assumed. ⚠️ A **launching** stack is invisible to `dev:stop --list` for ~75s, so "clean" at
  launch time is not proof nobody else is starting up. Announce the launch *and* the completion.
- Fixture kept: `NodeGX test projects/fb015-drive` — two Image nodes, images planted in
  `node_modules/`, `.cache/`, `.git/` and a `my.node_modules.backup/` lookalike.
