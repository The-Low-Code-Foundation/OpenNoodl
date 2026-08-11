# LEG-002 — lane notes

Branch `leg-002-lane`, based on `fc36d61a`. Measured and built 2026-08-11.

---

## 1 — The three numbers, first

The instrument is `scripts/legibility/scan-labels.js` (committed before the rule, and
re-runnable: `node scripts/legibility/scan-labels.js`). It reads raw JSON, both project
shapes, no dependency on the validator, and scores ten candidate predicates side by side.

**The shipped definition is `C8`** — see §3. Its hit counts:

| Corpus | Projects | Nodes | Labelled | **`UnlabelledNode` hits** | % of nodes | Projects it fires on |
|---|---:|---:|---:|---:|---:|---:|
| Every `project.json` in this repo | 91 | 5,509 | 19.7% | **214** | 3.9% | **9 of 91** |
| **`library/` prefabs + modules alone** | 58 | 1,333 | 20.3% | **25** | **1.9%** | **5 of 58** |
| phase-55/58 model runs | 12 | 1,126 | 89.3% | **9** | 0.8% | **2 of 12** |

All three were re-measured against the **shipped rule** afterwards, not only against the census
script: `validate:project` over the same 103 targets reports **223** `unlabelled-node` diagnostics
(214 repo + 9 runs), which is the census number to the unit. The two implementations agree.

The repo's 214 are concentrated, which is worth seeing before reading 214 as a lot:

```
   78  packages/noodl-editor/tests/testfs/big-merge-test-mine   (571/2933 labelled)  test fixture
   71  project-examples/agent-chat                              (  0/ 262 labelled)  ← the README's own
   39  packages/noodl-editor/tests/testfs/git-repo-utf8         (128/ 688 labelled)  test fixture
   17  library/modules/avatar                                   (  6/ 112 labelled)
    3  library/prefabs/stripe          ·  3  library/prefabs/supabase
    1  library/prefabs/form            ·  1  library/prefabs/pages-and-rows
    1  dev-docs/qa-fixtures/legacy-import/real-noodl-form
```

**117 of the 214 are editor merge-test fixtures** and 71 are `agent-chat` — the very fixture the
README noticed reads 0 of 262. The rule found it without being told about it, which is the closest
thing to independent corroboration this task has.

The node totals and label percentages reproduce LEG-002 §2's table **exactly** (5,509 / 19.7%,
1,333 / 20.3%), so the instrument is measuring the same thing §2 did.

Two reconciliations, so neither reads as a disagreement:

- §2 says "**34** `library/` prefabs and modules". There are **58** `library/**/project.json`
  files (29 prefabs + 29 modules). The **node** total is identical (1,333), so §2's file count
  was low and its measurement was right.
- §2 says "**eleven** phase-55/58 model runs · 1,123 nodes · 89.3%". There are **twelve**
  `phase5*` project directories, totalling **1,126** nodes at **89.3%**. §2's set is this one
  minus one of the two three-node stubs (`phase55-s8-kimi-k3`, `phase58-backend-alltools`):
  3 nodes, 0.0 percentage points. All twelve are measured here.

### The row that decides it

Per model run, at the shipped definition:

```
    1/  94    1%  C8= 6 in 2 runs   phase55-replay-haiku     ⚠️
  196/ 196  100%  C8= 0             phase55-replay-sonnet
   77/  88   88%  C8= 0             phase55-s6-haiku
    3/  19   16%  C8= 3 in 1 run    phase55-s6-qwen35-27b    ⚠️
  178/ 178  100%  C8= 0             phase55-s6-sonnet
  101/ 101  100%  C8= 0             phase55-s8-deepseek-v4-pro
  108/ 108  100%  C8= 0             phase55-s8-ds-probe
    3/   3  100%  C8= 0             phase55-s8-kimi-k3
  149/ 149  100%  C8= 0             phase55-s8-kimi-k3-rerun
  115/ 115  100%  C8= 0             phase58-awp006-deepseek
    3/   3  100%  C8= 0             phase58-backend-alltools
   72/  72  100%  C8= 0             phase58-backend-deferred
```

