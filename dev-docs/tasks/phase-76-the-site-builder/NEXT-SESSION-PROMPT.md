# Phase 76 — next session

Read `TASKS.md` here first, then `SB-001-*.md`'s "Doctrine traps" section before authoring any
cloud component. The canonical backend model is `dev-docs/reference/BACKEND-AUTHORING-MODEL.md`.

## Where s1 left it (2026-08-26)

The enablement tier is DONE and committed on `cline-dev`: SB-003 (`2ac993c5`), SB-001
(`e47c7ac7`), SB-002 (`1fa9e6ad`). The MCP can now mint `/#__cloud__/` components (both spellings
normalise), helpers 404 instead of 500ing, the shared gate rejects wrong-runtime nodes
(`wrong-runtime-node`), and `get_project_info` carries `backendDoctrine`.

## Debts s1 leaves you

1. **`test:ci` was NOT run** — the phase-75 session was using it. The editor-side changes
   (validation/*, navigation.ts, prompts/backend.ts) are covered by tests-unit (validation 52/0,
   full editor units green except the peer's own in-flight `fb-005/template-shelf.test.ts` red)
   and `typecheck:editor`, but ride a solo `test:ci` window before treating the editor half as
   proven. Floor is 4 (AIX-006); completion = the SUMMARY LINE, never `$?`; run it ALONE.
2. **The plan door has never driven a cloud target end to end** — every shared piece is unit-
   covered, but SB-004 authoring the backend through create_plan/stage/apply is the real proof.
3. **D1–D3 still need Richard** (one project vs two; function-calls-function stays deferred;
   does SB-003's boundary fix ride 0.2.1). Proceeding on drafts: one project; deferred; committed
   on the branch either way.

## The next work: SB-004 (the site is records)

Design the data model (pages, sections, theme, nav), ACLs (public read of published, admin
write), and the publish/duplicate/contact-form flows as cloud functions built in the §1
composition idiom — authored THROUGH the new MCP surface as its own dogfood. Expect it to surface
more core bugs; that is the phase's purpose — fix or file as you go. Then SB-005/006 (admin panel,
public site), SB-007 (ship embedded — see TASKS.md's relayed FB-005 notes: `listing({})` not
`list()`, category `site`, platform path invisible to the editor), SB-008 (the drive: verify an
anonymous visitor sees a published page and an unpublished one 404s).

## Traps that will bite here specifically

- A cloud FUNCTION's interface is the Request node's `params` string — NOT `Component Inputs`.
  Helpers (no Request node) use Component Inputs/Outputs and are not endpoints.
- Assert MCP-written components by REGISTRY KEY and the component file's `path` field, never
  through `store.resolve` (its lenient fallback masks mis-keyed writes).
- `noodl-mcp/src/tools/author.ts` trips grep's binary detection — use `grep -a`.
- A workflow step calls its function in-process with no session: step-called functions need
  `Allow Unauthenticated` ticked; the Permissions panel rule cannot fix a failing step.
- Shared checkout: phase-75 session live in launcher/wizard/`ProjectsPage.tsx`; commit by
  pathspec, never stage-then-commit; announce before any editor launch/teardown.
