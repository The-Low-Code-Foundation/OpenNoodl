# Phase 80 — next session

🟢 **PHASE 80 IS COMPLETE. All 38 rows are ✅.** Session 41 closed the last two of the original 37 on
Richard's rulings. **Session 42 (2026-09-03) added a 38th and closed it**: DEF-038, promoted out of
[UNOWNED-ROWS-TO-MEASURE.md §10](UNOWNED-ROWS-TO-MEASURE.md) — a row that had been measured on
2026-08-31 and left unowned.

🔴 **A closed phase is not a sealed one.** §10 sat measured-and-unowned for three days beside a
banner saying the phase was done. **Nine of that file's ten rows are still unowned**, and the same
is true of every one of them.

🔴 **The next session's first job is NOT in this phase** — the board has nothing open. It is to pick
up another phase's board (**P82** and **P81** are the current ones), or one of the nine remaining
unowned rows. ⚠️ **Next free id is now `DEF-039`.**

---

## What session 42 did — DEF-038

**The row:** DEF-007 §3.2 settled the site builder's generator (`toTemplateContent`) against
NDA-017's load-time migration and gated it in `sb007Template.test.ts`. `prepareArtefact` — TPL-001,
the members' area — was never touched, and its shipped artefact disagreed with its own editor load
in **57 stored parameters**. A person who installs it and opens it loses load-time fetches, having
changed nothing.

**Re-measured at HEAD before building** (the row was three days old): still **57 writes / 107 family
nodes**, control still **0 / 97**. `familyNodes` had moved 105 → 107; `writes` had not.

**Built:** `pinRunOnValueChangeDefaultsInDirectory` in a new `templateArtefact.ts`, one call in
`prepareArtefact`, artefact regenerated (57 insertions, 0 deletions, nothing else moved), and a gate
that **derives** its population across both generators rather than listing them. 2 mutants, each
killed by its own arm; the second regenerates an artefact byte-identical to pre-fix HEAD, which is
what proves the fix is in the generator.

🔴 **Two things worth carrying, neither about this row:**

1. **`Tests: 0 total` from a peer's half-saved file.** The gate's first run died on `FIELD is not
   defined` in `sb006Components.ts` — a lane with nothing to do with this one — because
   `readAsLegacyProject` lived in a module that imports the whole site-builder authoring surface at
   module scope. **The extraction into `templateArtefact.ts` is part of the fix**, and it was proved
   by the gate then running green while that file was still broken.
2. **The known hole is stated rather than closed.** A third template written as a `.ts` module (like
   `hello-world.template.ts`) escapes the derived sweep. It has no family nodes today, so there is
   nothing to settle — but the sweep would not say so if there were.

Read [DEF-038](DEF-038-THE-OTHER-GENERATOR-DISAGREES.md) §*Bounds*, not this summary.

---

## The board

**38 rows. 38 ✅.**

🔴 **Derive it from the STATUS COLUMN, never `grep -av '✅'`** (a ✅ in prose filters the row out):

```
grep -aE '^\| DEF-0[0-9]{2} \|' TASKS.md | awk -F'|' '{gsub(/^ +| +$/,"",$3); print ($3 ~ /^✅/) ? "done" : "open"}' | sort | uniq -c
```

🔴 **Closed is not fully measured, and a closing session is exactly when that gets forgotten.**
The boundaries below outlive the phase. **Say them whenever you quote a row.**

---

## What session 41 did

### 1. DEF-036 — closed on a ruling, with nothing built

🧭 **Richard ruled part 3 means THE CANVAS.** His sentence — *"it would remain … but be a dotted
line, and the errors would flag that the port doesn't exist anymore"* — describes three things
that **already ship**, measured at HEAD in s38 and driven in a real editor in s39. The only other
reading was *"and it should survive the export too"*, which reverses DEF-034.

**Nothing was built. DEF-034 stands. The 271 wires still leave the build, by design.** See
[DEF-036 §10](DEF-036-THE-USER-FAMILY-HAS-NO-NET.md) and
[RICHARD-RULINGS-2026-08-31.md](RICHARD-RULINGS-2026-08-31.md) §6.

