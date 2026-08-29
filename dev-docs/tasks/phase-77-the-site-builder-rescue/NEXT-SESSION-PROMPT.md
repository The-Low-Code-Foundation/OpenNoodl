# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## State: **s18 built SBR-008's fix and drove it. All five ACs are met. SBR-008 is CLOSED.**

The defect this phase has been chasing since s9 — a deployed panel that writes a page with no
title and no slug, and says the save succeeded — is fixed at `a14fb8e7`, and the person sentence
was driven with a control beside it.

Read in this order, and **only if you are picking up SBR-008's neighbours**:

1. **[SBR-008 §8](SBR-008-THE-DEPLOY-KEEPS-THE-PANELS-WIRES.md)** — the drive. §8.1 is the
   four-cell control on one node; §8.3 is the save, with the SQL.
2. **[SBR-008 §7](SBR-008-THE-DEPLOY-KEEPS-THE-PANELS-WIRES.md)** — what was built, and the three
   things that were wrong before it could be. §7.1 and §7.5 are the ones worth your time.
3. **[D13](DEFECTS-THE-SITE-BUILDER-FOUND.md)** — **still open, still `NONE`.** The fix removed
   the `prop-` family from the filter's reach; it did not touch the filter.

---

## 🔴 FIRST JOB — pick one. SBR-008 no longer blocks anything.

**SBR-007** was `⬜ open — deployed-save half blocked on SBR-008`. **It is not blocked any more.**
That is the cheapest real work in this phase and it now has a working save underneath it.

**SBR-006 AC2** was `🟡 still on SBR-008`. Also unblocked. ⚠️ **Re-read it before believing the
old note** — AC1's rows were named because the fixture's schema had grown, and that reason is
gone: rows are now named because the wires survive.

---

## 🔴 Three traps this session paid for, and two of them are the same trap

### A comment is a claim. Twice, in one session, in two different roles.

- **§2's plan named a dead field.** It said *"`NodeModel.inputs`/`.outputs` are the connection
  lists"*, because **the field's own docblock says so** — *"Populated by `GraphModel`, not by
  this class."* Nothing populates them. Both are `[]` from the constructor and there is no writer
  anywhere in the repo. A label was read, quoted into a ruling, and survived three sessions of
  people reading that ruling. ✅ The accessor that works — `node.component.getConnectionsTo(id)`
  — was already in the tree doing this exact job for numbered inputs.
- **A census documented as asking never asked.** `unresolvedWires()` said *"a wire is counted when
  the node that owns the port does not announce it"* and counted **every** `prop-` wire
  unconditionally. That gave the right number for four sessions — because the answer was always
  zero — and it would have gone on reporting **19** for ever after the fix landed.

🔴 **The rule: a docblock is a claim about code, not a reading of it.** When a comment is the
reason you believe something, that is the moment to run the two-line check. Both of these cost
more than the check would have.

### A zero that is about the field name, not the graph — a second time

§6.6 caught a census filtered on the editor's `fromProperty` against the viewer's `sourcePort`:
**0** `prop-` wires reported on a graph with 19. The same two name-spaces sit on either side of
this fix — `exportConnection` renames all four fields on **every** path into a runtime, including
the live preview's per-wire deltas — so a runtime module handed the editor's spelling derives
nothing and reports it as *"there was nothing to derive."* It is now a graded mutant: **5 cases
redden.** ⚠️ `site-builder.content.json` holds the **editor** spelling, because a template is a
project file and not an exported bundle.

### A mutant that killed nothing, and it was mine

The agreement spec's "does this comparison discriminate?" case first removed `connections[0]`.
Both mutants stayed green: most wires are not `prop-` wires, and a field that is *also* a saved
parameter survives losing its wire. **A mutant that kills nothing is a finding about the mutant.**
It now picks a field reachable only through a wire, and both arms redden.

## Where the phase now stands

| | verdict |
|---|---|
| **SBR-008 AC1–AC5** | ✅ **all met**, s18 — §7, §8 |
| **SBR-006 AC1** | ✅ s17 |
| **SBR-006 AC2** | 🟡 **unblocked** — re-read it, its old note's premise is gone |
| **SBR-006 AC3/4/5** | ✅ s9, s12, s13 |
| **SBR-007** | ⬜ **unblocked** — the deployed-save half now has a save |
| **SBR-015 AC1/2/3** | ✅ s13 · **AC4** 🟡 ⚠️ re-read: DEF-004(a) at `d229bf4b` writes an execution step per action, so *"0 steps"* is no longer the expected reading |
| **SBR-016 / SBR-017** | ✅ s14/s15 |
| **D13** | 🔴 **open, `NONE`.** Confirmed s17, untouched by this fix. Still no task's AC mentions the health pass, the export filter or build determinism |

