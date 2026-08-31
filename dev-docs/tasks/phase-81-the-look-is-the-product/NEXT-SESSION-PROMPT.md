# Phase 81 — next session

**Read `README.md` §1–§4 first** — the ruling, the rubric, the protocol, the rules. Then
**`VIB-007-THE-LOOP.md` §2**, which is the mapping the next two tasks are built on, and
**`VIB-006-THE-WORKED-PAGE.md` §15**, which is the session's most expensive finding.
Re-derive the board from `TASKS.md` + the task files; do not trust this file's copy of it.

## Board, re-derived from the task files (2026-08-31, session 6)

| id | status |
|---|---|
| VIB-001 The Judge | 🟢 **CLOSED**, all 5 ACs. Baseline 9 SHITTY / 0 / 0 |
| VIB-002 The Ceiling | 🟡 **PASSABLE — Richard ruled it** |
| VIB-003 The Pictures | 🟡 **PASSABLE — Richard ruled it** |
| VIB-004 The Marketing Kit | 🟡 **PASSABLE**, not yet seen by Richard |
| VIB-006 The Worked Page | 🟢 **CLOSED — WORTHY, RICHARD RULED IT**: *"It looks fucking pro, good job. VIB 006 screens are amazing"*. **The phase's first close on the look** |
| VIB-011 The Stock Library | 🟡 **PASSABLE — ruled TWICE**, the second time explicitly: *"VIB 011 is passable, a fine minimalist landing page"*. ✅ The cautious reading of his first ruling was right |
| VIB-012 Prune On Deploy | 🟢 **BUILT.** 3.35 MB → 92 KB. ⚠️ full Electron deploy never run end to end |
| **VIB-007 The Loop** *(rescoped)* | ⬜ **the next job** — M1 mandatory render, M2 traps→diagnostics, M3 poverty findings |
| **VIB-013 The Altitude** *(new)* | ⬜ the section expander; startable in parallel |
| VIB-005 The Ambush Defaults | ⬜ startable now — M2 applied to the runtime-default family |
| VIB-008/009 | ⬜ prove it on the shipped templates |
| VIB-010 The Cold Proof | ⬜ the exit exam. **VIB-006 is met**; now waits on VIB-007 **and VIB-013** |

## 🔴 Richard has TWO things waiting on him, and neither blocks building

✅ **He has seen the VIB-006 page and ruled it WORTHY**, and he answered the deploy-size question in
VIB-011. Two questions remain open — **silence is not assent**:

1. **Are the six faces the right six?** Owner **NONE** — ask him.
2. **Is 3.32 MB per project acceptable?** Owner **NONE** — ask him. ⚠️ Ask it *narrowly*: the **deploy**
   half is solved (V36 → VIB-012 prunes to 92 KB). What is unanswered is the **per-project** cost.

✅ Closed since the last handoff: *"is the potter right for a generic hero?"* — answered in
**VIB-006 §10**. No, and not because it is a subject: a band **ground** wants a `ground-*`/`texture-*`,
a media column wants a `tile` subject, and the real problem is that **a recipe cannot know the
subject**. The fix belongs in `ui-split-hero`'s `description`; filed against VIB-007, not done here
because repairing that recipe re-opens VIB-003/VIB-011's verdicts.

## 🔴 The next task is VIB-007 (rescoped) — read `VIB-007-THE-LOOP.md` §2 FIRST

**VIB-007 was rescoped and VIB-013 opened**, after Richard asked how to bake this phase's results into
the MCP instead of re-teaching them every session. The argument is not a preference: the mapping was
run over all **41** register rows *before* either task file was written
(`demo/map-register-to-mechanisms.py` — reproducible, re-run it rather than trusting this table):

| | rows | still live |
|---|---|---|
| **M1** the render is mandatory | 5 | 5 |
| **M2** trap → authoring-time diagnostic | 14 | **11** |
| **M3** the gate fires on poverty | 6 | 6 |
| **M4** section expander (VIB-013) | 5 | 4 |
| **M5** corpus generated from compositions (VIB-013) | 5 | **0** |
| retired by nothing | 16 | 5 |

**18 of the 23 live rows (78%) fall out to a mechanism rather than to a paragraph.**

- **VIB-007 — The Loop** (M1+M2+M3). 🔴 **Its first job is a RENDER, not code**: V22 must be ruled —
  whether a `For Each` feeds item properties into ports never declared decides whether those **14**
  examples are broken or work by another route.
- **VIB-013 — The Altitude** (M4+M5). ⚠️ M5 retires 5 rows and **none is open**: prevention, not
  cleanup — build it, but last, and do not let it delay M4.
- **VIB-005** is unchanged and still startable: M2 applied to the runtime-default family
  (V1, V2, V14, V17, V21, **V38** — new this session).

🔴 **Two things not to re-litigate.** *Instruction* was measured and rejected as the lever: **V17** is
a session that shipped V1 **after reading V1**, and **V35** leaves **one token** of resident surface to
instruct with. And the five live rows no mechanism retires are **named** (V3, V18, V31, V35, V41)
rather than glossed — V35 is not retirable at all, it is the constraint that picks the design.

## What this session settled

- **`docs/node-catalog/examples/ui-landing-page.json`** — 14 components, **129 nodes, 8 bands on a
  9-node page**, seven grounds, **eight distinct photographs**, three different faces, five item
  components each with declared `Component Inputs` ports. Gated **67/67 strict**. WORTHY, ruled.
- Built by `demo/write-vib006-example.js`; served by `demo/build-vib006-landing.js`, which **lifts
  nothing** — the example already *is* a page, which is the cheapest proof of the claim.
  Look file `packages/nodegx-backend/tests/vib006-landing.look.ts`, 6/6.
