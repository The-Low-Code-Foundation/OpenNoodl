# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## State: **s17 drove it. D13 is a confirmed cause, SBR-006 AC1 is met, and SBR-008 has a repro.**

The question s14, s15 and s16 could not settle is settled — by watching the mechanism instead of
inferring it from a row. And the drive s16 asked for turned out to be **confounded on that
fixture**, which is a finding in its own right.

Read in this order:

1. **[SBR-008 §6](SBR-008-THE-DEPLOY-KEEPS-THE-PANELS-WIRES.md)** — the whole of s17. **§6.1** is
   the flip, watched happening. **§6.3** is the third state nobody had. **§6.4 is the part worth
   your time**: the person sentence failing, with a control on the same screen.
2. **[D13](DEFECTS-THE-SITE-BUILDER-FOUND.md)** — upgraded from mechanism to **confirmed cause**,
   with a second session-dependent input named.
3. **[SBR-006 §5.9](SBR-006-THE-ADMIN-SHELL.md)** — **AC1 met**, screenshot at
   `notes/sbr006-ac1-three-pages.png`.

---

## 🔴 FIRST JOB — SBR-008's fix. The repro is standing and costs no setup.

**Use a field whose column does not exist yet.** On `SBR-016 Arrive Drive`'s `Edit page` form,
`Title` and `Search description` sit in one form, saved by one button, out of one build:

| field | column exists | wire in the build | result |
|---|---|---|---|
| `Title` | yes | ✅ kept | ✅ saved |
| `Search description` | **no** | ❌ filtered out | 🔴 **silently discarded** |

That is AC1's person sentence failing beside a field that works, differing in exactly one property.
**Build the §2 fix against it** — derive `prop-<field>` from the node's own wires — and the same
pair is the acceptance test. The four wires still broken at HEAD are listed in §6.4:
`Page.seoDescription` (×2), `Section.kind`, `Section.data`.

🔴 **Read this before writing AC2's spec.** AC2 says the census reads *"0 (from 19)"*. In one
session, **with nothing edited**, that number read **32/0**, then **13/19**, then **28/4**. It is
not a property of the template — it is a function of how much of the schema has been written and
whether the editor window has focused with the backend up. **Pin it beside a stated schema state,
or pin it on a project with no backend bound.** A spec pinning `19` today goes red on a correct
project tomorrow.

## What s17 established, and what it deliberately did not

✅ **Established, all driven:**

| | |
|---|---|
| **the flip** | same project, no edit, **2.3 s apart**: `exportComponent(/Pages/Admin)` **13 → 11** connections, census **32 healthy → 13**. `targetPortExists` **false in both** — only the debounced pass landing changed |
| **through the product** | one `ViewerConnection.sendRefresh()` took the **running** preview from **221 → 202** connections. 19 `prop-` wires gone from a live app, no edit |
| **the heal** | `SchemaHandler` fetches on **`window-focused`** → writes `dbCollections` → `recordFieldPorts` mints a port per column → wires go healthy. Census **19 unhealthy → 4**, unattended |
| **the person sentence** | `title` saved, `seoDescription` discarded, one save, screen said nothing |
| **SBR-006 AC1** | **met** — three rows with names, slugs and `Draft` pills, `Three pages, no published`, sidebar and one primary action, screenshot taken |

❌ **Not established:** *which* of `window-focused` / `Model.cloudServicesChanged` fired the schema
fetch. Both reach `_fetch()`; neither was observed. It does not change the account — the input is
the backend schema either way — but it is not written down as if it were seen.

## 🔴 Three traps this session paid for

- **The drive the last prompt asked for could not have answered its question.** It named "one
  variable: when in the session the create happens" — but s15's own write had grown the fixture's
  `Page` class two columns, and those columns mint the very ports whose absence is the defect. Both
  arms came back named and **neither is evidence**. 🔴 **A control pair proves what you varied, and
  a third variable had moved underneath this one.** I named the confound before driving and drove it
  anyway; what saved it was measuring the mechanism in parallel.
- **A control read ZERO for its own reasons — again.** The viewer census reported `0` `prop-` wires
  while the line above it in the same probe listed `closeResult-title -> prop-title`. The viewer's
  connections are `{sourcePort, targetPort}`; the editor's are `{fromProperty, toProperty}`. **A
  zero from the wrong field name is indistinguishable from a zero that means "the wires were
  dropped"** — and it would have read as confirmation. Caught only because two lines disagreed.
- **A probe that truncates is a probe that lies.** `String(e.className).slice(0, 40)` cut the
  generated input ids in half, so every selector built from it missed. Cheap here; it would not be
  cheap on a count.

## Where the ACs now stand

