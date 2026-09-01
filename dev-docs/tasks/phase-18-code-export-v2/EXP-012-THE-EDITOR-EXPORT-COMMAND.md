# EXP-012 — The editor export command

**Status:** 🟢 **Built and driven, session 67 (2026-09-01). RULED: rides 0.2.2** (Richard, same day: *"I think it can ride 0.2.2"*). The editor-path export was then built — `npm run build` in the folder the button wrote, exit 0, `dist/assets/index-*.js` 235.64 kB — so AC7's caveat about the door is closed.
**Owner:** P18. **Opened by:** Richard, 2026-09-01 — *"Let's continue phase-18, if we make good
progress we can include it in the 0.2.2 launch."* A launch can only include what a user can reach,
and until this task `@nodegx/export` had **no consumer anywhere in the product** (EXP-011 §21.1) —
the only way to run an export was `ts-node scripts/emit-app.ts` by hand.

## Objective

An author with a project open in the editor exports it to a React repo from inside the editor,
sees exactly what will and will not translate **before** anything is written, chooses where it goes,
and is pointed at `EXPORT-REPORT.md` afterwards.

## What was built

| piece | file | what it does |
|---|---|---|
| the disk half | [`utils/codeExport/writeExport.ts`](../../../packages/noodl-editor/src/editor/src/utils/codeExport/writeExport.ts) | `checkTarget` refuses a folder inside the project and counts what an existing folder holds; `writeExport` writes `files` **and** `copies` (the channel §19.6 records a runner dropping). Import-free, takes `fs` as an argument |
| the command | [`utils/codeExport/exportReactCode.ts`](../../../packages/noodl-editor/src/editor/src/utils/codeExport/exportReactCode.ts) | refuses a legacy project with a migrate hint; **flushes the pending autosave** (the exporter reads disk); `parseProject` + `emitApp` + `summarizePreflight` in memory; pre-flight modal; native folder dialog; non-empty confirm; write; success toast with *Show in folder* on `EXPORT-REPORT.md`. Every failure is a toast, never a throw |
| the pre-flight | [`views/PopupLayer/CodeExportModal.tsx`](../../../packages/noodl-editor/src/editor/src/views/PopupLayer/CodeExportModal.tsx) + `PopupLayer.showCodeExportModal` | renders `PreflightSummary` **as data** — files, pages, components, assets, backend line, refusal count, the attention list, the no-file list — and the two honesty sentences. Re-derives nothing (§21.3's rule) |
| the surface | [`SettingsPanel/sections/CodeExportSection.tsx`](../../../packages/noodl-editor/src/editor/src/views/panels/SettingsPanel/sections/CodeExportSection.tsx) | Settings → Project tab, beside the deploy settings: *"Export as code"*, one button *"Export as React code…"* |
| the wire | `webpack.shared.js` alias `@nodegx/export` → `packages/nodegx-export/src`; `tsconfig.json` `paths` | exactly how `@noodl-core-ui` is reached; no package.json dependency, no build step |

## Acceptance criteria, and how each was graded

1. ✅ **The button exists and is reachable** — driven: Settings → Project tab lists *Export as code*
   with the button; `cdp click` on it opened the modal (a click that lands is the reachability proof).
   Screenshot in the s67 scratchpad, `exp012-settings.png`.
2. ✅ **The pre-flight is exact and writes nothing** — driven on `exp012-drive` (a renamed copy of
   `tests/fixtures/ticket-desk`): modal read *"14 files — 1 page, 0 components … Uses no backend … 1
   thing will not translate … `Pages/Ticket` — 1 refusal"*, which is `emit-app.ts --preflight`'s
   answer for the same project; the output folder **did not exist** while the modal was open.
3. ✅ **The write is the script's write** — with `FileSystem.instance.chooseDirectory` patched to hand
   back a scratch folder, confirm wrote **14 files**; `diff -r` against `emit-app.ts` run on the
   same copy: **IDENTICAL**. Toast: *"Exported exp012-drive — 14 files written to … 1 thing is left
   out — read EXPORT-REPORT.md first"*, with *Show in folder*.
4. ✅ **A folder inside the project is refused before anything is written** — patched the dialog to
   `<project>/out`: error toast *"Choose a different folder — That folder is inside the project…"*,
   no `out/` created, the earlier export's mtimes unchanged. Unit-graded too (9 rows in
   `tests-unit/exp-012/writeExport.test.ts`, real temp dirs, a non-UTF-8 asset copied byte-for-byte).
