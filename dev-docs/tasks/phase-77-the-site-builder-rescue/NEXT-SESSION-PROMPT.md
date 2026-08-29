# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## State: **s26 closed D20 by measuring the runtime instead of asking for a ruling — and the gate that had been grading D18 was quietly asserting something false.**

Read in this order:

1. **[SBR-007 §30](SBR-007-THE-PAGE-EDITOR.md)** — the disposition, both arms, the short-title
   control, and §30.7 on the gate.
2. **[D20](DEFECTS-THE-SITE-BUILDER-FOUND.md)** closed, **[D22](DEFECTS-THE-SITE-BUILDER-FOUND.md)**
   new and `NONE`.

---

## 🔴 FIRST JOB — one build, one ruling, and a red that is not ours

### (a) AC2 — the last unmet AC that is actually buildable

Unchanged since s22 and untouched by s26. `Drag` gives position and deltas but **no hit test**, and
reordering renumbers *siblings* — a row knows only its own id and there is **no loop node**. Wants a
cloud function taking (pageId, id, toIndex). **This is the one remaining piece of SBR-007 that a
session can simply build.**

### (b) 🔴 Richard's, and it is small: D20's fix moved the actions

The heading now grows as well as shrinks — `layout.ts` assigns `flexGrow` and `flexShrink` in the
same branch, so there is no third option — which puts `Preview`/`Save page` at the **right** of the
header rather than clustered beside the title. Everything is legible at every width and nothing is
clipped; the question is only whether that look is wanted. **Two parameters revert it**
(`sizeMode: 'contentSize'`, drop `width`) at the cost of putting D20 back.

### 🔴 (c) The template gate is RED and it is a PEER's, not this lane's

`sb007Template.test.ts` → *"regenerating from the component sets reproduces the committed file byte
for byte"* fails with:

```
first difference at line 139:
  committed:     "ports": [],
  regenerated:   "ports": [
```

That is a `JavaScriptFunction` in **`/Site/NavLink`** — nowhere near this session's change, whose
entire artefact diff is **5 insertions / 1 deletion in the `/Pages/PageEditor` heading**. The cause
is a peer's in-flight work: **`packages/noodl-mcp/src/tools/author.ts` is modified and
`packages/noodl-mcp/src/scriptPorts.ts` is UNTRACKED**, adding `withAuthoredScriptPorts`, which
derives ports from `functionScript` and changes what the door writes. **Whoever owns that change
owes a `npm run template:site-builder` and a re-commit of the artefact.**

⚠️ **Three further cases in that file oscillate between passing and failing across runs** (4 failed
↔ 1 failed over five runs, all three going through `create_component`). Do not attribute them
without re-running — and do not attribute them to your own change either.

🔴 **A theory that fits is not one that excludes.** `scriptPorts.ts` contains **two literal NUL
bytes** (a raw `\0` written into a template literal as a key separator instead of the escape), which
makes `git grep` report it as `Binary file … matches` and plain `grep` find **nothing at all** — the
recorded six-ways-grep-lies trap. That looked like an excellent explanation for a
`withAuthoredScriptPorts is not defined` error seen early in the session. **It was wrong**: the
module loads fine and the error has not recurred. The NUL is worth fixing because it makes the file
unsearchable, not because it broke anything.

### 🔴 And the ones nobody owns

**D15** — no drop-target capability in the runtime, so **AC3 is not met and phase 77 must not close
pretending it is.** Still `NONE`. So are **D22** (new — no `textOverflow` port on `Text`), **D13**,
**D16**, making `test:main` watched (D19), and the `ports: []` exposure on the **browser** deploy
path (`build/deployer.ts`, end of D14).

---

## ✅ The instruments — there are now two, and they answer different questions

🔴 **Pick by what is being asked, not by which one you used last.**

| question | tool |
|---|---|
| does it *lay out* / render correctly | `render-from-disk.js` + `withRenderedPage` (§20, §30) |
| does the thing a person **deploys** work | `deploy-from-disk` + `drive-deployed.js` (§26) |

`render-from-disk` reconstructs the export contract **by hand** — nothing it serves has been through
`Exporter.exportToJSON`. It cannot answer a deploy question.

