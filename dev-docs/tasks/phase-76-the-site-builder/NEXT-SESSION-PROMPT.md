# Phase 76 — next session

Read `TASKS.md` here first, then `SB-005-THE-ADMIN-PANEL.md` — it was scoped in s5 and its §1/§2 are
the difference between authoring a panel that works and one that repeats F10's mistake in a place
where F10 does not apply. Before authoring any *cloud* component, read
`dev-docs/reference/BACKEND-AUTHORING-MODEL.md` §**"Four things a deployed graph does not do the way
the canvas does"** — that text is now also in `BACKEND_DOCTRINE_MD`, so an agent authoring through the
MCP door receives it on `get_project_info`.

## Where s5 left it (2026-08-26)

**s4's deliberate omission is closed** (`8ce12a3c`). `BACKEND_DOCTRINE_MD` carries the four runtime
rules, lifted from the reference doc, including the counter-rule SB-004's own correction turned on —
rule 3's fix (`runOnChange-*: false`, `Do` unwired) is **wrong on a query that has no filter
parameter**, and applying it to one is what made `claimSite` read a claimed site as unclaimed.
`sb002BackendDoctrine` gained a claim census over the four rules, **two mutants graded**. Worth
carrying: the pre-existing verbatim-over-stdio spec passes under **both** mutants — it measures
transport, not content, and only the census measures content. Surface budget untouched
(`toolDisclosure`: 8255 tokens / 20 tools, 25 under — a result field rides free, as SB-002 designed).

**SB-005 is scoped, nothing authored.** Two hypotheses formed while grounding it and **both were
wrong in the safe direction**, which is the session's real output:

- **`Page` is invisible to every catalog listing an author would use** — plain `list_node_types`,
  `visual_only`, even `query: 'page'` (7 rows, none of them `Page`). It appears only under
  `include_hidden`, whose description is *"deprecated and picker-hidden"*, among 33 exclusions of
  which **31 are genuinely deprecated**; `catalog.ts:267` collapses the two flags into one filter.
  That looked like a shipped blank-page defect. ✅ **It is not** — the write door *refuses* a
  `Group`-rooted page component with a blocking `page-without-page-node` diagnostic and a *did you
  mean*. Cost: one round-trip. Recorded as a wart, deliberately **not filed as a task**.
- **`CloudFunction2`'s dynamic `in-`/`out-` parameters looked like the browser twin of F10.**
  ✅ They are not: `NodeScope` calls `registerInputIfNeeded` on the **parameter** path
  (`nodescope.ts:203`) as well as the connection path (`:149`), so `in-publish: true` works as a
  constant with no declared port. F10 was specific to `JavaScriptFunction`, whose ports come from
  *parsing the script* in a `setup()` that returns early with no editor connection. 🔴 **Do not
  over-apply doctrine rule 1 to `CloudFunction2`** — SB-005 §2 tables which rules actually cross the
  boundary: 2 and 3 do, 1 only for `JavaScriptFunction`, and **4 is assumed-not-applicable and
  UNMEASURED** — it must not be recorded as answered.

Final: noodl-mcp **60 / 697**, `typecheck:mcp` and `typecheck:editor` both exit 0 (run **unpiped** —
a piped `$?` is `tail`'s).

## 🔴 The one open debt

**`test:ci` was not run.** A peer's editor stack (webpack + `start-electron-dev.js`) held the machine
for the entire session and was still live at close. The debt is **bounded, not discharged**: nothing
in `noodl-editor` imports `prompts/backend.ts` — its only consumer is `noodl-mcp/src/editor-deps.ts` —
so the only path from the change to `test:ci` is compilation, which `typecheck:editor` covers. **That
is a bound on the risk, not a pass.** Ride a solo window early next session, exactly as s1→s2 did.
Read the **summary line**, never `$?`; the floor is **4**, all `AIX-006 style vocabulary`.

## Next work, in order

1. **The `test:ci` window** above, first thing, while the machine is quiet.
2. **Build SB-005** in its §3 order: claim screen → page list → page editor → theme → upload/preview.
   🔴 The claim this task owes is SB-004 §7's closing warning: acceptance 2 is currently held on a
   **stand-in** (rows written through the REST API as the owner), so no spec in this phase can yet
   tell a panel that sets the draft ACL from one that does not. `Create Record` for `Page` and
   `Section` must carry the `role:admin` rule **as parameters**, graded by a mutant that drops it.
   🔴 The panel must **never** write `Page.published` — that boolean is a mirror of the ACL and only
   `publishPage` may move it. Graded by a mutant that adds the direct write.
   ⚠️ Assert the two query shapes **as a pair**: the sections-of-a-page query carries rule 3's shape,
   the page-list query must **not**.
3. **SB-006** (public site). 🧭 **F8 is Richard's and blocks its contact section** — `SiteSettings` is
   world-readable, so `contactRecipient` cannot live in that row; the fix takes the address from the
   `Secret` alone and changes SB-004 §2's field list. SB-005 is *not* blocked by it (the panel never
   displays the recipient) — just do not add a recipient field to the settings form.
4. **SB-007** (ship embedded, category `site`), then **SB-008** — the browser half only; §7 already
   did the backend half. Scope it as a UI drive, not a permissions drive.
5. **SB-009 / SB-010 / SB-011** whenever they fit — all measured-not-fixed, all needing a corpus
   sweep rather than an argument before anything blocks.

## Traps that will bite here specifically

- 🔴 **A green authoring run means well-formed and nothing else.** Three sessions in a row produced
  one and shipped something broken. SB-005 §4 states up front what cannot be measured without a
  browser; the behavioural claim is SB-008's and is listed as an **unmet** acceptance item so it
  cannot be quietly counted as met by the structural ones.
- 🔴 **Both suites author from `noodl-mcp/tests/sb004Components.ts`.** Edit the graphs there, never in
  either spec.
- 🔴 **An authored node id is a request, not a handle (F9).** Ids are made unique across the
  *project* — `settings` became `settings-2`. Read a written graph by node **type** or label.
- **`get_node_type` takes `type_names` (an array) and caps at 8 per call**; `create_component` takes
  `path`, and `children` is an array of **node id strings**, not nested objects.
- **The MCP dist on this machine is stale** and the bound servers run it. Author through
  `noodl-mcp/tests/helpers.ts` → `createServer` from `src`.
- **`GET /classes/:name?where=` refuses a tagged Pointer** — the wire filter vocabulary and the
  graph's are not the same vocabulary. SB-005 meets this the moment the panel filters on a relation.
- `Run Tasks` matches `Do`/`Success`/`Failure` on its template **by string** — a worker whose output
  is named `Done` hangs for ever with no warning. `Update Record`'s `collectionName` is **edit-only**,
  so one helper cannot serve two collections.
- Shared checkout: commit by pathspec (untracked ⇒ `add` + `commit` in **one chain**), never
  stage-then-commit; announce before any editor launch/teardown; `test:ci` **alone**.
