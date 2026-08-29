# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## State: **s16 re-measured s15's "SBR-008 did not reproduce" and it closes nothing.**

s15 read a `Page` row carrying `title` and `slug` and recorded — correctly — that this was an
observation, not a closure, *"because the fixture differs in more than one way"*. **It does not.**
The two fixtures are the same project on every axis that can be measured statically, and the
mechanism that drops these wires cannot tell them apart. **SBR-006 AC1/AC2 do not unblock**, and
SBR-008 is not paid.

Read in this order:

1. **[SBR-008 §5](SBR-008-THE-DEPLOY-KEEPS-THE-PANELS-WIRES.md)** — the whole of s16. §5.3 and §5.4
   correct two premises in the task's own §2. **§5.7 is the part worth your time**: the spec this
   task's census rests on had never run, and its known-firing control could not have caught that.
2. **[DEFECTS-THE-SITE-BUILDER-FOUND.md](DEFECTS-THE-SITE-BUILDER-FOUND.md)** — **D13** is new and
   `NONE`, deliberately not SBR-008's.
3. **[THE-SWEEP-2026-08-29.md](THE-SWEEP-2026-08-29.md)** — now 57 rows, 18 unowned.

---

## 🔴 FIRST JOB — one drive, and it pays twice

**On `SBR-016 Arrive Drive`, create a second page late in a settled session.** Same fixture, same
act, **one variable**: when in the session the create happens.

- A row that arrives **nameless** confirms SBR-008 §5.4's timing account and closes the question of
  why s14 and s15 disagreed.
- A **second named row** refutes it and sends the search back to the fixtures — and either way it
  is the second row **SBR-006 AC1** has been waiting for since s9.

⚠️ This mutates the current drive fixture by adding a row. That is wanted here (AC1 needs two rows);
note it, because the standing rule is *do not overwrite drive fixtures*.

🔴 **Read the control first.** `/Pages/Admin`'s `create` announces **no** `prop-title` — now
*measured*, not inferred (§5.7). So a named row is the surprising outcome, not the expected one.

## What s16 established, and what it deliberately did not

✅ **Established, all from disk and source:**

| | |
|---|---|
| the two fixtures | identical `prop-` wires, identical dialog graph, byte-identical `nodegx.security.json`, same metadata keys, **same provisioned `Page` columns** |
| the provisioned baseline | **three columns**, excluded rather than assumed — same provisioning code both times, and 017 shows a set a write can only add to (§5.2) |
| the product code | **no commit** touched `record-ports.ts`, `schema-ports.ts`, `exporter/util.ts` or `NodeGraphModel.ts` after 08-28 12:00 |
| the filter | **one `exportComponent`, three callers** — viewer bundles (`editorapi.js:88`), incremental preview (`ViewerConnection.ts:993`), deploy (`deployer.ts:108`). **Preview is behind it.** |
| `getConnectionHealth` | reads **no ports** — it reads `WarningsModel` and returns `healthy` when nothing has been evaluated yet; the pass is debounced ≈2 s and **no export caller forces it to settle** |

❌ **Not established:** *which* timing obtained in s14 and s15. The debounced store is the only
session-dependent input on the path and it is **a candidate, not a confirmed cause**. Recording it
as the cause would be the reading-that-fits trap.

## 🔴 Three traps this session paid for

- **A blank red is not a flake.** `the-browser-half-drops-every-record-field.test.ts` failed with a
  completely empty message for its central assertion. `dbmodelcrudbase.ts` had no `/// <reference>`
  to `noodl-runtime/src/globals.d.ts`, so required from noodl-editor's jest it threw `TS2304` at
  require time for six of seven Record nodes — and **ts-jest renders a `TSError` with no message**.
  The `toEqual([])` was passing on an array the harness never filled. One line fixed it; the
  assertion now holds for the right reason. **Any spec requiring a runtime module from another
  package's program has this hole.**
- **A control must be scoped to the population the rule is ABOUT.** That spec has a known-firing
  control placed for exactly this failure mode. It passes — because it exercises the Query and
  script families, whose modules compile. It could never have caught a break in the Record family.
- **A control can read ZERO for its own reasons — read it first.** Twice in one session: a probe
  reporting "no `prop-` ports anywhere" was walking `component.nodes` on an artefact that nests
  under `component.graph.roots` (`asked=0`), and a failure-name parser reported `0 failures` on a
  readout whose `failedCount` was 4. Both would have read as good news.

## Where the ACs now stand

| | verdict | evidence |
|---|---|---|
| **SBR-016 AC1–AC4** | ✅ | s15, §8–§9 — unchanged |
| **SBR-017 AC1–AC4** | ✅ | s14/s15 |
| **SBR-015 AC1/2/3** | ✅ | s13, §2.3d |
| **SBR-015 AC4** | 🟡 | `execution_steps` 0 rows — the task says why, and it is right |
| **SBR-006 AC1/AC2** | 🟡 | 🔴 **still blocked** — s15's observation does not unblock them (§5.5). The drive above is what does |
| **SBR-006 AC3/4/5** | ✅ | s9, s12, s13 |
| **SBR-008 AC1** | ❌ | unchanged and unmet. 🔴 **AC5 is wrong as written** — it says the control pair *"varies only the deploy"*, and preview and deploy share the filter, so such a pair varies nothing on the path that drops the wires |

## Standing context

- 🔴 **Drive fixtures — do not overwrite** (except as the first job states).
  **`SBR-016 Arrive Drive`** (backend `backend_mte9omazclxw6`, port 8600,
  `SITE_SETUP_TOKEN=drive-token-016`, owner `owner@sbr016.test` / `drive-pass-016`) is the current
  one. **`SBR-017 Sign In Drive`** (`backend_mte82r1qhnr87`, 8599, `drive-token-017`,
  `owner@sbr017.test` / `drive-pass-017`) pre-dates the SBR-016 fix — and s16 measured it identical
  to the 016 project on every static axis, so it is a usable second arm, not a spent one.
  **`SBR-015 AC1 Drive`** (`backend_mte62ofkj8whc`, 8598) is left in the **refusal** arm.
- 🔴 **A project is a copy of the template at mint time**, and for anything `runOnChange`-shaped
  verify it **after the project has been opened** — that is when the migration runs.
- 🔴 **Read this before any drive of the preview** (unchanged from s14/s15, still the thing that
  will cost you twenty minutes): the editor's preview pane gives the viewer webview a **`96 × 0`
  viewport**. Every CDP click reports success, arrives `isTrusted: true`, and hit-tests to `<html>`.
  ✅ `Emulation.setDeviceMetricsOverride` **on the viewer target, on the same connection as the
  clicks** — `npm run cdp` opens one per invocation and the override dies with it. Also:
  `Page.reload` on the viewer target **kills it**; `screenshot --target=viewer` **hangs**;
  `location.href` does not reach a page; and the `cdp eval` context **persists between
  invocations**, so wrap every eval in `(() => { … })()`.
- ✅ **Gates run in s16**: `typecheck:mcp` clean; `tests-unit/sb-017/` **12/12**; `test:ci`
  **2889 specs, 4 failures — the floor, all four `AIX-006 style vocabulary` by name**, fresh
  readout, seed 92053. ⚠️ The readout's `gitHead` was `e453d5f2`, a peer's commit — `test:ci`
  webpacks the working tree, so a peer's uncommitted work is silently inside your measurement.
- Shared checkout: **pathspec commits only, never `git add`**; announce editor launches **and**
  teardowns; `test:ci` alone, never beside a live stack.
- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
