# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## State: **s20 closed D14. SBR-007 is still the first job, and it is now genuinely unblocked.**

s19 handed this session SBR-007 and a two-variable experiment. The experiment was unnecessary:
D14's cause was in neither variable, it was readable off two files on disk, and it is fixed.

Read in this order:

1. **[D14 — the CLOSED section at the end](DEFECTS-THE-SITE-BUILDER-FOUND.md)** — what it was, and
   the two claims s19 made about it that were wrong.
2. **[TASKS.md s20](TASKS.md)** — the same in ten lines, including what is still unowned.

---

## 🔴 FIRST JOB — **SBR-007**, and nothing in this phase blocks it now

SBR-007 is the screen a client lives in. Publish and duplicate work again as far as the export is
concerned; **AC1's preview half is the cheapest real work**, and **AC2 (drag to reorder)** and
**AC3 (drop an image, get a thumbnail)** are untouched and need runtime-capability checks before
any design. ⚠️ Read its ACs before planning.

⚠️ **D14's fix has not been driven.** It is proved by a spec pair, not by the app: no fixture was
redeployed and no cloud function was called after the fix. **The first thing SBR-007 AC1 does will
exercise it** — if publish or duplicate still throws `Outputs.<x> is not a function`, the export is
not the only place ports are lost, and that is worth more than finishing AC1 that day.

---

## What D14 was

The deployed bundle carried **`ports: []` on all 11 cloud Function nodes**; the backend where
publish had succeeded carried **50** across the same 11. A deployed node's `outputPorts` come only
from `nodeData.ports`, `_isSignalType` reads exactly that, and the callable stub is gated on it —
so `Outputs.ready` was `undefined` and `Outputs.ready()` threw. Four lines of source, no inference.

✅ **Fix:** `withScriptPorts` in `exporter/cloudFunctions.ts` derives a cloud Function's ports from
its own `functionScript` at export time. It only ever *adds*, so in a healthy session it changes
nothing — which is exactly why it needed the suite below.

---

## 🔴 Four traps this session paid for

### The two claims that were wrong, and both were about a control

- **"Two variables — the cloud runtime, or the project."** Neither. **The project on disk had the
  ports.** The template persists all 13 signal ports *statically* on the nodes, and the failing
  project's own `nodes.json` holds `out-ready:output:signal`. A whole experiment was designed to
  separate two innocent things because nobody opened the project file.
- **"`claimSite` — control, same backend."** Same backend, **different artefact**: it ran at 12:27
  against a bundle replaced at 15:48. ✅ **`stat` the artefact a control ran against**, not the
  directory it sits in. This is the second session running to be caught by a control that was
  measured at a different time from the thing it controls.

### 🔴 The first version of the regression suite reproduced nothing, and passed

It withheld `CLOUD_DYNAMIC_PORT_ADAPTERS`, on the theory that the ports were derived. **They are
persisted**, so the export shipped them anyway and the suite was green **with the fix sabotaged**.
✅ **Sabotage before believing a new gate.** The 90 seconds that cost is the only thing that
separated "a spec that gates the fix" from "a spec that describes it". Only the second version —
**no node library at all**, so `node.type.exportDynamicPorts` is falsy on an `UnknownNodeType` —
turns `ports: []` on.

### The gate had a hole exactly the shape of the defect

`sb017-deploy-connection-parity.test.ts` asserted **connections**, per component, against the
artefact, with a known-firing control — and never once read a node's `ports` array. The bundle that
killed publish passed every assertion in that file. ✅ **When two things travel together in an
artefact and only one is asserted, the other is where the next defect lives.**

## Where the phase now stands

