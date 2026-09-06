# EL-006 — The LMS you own

| Field | Value |
|---|---|
| **Tier** | 4 |
| **Effort** | **L+ — needs slicing before it starts** |
| **Surface** | `templates`, `backend` |
| **Rulings** | **D5** (self-hosted only) · **D6** (standalone auth, not Community accounts) · **D2** |
| **Depends on** | EL-002 (the statements it stores), EL-003/EL-004 (the courses it delivers); EL-005 not required (its whole point is orgs *without* an LMS) |

## The job

For organisations with no Moodle and no Canvas: the LMS as a **NodeGX starter they own** — not a
hosted product, not a platform feature, a template project plus backend schema they stand up on
their own infrastructure and reshape in the editor. The other half of the 10X claim: the course
and the platform are the same substance, and the wall between them is gone.

The shape (slicing will turn each into its own sub-task):

- **Backend schema**: users + roles (learner / trainer / admin), **cohorts**, enrollments, a
  course registry (title, deployed URL, version), **assignments** (issue → in-progress →
  submitted → reviewed, with due dates), an **LRS-lite** (xAPI statements table + the minimal
  statements POST/GET endpoints EL-002's transport needs), and progress rollups.
- **Learner surface**: home (my cohorts, my assignments, my progress), course launch, history.
- **Trainer surface**: cohort creation and roster management, assignment issue/track/review,
  per-learner and per-cohort progress dashboards fed by the statements table (including the
  item-level decision data EL-004 emits — the dashboard that shows *which choice* learners made
  is the demo that sells the phase).
- **Admin surface**: user management, role grants, course registry.
- **Deployment story**: the self-hosted backend + frontend deploy documented as part of the
  template ("stand this up on your own box" is a first-class doc, not a footnote).

## Acceptance criteria

1. **The cold-start drive**: on clean infrastructure, following only the template's own docs,
   stand up backend + frontend; create a trainer, a cohort of ≥3 learners; register a deck course
   and a scenario course; issue an assignment with a due date. Timed and recorded — this drive is
   also EL-008's final tutorial script.
2. A learner completes an assigned course; their statements land in the LRS-lite; the trainer
   dashboard shows completion, score, and per-decision breakdown for the scenario. **End to end
   across the seam**: authored in NodeGX, deployed, reported, displayed — no manual data moves.
3. **Roles enforced and measured**: a learner session requesting a trainer view/endpoint is
   refused server-side (not merely un-linked in the UI — assert the endpoint, the
   `conditional-ui-goes-through-mounted-not-visible` lesson applied to authorization).
4. The nudge seam exists for EL-007: assignment due dates and last-activity timestamps are
   queryable server-side.
5. **It is editable**: a user opens the LMS project in NodeGX and changes a dashboard (add a
   column, change a chart) without touching backend code — driven.
6. **The data posture is written before the schema is** (the P67/P68 GDPR habit): learner records
   are personal data; the template's docs state retention, export, and deletion answers, and the
   LRS-lite has a per-learner export. An LMS template with no data-subject story is not shippable.

## Traps

- 🔴 **The shared hosted backend is a record-capped demo tier by design** (P67 D9). The template
  must be loud about this: demoing against it is fine, running a cohort on it is not, and the
  docs + a visible capacity warning say so. Silent demo-tier production is this task's named
  failure mode.
- 🔴 **No kit nodes server-side** (CN-012: cloud functions hang on kit nodes). All backend logic
  is built-ins/plain functions. The LRS-lite endpoints in particular are plain backend code.
- 🔴 **Not the Community spine, and the docs must say so** (D6). This LMS's roster/assignment
  machinery is deliberately separate from UNI-005/UNI-006 — different product, different data
  owner, different repo-substance. P67's reconciliation history shows what conflation costs;
  name the boundary in the template README.
- ⚠️ **LRS-lite is not "an LRS"**: it implements the subset EL-002 needs (statement POST, basic
  GET/filter). Claiming xAPI-LRS conformance invites a conformance suite this phase doesn't fund.
  State the subset; emitting *to a real external LRS instead* is already supported by the kit.
- ⚠️ Minors: if a school runs this, the org is the data controller (the P67 D10 posture is the
  reference thinking) — the template docs carry a section, not a feature.
- ⚠️ Scope discipline: this task will try to grow a marketplace, SSO, certificates, gamification.
  v1 is roster + assign + track + review + dashboards. Everything else is a follow-on the
  template's openness makes possible — which is the pitch, so let the pitch do it.

## Out of scope

- Hosting it for customers — v1 is self-hosted only (D5). A managed offering is a business
  decision for another day.
- SCORM *import* (running third-party SCORM packages inside this LMS) — a real feature, a
  different task; v1 delivers NodeGX-built courses by URL.
- Content authoring inside the LMS — authoring stays in NodeGX; the LMS is delivery + tracking.
- Cross-org federation, SSO/SAML, certificate generation.
