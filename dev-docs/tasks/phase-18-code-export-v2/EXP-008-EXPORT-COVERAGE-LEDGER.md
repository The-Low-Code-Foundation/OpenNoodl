# EXP-008 — The export coverage ledger and its gate

**Status:** Built (2026-08-27, session 8)
**Artifacts:** `packages/nodegx-export/coverage-ledger.json` · `scripts/export-ledger/check.js` · `export-ledger:check` in the PR workflow's `node-catalog` job

## What this is

Every node type in the catalog carries a classification for code export, and CI refuses a
catalog that contains an unclassified type. The point is contributor-facing: the catalog is
already CI-enforced (`catalog:check` regenerates it from the live node registries), so **a new
frontend node cannot reach the editor's picker without either a deterministic translation in
`packages/nodegx-export` or an explicit exemption sentence in the ledger** — and the exemption
lands in the PR diff, in front of review. Silent export gaps are the one thing the gate forbids.

Statuses:

| status | meaning | requires |
|---|---|---|
| `translated` | `packages/nodegx-export` emits real code for it | `note` saying what it becomes |
| `stubbed` | emitted as a typed stub by design (the backend seam) | `exemption` |
| `deferred` | no translation yet | `exemption` — one sentence saying why shipping without one is acceptable |
| `backend-only` | catalog `availableIn` is exactly `['cloud']` | nothing; enforced both directions |

The check also fails on: a ledger entry naming no catalog type (renames/removals), duplicate
entries, a browser-capable node filed `backend-only`, and a `catalogFormatVersion` mismatch.
The gate was verified the way phase-67 taught (`build-the-caller`): known-good passes, and four
hand-made mutants — new unclassified browser node, deleted exemption, misfiled backend-only,
removed catalog node — each fail with the intended message.

## The audit that sized it (2026-08-27)

Method: run `parseProject` + `planProject` over the real project corpus (42 projects on this
machine, 29 distinct graphs after deduping drive-copies, 2,826 nodes) and tally dispositions
per node type. Script preserved in the session scratchpad (`coverage-audit.ts`).

**66% of nodes translate today.** Range 43%–100%; Puppy test 3 83%, ecommerce example 93%, the
Cheer fixture 100%. Catalog-level: 28 types translated, 1 stubbed (DbCollection2), 15
backend-only, 131 deferred. Roughly half of all deferred *nodes* are collateral — ordinary
Text/Group/Button inside a component that failed to plan for one of the reasons below.

The ranked gap list (deferred node counts from the corpus, direct + collateral where large):

1. **Missing visual generators** — `net.noodl.visual.columns` (62), `net.noodl.visual.icon`
   (49), `net.noodl.controls.range` (9), `net.noodl.controls.checkbox` (7); `Options`,
   `Radio Button`, `Video`, `Circle` unexercised in the corpus but the same shape of work.
   Mechanical EXP-002 slices; kills the largest collateral.
2. **Component Outputs** (69, plus ~60 deferred component instances downstream) — the other
   half of the component interface.
3. **Popups** — `NavigationShowPopup`/`ClosePopup` (64 + collateral). Needs a design decision
   on paper first (modal state), like Switch.
4. **The JS-code nodes** — `JavaScriptFunction` (68), `Javascript2` (11), `Expression` (10):
   EXP-003's territory (AI translation + trace harness), in phase scope.
5. **Individual logic slices** — `RouterNavigate` from logic-signal triggers (32),
   `net.noodl.ComponentObject` (28), `Model2` (27, the named next slice), `Logic Builder` (14
   — its program is structured JSON, generable headlessly (P73), so a *deterministic*
   translation is feasible; it should not wait for EXP-003), `Static Data` (14), `Counter`
   (7), `Switch` (5, designed-on-paper slice), Condition-on-change (6), the `String`/`Color`
   variable nodes (6).
6. **The backend seam — by design, not a gap**: DbCollection2 → typed stub already;
   record CRUD, `net.noodl.user.*` session nodes → same stub treatment when they get entries.

Projection: items 1–3 plus the already-planned slices put the corpus around **90–95% of nodes
fully translated**, the remainder being backend-seam stubs the EXP-004 report will present as
the designed boundary.

## Scope rulings this file records

- **Backend export is deployment, not codegen** (phase README "Out of Scope", reaffirmed
  2026-08-27): the self-hostable backend is the Node + SQLite (`node:sqlite`) service in
  `packages/nodegx-backend`, running cloud-function graphs on the bundled interpreter. The
  Parse backend is **retired**; backends are `nodegx` (inbuilt) or `external` (Directus-style
  HTTP APIs). The frontend export talks to either over the same seam nodes.
- **Cloud function components never enter the frontend export**: `parseProject` skips
  `components/__cloud__/` and the skip surfaces as one report note
  (`tests/cloud-components.test.ts`; before session 8 they were walked as browser components).
- **Kit/prefab nodes are outside the gate**: the ledger covers the core catalog. An unknown
  kit type defers at plan time with a visible note — that is the designed behaviour, not a
  gate failure.

## Contributor workflow ("I added a node, CI is red")

1. `npm run catalog:check` failed first? Regenerate: `npm run catalog:generate`.
2. `export-ledger:check` now names your type. Add one entry to
   `packages/nodegx-export/coverage-ledger.json`:
   - Best: write the translation in `packages/nodegx-export` (with tests), mark `translated`
     with a `note` saying what it becomes.
   - Acceptable with review: `deferred` + an honest `exemption` sentence. Reviewers should
     treat a new *visual or interaction* node arriving as `deferred` as a smell — the
     announcement this phase is building toward is only as true as this file.
3. Backend-only node (`availableIn: ['cloud']`)? Mark `backend-only` and you're done.