| | verdict |
|---|---|
| **SBR-006** | AC1 ✅ s17 · AC2 ✅ s19 · **AC3 🟢 unblocked by s20's D14 fix, not re-driven** · AC4 ✅ s12 · AC5 ✅ s9 |
| **SBR-007** | ⬜ **the first job** — ⚠️ AC2/AC3 are the expensive half |
| **SBR-008** | ✅ all five, s18 |
| **SBR-015** | AC1/2/3 ✅ s13 · **AC4** 🟡 re-read: DEF-004(a) now writes a step per action |
| **SBR-016 / SBR-017** | ✅ s14/s15 |
| **D13** | 🔴 open, `NONE` — **D14 was its family and is fixed; D13 itself is untouched** |
| **D14** | 🟢 **FIXED s20** |
| **new, unowned** | 🔴 the same exposure on the **browser** deploy path — `build/deployer.ts` shares `exportPorts`, and a browser Function exported with an unresolved type ships with no ports too. Untested. Recorded at the end of D14; **it has no row of its own and no owner** |

## Standing context

- ✅ **Gate at HEAD: `test:ci` = 2894 specs, 4 failures, all four `AIX-006 style vocabulary` by
  name** — the documented floor, seed 99529, fresh `test-results.json`. The suite grew 2889 → 2894
  (five new cases in `tests/cloud/sb017-deploy-connection-parity.test.ts`). ⚠️ `gitHead` read
  `71b3ff87`, a peer's phase-80 docs commit landing mid-run — it is the checkout at read time,
  never authorship.
- ✅ **The artefacts are the cheapest oracle in this phase and they were under-used for a week.**
  A deployed bundle is a plain file: `~/.noodl/backends/<id>/workflows/*.workflow.json`. The
  project that produced it is another: `<project>/components/__cloud__/<fn>/nodes.json`. Reading
  both answered in fifteen minutes a question that had a drive designed for it.
  Also: `sqlite3 ~/.noodl/backends/<id>/executions.sqlite` (backend **root**, not `data/`) —
  `workflow_executions` and `execution_steps`, and its timestamps are **local**, so s19's "14:05Z"
  rows are the 16:05 ones.
- 🔴 **Drive fixtures are spent for the no-column question.** `SBR-017 Sign In Drive`
  (`backend_mte82r1qhnr87`, 8599, `owner@sbr017.test` / `drive-pass-017`) and `SBR-016 Arrive Drive`
  (`backend_mte9omazclxw6`, 8600, `owner@sbr016.test` / `drive-pass-016`) both grew their `Page`
  class. **The next no-column question needs a fresh mint.** `SBR-015 AC1 Drive`
  (`backend_mte62ofkj8whc`, 8598) is still in the **refusal** arm — and its bundle is the *working*
  50-port one, which is why it was the control here.
- 🔴 **A source change is not a drive until the bundle carries it.** Grep
  `packages/noodl-editor/src/external/viewer/noodl.viewer.js` for your symbol immediately before
  the act; a peer's `noodl-runtime` edit rebuilds it mid-session.
- ⚠️ **A peer editing editor source will full-reload your editor and close your project** — and
  that is the leading unmeasured candidate for what put the editor in the state that shipped
  `ports: []` at 15:48, 23 minutes after `a14fb8e7` touched `noodl-runtime`. Keep a two-call reopen
  helper and re-install the webpack probe, which the reload clears.
- ✅ **Reaching the editor's models headlessly**:
  `window.webpackChunknoodl_editor.push([['probe'], {}, (r) => { window.__wr = r; }])`, then
  `__wr('./src/editor/src/models/projectmodel.ts').ProjectModel.instance`.
- 🔴 **`closest('[class*=Card]')` matches the *Name* span** — use `[class*=__Card--]`.
- 🔴 **`getConnectionHealth` and `evaluateConnectionHealth` take OPPOSITE spellings** on one class.
  Prefer `exportComponent` — it is the real filter. ✅ Force `graph.evaluateHealth()` before reading
  health or exporting. ⚠️ **`kept === authored` proves nothing alone** — pair it with a port that
  must read **false**.
- ✅ Viewer measured **988 × 313** again — measure it, assume neither.
  `Noodl.Navigation.navigateToPath('/admin/pages')`; wrap every `cdp eval` in `(() => { … })()`;
  stamp in one call and click in the **next**.
- Shared checkout: **pathspec commits only, never `git add` to stage**; `git status --porcelain |
  grep '^??'` before committing. Announce editor launches **and** teardowns. `test:ci` alone, never
  beside a live stack — s20 ran it three times with nothing else up.
- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
