# Phase 76 — next session

Read `TASKS.md` here first, then `SB-004-THE-SITE-IS-RECORDS.md` — its §1 is the measured ground
everything else rests on, and §6a is what authoring actually taught. The canonical backend model is
`dev-docs/reference/BACKEND-AUTHORING-MODEL.md`. Before authoring any cloud component, read
SB-001's "Doctrine traps".

## Where s2 left it (2026-08-26)

**SB-004 is designed and its publish flow is authored and green through both MCP doors** —
`create_component`, and `create_plan` → `stage_plan_operation` ×2 → `apply_plan`. **That closes
s1's debt**: the plan door had never driven a cloud target end to end, and now it has, with both
components landing under the editor-canonical `__cloud__/…` key (asserted by registry key and the
component file's `path`, never `store.resolve`).

✅ **s1's other debt is also closed**: `test:ci` ran solo on a clear machine —
`Jasmine: 2856 specs, 4 failures (failed)`, all four `AIX-006 style vocabulary`, which is the
recorded floor. SB-001's validation/navigation changes cost nothing. Note the compound exited **1**,
exactly as a clean floor does; the summary line is the signal.

**SB-009 filed** — a component named through a `component`-typed *parameter* is unchecked by the
authored gate. Measured, not argued: a cloud `Run Tasks` naming a nonexistent helper, or a browser
component across the runtime boundary, is accepted `0 errors / 0 warnings / 0 infos` and written to
disk, beside two controls that both fired.

## The one thing to read before trusting any ACL work here

🔴 **F2, in SB-004 §6.** `devOpen` (default `true`, active on loopback) disables **row-level ACL**
(`SecurityState.aclFor` returns `undefined`) and does **not** disable collection permissions
(`checkClp` has no such branch). So a local backend refuses an anonymous caller via CLP — which
*looks* like enforcement — while the published/draft boundary, which is entirely ACL, is never
exercised. And it inverts once this template's own `security.json` lands: with `Page.find: 'public'`
there is nothing left to refuse, and a loopback backend serves **every draft** to anonymous callers.

Any verification of the publication invariant must run with **`devOpen: false` over a real SQLite
engine** — `devOpen:false` over ephemeral persistence is a refuse-to-start.

## Next work, in order

1. **Finish SB-004's authoring**: `duplicatePage`, `submitContactForm`, and the `site/CopySectionToPage`
   and `site/ContactRecipient` helpers. The shapes are in §5; the spec to extend is
   `packages/noodl-mcp/tests/sb004Authoring.test.ts`.
2. **Then the real backend run** (SB-004 §7 acceptance 2–4, 7). This is the first thing that can
   actually say the invariant holds — a green authoring run explicitly cannot: the door returns
   `dynamic-port-skipped` over exactly the ACL parameters and says the node is *"unverified by that
   check rather than verified as correct"*.
3. **SB-005/006** (admin panel, public site), **SB-007** (ship embedded), **SB-008** (the drive).
4. **SB-009** whenever it fits — but its blocking promotion needs a corpus sweep, not an argument.

## Traps that will bite here specifically

- A cloud FUNCTION's interface is the Request node's `params` — and a `stringlist` is **one
  comma-separated string, not an array**. Helpers (no Request node) use Component Inputs/Outputs and
  are not endpoints.
- `Run Tasks` pushes an item's **keys** onto matching Component Inputs (and `Id`/`id`), plus the item
  as Component Object. **Nothing constant across tasks can be passed** — and `Array Map` cannot
  supply it either (its only inputs are `items`/`mapScript`/`refresh`), so the per-item payload is
  built in a `JavaScriptFunction`.
- `Run Tasks` matches `Do`/`Success`/`Failure` on its template **by string**. A worker whose output
  is named `Done` makes the run hang for ever, with no warning.
- `Update Record`'s `collectionName` is **edit-only**, so one helper cannot serve two collections —
  which is a real bound on composition-by-instance, worth saying in SB-002's doctrine.
- 🔴 **The MCP dist on this machine is stale** (2026-08-20, pre-SB-001/002/003) and the bound servers
  run it — proven by `get_project_info` returning no `backendDoctrine`. Author through
  `noodl-mcp/tests/helpers.ts` → `createServer` from `src`, which is the real tool surface on
  current code. Rebuild the dist before trusting any live MCP call.
- Shared checkout: commit by pathspec, never stage-then-commit; announce before any editor
  launch/teardown; `test:ci` alone, and completion is the **summary line**, never `$?`.
