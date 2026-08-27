# SB-017 — the deploy drops half the cloud graph, and every endpoint times out

**Status: 🟢 FIXED AND DRIVEN s17 — acceptance 1, 2, 3, 5 and 6 MET; 4 met on the cloud side.**
Measured s15, §6 resolved and the ruling taken s16 (§8), built s17 (§10).

Found by the drive nobody had run: making a project from `embedded://site-builder` in the
real editor, opening it, provisioning a backend through the real UI, and calling the
endpoints.

## 1. The claim

**Every cloud function in the shipped Site Builder template times out when it is deployed
through the editor.** Not "is slow", not "refuses" — answers nothing, for 30 seconds, and
then the backend gives up.

- `claimSite`, called from the template's own Setup page with a real signup and the real
  generated setup token: execution record `status = error`, duration **30005 ms**,
  `Cloud function "claimSite" did not send a response within 30000ms`.
- `submitContactForm`, whose policy is `public`, called with curl and no credential at all:
  **HTTP 504 in 30.017 s**, same message.

Two of the two endpoints reachable without an admin session. They fail identically, and
`claimSite` is the one that mints the admin, so nothing downstream of it is reachable either.

## 2. The mechanism, measured rather than inferred

**The editor's deploy silently drops every connection whose port the target node does not
declare.** Counted over the deployed bundle
(`~/.noodl/backends/<id>/workflows/<project>.workflow.json`) against the project on disk:

| component | on disk | deployed | dropped |
|---|---|---|---|
| `publishPage` | 16 | 5 | **11** |
| `duplicatePage` | 22 | 8 | **14** |
| `submitContactForm` | 19 | 9 | **10** |
| `claimSite` | 20 | 14 | **6** |
| `site/CopySectionToPage` | 9 | 4 | **5** |
| `site/ContactRecipient` | 9 | 5 | **4** |
| `site/SetSectionAccess` | 5 | 4 | **1** |
| **total (cloud)** | **100** | **49** | **51** |

**51 of 100.** Half the cloud graph does not reach the backend.

`claimSite`'s `JavaScriptFunction` is the clearest case. On disk it is wired
`in-expected`, `in-supplied`, `in-unclaimed`, `in-rows`, `run` in and
`out-ok`, `out-claimed`, `out-denied` out. In the deployed bundle the node declares only
`out-ok` and `out-denied`, and the only surviving wires are `run` in and those two out —
**all four `in-*` connections and `out-claimed` are gone.**

So the script's first line, `if (Inputs.rows === undefined) return;`, returns every time.
Nothing is published, no `Response` node is ever reached, and the request hangs until the
30-second cap. The backend's own timeout message even names the shape —
*"Check that every path through the graph reaches a Response node"* — and it is right about
the symptom and misleading about the cause: every path **does** reach one in the authored
graph. The paths were deleted on the way.

State left behind by the timed-out `claimSite`: `_User` 1 (the signup worked),
**`_Role` 0**, **`_Join_users__Role` 0**, and `Page` / `SiteSettings` / `Theme` present as
tables with **0 rows**. `execution_steps` is **empty for a 30-second execution** — the graph
never advanced past its first node, so it did not run the gate and deny. It never ran.

## 3. This is SB-010, and SB-010 understated it

[SB-010](SB-010-THE-SCRIPT-PORTS-THE-DOOR-DOES-NOT-WRITE.md) recorded that the MCP door does
not derive a `JavaScriptFunction`'s script ports, and filed the consequence as *dead custom
signal outputs once deployed*. The consequence is larger: the **inputs** go too, and a node
that receives no inputs does not misbehave subtly — it never runs, and the endpoint hangs.

SB-004 F10 fixed the signal-output half by hand, by declaring `out-ok`/`out-denied` as ports
on the node. That is exactly the two ports that survive. **The fix was applied to the half
that had been noticed.**

## 4. 🔴 Why every existing test passes

