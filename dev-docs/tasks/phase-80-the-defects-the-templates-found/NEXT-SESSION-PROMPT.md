# Phase 80 — next session

## State: DEF-001, 002, 003, 004, 006, 014, 016, 017 closed. **DEF-015 is 🟢 built, 🟡 undriven.** DEF-007 is 🟡 partial.

**s11 (2026-08-29)** took **DEF-015**. The fix, its specs and its mutant are landed and committed at
`539bb840`. **AC1 and AC2 are the only things left on it, and they are blocked on a resource, not on
a question** — see below.

| commit | what |
|---|---|
| `539bb840` | **DEF-015 fixed at the cause** — `classifyCloudComponents`, the card diffing endpoints only, 11 specs |

---

## 🔴 The finding, in one paragraph

**The card was not misclassifying anything — it had no classifier at all.** It subtracted the
backend's list of served functions from the editor's list of cloud components, and those two lists
are built by **different predicates**: the editor applied only the `/#__cloud__/` prefix, the backend
applies the prefix *and* SB-003's has-a-Request-node rule. So `missing` was the set difference
between two predicates rather than a list of failed deploys, and it equalled the project's helpers
exactly — in every project, forever, immediately after a successful push. 🔴 **`functionDeclarations.ts`
predicts this in its own header** — *"two readers of one predicate is how a gate starts disagreeing
with the thing it gates"* — written about the backend's two readers, which it keeps in step. The
editor was a third reader nobody had counted, holding half the rule. Fixed by giving the editor the
whole rule: endpoint / worker / unreachable, with the third bucket **visible** so a reference
mechanism the rule does not know about surfaces instead of being absorbed.

## What to do next

⚠️ **First: finish DEF-015 by driving AC1 and AC2.** It is ~20 minutes and the recipe is written out
step by step in **DEF-015 §9.1**, including the backend-side deletion that makes AC2 a real negative
control and the autosave trap that would heal it before you read it. It needs the editor, which a
peer held for all of s11.

Then: **DEF-007's §3.2** is still the largest open piece and still sequenced behind phase 77.
Also open: **DEF-008**, **DEF-009**, and the four carried from phase 76 by reference
(**DEF-010/011/012/013** — three share one corpus sweep, to be done **once**). **DEF-005** is 🔒 on a
Richard ruling.

🔴 **The standing instruction has now paid eight sessions running.** *Find the claim in your task
that is a reading rather than a measurement, and drive that one first.* s4 deleted two of three rows,
s5 found a defect the file did not contain, s6 found it had been fixed the day before, s7 found the
rule wrong about two of eleven cases, s8 found the recommended fix ships an accessibility defect,
s9 found a scope item with no population, s10 found the proposed mechanism could not tell apart the
two things it was named for, **s11 found the task pointed at the wrong file — and its stated
mechanism was wrong for a third of its own population.**

## 🔴 What this session paid for, that the next one should not re-buy

- 🔴 **The corpus could not see the defect, and the parity spec could not either.** Under AC4's
  mutant (classify by the `site/` folder instead of by node content), **all four specs that grade the
  real shipped template passed** — including the backend-parity assertion the spec file itself calls
  load-bearing. Only the six **synthetic** arms, built to make the folder and the content disagree,
  went red. In today's template those two rules agree perfectly, so *"assert it against the real
  artefact, and against what the backend really serves"* is a green suite over the wrong rule.
  ✅ **A real-corpus spec is a regression net. A property is only visible where you made the
  candidate rules disagree on purpose.**
- 🔴 **The task file named the wrong seam AND the wrong mechanism, and each would have cost a
  session.** §3 said the classification lives in `CloudFunctionsSection` — there was no
  classification there or anywhere in the editor. §2 said the three warned components are `RunTasks`
  task templates — **two are**; `site/ContactRecipient` is a component *instance* at the root of
  `submitContactForm`. A fix built from that sentence leaves one triangle standing and fails AC1 on
  the drive. ✅ **Read the artefact before the prose, even when the prose is a defect report that
  already contains a screenshot.**
- ✅ **`node.typename` is the honest field, not `node.type.name`.** The latter resolves through the
  `NodeLibrary` singleton, which a spec bundle can leave pointing anywhere (sb017's spec snapshots
  and restores it for exactly this reason). Reading the raw string is what let all the synthetic arms
  run with no library loaded at all.
- ✅ **`forEachNode` walks a component's own graph; `forEachNodeRecursive` descends into the
  components it places.** The first is the boundary the backend draws over the exported bundle, where
  an instance's inner nodes are not inlined. Using the recursive one would have made every *caller*
  of a Request-node-holding helper an endpoint too.
- ✅ **The pre-fix population is measurable without the editor.** A deployed bundle at
  `~/.noodl/backends/<id>/workflows/*.workflow.json` is exactly what `declaredFunctionsIn` parses, so
  the backend's own rule can be run over it offline. That gave the 7/4/3 split on a project a peer
  had created independently — the product's population, not the template artefact's.

## Traps carried

- ✅ **`test:ci` — 2905 specs, 4 failures, seed 60404, at `6c358a3f`.** All four are the named
  **AIX-006 style vocabulary** floor. **The floor is 4 by name.** s10's fifth (SB-017) is gone; it was
  a peer's mid-edit artefact, as s10 recorded. Suite grew 2894 → 2905, exactly the 11 specs added.
- ✅ `tsc -p noodl-editor` and `tsc -p noodl-editor/tsconfig.tests.json` both clean.
- 🔴 **`catalog:examples` is still a PR gate (`pr.yml:210`) and still RED**, 60/62, owner **`NONE`**,
  ~20 minutes. Unchanged and unmeasured this session.
- ⚠️ **`typecheck:mcp` red on one peer error** and 2 failures in `tpl001Template.test.ts` from a
  peer's uncommitted fixture, as recorded by s8. Not re-measured; neither is phase 80's.
- 🔴 **The editor is single-instance on this checkout** — one `:9222`, one user-data dir, and a
  second `dev` stack reaps the first. A peer held it for all of s11. **Check `ps` for
  `start-electron-dev` and ask before taking it**; a drive is not worth destroying a peer's.
- ⚠️ **A pathspec commit errors on an untracked file** — `git add` the new spec first, then commit by
  pathspec in the same command. One new spec file needed it, as s10 recorded.
- ✅ **Undo a mutant by its exact text, then `diff` against a scratchpad copy taken before it was
  applied.** `git checkout --` on those files would have discarded the fix.
