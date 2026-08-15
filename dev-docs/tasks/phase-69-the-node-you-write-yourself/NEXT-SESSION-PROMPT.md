# Phase 69 — next session

**Written 2026-08-16.** Both tier-0 tasks are closed and committed. The phase's own scoping docs,
which had been sitting **untracked** since 2026-08-15, are now committed too.

Read [TASKS.md](TASKS.md) and [RULINGS.md](RULINGS.md) first — all eight rulings are made and the
queue is empty, so nothing below is blocked on a decision.

## ✅ Closed this session

| Task | Commit | One line |
|---|---|---|
| **CN-001** | `ed28a03c` | The render harness was blind to kits. `@nodegx/module-inject` extracted; `render-from-disk.js` injects. |
| **CN-002** | `378793bc` | A skipped check now says it was skipped. `unknown-type-check-skipped`, info-only. |

Each task's own file carries the measurements. Two things from them are worth having in front of you
before you start anything else.

### 🔴 The defect in CN-001 was not the one the spec described, and the shape recurs

The spec predicted a **blank**. What actually happened is that the page rendered *everything except
the kit node* and `render_report` reported **"Rendered clean", `findings: []`, `consoleErrors: []`**.
A blank looks like a failure; this looked like a pass.

Expect more of this in the phase. `unknown-node-type` warns and then everything downstream skips
silently; the catalog is built from built-ins only, so *every* consumer of it is uninformed in a way
that reads as approval. **When a tier-1+ task says "X is unsupported", check whether X is actually
reported as fine** — that has now been the true state twice out of two.

### 🔴 Two specs in this phase named controls that do not work

Both were written from memory rather than from a run:

- **CN-001** said to point the render harness at `NodeGX test projects/cashflow-command-centre`. That
  project is **v1** — `project.json`, no `nodegx.project.json` — so `render-from-disk.js` rejects it
  with exit 2 and always would have. A v2 control had to be built:
  **`NodeGX test projects/cn001-kit-drive`**, which is the one to reuse for any render check
  involving a kit. It deliberately carries a built-in `Text` beside the kit node, because without one
  "the kit node is missing" and "the render died" are the same empty page with opposite fixes.
- **CN-002**'s criterion 1 assumed one validation pipeline where there are two (see below).

**Before trusting any other spec's stated fixture, run it once.** `validate:project` *does* read the
v1 cashflow project fine — the two tools differ, which is exactly why reading is not enough.

## Where to go next

**CN-003, the keystone.** It is the only sensible next task and everything in tiers 1–4 hangs off it.
✅ Unblocked — D3 and D7 are ruled. It is effort **L**, so it needs slicing before it starts; do not
open it expecting to finish in a session.