`nodegx-backend/tests/sb004-publication-invariant.test.ts` deploys these same component sets
and its 29 specs are green. It builds its runtime bundle with a **test helper**,
`nodegx-backend/tests/helpers/authored-bundle.ts` — **not the editor's deploy path**.

So the suite measures a bundle the product never builds. Same graphs, two deploy paths,
opposite outcomes, and the path nobody had run is the one a person gets.

This is the phase's own recurring shape, and the second instance of it in this task file:
SB-015 §6.5 found that `SITE_SECURITY` was a typed constant in a test helper, so SB-008 had
measured a publication boundary produced by a file no project would ever receive. That was
fixed by making the helper import the shipped artefact. **The same question was never asked
of the bundle**, which is the larger half.

⚠️ **The lesson is not "the helper is wrong".** The helper exists because the editor's
converter needs a live `NodeLibrary` (SB-004 §7). The lesson is that a helper standing in for
a product path owes a test that the two agree — and there is no such test.

## 5. The editor says so on open, and nobody had looked

Opening the project raises **84 `port doesn't exist` warnings** (`WarningsModel` holds 85; the
badge shows 84 and the extra is a script warning on `/Pages/Site`). Census by port prefix,
taken from the editor's own connection refs:

| ports | count | what they are |
|---|---|---|
| `in-` target 22 + `out-` source 22 | **44** | `JavaScriptFunction` script ports — this defect |
| `prop-` | 32 | Record / `NewDbModelProperties` property ports |
| `qp-`, `acl-` | 4 | query-parameter and access-control ports |
| plain | 4 | see [SB-018] below |

🔴 **Re-measured with a real backend created, bound, started and holding the schema: the same
84.** The obvious reading — *no backend, so no schema, so no dynamic ports* — is refuted by a
control that varied exactly one thing.

**The warnings are a preview of what the deploy will delete**, and that connection had never
been drawn because nothing had ever opened this template in an editor.

⚠️ Bounded honestly: saving does **not** prune them. 255 connections in the shipped artefact,
255 on disk after install, 255 after the editor's own save. The project file is faithful; only
the deployed bundle is lossy.

## 6. RESOLVED s16 — it is not the door, and it is one cause, not two

§6 used to ask three questions. A reading of four files answered all three, and the answer
moves the fix off the authoring door entirely.

### 6.1 The node is not "written incomplete" — incompleteness is the norm

The reading §6 called "one file away" was that `claimSite`'s `gate` declares only
`out-ok`/`out-denied` on disk, so perhaps the converter is merely being honest about a badly
written node. **It is not.** Every `JavaScriptFunction` in the template persists a short
`ports` array, on both runtimes, and the browser side is *shorter*:

| | undeclared script-port connections | warnings raised |
|---|---|---|
| browser components | **69** | **0** |
| cloud components | **44** | **44** |

`/Site/SectionView`'s `unpack` declares **zero** ports and its script reads two `Inputs` and
writes six `Outputs`; `/Pages/Site` has 24 such connections. SB-008 drove that page
successfully. The disk shape is identical across the two runtimes and only one of them
breaks, so the shape is not the cause. **The authoring door is exonerated** — writing ports
there would give cloud nodes something no browser node has, and would still not help a node
authored in the editor or typed by hand.

(The static count of 44 on the cloud side is *exactly* the 44 script-port warnings s15
counted live in `WarningsModel`. Two independent instruments, same number.)

### 6.2 The runtime never needed the ports at all

`NodeScope.createConnection` calls `registerInputIfNeeded` / `registerOutputIfNeeded` on the
wire's own ports before connecting it (`noodl-runtime/src/nodescope.ts:149-150`), and
`simplejavascript.ts:637,684` registers any `in-*` / `out-*` name on demand. **The wire is
the declaration.** That is why `authored-bundle.ts`, which drops nothing, produces working
functions — its header's choice ("a wire the door accepted is a wire the runtime should be
given") was right, and right for a reason it did not know.

### 6.3 The cause: dynamic ports have had no cloud client since WF-007