| | verdict | evidence |
|---|---|---|
| **SBR-016 AC1–AC4** | ✅ | s15, §8–§9 |
| **SBR-017 AC1–AC4** | ✅ | s14/s15 |
| **SBR-015 AC1/2/3** | ✅ | s13, §2.3d |
| **SBR-015 AC4** | 🟡 | ⚠️ **re-read it** — a peer landed DEF-004(a) at `d229bf4b`, touching `noodl-runtime/src/node.ts` and `nodegx-backend`'s `WorkflowRunner`. A cloud function now writes an execution step per action. **"0 steps" is no longer the expected reading**; if you see steps, that is their change |
| **SBR-006 AC1** | ✅ **MET** | s17 — §5.9, screenshot |
| **SBR-006 AC2** | 🟡 | still on SBR-008. AC1's rows are named because *this fixture's schema grew*, not because anything is fixed |
| **SBR-006 AC3/4/5** | ✅ | s9, s12, s13 |
| **SBR-008 AC1** | ❌ | unmet — **but now reproducible on demand**, §6.4 |
| **SBR-008 AC2** | ⚠️ | **unsafe as written** — the number moves on its own, §6.5 |
| **SBR-008 AC5** | ⚠️ | must hold **two** things constant, not one: the health pass *and* the introspected schema |

## Standing context

- 🔴 **Drive fixtures — `SBR-016 Arrive Drive` has moved.** It now holds **three** `Page` rows
  (`About us EDITED`/`about`, `Arm A Early Build`/`arm-a-early`, `Arm B Settled Build`/`arm-b-settled`)
  and its `_Schema.Page` carries `title` and `slug`. **It can no longer answer a question about a
  site nobody has written to.** For that use **`SBR-017 Sign In Drive`** (`backend_mte82r1qhnr87`,
  8599, `drive-token-017`, `owner@sbr017.test` / `drive-pass-017`) — `Page` still has only
  `published, showInNav, navOrder`, and s17 deliberately did not spend it.
  016 is `backend_mte9omazclxw6`, port 8600, `owner@sbr016.test` / `drive-pass-016`; the browser
  session persists in the webview's localStorage, so a drive arrives already signed in.
  `SBR-015 AC1 Drive` (`backend_mte62ofkj8whc`, 8598) is left in the **refusal** arm.
- ✅ **Reaching the editor's models headlessly** — there is no editor global, but the webpack
  registry is reachable:
  `window.webpackChunknoodl_editor.push([['probe'], {}, (r) => { window.__wr = r; }])`, then
  `__wr('./src/editor/src/models/projectmodel.ts').ProjectModel.instance`. Module ids are source
  paths. This is how §6.1 was measured and it is the cheapest instrument in this phase.
- ✅ **Arm a probe BEFORE the act.** §6.1 exists only because a 1 Hz sampler was running before the
  project was opened. The interesting state lasted **2.3 seconds**.
- 🔴 **Read this before any drive of the preview** (unchanged): the preview webview can give the
  viewer a **`96 × 0`** viewport — s17 got `988 × 313` and needed no override, so **measure it, do
  not assume either way**. ✅ `Emulation.setDeviceMetricsOverride` must be **on the same connection
  as the clicks**. `Page.reload` on the viewer target kills it; `location.href` does not reach a
  page; the `cdp eval` context **persists between invocations**, so wrap every eval in
  `(() => { … })()`.
  ⚠️ **Corrected:** `npm run cdp -- screenshot --target=viewer` does **not** hang — it returned a
  988×313 PNG in ~10 s. The prompt has carried "it hangs" since s14.
  ✅ In-app navigation: `Noodl.Navigation.navigateToPath('/admin/pages')`. The router answers, the
  address bar follows.
- 🔴 **A plain `jest` run is NOT in `NEVER_SWEEP`** (`dev-processes.js:269`) — only
  `test:ci`/`test:main`, `noodl-mcp.cjs`, `test.js --ci`, `run-electron-tests.js`,
  `webpack.test-ci`. **An editor launch sweeps a peer's package suite**, and a swept suite reads as
  `EXIT=137` with no summary line. s17 waited one out rather than launching over it.
  ✅ **Fixed the same day at `cbfc5fb3`** — `.bin/jest` and `npm exec jest` are now in `NEVER_SWEEP`,
  gated by `noodl-editor/tests-unit/dev-tools/a-sweep-spares-a-peers-suite.test.ts` (13 cases, both
  arms), and the shield covers the whole tree. **Still run `dev:stop -- --list` and read it**: it is
  the only instrument that shows the hazard, and a dry run on a quiet checkout cannot.
- Shared checkout: **pathspec commits only, never `git add`**; announce editor launches **and**
  teardowns; `test:ci` alone, never beside a live stack.
- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
