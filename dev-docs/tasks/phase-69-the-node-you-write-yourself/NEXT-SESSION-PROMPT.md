# Phase 69 — next session

**Written 2026-08-17, session 18.** 🔴 **This file is a REWRITE, not an amendment.** It is
overwritten every session; if you find yourself prepending, rewrite it instead. Everything that
outlives the phase goes to memory, not here.

Read [TASKS.md](TASKS.md) and [RULINGS.md](RULINGS.md) first. **s18 built CN-010's AC2 and AC3** —
an agent is now told *how* a port list is incomplete instead of only *that* it is, and the last
silent skip in `checkParameterValues` says its name. **CN-006b is the natural next build; see §4.**

---

## 0. Where the phase is

| Task | Built | Driven | Note |
|---|---|---|---|
| **CN-001** … **CN-006** | ✅ | ✅ | Closed in sessions 4–11 |
| **CN-018**, **CN-019** | ✅ | ✅ | Closed s13 / s15 |
| **CN-007** | ✅ s14 | ✅ s15 (D8) | AC1/3/4/5 met; **AC2 still not started** |
| **CN-008** | ✅ s16 | ⚠️ **AC1 needs a live model** | |
| **CN-009** | ✅ s17 | ⚠️ **AC5's consequence needs a live model** | |
| **CN-010** | ✅ **s18 (AC2+AC3)** | ⚠️ **AC1 needs a live editor; AC4 not started** | §1, §2 |
| CN-006b, CN-011 … CN-017 | 📋 | — | §4 |

**Nothing in this phase is blocked on a decision.** One scope call is owed (§6.4, new).

🔴 **Three tasks now carry an open remainder that is the same shape: a running thing.**
**CN-008 AC1** and **CN-009 AC5** want a *live model* in a project with a kit — that is **one drive,
not two**. **CN-010 AC1** wants a *live editor* with a kit whose nodes declare `dynamicports`, and
the fixture for it already exists (`packages/noodl-mcp/tests/fixtures/kit-dynports`). Worth
considering ahead of a fresh build.

---

## 1. 🔴 The one lesson from s18

**A second consumer of a shared document re-declares the shape it reads, and nothing types the
seam.**

This is now **three fields in three consecutive tasks**, and they are not three oversights:

| task | field | what happened |
|---|---|---|
| CN-008 | `docs` | editor read the repo-build enrichment table; a kit type can never be in it |
| CN-009 | `summary` | same table, same impossibility, different consumer |
| **CN-010** | **`dynamicPorts.description`** | the MCP projection read **`dp.note`** — **a field that exists on no node at all** |

The third is the sharpest, because it had nothing to do with kits. `description` is **non-optional**
on `DynamicPortInfo` (all 88 shipped types that declare dynamic ports) *and* on
`OverlayDynamicPortInfo` (every kit node). The MCP server declared its own local
`{ mechanisms: string[]; note?: string }` for the field it was reading, so `dp.note` compiled,
typechecked and shipped `undefined` for **every dynamic type in the product**. The editor's
`CatalogIndex.dynamicPortNote()` reads `description` and had been right the whole time.

✅ **The tell is a consumer that writes its own interface for a document it does not own.** Both
sides passed their own tests. Nothing compared them, because there was nothing to compare — the two
declarations never met.

⚠️ Same family as s16's *"a selector that matched nothing"* and s17's *"a discovery gap is invisible
to whoever knows the answer"*: **the mechanism fired, so the feature looked delivered.**

## 2. ✅ What s18 built and measured

Two files: `packages/noodl-mcp/src/catalog.ts` and
`packages/noodl-editor/src/editor/src/validation/parameterValues.ts`. **23 tests, 15/15 real
mutations killed** (a 16th was a deliberate no-op, and correctly survived — a control on the
mutation harness itself). Full write-up in [CN-010](CN-010-DYNAMIC-PORTS.md).

**Gates.** `noodl-mcp` jest **613 / 52 suites** · editor jest **3,567 / 231 suites** · resident
surface **8,223 / 8,280 — unchanged** · `tsc --noEmit` **8, all pre-existing**.

✅ **CN-009's zero-cost finding held under a second test, and this is worth carrying forward.**
Everything AC3 added travels in a **response**, and the resident surface did not move a token. **The
57 are still unspent; there is still no third renegotiation; the `$ref`ed node schema is still
available.** Do not let the next task assume otherwise.

💰 **But responses are not free, and there is a separate gate that measures them.**
`nodeDocBudget.test.ts` caught this change and it is an explicit ratchet — *"move the number, say
why"*. Moved **12,500 → 13,500**, with the arithmetic in the task file. Two things fell out:

