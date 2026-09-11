# Phase 76 — The Site Builder

> 🔴 **PHASE 76 IS CLOSED (2026-08-29).** Eighteen tasks, 28 findings, 24 fixed in-session or
> given a task. Its four still-open tasks (SB-009..012) and three unowned findings are carried
> forward by name — read [**the closing section at the end of TASKS.md**](TASKS.md) before
> acting on anything here, and its findings register is
> [DEFECTS-PHASE-76-FOUND.md](DEFECTS-PHASE-76-FOUND.md).


**Scoped:** 2026-08-26, from Richard's template roster for the 0.2.1 launch. **Status: CLOSED 2026-08-29.**
**Prefix:** `SB`.

The first of three default launcher templates for 0.2.1 (order ruled by Richard 2026-08-26:
site builder → personal landing page → pixel game; then storefront, membership hub, data
dashboard, interactive fiction, shared pixel canvas). This one goes first *because* it is the
hardest: an admin panel that configures a public site, both NodeGX apps against one backend,
deployable to a client who edits their own homepage without touching the graph. It is chosen to
surface core backend bugs — and the scoping sweep already surfaced several before any code was
written (§3).

## 1. The question this phase was scoped around, and its answer

Richard's hypothesis: *cloud functions need re-examining in terms of function "components" — the
backend should encourage componentization the way the frontend does.*

**The sweep's answer: the runtime already has exactly this, and it is the shipped idiom — what's
missing is the authoring surface, the guidance, and boundary hygiene.** Evidence
(full map in the session-42+ Explore report; canonical model doc:
`dev-docs/reference/BACKEND-AUTHORING-MODEL.md`):

- A cloud function is an ordinary component under `/#__cloud__/` with Request/Response roots.
  A cloud graph **can instantiate other cloud components** with `Component Inputs`/`Outputs` —
  no denylist, same-runtime is the only rule (`createnodeindex.ts:90-98`), resolution works
  server-side, and it is proven by `nodegx-backend/tests/cloud-run-tasks-loop.test.ts`.
- **The prefab library is built this way already**: the `stripe` prefab is 17 cloud components,
  3 levels deep — thin Request/Response shells delegating to `Stripe/Subscriptions/*`, a shared
  `Stripe/Settings` wrapping a `noodl.cloud.secret`. `email-verification` composes four.
- The editor even *models* the distinction: a component is a "cloud function" iff its graph has a
  `noodl.cloud.request` node (`ComponentIcon.ts:11-14`), and the reference picker already
  excludes functions, allowing only components (`componentpicker.ts:119-127`).

So the phase is **not** "redesign cloud functions". It is: make the idiom the codebase already
practices **authorable by Claude, taught to Claude, and safe at the HTTP boundary** — then prove
it by building the most backend-heavy template we ship.

Deliberately out: function-calls-function (CWF-008 slice 4 stays deferred; composition is by
component instance — see D2), streaming function responses (design doc only, CWF-007/phase-45;
not needed here — the realtime hub covers live preview).

## 2. What the template is

One project, two surfaces (pending D1):

- **Public site** — pages rendered from records: page → sections (hero, gallery, text, contact…),
  a theme record driving design tokens, navigation derived from published pages.
- **Admin panel** — role-gated (`admin` role, per-record ACL): edit pages/sections, upload images
  (file storage exists: `POST /files/:name`, local + S3 drivers), tweak theme, publish/unpublish.
  Live preview via `Subscribe to Changes` (SSE realtime hub — exists, delivery gated by the same
  ACL predicate as queries).
- **Backend** — auth (login/signup/roles all exist), records with ACLs, cloud functions for
  publish/duplicate/contact-form-email (`Send Email` exists), composed from reusable cloud
  components per §1.

The irony is the point: a WordPress-shaped thing where both halves are legible NodeGX graphs the
buyer can open.

## 3. Defects the sweep already found (fix under SB-003, or file upstream)

1. 🔴 **Every `/#__cloud__/*` component is exposed as a callable function name.** `hasFunction()`
   matches on name only (`WorkflowRunner.ts:641`); a helper component with no Request node
   passes it, then 500s ("Could not find request node") instead of 404ing. Helper components
   also appear in `GET /admin/permissions/functions` as functions with `allowNoAuth: false`.
2. 🔴 **`FUNCTION_NAME_RE` is enforced only at the two creation doors**, never at export or
   runtime — nested prefab-style names (`SendGrid/Send Email`) violate it and ship anyway.
