# Phase 69 — next session

**Written 2026-08-17, session 17.** 🔴 **This file is a REWRITE, not an amendment.** It is
overwritten every session; if you find yourself prepending, rewrite it instead. Everything that
outlives the phase goes to memory, not here.

Read [TASKS.md](TASKS.md) and [RULINGS.md](RULINGS.md) first. **s17 built CN-009** — the MCP surface
now says whose node it is and what the author said it does, for **zero tokens**. **CN-006b or CN-010
is the natural next build; see §4.**

---

## 0. Where the phase is

| Task | Built | Driven | Note |
|---|---|---|---|
| **CN-001** … **CN-006** | ✅ | ✅ | Closed in sessions 4–11 |
| **CN-018**, **CN-019** | ✅ | ✅ | Closed s13 / s15 |
| **CN-007** | ✅ s14 | ✅ s15 (D8) | AC1/3/4/5 met; **AC2 still not started** |
| **CN-008** | ✅ s16 | ⚠️ **AC1 needs a live model** | |
| **CN-009** | ✅ **s17** | ⚠️ **AC5's consequence needs a live model** | §1, §2 |
| CN-006b, CN-010 … CN-017 | 📋 | — | §4 |

**Nothing in this phase is blocked on a running editor**, and nothing is blocked on a decision.

🔴 **Two tasks now carry the same open remainder — CN-008's AC1 and CN-009's AC5 — and it is the
same remainder: a live model in a project with a kit.** Neither can be run headlessly. Doing them
together is one drive, not two, and it would close the consequence half of both. Worth considering
ahead of a fresh build.

---

## 1. 🔴 The one lesson from s17

**A discovery gap is invisible to everyone who already knows the answer.**

`list_node_types({query})` searches a node's summary. A kit node had no summary — `summary` was read
from `enrichment`, which is generated at repo-build time and **keyed by type name, so a kit type can
never be in it** — and the author's `docs` sentence was carried faithfully into the overlay and then
dropped. Measured on the cashflow kit before the fix:

| query | before | why |
|---|---|---|
| `"pill"` | ✅ `nodegx.cashflow.Pill` | matched the **type name** |
| `"draggable"` | 🔴 **[]** | the word is in `docs` and nowhere else |
| `"snaps to whole days"` | 🔴 **[]** | same |

Every query anybody would type **while already knowing the node existed** worked. Only a query by
subject — the kind you type when you do *not* know — returned nothing. So the feature looked fine
from every seat except the one it was for.

✅ **When testing a discovery path, the query has to be written by someone who does not know the
answer.** Search for the *subject*, never the name. The name-based query is still worth keeping — as
the known-firing signal beside the absence, so a fix that breaks ordinary search is caught too.

⚠️ Same family as s16's "a selector that matched nothing" and CN-006's AC4 false pass: **the
mechanism fired, so the feature looked delivered.**

## 2. ✅ What s17 built and measured

`src/catalog.ts` only. `providedBy` / `kitModule` now survive into the listing row **and both**
`get_node_type` modes; a kit's `docs` becomes its `summary`, gated on provenance; the query hay
carries the resolved summary and the kit's name. **14 tests, 8/8 mutations killed**, `noodl-mcp`
jest **599 passed / 51 suites**. Full write-up in
[CN-009](CN-009-THE-MCP-SURFACE-INSIDE-THE-BUDGET.md).

✅ **AC3 cost nothing, and this is the part worth carrying forward:**

```
before:  [surface] 8223 tokens / 20 resident tools — 57 under the 8280 budget
after:   [surface] 8223 tokens / 20 resident tools — 57 under the 8280 budget
```

**Every fact added travels in a *response*.** The gate measures tool descriptions, schemas and
instructions — the resident surface — and a response is billed only on the turn it is asked for. So
enriching a payload is free where enriching a description is not. 🔴 **The renegotiation condition
is therefore still unspent: there is no third renegotiation, and the `$ref`ed node schema remains
available to whoever needs it.** Do not let the next task assume it has been used.

