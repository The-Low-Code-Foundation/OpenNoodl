# Phase 81 — next session

**Read `README.md` §1–§4 first** — the ruling, the rubric, the protocol, the rules. Then
`VIB-006-THE-WORKED-PAGE.md` §7 and §12, which are this session's two method findings. Re-derive the
board from `TASKS.md` + the task files; do not trust this file's copy of it.

## Board, re-derived from the task files (2026-08-31, session 6)

| id | status |
|---|---|
| VIB-001 The Judge | 🟢 **CLOSED**, all 5 ACs. Baseline 9 SHITTY / 0 / 0 |
| VIB-002 The Ceiling | 🟡 **PASSABLE — Richard ruled it** |
| VIB-003 The Pictures | 🟡 **PASSABLE — Richard ruled it** |
| VIB-004 The Marketing Kit | 🟡 **PASSABLE**, not yet seen by Richard |
| VIB-011 The Stock Library | 🟡 **PASSABLE — ruled TWICE**, explicitly: *"VIB 011 is passable, a fine minimalist landing page"*. ✅ The cautious reading of his first sentence was right |
| VIB-012 Prune On Deploy | 🟢 **BUILT.** 3.35 MB → 92 KB. ⚠️ full Electron deploy never run end to end |
| VIB-006 The Worked Page | 🟢 **CLOSED — WORTHY, RICHARD RULED IT**: *"It looks fucking pro, good job. VIB 006 screens are amazing"*. The phase's first close on the look |
| VIB-007 The Loop *(rescoped)* | ⬜ **the next job** — M1 mandatory render, M2 traps→diagnostics, M3 poverty findings |
| VIB-013 The Altitude *(new)* | ⬜ the section expander; startable in parallel |
| VIB-005 The Ambush Defaults | ⬜ startable now — M2 for the runtime-default family |
| VIB-008/009 | ⬜ prove it on the shipped templates |
| VIB-010 | ⬜ the exit exam. **VIB-006 is met**; now waits on VIB-007 **and VIB-013** |

## 🔴 Richard has TWO things waiting on him, and neither blocks building

✅ **He has seen the VIB-006 page and ruled it WORTHY.** Two older VIB-011 questions are still
unanswered and stay open (silence is not assent):

1. ~~Is the potter right for a generic hero?~~ **ANSWERED by VIB-006 §10** — no, and not because it is
   a subject. A band **ground** wants a `ground-*`/`texture-*`; a media column wants a `tile` subject.
   The real problem is that a recipe cannot know the subject, so the instruction belongs in
   `ui-split-hero`'s **description**. Filed against VIB-007; not done here because repairing that
   recipe re-opens VIB-003/VIB-011's verdicts.
2. **Are the six faces the right six?** Owner **NONE** — ask him.
3. **Is 3.32 MB per project acceptable?** Owner **NONE** — ask him. (Deploy payload is solved: V36/VIB-012.)
4. **NEW: does the VIB-006 page read WORTHY to him?** If yes, it is the first close in the phase.

## 🔴 The next task is VIB-007 (rescoped) or VIB-005 — read `VIB-007-THE-LOOP.md` §2 FIRST

**VIB-007 was rescoped and VIB-013 opened**, after Richard asked how to bake this phase's results into
the MCP instead of re-teaching them every session. The argument is not a preference — the mapping was
run over all **41** register rows before either file was written
(`demo/map-register-to-mechanisms.py`, reproducible):

| | rows | still live |
|---|---|---|
| **M1** render is mandatory | 5 | 5 |
| **M2** trap → authoring-time diagnostic | 14 | **11** |
| **M3** gate fires on poverty | 6 | 6 |
| **M4** section expander (VIB-013) | 5 | 4 |
| **M5** corpus generated from compositions (VIB-013) | 5 | **0** |
| retired by nothing | 16 | 5 |

**18 of the 23 live rows (78%) fall out to a mechanism rather than to a paragraph.**

- **VIB-007 — The Loop** (M1+M2+M3). 🔴 **Its first job is a RENDER, not code**: V22 must be ruled —
  whether a `For Each` feeds item properties into ports never declared decides whether **14** examples
  are broken or work by another route.
- **VIB-013 — The Altitude** (M4+M5). The section expander. ⚠️ M5 retires 5 rows and **none is open**:
  prevention, not cleanup — build it, but last, and do not let it delay M4.
- **VIB-005** is unchanged and still startable: it is M2 applied to the runtime-default family
  (V1, V2, V14, V17, V21, **V38** — new this session).

🔴 **Two rejections worth not re-litigating.** *Instruction* was measured and rejected as the lever:
**V17** is a session that shipped V1 **after reading V1**, and **V35** leaves **one token** of resident
surface to instruct with. And the five live rows no mechanism retires are **named** in
`VIB-007-THE-LOOP.md` §2 (V3, V18, V31, V35, V41) rather than glossed — V35 is not retirable at all,
it is the constraint that picks this design.

