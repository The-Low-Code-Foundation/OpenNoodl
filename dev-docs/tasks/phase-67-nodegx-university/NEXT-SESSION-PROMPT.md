# Phase 67 — next session prompt

Paste the block below into a fresh session.

---

Continue phase 67 (NodeGX University), `dev-docs/tasks/phase-67-nodegx-university/`.

**Read first, in this order:** `PRIOR-ART-RECONCILIATION.md` (the 2026-08-14 archaeology — five
phase-67 premises were wrong against phases 17/20/51), then `README.md`, then `TASKS.md`.

**Already ruled 2026-08-14 — do not re-litigate:**
- **D1** — new repo, Next.js + Postgres + Drizzle, Docker on Hetzner. Created and empty:
  `The-Low-Code-Foundation/nodegx-university` (private).
- **D10** — org-owned pseudonymous accounts for minors. Reverses LEARN-005's "no accounts by
  default"; LEARN-005 has been amended in place. Four obligations are listed in UNI-005.
- **R6** — UNI-005/006 build on **phase 51** (async git-merge); **COL-004** (advisory component
  claiming, 3 days) ships first. **ECO-001 real-time stays parked.**
- **UNI-010** — the model *may* author `completeWhen` (overriding
  `EXPERIMENT-GENERATED-LESSONS.md` §3.1); in exchange the verifier must cover the full **F1–F6**
  taxonomy, not F2 alone.
- **D12 is struck** — LEARN-002's D1–D9 were answered 2026-08-09.

**This session's job — the rest of the rulings, then the first build.**

1. **Clear the remaining rulings** (they are the cheapest thing in the phase and most tasks are
   blocked on them). In priority order:
   - **D2 — naming + domain.** "NodeGX University" vs "NodeGX Community", the subdomain, and what
     the editor's sign-in button says. ⚠️ It also decides whether the new repo keeps its name —
     rename *before* attaching GitHub Pages, which does not follow a repo rename.
   - **D5 — the Learning folder shape.** Blocks **both** UNI-007 and UNI-010. README recommends the
     visible launcher section with "immutable" = platform-managed.
   - **D3** (points economy — recommend earn-only at launch) and **D4** (badge taxonomy v1) unblock
     the Tier-1 focus pair UNI-002 → UNI-003.
   - Then D6, D7, D8, D9, D11 as time allows.

2. **Confirm the three real curriculum blockers** before UNI-007 claims a spine
   (`CURRICULUM-DESIGN.md` §11): the two-vocabulary rule, **phase 60's "signal" wording**, and
   **phase 61 landing before L11 is authored**. Check the actual status of phases 59/60/61 — the
   memory index says P59 is 8/8 built but zero driven, P61 is 8/9. This is a fact-check, not a
   design question.

3. **Then the first code.** Two independently buildable candidates, both editor-side:
   - **UNI-007's grading runner** — ⚠️ two engines, not one: per-step completion via the existing
     tested evaluator (`views/lessons/lessonevalconditions.ts`, 11 closed verbs, 33 tests, no MCP
     and no model call), whole-solution validity + "did it actually render" via MCP
     `validate_project` / `render_report`. 🔴 Assert drawn output — clean can mean EMPTY.
   - **COL-004 advisory component claiming** (3 days, phase 51's own "ship this first").

**Standing constraints:**
- Editor work on `cline-dev`. 🔴 **Never `git stash`**; `cd` to the repo root in every git call;
  explicit pathspecs (a sibling session's staged files get swept otherwise).
- 🔴 **Check for a sibling session before any suite or editor run.** Phase 66 was running
  `test:ci` throughout the 2026-08-14 session. `ps aux | grep -e electron -e run-electron-tests`.
- Gates for editor-side changes: `test:main` + `test:ci` (compare names; read
  `tests/test-results.json`, not the log), `npx tsc -p tsconfig.json --noEmit` (**never** without
  `--noEmit`), `cloud-library:check`; MCP suite after any catalog change.
- The launcher's recent-projects store is **read-only to sidecars** — the editor process writes
  Learning-folder state, never the platform or an MCP sidecar.

At the end of the session, write the next `NEXT-SESSION-PROMPT.md` and update memory.

---

## Where this session left things (2026-08-14)

**Done:** the archaeology TASKS.md required; four rulings; `PRIOR-ART-RECONCILIATION.md`;
README/TASKS/UNI-005/006/007/010 corrected; LEARN-005 and EXPERIMENT-GENERATED-LESSONS amended so
they no longer contradict phase 67; the platform repo created.

**Not done:** no code, by design — the phase's own plan is "first sitting: rulings, not code", and
a sibling `test:ci` run was live all session. The repo is empty; nothing has been scaffolded in it.

**The one thing worth carrying forward as a habit:** four of the five findings were cases of the
repo having already voted. Before scoping or building a UNI task, grep `dev-docs/tasks/` for its
subject. Phases 17, 20 and 51 are this phase's direct ancestors.
