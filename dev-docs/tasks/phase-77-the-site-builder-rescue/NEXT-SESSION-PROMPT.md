# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## State: **s25 met AC1's deployed half — the last ⬜ on SBR-007's strongest AC — and serving a real deploy folder found a product defect in the backend that had nothing to do with this screen.**

Read in this order:

1. **[SBR-007 §25–§29](SBR-007-THE-PAGE-EDITOR.md)** — the drive, the instrument, and the census
   that proves the export filter was actually running.
2. **[D21](DEFECTS-THE-SITE-BUILDER-FOUND.md)** — cross-origin auth, fixed and driven, **including
   the two wrong readings it took to get there.** Read that part even if the fix does not interest
   you; both mistakes are ones the phase is prone to.

---

## 🔴 FIRST JOB — two open, and neither is an afternoon

### (a) AC2 — still a design decision

`Drag` gives position and deltas but **no hit test**, and reordering renumbers *siblings* — a row
knows only its own id and there is **no loop node**. Wants a cloud function taking
(pageId, id, toIndex). Unchanged since s22.

### (b) D20 — a decision, and it may not be a template change

The `Editing · <title>` heading never shrinks and never wraps. Ellipsize, wrap, or accept. 🔴 The
ellipsize option probably needs `layout.ts` — the runtime opts a node into `flexShrink: 1` only via a
percentage size along the parent's direction — so this may be a **product** row wearing template
clothes. Decide which before building.

### 🔴 And the one nobody owns

**D15** — no drop-target capability in the runtime, so **AC3 is not met and phase 77 must not close
pretending it is.** Still `NONE`. So are **D13**, **D16**, making `test:main` watched (D19), and the
`ports: []` exposure on the **browser** deploy path (`build/deployer.ts`, end of D14).

---

## ✅ The instruments — there are now two, and they answer different questions

🔴 **Pick by what is being asked, not by which one you used last.**

| question | tool |
|---|---|
| does it *lay out* / render correctly | `render-from-disk.js` + `withRenderedPage` (§20) |
| does the thing a person **deploys** work | `deploy-from-disk` + `drive-deployed.js` (§26) |

`render-from-disk` reconstructs the export contract **by hand** — nothing it serves has been through
`Exporter.exportToJSON`. It cannot answer a deploy question and answering one with it would be a
green that means nothing.

```
# build once (mirrors noodl-preview/build.mjs)
node scripts/devtools/build-deploy-from-disk.mjs /tmp/deploy-from-disk.cjs

# 🔴 cwd MUST be packages/noodl-editor — `getAppPath()` returns cwd, and the deploy
#    index lives at <appPath>/src/external/deploy/index.json
cd packages/noodl-editor
node /tmp/deploy-from-disk.cjs <v2-project-dir> --out <folder> [--endpoint URL] [--sabotage]

node scripts/devtools/drive-deployed.js <folder> [--port N] [--hold]
# or, driven: withDeployedSite({dir, port, backendPort}, fn) -> evaluate/navigate/setViewport/screenshot/client
```

- ✅ **`--sabotage` wires a connection to a port that does not exist.** If the census does not report
  it dropped, the health filter did not run and **every other reading in that run is void**. Use it.
- 🔴 **`--endpoint` deploys to a different *environment*, and `json.ts:121` replaces the whole
  `cloudservices` block** — `appId` and `type` are carried from the project's metadata for you. Omit
  that and the app authenticates against nothing.
- ⚠️ **What it cannot see**: the editor's Deploy popup. It calls this same `deployToFolder`, so what
  is unmeasured is that UI, not the export.

## 🔴 The trap that cost this session most, and will cost the next one too

**A headless export's health filter fails OPEN, silently.**

`exportComponent` drops connections `getConnectionHealth` calls unhealthy; that predicate reads no
ports, asks `WarningsModel` for a *currently recorded* warning, and answers **healthy when nothing
has been evaluated**. `graph.evaluateHealth()` does not repair it by itself — it has four early
returns and takes them without a word. Headlessly it takes `isModuleRegistered(project)` on **every**
component, because registering the open project is something only the editor does.

So the tool reported *"22 components evaluated"* — counting **calls** — while the number actually
evaluated was **0**, and a deliberately broken wire was written into the deployed bundle. One line
(`NodeLibrary.instance.registerModule(project)`) fixes it. **Counting invocations is not counting
effects**, and a filter that fails open produces exactly the answer you were hoping for.

## 🔴 What this session paid for, beyond the fix

- **A capture filtered by URL attributes nothing to a producer.** `POST /login → 200` was recorded
  beside the node reporting failure and written down as *"the backend authenticated and the panel
  lied"*. The 200 was **the probe's own control `fetch`**, fired moments later at the same URL. A
  probe that adds traffic to the surface it measures must exclude itself before it reads. Timestamps
  and `loadingFailed` are what separated them.
- **A theory that reproduces the symptom exactly can still be the wrong cause.** A
  `credentials: 'include'` pair reproduced `ERR_FAILED` perfectly. `corsErrorStatus` was in the
  payload the whole time and named something else. Fits ≠ excludes.
- **A backend runs from `dist/`.** The source fix was invisible to the drive until
  `npm --prefix packages/nodegx-backend run build`. Same trap as the viewer bundle, different package.
- **Same-origin never preflights**, which is why every AC1 arm before this one — s22's included —
  was taken where D21 cannot appear. Preview and deploy differ in more than the exporter.

---

