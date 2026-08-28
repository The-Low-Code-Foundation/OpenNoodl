# Phase 77 — next session

**The phase is scoped; the build starts.** Read, in order:

1. [README.md](README.md) — rulings (§1, all taken, do not re-litigate), the corrections the
   scoping sweep made to the artifacts (§3 — the platform already ships the token system), the
   task table and build order (§5).
2. [TASKS.md](TASKS.md) — standing gates/traps carried from phase 76, session log s1.
3. The task you pick.

## Pick

- **SBR-001 (the wizard attaches the backend)** is the default start: it blocks driving
  everything else, and its seam map is already in the task file (insertion points, the
  `ensureLessonBackend` recipe, the `TemplateItem` five-string bottleneck, the traps).
- **SBR-003 (the token contract)** is the other opener — independent of SBR-001, everything
  visual depends on it, and the contract is already settled in the file; the work is
  implementing the Studio `designTokens` block and the verification probes.
- SBR-008 (derive prop- ports in the runtime) is also unblocked and independent.

## Standing context

- Richard, 2026-08-28: **no short paths** — the template should blow minds. Scope is the full
  six screens of https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; the
  assessment is https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
- 🔴 Never scope by time. Every task's ACs include a person sentence — they are written in the
  files; verify them as written.
- Floor: `test:ci` 2863 specs / 4 failures, all `AIX-006 style vocabulary` by name.
- Shared checkout: pathspec commits only; announce editor launches and teardowns; `test:ci`
  alone; end the session by updating this file, TASKS.md s-log, and memory.
