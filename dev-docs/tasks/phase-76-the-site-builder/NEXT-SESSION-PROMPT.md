# Phase 76 — next session

Read `TASKS.md` here first. **s19 closed SB-018 — all three items fixed, and all three of
that file's own dispositions turned out to be wrong.** No drive. 13 specs across four
packages, 6 mutants, every gate green except one that is not ours.

Read **SB-018 §7** before anything else (it is the whole of what s19 did), then
**SB-017 §12** for what it moved on the other task. **SB-017 §11.4 is still the gating
decision and it is still Richard's** — nothing s19 did bears on it.

Before authoring any *cloud* component, read `dev-docs/reference/BACKEND-AUTHORING-MODEL.md`
§**"Five things a deployed graph does not do the way the canvas does"**. Before any *browser*
component, **SB-005 §7** and **SB-006 §7**. Before touching the template, **SB-007 §3/§4**.

## Where s19 left it (2026-08-28)

✅ **SB-018 (1) — the two dead `For Each.Changed` wires are RENAMED, not deleted.**
`For Each` republishes an item component's signal outputs as `itemOutputSignal-<name>`
(`foreach.tsx:1030-1037`), derived from the template component's own port list.

- 🔴 **"Delete them" would have deleted a working feature.** SB-018 called the wire a
  redundant second trigger; it is not. `create.done` beside it covers the *page's* create,
  and publish / unpublish / duplicate / save / remove all happen inside the **row**, which
  does not own the query. The author's comment on `/Admin/PageRow` had said what they
  wanted and it was correct — they used the wrong port name, and the door accepted it.
- ⚠️ **This moves them out of SB-017 §11's census rather than fixing them there.**
  `itemOutputSignal-Changed` needs only the template component, which is always in the
  graph; `prop-<field>` needs the **columns of a class**, and a fresh site has none. Same
  viewer, same mechanism, one satisfiable from the project alone and one not. **Census
  21 → 19**, all one family.

✅ **SB-018 (3) — it was six `Text` nodes, not one heading.** `/Pages/Site` ×2,
`/Site/SectionView`, `/Admin/PageRow` ×2, `/Admin/SectionRow`. The template **already had
the rule** — `link`, `rowStatus` and `notFound` all carried a standing value — so four
broke it, and the census over the shipped artefact is what found them.

- ⚠️ **It compounds SB-017 §11 in a cosmetic-but-nasty way.** A deployed panel writes
  `Page` rows with no title and no slug; those rows used to list as the literal word
  **"Text"**. They now list blank. **Nothing about the defect changed, only its disguise.**

✅ **SB-018 (5) — `{"received": false}` was never a default.** A `pm-` port is typed `*`
with no default and `Response.initialize` starts `responseParameters` at `{}`, so an unset
port **drops the key**. The key being there proved the port was written — twice:
`OutputProperty.sendPulse` delivers a signal into a value port as `true` **then** `false`
in one drain pass (`node.ts:686-692`), and the body carried the rearm.

- 🔴 **That is why SB-018's own suggested fix was insufficient**, not merely partial.
  `compose` runs on `req.receive`, before anything is stored, so a value published there is
  `true` on the failure path too — telling a visitor whose message was lost that it arrived.
- The flag now rises on `save.done`, sits **in** the success chain before `mail.send` so the
  value cannot lose a race with the send, and the failure case is a **parameter**
  (`pm-received: false`) so both paths answer the same shape.

## Next work, in order

1. 🧭 **SB-017 §11.4 is Richard's, and it is still the gating decision — unchanged by s19.**
   A fourth `NodeTypeAdapters` class **cannot** be the fix: on a browser component the viewer
   is already the writer for these nodes and `setDynamicPorts` **replaces**. Three options
   with their costs are in §11.4; the recommendation is **derive it in the runtime**, whose
   stated cost is a second copy of the wire-derived rule — and the harness for grading two
   copies against each other already exists
   (`tests-unit/sb-017/cloud-ports-agree-with-the-runtime.test.ts`).
