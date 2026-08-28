# Phase 77 — next session

**SBR-001 is closed and driven (s2); the wizard attaches the backend.** Read, in order:

1. [README.md](README.md) — rulings (§1, all taken, do not re-litigate), the token-system
   correction (§3), the task table and build order (§5).
2. [TASKS.md](TASKS.md) — status board, standing gates/traps, session log (s2 has the
   attach-path architecture and the drive evidence).
3. The task you pick.

## Pick

- **SBR-002 (the first run lands somewhere)** is now fully drivable: SBR-001 gives every new
  Site Builder project a running, policy-enforcing backend. 🔴 Open-on-`Pages/Setup` MUST edit
  `useSwitchToDefaultComponent` (`UseSetupNodeGraph.ts:22-27`) itself — a previous layered
  restore was deleted after driving; the default switcher runs unconditionally and wins, and
  its spec passed on source text.
- **SBR-003 (the token contract)** is independent and everything visual depends on it. The
  contract is settled in the file: the shipped 182-token vocabulary, Studio defaults as the
  template's `designTokens` metadata block, `Theme` record overlays the same names.
- **SBR-008 (derive `prop-` ports in the runtime)** is also unblocked and independent.

## What s2 left you

- The attach path: `templateNeedsBackend` (derived — policy OR `/#__cloud__/` components) →
  `TemplateItem.needsBackend` → `ensureTemplateBackend` (`models/templatebackend.ts`) in
  `handleCreateProjectConfirm` → create owned + `setCloudServices` bind → route →
  `ProjectBackendLifecycle` starts with `--project-dir` and deploys the cloud functions.
  🔴 Do not "improve" this by starting the backend in the wizard: the lifecycle would adopt
  it, and the adopted path never deploys functions (`templatebackend.ts` header).
- Drive artefacts on this machine you may reuse: projects **"SBR Drive Site"** (bound, backend
  `backend_mtctpzoolycw4`, port 8589, policy enforced) and **"SBR Hello Control"** (unbound
  control), both in `~/vscode_projects/NodeGX test projects/`.
- ⚠️ The template's cloud functions are **4 top-level** (claimSite, publishPage, duplicatePage,
  submitContactForm); `resolveSlug` in the SBR-001 task file never existed — probe
  `submitContactForm`.
- ⚠️ `typecheck:editor` carries a pre-existing 5-error baseline
  (`@noodl-viewer-cloud/execution-history` unresolved, since WFA-002). Not ours; don't chase it.

## Standing context

- Richard, 2026-08-28: **no short paths** — the template should blow minds. Scope is the full
  six screens of https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; the
  assessment is https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
- 🔴 Never scope by time. Every task's ACs include a person sentence — verify them as written.
- Floor: `test:ci` 2863 specs / 4 failures, all `AIX-006 style vocabulary` by name.
- Shared checkout: pathspec commits only; announce editor launches and teardowns; `test:ci`
  alone; end the session by updating this file, TASKS.md s-log, and memory.
