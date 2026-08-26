# Phase 76 — next session

Read `TASKS.md` here first. **SB-005 and SB-006 are both built** (🟡, not 🟢) and the difference is
the whole point: neither has been *run*. SB-005's acceptance 6 and SB-006's acceptance 9 are the same
claim from two sides — *a draft page is unreadable to an anonymous caller through the shipped
surface* — and both belong to **SB-008**. Nothing structural stands in for either, and both task
files say so up front so they cannot be quietly counted as met.

Before authoring any *cloud* component, read `dev-docs/reference/BACKEND-AUTHORING-MODEL.md`
§**"Four things a deployed graph does not do the way the canvas does"**. Before authoring any
*browser* component, read **SB-005 §7** (two of those four rules do not transfer the way §2
predicted) **and SB-006 §7** (four more things that are true only on this side).

## Where s7 left it (2026-08-26)

**SB-006 BUILT.** Five browser components authored through the real MCP door —
`noodl-mcp/tests/sb006Components.ts` — graded by `noodl-mcp/tests/sb006PublicSite.test.ts`,
**29 specs / 12 mutants / 1 known-firing control**. Acceptance 1–8 met.

🔴 **The suite authors BOTH panels into one project, and the site FIRST.** Two of its checks are
about the pair and can be made on neither alone, and the order is itself a measurement (F17). SB-008
must boot them the same way.

🔴 **Four findings, and one of them changed a file SB-005 had already graded.**

- **F14 — the Router breaks a page-pattern tie by the order the components were written in.**
  `router.tsx:775-783` keeps the smallest `|patternParts − pathParts|` and, on a tie, the **first**
  page in the router's list (the guard is `>` and not `>=`). The public site is a catch-all at
  `{slug}`, so it tied at distance 0 with every one-segment admin path — `/admin` resolving to the
  panel rather than to a content page called "Admin" was luck. SB-005's four paths moved under
  `ADMIN_PATH_PREFIX`: `admin/pages`, `admin/setup`, `admin/theme`, `admin/page/{pageId}`. Two
  segments removes the tie instead of relying on it — `{slug}` still *matches* `/admin/pages`, at
  distance 1, and distance is read before order. SB-005's 21 specs still pass.
- **F15 — a component instance has ONLY the ports its `Component Inputs` node declares.** No
  `visible`, no layout, no lifecycle. Conditional placement needs a wrapper `Group`. The door refuses
  it by name (`instance-unknown-parameter`, *"The value is discarded"*), and in the same run raised
  `inert-dimension` (`objectFit` is inert unless `sizeMode: 'explicit'`) and 🔴 `unitless-dimension`
  — **a bare number on a dimension port is read as a percentage**, so `maxWidth: 960` is `960%`.
- **F16 — a `Page` node's `title` port is DEAD after export; its `description` port is LIVE.** The
  Router titles the document from `routerIndex.pages[].title` (`router.tsx:584`), which the exporter
  copies out of the *parameter*; metatags are forwarded to `Noodl.SEO.setMeta` on every update
  (`Page.tsx:162-168`). So a records-driven title must go through `Noodl.SEO.setTitle` from a code
  node — on the one template whose product is SEO, the fix that looks right does nothing. Both halves
  are asserted and the wire into `Page.title` is a mutant.
- **F17 — the door makes the first page written the router's start page**, so a template's authoring
  order decides where its app opens. Panel-first left `startPage: /Pages/PageEditor` — an editor for
  no record. The spec asserts the property (start page == the page the root URL resolves to), not the
  order.

🆕 **A third query shape, and the sentence behind it.** SB-005 pinned two (port-filtered: boxes off;
unfiltered: boxes on). A query filtered by a **literal** is a third and keeps its boxes ON:
`visualQueryToNeutral` reads `rule.value` when there is no `input` (`saved.ts:271`) and
`collectFilterParameters` mints no port for it, so the graph-build fetch is already narrowed and
there is nothing left to trigger it. **The precondition of SB-004's fix is a filter PORT, not a
filter.**

🆕 **Two cross-file contracts are now checked** and had been checked nowhere: the theme keys
SB-005's `buildTokens` writes are the keys SB-006's `applyTheme` reads, and every field a section
view reads out of `data` is one `Admin/SectionRow` can write.

⚠️ Also measured and recorded rather than re-discovered: `isEmpty` is `true` **before** the first
fetch by contract (`dbcollectionnode2.ts:410-419`), so a not-found panel wired to it shows from load;
a query's own `fetched` **is** ordering-safe with its own values (one synchronous block, one drain
pass); `For Each` has no channel for a value constant across items — the repeater family's half of
SB-004 §5's `Run Tasks` limit — which is why the contact form is a sibling of the section list rather
than a section kind; and SB-005's theme editor does **not** wipe untouched tokens (checked:
`startValue` → `setText` → `onTextChanged` on both paths, `text-input.ts:341-355`).