## What this session settled

- **`docs/node-catalog/examples/ui-landing-page.json`** — 14 components, **129 nodes, 8 bands on a
  9-node page**, seven distinct grounds, **eight distinct photographs**, three different faces,
  five item components each with declared `Component Inputs` ports. Gated **67/67 strict**.
- Built by `demo/write-vib006-example.js`; served to the Judge by `demo/build-vib006-landing.js`,
  which **lifts nothing** — the example already is a page, which is the cheapest proof of the claim.
- `packages/nodegx-backend/tests/vib006-landing.look.ts` — 6/6, four viewports, door state.
- `ui-image-scrim-band`'s description corrected (**V39**).

## 🔴 Four method findings worth carrying out of this task

1. **A gate that is already green can still be telling you the answer.** `oversized-page` is an
   **INFO** — it does not fail a run — and its sentence is what turned a 90-node page into eight
   section components. The first build passed everything that fails a build and was the wrong shape.
2. **An inert parameter in a corpus example teaches a lie.** `justifyContent: center` on the story
   column did nothing across three configurations. It was **deleted**, not left in, because a model
   copies the page it is told to imitate and cannot see that a parameter is doing nothing. This is the
   corpus-side twin of V25 (*the rule existed and the example outvoted it*).
3. **An enumerated port list is a claim about which ports exist.** The look file's picture check read
   `src`/`backgroundImage`/`image` and reported **6** on a page carrying **8** — it could not see the
   avatars arriving through an instance parameter. ✅ Caught **only** because the cardinality assertion
   was written before the number was known. `toBeGreaterThan(0)` would have shipped it.
4. **`contentBottom` was identical (3766) across two of three attempts and the picture was identical
   across all three.** Only looking settled it. Same shape as the VIB-004 lesson, one task along.

## Gate readings (2026-08-31, committed `2522344b`)

🔴 **Every row is an EXIT STATUS.** A crashed `tsc` writes zero `error TS` lines, so a grep over its
log reads `0` and is indistinguishable from a clean pass.

| gate | reading |
|---|---|
| `npm run catalog:examples` | **exit 0** — **67/67** clean, strict, warnings-as-errors |
| `npx jest --config packages/noodl-mcp/jest.config.js` | **exit 0** — 79 suites / **1045** tests |
| `npm run typecheck:editor` | **exit 0** |
| `npm run typecheck:mcp` | **exit 0** |
| `vib006-landing.look.ts` | **exit 0** — 6/6, four viewports, `starterAssets.failed: []`, `unreachablePx: 0` everywhere |
| `npm run typecheck:backend-tests` | 🔴 **attempted, exit 134 (OOM).** ⚠️ **Sharper than the standing note**: a project narrowed to just `vib006-landing.look.ts` + `tests/helpers/**` **still OOMed at 4 GB after 277 s**, because `judge.ts` transitively pulls in `site-drive.ts` and the editor model tree. **Two files is already too many — narrowing does not help.** CI (`pr.yml:39`) covers it. Do not chase it again |
| `npm run test:ci` | ⚠️ **not run** — nothing this task touched is in it. Floor is 4, all AIX-006 by name |

## Standing cautions (unchanged, all still true)

- 🔴 **No proxy closes a task.** If you notice yourself grading JSON, stop and render.
- 🔴 **Legible and operable is the floor, not a grade** (Richard, 2026-08-31).
- 🔴 **Never raise a viewport to make content fit.**
- 🔴 **ASK THE DOOR WHETHER THE KIT ALREADY CAN.** Now **five for five** — VIB-006 needed no new
  vocabulary at all, only assembly.
- 🔴 **RE-DERIVE A ROW FROM ITS PREDICATE.** V8 was the fifth check and the **first** to survive it —
  after V6, V12, V22 and V30 were each materially wrong about their own premise. Keep checking anyway:
  the re-derivation is what produced the number the task was built on.
- 🔴 **A change to `DEFAULT_TOKENS`, `STYLE_COMPOSITIONS`, a tool description, or what is installed in
  a project owes the noodl-mcp suite** (V24, V34, V35).
- 🔴 **Rebuild the viewer before a Judge run that depends on a runtime change.**
- 🔴 **`render-from-disk` reads tokens BY REGEX** — a comment between `name:` and `value:` deletes a
  token from every Judge photograph.
- ⚠️ Node ids are unique **project-wide**, not per component — `duplicate-node-id` is an ERROR.
- ⚠️ Shared checkout: commit by pathspec, `git add` untracked first, never stash, never
  `git checkout --` over live work.
