# EL-009 — The eyes must see every page

| Field | Value |
|---|---|
| **Tier** | 0 |
| **Effort** | S/M |
| **Surface** | `devtools`, `mcp` |
| **Rulings** | none |
| **Depends on** | nothing — **do this first**; every multi-page verification in this phase is blind until it lands |

## The job

Give an already-recorded open finding its task number, here, because this phase is its most
demanding customer: **`render_report` serves ONE PATH, not one route.** `/` returns 200 but
`/home` — *including the start page's own `urlPath`* — 404s, and the report still says "Rendered
clean". Anything driven by `urlPath` is unmeasurable on every page (finding recorded 2026-08,
"OPEN, wants a task").

Every course is multi-page. A deck is N slide views; a scenario is a branch tree; the LMS starter
is a dozen pages. Without this instrument, every "the template renders" claim in EL-003 through
EL-006 is a claim about the start view only — the CN-001 lesson ("Rendered clean" over a page that
never drew the thing under test) in route-shaped form.

The fix lives in the `render-from-disk.js` / `render-report` chain: serve the project such that
registered pages resolve by their `urlPath`, and let the caller name a path (or sweep all
registered pages) rather than getting the one hardcoded path.

## ✅ CLOSED 2026-08-20 (session 47) — all four ACs. AC3/AC4 below; AC1/AC2 in session 46's block

Session 47 finished what session 46 started, from the same lane. **13 specs across two files**
(`packages/noodl-editor/tests-unit/el-009/`), each graded by disabling the branch it covers.

| AC | State | Where |
|---|---|---|
| 1 | ✅ **Now fully met** — the caller can name a page: `--page deep`, `/deep`, `#deep`, `/#deep` or `/Pages/Deep`; `/` is the start page | `resolvePageRequest` in `render-report.js`; `page` on `render_report` |
| 2 | ✅ Met in session 46, unchanged | — |
| 3 | ✅ **Met** — three *distinct* refusals, and none of them is an empty report | `page-selection.test.ts` |
| 4 | ✅ **Met** — a kit node on page three, rendered in a real browser, asserted on page three | `kit-renders-on-page-three.test.ts` |

### AC3 — the refusal is the point, and it is three refusals

A sweep has **no wrong input**: it takes no path, so there was no path to get wrong, so there was
nothing to reject. That is why AC3 could not be met by AC2 however good the sweep was. The three
refusals are kept apart because they have different fixes — a **typo** (lists the registered paths),
a **registered page this harness cannot address** (says so, rather than "no such page", which would
send someone hunting a spelling mistake they did not make), and a **project with no router**
(says that, rather than printing an empty list that reads as a broken tool).

🔴 **A refusal must not be an empty report.** It throws with `actionable` set, so `--json` gets
`{error: {...}}` and exit 1. A caller checking only `findings.length === 0` would otherwise read a
refused render as a clean one — this task's own failure mode, reintroduced at the door.

✅ **Refused before Chrome starts: ~40ms, against ~8.3s for a real one-viewport render.** Specced,
because `render.ts` records the other shape costing a spec eight seconds to assert an absence.

### AC4 — the three arms, and why two were not enough

`Pages/Deep` is page three and carries **two** `demo.kit.Badge` nodes and nothing else; Home and
Middle carry one ordinary `Text` each. The control is **derived from the committed fixture at run
time** by setting the kit's `runtimes` to `["cloud"]` — one field, so the graph, the node, the page
and the kit file are byte-identical across arms.

| arm | kit reaches the browser | `--page deep` |
|---|---|---|
| **A** | yes | `Rendered clean`, **2 texts** |
| **B** | no | **2 errors, `blank-render`**, attributed `/Pages/Deep` |
| **C** | no — *and looked at from the start page* | **`Rendered clean`** |

🔴 **Arm C is the teeth.** A/B only show the check *can* fail; C holds the project broken and varies
only **which page is looked at**, and gets `Rendered clean` back. That is CN-001's lesson — a green
report over a page missing its work — in route-shaped form.

🔴 **Grading changed arm A.** It first asserted `texts > 0`, and with the navigation mutated away the
harness measured the *start* page, which also has text — **the arm stayed green while the instrument
was blind again**. Page three is now the only page that yields `2`, so the count says both *the kit
drew* and *which page was looked at*. ⚠️ *An assertion can be true of the right page and of the
wrong one at the same time; only a value the wrong page cannot produce tells them apart.*

### ✅ The tool-surface trap did NOT need a third renegotiation

Measured, not estimated: **8223 → 8255 of 8280**. The `page` parameter costs **32 tokens** and
**25 remain**. The `$ref`ed node schema that `toolDisclosure.test.ts` names is still the honest
answer for the next one.

---

## 🟡 Session 46's block, kept — AC2 met, AC1 mostly, **AC3 and AC4 NOT** *(superseded above)*

