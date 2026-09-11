# REL-013 — The Templates tab

**Opened** 2026-09-04 from Richard's testing pass · Effort: **S**

> *"The 'Templates' tab still says 'Project templates will be displayed here' but we have one
> template, the members area, that should be here, no?"*
>
> *"The create modal should use the template list from the 'templates' tab, so two birds one
> stone."* — Richard, 2026-09-04

## The finding

`packages/noodl-core-ui/src/preview/launcher/Launcher/views/Templates.tsx` renders a `LauncherPage`
wrapping one hardcoded string — *"Project templates will be displayed here. This feature is coming
soon!"* — and **imports nothing from any registry.** It is unwired, not broken.

✅ **The plumbing it needs already exists and already has a caller.** `templateRegistry`
(`utils/forge/index.ts`) is consumed by `useProjectTemplates`, which feeds the create wizard's
picker. So the "two birds" Richard asked for is **half done**: the modal already reads the shared
registry. What is missing is the tab reading the same one.

## 🔴 The layering constraint that decides the shape

`Templates.tsx` lives in **`noodl-core-ui`**, which cannot import `noodl-editor`'s
`useProjectTemplates` — the wizard's own gallery arrives as **props**
(`TemplateGalleryState`, defined in core-ui and imported *by* the editor hook, not the reverse).

So the tab's rows must arrive the same way, from `ProjectsPage.tsx` where the Launcher is composed.

## ⚠️ And the fetch must not move to cold start

`useProjectTemplates(enabled)` is deliberately gated:

> *"The launcher must not make a community request on startup. The picker is reachable only from
> inside the create wizard, and a hook that fetched on mount would put a network read on every cold
> start of the launcher for a screen most sessions never open."*

`ProjectsPage` passes `isCreateModalVisible` as that gate. The Templates **tab** is a second reason
to be enabled, and `ProjectsPage` does not currently know which tab is active — `usePersistentTab`
lives inside `Launcher`. **That is the real work in this row.**

## Acceptance criteria

- **AC1** — the Templates tab renders the rows from `templateRegistry`, through the **same**
  `useProjectTemplates` state the create wizard uses. One source, two surfaces.
- **AC2** — the fetch happens when the tab is opened or the wizard is opened, and **not** on launcher
  mount. Proven by a control: a cold start with neither open makes no community request.
- **AC3** — the tab renders the three states the hook actually produces: loading, rows, and
  `partial` (*"Some templates could not be loaded…"*), plus a **true empty state**.
- **AC4** — 🔴 **the empty state is honest and is the shipped state.** As of 0.2.2 the embedded shelf
  is deliberately empty (`HELD_TEMPLATE_IDS` — see [the testing-pass register](TESTING-PASS-2026-09-04.md)
  §1.2), so until REL-001 publishes, this tab shows **no rows**. It must read as *"nothing published
  yet"* and never as a broken panel or a spinner that never resolves.
- **AC5** — picking a template from the tab creates a project by the same path the wizard uses. No
  second creation route.

## ⚠️ Traps

1. 🔴 **`Projects.tsx` already links here** — `setActivePageId('templates')` — so this tab is
   reachable today and lands on the placeholder. Whatever ships must be better than the sentence it
   replaces, including when the list is empty.
2. **Do not duplicate the gallery state.** Two `useProjectTemplates` instances would double every
   community request and could show two different lists on two surfaces.
3. **`needsBackend` rides the row** and the wizard branches on it. A create path from this tab that
   drops it would create a backend-less project from a template that needs one — the SBR-001 defect,
   re-entered by a new door.
4. ⚠️ **No thumbnail column exists** on the platform (`PlatformTemplateProvider` ships `iconURL: ''`
   deliberately). Design the row for a title, a category and a description — not for an image that
   is never coming.

## Owner and relations

- **FB-005** (phase 75) owns the shelf's *existence* and closes on **REL-001**. This row owns the
  **launcher surface** that draws it, which FB-005 never covered — its T3 built the wizard picker.

---

## Findings — session of 2026-09-04 (built, not yet gated)

### What was built