3. 🔴 **MCP `create_component` cannot mint a cloud component at all** — `toPathForm` strips the
   leading `#`, so the path lands outside `/#__cloud__/` and would ship in the *frontend*
   bundle; the zod schema still accepts `type: 'cloud'`, so an agent can write a component whose
   metadata and destiny disagree. Recorded (not closed) in AWP-002 §"the fourth component type".
4. 🔴 **MCP `validate.ts` has no runtime/`availableIn` check** — nothing stops
   `noodl.cloud.request` in a browser component or a browser node in a cloud graph.
5. **MCP instructions teach componentization for the frontend only** (`instructions.ts:66-77`);
   the backend gets one sentence, about provisioning. The prefab idiom is taught nowhere.

## 4. Tasks

| id | task | summary |
|---|---|---|
| SB-001 | **The cloud component Claude can write** | MCP `create_component`/`update_component`/plans author `/#__cloud__/` components; path form settled; `validate` gains the runtime-context check (finding 4); conformance added to the AWP-002 gate. |
| SB-002 | **The backend has a vocabulary too** | MCP instruction + doc surface teaching the shipped idiom: thin Request/Response shells over reusable cloud components, shared Settings components for secrets, when a workflow vs a function. ⚠️ `instructions` are fixed at `initialize` and the tool surface has token budget gates — measure on the wire. |
| SB-003 | **A helper is not an endpoint** | Findings 1–2: helper components 404 (not 500), disappear from the permissions listing, and the name rule is either enforced at export or nested names are legitimized. Naming/UI legibility of function-vs-component belongs to phase-43 (open, unscheduled) — coordinate, don't absorb. |
| SB-004 | **The site is records** | Data model: pages, sections, theme, nav; ACLs (public read of published, admin write); publish flow as cloud functions built in the §1 idiom. |
| SB-005 | **The admin panel** | Page/section editor, image upload, theme editor, live preview via realtime. |
| SB-006 | **The public site** | Renders the records; navigation from published pages; the part the client's visitors see. |
| SB-007 | **It ships as a template** | Package via FB-005's registry/provider mechanism (FB-005 owns the picker and registry repair — **do not re-spec**; its scope doc records the registry has never been reachable and names three defects in its download path). Conditional starter-kit install is D4 of phase 70 (`STARTER_ASSETS`); MCP `create_project` writing its own skeleton is EL-001's — consume, don't duplicate. **✅ DONE s9 — and read the finding rather than the row.** Consuming the registry was a `*.template.ts` and one map line, exactly as scoped. The task's actual content was that **the eighteen components five sessions authored have no app around them**: every run authored into `tests/fixtures/demo-app`, which already held the `App` and the `Router` named `Main` that eleven `RouterNavigate` nodes point at. A router-less project is ruled legitimate, so five page writes succeed and register nothing, reported as an **absent key** ([SB-007](SB-007-IT-SHIPS-AS-A-TEMPLATE.md), one-edge arm + control). The template is therefore **generated** from the component sets and byte-gated against them, and F22 — an id rewrite that missed `graph.visualRoots` because no template had ever had one — was measured and fixed on the way. |
| SB-008 | **The drive** | An agent builds a page end-to-end through the admin panel in the running app; verify the consequence (published page renders for an anonymous visitor; unpublished 404s), not the mechanism. **✅ DONE s8 — but read the narrowing rather than the row.** The *consequence* half is fully met and mutation-adjacent-graded ([SB-008](SB-008-THE-DRIVE.md), 20 specs, 4 controls including a dev-open twin in which the same draft renders). The *"through the admin panel"* half is **not**: the rows were written over REST carrying the panel's authored ACL, and **nothing in this phase has clicked the panel's own UI**. The narrowing was made in `TASKS.md` before s7 ("scope it as a UI drive of the public site, not a permissions drive") and is named again in SB-008 §6 and SB-005 acceptance 6 so it cannot be rounded off. |

Build order: SB-001..003 first (enablement — they're the "important core bugs" this template was
picked to flush out), then SB-004..006 authored *with* the new surface as its own dogfood,
then SB-007/008.

## 5. Rulings needed (Richard)

- **D1 — one project or two?** One project with role-gated admin pages (simpler, one deploy) vs
  two projects sharing a backend (cleaner client handoff, harder story). Draft assumption: one.
- **D2 — confirm function-calls-function stays deferred.** Composition by component instance is
  the model; CWF-008 slice 4 stays parked unless SB-004 hits a wall that instances can't express.
- **D3 — does SB-003's boundary fix land in 0.2.1** (it touches the permissions panel and every
  existing backend) or ship behind the phase?