2. ⬜ **The Setup-page half of SB-017 acceptance 2.** s17 drove `claimSite` over REST with a
   fresh signup; "from the template's own Setup page" is the browser deploy.
   ⚠️ **The preserved backend is CLAIMED** by `sb017-owner@example.com` — clear `_Role` /
   `_Join_users__Role` / `SiteSettings` / `Theme` before driving it, or the Setup page
   correctly refuses and it reads as a broken fix. (`_User` also holds s15's
   `owner@example.com`; use a third address.) ✅ The Setup page is clean of the browser drop
   (§10.6), so item 1 does not block this.
   ⚠️ **A drive would also settle all three of s19's fixes**, none of which has been seen
   running: the list refreshing after a publish, a blank heading on an unclaimed site, and
   `{"received": true}` over real HTTP are still predictions.
3. ⬜ **§1's "interesting half" is untouched and is the only SB-018 residue.** No authoring
   door checks that a wired port exists on a **standard** node. It accepted `Changed` for
   five sessions, and it would accept it again tomorrow. SB-009 is the same hole one level
   up (a *component* named in a parameter).
4. 🧭 **Richard's, still open**: F8 (does a contact message *reach* anyone — s17 proved it is
   stored, not delivered), `Section.kind`'s fifth value with no destination, D3 (does
   SB-003's boundary fix ride 0.2.1).
5. ⬜ **`securityPolicy` is on `ProjectTemplate`**, so `PlatformTemplateProvider`'s
   `community://` shelf still has no channel for one.
6. ⚠️ **`typecheck:backend-tests` OOMs, and it is not ours.** V8 heap exhaustion at 4 GB and
   at 8 GB. Reverting s19's one file in that program to HEAD reproduces it exactly, and
   `git diff e78f35fb..HEAD` over the program's include set is otherwise **empty** — the
   inputs are byte-identical to s18's clean run, and `dist-types` / `node_modules` are weeks
   old. It needs an owner; it is not a Phase 76 defect.

## Traps that will bite here specifically

- 🔴 **A poisoned jest transform cache reads as red specs with EMPTY failure messages.**
  s19 mutated `noodl-runtime/src/node.ts` and `react-component-node.ts` for grading and
  restored them; the editor's ts-jest cache went on serving a broken module, and four
  SB-017 cases failed with `failureMessages: ['']` — on exactly the Record-family cases,
  which reads perfectly like a real regression. ✅ **HEAD's template failed identically**,
  which is what proved it was not the session's change. `--no-cache` was green;
  `npx jest --clearCache` fixed it. Same shape as the `.webpack-cache` trap, different cache
  — **and it is the cost of mutating shared source rather than a test.**
- 🔴 **A frozen fixture answers a different question once the thing it recorded moves.**
  `sb017-deploy-connection-parity.test.ts` compares template and export against a **recorded
  deploy** and asked "is anything the deploy shipped missing now?". A deliberate template
  removal makes that non-empty, and the honest answer is *yes, on purpose*. Both cases now
  assert the shortfall **equals** a named `REMOVED_BY_SB018` list — an exemption, not a
  relaxation. Deleting or weakening them would have retired the control that catches a
  converter re-pointing wires to reach the right total.
- 🔴 **A negative control can stay green while the instrument is dead.** Dropping
  `editorImportComplete` from the For Each harness reddened "announces
  `itemOutputSignal-Changed`" and left "announces no port called `Changed`" **passing** —
  because nothing announces anything. An absence assertion is worth nothing without a
  known-firing signal beside it, and this is the second time in this task file.
- 🔴 **`''` is falsy, so "set a standing value" needs the setter measured, not assumed.** A
  setter written `props[name] = value || default` would have taken SB-018 (3) entirely and
  changed nothing. `react-component-node.ts:645-650` guards on `!== undefined`; the spec
  drives it both ways.
- 🔴 **A `test:ci` build failure has NO summary line**, so the run is *not measured* rather
  than red. **Floor: `2863 specs, 4 failures`**, all four `AIX-006 style vocabulary` **by
  name**. (Quote the tree: s19 read seed 88522, HEAD `b385049e`, 71 s.)
- 🔴 **`.webpack-cache` can poison that build** with ~47 unresolved-alias errors in files
  nobody touched. `rm -rf packages/noodl-editor/.webpack-cache` first.
