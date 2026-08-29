# Phase 80 — next session

## State: DEF-001, DEF-002, DEF-003, **DEF-004**, DEF-016 closed.

**s6 (2026-08-29)** took DEF-004 (b) and closed it. Read `DEF-004-…md` **§4c** first, and **§2's
correction box** before believing anything else in that file's present tense.

| commit | what |
|---|---|
| `3b49fa8d` | **DEF-004 (b)** — `completed-commits-unchecked`, blocking; 21 specs, 8/8 mutants |

Gates at close: `test:ci` **2889 specs, 4 failures, all four `AIX-006 style vocabulary` by name**
(the floor, seed 60718) · `def-004` **21/21** · `typecheck:editor`, `typecheck:editor-tests`,
`typecheck:mcp`, `catalog:check`, `catalog:merge:check`, `catalog:groups:check`, `docs:nodes:check`
all clean.

---

## 🔴 The finding, in one paragraph

**The claim that broke was the one written in the present tense.** DEF-004 §2 said the shipped
site-builder wires `completed` into a record write — and **SBR-015 repaired that the day before**
(`48ad4dfc`, phase 77, 2026-08-28). At HEAD `publishPage` has **zero** `completed` wires; the wire
that marks a page published is `RunTasks.done → Set.store`. That stale tense is what gave AC4 its
shape, and AC4 as written refuses `submitContactForm` — one of the two graphs the same criterion
requires it to accept. §4b had already caught the contradiction and **its own replacement was also
wrong**: "a write whose payload asserts the outcome" does not separate the corpus, because
`published` and `received` are both booleans committed by a `completed` and both fed by a node that
is not downstream of the completing one. Comparing all four shipped instances on every structural
axis leaves exactly one discriminator: **whether a Failure route reaches the same commit.**

## What to do next

**DEF-006** (cheap, three parts, fully specified), or **DEF-017 C1**, or **DEF-007** — read its
**§1.1**, added late 08-29, which changes that task's premise and makes it the owner of P77's D11.

Also open: **DEF-008**, **DEF-009**, **DEF-014**, **DEF-015**, and the four carried from phase 76
by reference (**DEF-010/011/012/013** — three of the four say their fix needs a corpus sweep, and
that sweep is shared work that should be done **once**).

🔴 **Do to your task what §0 and §4c did to this one: find the claim in it that is a reading rather
than a measurement, and drive that one first.** It has now paid three sessions running — s4 deleted
two of three rows that way, s5 found a defect the file did not contain, s6 found that the defect
the file described had already been fixed.

⚠️ **And check the tense.** When a task file states a defect in the present tense, `git log` the
artefact before believing it. Three of DEF-004's rows were diagnosed wrong, each time from the file
rather than the thing.

## 🔴 What this session paid for, that the next one should not re-buy

- **A literal NUL byte makes `grep` return nothing, with exit 0.** The composite Map key was written
  `` `${a}\0${b}` `` — which is the **house idiom** (`author.ts`, `unlabelledNode.ts`, five files)
  and is *correct*: an id or a derived port name can contain a space and two pairs must never
  collapse to one key. But a literal NUL makes the whole file binary to `grep`, which then reports
  **no matches and succeeds**. Three mutants silently failed to apply because of it. ✅ Write it as
  the **`\0` escape**: same value, greppable file. ⚠️ **I first read the deliberate idiom as
  corruption** — the instrument had lied, and I doubted the file instead of the instrument.
- 🔴 **A mutation harness needs `assert old in source`.** Three of eight mutants did not apply (zsh
  ate the backticks, then the NUL). Without the assert that run reads as *"three mutants killed
  nothing"* — a finding about the rule, when it was a finding about the harness. *A mutant killing
  nothing is the finding* only once you know it ran.
- **A mutant that killed nothing, correctly diagnosed this time.** `unchanged` was in the rule's
  negative-outcome set and exercised by no arm. It **belongs** there (`RunTasks` fires it on an
  empty list, and the shipped `publishPage` routes it), so the arm was added rather than the port
  removed — with a negative control beside it: a `done` wire into the same commit does **not** clear
  the finding.
- **A template-scoped test is not a product fix, and its comment can disagree with its code.**
  SBR-015 left a gate at `sb007Template.test.ts:1296` whose comment says the rule is about *where
  the wire lands* and whose code also requires `type === 'RunTasks'`. That clause is the only reason
  it does not fire on `submitContactForm` — a hand-list wearing a predicate, blind to the same
  defect from a `sendemail` or a `DbModel2`.
- ⚠️ **`git status` is not authorship and a peer's all-clear is about that peer.** Three mcp
  typecheck errors appeared mid-session in `tpl001Template.test.ts`; I attributed them to the one
  peer who had messaged me, which is **elimination over an unchecked candidate list** — there was a
  third session, and it fixed them at 14:37:34 while I was writing. Both readings were true at
  different times. **`test:ci` webpacks the working tree**, so another session's in-flight
  `packages/` edits are inside your measurement, and the readout's `gitHead` names whoever committed
  last rather than what you compiled.

## Traps carried

- 🔴 **The rule is cloud-only, deliberately.** A browser-side `store` fired on `completed` is the
  same shape in front of somebody who can see it did not work. Widening it is a separate
  measurement, not a one-line change.
- ⚠️ **`noodl.cloud.sendemail`'s `send` is not a commit**, though it is a signal input spelled the
  same as a Response's. Sending a mail asserts no fact about upstream work. Pinned by a spec so the
  decision cannot drift into an accident.
- ⚠️ **The corpus's honest limit: 15 of the 17 projects carrying any `completed` wire are copies of
  one template.** The rule is calibrated against one author's habits. The 257-component second
  corpus is what stops that being invisible, not what fixes it.
- ⚠️ **AC1's second half is still open** — whether the *record* should say a run "succeeded" while
  carrying an `error` step. Unchanged by this session; it is the argument §4a left open.
- ⚠️ Carried from s5 and still true: `packages/noodl-runtime/dist-types/` is generated and
  gitignored and `noodl-viewer-cloud` typechecks against it; a cloud function whose graph **hangs**
  still answers 504 with zero steps; `nodegx-backend`'s suite takes ~250s and must be `--runInBand`.