The editor learns a node's *dynamic* ports from a connected runtime client pushing
`sendDynamicPorts`. `SimpleJavascriptNodeModule.setup` is gated on
`editorConnection.isRunningLocally()` and runs **in the viewer**, not the editor.

**WF-007 deleted the hidden cloud-runtime window**, and `NodeLibraryImporter.ts:285` says so
in as many words: *"the cloud types used to come from the hidden cloud-runtime window WF-007
deleted, and since then there have been none."* WFA-001 replaced it with
`cloud-node-library.json` — a **static** snapshot, which by construction carries statically
declared ports and nothing a node computes.

So for cloud components, **every dynamic-port family is missing at once**. Not just the
script ports:

| family | what generates it | resolved for cloud today |
|---|---|---|
| `pm-` | Request/Response `params` | ✅ **yes** — WFA-009's `namedports/list` rule |
| `in-` / `out-` | `JavaScriptFunction` script parse | ❌ no |
| `prop-` | Db property nodes, from the schema | ❌ no |
| `qp-`, `acl-` | query-parameter / access-control | ❌ no (a `QueryRecordsAdapter` exists and is partial) |
| `storageFetch` | `DbCollection2`'s dynamic `Do` port | ❌ no |

`pm-` is resolved *because WFA-009 already built the editor-side generator this task needs* —
for one family. Everything else is the same hole with no rule written.

### 6.4 🔴 The composition, and why "fix the script ports" is not enough

Simulating the editor's port resolution against the committed `cloud-node-library.json`
reproduces **all seven** components' deployed connection counts exactly — 49 kept, 51 dropped,
the same numbers s15 read off the bundle. That model then splits the 51:

**51 dropped = 32 script-port-only + 19 involving a schema-family port.**

The chosen fix for script ports clears 32 and **leaves 19**, and the 19 are load-bearing:

- 🔴 `claimSite`: `noodl.cloud.secret.done → DbCollection2.storageFetch`. This is the wire that
  **starts the function**. With every script port restored, the collection still never fetches,
  so `fetched` never fires, so `gate.run` never fires, and `claimSite` still hangs for 30 s.
- `submitContactForm`: all four `request.pm-* → NewDbModelProperties.prop-*` wires. The graph
  would run and store a `ContactMessage` with no name, email, message or page.
- `publishPage` / `duplicatePage` / `CopySectionToPage` / `SetSectionAccess`: the `prop-` and
  `acl-` wires that carry the values being written, including `acl-world-read` — the
  publication boundary itself.

⚠️ **SB-018 filed `storageFetch` as one of three small things.** It is on `claimSite`'s
critical path. It is not small, and it should be closed as part of this task, not that one.

**The lesson is §3's, one level up.** SB-004 F10 fixed the half that had been noticed
(signal outputs); SB-010 filed the half it had noticed (script ports); a fix scoped to script
ports would be the third pass of the same mistake. **Scope the fix to dynamic ports as a
family, not to the family that happens to be visible.**

### 6.5 Still not known

- **Whether the browser half is affected.** `build/deployer.ts` exports through the *same*
  `exportComponent`, so the same drop applies wherever a browser connection carries a warning.
  The browser's script ports are safe (the viewer derives them), but 32 of the 40 browser
  warnings s15 counted are `prop-`. SB-008 drove the public site successfully, so what it
  exercised survives; nothing has clicked the admin panel. **Unbounded, and worth measuring
  before 0.2.1.**
- ~~Why the `prop-`/`qp-` warnings persisted with a live backend holding a schema~~ —
  **ANSWERED s17, and it is not a bug in the reading.** The backend held **no schema**. Its
  `dbCollections` metadata, written by a live, bound, started NodeGX backend, is three of the
  five classes with **`columns: []` on every one**
  (`~/Documents/sb015-editor-drive/nodegx.project.json`). `recordFieldPorts` builds `prop-*`
  from introspected columns, so it had nothing to build from — and `qp-` never came from the
  schema at all, it comes from `visualFilter`, which no cloud client was reading.
  🔴 **This is permanent, not transient.** On this backend a column exists once something has
  written it, and the graph that writes it is the graph whose ports are missing. **A fresh
  site can never have the schema its own `prop-` ports would need** — so the schema route
  would not have worked before WF-007 either, and §10's derivation cannot use it.

