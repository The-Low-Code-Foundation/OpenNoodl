# Phase 27 — next session prompt

**Written 2026-08-02** at the end of the closing batch. Paste the block below as the session's
opening prompt. Everything in it was true at commit `b7a41e71`; verify rather than assume, because
this repo's specs go stale fast and this file will too.

---

## The prompt

> Finish phase 27's live QA. All nine tasks are built and merged on `cline-dev`; the code is done and
> parts of it have never been run. Read
> `dev-docs/tasks/phase-27-visual-backend-authoring/PROGRESS.md` (status line first, then the two
> "Found by the 2026-08-02 …" sections) and `OPEN-WORK.md` before touching anything.
>
> **Do these, in this order:**
>
> 1. **Build the backend before you start.** `npm run build` in `packages/nodegx-backend`. The editor
>    spawns `dist/index.js` and *nothing rebuilds it on launch* (F66) — a change you just made will
>    look unwritten. This cost the last session twenty minutes of diagnosing a route that was there.
> 2. **WFA-007 steps 5–9**, from the script in `WFA-007-NOTES.md` → "Could not verify". Steps 1–4 pass
>    already (proposal lists, diff renders as step cards, Accept all persists). What is left is the
>    **partial accept and its closure** — reject the change that adds the first of two wired steps and
>    confirm the dependent rows grey out rather than producing a stranded step — the **fix-request
>    copy** button, and the **unregressed-AIX-003** check.
> 3. **WFA-007's six Jasmine specs have never executed.** `npm run test:ci` in `packages/noodl-editor`
>    (Electron; do not run it while anyone else wants the editor). They typecheck; that is all anyone
>    knows.
> 4. **WFA-009 steps 5–8** from `WFA-009-NOTES.md`: author a cloud function from the template, wire
>    two parameters, **deploy**, `POST /functions/<name>`, and read the body. Then a workflow step
>    reading `previous.result.total` from that function — `$path` was built for exactly this in
>    WFA-003 and has still never been shown end to end. Steps 1–4 pass (ports appear, mirror,
>    disappear, and a removed name flags its connection).
> 5. **F68** if you have appetite: a proposal that omits a server-defaulted field reads as changing it
>    (`concurrency: 1 → (unset)`). Decide whether the change set ignores unmentioned fields or
>    `normalize` fills them before diffing.
>
> **Do not** re-open F26, F27, F36, F37, F55, F57, F63, F64 or F67 — all closed on 2026-08-02, several
> of them by correcting the register's own text. If one looks wrong, that is a finding; say so rather
> than quietly redoing it.

---

## State at handover

- Branch `cline-dev`, tip `b7a41e71`. Nothing unpushed matters — this repo does not push.
- Phase 27: **9/9 built.** WFA-007 and WFA-009 are ✅ on code, 🟡 on live QA.
- Green: root `typecheck`, `typecheck:editor-tests`, `lint:ci`, `icons:css`, all four catalog/library
  gates, `tsfixme` (re-pinned), editor jest 283/283, core-ui 123/123, viewer-cloud 106/106.
- Red and **pre-existing**, attributed by running them at the merge base — do not spend the session on
  them unless that is the session's point: `typecheck:backend-tests` (10 errors in
  `realtime-filter.test.ts` and `workflow-canvas-contract.test.ts`), `colors` (+15,
  `ProvenancePanel.module.scss`), `nodegx-backend`'s `email-flows.test.ts` (2 timeouts), `noodl-mcp`'s
  `tools.test.ts` (1). The last two sit in `test:packages`, a required CI job (F65).

## Traps this session paid for

- **`npm run dev:stop` kills by checkout, not by session.** It killed 28 processes including another
  session's `test.js` Electron. If anyone else is working, do not run it.
- **HMR does not rebind an imported function into a mounted panel.** A verified-correct fix appeared to
  fail twice; a clean restart proved it worked. Restart before concluding a fix is wrong.
- **The editor spawns a stale backend bundle** (F66, above).
- **`--target=editor` is correct**; `--target=dashboard` is actively harmful. Never `cdp reload`.
- **Launch detached with the sandbox disabled**, and do each verification in one script.
- **A probe that matches nothing looks exactly like a probe that passes.** A watcher of mine used
  `pgrep -f "Electron Helper (Renderer)"` — the parens are a regex group, so it matched nothing and
  reported "quiet" while the editor was plainly running. Make an instrument prove it can see something
  before believing what it says. Same shape as F63 (a CI job nothing reaches) and F64 (a generated file
  no gate re-derived after merge).
- **Trial-merge in a throwaway worktree.** The merge created a defect neither branch could see: the
  node catalog went stale, and fixing that made the *enriched* catalog stale. After any merge,
  regenerate every artefact and require an empty diff.
