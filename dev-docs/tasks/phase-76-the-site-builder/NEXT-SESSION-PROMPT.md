# Phase 76 — next session

Read `TASKS.md` here first. **The template now runs.** SB-008's drive closed the two criteria the
phase had deliberately left open — SB-005 acceptance 6 and SB-006 acceptance 9, the same claim from
two sides — so SB-004, SB-005, SB-006 and SB-008 are all ✅ and **SB-007 is the last thing between
this and a shipped template**.

Before authoring any *cloud* component, read `dev-docs/reference/BACKEND-AUTHORING-MODEL.md`
§**"Four things a deployed graph does not do the way the canvas does"** — rule 3 **gained a table in
s8** and the new row is the one that bites: *the boxes and an explicit `storageFetch` are
alternatives, not belt and braces.* Before authoring any *browser* component, read **SB-005 §7** and
**SB-006 §7**.

## Where s8 left it (2026-08-26)

**SB-008 DONE.** `packages/nodegx-backend/tests/sb008-public-site-drive.test.ts` — both panels
authored through the real MCP door into one project (**site first**), SB-004's four cloud components
deployed beside them, a real SQLite backend with **`devOpen: false`** (`enforced === true` asserted
before anything else), and a headless Chrome carrying **no credential of any kind**. **20 specs, 4
known-firing controls, 3 one-edge arms.**

A published page renders records and all. A draft shows the not-found panel, and **no part of it is
anywhere in the document** — asserted against `outerHTML`, not `innerText`, because a draft behind
`visible: false` is `display: none` and `innerText` would have skipped it. A slug that is no record
is indistinguishable from a draft.

🔴 **The absence claims stand on a dev-open twin.** Same project, same components, same seed, one
configuration line changed — and the same draft **renders**. Keep that arm if you touch this suite:
without it "the draft did not appear" has a dozen causes that are not permissions, and every one of
them looks identical from the DOM.

🔴 **Four findings. One had already shipped and killed a whole feature.**

- **F18 — a boolean literal cannot be bound to a SQLite parameter at all. FIXED.** The write path
  folds booleans to 0/1 (`serializeValue`) and the read path never did; `node:sqlite` *throws* rather
  than answering, so it was a **500** from `/classes/:c` and `query-records/query-failed` in the
  browser. SB-006's derived navigation filters `showInNav` — a boolean literal — so **the public site
  had no navigation on any page**, and the only trace was a console line no structural spec reads.
  Fixed in `packages/noodl-runtime/src/api/adapters/local-sql/QueryBuilder.ts` (`convertQueryValue`,
  applied at all four binding sites: direct equality, the comparison operators, `$in`, `$nin`).
  ⚠️ **Nothing that worked could regress** — every affected path threw before, on every input. Three
  arms measured it before the change: `{flag:true}` → 500, `{flag:1}` → 200 with the row,
  `{name:'yes'}` → 200 (the control).
- **F19 — four pre-existing unit specs pinned the unbindable value as correct.**
  `QueryBuilder.test.js` asserted `[…, true]` four times, in the same file that asserts
  `serializeValue(true) === 1` a few dozen lines away: the write path's conversion pinned correct and
  the read path's *absence* pinned correct, and nothing compared them. 🔴 **A params list is only
  evidence if something binds it.** The new block binds one, with the raw boolean as its control.
- **F20 → SB-014 — nothing in the template ever creates a `Theme` row.** Measured on a real claim
  (`GET /classes/Theme` → 0) plus a census of every `NewDbModelProperties` in all three component
  sets. The theme editor saves by `theme.firstItemId`, `undefined` on an empty collection, so **Save
  writes nowhere and says nothing**. Both halves of SB-006's theme contract are correct and dead.
- **F21 → SB-013 — one `claimSite` writes the `SiteSettings` singleton twice.** Two identical rows,
  11 ms apart. Two one-edge arms name it: the settings query keeps both `runOnChange` boxes on *and*
  is triggered by an explicit `storageFetch`, so `fetched` fires twice and the whole gate → grant →
  mark chain runs twice; the second pass reports `unchanged`, which is **also** wired to `store`.
  🔴 **The wire that makes a re-run safe is the wire that makes a re-run duplicate.** Both readers
  take `rows[0]` and nothing orders that list.