## 7. Acceptance for whoever takes this

1. A test that the editor's deploy path and `authored-bundle.ts` produce the same connection
   count for the same components — the assertion whose absence let this ship.
2. `claimSite` answers a real request, and the site can be claimed from the template's own
   Setup page.
3. `submitContactForm` answers.
4. The 44 script-port warnings are gone on a freshly installed project, or their absence from
   the deployed bundle is shown to be harmless with something better than an argument.
5. A known-firing control: a graph whose ports really are wrong still fails.

## 8. The ruling, taken 2026-08-27 (s16)

Richard, given §6: **derive the ports in the editor for cloud components** — replace the
client WF-007 deleted, rather than patching the exporter or the authoring door.

Rejected, and why:

- **The authoring door** — §6.1. The door is not where this breaks.
- **Derive at export time only** — fixes the bundle and leaves the canvas showing 84 red
  warnings on a freshly installed project. Acceptance 4 would have to fall back to its weaker
  "shown to be harmless" branch, and the canvas would still be lying to the author.
- **Stop the exporter dropping unhealthy connections** — makes the two paths agree by
  construction, but by removing the check rather than feeding it, and it changes the browser
  deploy too. The health filter should keep meaning what it says.

**Where the code goes is already prescribed**, by `dynamicPortRules.ts`'s own header:

> *"A node whose ports depend on a database schema, on another component, or on a parsed
> script writes a `NodeTypeAdapters` class instead — which is what `PageInputs`,
> `RouterNavigate` and `Router` already do. Growing this rule an escape hatch until it is code
> in JSON is the failure mode to avoid."*

So: **not** a new `namedports/list` rule — an adapter per family. The script-port parser
already exists and is shared (`JavascriptNodeParser.parseAndAddPortsFromScript`, the same one
the viewer-side module calls), so the adapter is a caller, not a reimplementation.

⚠️ Per §6.4 the work is **two families, not one**. A change that clears the 32 script-port
connections and stops has not fixed `claimSite`.

## 9. Acceptance, revised s16

Superseding §7 where they differ, and keeping its numbering:

1. ✅ **WRITTEN AND RED (s16)** — `noodl-editor/tests/cloud/sb017-deploy-connection-parity.test.ts`.
   For the shipped template's seven cloud components the editor's deploy path must emit the
   **same 100 connections**; today it emits 49, asserted per component rather than as a total
   (a total can be right while two components are wrong in opposite directions).
   ✅ **The deployed bundle is vendored** as `tests/cloud/fixtures/sb017-deployed-bundle.workflow.json`,
   byte-identical to the drive's (md5 `57360404…`). It had lived only in `~/.noodl/backends/`,
   where the Backend Services overflow menu deletes it with no confirmation — a reference
   artefact one menu click and ~20 minutes of driving from being unreproducible.
   Two further cases ride on it, and **both stay green after the fix**:
   *the deployed bundle is a strict subset of the template* (a frozen record of the defect, and
   proof the deploy only **drops** — no wire was re-pointed on the way out), and *the export
   never loses a connection production already had* (a fix that reached 100 by re-pointing
   wires rather than restoring them would satisfy every count and still be wrong).
   🔴 Ids are compared **type-qualified**, as multisets — a project made from a template gets
   fresh ids (F9), and `claimSite` holds two Response nodes, so de-duplicating would forgive a
   lost wire.
2. `claimSite` answers a real request and the site can be claimed from the Setup page.
   🔴 Needs **both** families (§6.4).
3. `submitContactForm` answers **and stores the four submitted values** — the original wording
   would pass on a record full of nulls.
4. The 84 warnings are gone on a freshly installed project. Now reachable rather than a
   fallback, because the fix is on the canvas side.
