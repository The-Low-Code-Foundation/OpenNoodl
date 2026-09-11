# Phase 70 — The Course Is an App

**Created:** 2026-08-18, out of a strategy conversation with Richard (an instructional-design
student at university hates Articulate Storyline and loves NodeGX — that is a wedge, and this phase
is the credible version of walking through it). **Prefix:** `EL`.
**Surfaces:** `editor`, `kit`, `templates`, `deploy`, `backend`, `platform` (tutorials only).

> **The concept, in one sentence.** An eLearning course is not a slideshow trapped in a player —
> it is an app; NodeGX already builds apps, so the wall between "authoring tool" and "delivery
> platform" is an artifact of the old toolchain, and this phase starts dissolving it while staying
> scrupulously compatible with the toolchains everyone already owns.

This phase is **opt-in by construction**: a person creating an ordinary app must never meet any of
it. It is also, deliberately, almost entirely **user-space**: kits, templates, a packaging step and
tutorials — built with the same customisation surfaces any user has. The editor-code footprint is
three small seams (a wizard card, a metadata stamp, a conditional deploy tab), and that smallness
is strategic: if *we* need core changes to build courseware, the pitch that *anyone* could have
built it is false.

---

## 1. The opening, and the order of attack

Storyline's weaknesses are architectural, which is what you want in an incumbent: a flat trigger
list that cannot express branching legibly (a node graph is the native representation); binary
`.story` blobs (NodeGX projects are plain files — diffable, reviewable, CI-checkable); no component
model (copy-paste slides vs parameterised components); output that is a slide player rather than a
web page; and — the argument an instructional designer feels — **the tool's shape pushes authors
toward click-next courseware**. A graph pushes toward decisions, branches and state, which is what
good learning design looks like.

The order of attack is the trojan horse, not the frontal assault:

1. **Credible first.** A learning kit (tracking + scoring logic), two starter templates an
   Articulate refugee can open and understand, and SCORM packaging so a NodeGX course drops into
   Moodle/Canvas/Cornerstone/whatever the org already runs. Nobody is asked to replace anything.
