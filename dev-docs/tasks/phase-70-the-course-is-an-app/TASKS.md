# Phase 70 — the tasks (EL: the course is an app)

**Created:** 2026-08-18 out of [README.md](README.md). Read the README's three principles first —
**P1** opt-in, invisible otherwise; **P2** logic in the kit, looks in the template; **P3**
standards at the boundary, and the deck is a mode, not the product. All three are acceptance
criteria in every task, not sentiment.

> 🔴 **Read [README §4 Prior-art reconciliation](README.md) before starting any task.** Four
> phases own adjacent ground. The one-line version: P67/P68 deferred SCORM/LTI **to here** but own
> the platform and the word "lesson"; P69 is the kit substrate and its CN-012 finding (**no kit
> nodes server-side — a cloud function using one hangs**) binds EL-002/006/007; P67's D9 (the
> hosted backend is a **record-capped demo tier**) binds EL-006.

> ⚠️ **The rulings queue (README §5, D1–D7) is OPEN.** D2 (vocabulary) blocks all UI copy; D5/D6
> block EL-006's design; D7 blocks EL-008's hosting. D1/D3/D4 have recommendations that nothing
> contradicts — confirm in one sitting before Tier 1 ships anything user-visible.

**Tiers:** 0 = instruments · 1 = the spine (stamp + kit) · 2 = the templates · 3 = interop ·
4 = the LMS · 5 = teaching.

**Effort:** S ≈ a session · M ≈ 2–3 · L ≈ a week+ · L+ ≈ needs slicing before it starts.