Three findings worth more than the feature:

1. 🔴 **The `docs` drop was CN-008 finding 3 in the other consumer — and it was two bugs, not one.**
   The editor reads the repo-build `enrichedNode()` table; the MCP server reads the merged catalog
   document. There is **no shared upstream that could have held the rule**, so the duplication is
   forced. Each side's comment now names the other. ⚠️ If a third consumer appears, it will have the
   bug too and nothing will report it.
2. 🔴 **The obvious control could not fail.** `docs` is prose on a kit node and a **URL** on a
   shipped one (158 of 175, all `docs.noodl.net`) — but all 175 built-ins *also* carry an
   `enrichment.summary`, so the fallback is never reached for them **whether it is gated or not**.
   "No built-in shows a URL as its summary" passes against a completely ungated implementation. The
   real control is a hand-built node shaped so the fallback *would* fire.
3. ✅ **Mutation testing found a hole an assertion had walked straight past.** An empty `docs`
   string survived the first suite, because `getNodeTypeDetail` writes the summary behind
   `if (summary)` while `listNodeTypes` assigns it **unconditionally** — so the *row* was where
   `summary: ""` would ship, and the test only looked at the detail. ⚠️ **When two call sites consume
   one helper, assert at the one with the weaker guard.**

## 3. ⚠️ What CN-009 does NOT close

- 🔴 **AC5's consequence is not met.** The caller is built and driven — a real session searches by
  subject, reads provenance off the row, fetches ports, places the node, validates clean, and a
  control mistyping the port gets `unknown-parameter … did you mean \`value\`?` (the diagnostic, not
  just a refusal). But **the choice to search for "percentage" is mine, not a model's**. See §0 —
  pair it with CN-008's AC1.
- ⚠️ **Nothing here was verified against a packaged server.** The suite builds CN-003's extractor
  from source per run; a **registered** MCP server still loads from `/Applications/…` and does not
  have this change until a repackage. A drive through the live `nodegx-*` tools would grade the old
  build.
- ⚠️ **`find_tools`' `query` matches tool *names* only**, while its own `describe` text says "names
  and descriptions". Noticed in passing, not touched — changing it costs resident tokens out of the
  57 and is Richard's call (§6.3 already asks a neighbouring question).

## 4. Picking the next build

**CN-006b** (the kits surface) and **CN-010** (dynamic ports) are the two with the most behind them.

- **CN-010** has the sharpest ground truth already measured and in memory: the exporter and the
  catalog disagree about dynamic ports (`{condition,ports}` out, `{condition,inputs}` read), and
  `parameterEncoding` is `{known:false}` on **every** overlay node by construction —
  `@nodegx/kit-catalog`'s header names CN-010 as the owner of closing it. It is the last place a kit
  node is knowingly second-class.
- **CN-006b** is the editor surface D1 asked for and has no measurement debt.

⚠️ **Confirm rather than inherit** — that is twice in a row now that a task's stated premise was
partly false (CN-008's two clauses, CN-009's `find_tools` clause and its two already-met criteria).
**Run the thing the task describes, over real data, and count what comes back, before building.**

## 5. ⚠️ Carried, unresolved

🔴 **The cashflow kit is OUTSIDE the repo and only ONE copy is tokenised.** It lives in
`NodeGX test projects/cashflow-command-centre` — unversioned, covered by no gate — while
`cn001-kit-drive` and `cn019-drive` still carry the pre-D8 kit (0 × `var(--`, 6 × live `#1F8A4C`).
**Driving the wrong copy reads as "the change did not land".** D5 makes CN-007 depend on this kit
staying working and nothing enforces it. **Still wants a task number.** ⚠️ s17 read it (never wrote
to it) via a `cp -R` into the scratchpad, which is the safe way to measure against it.