🔴 **SSG cannot pre-render this site.** `routesFromExport` reports and skips dynamic `{param}` routes
(RUN-002 slice 5), so of five pages it would build the three literal admin paths and skip the public
site entirely. Not ours to fix; **a claim SB-007 must not make.**

🧭 **One ruling for Richard, filed rather than absorbed:** `Section.kind` has five values and `data`
can express four. `cta` has no destination and no control in the panel would write one, so it renders
as emphasised copy. Either the panel drops `cta` from `kindItems` (one line, plus SB-004 §2's
vocabulary) or `data` grows `linkSlug`/`linkLabel` and `Admin/SectionRow` grows two fields — the
second changes the class model, which is why it is not ours.

✅ **F8 does not block the browser half**, contrary to the s6 handover. The recipient lives in
`site/ContactRecipient`, and the form names no recipient. What F8 blocks is the claim a submitted
message *reaches* anyone — SB-004 §7's, still open, still Richard's.

⚠️ **Rule 4 (`points to` widens instead of failing) is still UNMEASURED in the browser.** Nothing in
either panel filters on a Pointer. Do not record it as answered.

Final: noodl-mcp **62 suites / 747**, `typecheck:mcp` and `typecheck:editor` both exit **0** (run
**unpiped** — a piped `$?` is `tail`'s). ⚠️ `typecheck:mcp` is the stricter of the two.

## The `test:ci` position

**Not run by s7, and no debt added.** The session touched three noodl-mcp test files (one edited, two
new) and two docs — no editor or runtime source — so nothing in `test:ci`'s scope moved. s6's relayed
floor stands: **`Jasmine: 2856 specs, 4 failures (failed)`**, all four `AIX-006 style vocabulary`, on
a tree including `8ce12a3c`.

Standing rules for the next run: read the **summary line**, never `$?` (the clean floor exits `1`);
run it **alone**; the floor is **4**.

## Next work, in order

1. **SB-008** — the drive, and the one that decides whether any of this works. Both halves of the
   product now exist as graphs and neither has ever run. Scope it as the **browser half**; SB-004 §7
   already did the permissions half over real HTTP, so do not re-litigate it. Must run with
   `devOpen: false` over a real SQLite engine. The thing to check is not that the site renders but
   that **a draft page 404s for an anonymous visitor through it** while a published one renders.
   🧭 Likely harness: `scripts/devtools/render-from-disk.js` serves a v2 project straight from disk
   against the working-tree runtime and reconstructs `routerIndex` the way the exporter does — its
   header names the export-contract traps it already solved, and
   `nodegx-backend/tests/helpers/authored-bundle.ts` (SB-004 s4) is the other half. Author both
   component sets into one project, **site first** (F17).
2. **SB-007** (ship embedded, category `site`) — consume FB-005's registry, do not re-spec it. 🔴 The
   template's rendering-mode claim is bounded by the SSG finding above.
3. **SB-009 / SB-010 / SB-011 / SB-012** whenever they fit — all measured-not-fixed, all needing a
   corpus sweep or a ruling rather than an argument. SB-012 now has **two independent instances**
   (SB-005's panel and SB-006's site), which strengthens the case that the fix is worth making.

## Traps that will bite here specifically

- 🔴 **A green authoring run means well-formed and nothing else.** Five sessions running have
  produced one; three of them shipped something broken. s6's near-miss (`options.items`) and s7's
  four findings were all caught by reading source, not by any gate.
- 🔴 **All three component sets are data files**: `sb004Components.ts`, `sb005Components.ts`,
  `sb006Components.ts`. Edit the graphs there, never in a spec — SB-008 has to drive *those*.
- 🔴 **An authored node id is a request, not a handle (F9).** Ids are made unique across the
  *project*. Read a written graph by node **type** or **label**; both panel suites carry
  `byType`/`byLabel` helpers that assert cardinality rather than assuming it.
- **`get_node_type` takes `type_names` (an array), caps at 8 per call**; `get_example` takes `id`;
  `get_component` takes `path`; `update_component` takes `{ path, set: { nodes, connections } }` —
  a full replacement, not a patch.
- **The MCP dist on this machine is stale** and the bound servers run it. Author through
  `noodl-mcp/tests/helpers.ts` → `createServer` from `src`.
- Shared checkout: commit by pathspec (untracked ⇒ `add` + `commit` in **one chain**), never
  stage-then-commit; announce before any editor launch/teardown; `test:ci` **alone**.