⚠️ **Built from the other end and without seeing this task**, which is worth knowing about rather
than tidying away. UNI-010 §8.2 recorded the same behaviour, routed it to phase 69's CN-001, and
CN-001 closed 20/20 with it still open inside — so the work was picked up as *"UNI-010's remainder"*.
🔴 **This file was missed on the first sweep because the search that should have found it was
`grep -rln startPage … | head -20` — and the answer was at position 21.** *A bounded query reports
its bound*, and the bound is invisible in the output.

Landed in `fce4935c`: `routedPages` / `reachableComponents` / a per-page render loop in
`render-report.js`, the SPA fallback in `render-from-disk.js`, coverage in `measure-from-disk.js`,
and the MCP ceiling 90s → 240s. **11 specs**, each graded by disabling its branch.

| AC | State |
|---|---|
| **1** — each page by its `urlPath`; the start page's own `urlPath` returns 200 | 🟡 **Mostly.** The start page's `urlPath` now returns 200 (specced against a real server), and every routed page is rendered *via* its `urlPath`. **The caller still cannot name one** — there is no path argument, so the tool-surface trap below was never triggered and the 57 free tokens are untouched |
| **2** — sweep renders every registered page; findings attributed, not pooled | ✅ **Met.** Every routed page is visited; each finding carries `page` and names it in its message; `report.pages[]` lists what was measured and what was skipped, with the reason |
| **3** — control: an unregistered path fails *distinctly* | 🔴 **NOT met.** With no caller-supplied path there is no typo to reject. A route naming a component that does not exist *is* reported distinctly (`no component of that name exists in the project`), which is the nearest thing built — it is not this AC |
| **4** — kit injection asserted **per page** | 🔴 **NOT met, and it is the one with teeth.** Nothing yet renders a kit node on page 3 and asserts it drew there. CN-001's fix is still only asserted on the start page |

🔴 **The mechanism recorded in this task's "The job" is wrong, and correcting it is the most useful
thing here.** *"`/home` 404s, therefore anything driven by `urlPath` is unmeasurable"* — the 404 was
real and is fixed, **but it was never what blinded the report.** The runtime's default
`navigationPathType` is `hash` (`router.tsx:_getLocationPath`), and a hash is never sent to a
server: `/#quiz` was served and rendered correctly the whole time. What was missing is that
`render-report.js` never navigated anywhere. ⚠️ **A session that fixed only the 404 would have
re-run the report, seen every number unchanged, and concluded the harness still could not see page
two** — having aimed at the wrong mechanism while holding a correct measurement.

⚠️ **What rendering every page then cost, for whoever finishes AC3/AC4.** `listProbes` returns every
knowable repeater in the *project*, so a page was judged against repeaters it could not contain:
`phase55-replay-sonnet` — the build phase 55 calls **correct** — scored **14 `empty-list` errors**
until probes were scoped to the components each page can reach. Expect the per-page kit assertion in
AC4 to have the same shape: **a per-page check needs a per-page notion of what belongs on that page.**

⚠️ **Cost, measured:** ~4.3s per extra page (two viewports); one page 7.3s → eight pages 40.9s.

## Acceptance criteria

1. On a project with pages at `/`, `/home` and `/quiz`, `render_report` can render **each page by
   its `urlPath`**, and the start page's own `urlPath` returns 200 — the exact case measured
   failing today.
2. A sweep mode (or documented loop) renders **every page the router registers**, and findings are
   attributed to the page they came from, not pooled.
3. **Control (known-broken input):** a path no router registers still fails, *distinctly* — the
   instrument must be able to say "no such page", or a typo'd `urlPath` reads as a pass. A gate
   that cannot reject the wrong answer has measured nothing.
4. The kit-injection behaviour CN-001 fixed is asserted **per page**, not only on the start page —
   a kit node on page 3 renders on page 3.

## Traps

- 🔴 **This instrument is what P67 / UNI-010's F4 grades with** (`NODEGX_RENDER_CLI` →
  `render-report.js` → `render-from-disk.js`). CN-001 carried an ordering obligation for exactly
  this file: **do not land changes mid-way through a UNI-010 criterion run**, and re-baseline any
  scores taken after landing. Check with the P67 lane before merging.
- ⚠️ **The MCP tool-surface budget.** If the path parameter changes `render_report`'s *schema*,
  that spends from the 8,280-token bar (last measured 8,223 — **57 free**, and CN-006/CN-009's
  test forbids another renegotiation). Measure the surface before and after; response-side content
  is free, schema is not.
- ⚠️ `render-from-disk.js` has history: it hand-wrote its own HTML (CN-001) and carried a fourth
  copy of the `defineModule` shim (CN-012, fixed). Don't add another parallel copy of anything the
  real pipeline owns — route through the shared modules.
- ⚠️ `render_report` is still **blind to code modules** (recorded separately) — fixing routing does
  not fix that; don't let a green page-sweep imply it did.

## Out of scope

- Driving interactions on rendered pages (clicks, branch traversal) — this task is page
  *reachability and rendering*, not journey simulation.
- The `noodl-preview` path — it already serves routes; only the headless report chain is blind.