### 2. DEF-007 AC2 — closed on a drive, and the blocker was a wrong assumption

🧭 **Richard ruled: publish one now, then drive it.**

🔴 **The thing that had blocked AC2 since s38 was not true.** The row said *"the picker cannot
reach a curated template until one is published"*, and publishing was assumed to need a signed-in
session on the live `community.nodegx.io`. It does not. The shelf is served by `nodegx-community`,
which **runs locally**, and publishing a curated template is a **database-credential act** —
`scripts/publish-project-template.ts`. `0021`'s own header says it: *"Share as template files a
SUBMISSION. It does not publish."*

**So the whole path was driven locally, over a real socket, against the real route handlers, and
nothing was published to the live service.** Full account in
[DEF-007 §8](DEF-007-DISK-AND-LOAD-DISAGREE.md).

| AC2 | reading |
| --- | --- |
| the picker | drew **`DEF-007 Home Check` … `Starter` … `Community`** beside the two built-ins |
| install | real install through the wizard to `def007-ac2-drive` |
| **the result** | `rootNode.id` = the published id; **`activeComponent` = `App`** |

🔴 **The control is what makes that a measurement.** `App` is **index 3 of 4** and alphabetically
last in the fixture — chosen for exactly that reason, because on a one-component template
*"opened on the home"* and *"opened on the first component"* give the same answer and a pass
proves nothing. The identical template with **only `rootNodeId` deleted** lands on
`/#__page__/Acme Legal Client Portal`, **index 0**.

### 3. A stale number in shipped source, corrected in TWO files

A peer flagged that `applypatches.js:5`'s *"differ in **56 stored parameters**"* is false at HEAD.
**Verified independently before acting on it** — `writes: 0, familyNodes: 82, signalDrivenNodes:
40, preserved: 91`. ✅ **The 82 and the 91 are the known-firing signals that make the 0 a measured
absence rather than a dead read.**

⚠️ **The peer knew about one file; the number was in two.** `projectLoadSeam.ts:14` carried
*"56 writes across 13 components"* as well. Both now state the figure is zero **and why a zero
does not mean the seam closed** — s31 made `toTemplateContent` state the values itself, so
site-builder stopped exercising it; any template that leaves a governed input unstated still
differs.

---

## 🔴 Owed on rows marked ✅ — say this before quoting them

- **DEF-036 §10's four boundaries.** AC5's **rendering** half is graded **by rule only** (no
  reachable `_User` table; `TableRow.tsx` imports `Icon`, so a spec importing it fails *to run*) —
  whether the rename affordance disappears is **unmeasured**. `SignUp` was **never the node
  driven**. **No external-backend arm was driven.** AC4's `status:'schema'` arm used an
  **injected** outcome, so it grades the panel wiring, not the fetch.
- **DEF-007's wiring is graded by the DRIVE ALONE** — `EditorClipboard` cannot be imported under
  this jest (`bugtracker.ts` calls `platform.getUserDataPath()` at module scope).
- **DEF-007: the publish refusal was never driven through the real share UI.**
- **DEF-007 AC4's scan cannot see a reader that never constructs a `ProjectModel`** — code export,
  the MCP server, template generation.
- **DEF-037's deployed-app arm is untested end to end**; `borderColor` on Checkbox and Radio
  Button were not driven.
- ⬜ **DEF-031's and DEF-029's panel halves** both still need the property panel read out of the
  DOM. ✅ `cdp click` takes a SELECTOR — stamp an id first.
- ⬜ **DEF-005's `Roles` output has still not been driven** in a real editor.

---

## Gates — final reading at `138374f4`

| gate | result | exit |
| --- | --- | --- |
| `npx jest` in `packages/noodl-editor` | **6596 passed, 5 failed** | 1 |
| `npx tsc --noEmit -p packages/noodl-editor` | **0 `error TS`** | 0 |

**The 5 are `sb-007` (2), `sb-018` (2), `aib-007` (1) — the floor exactly, somebody else's open
work. Do not read them as this phase's and do not "fix" them.**

### 🔴 The floor moved to 7 mid-session and came back — the episode is worth more than the number

