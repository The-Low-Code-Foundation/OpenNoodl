# Phase 80 — next session

## State: DEF-001, DEF-002, DEF-003, DEF-016 closed. **DEF-004 is 🟡 — (a) done, (b) open.**

**s5 (2026-08-29)** took DEF-004 and closed its first half. Read `DEF-004-…md` **§0** and **§4a**
before anything else — §0 is the drive that came first, §4a is what it cost.

| commit | what |
|---|---|
| `d229bf4b` | **DEF-004 (a)** — a cloud run records what the graph did; 14 new specs |
| `fd8e25b0` | the drive, and the three instruments that were wrong |
| `0d224e24` | 🔴 **AC4 contradicts itself** — measured. Read this before touching (b) |

Gates at close: `test:ci` **2889 specs, 4 failures, all `AIX-006 style vocabulary` by name** (the
floor, seed 42026) · nodegx-backend **114 suites, 1324 passed / 10 skipped** · noodl-runtime
**2558 passed / 13 skipped** · viewer-cloud **193/193** · viewer-react **1087/1087** · noodl-mcp
**947/947** · nodegx-export **845/845** · `typecheck:editor`, `typecheck:mcp`, `catalog:check`,
`catalog:merge:check`, `catalog:groups:check`, `docs:nodes:check` all clean.

---

## 🔴 The finding, in one paragraph

**DEF-004 §1's reading held — and the row it did NOT contain was the defect.** Driven before
building: a cloud function in which a node **failed** was recorded as `status: "success"` with
**zero steps**, while the failure itself — carrying `nodeId`, `nodeType`, `code` and `message` —
went to a bare `console.error` and nowhere else. The information already existed and was thrown
away. The fix is `Node.beginOutcome` / `reportOutcome` on `NodeScope.runContext` — **not** the
error bus, which hangs off `NodeContext`, of which there is one per `CloudRunner` with concurrent
requests in it, so a bus subscriber cannot say whose request an event belongs to. The real
`publishPage` now records **6 steps including the `Run Tasks` worker's**, where SBR-006's drive
found *3 executions, 0 steps*.

## What to do next

**DEF-004 (b)**, or **DEF-006** if you would rather not carry (b)'s open question.

🔴 **If you take (b), read `DEF-004-…md` §4b FIRST — AC4 as written refuses a wire AC4 requires.**
Every `completed` wire in every shipped template is one of the two uses AC4 says must be accepted,
and one of them lands on `noodl.cloud.response.send`, which AC4 names as the defect. The rule is
**not** about the target node type: what separates SBR-006's defect from `submitContactForm` is
that `publishPage` wrote a **success fact** about work that may not have happened. Also: the
blocking arm has **no positive instance** in any shipped template, so it needs a probe graph.

Open beside it: **DEF-017 C1**, **DEF-006**, **DEF-007** (read its **§1.1**, added late 08-29 — it
changes that task's premise and makes it the owner of P77's D11), **DEF-008**, **DEF-009**,
**DEF-014**, **DEF-015**, and the four carried from phase 76 by reference.

🔴 **Do to your task what §0 did to this one: find the claim in it that is a reading rather than a
measurement, and drive that one first.** It has now paid twice running — s4 deleted two of three
rows that way, and s5 found a defect the file did not contain.

## 🔴 What this session paid for, that the next one should not re-buy

- **A mutant that killed nothing, and the spec was mine.** The arm labelled *"a node that never
  adopted the outcome contract"* used a `JavaScriptFunction` that throws, chosen off a
  `sendSignalOnOutput('failure')` grep hit. `simplejavascript.ts` has **both** paths and its
  signal-driven `run` goes through `beginOutcome` — so the spec was a second test of the outcome
  path wearing a label that said otherwise, and deleting the code it claimed to grade still passed
  14/14. **A population derived from one grep is a hypothesis about the population.** `Static Data`
  is the honest arm.
- 🔴 **Adding a method to `Node.prototype` reddened fourteen specs at once.** Several suites build
  a node as **a bag of bound prototype methods** and never construct one, so a new method the
  prototype calls is simply absent (`this._X is not a function`). `Node.prototype` is a published
  surface to the spec population, not only to the product. The guard is inline for that reason.
- 🔴 **Two wrong id lists before the deployed bundle was the only honest source.** "The steps are
  the graph's own nodes" was checked first against `site-builder.content.json`, then against
  `SB004_COMPONENTS`; both went red on ids the run really did produce. **The MCP door rewrites node
  ids on write** (`sections` → `sections-3`, `page` → `page-8`), and `Run Tasks` instantiates its
  **worker** inside the run. ⚠️ **The template file and an authored project carry different node
  ids for the same function** — anything joining a record back to a canvas has to know that.
- **The step recorder does not see everything, and the file says so.** A step is an **action
  invocation**; a `DbCollection2` that returns rows is invisible, the same node failing is visible
  through a second bridge in `raiseRuntimeError`. **Every action, plus every failure** — a query
  that quietly returned the wrong rows is still not in the record.

## Traps carried

- ⚠️ **`packages/noodl-runtime/dist-types/` is generated and gitignored, and `noodl-viewer-cloud`
  typechecks against it, not against source.** A new export in `runcontext.ts` is invisible until
  `npm run build:types` in `noodl-runtime`. The error reads as a missing export you just wrote.
- ⚠️ **A cloud function whose graph hangs answers 504 and records `status: error` with zero
  steps** — the query on a nonexistent collection does exactly this. That case is *not* improved by
  this session's work and is worth someone's attention.
- 🔴 **`rg -ln` and `rg -rn` mangle output**, hit twice more this session: `rg -ln "beginOutcome"`
  printed lines with `beginOutcome` rewritten to `ln`. Use long flags.
- ⚠️ **`nodegx-backend`'s suite takes ~250s and must be `--runInBand`** (two browser drives bind
  real sockets and flake on each other).
