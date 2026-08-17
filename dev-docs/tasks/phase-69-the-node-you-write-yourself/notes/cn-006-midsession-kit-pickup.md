# Does a kit scaffolded mid-session reach the picker without a manual reload?

**Measured 2026-08-17, session 15, on an undisturbed tree.** This has been carried as "deliberately
not claimed" since **CN-006 s11**, where peers were editing the tree and HMR was reloading the viewer
frame for unrelated reasons, so any pickup could have been someone else's reload. It also bears
directly on **CN-014**, whose spec says *"`noodl-preview`'s watcher does not exclude `noodl_modules`,
so it may already work there — measure before specifying."*

## Conditions

Editor launched by this session; no peer stack (9222 was free); no repo **source** edited during the
window (the only repo writes were a test file and a JSON fixture, neither in the editor's webpack
entry). `window.__req` survived every eval from launch to teardown, which is the cheap evidence that
**no HMR reload wiped the renderer** — the trap that made s11's reading unusable.

## The measurement

Project open: the `kit-app` fixture copied to a scratchpad. Baseline: `ProjectModel.modules` =
`['demo-kit']`, library kit groups = `['Demo Kit']`, 177 node types.

`writeKitScaffold(projectDir, { name: 'Midsession Kit' })` — a real kit written to
`noodl_modules/midsession-kit/` while the project stayed open.

| when | `midsession-kit.StatTile` in the library? | groups | types |
|---|---|---|---|
| immediately after the write | **no** | `['Demo Kit']` | 177 |
| t+5s … t+30s, polled every 5s | **no**, all six polls | `['Demo Kit']` | 177 |
| **after a viewer reload** | **yes** | `['Demo Kit', 'Midsession Kit']` | **178** |

## What this settles

🔴 **No watcher picks it up.** Thirty seconds is far past any debounce, and neither
`ProjectModel.modules` nor the node library moved. **CN-014's hypothesis is false for the editor's
preview path** — the watcher does not deliver a newly scaffolded kit, so CN-014 has real work to do
rather than a behaviour to document.

✅ **A viewer reload is sufficient** — one reload, no editor restart, no re-open of the project. So
`KitsSection`'s instruction to reload by hand is *necessary and sufficient*, which is worth stating
positively: the rough edge is that you must know to do it, not that the recovery is expensive.

✅ **Free corroboration for CN-018:** the reloaded library named the brand-new kit correctly and
immediately (`'Midsession Kit'`, its own group). The naming is not a property of the hand-built
fixtures — see [cn-018-picker-drive.md](cn-018-picker-drive.md).

⚠️ **Not measured:** whether `ViewerConnection.sendRefresh()` would have delivered it if it were
alive. It is dead at both ends (sends `cmd:'refresh'`, the runtime emits `'reload'`, nothing listens),
so this measurement is about the world as shipped, not about that seam.

## A finding for CN-008, found in the same drive

🔴 **The scaffold emits no `docs` string at all.** `packages/nodegx-kit-scaffold/src/index.js`
contains no `docs` key, so a scaffolded node's picker preview reads **"No documentation yet."** —
observed on both `Harbour Metrics` and `Wren Analytics`.

**This undercuts a CN-008 premise.** That task plans to include, per node, *"what it is for (the
`docs` string authors already write)"*. Authors do **not** already write one on the path the phase
itself tells them to start from; the cashflow kit has `docs` on every node because it was
hand-written. CN-008 should either treat `docs` as usually-absent (and say what it does instead), or
CN-006's scaffold should emit one — which is also the P2-shaped answer, since the scaffold is meant to
model good practice.