```
# layout drive (s26's shape) — two arms, one backend copy, six viewports
cp -R ~/.noodl/backends/backend_mterfnli74qwv <copy>       # never serve the fixture's own rows
node packages/nodegx-backend/dist/cli.js serve --data-dir <copy> --port 8601
node <probe>.js <project-dir>                              # withRenderedPage({projectDir, backendPort: 8601})

# deploy drive
node scripts/devtools/build-deploy-from-disk.mjs /tmp/deploy-from-disk.cjs
cd packages/noodl-editor && node /tmp/deploy-from-disk.cjs <v2-project-dir> --out <folder> [--endpoint URL] [--sabotage]
node scripts/devtools/drive-deployed.js <folder> [--port N] [--hold]
```

- ✅ **`--sabotage` wires a connection to a port that does not exist.** If the census does not report
  it dropped, the health filter did not run and **every other reading in that run is void**.
- 🔴 **A headless export's health filter fails OPEN, silently** —
  `NodeLibrary.instance.registerModule(project)` first, or `evaluateHealth()` bails on every
  component without a word and a sabotaged wire deploys. *"22 components evaluated"* counted
  **calls**; the number evaluated was **0**.
- 🔴 **`--endpoint` deploys to a different *environment*, and `json.ts:121` replaces the whole
  `cloudservices` block.**

## 🔴 What this session paid for, beyond the fix

- **A `sizeMode` cannot tell you whether a node shrinks, and a gate that thinks it can goes green
  while lying.** `layout.ts:82` opts a node in only via a **percentage size along the parent's
  direction** — so `contentHeight` shrinks or does not depending on a *different* parameter. The
  D18 grader had `contentHeight` in its `NON_SHRINKING` list and called a node measuring
  `flexShrink: 1` non-shrinking. **The literal never moved; the sentence beside it stopped being
  true.** That is this suite's recorded failure mode and it recurred.
- **A mutant can stop testing anything without ever going red.** Dropping `flexWrap` used to redden
  the grader; after D20 it does not, because a shrinkable heading reflows the row without wrapping.
  A mutant only proves something while the thing it removes is still the *only* load-bearing lever.
- 🔴 **`find(n => n.id === '<authored id>')` over a whole artefact is not a lookup, it is a
  coincidence.** The door rewrites ids on write — `heading` ships as `heading-2` — so both mutants
  matched a node in an unrelated component and mutated nothing, staying green. **Resolve through
  the parent's own `children`.**
- **A dimension port given a bare `'60%'` string is accepted in silence and renders at content
  width.** The first fixed arm read `flexShrink: 0` and 965 px and looked like a refuted fix. Ports
  take `{value, unit}` — D8/F15's family, met from the authoring side this time.
- **Controls before findings, again, and again it mattered.** The `textOverflow` absence check first
  returned 0 for the finding *and both controls*, because a quoted shell variable holding two paths
  is not word-split by zsh. Same trap D15 recorded.

---

## Where the phase now stands

| | verdict |
|---|---|
| **SBR-005** | ⬜ open — **and it owns AC3's gallery model** |
| **SBR-006** | AC1/2/4/5 ✅ · **AC3 🟡** — `Unpublish` is the one act of three still undriven |
| **SBR-007** | 🟢 AC1 ✅ both halves, AC4 ✅, AC5 ✅ · **AC2 ⬜**, AC3 split · D18 ✅ · **D20 ✅ s26** |
| **SBR-008** | ✅ all five, s18 |
| **SBR-015** | AC1/2/3 ✅ s13 · **AC4** 🟡 re-read: DEF-004(a) now writes a step per action |
| **SBR-016 / SBR-017** | ✅ s14/s15 |
| **D13** | 🔴 open, `NONE` |
| **D14** | 🟢 fixed s20, DRIVEN s22 |
| **D15** | 🔴 `NONE` — no drop-target capability in the runtime; **AC3 cannot be met** |
| **D16** | ⚠️ `NONE` |
| **D17 / D18 / D21** | 🟢 fixed and driven (s21/s24/s25) |
| **D19** | 🟢 reds fixed s23 — 🔴 **making `test:main` watched is still `NONE`** |
| **D20** | 🟢 **FIXED + DRIVEN s26**; the appearance half is Richard's |
| **D22** | 🔴 **NEW s26, `NONE`** — no `textOverflow` port on `Text`, so ellipsis is unauthorable |
| **also unowned** | the `ports: []` exposure on the **browser** deploy path (`build/deployer.ts`) |

