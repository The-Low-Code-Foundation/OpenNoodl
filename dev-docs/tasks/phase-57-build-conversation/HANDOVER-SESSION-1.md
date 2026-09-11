# Phase 57 — handover after session 1 (2026-08-09)

**What ran:** not a build. **Two finished branches were merged and gated** — `bld-007` and
`bld-012`, both committed 2026-08-08 into scratchpad worktrees beside a live phase-56 session, and
both invisible to `git log cline-dev` ever since. Phase 57 is now **2 of 16 built and merged**.

**The one thing worth carrying:** running BLD-007's Jasmine half for the first time **found a
regression BLD-007 itself shipped**, in code that `tsc` and 21/21 unit specs had both signed off.
The suite went `2574 / 6` → **`2581 / 8`** on the merge, and is **`2582 / 6`** now. Details in
[BLD-007](BLD-007-DOCS-ARE-OPEN.md) register **B7**.

⚠️ **A second session went live part-way through this one.** The checkout was clean at the start —
`git log --since="8 hours ago"` held only phase-56 session 7's commits and `git status` was empty —
and it stayed that way through both merges. Then
`dev-docs/tasks/phase-46-verification/VER-009-A-SCENARIO-GROWS-AN-EXPECTATION.md` appeared
**untracked at 11:55**, one minute before this session's last commit. It is phase 46 (VER-009,
depends on BEN-005) and has nothing to do with phase 57.

**It was not swept, and the reason is the rule:** every commit here used
`git commit -- <explicit path>`, so a file outside `dev-docs/tasks/phase-57-build-conversation/` and
`packages/noodl-editor/**` could not be picked up. **Leave it alone** — it is someone else's
in-flight work. This is the standing hazard on this checkout, and "clean at the start" is not a
finding that stays true; **re-check `git status` immediately before every commit**, not once at the
beginning.

## What is on the branch

| Commit | What |
|---|---|
| `merge bld-007` | BLD-007 — docs are open; front-matter `inject`, `KNOWN_DOCS` stops being the vocabulary |
| `670cca12` | **fix** — the dispatcher had two sources of truth, and the default won |
| `merge bld-012` | BLD-012 — messages carry images; `cacheBoundary` redefined, the twin is required |
| (this one) | Task/README/TASKS status, this file |

## The regression, because it is the reusable part

`dispatchProjectDocTool(call, context, docs = {})`. The doc set became a **third parameter with a
default**, beside the `context` that was already carrying it. One real caller passed it. Every other
call site **kept compiling** and silently resolved against `{}` — so the tool answered *"this project
has no fetchable documents"* for a project whose own context was holding an `ARCHITECTURE.md`.

Three things about that shape are worth remembering:

1. **A defaulted parameter is invisible to the type system by construction.** There is no diagnostic
   available for "you meant to pass this". Widening a signature with a default is the one refactor
   that cannot fail loudly.
2. **The unit tests could not see it**, because BLD-007 wrote them *after* the new signature — they
   passed the third argument. It was the **pre-existing** AIX-009 specs, written against the
   single-source contract, that failed. New tests agree with new code; old tests are the ones that
   disagree.
3. **The fix was to delete the parameter, not to make it required.** `context.docs` is public and is
   built once per session from the same snapshot `projectDocTools` is handed, so the property the
   third argument existed to guarantee — *the dispatcher answers from the set the tool definition
   advertised* — now holds by construction instead of by two call sites agreeing.

⚠️ **The rhyme with phase 56:** a gate that has never been *run* is not a gate. This one was
typechecked, unit-tested, reviewed and wrong.

## Gates, on the settled tree with both branches merged

| Gate | Result |
|---|---|
| `test:ci` | **`Jasmine: 2582 specs, 6 failures`** |
| `test:main` | **84 suites, 1125 tests, all passing** |
| `noodl-mcp` | **291 pass** |
| `typecheck:editor`, `typecheck:editor-tests` | clean |
| `catalog:check`, `cloud-library:check`, `catalog:merge:check`, `library:check` | green |

**The 6 failures are the inherited ones, confirmed by name and not by arithmetic**: 4 × `AIX-006
style vocabulary`, 2 × `AI model registry`. Same pair of files phase 56 recorded.

**The counts reconcile exactly**, which is the check worth doing rather than eyeballing a total:

- Jasmine `2574 → 2582` = +7 (BLD-007's specs) +1 (the B7 regression spec added this session).
- `test:main` `80 / 1085 → 84 / 1125` = +2 suites/+21 (BLD-007) +2 suites/+19 (BLD-012).

⚠️ `npm run test:main` is the gate, **not** bare `npx jest` at the repo root — that reports ~584
failed suites of noise. Phase 56 session 7 recorded this and it is still true.

## What these two tasks did and did not get

**Both are merged, gated offline, and neither has been driven in a real editor.** That is the whole
of the remaining debt on them, and each file carries its own open criterion.

- **BLD-007** — acceptance criterion 1 (a real turn fetching a user's doc) is **open**. The
  mechanism is built and now genuinely gated; the *turn* is a live measurement nobody has taken.
- **BLD-012** — ⚠️ **no real Anthropic/OpenAI endpoint has ever accepted the image block.** The
  specs pin the request *shape* against a stub client. As its own note says, **this failure has no
  symptom except the bill**, so the byte-for-byte golden is the only guard until someone runs a live
  turn.

## Fixture and worktrees

No fixture was touched; no project was opened. The two scratchpad worktrees still exist and are now
fully merged — `git worktree list` shows them as non-prunable. They can be removed whenever
convenient; nothing depends on them.

## What to do next

1. **Drive both.** One editor session pays BLD-007 criterion 1 and BLD-012's live-turn claim
   together — they touch the same authoring loop, and BLD-012's is the one with a cost attached to
   getting it wrong.
2. **Phase 57's actual next build is BLD-001** ⭐ (one thread, one composer) — everything in Track A
   rests on it, and BLD-011 gates the rest of Track B. Read the two corrections at the top of
   [README.md](README.md) first: **any task reaching for a colour token to fix legibility is
   wrong**, and the long-run headline problem is a `position: sticky`, not an instrumentation layer.
3. **Phase 58 (AWP) is at 3 of 6**, with AWP-003 and AWP-004 next; it is entirely `noodl-mcp` +
   `scripts/devtools`, so it needs no webpack rebuild and no editor — which makes it the natural
   parallel track to anything in here that does.
4. **Phase 56 §C is still a human gate** and is not an engineering task. It needs someone who did
   not build the bench to look at two committed screenshots and say which is the real app.