The first run read **7 failed**, the two extra being `def-003/threeAuthoringActs.test.ts`, from
**`03c327c8` (P81 VIB-007 AC2 tail)** — committed at 21:47, *after* s40's reading at `ac28160d`
(21:11). The failing row was `expect(one('Group', { paddingLeft: 24 })).toEqual([])`, newly getting
a `raw-spacing-literal` warning, and that row exists to prevent precisely that widening: *"Without
this row the rule could be widened to every units port and still pass."*

**Reported to the P81 session with the measurement rather than fixed here** — their row, and it
blocked no AC of ours. They fixed it in `c83eb13b` / `138374f4`, and **the 5-failure floor above is
this session re-running the suite to check that claim, not a relay of theirs.**

⚠️ **Their fix changed the assertion, not only the rule**, and the change is worth knowing about:
`one()` is unfiltered, so `toEqual([])` was demanding silence *from every rule at once*. Both rows
now assert the **set of codes**, which still trips when a fourth rule speaks — but a future session
reading def-003 should know its control rows changed shape.

🔴 **Two traps came out of this, and they are the durable part.**
1. **`validation/` was CLEAN in the working tree**, so "is this red mine?" answered by `git status`
   said no. It was in **HEAD**. ✅ **`git log -- <path>`, and compare the commit time to the last
   known-good gate reading.**
2. **A peer priced the new rule's noise off the node corpus, which is 401/402 tokenised** — the most
   tokenised artefact set that exists, and therefore the wrong population for *"how often does this
   fire on ordinary work"*. Same shape as [[rank-by-the-product-surface-not-by-a-corpus]].

⚠️ `typecheck:backend-tests` cannot complete on this box (OOM, exit 134, **zero `error TS` lines —
it reads as a pass**). CI runs it.

---

## Two new unowned rows — and row 10 is already MEASURED

🔴 **A curated template with NO home publishes, lists, installs and opens — silently.** Found while
building AC2's control, so it is **measured, not read**. [Row 9](UNOWNED-ROWS-TO-MEASURE.md).

**Two doors are both called "publish" and only one is gated:**

| door | home gate? |
| --- | --- |
| `shareAsTemplate.ts:342-390` — a **person** sharing from the editor | ✅ refuses, built s38 on Richard's ruling |
| `nodegx-community/scripts/publish-project-template.ts` — a **curator** with a DB credential | 🔴 **none** |

No install-side rescue either: `Project created successfully`, no toast, and the person lands on a
**page-scoped internal component**. ✅ The rescue exists one package away —
`noodl-preview/src/loader.ts:131-156` `resolveRootNode` guesses **and says it guessed**.

⚠️ **Do not just add the predicate.** §2.1's warning stands: 63 of 340 manifests have no home and
most are **modules**, which have none by design. And only the *person's* door has been ruled on —
refuse-at-publish vs warn-at-install is 🧭 **a decision**, not a coin flip.

---

### 🔴 Row 10 — the OTHER template generator disagrees, and it is **57**, not zero

Raised by a peer as an orphan of closing DEF-007: §3.2's ⚠️ that `tpl001Template.ts` was never
measured for the same seam would be lost inside a ✅ row. **They were right that it needed a home,
and wrong that it might be zero** — so it was measured rather than registered as a question.

| artefact | `writes` | `familyNodes` |
| --- | --- | --- |
| **`templates/members-area` (TPL-001)** | **57** | **105** |
| `site-builder.content.json` (control) | **0** | **82** |

Same function, two inputs, and **both arms have a non-zero `familyNodes`** — which is what makes
the 0 an absence and the 57 a presence rather than two readings of a dead instrument. Read through
the editor's own reader (`readAsLegacyProject` → `ProjectImporter`, pure plain-node).

⚠️ **This does not make DEF-007 AC3's green wrong — it makes its SCOPE explicit.** AC3 is genuinely
0 and its gate covers **site-builder only**; TPL-001 is a second artefact the gate never looks at.
🔴 Which is the same decaying-hand-list shape AC4 exists to prevent. **Gate any fix across both
generators**, or this recurs with a third template.

## The harness this session added

### Running the community platform locally — this is the reusable part