It is **silent on all ten compliant runs and speaks on exactly the two §2 flagged**. That is
the property that made this definition shippable rather than any threshold argument.

And on the hand-authored side, the five `library/` projects it fires on:

```
   17 hits (4 runs)  library/modules/avatar        (6/112 labelled)
    3 hits (1 run)   library/prefabs/stripe        (20/155)
    3 hits (1 run)   library/prefabs/supabase      (52/210)
    1 hit  (1 run)   library/prefabs/form          (6/82)
    1 hit  (1 run)   library/prefabs/pages-and-rows (5/22)
```

**53 of 58 shipped prefabs are untouched.** A rule that told 58 shipped, working prefabs they
were all wrong would be the ProblemsPanel telling the user their library is broken; this one
does not.

---

## 2 — The candidates that were rejected, with their counts

| Candidate | repo | library | runs | Why not |
|---|---:|---:|---:|---|
| `C0` every unlabelled node | **4,426** | 1,062 | 120 | §3's own warning. 80.3% of the corpus — a second copy of the node list. |
| `C1` §3's candidate *verbatim* (children **or** ≥3 params **or** >1 outgoing) | **2,232** | 502 | 92 | 40.5% of the corpus, 37.7% of `library/`. Not a diagnostic. |
| `C1` minus the parameter clause | 1,351 | 332 | 39 | Still 24.9% of `library/`. |
| `C2` any unlabelled container | 822 | 135 | 39 | 10.1% of `library/`; nags every layout Group in a working prefab. |
| `C3` fan-out only | 567 | 205 | 0 | **0 hits on every model run including replay-haiku** — blind to the population §2 says is real. |
| `C4` ≥3 same-type siblings | 664 | 98 | 35 | 7.4% of `library/`; includes leaf runs (39 `Text`, 26 `button`, 19 `Image`) where nothing is ambiguous. |
| `C6` `C4` at a floor of **2** | 1,371 | 207 | 67 | Two boxes side by side is a pair, not a wall. |
| `C7` `C4` with the run *entirely* nameless | 507 | 67 | 35 | Slightly better than `C4`, same leaf problem. Superseded by `C8`'s junction clause, which is the honest cut. |
| `C9` `C8` minus the junction clause | 567 | 89 | 35 | The junction clause is what removes 67 repeated `Load Product JSON` instances, 39 `Text`, 26 `button`, 19 `Image`, 8 `Divider`. It is worth 567 → 214. |

### The two skip lists, priced

Removing both skip sets moves the repo count 214 → **233**, and `library`/`runs` **not at all**.
The 19 it removes: `Expression` 12, `Component Inputs` 3, `Collection2` 2, `String` 1,
`String Format` 1. They stay in because a node the canvas *already* names — `usePortAsLabel`
renders `Expression 'a + b'`, not `Expression` — must not be told it is nameless, even where
that is currently worth 16 rows. `usePortAsLabel` is **not in the node catalog** (checked
both `node-catalog.json` and `node-catalog-enriched.json`: 0 of 175 entries carry it), so the
list is transcribed from the runtime node definitions and is the rule's one maintenance debt.

---

## 3 — The shipped definition

> **`unlabelled-node`** fires on a node with no `label` when **three or more of its same-type
> siblings under the same parent are also unlabelled**, and the node is a **junction** — it has
> children, or it feeds more than one downstream endpoint. Types whose identity is their own
> explanation (`Component Inputs`, `Page`, `Router`, …) and types the runtime already names from
> one of their parameters (`usePortAsLabel`) are skipped.

Two clauses, each earning its place on the table above:

1. **Three indistinguishable siblings** is the legibility failure stated precisely. One nameless
   Group is a node you click; a run of them is a canvas that reads `Group · Group · Group` with
   nothing to tell them apart. It is also the clause that makes the rule silent on a 100%-labelled
   graph *and* on a graph whose author labelled the three that matter.