⚠️ **The token vocabulary gap (s14):** the semantic set has `--destructive` but **no `--success` and
no `--warning`**, so any kit with three status bands reaches into the palette scale for two of them.
Vocabulary gap, not a kit problem; it will recur.

⚠️ **Free and still unchecked:** whether the editor's colour picker paints a swatch for a `color`
port whose value is a `var(--token)` string. One eval with a project open.

⚠️ **From s13, still free:** `CodeFileDocument` renders **two toolbars** — its own `css.Topbar` above
`JavaScriptEditor`'s, with two separate Save buttons (`notes/cn019-driven.png`).

⚠️ **From s12, still unmeasured:** `NodeLibraryImporter.mergeInByName` replaces a group **wholesale
by name** (`NodeLibraryImporter.ts:366-388`). Wants a look if CN-013 is picked up.

## 6. Owed by Richard

Unchanged from s7–s16, all still open:

1. **Widen the project gate to check parameter values?** `checkParameterValues` has one production
   caller, so `validate:project` / `validate_project` check parameter values for **no node of any
   provenance**. `cn004.test.ts`'s last block asserts the silence deliberately — **replace it when
   the call is taken, do not delete it.**
2. **The ungated typechecks.** `packages/noodl-mcp`'s `tsc --noEmit` is red (**8**, re-measured s17,
   unchanged — none of them in CN-009's files) and runs in no CI job; seven of eleven `typecheck:*`
   scripts run nowhere, and `scripts/` is in none. ⚠️ `typecheck:runtime` is red at 2, proven
   pre-existing. ⚠️ `typecheck:core-ui` reports **44 `TS2307`s**, cause unidentified — s13 guessed
   and the guess was wrong.
3. **Should `project`'s `find_tools` purpose line name kits?** Costs resident tokens out of the same
   57. `tests/kitTools.test.ts` has the control that fails when it changes. ⚠️ **s17 declined to
   widen it and said so out loud** — CN-009's `find_tools` clause was served by
   `list_node_types({query})` instead, for zero tokens, because the catalog tools are **resident** and
   there is no deferred tool for `find_tools` to reveal. The question is now narrower, not answered.

Open, not caused here, still wanting task numbers: 🔴 `render-from-disk.js` answers `/` and
`/index.html` and 404s everything else, **including the start page's own `urlPath`** · 🔴 the
`@noodl/mcp` provisioning flake · 🔴 `ViewerConnection.sendRefresh()` dead at both ends.

## 7. Checkout conditions

- ✅ **No editor launched, nothing torn down.** s17 was entirely headless — no CDP, no stack, no
  `dev:stop`. Nothing of mine is running.
- ✅ **s17 edited ONE source file, and it is not in the editor's webpack entry**:
  `packages/noodl-mcp/src/catalog.ts` (plus a new `tests/cn009.test.ts`). No peer was messaged; a
  change confined to the MCP package cannot contaminate an editor bundle or a `test:ci` run, which
  is the announcement condition.
- ⚠️ **A peer was committing throughout.** HEAD moved twice during the session (`9e71e76f` →
  `d60b61cf` → their `64ae6527`). Their `noodl-core-ui/code-editor` work landed in their own commit;
  **s17 committed only its own four pathspecs** and swept nothing. `git commit -F <file> -- <paths>`,
  never `git add` for tracked files.
- ✅ Gates run: `noodl-mcp` **full jest 599 passed / 51 suites**; the token gate re-measured before
  **and** after at **8,223 / 8,280**; `tsc --noEmit` red at **8**, all pre-existing and none in the
  changed files.
- 🔴 **`test:ci` was NOT run.** The floor still stands where s12 left it (`2843 / 6 @ 39393`).
  **Re-measure before quoting it**; s13–s17's commits are not in it.
- ⚠️ **Peer work live in the tree and not touched**: `dev-docs/tasks/phase-50-*`, `phase-65-*`,
  `phase-68-*`, `scripts/library/check.ts`.
- Whoever you tell you are starting, tell you have stopped.
