# SBR-002 — The first run lands somewhere

**Fixes findings 1 (tail) and 2.** Two halves: the editor opens the project on `Pages/Setup`
instead of the blank `App` shell, and the app itself says on screen when it has no backend or
no claim — never a white void.

## 1. The person sentences

**Someone whose project just opened sees the setup screen, not an empty canvas.**
**Someone who runs the site with no backend reads a sentence telling them so and what to do.**

## 2. Editor half — open on `Pages/Setup`

- 🔴 **The decider is `useSwitchToDefaultComponent`
  (`views/documents/EditorDocument/hooks/UseSetupNodeGraph.ts:22-27`) and it must itself
  change.** It calls `getDefaultComponent()` (`models/projectmodel.utils.ts:5-20`: `/Main`,
  `/Start`, `/Lesson`, root, first browser component) unconditionally on mount and **wins over
  anything layered before it**. A previous "restore my place" attempt did exactly that layering
  and was deleted after driving (`utils/launcher/launcherHandoff.ts:17-35` records it):
  instrumentation showed two `switchToComponent` calls per open, restore first, default second,
  default won — and its spec passed by asserting source text, green on dead code. **Any
  approach that does not modify the hook reproduces that defect; any spec that greps source
  text repeats the false pass.**
- The channel: there is **no** "initially open component" field anywhere today
  (`ProjectTemplate.ts:82-105`). Add an optional field to `ProjectTemplate`/`ProjectContent`,
  written into project metadata at install (`EmbeddedTemplateProvider.install:87-133`), read by
  `getDefaultComponent`. 🔴 `rootComponent` is NOT usable — it is the runtime home/export root
  (resolved to `rootNodeId` at `EmbeddedTemplateProvider.ts:203-210`); repointing it changes
  what the app runs.
- `/Pages/Setup` already exists in the template — no new graph needed for this half.
- Interaction to preserve: `EditorDocument.tsx:425-450` persists/restores
  `selectedComponentName` per project. A returning user's saved place should still win over the
  template's first-open hint; the hint is for the entry that doesn't exist yet.

## 3. Template half — the states that answer

- F27 covers "backend answered: no rows". **Nothing covers "nothing answered".** With no
  backend, `resolveSlug` returns early and the not-found panel sits in the DOM hidden
  (`visibleText: 0`).
- 🔴 A refused query publishes `[]` exactly like an empty one — the graph cannot read absence
  off the data port. The state needs its own signal: the query/function chain's failure output
  (or a timeout watchdog) driving a visible "No backend connected. This project needs a backend
  before it can store pages — add one from Backend Services." panel, per the states screen in
  the screens artifact.
- The unclaimed state ("This site hasn't been set up yet — visit /setup to claim it") exists
  and keeps its deliberate one-constant-refusal design; it just gets styled under SBR-004's
  tokens.
- 🔴 Assert the absence beside a known-firing signal: the spec for "no-backend shows the panel"
  needs its twin where a backend answers and the panel is **hidden** — and a control where the
  *not-found* panel fires instead, so the two states can't be satisfied by one always-on div.

## 4. Acceptance criteria

1. **(person)** Wizard-created site-builder project opens with `Pages/Setup` on the canvas —
   driven, not source-grepped.
2. A template with no such hint opens exactly as today (negative control on the hook change).
3. A returning user's persisted `selectedComponentName` still wins on later opens.
4. **(person)** Viewer with no backend shows the no-backend sentence (visibleText > 0 and the
   panel reachable per `elementFromPoint`, not merely in the DOM); with a backend and no claim,
   the unclaimed sentence; with a claim and no rows, F27's empty state. Three states, three
   distinct on-screen answers, each with its negative control.

## 5. Traps

- 🔴 RENDERED ≠ REACHABLE — the hidden not-found panel was *in the DOM* the whole time.
  Measure visibility, not presence.
- The template edit ⇒ regenerate the artefact (two populations; id count 194 moves).