5. A known-firing control: a graph whose ports really are wrong still fails, still warns, and
   its connection is still dropped. **Without this the fix is indistinguishable from deleting
   the health check.**
6. 🆕 A negative control on the browser half: the 69 undeclared browser script-port
   connections must still export, i.e. the adapter must not be the only thing keeping them
   alive once it exists.

## 10. The fix, s17 (2026-08-27)

Commit `0236a696`. **49 of 100 becomes 100 of 100**, per component, through the product's own
`exportComponent`.

### 10.1 What was built

Two files, plus three lines of registration:

- **`models/nodelibrary/cloudDynamicPorts.ts`** — the derivations, importing nothing (like
  `dynamicPortRules.ts`, and for the same reason: `tests-unit/` is the only runner in this
  package that can grade this without starting Electron). `in-`/`out-` from the two proplists
  and the parsed script; `prop-`/`acl-` on the Record family; `qp-` and the dynamic `Do` on
  Query Records.
- **`models/NodeTypeAdapters/CloudDynamicPortsAdapter.ts`** — the plumbing. **Three** adapter
  classes, not one, because `setDynamicPorts` **replaces** a node's dynamic port list: two
  adapters writing to one node would silently erase each other, so the families are
  partitioned by node type and each type has exactly one writer. `prop-` and `acl-` therefore
  share one adapter — they are two port sets on one node, as they are in the runtime, where
  `_additionalDynamicPorts` chains onto one list.
- **`registeradapters.ts`** gains `Model.connectionAdded` / `Model.connectionRemoved`
  bridges. **No adapter had ever listened to either**, which is why they had to be added
  rather than merely subscribed to.

🔴 **Cloud components only**, which is §8's wording rather than caution. A browser Function
node **already has** these ports — the viewer is a connected runtime client and pushes them
(§6.1: 69 undeclared browser script-port connections, **0** warnings). An adapter running
there would be a second writer with a *shorter* list, and the two would overwrite each other
on every parameter change.

### 10.2 🔴 `prop-*` is derived partly from the wires, and that is a measurement

Every other family comes from parameters. `prop-*` cannot: the runtime builds it from the
**introspected columns of the selected class**, and §6.5 above now records that a live, bound,
started backend for this project reports `columns: []` on every class it knows — permanently,
because a column exists once something has written it and the graph that writes it is the
graph whose ports are missing.

What the editor does know is what the author wired, and **the runtime agrees with it
exactly**: `registerInputIfNeeded` mints `prop-<anything>` on the wire
(`dbmodelcrudbase.ts:639`), and `NodeScope.createConnection` calls it before connecting
(`nodescope.ts:149-150`). So the field names come from the node's own `prop-*` parameters
**and** from the `prop-*` endpoints of wires touching it.

⚠️ **The cost, stated rather than rounded off.** For this family, on these node types, in a
cloud component, a wire can no longer be reported as going to a port that does not exist —
because after this it does. A mistyped `prop-titel` writes a `titel` column instead of
warning. That is the runtime's behaviour reported accurately rather than a check weakened:
nothing else loses its warning, and both controls below still fire.

### 10.3 What it is graded by

**`tests/cloud/sb017-deploy-connection-parity.test.ts`** — 7 cases, through the real
`exportComponent`:

| case | before | after |
|---|---|---|
| per-component connection counts | 4,4,5,5,8,9,14 = **49** | **5,9,9,16,22,19,20 = 100** |
| `claimSite`'s `secret.done -> storageFetch` survives | ✗ | ✓ |
| a wire to a port on nothing is still dropped | ✓ | ✓ |
| the deployed bundle is a strict subset of the template | ✓ | ✓ |
| never loses a connection production already had | ✓ | ✓ |
| 🆕 every browser Function node untouched (acceptance 6) | — | ✓ |
| the health instrument is live | (asserted the defect) | rewritten — see below |

