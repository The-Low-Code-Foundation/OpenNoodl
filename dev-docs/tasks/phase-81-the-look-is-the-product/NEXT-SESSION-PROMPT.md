# Phase 81 — next session

**Read `README.md` §1–§4 first** — the ruling, the rubric, the protocol, the rules. Then
`VIB-011-THE-STOCK-LIBRARY.md` §7 and §11, which are where this phase's register was found to be
materially wrong about its own premise for the **fourth** time, and where two instruments were found
measuring the wrong thing. Re-derive the board from `TASKS.md` + the task files; do not trust this
file's copy of it.

## Board, re-derived from the task files (2026-08-31, session 5)

| id | status |
|---|---|
| VIB-001 The Judge | 🟢 **CLOSED**, all 5 ACs. Baseline 9 SHITTY / 0 / 0 |
| VIB-002 The Ceiling | 🟡 **PASSABLE — RICHARD RULED IT**: *"very passable, nearly worthy, definitely night and day with the original"* |
| VIB-003 The Pictures | 🟡 **PASSABLE — RICHARD RULED IT**: *"nice, deffo passable and looking like a modern base template, good job"* |
| VIB-004 The Marketing Kit | 🟡 **PASSABLE, not yet seen by Richard.** ⚠️ Its named blocker (the pictures) is now CLOSED |
| VIB-011 The Stock Library | 🟡 **PASSABLE — RICHARD RULED IT**: *"It's looking better and better, good job"*. 44 CC0 photographs shipped, taught, rendered |
| VIB-012 Prune On Deploy | 🟢 **BUILT s5** — Richard chose prune-on-deploy; real project **3.35 MB → 92 KB (97.3%)**. ⚠️ A full Electron deploy was never run end-to-end |
| VIB-006 The Worked Page | ⬜ **the next job — see below** |
| VIB-005/007 | ⬜ startable now, in parallel |
| VIB-008/009 | ⬜ prove it on the shipped templates |
| VIB-010 | ⬜ the exit exam |

## 🔴 Richard has seen it — and three questions he did NOT answer

He was shown all eight photographs (four widths, full page and first fold) and ruled:
*"It's looking better and better, good job"*. **Recorded PASSABLE, not WORTHY** — same register as
VIB-002's *"very passable, nearly worthy"* and VIB-003's *"deffo passable… good job"*, both recorded
PASSABLE. 🔴 *Better* is a direction, not a verdict; reading approval as a grade is the mistake
README §2 exists to prevent.

⚠️ **Three questions went with those screenshots and none came back. Silence is not assent**, and
each changes what somebody builds next:

1. **Is the potter right for a GENERIC hero?** `ui-split-hero` is the most-copied recipe in the
   corpus, so `work-potter.webp` now lands at the top of every page built from it. It suits *this*
   page's ceramics copy, which flatters it and will not flatter the next one. → **VIB-006** has to
   choose a hero anyway; treat this as its first decision.
2. **Are the six faces the right six?** → ask him.
3. **Is 3.32 MB per project acceptable?** Copied into every project at creation; cut from 4.63 MB,
   could halve again by shipping fewer than 44. → ask him.

## 🔴 The next task is VIB-006, and VIB-011 is the argument for it

VIB-011's own verdict says it in one sentence: **the library ships and the page barely uses it.**
One band of six carries a photograph, and the headline is still a bare heading on white — which is
the rubric's *first* WordPress-starter tell. The capability tier is now done (VIB-002 grounds,
VIB-003 icons, VIB-004 sections, VIB-011 pictures) and **nothing in the corpus assembles all of it
into one page.** That is register **V8** and it is VIB-006.

Concretely, and this is the strongest single piece of evidence available: **`ui-image-scrim-band` can
now put display type over a real photograph with a scrim, and no page in the corpus places it.**

## What this session settled

- **44 CC0 photographs, 3.32 MB**, in `noodl_modules/starter-imagery/` beside the six SVGs (which
  stay — shipped recipes point at them, and an abstract ground is still the honest answer when no
  photograph would be true about the subject). Grouped `hero` 8 / `work` 8 / `food` 7 / `texture` 6 /
  `people` 5 / `avatar` 6 / `animals` 4, each **already cropped for the shape it is for**.