2. **Junction** — it has children, or it fans out. A leaf ends the graph and costs one glance; a
   junction is something the reader has to go *through*. This is the clause that separates a real
   ambiguity from a gallery of decoration, and it is worth 567 → 214.

77% of all hits are `Group` (166 of 214), which is the shape the rule is named for.

---

## 4 — §5, the exit criterion the orchestrator should strike

README exit criterion 2 asks for `agent-chat` to be regenerated and its label coverage compared
against the fixture's current 0 of 262.

**The comparison is void, and this lane did not attempt it.** `agent-chat` was hand-built during
AIX-005 on 2026-07-27 (`b95eddb4`), before the authoring vocabulary existed. Regenerating it with
a current model and getting >90% measures the model, not this phase: `phase55-replay-sonnet`
already reads **196/196** with no LEG task shipped at all, and eight of the twelve model runs read
100%. Coverage on a fresh agent-authored graph has been at ceiling since before phase 50 opened.

Concretely, the substitute measurements this lane *can* offer are already above:

- the label-coverage split (89.3% agent vs 20.3% hand) is measured and reproduces §2;
- the rule's discrimination is measured on the same corpus (0 hits on ten compliant runs, 9 on
  the two §2 flagged).

Regenerating `agent-chat` remains worth doing as **fixture hygiene** — the repo's flagship
AI-authoring demonstration having 0 labels is embarrassing on its own terms — but it needs a live
model and the primary checkout, and it is not evidence for or against this task. Recommend the
orchestrator strike criterion 2 and replace it with §2's measured pair.

---

## 5 — Deviations from the spec, with reasoning

1. **§3's candidate definition was not shipped.** It was measured (`C1`) and it reports
   **2,232 of 5,509** repo nodes and 37.7% of `library/` — the failure mode §3 itself names.
   §3 asked for the candidate to be *pinned against the corpus before it ships*; the corpus
   rejected it. `C8` is what replaced it.