2. **10X after.** Real-app simulations (don't screenshot the software — ship a working replica),
   AI authoring into a validated graph (the MCP loop already exists; Articulate's AI is bolt-on
   text), the closed data loop (lessons that *consume* learner data: adaptive release, dashboards),
   and finally the LMS-as-a-template — for orgs with no LMS at all, the platform is just another
   NodeGX project they own.

**What this phase ships is tranche 1 plus the foundations of tranche 2** (the LMS starter, the
backend workflows). The simulations and adaptive-release stories are follow-on phases that need
tranche 1's vocabulary to exist first.

---

## 2. The three principles

Every task is measured against these. They are acceptance criteria, not sentiment.

**P1 — Opt-in, invisible otherwise.** A regular project never sees a SCORM tab, an xAPI node
category, or an eLearning wizard card it didn't ask for. The choice is made at project creation
(and can be enabled later — see ruling D1), and every eLearning surface keys off one stamp read
through one helper. Any eLearning UI reachable from an ordinary project is a defect.

**P2 — Logic in the kit, looks in the template.** Template components fork into each project:
right for slide layouts (authors *should* reshape them), fatal for tracking logic (a bug fix would
strand every course ever created). So: the xAPI emitter, progress reporting, quiz scoring and the
scenario controller live in the **learning kit** (versioned, upgradeable, in-repo and gated —
see the CN-007 trap in §4); slide shells, title cards and layout prefabs live in the **templates**.
A task that puts tracking logic in a template component, or hardcodes a look into a kit node, has
its layers backwards.

**P3 — Standards at the boundary, NodeGX inside; and the deck is a mode, not the product.**
Everything that crosses the project boundary speaks the industry's language — real xAPI statements
to any LRS endpoint, a real `imsmanifest.xml`, the real `window.API` discovery walk — because the
trojan horse only works if the payload is standards-clean. Inside the project it is all plain
NodeGX: no parallel runtime, no proprietary lesson format. And the slide/deck template is **one of
two equal front doors** — the branching-scenario template gets equal billing, because a tool that
opens on "here are your slides" produces click-next courses with extra steps.

---

## 3. The seams, as mapped (2026-08-18)

Mapped by reading, not yet all driven — each task carries its own measure-first obligations.

- **Project creation.** The wizard is
  `packages/noodl-core-ui/src/preview/launcher/Launcher/components/ProjectCreationWizard/` (steps:
  entry mode, basics, style preset, scoping, review); the host funnel is
  `ProjectsPage.handleCreateProjectConfirm`, which today **always passes `projectTemplate: ''`** —
  there is no template picker in the product, only style presets. Provisioning is
  `LocalProjectsModel.newProject()`: a non-empty `projectTemplate` URL already routes through
  `templateRegistry.download()`, so the create path needs widening, not building.
- **Templates.** A provider registry (`utils/forge/`) with three providers. Bundled templates live
  in `models/template/templates/` (today: exactly one, `hello-world.template.ts`), registered in
  `EmbeddedTemplateProvider`'s map as `embedded://<id>`, with a README documenting how to add one.
  🔴 **Load-bearing constraint: an embedded template's `download()` writes `project.json` content
  only** — components, settings, metadata; no file payload. ✅ **But kit preinstall has proven
  prior art anyway**: `models/template/starterAssets.ts`'s `STARTER_ASSETS` already copies **two
  kits** (`noodl_modules/inter`, `noodl_modules/lucide-icons`) into every new project, after the
  template lands and before the project loads, so the module scanner sees them on first scan. The
  list is currently **unconditional** — the learning kit's install is the same mechanism made
  conditional on the template id (D4).
- **The project-type stamp.** `ProjectModel` has two serialized bags: `settings` (user-facing
  toggles, `Record<string, any>`) and `metadata` (`setMetaData`/`getMetaData`, described in-source
  as "set once at project creation" — the right semantics). There is even a precedent for a
  project-kind discriminator: the top-level `lesson` field and `isLesson()`. The stamp is
  `metadata.projectType = 'elearning'` read through one `isELearningProject()` helper (P1).
- **Deploy.** `DeployPopup.tsx` enumerates targets as a **literal one-element array**
  (`[{ label: 'Self Hosting', content: <DeployToFolderTab/> }]`) — no registry. The static-site
  producer is `utils/compilation/build/deployer.ts` (`deployToFolder`), and `Compilation` supports
  build scripts (`onPostBuild`) — the natural injection point for manifest generation. A SCORM tab
  is: conditionally push a second tab (P1), deploy to a staging dir through the *same* pipeline,
  wrap and zip.
- **Feature gating while it lands.** `EditorSettings` + the `experimental` pattern
  (`EditorSettingsTab.tsx`'s hardcoded feature array; `featureFlags.ts` is the canonical resolve
  order). The wizard card itself hides behind `experimental.elearning` until the phase is ready.
- 🔴 **MCP `create_project` does not use the editor's template mechanism.** It writes its own v2
  skeleton (`writeProjectSkeleton` in `packages/noodl-mcp/src/tools/createProject.ts`) and shares
  only the scoping model with the editor (the `editor-deps` pattern). So "create an eLearning
  project" lands **twice or once-shared** — EL-001 owns that decision, and the shared option also
  fixes the existing asymmetry where MCP-created projects skip `installStarterAssets`.

---

## 4. Prior-art reconciliation

> 🔴 **Read this before starting any task.** Four phases already own adjacent ground, and this
> phase exists partly *because* two of them deferred it.

- **P67 (NodeGX Community / University) and P68 (LearnBook) both deferred LMS interop by name.**
  [`UNI-006`](../phase-67-nodegx-university/UNI-006-ASSIGN-GRADE-REVIEW.md) line ~193: *"gradebook
  export/LMS integration (SCORM/LTI — a school will ask; noted"*; [P68
  README](../phase-68-learnbook/README.md) "deliberately NOT" list: *"LMS interop (SCORM/LTI), same
  deferral as UNI-006."* **This phase is where that deferral lands — but in NodeGX substance, not
  on the platform.** The boundary: P67/P68 are the *Community's* surfaces (accounts, coaching,
  curriculum) in the platform repo; phase 70 ships kits and template projects that **users own and
  self-host**. Nothing here touches the Community spine, and the LMS starter does **not** reuse
  Community accounts (see D6) — an org's learner records do not belong on our community site.
- 🔴 **Vocabulary is already legislated.** P67's D13 reserves **"lesson"** for UNI-007's
  editor-lesson format, and P68 records the two-vocabulary failure that ruling cleaned up. This
  phase therefore needs its own terms ruled before UI copy exists (D2) — working draft: an author
  builds a **course** made of **activities** (a slide is one kind of activity), delivered to
  **learners** in **cohorts**. "Lesson" appears nowhere in phase-70 UI or docs except when
  genuinely referring to UNI-007 lessons (the tutorials in EL-008 *are* UNI-007 lessons, about
  building courses — that sentence is why the vocabulary must not blur).
- **P69 (custom nodes) is the substrate, and three of its findings bind here:**
  - The learning kit is exactly the kind of kit P69 made real — no build step, `noodl_modules/`,
    catalog overlay, validated. **CN-016 (publish a kit) is not built yet**, so v1 distribution is
    template-embedded (D4), with library-channel distribution when CN-016 lands.
  - 🔴 **CN-012 measured that the cloud runtime has NO kit loader** — `CloudRunner` never registers
    modules, a cloud function using a kit node *hangs*, and making kits run in the cloud is an
    **open ruling owed to Richard** (executing kit JS in the backend process). Consequence for this
    phase: **EL-007's backend workflows must not use learning-kit nodes in cloud functions** —
    server-side logic uses built-ins (or plain function code) until that ruling and CN-013 land.
  - ⚠️ **The CN-007 trap: a kit outside the repo is unversioned and ungated** — the cashflow kit
    drifted within a day. The learning kit lives **in this repo, in a gated package** (all four
    registrations — the `a-package-in-no-gate-runs-no-tests` lesson), whatever else is decided.