## Standing context

- 🔴 **Drive fixtures.** `SBR-016 Arrive Drive` (`backend_mte9omazclxw6`, port 8600,
  `owner@sbr016.test` / `drive-pass-016`) now holds `Page:[published,showInNav,navOrder,title,
  slug,**seoDescription**]` — **s18's save created that last column**, so 016 can no longer answer
  a question about a field with no column either. For that, `SBR-017 Sign In Drive`
  (`backend_mte82r1qhnr87`, 8599, `owner@sbr017.test` / `drive-pass-017`) still has
  `Page:[published,showInNav,navOrder]` and is deliberately unspent. `SBR-015 AC1 Drive`
  (`backend_mte62ofkj8whc`, 8598) is left in the **refusal** arm.
- ✅ **The backend is readable directly, and it is the cheapest oracle in this phase.**
  `sqlite3 ~/.noodl/backends/<id>/data/local.db` — `PRAGMA table_info(Page)` and
  `SELECT name, updatedAt FROM _Schema` answer "did this write land, and did it create the
  column?" in one call. ⚠️ The HTTP API refused both drive tokens; do not spend time on it.
- 🔴 **A source change is not a drive until the bundle carries it.** The editor's viewer runs
  `packages/noodl-editor/src/external/viewer/noodl.viewer.js`, a webpack watch build. `npm run
  dev:debug` rebuilds it, but **grep the bundle for your new symbol before driving** — s18 did,
  and it took ~4 minutes after Electron was already up and answering.
- ✅ **Reaching the editor's models headlessly** (unchanged, still the best instrument here):
  `window.webpackChunknoodl_editor.push([['probe'], {}, (r) => { window.__wr = r; }])`, then
  `__wr('./src/editor/src/models/projectmodel.ts').ProjectModel.instance` and
  `__wr('./src/editor/src/utils/exporter/util.ts').exportComponent`. Module ids are source paths.
- ✅ **Force `evaluateHealth()` before reading health or exporting.** It removes D13 as a confound
  in one line, and it is what §6.5 said AC5's control pair had to do. Without it you are
  measuring the debounce.
- ✅ **The preview webview gave `988 × 313`** again, not `96 × 0` — **measure it, assume neither**.
  `Emulation.setDeviceMetricsOverride` must be on the same connection as the clicks. In-app
  navigation: `Noodl.Navigation.navigateToPath('/admin/pages')`. The `cdp eval` context persists
  between invocations, so wrap every eval in `(() => { … })()`. Stamp an element with a
  `data-` attribute in one call and click it in the **next** — a write is invisible in the same eval.
- ⚠️ **A peer is working in `noodl-mcp` / `nodegx-export` / `noodl-core-ui`.** `typecheck:mcp` is
  RED at HEAD on **their** in-flight file (`tests/tpl001Template.test.ts`, two undefined
  identifiers) — not yours, do not "fix" it. `packages/noodl-types/src/node-catalog-enriched.json`
  is dirty as a regenerated artefact of their example edits; it was deliberately left out of
  `a14fb8e7`.
- ✅ **Gate at HEAD: `test:ci` = 2889 specs, 4 failures, all `AIX-006 style vocabulary` by name** —
  the documented floor. Ran alone, after waiting out the peer's `nodegx-backend` suite. The
  `sb017-deploy-connection-parity` spec ran (7 cases) and passed, so AC3's exemption list is
  un-widened.
- 🔴 **AC3 named a constant that does not exist.** There is no `REMOVED_BY_SB018`; the list is
  `REMOVED_SINCE_THE_BUNDLE`. The string `REMOVED_BY_SB018` occurs in the repo exactly once, in a
  comment in `noodl-mcp/tests/sb006Components.ts` describing the *pattern* — a mention that had
  been read as a name and carried into an acceptance criterion.
- Shared checkout: **pathspec commits only, never `git add`**; announce editor launches **and**
  teardowns; `test:ci` alone, never beside a live stack. `dev:stop --list` before and after — it
  showed an empty stack before s18's launch and `Stopped 27 process(es)` after, with all 18 peer
  MCP servers still alive.
- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
