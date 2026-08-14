# Phase 67 — next session prompt

Paste the block below into a fresh session.

---

Continue phase 67 (NodeGX Community), `dev-docs/tasks/phase-67-nodegx-university/`.

**Read first, in this order:** `RULINGS.md` (all eleven rulings + the curriculum fact-check), then
`PRIOR-ART-RECONCILIATION.md`, then `README.md`, then `TASKS.md`.

**🔴 The rulings queue is EMPTY. Nothing is blocked on a decision. Do not re-litigate any of
D1–D11** — if one is wrong, amend `RULINGS.md` with a date and a reason rather than leaving two
documents in disagreement. The four you most need in your head:

- **D2** — the platform is **NodeGX Community**; **NodeGX University is its learning wing**. Domain
  `community.nodegx.dev` (⚠️ *not registered yet* — a choice, not a fact). Editor button: **"Sign in
  to NodeGX"**. Repo already renamed to `The-Low-Code-Foundation/nodegx-community`.
- **D5** — the Learning folder is a **visible launcher section, platform-managed**: edit freely,
  can't rename/detach/delete, reset = re-pull. 🔴 **The editor process writes it — never the
  platform, never an MCP sidecar.** This is what lets UNI-010 run with no account at all.
- **D4** — a challenge awards into a **(family, tier)**, never a `badgeId`. Four families × three
  tiers. This is a schema constraint, not decoration.
- **D9** — 🔴 **ruled against the recommendation**: hosting includes a record-capped backend, so
  UNI-008 now holds end-user data. Five obligations in `RULINGS.md`; effort raised; still last.

**This session's job — the first code.** Both candidates are editor-side and independently
buildable. Last session Richard chose to bank the rulings rather than start either, so **pick one
and build it**:

1. **UNI-007's grading runner** *(recommended — highest leverage; UNI-006 consumes it and UNI-010
   shares its verifier, and D5 just unblocked it)*. ⚠️ **Two engines, not one:**
   - **per-step completion** → the existing tested evaluator,
     `views/lessons/lessonevalconditions.ts` — 11 closed verbs, 33 tests, **no MCP and no model
     call**. Criterion 3's "no model call needed to grade" is already true today; building a second
     per-step grader on MCP primitives forks the contract UNI-007 exists to keep single.
   - **whole-solution validity + "did it actually render"** → MCP `validate_project` /
     `render_report`. 🔴 **Assert drawn output — "clean" can mean EMPTY.**
2. **COL-004 advisory component claiming** (phase 51's own "ship this first, alone", 3 days) —
   unblocks UNI-005's shared shelf, but nothing in phase 67 consumes it yet.

**The one blocker that survived the fact-check**, and it belongs to whichever task writes the format
contract: 🔴 **the two-vocabulary rule, sharpened.** Two of the nine display names are **ambiguous**,
not merely divergent — `Array` → `Collection`/`Collection2`, and **`Object` → `Model`/`Model2`**.
The static check must **reject** those two rather than substitute, because an ambiguous name can
resolve to the *wrong* node rather than to none (class **F3**, not just F1). Blockers 2 and 3 are
**clear** — phase 60 is 7/7 closed and phase 61 is 8/9 built with its notation signed. ⚠️ FUN-005's
ports rail does **not** exist, so no L11 step may reference it.

**Standing constraints:**
- Editor work on `cline-dev`. 🔴 **Never `git stash`**; `cd` to the repo root in every git call;
  explicit pathspecs (a sibling session's staged files get swept otherwise).
- 🔴 **Check for a sibling session before any suite or editor run:**
  `ps aux | grep -e electron -e run-electron-tests`.
- Gates for editor-side changes: `test:main` + `test:ci` (compare **names**; read
  `tests/test-results.json`, not the log), `npx tsc -p tsconfig.json --noEmit` (**never** without
  `--noEmit`), `cloud-library:check`; MCP suite after any catalog change.
- A new editor spec that is not exported from `tests/.../index.ts` **never runs**.

At the end of the session, write the next `NEXT-SESSION-PROMPT.md` and update memory.

---

## Where this session left things (2026-08-14, second session)

**Done — the rulings queue is closed.** D2–D9 and D11 ruled, each written up with its consequences
in the new **`RULINGS.md`**, which is now the authoritative register (README's queue points at it).
Every UNI task file carries its rulings in the header. The platform repo was renamed
`nodegx-university` → **`nodegx-community`** while it was still empty with no Pages site — verified
either side, which was the only free window.

**Done — the three curriculum blockers were fact-checked** against source and git rather than task
tables, and **two of the three cleared**:

| Blocker | Verdict |
|---|---|
| Two-vocabulary rule | 🔴 **Stands, and is worse than recorded** — `Object` maps to **two** type names, not one |
| Phase 60's signal wording | ✅ **Clear** — phase 60 closed 7/7 on 08-11; wording ships in `portCopy.ts` |
| Phase 61 before L11 | ✅ **Clear** — 8/9 built on `cline-dev`, FUN-001 §2 signed 08-12 |

**Not done: no code**, by Richard's explicit choice when offered the two candidates. That is the
whole of the next session.

**Three corrections were made to other phases' documents**, because in each case the *table* was the
stale artifact:

- `CURRICULUM-DESIGN.md` — the glossary's Signal line still carried the paraphrase phase 60
  disproved, under a warning saying "do not author until phase 60 publishes" written three days
  *after* it published. Corrected to cite the shipped sentence; §11's blocker list updated.
- `phase-61/TASKS.md` — four merged tasks (FUN-004/006/008/009) were marked `📋 open`, and FUN-001
  §2 was marked unsigned when it was signed 2026-08-12. Corrected against git.
- `PRIOR-ART-RECONCILIATION.md` — F5's mapping table recorded `Object → Model2`; it is `Model`
  *and* `Model2`.

**Two owed items phase 67 still does not carry**, both from CURRICULUM-DESIGN §11 and both landing
on UNI-007: **curriculum hosting** (§9.3, now partly a D2/D9 question) and the **tutor
lesson-context overlay** (§9.1, *"required before L2 testing"*).

**The habit worth keeping.** Last session's lesson was *the repo has already voted — grep
`dev-docs/tasks/` before scoping*. This session's is its twin: **a register outlives its fix.** All
three blockers were recorded against a status column, and all three columns were wrong — one
optimistic, two pessimistic. **Grep git and read source before believing a status column, including
the ones written this session.**
