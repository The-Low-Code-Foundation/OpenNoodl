# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## State: **s24 drove D18 without an editor and found the defect was larger than its own row said. Two of the three open jobs are unchanged; the third is closed.**

Read in this order:

1. **[SBR-007 §20–§24](SBR-007-THE-PAGE-EDITOR.md)** — the drive, the control that licensed it, and
   the threshold correction.
2. **[D20](DEFECTS-THE-SITE-BUILDER-FOUND.md)** — the residual D18's fix cannot reach. `NONE`.

---

## 🔴 FIRST JOB — two open, and one of them is now the cheapest thing in the phase

### (a) AC1's deployed half — the last ⬜ on an otherwise-met AC

Unblocked since SBR-008 closed at s18. **Not attempted at s22, s23 or s24.** Deploy the fixture to a
folder, serve it, claim, retitle, save, read the public heading — the same oracle §12.1 used.
⚠️ **Do not reuse the preview reading as evidence**: SBR-008 §8 says its AC1 drive was the *preview*
caller and the deploy half is inferred from §5.3.

⚠️ Known unowned hole beside it: the `ports: []` exposure on `build/deployer.ts` (end of D14). If
publish or duplicate throws `Outputs.<x> is not a function` **on the deployed panel** while
succeeding in preview, that is that row, and it is worth more than finishing AC1 that day.

✅ **s24 makes this cheaper than it was.** You may not need the editor at all — see "the instrument"
below. A deploy still does, but the *reading* afterwards does not.

### (b) AC2 — still a design decision, not an afternoon

`Drag` gives position and deltas but **no hit test**, and reordering renumbers *siblings* — a row
knows only its own id and there is **no loop node**. Wants a cloud function taking
(pageId, id, toIndex). Unchanged since s22.

### (c) D20 — a decision, and it may not be a template change

The `Editing · <title>` heading never shrinks and never wraps. Ellipsize, wrap, or accept. 🔴 The
ellipsize option probably needs `layout.ts` — the runtime opts a node into `flexShrink: 1` only via a
percentage size along the parent's direction — so this may be a **product** row wearing template
clothes. Decide which before building.

---

## ✅ The instrument, because it changes what "blocked on the editor" means

A peer has held 9222 and `:8574` for **three consecutive sessions** (s22, s23, s24). s24 stopped
waiting for it:

```
node scripts/devtools/render-from-disk.js <v2-project-dir> --port <free> --backend-port <backend>
```

or, driven, `withRenderedPage({projectDir, backendPort}, fn)` from
`scripts/devtools/render-report.js` — it spawns the server, a headless Chrome on a **free** CDP port
(so no 9222 fight), and hands you `evaluate` / `navigate` / `setViewport` / `client`.

- ✅ It serves **`packages/noodl-editor/src/external/viewer/noodl.viewer.js`** — the same bundle the
  editor's viewer runs. That is why the control arm could reproduce §14.
- ✅ Backends run standalone: `node packages/nodegx-backend/dist/cli.js serve --data-dir
  ~/.noodl/backends/<id> --port <p> --backend-id <id> --project-dir <dir>`. **Use an absolute path
  to `cli.js`** — a relative one fails `MODULE_NOT_FOUND` if the shell cwd has moved.
- ✅ Sign in headlessly: set the input's value through
  `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set`, dispatch `input` +
  `change`, then click **`[...document.querySelectorAll('button')].find(b => text === 'Sign in')`**.
  🔴 Not the first *leaf* with that text — that is the heading, and clicking it silently leaves you
  signed out with the page still rendering a header row.
- ⚠️ **What it cannot see**: the editor's preview pane, its chrome, `ViewerConnection`. It is
  evidence about the runtime and the project data, not about the editor's own framing.
- 🔴 **Announce and tear down anyway.** A peer measured `sweep({dryRun:true})` mid-session and found
  my two backends were in its blast radius. Ports are cheap; a killed peer is not.

---

## 🔴 What this session paid for

- **A control arm that must reproduce a recorded reading is what catches a broken instrument.** The
  first probe measured `saveButton.parentElement`, reported a 1136 px "button" hit-testing `SELF` at
  600 px, and reads exactly like *"the defect does not reproduce."* Nothing about it looked wrong.
  It was caught **only** because the control disagreed with §14's recorded numbers. A fix-only arm
  would have shipped the opposite conclusion with a clean conscience. (§16 paid for this one session
  earlier, on a different element of the same probe. It is a habit, not an incident.)
- **A threshold measured on a fixture is a fact about the fixture.** D18's own heading carried
  *"below 897 px"*. The row's width is `sidebar + title + pill + buttons`, and the title is the only
  term a user controls: at 56 characters, `Save page` is unreachable **at 1440**. §17 had already
  written down that the graded property was *"a width the template cannot know"* — the number in the
  heading contradicted the sentence in the gate, and nobody reconciled them.
- **Vary one thing, and take the other side from the artefact rather than your hands.** The two arms
  were project copies whose only difference was the three lines of `10b26d57`'s diff, read out of
  `site-builder.content.json` at HEAD. `diff -r` over the trees is the evidence, not a claim.
- **Name what a measurement cannot see, in the same breath.** §23 exists so the next reader does not
  relay "D18 is driven" as "driven in the editor".

---

## Where the phase now stands