- ⚠️ **The ceiling case is no longer `Group`** — `net.noodl.controls.textinput` passed it, and the
  comment naming `Group` had been stale for a while. **Do not re-derive the ceiling case from a
  comment; measure it.**
- ✅ **The cheaper-looking encoding was measured and is not cheaper.** Moving each condition onto its
  port as `activeWhen` costs **29,014** bytes against the group block's **22,911**: conditions are
  long, and one group shares its condition across several ports. The spec's named shape won on its
  own merits rather than by deference.

Three findings worth more than the feature:

1. 🔴 **The obvious control could not fail — third task running.** *"No built-in's summary shows the
   generic dynamic description"* passes against a **completely unimplemented** fallback, because all
   88 shipped dynamic types carry an `enrichment.runtimeBehavior` and take the first branch either
   way. The `else` is unreachable for every one of them. The real control is a hand-built node
   **shaped so the fallback would fire**, with nothing for it to fire with. The two are labelled
   **guard** and **control** in `tests/cn010.test.ts`, and the difference is written down.
2. 🔴 **Gating a diagnostic behind the flag its sibling uses would have built one nothing can turn
   on.** The connection-side skip notice is gated on `emitDynamicPortInfo`, which only
   `scripts/validate-project.ts` sets — and it sets it for the **other pipeline**.
   `checkParameterValues` has exactly one production caller, which passes `{ component }`. Copying
   the sibling's shape would have looked consistent and fired never. ✅ Justified by measurement
   instead: **median 0, p90 2, max 17** notices per component.
3. ✅ **`DynamicPortSkipped` already existed**, emitted by `nonexistentPort` for *connection*
   endpoints. So a connection to a runtime-created port was reported as skipped while a **parameter
   on the same port of the same node** was silent. ⚠️ **The wording could not be borrowed from the
   nearest neighbour**: `unknownTypeSkip` says *"type X is not in the node catalog"*, which is false
   here — and for a kit node it is false **precisely because CN-003 fixed it**.

## 3. ⚠️ What CN-010 does NOT close

- 🔴 **AC1 is not started and needs a running editor.** Whether a kit's `dynamicports` survive
  `sendNodeLibrary` into the property panel, whether such a node is connectable, and what the editor
  does when a kit's dynamic ports change while nodes using them sit on canvas — all three are
  unmeasured. ✅ The fixture exists: `packages/noodl-mcp/tests/fixtures/kit-dynports` declares both
  shapes (`Panel` a conditional group, `Feed` a channel port) and is run by the real extractor.
- ⚠️ **AC4 (the CN-007 worked example) is not started.** When it is written: use **real port names**
  (`in-`/`out-` prefixes) *and* **real type names** — `Javascript2`, not `Function`. This task's own
  spec got the second one wrong.
- ⚠️ **`parameterEncoding` is still `{ known: false }` on every overlay node.**
  `@nodegx/kit-catalog`'s header names CN-010 as the owner of closing it; it needs the same live
  editor AC1 does, because the key formulas are derived by *driving* the node.
- ⚠️ **Nothing here was verified against a packaged server.** A **registered** MCP server still loads
  `/Applications/…` and does not have this change until a repackage; a drive through the live
  `nodegx-*` tools would grade the old build.

## 4. Picking the next build

**CN-006b (the kits surface)** is now the one with the most behind it and no measurement debt. Its
prerequisite is done — CN-018 landed the provenance it displays — and it is the editor surface D1
asked for.

⚠️ **Confirm rather than inherit.** That is **three sessions in a row** where a task's stated premise
was partly false: CN-008's two clauses, CN-009's `find_tools` clause and its two already-met
criteria, and now CN-010's AC3, wrong three ways in one sentence. **Run the thing the task
describes, over real data, and count what comes back, before building.** In each case the
measurement took under an hour and changed what got built.

## 5. ⚠️ Carried, unresolved

🔴 **The cashflow kit is OUTSIDE the repo and only ONE copy is tokenised.** It lives in
`NodeGX test projects/cashflow-command-centre` — unversioned, covered by no gate — while
`cn001-kit-drive` and `cn019-drive` still carry the pre-D8 kit (0 × `var(--`, 6 × live `#1F8A4C`).
**Driving the wrong copy reads as "the change did not land".** D5 makes CN-007 depend on this kit
staying working and nothing enforces it. **Still wants a task number.** ⚠️ Read it via a `cp -R` into
a scratchpad; never write to it.

⚠️ **The token vocabulary gap (s14):** the semantic set has `--destructive` but **no `--success` and
no `--warning`**, so any kit with three status bands reaches into the palette scale for two of them.