```bash
cd ~/vscode_projects/nodegx-community
npm run db:up                       # docker postgres on 55432 — NOT 5432
export DATABASE_URL='postgres://nodegx:nodegx@127.0.0.1:55432/nodegx_p80_s41'
npm run dev                         # localhost:3000
```

- ✅ **`nodegx_p80_s41` already exists and is migrated** (24 migrations, 57 tables). It was created
  **beside** the existing `nodegx_community`, which had all its tables but an **empty
  `schema_migrations`** — an unknown state that was left untouched rather than repaired.
- ⚠️ **The container is still running.** `npm run db:down` was refused by the permission classifier,
  so it was left up rather than worked around. Stop it if you want the box as it was.
- 🔴 **`COMMUNITY_URL` is a hardcoded constant with no env override**, and
  `uni-001/composer-offers-signin.test.ts` asserts its exact literal. Editing it is the only way to
  point the editor at a local platform. ✅ **`cp` the file to a scratchpad first and restore by
  `cp`** — verified by md5 and an empty `git diff`, because an unstaged edit to a tracked file on
  this shared checkout is precisely what a peer's pathspec commit sweeps.
- The two published templates and both fixtures are still there: `def007-curated-src` (home),
  `def007-nohome-src` (control), `def007-ac2-drive`, `def007-nohome-drive`.

### Driving the launcher's create wizard

- The wizard is **four steps**: mode → Project Basics (name) → Choose a Template → Review →
  `Create Project`. The gallery is **not** the first screen after picking "Start from a Template".
- ✅ **Cards are `[class*=TemplateCard--]`** and select on click, confirmed by a `--selected` class
  landing on the same element.
- ⚠️ **A `cdp eval` that throws can dismiss the modal**, losing the whole flow. Stamp an id, assert
  it exists, *then* click — and re-read the modal text after each step rather than assuming.
- ✅ **Settle which project the editor ended up on by `_retainedProjectDirectory`**, and read the
  landing component from `NodeGraphContextTmp.nodeGraph.activeComponent` — never from body text.
- ⚠️ A project installed from a template is saved as **v2** — read `nodegx.project.json`, not
  `project.json`.

---

## Traps this session added

- 🔴 **A BLOCKER CAN BE AN ASSUMPTION THAT NOBODY RE-DERIVED.** AC2 sat parked for three sessions
  on *"needs a signed-in community session and a live route"*. Neither was true: publishing is a
  **DB credential**, and the platform **runs locally**. The row had been re-quoted several times
  and the sentence was never re-measured. ✅ **Before accepting "blocked", ask what the block is
  made of and go and look at that thing** — one `find` in a sibling repo answered it.
- 🔴 **A ONE-COMPONENT FIXTURE CANNOT GRADE "OPENS ON ITS HOME".** With one component, *the home*
  and *the first component* are the same element, and the test passes on a build that resolves
  neither. ✅ **Choose the fixture so the two candidate explanations give DIFFERENT answers** —
  here, home at index 3 of 4 and alphabetically last — **then vary only the field under test.**
- 🔴 **THE CONTROL IS WHERE THE FINDING WAS.** The no-home arm existed only to make AC2 honest, and
  it is what exposed row 9. A control run to protect a positive reading is a second experiment,
  and it is worth looking at what it says on its own terms.
- 🔴 **VERIFY A PEER'S CORRECTION, THEN CHECK ITS SCOPE.** The relayed claim was true — and named
  one file when the number lived in two. ✅ **`grep` for the value, not for the file you were
  pointed at.**
- 🔴 **A MEASURED ZERO NEEDS A KNOWN-FIRING SIGNAL BESIDE IT.** `writes: 0` alone is
  indistinguishable from an instrument that found nothing; `familyNodes: 82` is what makes it an
  absence. Both docblocks now quote them together, and say so.
- 🔴 **CLEAN-IN-THE-TREE ANSWERED "IS THIS RED MINE?" WITH A CONFIDENT NO.** `validation/` had no
  uncommitted changes; the regression was **committed** 36 minutes before the gate ran.
  ✅ **`git log -- <path>`, and compare the commit time against the last known-good reading.**