| | verdict |
|---|---|
| **SBR-005** | ⬜ open — **and it owns AC3's gallery model** |
| **SBR-006** | AC1/2/4/5 ✅ · **AC3 🟡** — `Unpublish` is the one act of three still undriven |
| **SBR-007** | 🟢 AC1 (preview) ✅, AC4 ✅, AC5 ✅ · **AC1 deployed ⬜**, AC2 ⬜, AC3 split · **D18 ✅ DRIVEN s24** |
| **SBR-008** | ✅ all five, s18 |
| **SBR-015** | AC1/2/3 ✅ s13 · **AC4** 🟡 re-read: DEF-004(a) now writes a step per action |
| **SBR-016 / SBR-017** | ✅ s14/s15 |
| **D13** | 🔴 open, `NONE` |
| **D14** | 🟢 fixed s20, DRIVEN s22 |
| **D15** | 🔴 `NONE` — no drop-target capability in the runtime |
| **D16** | ⚠️ `NONE` |
| **D17** | 🟢 fixed s21, DRIVEN s22 |
| **D18** | 🟢 **fixed s23, DRIVEN s24** — severity raised, not confirmed |
| **D19** | 🟢 reds fixed s23 — 🔴 **making `test:main` watched is still `NONE`** |
| **D20** | 🔴 **new s24**, `NONE` — the title the fix cannot reach |
| **also unowned** | the `ports: []` exposure on the **browser** deploy path (`build/deployer.ts`) |

🔴 **D15 is still unowned and phase 77 must not close pretending AC3 was met.**

## Standing context

- ✅ **Gates, s24, naming the runner and the tree**: `noodl-editor` **`test:main` 383 suites / 6377
  tests / exit 0 at `af3b696d`**. (s23 read 363/6105 — peers landed four commits mid-session, so the
  counts moved; that is drift, not a regression.) 🔴 **`test:ci` was NOT run — a peer held the editor
  for the third session running.** Its last known floor is s21's **2894 specs, 4 failures, all four
  `AIX-006 style vocabulary` by name**; re-read it before trusting it and **quote a tree, not a
  seed**. 🔴 **No source changed this session** — docs and four PNGs only.
- 🔴 **Check `ps` before `test:ci` or a launch**, and expect the editor to be taken. Two editors
  cannot share 9222. A peer launched for phase 80 DEF-015 at the end of s24.
- ✅ **Fixture: `SBR-007 Page Editor Drive`**, backend `backend_mterfnli74qwv`, port **8601**,
  `SITE_SETUP_TOKEN=drive-token-007`, `owner@sbr007.test` / `drive-pass-007`. Published page
  `e921dd5b-93a5-40e4-bb75-75c37da395c0` (`Retitled By The Drive` / `drive-007`) plus a draft copy.
  🔴 **Still minted from the pre-D18 template** — s24 deliberately did not re-mint it, because
  keeping the pre-fix row is what makes it a usable control. **It is the control arm now; treat it
  as one.**
- ✅ **The setup token is a file, not a UI step**: `~/.noodl/backends/<id>/secrets.json`, `functions`
  namespace. `SecretsStore` re-reads on every call, so no restart.
- ✅ **The template is generated, not authored.** Edit
  `packages/noodl-mcp/tests/sb00{4,5,6}Components.ts`, then `npm run template:site-builder`.
  `sb007Template.test.ts` asserts the committed artefact is byte-identical to a fresh generation.
- ✅ **`EmbeddedTemplateProvider.install` carries a node's `parameters` through verbatim** — measured
  s24 by comparing the installed fixture's header row against the pre-fix artefact. That is what
  lets an artefact-level assertion stand in for "an installed project would have this".
- ✅ **The artefacts are the cheapest oracle in this phase.** `~/.noodl/backends/<id>/data/local.db`,
  `executions.sqlite` at the backend **root**, `workflows/*.workflow.json`, and
  `<project>/components/__cloud__/<fn>/nodes.json`.
- 🔴 **A source change is not a drive until the bundle carries it.** Grep
  `packages/noodl-editor/src/external/viewer/noodl.viewer.js` for your symbol immediately before the
  act. (A *template* change is different — it is project data, and `render-from-disk` reads it from
  disk every boot.)
- ✅ **Reaching the editor's models headlessly**:
  `window.webpackChunknoodl_editor.push([['probe'], {}, (r) => { window.__wr = r; }])`, then
  `__wr('./src/editor/src/models/projectmodel.ts').ProjectModel.instance`.
- ✅ **Driving the viewer**: `Noodl.Navigation.navigateToPath('/admin/pages')`; wrap every `cdp eval`
  in `(() => { … })()`; **stamp in one call and click in the next**. `cdp type` clicks first, so it
  cannot replace a field's value.
- 🔴 `closest('[class*=Card]')` matches the *Name* span — use `[class*=__Card--]`. The admin buttons
  are `BUTTON.ndl-controls-button` and **the button is the leaf**: its `parentElement` is the whole
  header row, and probing that instead is how s24 nearly filed a non-reproduction.
- 🔴 `getConnectionHealth` and `evaluateConnectionHealth` take OPPOSITE spellings on one class.
  Prefer `exportComponent`. Force `graph.evaluateHealth()` before reading health or exporting.
- Shared checkout: **pathspec commits only, never `git add` to stage**; `git status --porcelain |
  grep '^??'` before committing. Announce editor launches **and** teardowns. `test:ci` alone.
- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