⚠️ **Free and still unchecked:** whether the editor's colour picker paints a swatch for a `color`
port whose value is a `var(--token)` string. One eval with a project open.

⚠️ **From s13, still free:** `CodeFileDocument` renders **two toolbars** — its own `css.Topbar` above
`JavaScriptEditor`'s, with two separate Save buttons (`notes/cn019-driven.png`).

⚠️ **From s12, still unmeasured:** `NodeLibraryImporter.mergeInByName` replaces a group **wholesale
by name** (`NodeLibraryImporter.ts:366-388`). Wants a look if CN-013 is picked up.

⚠️ **New, s18:** `find_tools`' `query` matches tool *names* only while its `describe` text says
"names and descriptions" (noticed s17, still untouched — changing it costs resident tokens).

## 6. Owed by Richard

1. **Widen the project gate to check parameter values?** `checkParameterValues` has one production
   caller, so `validate:project` / `validate_project` check parameter values for **no node of any
   provenance**. `cn004.test.ts`'s last block asserts the silence deliberately — **replace it when
   the call is taken, do not delete it.**
2. **The ungated typechecks.** `packages/noodl-mcp`'s `tsc --noEmit` is red (**8**, re-measured s18,
   unchanged, none in CN-010's files) and runs in no CI job; seven of eleven `typecheck:*` scripts
   run nowhere, and `scripts/` is in none. ⚠️ `typecheck:runtime` is red at 2, proven pre-existing.
   ⚠️ `typecheck:core-ui` reports **44 `TS2307`s**, cause unidentified. 🔴 **s18 hit this live**: a
   new test line typechecked wrong (`location.nodeType` is not on the wire type) and **passed at
   runtime** — in a package whose typecheck no gate runs. Caught only by measuring `tsc` by hand
   before and after.
3. **Should `project`'s `find_tools` purpose line name kits?** Costs resident tokens out of the same
   57. `tests/kitTools.test.ts` has the control that fails when it changes. Narrowed by s17, not
   answered.
4. 🆕 **"Clean" is no longer "an empty diagnostics array" for any page.** CN-010's AC2 makes the
   runtime-dynamic skip visible, and `Page` declares **neither `title` nor `urlPath`** as a static
   port — they are registered per instance — so **96 of the 947 measured skips are `Page`**, and the
   canonical clean page now carries one `info`. The notice is a **true positive**: those two
   extremely commonly set parameters were checked by nothing and reported as checked. `warnings`
   stays **0** and nothing blocks, and this is the same trade CN-002 made and you ruled for. But it
   changes every authoring response, so it is yours to confirm. The replaced baseline is
   `stagingDiagnostics.test.ts`' *"stays silent on a clean candidate"*, which now asserts the
   guarantee (**not accused**) rather than the shape (**empty array**).

Open, not caused here, still wanting task numbers: 🔴 `render-from-disk.js` answers `/` and
`/index.html` and 404s everything else, **including the start page's own `urlPath`** · 🔴 the
`@noodl/mcp` provisioning flake (**seen again s18** — `provision.test.ts` red in a full run, green
in isolation; load-dependent, pre-existing, touches nothing CN-010 changed) · 🔴
`ViewerConnection.sendRefresh()` dead at both ends.

## 7. Checkout conditions

- ✅ **No editor launched, nothing torn down.** s18 was entirely headless — no CDP, no stack, no
  `dev:stop`. Nothing of mine is running.
- ⚠️ **s18 edited an EDITOR source file** — `validation/parameterValues.ts` **is** in the editor's
  webpack entry, so this is the announcement condition, unlike s17's MCP-only change. 🔴 **A peer was
  launching a stack when the session started** (`scripts/start.ts`, pid 17319, age 00:00 — the
  ~75s-invisible window from memory). **The MCP-only half was done first for exactly that reason**,
  and the editor edit was made only after the launcher had exited and no `scripts/start.ts`,
  webpack or editor process remained. No peer was messaged; none was measurably running anything
  contaminatable by then.
- ✅ Gates run, all after the last edit: `noodl-mcp` jest **613 / 52 suites**; editor jest
  **3,567 / 231 suites**; resident surface **8,223 / 8,280** re-measured before *and* after;
  `tsc --noEmit` **8**, all pre-existing and none in the changed files.
- 🔴 **`test:ci` was NOT run.** The floor still stands where s12 left it (`2843 / 6 @ 39393`).
  **Re-measure before quoting it**; s13–s18's commits are not in it.
- ⚠️ **Peer work live in the tree and not touched**: `dev-docs/tasks/phase-50-*`, `phase-65-*`,
  `phase-68-*`, `scripts/library/check.ts`.
- Whoever you tell you are starting, tell you have stopped.