- **`LICENCES.json` ships beside the pictures**, one row per image with `subject`, `role`, `says`,
  title, author, licence and Commons URL. Licence tally: `{ CC0: 44 }`. The door reads the same file,
  so there is no second catalogue to drift.
- **`get_style_vocabulary` gains an `imagery` block**; `prompts/design.ts` §5 rewritten; the two
  recipes that had pictures repointed at real ones.
- `scripts/library/fetch-stock-imagery.js` (fetch + licence-check) and
  `scripts/library/make-stock-library.js` (curate + crop + provenance) — the curation, including
  **what was refused and why**, is written down in the second one.

## 🔴 Where the handoff you were given was wrong — for the FOURTH time

- **V30's own licence table excluded Unsplash outright.** That restriction is in the **current**
  Unsplash Licence (June 2017). Before it, Unsplash released under **CC0 1.0**, which is irrevocable
  and carries no collection restriction, and Commons will not host the post-2017 licence — so
  `Category:Images from Unsplash` (**31,004 files**) is the CC0 era. It is what fixed `people`, which
  `Category:Images from Pixabay` (6,164) could not: `woman laptop` returned **one** file there.
- After V6 ("zero marketing compositions" — five already shipped), V12 (a rule that cannot see a
  component instance) and V22 (population 14, not 1), that is **four**. 🔴 **Re-derive a row from its
  predicate before building on it**, and name which predicate — here it was *"which licence, on which
  files"*, and the row had answered a different question.

## 🔴 Two instruments caught measuring the wrong thing

- **V34: the wire-budget gate priced a project nobody has.** `get_style_vocabulary`'s budget spec ran
  on a bare fixture — no Inter, no Lucide, no imagery — so it measured the *"none installed"*
  sentence at **+45 prompt / +31 full**, when the real cost on **every project the editor creates**
  is **+225 / +515**. The icon block has the same two arms and the spec's own comment said so in
  passing, so this has been pricing the cheap arm since VIB-003. **Now installs the library before
  measuring**; ceilings set against the real reading (prompt **4,032**/4,400, full **13,869**/14,400).
  ⚠️ **A budget measured on a fixture is a budget on the fixture.**
- **My own tripwire was on the wrong population.** The fetcher's *"zero rejections is not
  reassurance"* warning counted **all** rejections, so six `too small` refusals would have reported a
  dead licence filter as healthy. It counts licence rejections now, and prints
  `licence filter observed refusing 1 file(s) — it is live`.

## 🔴 Two client bugs that each read as a fact about the source

Both would have gone into a summary as a claim about 31,004 files, and both were caught by the
rejection report and the contact sheets rather than by any assertion.

1. **429 storm** — Wikimedia refused **553 of 569** thumbnail requests. Every subject but `hero` came
   back empty. The reading that survives a count-only summary is *"Unsplash has no food, no portraits,
   no workspaces"*.
2. **The drained query list** — a flat "stop at N" let the first query fill every slot, so `hero` was
   twenty near-identical foggy mountains and `food` twenty cups of coffee. 🔴 **Every printed number
   was correct** — 20/20 kept, licences verified, rejections tallied — **and the set was useless.**
   Only the contact sheet said so. This phase's method, applied to its own tooling.

## What is open, with owners

- ⚠️ **VIB-012's one loose end**: AC5 was met by running the *planner* against the real project and
  the real library, with the copy path covered by 12 specs through `copyProjectFilesToFolder`. **A
  full Electron deploy-to-folder was never run end-to-end.** Worth 10 minutes for whoever is next in
  the deploy path. Owner: **VIB-012**, reopened only for that.