| File | What changed |
| --- | --- |
| `packages/noodl-core-ui/.../Launcher/views/Templates.tsx` | Rewritten. `TemplatesTabBody` (**pure, hook-free**) draws loading / rows / `partial` / true-empty / unreadable / filtered-to-zero; `Templates` is the two-line context reader around it. |
| `packages/noodl-core-ui/.../Launcher/views/Templates.module.scss` | New. Card, pill and — the part AC4 turns on — the empty **panel**. |
| `packages/noodl-core-ui/.../Launcher/LauncherContext.tsx` | `templates?: TemplateGalleryState`, `onUseTemplate?: (url) => void`. |
| `packages/noodl-core-ui/.../Launcher/Launcher.tsx` | Same two props, plus **`onActivePageChange`** — the report that lets the host know which tab is open. |
| `packages/noodl-core-ui/.../ProjectCreationWizard/ProjectCreationWizard.tsx` | New optional `initialTemplateUrl`. |
| `packages/noodl-core-ui/.../ProjectCreationWizard/WizardContext.tsx` | New exported pure `seedWizardState` (lives here, not in the wizard, so it is reachable by the plain-Node runner). |
| `packages/noodl-editor/.../hooks/useProjectTemplates.ts` | New exported pure **`shouldFetchTemplates`** + `TEMPLATES_PAGE_ID`; the `enabled` note updated to say there are two surfaces now. |
| `packages/noodl-editor/.../ProjectsPage/ProjectsPage.tsx` | `activeLauncherPage` state, the one `useProjectTemplates(shouldFetchTemplates(…))` call, `handleUseTemplate`, `wizardTemplateUrl`, and the four new props. |
| `packages/noodl-editor/tests-unit/rel-013/templates-tab.test.tsx` | New. 33 assertions across the five ACs and traps 1–4. |

### 🔴 The shape the row asked for, and the one thing it costs

`usePersistentTab` stays inside `Launcher`. The host does not reach into it; the launcher **reports**
outward through `onActivePageChange`, fired on mount as well as on change, and `ProjectsPage` seeds
its own copy from the same `initialTab` it passed — so the first render already agrees rather than
being corrected a frame later. `LauncherLandingPage` is `'projects' | 'community' | 'learning'` and
never `'templates'`, which is what makes **every cold start close the gate by construction** rather
than by timing.

⚠️ **One behaviour changed and it is worth knowing before somebody rediscovers it.** `enabled` is now
an OR, so with the Templates tab already open, opening the create wizard no longer re-reads the
shelf — `enabled` was already `true`, the effect does not re-run. That is right (the picker inherits
a listing the tab has just read) and it is a change from FB-005's *"re-opening the wizard re-reads
the shelf"*. Recorded in the hook's own header.

### 🔴 AC4 — and the distinction the row did not ask for but AC4 needs

Zero rows is **two different facts** and they get opposite screens:

- **zero rows, no `partial`** → *"No templates published yet"* + *"Nothing has gone wrong…"* + a
  **New project** button. A bordered panel, not a grey line — the sentence it replaces was a muted
  13px line on an otherwise blank page, which is exactly what a page that failed to render looks
  like.
- **zero rows, `partial` present** → *"Templates could not be loaded"* + the host's own sentence
  naming the source + **Try again**. Claiming an empty shelf here would be an absence asserted with
  no firing signal beside it.

⚠️ **Which of the two ships depends on whether the platform answers.** `PlatformTemplateProvider.list`
**throws** rather than returning `[]` (deliberate — see `utils/forge/index.ts`), so with every
embedded row held: platform reachable and empty → *"nothing published yet"*; platform unreachable,
refused, or offline → *"could not be loaded"*. Both are honest and neither is a spinner, but the
second is what an offline first-launch sees, and it is not the sentence AC4 quotes.

### Traps

- **Trap 1** — the placeholder is gone from the file, asserted with comments stripped so the module
  note quoting it cannot satisfy the check.
- **Trap 2** — exactly **one** `useProjectTemplates(` in the application, asserted as a count, plus
  an absence over the three core-ui files that could have grown a second one.
- **Trap 3** — the tab creates nothing. Asserted as an absence of `newProject`, `templateRegistry`,
  `createProjectFromTemplate`, `needsBackend` and `fetch(` in `Templates.tsx`, and as `seedWizardState`
  setting `mode: 'template'` — the exact condition `handleCreateProjectConfirm`'s `templateNeedsBackend`
  lookup branches on. There is no second creation route to forget it in.
- **Trap 4** — no `img` element on any row, asserted over the rendered tree.

### 🔴 What a green run does NOT prove

`useProjectTemplates`' `if (!enabled) return` cannot be executed here: there is no React renderer in
this repo and `@testing-library/react` is not installed. AC2 is graded as the **pure gate** returning
`false` for the cold-start combination plus a **call-site cardinality** check that `ProjectsPage`
passes exactly that gate. The last link — no request actually leaving on a cold start — is closed by
a drive with the network watched, and by nothing in this file.

### Separate defect found, not fixed

**`components/CreateProjectModal/CreateProjectModal.tsx` has zero callers.** `ProjectCreationWizard`
replaced it and nothing imports it any more (147 lines, plus its own `DEFAULT_PRESET_ID` constant
sitting beside `WizardContext`'s — two copies of a default that can drift). Not blocking any AC here.