| Task | One line | Surface | Tier | Effort | Depends on / must honour |
|---|---|---|---|---|---|
| **[EL-009](EL-009-THE-EYES-MUST-SEE-EVERY-PAGE.md)** | **The eyes must see every page.** `render_report` serves one path — even the start page's own `urlPath` 404s — so every multi-page claim in this phase is blind. Gives the recorded open finding its task number | devtools / mcp | **0** | S/M | none — **first**. ⚠️ It is UNI-010 F4's instrument (CN-001's ordering lesson); ⚠️ the 8,280 MCP surface bar has **57 tokens** free |
| **[EL-001](EL-001-THE-PROJECT-THAT-KNOWS-ITS-PURPOSE.md)** | **The project that knows its purpose.** Wizard card behind `experimental.elearning`, `metadata.projectType` stamp read via one `isELearningProject()` helper, kit installed by the D4 starter-assets route, D1's add-it-later toggle, and the MCP `create_project` parity decision | editor / mcp | **1** | M | D1, D4. ⚠️ MCP writes its own skeleton — parity lands twice or once-shared, never silently not |
| **[EL-002](EL-002-THE-LEARNING-KIT.md)** ⭐ | **The learning kit.** `nodegx.learn.*`: xAPI emitter, the transport-adaptive Report Progress (SCORM API → LRS → local), the data-driven quiz engine (a question is a **row**), course state. In-repo, gated, all four registrations + lockfile | kit / runtime / catalog | **1** | L | D2, D3, D4. 🔴 Browser-only by design (CN-012); never declare `runtimes:["cloud"]`; namespace defends the precedence split |
| **[EL-003](EL-003-THE-DECK-TEMPLATE.md)** | **The deck template.** The PowerPoint-shaped on-ramp: shell + slide prefabs + sequence-as-data, wired to the kit once so slide authors never touch logic. 🔴 **Measure the navigation substrate first** (Component Stack vs page router — nobody has measured either for this) | templates / editor | **2** | M/L | EL-001, EL-002, EL-009. D2 blocks copy. AC1's no-graph drive becomes tutorial 1 verbatim |
| **[EL-004](EL-004-THE-SCENARIO-TEMPLATE.md)** ⭐ | **The scenario template.** Branching with carried state, ≥2 endings, one xAPI statement per decision — the thing Storyline cannot legibly do, and the canvas **is** the scenario map. Equal billing with the deck (P3) | templates / editor | **2** | M | EL-002; shares EL-003's measured substrate. AC4 lands the legibility claim on a real instructional designer |
| **[EL-005](EL-005-THE-SCORM-PACKAGE.md)** ⭐ | **The SCORM package.** One packaging core (manifest + `window.API` adapter + zip), two doors: headless first, then a `DeployPopup` tab gated on `isELearningProject()`. 🔴 **AC1 = imports and reports in Moodle + SCORM Cloud** — the phase's credibility gate | deploy / editor | **3** | L | EL-001, EL-002. D3. 🔴 Measure relative-path survival first; 🔴 the core must live where `build.files` ships it, tested **bundled**; CSR forced (CN-013 open) |
| **[EL-006](EL-006-THE-LMS-YOU-OWN.md)** ⭐ | **The LMS you own.** Roles, cohorts, enrollment, assignments, LRS-lite, trainer dashboards — a self-hosted starter the org reshapes in NodeGX. 🔴 D9: never silently demo-tier production; 🔴 no kit nodes server-side; 🔴 not the Community spine, and says so | templates / backend | **4** | **L+** | **Slice before starting.** D5, D6, D2. Data posture written before the schema (AC6) |
| **[EL-007](EL-007-THE-NUDGE-MACHINE.md)** | **The nudge machine.** Five template workflows (welcome, reminder, inactivity, completion, trainer digest). 🔴 **Measure the backend's scheduling primitive first** — a workflow with no trigger is the failure mode; absence controls beside every firing case | backend / templates | **4** | M | EL-006 (its AC4 seam). CN-012 again: built-ins only server-side |
| **[EL-008](EL-008-THE-TUTORIALS.md)** | **The tutorials.** Six curated lessons, first-course → branching → SCORM → your own LMS; scripts are EL-003/EL-006's drives verbatim. 🔴 A lesson teaching a kit node meets `lessonverify`'s F1 — confirm the CN-003 overlay on *these* lessons | platform / docs | **5** | M | D7 (P67 sign-off — spends their curriculum capacity), D2. Each tutorial lands **with** its feature |

---

## Suggested order

1. **EL-009 alone, immediately** — the instrument. While it is blind, every "the template renders"
   claim in this phase is about one view. (Coordinate with the P67 lane per CN-001's precedent.)
2. **Rulings sitting** — D1–D7 in one pass; only D2 (vocabulary) truly gates early work, but the
   sitting is cheap and P67's history says queues emptied early beat queues discovered late.
3. **EL-002 → EL-001** — the kit exists before the create flow installs it; EL-001's gating can
   land in parallel behind the experimental flag.
4. **EL-003 + EL-004** as one arc — they share the measured navigation substrate and the P3
   equal-billing surface; build the deck first only because its drive script seeds tutorial 1.
5. **EL-005** — the credibility gate. The phase has no external claim until AC1's two real LMSes
   pass.
6. **EL-006 (sliced) → EL-007** — the 10X half; EL-006's slicing is its own first deliverable.
7. **EL-008 throughout** — each tutorial lands with its feature, not in a docs sprint at the end.

## Standing obligations for every task here

- **Build the caller** (P69's discipline, inherited): a kit without a course driving it, a
  packager without an LMS importing it, a template without a no-graph author surviving it — none
  of these is done.
- **Measure premises first, and mark the false ones in the task file** — the P66 lesson (7 of 16
  premises false). This phase's specs were written from two exploration reports dated 2026-08-18;
  every "the seam is X" claim re-verifies on arrival.
- **Verify the consequence, not the mechanism**: write the observation a working feature would
  produce *before* driving, and check the sentence could not also be true of a broken one — the
  "Rendered clean over a missing node" failure shape is this phase's to inherit, via EL-009.
- **P1 is a control, not a vibe**: every task that adds eLearning surface asserts an ordinary
  project doesn't see it — driven, on the real UI, not inferred from a conditional in the source.
- **The vocabulary is D2's** once ruled; "lesson" belongs to UNI-007. A stray "lesson" in phase-70
  UI copy is a defect, not a style note.