- 🔴 **V40 — the door could not see the corpus, and had not since VIB-002.** `get_example` answers from
  **generated** `node-catalog-enriched.json`: **67 examples on disk, 64 in the door**. VIB-004's two
  recipes had been unreachable for **two sessions**. Regenerated and verified *through the door*
  (`listExamples()` → 67). The `nodeDocBudget` ratchet moved 13,500 → 14,300, with the breach
  attributed to P80's DEF-029 (`File Drop` = **2,651 of the 2,880 bytes** `Group` grew).
- ⚠️ **V41 — nothing this phase built is in a running server.** The live bundle (Aug 21) inlines the
  catalog and has **0 occurrences** of `ui-gradient-hero`, `ui-cta-band`, `ui-landing-page`,
  `starter-imagery`, `gradient-scrim`. Not a repo defect; discharges on the next release build. Owner
  **NONE** — the action is to **verify after that build**.
- **VIB-007 rescoped, VIB-013 opened** (the *procedure* tier — README §5 amended), and
  `ui-image-scrim-band`'s description corrected (**V39**).

## 🔴 Six method findings worth carrying out of this session

1. **A gate that is already green can still be telling you the answer.** `oversized-page` is an
   **INFO** — it does not fail a run — and its sentence is what turned a 90-node page into eight
   section components. The first build passed everything that fails a build and was the wrong shape.
2. 🔴 **A gate that exists and nobody runs is not a gate.** `catalog:merge:check` had been **red for
   four commits** while every phase-81 session ran `catalog:examples`, which validates the corpus
   **files** and is structurally unable to see whether the door can reach them. **A hole shaped exactly
   like the defect**, on a phase whose premise is *the corpus is what a model imitates*.
3. 🔴 **A budget on a GENERATED file is only a budget on the last time it was generated.** P80's ports
   were in the product and unpriced by their own ceiling for four commits.
4. **An inert parameter in a corpus example teaches a lie.** `justifyContent: center` did nothing
   across three configurations; it was **deleted**, not left in, because a model copies the page it is
   told to imitate and cannot see that a parameter is doing nothing.
5. **An enumerated port list is a claim about which ports exist.** The look file's picture check read
   `src`/`backgroundImage`/`image` and reported **6** on a page carrying **8**. ✅ Caught **only**
   because the cardinality assertion was written before the number was known.
6. 🔴 **Under-reading a ruling is the same class of error as over-reading one.** *"Approval is not a
   grade"* is a caution, not a reflex: what made this ruling a grade was **the contrast inside his own
   sentence** — *"passable"* for one artefact and *"fucking pro"* for the other, in the same breath.

## Gate readings (2026-08-31, committed through `e12f4066`)

🔴 **Every row is an EXIT STATUS.** A crashed `tsc` writes zero `error TS` lines, so a grep over its
log reads `0` and is indistinguishable from a clean pass.

| gate | reading |
|---|---|
| `npm run catalog:examples` | **exit 0** — **67/67** clean, strict, warnings-as-errors |
| `npm run catalog:merge:check` | **exit 0** — ⚠️ **was RED for four commits before this session** |
| `npx jest --config packages/noodl-mcp/jest.config.js` | **exit 0** — 79 suites / **1045** tests, re-run *after* the catalog regeneration and the ratchet |
| `npm run typecheck:editor` | **exit 0** |
| `npm run typecheck:mcp` | **exit 0** |
| `vib006-landing.look.ts` | **exit 0** — 6/6, four viewports, `starterAssets.failed: []`, `unreachablePx: 0` everywhere |
| `npm run typecheck:backend-tests` | 🔴 **attempted, exit 134 (OOM).** ⚠️ **Sharper than the standing note**: a project narrowed to just `vib006-landing.look.ts` + `tests/helpers/**` **still OOMed at 4 GB after 277 s**, because `judge.ts` transitively pulls in `site-drive.ts` and the editor model tree. **Two files is already too many — narrowing does not help.** CI (`pr.yml:39`) covers it. Do not chase it again |
| `npm run test:ci` | ⚠️ **not run** — nothing this session touched is in it. Floor is 4, all AIX-006 by name |

## Standing cautions

- 🔴 **No proxy closes a task.** If you notice yourself grading JSON, stop and render.
- 🔴 **Legible and operable is the floor, not a grade** (Richard, 2026-08-31).
- 🔴 **Never raise a viewport to make content fit.**
- 🆕 🔴 **A NEW EXAMPLE OR A NEW PORT OWES `npm run catalog:merge:check`.** The corpus files and the
  file the door answers from are two different artefacts (V40).
- 🔴 **ASK THE DOOR WHETHER THE KIT ALREADY CAN** — five for five; VIB-006 needed no new vocabulary.
  🆕 ⚠️ **But V40 is the refinement**: this session asked whether the kit *could* and never asked
  whether the door could *see* the answer. **Ask both.**
- 🔴 **RE-DERIVE A ROW FROM ITS PREDICATE.** V8 was the fifth check and the **first** to survive it.
  Keep checking anyway: the re-derivation is what produced the number the task was built on.
- 🔴 **A change to `DEFAULT_TOKENS`, `STYLE_COMPOSITIONS`, a tool description, what is installed in a
  project, or the example corpus owes the noodl-mcp suite** (V24, V34, V35, V40).
- 🔴 **Rebuild the viewer before a Judge run that depends on a runtime change.**
- 🔴 **`render-from-disk` reads tokens BY REGEX** — a comment between `name:` and `value:` deletes a
  token from every Judge photograph.
- ⚠️ Node ids are unique **project-wide**, not per component — `duplicate-node-id` is an ERROR.
- ⚠️ Shared checkout: **P80 is active in this tree** (it committed twice mid-session). Commit by
  pathspec, `git add` untracked first, never stash, never `git checkout --` over live work.