## Where the phase now stands

| | verdict |
|---|---|
| **SBR-005** | ⬜ open — **and it owns AC3's gallery model** |
| **SBR-006** | AC1/2/4/5 ✅ · **AC3 🟡** — `Unpublish` is the one act of three still undriven |
| **SBR-007** | 🟢 **AC1 ✅ BOTH HALVES (s25)**, AC4 ✅, AC5 ✅ · **AC2 ⬜**, AC3 split · D18 ✅ · **D20 🔴** |
| **SBR-008** | ✅ all five, s18 |
| **SBR-015** | AC1/2/3 ✅ s13 · **AC4** 🟡 re-read: DEF-004(a) now writes a step per action |
| **SBR-016 / SBR-017** | ✅ s14/s15 |
| **D13** | 🔴 open, `NONE` |
| **D14** | 🟢 fixed s20, DRIVEN s22 |
| **D15** | 🔴 `NONE` — no drop-target capability in the runtime |
| **D16** | ⚠️ `NONE` |
| **D17** | 🟢 fixed s21, DRIVEN s22 |
| **D18** | 🟢 fixed s23, DRIVEN s24 |
| **D19** | 🟢 reds fixed s23 — 🔴 **making `test:main` watched is still `NONE`** |
| **D20** | 🔴 open s24, `NONE` — the title the fix cannot reach |
| **D21** | 🟢 **NEW s25, FIXED + DRIVEN** — product, `nodegx-backend/src/ops/headers.ts` |
| **also unowned** | the `ports: []` exposure on the **browser** deploy path (`build/deployer.ts`) |

## Standing context

- ✅ **Fixture: `SBR-007 Page Editor Drive`**, backend `backend_mterfnli74qwv`, port **8601**,
  `SITE_SETUP_TOKEN=drive-token-007`, `owner@sbr007.test` / `drive-pass-007`. Page
  `e921dd5b-93a5-40e4-bb75-75c37da395c0`, slug `drive-007`.
  🔴 **s25 drove a COPY of the backend data**, not the fixture — `cp -R ~/.noodl/backends/<id>` and
  serve that. The fixture's own rows are untouched and its project is **still the pre-D18 control
  arm**. Keep it that way.
- 🔴 **The page title in the copied data now reads `Cross Origin Retitle 002`**, not
  `Retitled By The Drive`. That is the s25 drive's own doing, in the copy only.
- ✅ **The setup token is a file, not a UI step**: `~/.noodl/backends/<id>/secrets.json`, `functions`
  namespace. `SecretsStore` re-reads on every call, so no restart.
- ✅ **The template is generated, not authored.** Edit
  `packages/noodl-mcp/tests/sb00{4,5,6}Components.ts`, then `npm run template:site-builder`.
  `sb007Template.test.ts` asserts the committed artefact is byte-identical to a fresh generation.
- 🔴 **A source change is not a drive until the bundle carries it** — the viewer
  (`external/viewer/noodl.viewer.js`), the deploy runtime (`external/deploy/noodl.deploy.js`, and it
  is a *different file*), and now `nodegx-backend/dist`. Grep for your symbol before the act.
  A **template** change is different — it is project data, read from disk every boot.
- ✅ **Reaching the editor's models headlessly**:
  `window.webpackChunknoodl_editor.push([['probe'], {}, (r) => { window.__wr = r; }])`, then
  `__wr('./src/editor/src/models/projectmodel.ts').ProjectModel.instance`.
- ✅ **Driving the viewer**: `Noodl.Navigation.navigateToPath('/admin/pages')`; wrap every `cdp eval`
  in `(() => { … })()`; **stamp in one call and click in the next**. `cdp type` clicks first, so it
  cannot replace a field's value. Stamping through
  `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set` + `input`/`change` does
  reach the graph — s25 confirmed it by watching the request the graph then made.
- 🔴 **`cdp.js` and `render-report.js` both export `connect`, `evaluate` and `httpJson`, and they are
  DIFFERENT FUNCTIONS.** `cdp.js`'s `connect` takes the **target object** and registers listeners via
  `client.on(fn)`; its `httpJson` is bound to a fixed port and takes `(path, opts)`. Calling the
  wrong one reads as *"Chrome never opened a debugging port"*. Also: wait for a target of type
  **`page`**, not merely for `/json/list` to answer — it answers first with only `browser_ui` rows.
- 🔴 `closest('[class*=Card]')` matches the *Name* span — use `[class*=__Card--]`. The admin buttons
  are `BUTTON.ndl-controls-button` and **the button is the leaf**.
- 🔴 `getConnectionHealth` and `evaluateConnectionHealth` take OPPOSITE spellings on one class.
  Prefer `exportComponent`. Force `graph.evaluateHealth()` before reading health or exporting —
  **and register the project module first, or it does nothing.**
- Shared checkout: **pathspec commits only, never `git add` to stage**; `git status --porcelain |
  grep '^??'` before committing. Announce editor launches **and** teardowns. `test:ci` alone.
- 🔴 **How you type a path decides whether a launch sweep reaps your backend** (peer, s25):
  `node /abs/path/.../cli.js serve …` is a sweep target; `node packages/nodegx-backend/dist/cli.js
  serve …` is not. The relative form also means a real orphan survives every `dev:stop` forever.
  `node -e "require('./scripts/devtools/dev-processes.js').sweep({dryRun:true, onLog:console.log})"`
  kills nothing and lists what a launch would take.
- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