✅ **Confirmed in a browser rather than claimed**: **F16** is real — the tab reads the record on a
published page and the static `Site` on the not-found one, *in one run*, which is the only reading
that separates the working fix from the one the door accepts. The `Page.description` port is live.
F17 holds as a property (the root URL opens on `homeSlug`'s page). F14's tie is gone in practice.

⬜ **Stated so it is not assumed**: the panel's UI was **never clicked** — SB-005 acceptance 6 is met
in two halves and the residual is named in its own file. The contact form was never submitted.
**Rule 4 (`points to` widens) is still UNMEASURED** — third session running. **SSG still cannot
pre-render this site** and SB-007 must not claim it.

## The harness, for whoever needs it next

`withRenderedPage({ projectDir, backendPort }, fn)` from `scripts/devtools/render-report.js` is the
whole browser half — it spawns `render-from-disk.js`, spawns headless Chrome, and hands you
`evaluate` / `navigate`. Two things that are not obvious and cost a run each:

- 🔴 **`render-from-disk.js` only rewrites `metadata.cloudservices.endpoint` when the key already
  exists**, and the MCP fixture has no `metadata` block at all. Without it every query is silently
  unbound and the blank page reads like a permissions result.
- 🔴 **`claimSite` seeds the `SiteSettings` row**, so a drive must *update* it, not create one. A
  second row renders perfectly and reads nothing you wrote (this is how F21 surfaced).

## The `test:ci` position

s8 touched **`noodl-runtime` source** (`QueryBuilder.ts`), which is compiled into the editor bundle,
so `test:ci` was in scope and **was run solo**: **`Jasmine: 2856 specs, 4 failures (failed)`**, seed
42097, all four `AIX-006 style vocabulary` **by name** — the recorded floor, so the adapter fix costs
nothing. Standing rules: read the **summary line**, never `$?` (the compound exited `1`, which is what
a clean floor does); run it **alone**; the floor is **4**. **No debt carried into the next session.**

⚠️ A peer had uncommitted `noodl-editor` edits (fb-005: `models/community`, `models/template`,
`tests-unit/fb-005`) in the shared checkout during that window. Anything red in that territory is
theirs, attributable by path.

⚠️ **Deliberately not done**: `BACKEND_DOCTRINE_MD` (`prompts/backend.ts`, editor source) does **not**
carry rule 3's new second half. The text is already written in
`dev-docs/reference/BACKEND-AUTHORING-MODEL.md` and can be lifted verbatim — the same shape as s4's
omission that s5 closed. Doing it puts `test:ci` back in scope, so ride a window for it.

## Next work, in order

1. **SB-007** — ship it as a template (embedded, category `site`), consuming FB-005's registry rather
   than re-speccing it. This is the last task standing between the phase and a template a user can
   pick. 🔴 The rendering-mode claim is bounded: **SSG skips dynamic `{param}` routes**, so the public
   site is client-rendered and the template must not be sold on pre-rendering.
2. **SB-013 + SB-014 together** — both edit `claimSite`, and doing them separately re-grades SB-004's
   five mutants for nothing. SB-013's file recommends the one-wire fix and says what it costs;
   SB-014's recommends seeding a `Theme` the way `SiteSettings` is already seeded. Both touch a
   **closed** task, which is why they are filed rather than taken.
3. **SB-009 / SB-010 / SB-011 / SB-012** — all measured-not-fixed, all needing a corpus sweep or a
   ruling rather than an argument.
4. 🧭 **Richard's, still open**: F8 (does a contact message reach anyone), `Section.kind`'s fifth
   value with no destination, D3 (does SB-003's boundary fix ride 0.2.1).

## Traps that will bite here specifically

- 🔴 **A green authoring run means well-formed and nothing else.** Six sessions have produced one;
  four of them shipped something broken, and s8's F18 had been broken since SB-006 was written.
- 🔴 **An absence claim needs a signal known to fire.** s8's whole structure is that rule: the
  published page, the admin read, the dev-open twin, the throwing boolean.
- 🔴 **All three component sets are data files** — `sb004Components.ts`, `sb005Components.ts`,
  `sb006Components.ts`. Edit the graphs there, never in a spec; three suites now drive *those*.
- 🔴 **An authored node id is a request, not a handle (F9).** Read a written graph by node **type** or
  **label**.
- **The MCP dist on this machine is stale** and the bound servers run it. Author through
  `createServer` from `src`.
- Shared checkout: commit by pathspec (untracked ⇒ `add` + `commit` in **one chain**), never
  stage-then-commit; announce before any editor launch/teardown; `test:ci` **alone**.