2. **The parameter clause was dropped, and could not have shipped anyway.** `NormNode` carries
   no `parameters` (see `responsiveArrangement.ts`'s header for the same finding), and only a
   `rules/` rule reaches the ProblemsPanel *and* `validate:project` — the precondition checks in
   `authoredCandidate.ts` reach neither. Acceptance requires a ProblemsPanel row, so a `rules/`
   rule it is. `C1-with-params` vs `C1-no-params` prices what was given up: 2,232 → 1,351,
   i.e. the clause only ever *widened* an already-too-wide rule.
3. **Severity is `info`, not `warning`.** §3 allows either. `info` is the
   `oversized-page` / `monotone-typography` precedent, and it is what makes "`validate:project`'s
   pass/fail unchanged" true by construction rather than by luck — `--warnings-as-errors` cannot
   promote it either.
4. **One diagnostic per node, not per sibling run.** The repair is a different sentence on each
   node, and the ProblemsPanel navigates by `nodeId`. Grouped it would be 63 rows repo-wide
   instead of 214; per-node it is ~2.3 rows per affected project, which is not a wall.

---

## 6 — What was built, and where

| File | What |
|---|---|
| `scripts/legibility/scan-labels.js` | The census. Ten candidates × three corpora, re-runnable, committed **before** the rule (`d4eb6ef7`). |
| `…/validation/diagnostics.ts` | `DiagnosticCode.UnlabelledNode = 'unlabelled-node'`, carrying §2's polarity argument and the measured numbers. |
| `…/validation/rules/unlabelledNode.ts` | The rule. `severity: 'info'`, `defaultEnabled: true`, plus the predicate census and the two skip lists. |
| `…/validation/rules/index.ts` | Registered **last** in `ALL_RULES` — the only rule in the set about legibility rather than breakage, so a reader meets everything describing real breakage first. |
| `packages/noodl-editor/tests-unit/validation/unlabelledNode.test.ts` | 20 specs. |

`validation/index.ts` was **not touched** — `ALL_RULES` already carries the rule and the spec
imports `MIN_NAMELESS_SIBLINGS` from the rule module directly, so there is no convergent conflict
with LEG-001's lane on that barrel.

---

## 7 — Gates, with the numbers

| Gate | Result |
|---|---|
| `npx tsc -p packages/noodl-editor --noEmit` | **clean**, exit 0 |
| `npx tsc -p packages/noodl-editor/tsconfig.tests.json --noEmit` | **clean**, exit 0 |
| `npx jest tests-unit/validation/unlabelledNode.test.ts` (from `packages/noodl-editor`) | **20 passed / 20** |
| `npx jest tests-unit` (from `packages/noodl-editor`) | **110 suites, 1,599 passed / 1,599** |
| `npx jest` (from `packages/noodl-mcp`) | **1 failed / 405 passed of 406** — the known baseline, unmoved (`tests/tools.test.ts:182`, a response byte budget, red since DSG-003 and untouched by this diff) |
| `validate:project` over 103 targets, **before** | 0 load errors · **5 errors** · 147 warnings · 4 infos · 6,635 nodes · exit 1 |
| `validate:project` over 103 targets, **after** | 0 load errors · **5 errors** · **147 warnings** · 227 infos · 6,635 nodes · exit 1 |

**`validate:project`'s pass/fail is unchanged, proven by running it, not reasoned about.** Errors
5 → 5, warnings 147 → 147, exit code 1 → 1 (the five errors are pre-existing:
`unknown-node-type` 83, `duplicate-node-id` 52, `repeated-sibling-subtree` 17, `oversized-page` 4
are unmoved). The rule's 223 diagnostics land entirely in `infos`, which neither the default gate
nor `--warnings-as-errors` counts.

> The corpus run needs its stdout redirected to a **file**, not a pipe: `validate-project.ts` ends
> in `process.exit()`, which truncates a large async pipe mid-JSON. The first attempt at this
> baseline silently lost half the report and read as 36 load failures.

### The tripwire was proved red, not assumed

Acceptance asks that `isBlockingForAuthoredOutput` return **false**, asserted so a later edit to
the blocking set cannot silently promote the code. A guard that has never been seen to fail is
decoration, so `DiagnosticCode.UnlabelledNode` was temporarily added to
`AUTHORED_BLOCKING_WARNINGS` and the suite re-run: **2 failed / 18 passed**, the two being
`is not in AUTHORED_BLOCKING_WARNINGS` and `does not block an authored submission`. Reverted; the
working tree is clean of it.

---

## 8 — Could not verify

- **The ProblemsPanel row was not seen on screen.** It is asserted structurally (severity `info` →
  `IconName.CircleOpen` + `TextType.Secondary`; `location.nodeType` + `#nodeId` in the row's second
  line; `message` as the primary text; `navigateTo` uses `location.nodeId`, which is set) and by
  spec, but no editor was launched — driving one from this worktree would have needed the primary
  checkout, where another session is working.
- **The full editor jasmine suite (`test:ci` / `test:main`) was not run** — the lane rules forbid
  it, since `lerna exec` resolves to the primary checkout.
- **`agent-chat` was not regenerated.** Deliberate, per §5 — see §4 above.
- **`usePortAsLabel` was transcribed by grep, not derived.** The list in `SELF_NAMING_TYPES` is
  believed complete as of `fc36d61a`, but nothing gates it, and the field does not reach the
  catalog, so a node type added later with `usePortAsLabel` will be reported as nameless until
  someone re-greps. It is worth 16 corpus hits today.
- **The `library/modules/avatar` hits (17 of the library's 25) are a demo gallery**, and a run of
  identical avatars in a *demonstration* project is arguably a legitimate shape rather than a
  legibility failure. It stays reported because the rule cannot tell a demo from a page, and
  because at info severity the cost of being wrong there is one grey line.
