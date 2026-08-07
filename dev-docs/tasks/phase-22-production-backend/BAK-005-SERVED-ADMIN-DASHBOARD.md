# BAK-005: The Served Admin Dashboard

## Metadata

| Field | Value |
|-------|-------|
| **ID** | BAK-005 |
| **Phase** | Phase 22 — Production Backend (Revival Track H) |
| **Tier** | 2 — parity |
| **Priority** | 🟠 High (a deployed backend nobody can look inside is not operable) |
| **Difficulty** | 🟠 Medium–High |
| **Estimated Time** | 2–3 weeks |
| **Prerequisites** | WF-004 (HTTP seam); BAK-003 (admin credential); benefits from BAK-007 (backup buttons) |
| **Branch** | `task/bak-005-served-admin-dashboard` |
| **Recommended executor** | 🟠 **Opus 4.8** — the component-reuse seam and this repo's packaging traps need iterative diagnosis; the product surface itself is conventional once the seam works. |

## Objective

Ship a web admin dashboard served by `nodegx-backend` itself at `/_admin` — data browsing and editing, schema, users/roles/permissions, triggers, executions, config — so an operator can administer a deployed backend with the editor closed. This is the Parse-Dashboard-shaped gap, closed the Pocketbase way: the service carries its own UI.

## Background

After WF-004, the editor's Backend Services panel (~4,600 lines: data browser, schema manager) talks to the service over HTTP. That seam is the whole opportunity: the *data layer* of those views is already service-shaped. What no one has claimed is the deployment story — on a VPS the service is administered by `curl` or not at all. WF-007 deletes the orphaned `noodl-parse-dashboard` package; this task is its rightful successor, built against our own service rather than Parse.

**The seam decision is the task's real design work.** Two viable routes: (a) extract the panel's data-browser/schema components into a shared package consumed by both the editor and a small admin SPA; (b) build a lean admin SPA that reuses the *HTTP contract* but not the components. Route (a) maximizes reuse but risks dragging editor dependencies; the headless-editor-export recipe (esbuild + shims, proven in SUB-004 and noodl-preview) is the prior art that makes it plausible. Assess first, decide, record. Either way the *editor keeps its panel* — this dashboard is for operating deployed instances, and the one-panel constraint governs the editor only.

## Current State

- Backend Services panel components live in the editor renderer; coupling to editor internals unmeasured.
- No static-serving or SPA route in `LocalBackendServer.js`; WF-004 adds `/health` and the API surface only.
- BAK-003 (prerequisite) defines the admin credential; before it lands there is no non-editor admin auth at all.
- `noodl-parse-dashboard`: orphaned, scheduled for deletion (WF-007) — reference material at most.

## Desired State

