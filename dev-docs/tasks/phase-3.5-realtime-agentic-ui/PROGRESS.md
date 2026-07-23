# Phase 3.5: Realtime Agentic UI - Progress Tracker

**Last Updated:** 2026-07-23 (REV-006 documentation truth pass)
**Overall Status:** 🔴 Not Started (verified — the prior "0%" claim in this file was accurate)

---

## Status vocabulary

- **Not started** — no code exists for this task.
- **In progress** — some code exists but the task's deliverables are incomplete.
- **Built–not wired** — the deliverable(s) exist and are tested, but have zero call sites in the application outside of tests.
- **Complete** — deliverable exists, is tested, AND has real call sites in the app (outside tests).
- **Superseded** — the task's goal was later addressed by different work, or the task itself is obsolete.

---

## Summary

Unlike several other phase folders audited under REV-006 (phase-6, phase-9, phase-10, phase-11), **this phase's old PROGRESS.md was not stale — it was correct.** All seven AGENT-00X tasks are genuinely **Not started**: no SSE node, WebSocket node, global state store, optimistic-update helpers, action dispatcher, state-history/undo system, or stream-parser utilities exist anywhere in `packages/noodl-runtime`, `packages/noodl-viewer-react`, or `packages/noodl-viewer-cloud`, in any test file, or in git history on any branch (`cline-dev`, `main`, `cline-dev-richard`, `cline-dev-dishant`, `cline-dev-tara`, `feature/byob-backend`, or any remote task branch). There are no `AGENT-00*` commits anywhere in `git log --all`, and no per-developer `PROGRESS-*.md` file exists in this folder to merge in. The two things that could plausibly be mistaken for this work are both false leads, documented below.

Two near-misses worth flagging so a future contributor doesn't misread them as partial progress:
- `packages/noodl-editor/src/editor/src/models/AiAssistant/context/ai-api.ts` uses `@microsoft/fetch-event-source` (an SSE client library also present in `noodl-editor/package.json`), but this is the **editor's own built-in AI Assistant chat panel** (pre-existing, first commit `b9c60b0`), not a runtime node usable inside built Noodl apps. It does not touch `packages/noodl-runtime` and has no bearing on AGENT-001.
- The `ws` package is a dependency of `noodl-editor` and is used by the pre-existing editor↔viewer live-reload connection (`ViewerConnection.ts`, `LocalBackendServer.js`, etc.), not by an AGENT-002 WebSocket runtime node. No such node exists.

No AGENT-00X task has a closing/superseding task elsewhere in the revival roadmap (phases 12+) as far as this audit found — if Phase 3.5 work resumes, it starts from zero.

---

## Task Status

| ID | Title | Status | Evidence (commit hash / file path) | Notes |
|---|---|---|---|---|
| AGENT-001 | SSE Node | Not started | No file matching `sse`/`EventSource` in `packages/noodl-runtime/src/nodes/**`. `git log --all --grep="AGENT-001"` → no results. `git log --all --grep="sse node"` (case-insensitive) → no results. Only hit for SSE-adjacent code is the unrelated editor AI Assistant (`packages/noodl-editor/src/editor/src/models/AiAssistant/context/ai-api.ts`, first commit `b9c60b0`), which is not a runtime node. | Nothing to wire; task has not been started. |
| AGENT-002 | WebSocket Node | Not started | No file matching a WebSocket runtime node in `packages/noodl-runtime/src/nodes/**` or `packages/noodl-viewer-react`. All `WebSocket` hits in the repo are pre-existing editor↔viewer live-reload / dev-server infrastructure (`ViewerConnection.ts`, `LocalBackendServer.js`, `noodl-runtime.js` editor connection, webpack-dev-server), unrelated to this task. `git log --all --grep="AGENT-002"` and `--grep="websocket node"` → no results. | Nothing to wire. |
| AGENT-003 | Global State Store | Not started | No `GlobalStore`/`global-state-store` symbol or file anywhere in `packages/` (grep across all packages, all branches, empty). `git log --all --grep="AGENT-003"` → no results. | Nothing to wire. |
| AGENT-004 | Optimistic Updates | Not started | No `OptimisticUpdate`/`optimistic-update` symbol or file in the repo on any branch. `git log --all --grep="AGENT-004"` → no results. | Nothing to wire. |
| AGENT-005 | Action Dispatcher | Not started | No `ActionDispatcher`/`action-dispatcher` symbol or file in the repo on any branch. `git log --all --grep="AGENT-005"` → no results. | Nothing to wire. |
| AGENT-006 | State History (undo/redo, time travel) | Not started | No `StateHistory`/`state-history` symbol or file in the repo on any branch. `git log --all --grep="AGENT-006"` → no results. | Nothing to wire. |
| AGENT-007 | Stream Parser Utilities | Not started | No `StreamParser`/`stream-parser` node or utility in `packages/noodl-runtime` or `packages/noodl-viewer-react`. The only string match for "StreamParser" in the repo is inside a bundled CodeMirror reference (`packages/noodl-editor/src/editor/index.bundle.js:308823`, a link to CodeMirror's `language.StreamParser` API docs) — coincidental, unrelated to this task. `git log --all --grep="AGENT-007"` → no results. | Nothing to wire. |

---

## Evidence method (for reproducibility)

- Grepped `packages/**` (excluding `node_modules`) for: `EventSource`/`server-sent`, `WebSocket`, `GlobalStore`/`global-state-store`, `ActionDispatcher`/`action-dispatcher`, `StateHistory`/`state-history`/`OptimisticUpdate`/`optimistic-update`, `StreamParser`/`stream-parser`.
- Ran `git log --all --oneline --grep="AGENT-00X"` (case-insensitive) for each of the seven task IDs, and broader phrase greps (`"sse node"`, `"websocket node"`, `"global state store"`, etc.) across all branches — all empty.
- Checked file trees (`git ls-tree -r --name-only`) of `origin/cline-dev-dishant`, `origin/cline-dev-richard`, `origin/cline-dev-tara`, and `origin/feature/byob-backend` for filenames matching these features — none found (the naive substring `sse` false-matched `assets/` paths; re-run with anchored patterns `sse-node|sse\.js|sse\.ts` etc. to avoid that trap).
- Confirmed no `PROGRESS-*.md` per-developer file exists in this folder to cross-check against.

---

## Dependencies

Depends on: Phase 3 (Editor UX), Phase 2 (Runtime nodes) — per the original task docs. Not currently blocking any in-flight revival-phase (12+) work as far as this audit found.

---

## Notes

This phase's task specs (AGENT-001…007) were written 2025-12-31 to support the Erleah agentic-UI capability analysis (`noodl-erleah-capability-analysis.md`, same folder). They describe real, well-specified gaps (no SSE/WebSocket runtime nodes, no global store, no action-dispatch pattern) — the specs themselves remain a legitimate backlog, they were just never picked up. This audit only corrects status tracking per REV-006; it does not re-scope or prioritize the work.