5. ✅ **A non-empty folder asks first** — driven: *"That folder is not empty — … already holds 8
   items. Files with the same names as the export's will be overwritten; nothing else is touched."*
6. ✅ **Gates** — editor `tsc -p tsconfig.json --noEmit` exit 0; `nodegx-export` tsc 0 and jest
   **1248/1248** in 49 suites; the new tests-unit spec 9/9.
7. ⬜ **Not graded: the legacy-project refusal and the save-flush.** Both are two lines with no
   branch a drive on a v2 fixture can reach; the flush is `flushPendingProjectSave()` awaited before
   `parseProject`, and the drive's export carried the graph the editor's load patch had just added
   (the registry went 6 → 7 connections on open, and the export had 7).

## 🔴 What this session found, in the order it would save the next one time

- 🔴 **The editor compiles `@nodegx/export` under its own, non-strict tsconfig, and ten narrowing
  sites in `plan.ts` only typed under `strictNullChecks`.** `x !== null && 'defer' in x` narrows
  nothing in the false branch without strict null checks, so every consumer of the value became a
  type error in the editor's `tsc` — and only there; the package's own strict `tsc` stayed 0. Fixed
  with one type predicate, `isDefer()`, whose false branch removes the `{ defer }` member in both
  modes. ⚠️ **Any future exporter code is compiled twice, under two strictness settings**; the
  editor's `tsc` is the gate that sees the second.
- ⚠️ **Truthiness does not narrow a discriminated union in the editor either** — `if (!verdict.ok)`
  failed to narrow `TargetVerdict` in `tests-unit/` (ts-jest uses the editor's tsconfig);
  `verdict.ok === false` does.
- 🔴 **A peer's edit hot-reloads YOUR running editor.** Two `[HMR] Updated modules` events landed
  mid-drive (a P77 peer editing `site-builder.content.json`), each followed by *"Attempted to
  synchronously unmount a root while React was already rendering"* — those are HMR's, not this
  code's (`showReactModal` defers its unmount with `setTimeout`). The settings panel re-rendered and
  lost the stamped attribute, so a `cdp click` by that attribute read *"no element matching"*.
  ✅ Re-stamp and re-read after any HMR line; count the flow with a patched `chooseDirectory`
  (`window.__chooseCalls`) so a re-run is distinguishable from a second write.
- ⚠️ **One observation is unexplained and recorded as such.** Between two reads, while the
  non-empty confirm modal was open and the HMR update landed, every file in the scratch export was
  rewritten (all 14 mtimes 21:20:53) — the *Overwrite and export* path ran, the counter says no
  third flow started, and nothing in `hideModal`/`hideAllModalsAndPopups` calls `onConfirm`. A clean
  re-run of the arm did not reproduce it. Consequence in the wild: re-writing an export the author
  had already confirmed, with identical content. Owner `NONE`; **dev-only until reproduced without
  HMR**.
- ⚠️ **`filesystem.js` is CommonJS** — `__req(...)` returns the object itself, `.default` is
  undefined. A patch through `.default` throws silently inside a one-line eval and the *previous*
  patch stays live, which is how the non-empty arm ran when the inside-project arm was intended.
- ⚠️ `readdirSync` counts dotfiles: the folder the modal called *"8 items"* shows 7 in `ls`.
- ✅ **The peer's uncommitted catalog hunks sat in the same files as mine.** `node-catalog.json`
  carried a Text Input placeholder change from a peer's working tree; `node-catalog-enriched.json`
  carried *only* theirs. Committed the Substring hunk alone via a filtered patch, and left the
  enriched file out.

## Still open, and honestly small

- **EXP-004's in-editor post-export report with drill-down** is still a toast plus the file. The
  pre-flight modal now *is* an in-editor surface, so §21.1's "blocked" is over; the drill-down panel
  is a UX decision, owner `NONE`.
- **A launcher entry** (export a project without opening it — `parseProject` reads disk, so it
  needs no open project) — three files, not done. Owner `NONE`.
- **A keyboard shortcut** — none assigned. `Cmd+Shift+E` is taken by the component export.
- **Whether it rides 0.2.2** — Richard's decision; see the NEXT-SESSION-PROMPT.
