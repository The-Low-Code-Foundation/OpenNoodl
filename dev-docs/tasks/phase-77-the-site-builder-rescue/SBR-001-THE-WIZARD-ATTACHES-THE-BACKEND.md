# SBR-001 — The wizard attaches the backend

**Fixes finding 1.** Pick the Site Builder template today and you land in a project whose
backend panel reads "No backend attached · 11 others". The template ships `devOpen: false`, so
it can do nothing at all. This is **launcher/wizard work, not template work**, and it blocks
evaluating everything else in the phase — including by us.

## 1. The person sentence

**A person who picks the Site Builder template and finishes the wizard lands on a working claim
screen — the backend exists, runs, and enforces the template's own security policy, with no
detour through Backend Services and no white void.**

## 2. The seams (mapped s1)

The wizard shell:

- `noodl-core-ui/src/preview/launcher/Launcher/components/ProjectCreationWizard/WizardContext.tsx:27`
  (`WizardStep` union), `:76-101` (`getStepSequence`), `:106-131` (`isStepValid`) — template
  mode is `['basics','template','review']`. Both functions are exported so the editor suite can
  grade the real sequence.
- `ProjectCreationWizard.tsx:203-232` (`renderStep()` switch), `:81` — `onConfirm(name,
  location, presetId, mode, templateUrl)`, five positional args, deliberately identical to the
  legacy `CreateProjectModal`. **Widening this signature (or converting to an options object) is
  the one breaking edit.**

Where the decision becomes an action:

- `noodl-editor/src/editor/src/pages/ProjectsPage/ProjectsPage.tsx:1031-1092`
  (`handleCreateProjectConfirm`) — the only place holding both the created `ProjectModel` and
  the still-unrouted moment. Working precedent for "do work between creation and routing" is
  right beside it: `finishScopedProject` (`:963-1029`), awaited before the route.
- The attach recipe to mirror: `models/lessonbackend.ts:52-120` (`ensureLessonBackend` —
  list → `findReusableBackend` → `backend:create` **with `{ projectId }`** →
  `startLocalBackend(invoke, id, projectDir)` → poll `backend:status` → report) and its caller
  `pages/EditorPage/EditorPage.tsx:74-108`, which applies the binding itself with
  `setCloudServices(project, { id, endpoint, appId, type: 'nodegx' })` — the binding must go
  through `setCloudServices` because it raises `cloudServicesChanged`.
- `models/BackendServices/startLocalBackend.ts:46-107` is the **single start door** — a census
  spec (`tests-unit/sb-015/editor-spawner-passes-project-dir.test.ts`) asserts no other renderer
  module invokes `'backend:start'`. Go through it.
- `services/ProjectBackendLifecycle.ts` (installed `router.setup.ts:195`) keeps a **bound**
  backend running on every later open — the wizard only needs create+start+bind once. It never
  starts an unbound backend.
- The security policy applies only when the backend starts **with the project dir**:
  `nodegx-backend/src/security/projectPolicy.ts:88-210`, reached via `--project-dir`
  (`main/src/local-backend/BackendManager.js:743,781,817,838`).
- ⚠️ Cloud functions: the template ships seven `/#__cloud__/…` components. The wizard path must
  reach `CloudFunctionDeployer.onBackendStarted` (as `useLocalBackends.ts:222` does) or let
  `ProjectBackendLifecycle` do it on open — otherwise the functions are absent and the claim
  screen still fails.

Template → wizard visibility (the gap that has no mechanism today):

- 🔴 `utils/forge/template/template.ts:1-9` — `TemplateItem` is five strings; `securityPolicy`,
  `devOpen`, everything else is invisible at pick time. It must widen, and both providers fill it
  (`EmbeddedTemplateProvider.list():47-63`, `PlatformTemplateProvider.templateItemFor():71-80`).
  Read `TemplateStep.tsx:53-60` first — the written argument about optional fields only one
  provider can fill.
- 🧭 **Derive the need, don't declare it.** In-repo prior art argues against a hand-written
  `requiresBackend:` field (`lessonbackend.ts:16-22` — lessons derive from grading conditions).
  Here the derivation is cheap and drift-free: `Boolean(template.securityPolicy)`, or "content
  contains `/#__cloud__/` components" (site-builder has seven, hello-world none).
- 🔴 The community/platform template wire (`communityapi.ts:304-321`) has **no column** for this
  and lives partly in another repo — an optional field left `undefined` for community rows is
  the only thing shippable from here. Do not block on the cross-repo half.
- ⚠️ Port 8577 is `nodegx-backend`'s **default**, not a promise — the real port comes from
  `backend:status`. Never hard-code it.
- ⚠️ `useLocalBackends.createBackend` (`:143-158`) calls `backend:create` **without
  `{ projectId }`** — a backend made from the panel has no ownership key. The wizard path must
  pass it (as `lessonbackend.ts:104` and `provisionBackend.ts:319` do). Whether the panel's
  omission is a defect to file is worth a note, not this task's scope.

## 3. Acceptance criteria

1. **(person)** Creating a project from the Site Builder template lands, without any manual
   backend step, in a project whose backend is created, running, and bound — verified by
   driving the real wizard, not by unit tests alone.
2. The created backend is owned (`projectId` key) so `findReusableBackend` finds it, and the
   binding went through `setCloudServices`.
3. The template's `nodegx.security.json` is enforced by the running backend (probe one ACL:
   anonymous cannot read an unpublished page).
4. The seven cloud functions answer (probe `resolveSlug` or `submitContactForm` over HTTP).
5. A template that does **not** need a backend (hello-world) still creates with no backend and
   no step — the negative control.
6. Templates from the community provider (no flag on the wire) neither crash the wizard nor
   grow a backend they didn't ask for.
7. Re-running creation reuses/does not duplicate backends per the ownership rules.

## 4. Traps

- 🔴 The `onConfirm` five-positional-arg signature is shared with the legacy modal — check both
  callers before widening.
- 🔴 An "attach step" that only *shows UI* but binds nothing will pass a source-text spec —
  verify the consequence (the running backend, the enforced ACL), not the mechanism.
- `setCloudServices` reaches `PopupLayer`/`ToastLayer` — which is why `lessonbackend.ts` splits
  reporting from binding; keep that split so the helper stays plain-Node gradeable.