🔴 **The case that asserted the defect was rewritten to assert the fix, and that is where a
control usually stops controlling anything.** It used to read *"some cloud connection is
unhealthy"* — the negative control on the setup, because if `evaluateHealth` had not run or
the library had not loaded, every wire would read healthy and the parity assertions would pass
on a template that stayed broken. That blindness is still real, so it now uses a signal that
fires *after* the fix: **a wire to a port that exists on nothing warns, and every other cloud
wire is clean**. Both halves have to hold at once, which separates the two failure modes —
health never ran (the broken wire would not warn) from the library never loaded (every other
wire would warn too).

**`tests-unit/sb-017/cloud-ports-agree-with-the-runtime.test.ts`** — 6 cases, and this is §4's
lesson applied to this fix itself. The derivation is a **second implementation of something
the runtime owns**, so it is not asserted against a hand-written expectation: the spec
`require`s the **real** runtime node modules (`dbcollectionnode2`, `simplejavascript`,
`newdbmodelpropertiesnode`, `setdbmodelpropertiesnode`), drives their `setup()` with a fake
editor connection that captures `sendDynamicPorts`, over **the shipped template's own nodes**,
and compares. Reachable from `tests-unit/` and nowhere else in this package — the editor does
not depend on `@noodl/runtime` and these modules cannot be bundled into the renderer.

⚠️ Two things that had to be got right, both found by mutants:

- **Compare the port TYPE, not just name and plug.** With `name:plug` alone, deleting the
  parser's `Outputs.Done()` signal rule **survived**: the general `Outputs.x` rule still finds
  the name, and only its type changes — `signal` becomes `'*'`. A signal wire does not survive
  that (`con-type-mismatch`, and `exportComponent` drops on *any* warning).
- **Fire `editorImportComplete`.** The Record and Query families hang their initial sweep off
  that event rather than running it in `setup`; without firing it, nothing is announced and
  every comparison passes on two empty lists.

The two cases that *disagree* are asserted rather than excluded: the runtime's editor-side
builder declares **zero** `prop-` ports for this project, and the running node registers
`prop-<anything>` on demand — with a known-firing half, that `no-such-port-on-any-node` is
**not** registered, so the claim is about the prefix and not about the method accepting
anything.

**Mutants graded (4 killed):** the `Outputs.X()` signal rule; the `acl-` role/userid branch;
`storageFetch`; and the wire-derived `prop-` names — the last through the full suite, losing
**exactly 13 connections across four components** (`CopySectionToPage` 5/9, `publishPage`
15/16, `duplicatePage` 18/22, `submitContactForm` 15/19), which is the number §6.4 predicted.

### 10.4 Gates

- `test:ci` **2863 specs, 4 failures**, seed 57907, HEAD `f23946bf` — the documented AIX-006
  floor, by name. (2863 = 2862 + the new browser negative control.)
- `typecheck:editor` and `typecheck:editor-tests` clean; both new source files confirmed in
  the checked population with `tsc --listFiles`.
- `tests-unit/sb-017` 6/6 under `test:main`'s jest.

### 10.5 The drive, same session — §1's two endpoints answer

Same editor, same preserved backend (`backend_mtbxrca3axpbc`, project
`~/Documents/sb015-editor-drive`), same four steps as s15's drive: launch the real editor,
open the project, let it deploy, call the endpoints.

**The deployed bundle now carries the whole graph.** Read off
`~/.noodl/backends/backend_mtbxrca3axpbc/workflows/sb015-editor-drive-04961864.workflow.json`
after the editor rewrote it:

| component | s15 | s17 |
|---|---|---|
| `claimSite` | 14 | **20** |
| `duplicatePage` | 8 | **22** |
| `publishPage` | 5 | **16** |
| `site/ContactRecipient` | 5 | **9** |
| `site/CopySectionToPage` | 4 | **9** |
| `site/SetSectionAccess` | 4 | **5** |
| `submitContactForm` | 9 | **19** |
| **total** | **49** | **100** |

✅ **Acceptance 3 — `submitContactForm` answers, and stores the four values.**
**HTTP 200 in 0.055 s**, where s15 measured **504 in 30.017 s**. The stored row carries every
submitted value and the admin-only ACL:

```json
{"handled": 0, "name": "Ada Lovelace", "email": "ada@example.com",
 "message": "Does the deploy carry the graph now?", "pageSlug": "home",
 "ACL": "{\"role:admin\":{\"read\":true,\"write\":true}}"}
```

✅ **Acceptance 2 — `claimSite` answers a real request.** `{"claimed": true}` in **26 ms**,
where s15 measured `status = error`, **30005 ms**. And it minted exactly what it owes:
`_Role` **1** (`admin`), `_Join_users__Role` **1** (the new user), `SiteSettings` **1** —
**one**, so SB-013's fix holds on the real deploy path, which no spec had ever measured
there — and `Theme` **1** (SB-014). Both singletons carry
`{"role:admin":{read,write}, "*":{read:true,write:false}}`.

🔴 **With two known-firing controls**, because "the endpoint answered" and "the endpoint
answers whatever you ask" are the same green: a **second** claim on the now-claimed site with
the **correct** token is refused (`This site cannot be claimed.`), a **wrong** token is
refused, and **neither refusal wrote a row** — still 1 role, 1 join, 1 settings, 1 theme.

⚠️ **The half of acceptance 2 that is still owed**: this was driven over REST with a fresh
signup, not *from the template's own Setup page*. The endpoint is the load-bearing half and
it is measured; the Setup page reaches it through the **browser** deploy, which is the half
this fix deliberately does not touch. (The `_User` trap was real and avoided — s15's
`owner@example.com` is still in `_User`, and a second signup with it fails before `claimSite`
is reached.)

⚠️ The preserved backend is now **claimed** by `sb017-owner@example.com`, so driving the Setup
page needs its claim state cleared first.

### 10.6 Acceptance 4 — 84 warnings become 23, and all 23 are the browser half

Read off the editor's own topbar chip on the opened project: **84 → 23**. Every one of the 23
is in a **browser** component, and specifically in the admin panel — from the warnings panel,
de-doubled for the `BaseDialog` ghost (42 rendered, 21 unique; the chip's 23 includes two the
virtualised list did not render):

| component | warnings |
|---|---|
| `/Pages/PageEditor` | 14 |
| `/Pages/Admin` | 3 |
| `/Pages/ThemeEditor` | 3 |
| `/Admin/SectionRow` | 1 |

🔴 **This bounds §6.5's open question, which was unbounded before.** The public site
(`/Pages/Site`, `/Site/*`) and the **Setup page** are clean — so what SB-008 drove is
unaffected, and the browser drop is confined to the three admin pages and one admin row
component. Which is exactly the surface the phase has never clicked.

### 10.7 🆕 A third small template defect, found by the drive

`submitContactForm` answered `{"received": false}` while storing the message correctly.
`compose`'s script ends `Outputs.built()` — a **signal** — and `compose.out-built` is wired to
`res-3.pm-received`, a **value** parameter port. The type cast is allowed, so nothing warns,
and the caller is told `received: false` about a message that was received. Filed with
SB-018's family; it is the same shape as its other two.

### 10.8 What is still open

- 🔴 **The browser half** — §6.5's question, now bounded rather than unbounded (§10.6).
  `build/deployer.ts` exports through the same `exportComponent`, so the same drop applies to
  the **23 warnings across the three admin pages and `/Admin/SectionRow`**. The fix's scope is
  cloud components by ruling, and extending it there is not a decision this task took: a
  browser Function node already gets its ports from the viewer, so only the `prop-`/`storageFetch`
  families are candidates, and doing it would need the same wire-derived answer §10.2 gives —
  on a surface where the schema *can* eventually exist. **Nothing has ever clicked the admin
  panel**, so what those 23 cost is still unknown.
- **The Setup-page half of acceptance 2** (§10.5), which is the same browser deploy.
- **The backend-side half of acceptance 1** — that `authored-bundle.ts` is lossless on
  connections, so "editor == helper" is closed from both ends rather than asserted of one.
  Not written.