Its shape is settled by D3 and should not be re-litigated: the **MCP server** extracts headlessly
(executing the kit's `index.js` against the live register, reusing `scripts/node-catalog/dom-shim.js`),
the **editor does not extract at all** — it reads what the viewer already sent over `sendNodeLibrary`
— and there is **no on-disk cache**. It must check that the two sources agree.

**What CN-002 hands it:** a number. Run
`npm run validate:project -- "…/cashflow-command-centre"` today and you get
`0 error(s), 5 warning(s), 8 info`. When the overlay lands, those 8 `unknown-type-check-skipped`
lines should go to **zero** and be replaced by real results. That is a far better acceptance signal
than "validation seems to work now", and `tests-unit/cn-002/` is what notices if they vanish for any
other reason. Take the reading **before** you start.

⚠️ **Do not route CN-003 through the project validator alone** — see the finding below.

### 🔴 An open ruling CN-002 turned up, and it is not kit-specific

`checkParameterValues` has exactly **one** caller, `authoredPreconditionDiagnostics`. So
`npm run validate:project` and MCP `validate_project` **never check parameter values for any node** —
kit or built-in. Only the AI-authoring path (MCP `validate_component`, the editor's authoring loop)
does.

This is why CN-002's `parameter values` info does not appear in the CLI output above, and it means
the 26 unverified parameters on the cashflow kit nodes are unverified at project level *for
everyone*. Widening the project gate is a scope call rather than a tier-0 fix, so it was not taken.
**Put it to Richard before CN-004**, because CN-004 ("turn the checks back on") is written as though
turning them on in one place turns them on everywhere, and it does not.

## 🔴 A SECOND falsely-green route in the same harness — measured, not fixed

Found at the end of this session and **measured here rather than relayed**. ⚠️ **Source, stated
precisely because it took two corrections to establish:** the observation came from the **phase 67 /
UNI-010 criterion-3 session** (socket `61336`), reached me second-hand via a third session that
mistakenly relayed it as its own, and the `GET`/`404` measurement below is this session's. If you
need the surrounding context, **ask 61336** — the relaying session is a dead end for it.

`render-from-disk.js` serves the page for `/` and `/index.html` **and 404s everything else**:

```
GET /            -> 200
GET /products    -> 404   ("not found: /products")
```

⚠️ **Sharper than first written, after the originating session re-ran it and I re-ran it again:**
`/home` — the START page's own declared `urlPath` — **also 404s**. So the harness answers exactly one
URL and lets the SPA boot to whatever the Router names; it does not render "one route", it can reach
**no named route at all**. Anything about `urlPath` — a Page node's URL, route parameters, deep links
— is therefore unmeasurable **on the first page too**, so "serve every routed page" is necessary but
**not sufficient**. `render_report` on a multi-page project measures one page and reports
*"Rendered clean"* for the whole project — a second instance of exactly what CN-001
fixed, one level up. The generalisation is worth writing down as the phase's standing rule:

> **A probe needs its own known-broken control on every route it claims to cover.**

**Not fixed** — it is outside CN-001's scope (that task is about module injection, not routing) and
it should be its own task. It matters to this phase because a kit node placed on a non-start page is
currently unmeasurable, so any CN-0xx verification that puts a kit on a second page will silently
measure nothing. Worth a task number before tier 4.

## Cross-phase, still live

- 🔴 **Phase 67 / UNI-010 criterion 3: CN-001 landed FIRST.** The five-lesson run had not started, so
  **score all five after this change** and do not split the run across it. Nothing already measured
  is invalidated — criterion 2's 8/8 used lesson projects with no kits.
- **CN-001 is new input to P67's F4 scope call.** Its extraction of the pure half into a no-build
  workspace package is the structural half of "ship the render harness with the sidecar". It does
  **not** close the hole (`scripts/` is still outside `build.files`), but it makes that option much
  cheaper. Put it in front of Richard **with** the call, not after it.
- **The MCP token budget is untouched by this session.** `toolDisclosure.test.ts` is green and no
  tool schema enumerates `DiagnosticCode`. CN-006/CN-009 still compete for the same **57** free
  tokens, and the test still forbids a third renegotiation — the sanctioned move is a `$ref`ed node
  schema.
- ⚠️ **From session 26's FIX-016 drive, relevant to CN-003 and CN-010 — recorded in its
  CORRECTED form.** The first version reached me as *"`node.dynamicports` disagrees with the rendered
  property panel in **both** directions"*; its author **withdrew that within the hour** (`db8efa74`)
  because one of the two directions was the gate working correctly. **The narrowed, surviving claim
  is:** the rendered panel is a reliable readout of what is **declared**, and `node.dynamicports` is
  a **cache of what a runtime last pushed** — so its *presence* implies nothing about rendering and
  its *absence* implies nothing either. That is a claim about **staleness**, not a claim that the
  panel is the only honest surface. Both tasks reason about ports; do not read that field as ground
  truth in either direction.

  Written out this way on purpose: the broad version and the narrow version have different
  consequences for CN-003 (which has to decide what the editor's overlay reads from), and a relayed
  conclusion loses its scope faster than a relayed measurement.

## Traps this session paid for

- ⚠️ **A new package's tests run in no gate unless you add it.** `test:packages` scopes by name.
  `@nodegx/render-measure` had been outside it since 2026-08-10 and its purity tests had never run.
  Both it and `@nodegx/module-inject` are in scope now — check the scope list when you add a package.
- ⚠️ **A NUL byte can get into a source file and git will call it binary.** It happened here in a
  template literal's separator; the tell was `Bin 5066 -> 6144 bytes` in `git diff --cached --stat`.
  A file git treats as binary is also one `grep` will skip, so it hides more than the diff.
  **Read the staged stat before committing.**
- ⚠️ **`test:main`'s recorded floor was wrong.** The often-quoted *203 / 3136* does not reproduce:
  this tree without the two new suites is **203 / 3140**, and no commit since tree `d0891746` touched
  `tests-unit/` or `tests-main/`. Current with both suites: **205 / 3157**.
- ✅ **`test:main` is plain Node and safe beside a live editor**, which is how both tasks were
  verified while a peer drove FIX-016. `tests/utils/projectmodules.test.ts` lives in the Electron
  suite but is pure, so `npx jest --testMatch=…` runs it without launching anything — worth knowing
  when the Electron suite is unavailable.