## Standing context

- ✅ **Fixture: `SBR-007 Page Editor Drive`**, backend `backend_mterfnli74qwv`, port **8601**,
  `SITE_SETUP_TOKEN=drive-token-007`, `owner@sbr007.test` / `drive-pass-007`. Page
  `e921dd5b-93a5-40e4-bb75-75c37da395c0`, slug `drive-007`.
  🔴 **Drive a COPY of the backend data** — `cp -R ~/.noodl/backends/<id>` and serve that. s25 and
  s26 both did; the fixture's own rows are untouched and its project is **still the pre-D18 control
  arm**, which is what makes it reusable. Keep it that way.
  ⚠️ s26 read the fixture's title as `Retitled By The Drive` (21 ch), **not** the
  `Cross Origin Retitle 002` the previous handoff mentioned — that was s25's own copy, not the
  fixture.
- ✅ **The setup token is a file, not a UI step**: `~/.noodl/backends/<id>/secrets.json`, `functions`
  namespace. `SecretsStore` re-reads on every call, so no restart.
- ✅ **The template is generated, not authored.** Edit
  `packages/noodl-mcp/tests/sb00{4,5,6}Components.ts`, then `npm run template:site-builder`.
  `sb007Template.test.ts` asserts the committed artefact is byte-identical to a fresh generation —
  see (c) above for why that is currently red for someone else's reason.
- 🔴 **A source change is not a drive until the bundle carries it** — the viewer
  (`external/viewer/noodl.viewer.js`), the deploy runtime (`external/deploy/noodl.deploy.js`, a
  *different file*), and `nodegx-backend/dist`. **A template change is different** — it is project
  data, read from disk every boot, so no rebuild. s26 confirmed the viewer bundle (08-29 15:44)
  post-dates `layout.ts` (07-29) and `Text.tsx` (08-01) before trusting either.
- ✅ **Reaching the editor's models headlessly**:
  `window.webpackChunknoodl_editor.push([['probe'], {}, (r) => { window.__wr = r; }])`, then
  `__wr('./src/editor/src/models/projectmodel.ts').ProjectModel.instance`.
- ✅ **Driving the viewer**: `Noodl.Navigation.navigateToPath('/admin/page/<pageId>')`; wrap every
  `cdp eval` in `(() => { … })()`; **stamp in one call and click in the next**. Stamping through
  `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set` + `input`/`change`
  reaches the graph — s26 signed in that way with no editor at all.
- 🔴 **`cdp.js` and `render-report.js` both export `connect`, `evaluate` and `httpJson`, and they are
  DIFFERENT FUNCTIONS.** Wait for a target of type **`page`**, not merely for `/json/list` to answer.
- 🔴 `closest('[class*=Card]')` matches the *Name* span — use `[class*=__Card--]`. Admin buttons are
  `BUTTON.ndl-controls-button` and **the button is the leaf**.
- 🔴 `getConnectionHealth` and `evaluateConnectionHealth` take OPPOSITE spellings on one class.
  Prefer `exportComponent`. Force `graph.evaluateHealth()` before reading health — **and register
  the project module first, or it does nothing.**
- Shared checkout: **pathspec commits only, never `git add` to stage**; `git status --porcelain |
  grep '^??'` before committing. ⚠️ **A peer is live in `packages/noodl-mcp/src` right now** — s26
  committed by pathspec and left `author.ts` and `scriptPorts.ts` alone. Announce editor launches
  **and** teardowns. `test:ci` alone.
- 🔴 **How you type a path decides whether a launch sweep reaps your backend**:
  `node /abs/path/.../cli.js serve …` is a sweep target; `node packages/nodegx-backend/dist/cli.js
  serve …` is not. s26 used the relative form deliberately (a peer's launch cannot reap a drive
  mid-reading) and killed it by recorded PID afterwards — **the relative form orphans forever if you
  forget.**
- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