- 🔴 **The door remaps node ids** — `save` ships as `save-3`. Assert template wires by node
  **label**, never by the id the component set used.
- ✅ **`tests-unit/` can `require` another package's source** and drive a runtime node's
  `setup()` with a fake editor connection capturing `sendDynamicPorts`. This is the
  instrument for the whole browser half. ⚠️ **Fire `editorImportComplete`** — For Each, the
  Record family and the Query family all hang their sweep off it.
  ⚠️ `noodl-viewer-react` modules read a **`Noodl` global** at module scope
  (`node-shared-port-definitions.ts`); its absence fails the **require**, which reads as
  "the node has no default". Set `global.Noodl = { deployed: false }` first.
- 🔴 **`setDynamicPorts` REPLACES a node's dynamic port list.** Two writers on one node erase
  each other — why s17's three cloud adapters are partitioned by node type, and why a fourth
  browser adapter is not available at all.
- 🔴 **A parameter is not a connection.** `exportComponent` filters wires and copies
  parameters verbatim, and the runtime registers the input on either path. SB-018 (5) uses
  that deliberately for `pm-received: false`; SB-017 §11 found it the hard way.
- 🔴 **The artefact and the component sets are two populations.** Edit a component set and
  **regenerate** (`npm run template:site-builder`) or `sb007Template.test.ts` reddens.
  ⚠️ `site-builder.security.json` is **NOT** generated — hand-edited, deliberately.
  ⚠️ Adding a node moves `sb-007/site-template.test.ts`'s id count (now **194**) and the
  backend helper's connection total (now **101**); both want the reason written down.
- 🔴 **`Run` is purely ADDITIVE**, and a **refused** query publishes an empty `items`
  indistinguishably from an empty one — take refusal from `error`, never from emptiness.
- 🔴 **jest here is `testEnvironment: 'node'`** — no jsdom; a panel cannot be mounted.
- 🔴 **Driving the wizard: the modal renders TWICE**, and `cdp click` hits an element's
  centre, which on these cards is a child text span. Stamp the copy **not** under a
  `[class*=Measuring]` ancestor, `elementFromPoint` before every click, and expect to click
  twice on Add Backend. ✅ Opening a project from the launcher needs no such care.
- 🔴 **`const` leaks between `cdp eval` calls** — wrap every eval in an IIFE.
- 🔴 **There is no editor global for `WarningsModel`**, and `require('@noodl-models/…')` from
  `cdp eval` fails. Read the topbar chip and the panel text — and the panel is virtualised
  **and** doubled by the `BaseDialog` ghost, so de-duplicate and trust the chip.
- 🔴 **Editing a backend's `security.json` is blocked by the permission classifier.** Use the
  editor's Access panel or ask Richard; do not route around it.
- Shared checkout: commit by pathspec (untracked ⇒ `add` + `commit` in **one chain**), never
  stage-then-commit; announce before any editor launch **and teardown**; `test:ci` **alone**.

## Gates, s19

- ✅ **`test:ci` — `2863 specs, 4 failures`, seed 88522, HEAD `b385049e`, 71 s.** The
  documented AIX-006 floor, all four **by name**, fresh `test-results.json` (mtime checked).
- ✅ **`noodl-editor` `test:main` — 362 suites / 5928 tests, 0 failures.**
- ✅ **`nodegx-backend` — 109 suites / 1245 tests, 0 failures** (10 skipped).
- ✅ **`noodl-mcp` — 64 / 774, 0.** **`noodl-runtime` — 143 / 2571, 0.**
  **`noodl-viewer-cloud` — 10 / 193, 0.**
- ✅ **`typecheck:editor`, `typecheck:editor-tests`, `typecheck:mcp` — exit 0.**
- ⚠️ **`typecheck:backend-tests` — OOM, and shown not to be this session's** (see item 6).
- ✅ **6 mutants graded and killed** — 3 on the artefact (revert a `For Each` wire; drop the
  `h1`'s standing text; run the `received` flag off the request), 1 on the instrument (drop
  `editorImportComplete`), 2 on real source (make the `Text` setter treat `''` as unset;
  stop a pulse rearming a value port).
- ✅ **No editor stack launched, no peer coordination needed.** Every suite run alone.