- `/_admin` serves a self-contained SPA (no CDN dependencies; assets bundled into the package) gated by BAK-003's admin credential, with sessions, login page, and logout. Disabled entirely via config/flag for operators who want no admin surface exposed (`--no-admin`).
- **v1 feature set** (parity with the editor panel, not beyond it):
  - Collections: browse/filter/sort, create/edit/delete records, live-updating via BAK-001's SSE
  - Schema: tables, columns, relations; create/alter within the same limits the panel allows; **delete table** (finally wiring the dead `backend:deleteTable` capability — coordinate with WF-004's checklist item)
  - Users & roles: list, create, disable, password reset trigger, role membership; permissions editor (BAK-003's CLP editor rendered here)
  - Triggers: list with last-fired/last-result, enable/disable (WF-005's registry)
  - Executions: history list + detail (WF-006's store)
  - Config: email settings + test send, OAuth providers, backup status/run-now (as those tasks land — degrade gracefully to hiding sections whose backing task isn't shipped)
- **First-run flow**: a freshly deployed instance with no admin credential set serves a one-time setup page to create it (Pocketbase-style), refusing app traffic until done *only* if BAK-003's posture requires it — align with its model document.
- Read-only mode: a second credential tier or flag for look-don't-touch access (support/demo use).
- Audit: every admin mutation logs through BAK-009's audit trail once it exists; until then, into the service log.

## Scope

### In Scope
- [ ] Seam assessment (extract-components vs. rebuild-on-contract) with a spike, decision recorded
- [ ] Admin SPA, bundled assets, served at `/_admin`, CSP with no external origins
- [ ] Admin auth against BAK-003's credential + first-run setup flow + `--no-admin`
- [ ] The v1 feature set above, sections feature-flagged by backing-task availability
- [ ] Live data via BAK-001 SSE
- [ ] Delete-table wired end-to-end with confirmation
- [ ] Read-only mode
- [ ] Packaged verification: dashboard works from the packaged editor's spawned service *and* a bare `nodegx-backend serve` on a clean VM
- [ ] Docs: exposure guidance (behind VPN/reverse-proxy auth for the cautious), first-run, read-only

### Out of Scope
- Editing *graphs* (functions/workflows) in the dashboard — that is the editor's job; the dashboard shows executions and config, it does not author
- Multi-backend/fleet management (one dashboard per instance)
- Dashboard theming/branding
- Any editor-panel feature growth (parity target only)

## Implementation Steps

1. **Spike the seam**: measure what the panel's data browser actually imports; attempt the esbuild+shims extraction on the single hairiest component; decide (a) or (b) on evidence; record.
2. **Skeleton**: served SPA + admin auth + first-run + `--no-admin`, deployed-VM smoke before features.
3. **Collections + schema** (incl. delete table), then **users/roles/permissions**, then **triggers + executions**, then **config sections**.
4. **SSE liveness; read-only mode.**
5. **Packaged + clean-VM verification; docs.**

## Success Criteria

- [ ] On a clean VM: `nodegx-backend serve` → browse to `/_admin` → first-run setup → create a collection, add records, set permissions, watch a live update arrive — editor never installed
- [ ] Wrong/absent admin credential: fully locked out; `--no-admin`: route absent
- [ ] Delete table works with confirmation and is audited
- [ ] Sections for unshipped backing tasks hide rather than error
- [ ] Read-only credential can inspect everything and mutate nothing
- [ ] Works identically against the editor-spawned local service; packaged-app verification done (this repo's packaging-trap history makes this a named step, not a formality)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Component extraction drags half the editor into the backend package | The spike decides on evidence; route (b) is a legitimate outcome — the HTTP contract is the reuse that matters |
| Admin surface becomes the attack surface | BAK-003 credential + rate-limited login + `--no-admin` + exposure docs; no session cookies without CSRF protection — pick token-header auth |
| Two UIs drift (panel vs. dashboard) | Shared components if (a); if (b), a shared HTTP-contract test suite both UIs' backends pass |
| Scope creep toward a second editor | The "no graph authoring" line is stated in scope and held |
| First-run flow conflicts with BAK-003 posture | Alignment with its model document is an explicit step |

## References

- [WF-004](../phase-19-cloud-workflows/WF-004-BACKEND-SERVICE.md) — the HTTP seam; the dead `deleteTable` handler
- [BAK-003](./BAK-003-ACCESS-CONTROL.md) — admin credential, permissions editor
- [BAK-001](./BAK-001-REALTIME-SUBSCRIPTIONS.md) — liveness; [WF-005](../phase-19-cloud-workflows/WF-005-TRIGGERS.md), [WF-006](../phase-19-cloud-workflows/WF-006-OBSERVABILITY-WIRING.md) — the registries/stores rendered
- SUB-004 / `packages/noodl-preview` — the esbuild+shims headless-export recipe (prior art for extraction)
- Pocketbase admin UI — the parity benchmark

## Checklist

- [ ] Seam spike + recorded decision
- [ ] Skeleton (auth, first-run, --no-admin) green on a clean VM
- [ ] v1 features; SSE; read-only; delete-table
- [ ] Packaged verification; exposure docs; CHANGELOG