- **P65 (the library)** records that the shipped module fleet is unhealthy (0 of 29 ever run;
  some register zero nodes). Nothing here assumes existing modules work; the learning kit proves
  itself with its own tests and drives.
- **P67's D9 backend ruling binds the LMS starter.** The hosted shared backend is
  **record-capped by design** — a demo tier, not production storage. The LMS starter template
  therefore targets a **self-hosted backend** and says so on the tin (D5). An org's learner
  tracking data on a capped shared demo instance is both a functional and a GDPR failure.
- 🔴 **An open instrument finding becomes this phase's tier 0.** `render_report` renders **one
  path only** — even the start page's own `urlPath` 404s — so anything multi-page is unmeasurable
  page-by-page (recorded 2026-08 as "OPEN, wants a task"). Every course is multi-page. EL-009
  gives that finding its task number, here, because this phase is its most demanding customer.
- **Storyline's actual strengths are deliberately not chased in v1:** timeline-synced narration,
  caption editing, screen-recording sims. A lightweight audio-cued sequence node can come later;
  a timeline editor is core-editor work this phase refuses (it plays the incumbent's game). The
  Review-360-style commenting workflow belongs beside P67's platform when its time comes.

---

## 5. The rulings queue (Richard, one sitting — D2 and D5 block UI copy and the LMS task; nothing blocks the kit)

| # | Question | Recommendation |
|---|---|---|
| **D1** | Is "eLearning" a project **type** fixed at creation, or a **capability** a project can turn on later? | **Capability, stamped at creation for the common case.** The wizard card writes the stamp; a Project Settings toggle can add it to an existing project (P1 still holds — nothing shows until the stamp exists). A one-way type would make "I'll add a quiz to my existing app" a project migration, which is exactly the rigidity we're escaping |
| **D2** | Vocabulary, given "lesson" is reserved (P67 D13) | **course / activity / learner / cohort**; a "slide" is one activity kind. Decide before any UI copy is written — P67 spent a day cleaning up a two-vocabulary failure |
| **D3** | Which interop standard first: SCORM 1.2, SCORM 2004, cmi5? | **SCORM 1.2 first** (widest LMS reach; simplest CMI data model) with **native xAPI alongside from day one** (the kit emits it regardless of packaging). SCORM 2004 sequencing and cmi5 later — cmi5 when there's a first customer whose LMS supports it |
| **D4** | How does the learning kit reach a project? | **v1: the `STARTER_ASSETS` mechanism made conditional on template id** — the exact route `inter` and `lucide-icons` already take into every new project (kit source in-repo, gated; copied to `noodl_modules/` between template write and project load). For *existing* projects, the `library/modules/` import flow already copies `noodl_modules/` folders; CN-016 formalises that channel later. Barely a ruling now — recorded so the conditionality (P1: ordinary projects don't get the learning kit) is chosen, not drifted into |
| **D5** | The LMS starter's backend posture | **Self-hosted only, stated on the tin** (P67 D9: the shared backend is a capped demo tier; learner records are personal data). The template ships with the backend deploy story documented, and refuses to be "demoed" into production silently |
| **D6** | Does the LMS starter touch Community accounts? | **No — standalone auth.** An org's learner roster is their data on their infrastructure. The Community spine (UNI-005 roster, UNI-006 state machine) stays platform-side; this is a different product for a different owner, and the docs say so to prevent the conflation P67 warns about |
| **D7** | Are EL-008's tutorials curated curriculum (P67 D17 pipeline) or ordinary community content? | **Curated** — they are the marketing surface of the whole play and should be first-party quality, served through D17's hosting. Needs P67's sign-off since it spends curriculum-pipeline capacity |

---

## 6. Definition of done for the phase

- A person who has never seen NodeGX but has built Storyline courses can create an eLearning
  project, open the slide template, and produce a working course **without learning the graph
  first** — and the graph is there when they outgrow the template.
- That course, exported as a SCORM package, **imports and reports completion/score in at least two
  real LMSes** (target: Moodle + one commercial), and emits clean xAPI to any configured LRS.
- The branching-scenario template demonstrates something **Storyline cannot legibly do**, and the
  tutorial for it teaches the pedagogy, not just the tool.
- An org with no LMS can stand up the LMS starter on their own infrastructure: cohorts, roles,
  enrollment, assignment tracking, trainer dashboards, nudge workflows — all editable in NodeGX.
- A regular NodeGX user, meanwhile, **notices nothing changed** (P1, verified, not assumed).
- Every premise this phase stated has been measured, and the false ones are marked in their task
  files — counted by name, not by total (the P66 lesson).

See [TASKS.md](TASKS.md).