- 🔴 **V37 (new, closed): a module's own README prose disabled the pruner.** `manifest.json` says
  *"Reference any file as `noodl_modules/starter-imagery/<name>`"*, and `<name>` is not a filename —
  it tripped refuse-on-ambiguity and would have switched pruning off for every project, silently.
  ⚠️ The first written explanation blamed `LICENCES.json` and was **measurably false** (it contains
  `starter-imagery/` nowhere). **Documentation inside a scanned directory is indistinguishable from a
  reference**, and the fixture now carries the real sentence — before it did, the control spec was
  passing against a mutant.
- 🔴 **V35: the resident MCP tool surface has ONE token of headroom** (8,279 of 8,280). One
  clause added to one tool description reds it; the trim is in. **The next task to touch any tool
  description will fail this gate.** Owner **VIB-007**. Cross-link V20, which recorded 26 tokens.
- 🔴 **V31**: the seven `--shadow-*` tokens are unreachable — no port in 176 node types takes a whole
  box-shadow string. Owner VIB-007.
- ⚠️ **V32**: `catalog:examples` does not run `raw-color-literal`. Owner VIB-007, with V28.
- ⚠️ **V22 is still unruled** and it must be a **render, not a reading**: whether a `For Each` feeds
  item properties into ports never declared decides whether those **14** examples are broken or work
  by another route. **VIB-007's first job.**
- ⚠️ **V27's 58 no-gap containers** still not fixed, deliberately — each needs a render.
- ⚠️ **V29 half open**: `ui-image-scrim-band` now has a picture (V33) but its **one-sided measure is
  still VIB-008's**.

## Gate readings (2026-08-31, on `3e2cffae` + this work, committed `bec68191`)

🔴 **Every row below is an EXIT STATUS.** A crashed `tsc` writes zero `error TS` lines, so a grep over
its log reads `0` and is indistinguishable from a clean pass.

| gate | reading |
|---|---|
| `npm run catalog:examples` | **exit 0** — 66/66 clean, strict, warnings-as-errors |
| `npx jest --config packages/noodl-mcp/jest.config.js` | **exit 0** — 79 suites / **1045** tests |
| `npm run typecheck:editor` | **exit 0** |
| `npm run typecheck:mcp` | **exit 0** |
| `vib004-marketing.look.ts` | **exit 0** — 4/4, four viewports, 62 starter assets written (44 `.webp`), `failed: []`, `unreachablePx: 0` everywhere |
| `npm run typecheck:backend-tests` | ⚠️ **not run — CANNOT complete on this machine.** OOMs at 8 GB, control-proven pre-existing, CI (`pr.yml:39`) covers it. Nothing this task wrote is a `.look.ts` change. **Do not chase it again.** |

✅ **Mutation-checked**: breaking `readImagery` reds `reports the installed stock imagery` and leaves
the **budget** spec green — which is exactly why that control exists. An absent block is a cheap one.

## Standing cautions (unchanged, all still true)

- 🔴 **No proxy closes a task.** If you notice yourself grading JSON, stop and render.
- 🔴 **Legible and operable is the floor, not a grade** (Richard, 2026-08-31).
- 🔴 **Never raise a viewport to make content fit.**
- 🔴 **ASK THE DOOR WHETHER THE KIT ALREADY CAN.** Still four for four.
- 🔴 **A change to `DEFAULT_TOKENS` or `STYLE_COMPOSITIONS` owes the noodl-mcp suite** (V24) — and now
  **so does any change to a tool description or to what is installed in a project** (V34, V35).
- 🔴 **Rebuild the viewer before a Judge run that depends on a runtime change.**
- 🔴 **`render-from-disk` reads tokens BY REGEX** — a comment between `name:` and `value:` deletes a
  token from every Judge photograph.
- ⚠️ Don't re-render into another task's verdict directory. This session's look file writes to
  `verdicts/vib-004/…`; the renders were copied to `verdicts/vib-011/…` and VIB-004's committed PNGs
  restored from git, so its verdict still has the evidence it was written against.
- ⚠️ Shared checkout: P80 finished and ran `dev:stop` mid-session (clean at `3e2cffae`). Commit by
  pathspec, `git add` untracked first, never stash, never `git checkout --` over live work.
- ⚠️ `test:ci` floor is **4, all AIX-006 by name**. Not re-run — nothing this session touched is in it.
