# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## State: **s34 closed SBR-015 — all four ACs. Two tasks in two sessions, and zero rows chased.**

s33's handoff named **SBR-015 AC4's re-read** as the cheapest ✅ on the board and warned against
closing it on s33's incidental sighting. That warning earned its place: the sighting was real, but
it was of a **success** run, and AC4's second sentence asks about **two**.

**`packages/nodegx-backend/tests/sbr015-execution-steps-drive.test.ts` — 10 specs, ~3 s**, two
deployed backends, identical seeds, one variable. **SBR-015 is CLOSED.**

| arm | variable | HTTP | `execution_steps` |
|---|---|---|---|
| **A — control** | `withFlag` declares `out-built` | 200 | **7**, all `success`, incl. the Run Tasks **worker's** two rows |
| **M — mutant** | that declaration removed | **400** `This page could not be published.` | **3** — `prep:success`, **`withFlag:error — The script threw: Outputs.built is not a function`**, `deny:success` |

`tasks`, `page-8` and `res` are **absent** in M and **present** in A. That pair is AC4, literally.

Read in this order:

1. **[SBR-015 §4c and §4d](SBR-015-A-FAILURE-WITH-NOWHERE-TO-GO.md)** — the arms, the three
   failures that refused to fail, and the two instrument traps.
2. **[TASKS.md → s34](TASKS.md)** — the session log, and the one row filed rather than chased.
3. **[D34](DEFECTS-THE-SITE-BUILDER-FOUND.md#d34)** — the row. It does **not** block an AC.

---

## 🔴 THE BOARD — this is the agenda. Build a task.

🔴 **Standing rule, set by Richard 2026-08-30 — read
[`dev-docs/guidelines/PHASE-EXECUTION.md`](../../guidelines/PHASE-EXECUTION.md) first:**

> **A defect becomes the next session's first job ONLY if it blocks an acceptance criterion.**
> Otherwise it is filed with an owner, and **the next session builds the next task.**

**Where the ratchet stands:** s19 → s32 filed 19 rows in 14 sessions and closed one task.
**s33 and s34 filed one row between them and closed two tasks.** Keep that shape.
🔴 **Six tasks have still never been started**, and the phase cannot close until they are.

### 🟢 BUILD THIS: **SBR-012 — the raw-colour gate**

It is the top of s33's own ordering, it is **45 lines and fully scoped**, and it **owns SBR-004's
AC3** — so it closes an acceptance criterion in another task as well as its own four.

**What it is:** a jest gate beside the `sb-007` family that fails on a raw colour anywhere in the
site-builder, over **two populations, always both** — the component sets (`sb004/005/006Components.ts`)
and the **generated artefact** — plus a `var(--x)` resolution check and a named-exemption audit for
non-token dimensions.

🔴 **The task file already names the hole shaped like the defect, and it is the whole design.**
`DiagnosticCode.RawColorLiteral` (`validation/parameterValues.ts:976`, regex `:578`) reads
**colour-typed ports only** — so a hex smuggled through a `*`-typed port, a Script body, or
`applyTheme`'s own literals walks straight past it. The artefact-level scan is therefore **textual,
over parameter values AND script sources**, with the `designTokens`/preset-data blocks as the one
allowed home for literals. ⚠️ **Do not touch the global severity** — the wider corpus carries 553
of these and imported content is not wrong for being untokenised; the gate promotes to FAIL for
**this template's populations only**.

**First concrete step:** open [SBR-012 §2](SBR-012-THE-RAW-COLOUR-GATE.md), then run the textual
scan over the committed artefact **before writing a single assertion**. AC1 needs known-good and
known-broken to **disagree**, demonstrated in the suite — and 🔴 **a new checker's first finding is
about the checker.** Calibrate on HEAD first.

### Then, in order

| | what |
|---|---|
| 2 | **SBR-005** — sections worth having; **owns AC3's gallery model**. The largest unbuilt piece |
| 3 | **SBR-009 / 010 / 011 / 013** — never built. SBR-011 was **ruled BUILD, not strike** |
| 4 | **SBR-003** — owes the `var(--token)` dimension-port probe, and nothing else |
| last | **SBR-014** — re-verifies every person-sentence AC, so it **cannot run until the rest are built** |

### 🔴 The phase's end condition

**SBR-014 is the gate on closing phase 77**, and it re-verifies every person-sentence AC. It cannot
start while six tasks are unbuilt. 🔴 **That is the distance to done — not the length of the
register.**

⚠️ **AC3 of SBR-007 cannot be met at all** — **D15**, no drop-target capability in the runtime for a
file arriving from outside the page (`dataTransfer`, `dragover`, `dragenter`, `DragEvent` all **0**
against a **39**-hit `onClick` control over **369** files), re-measured at HEAD with a boundary
control at s29. **Phase 77 must not close pretending AC3 is met.**

---

## 🔴 What s34 paid for, and would pay again

- 🔴 **RE-READ AN AC'S MECHANISM BEFORE RE-ASSERTING ITS VERDICT.** AC4 sat 🟡 through four
  handoffs on an explanation that was written, correct, and **corrected three times**:
  `execution_steps` mints a step per author `Log` line, and the template ships zero `Log` nodes.
  Phase 80's **DEF-004 replaced that recorder** — a step is now opened by `beginOutcome` and
  `raiseRuntimeError`. Nobody in this phase touched the AC and the AC changed anyway. ✅ **An AC
  parked on "why it cannot" is parked on a claim about the product, and claims expire.**
- 🔴 **THREE NATURAL FAILURES DID NOT FAIL, AND EACH ONE IS A READING.** A `pageId` naming no
  record → **200 `published: true`**, five `success` rows, nothing written (**D34**). An ACL-locked
  Section → publishes fine; **a cloud function is not ACL-bound**. A non-admin → **403 at the
  function gate**, the graph never runs, **no record at all**. ✅ **When no input can cause the
  failure you must observe, say so and mutate — do not weaken the assertion until something
  passes.**
- 🔴 **AN ABSENCE IS ONLY READABLE BESIDE A KNOWN-FIRING SIGNAL, AND THE POPULATION DECIDES WHAT
  IT MEANS.** *"`tasks` has no row"* is equally good evidence for *"it never ran"* and for *"the
  recorder does not cover it"* — opposite fixes. Absences are asserted against **arm A's own
  recorded set**, never the authored node list: a step exists only for **action** invocations, so
  checking against nodes the table can never see would have passed vacuously.
- 🔴 **THE READER READ THE WRONG RUN, AND ONLY AN ARM THAT WROTE NO RECORD EXPOSED IT.** The first
  draft took *"the latest `publishPage` record"*; the non-admin arm writes **none**, so it read
  back the previous arm's row and would have been reported as its own. ✅ **Key a run reader on the
  previous id** — one that cannot tell *no record* from *someone else's record* has the very
  defect SBR-015 is about.
- ✅ **A mutant returns its own edit count, asserted `=== 1`.** A mutation that matched nothing
  leaves the arm identical to the control, and the pair then reads *"the failure was not
  recorded"* when no failure was ever caused.
- ✅ **A peer's row settled for two lines.** Phase 80's `UNOWNED-ROWS-TO-MEASURE.md` §1 asked for a
  forced failure plus a read-back of the stored page — arm M already was one. **`published: false`,
  no `*` ACL rule**; control `true` + `"*": {read: true}`. 🟢 **Disproved at HEAD**, bounded in
  writing to the single `tasks.done → page.store` edge, and written into that peer's file.

---

## Richard's, still small and still unanswered — carried from s26, untouched by s27–s34

**D20's fix moved the actions.** The heading grows as well as shrinks — `layout.ts` assigns
`flexGrow` and `flexShrink` in the same branch, so there is no third option — which puts
`Preview`/`Save page` at the **right** of the header rather than clustered beside the title. Nothing
is clipped at any width; the question is only whether that look is wanted. **Two parameters revert
it** (`sizeMode: 'contentSize'`, drop `width`) at the cost of putting D20 back.

---

## ✅ The instruments — EIGHT, and they answer different questions

🔴 **Pick by what is being asked, not by which one you used last.**

| question | tool |
|---|---|
| does it *lay out* / render correctly | `render-from-disk.js` + `withRenderedPage` (§20, §30) |
| does the thing a person **deploys** work | `deploy-from-disk` + `drive-deployed.js` (§26) |
| does a **cloud function** actually do what it claims | `sb004-publication-invariant.test.ts` (§31) |
| does a **node's port** report what it declares | `d23GeometryDrive.test.ts` (§32) |
| does a **gesture** do what it looks like it does | `ac2DragGestureDrive.test.ts` (§33) |
| does **the shipped page editor** do it, against a real backend | `ac2-page-editor-drag-drive.test.ts` (§34–§35) |
| does **a row action on the shipped admin list** do it | `sbr006-unpublish-drive.test.ts` (SBR-006 §5.14) |
| **what did the backend WRITE DOWN** about a run that went wrong | `sbr015-execution-steps-drive.test.ts` (SBR-015 §4c) |

```
# the execution-record drive — 10 specs, ~3 s, two backends, no fixture needed
cd packages/nodegx-backend && npx jest sbr015-execution-steps-drive --runInBand

# the row-action drive — 14 specs, ~68 s
cd packages/nodegx-backend && npx jest sbr006-unpublish-drive --runInBand

# the shipped-screen drive
cd packages/nodegx-backend && npx jest ac2-page-editor-drag-drive     # 23 specs, ~6 min

# the cloud-function drive
cd packages/nodegx-backend && npx jest sb004-publication-invariant

# the template gate — byte-identity with a fresh generation
npm run template:site-builder && cd packages/noodl-mcp && npx jest sb007Template
```

- 🔴 **Read the stored rows, never the answer** — *and count them.*
- 🔴 **Key any execution-record read on the PREVIOUS run id.** A call refused before the graph runs
  writes no record, and an unkeyed reader hands you the last arm's row as this one's.
- 🔴 **Seed through the product's own door, or write the ACL the product's own door writes.**
- 🔴 **A page in the middle of a write storm refuses the reader too** — read stored rows BEFORE
  opening a writing screen, not only after.
- 🔴 **`buttons: 1` on every `mouseMoved`** or `react-draggable` ignores the move.
- 🔴 **Vary something the store cannot fill back in.** `data: null` is not `undefined`.
- ⚠️ **Count every mutant edit** — `removed:1`, `matched:1`, and the precondition on the keys.
- 🔴 **A new endpoint owes a rule in `site-builder.security.json`** or SB-016's gate refuses a
  public bind.
- ✅ **`--sabotage` wires a connection to a port that does not exist.** If the census does not report
  it dropped, the health filter did not run and **every other reading in that run is void**.
- 🔴 **A headless export's health filter fails OPEN, silently** — `registerModule(project)` first.

## Gates taken at s34

- ✅ **`sbr015-execution-steps-drive` — 10/10**, three times, the last on the committed bytes.
- ✅ **`def004-publish-page-steps` — 5/5**, run beside it: the closest sibling, unmoved.
- ✅ **`sb007Template` — 59/59.** 🔴 **This is the gate s33 deliberately left unread at this HEAD**
  (a peer held D32 work in it all session). It is read now, and **byte-identity holds** after the
  comment correction in `sb004Components.ts` — `npm run template:site-builder` regenerates the
  artefact with **no diff**.
- ⬜ Nothing else run, deliberately: **no product source changed.**

## The register — an APPENDIX, not the agenda

🔴 **Every row below is `BACKLOG` unless it says `BLOCKS <AC>`.** Do not open a session on one of
these while a task is unbuilt.

### 🆕 [D34](DEFECTS-THE-SITE-BUILDER-FOUND.md#d34) — filed by s34, **owner `NONE`**, does NOT block an AC

Publishing a page that no longer exists answers **200 `published: true`**, records **five
`success` steps**, and writes nothing. **Attributed exactly one hop and no further**: the route the
node's own contract names answers `PUT /classes/Page/<no-such-id>` → **404**, so a refusal exists
and is lost between that route and the node. 🔴 **Which hop drops it — the cloud store adapter, or
`SetDbModelProperties`' `error` callback — is NOT established**, and the next reader's first job is
to say which, with the control pair already standing in the drive.

It is the **runtime**, not the template: it fires for any app writing a record by explicit id, so it
belongs beside D25/D26/D27 in **phase 80**. ⚠️ **`D33` was already taken in this register** (the
theme editor's six same-collection writes) — **ids collide across registers; qualify them.**

### The register otherwise

No other row was added, and no open row `BLOCKS` an AC except **D15**.

## Where the phase now stands

🔴 **Re-derived from the task FILES at s34.**

| | verdict |
|---|---|
| **SBR-001 / SBR-002** | ✅ closed s2 / s4 |
| **SBR-003** | 🟡 built, swept, driven — **owed: the `var(--token)` dimension-port probe** |
| **SBR-004** | 🟢 AC1/2/4 driven · AC3 is SBR-012's |
| **SBR-005** | ⬜ **OPEN, never built** — 47 lines — **and it owns AC3's gallery model** |
| **SBR-006** | 🟢 **CLOSED s33 — all five ACs** |
| **SBR-007** | 🟢 AC1 ✅, AC4 ✅, AC5 ✅ · **AC2 ✅ all three halves, on the shipped artefact** · AC3 blocked by D15 alone · D18/D20/D24/D30/D31 ✅ |
| **SBR-008** | ✅ all five, s18 |
| **SBR-009** | ⬜ **OPEN, never built** — 40 lines — the theme editor demos itself |
| **SBR-010** | ⬜ **OPEN, never built** — 35 lines — messages |
| **SBR-011** | ⬜ **OPEN, never built** — 42 lines — live preview; **ruled BUILD, not strike** |
| **SBR-012** | ⬜ **OPEN, never built** — 45 lines — **the next build; it owns SBR-004's AC3** |
| **SBR-013** | ⬜ **OPEN, never built** — 46 lines — the doctrine rule |
| **SBR-014** | ⬜ **OPEN, and LAST** — re-verifies every person-sentence AC |
| **SBR-015** | 🟢 **CLOSED s34 — ALL FOUR ACs.** AC4 driven, two arms, one variable |
| **SBR-016** | ✅ s15, all four ACs |
| **SBR-017** | ✅ s14 · AC1 🟡 half (SBR-016 owned the other half) |
| **D13 / D16** | 🔴 open, `NONE` |
| **D14** | 🟢 fixed s20, DRIVEN s22 — the **browser** deploy path is still exposed and `NONE` |
| **D15** | 🔴 **`BLOCKS` SBR-007 AC3** · `NONE` — no drop target for a FILE. Stands at HEAD |
| **D17 / D18 / D21** | 🟢 fixed and driven (s21/s24/s25) |
| **D19** | 🟢 reds fixed s23 — 🔴 **`test:main` watched is still `NONE`** |
| **D20** | 🟢 FIXED + DRIVEN s26; **the appearance half is Richard's** |
| **D22** | 🔴 `NONE` — no `textOverflow` port on `Text` |
| **D23** | 🟢 DISPROVED s29, kept |
| **D24** | 🟢 FIXED + GATED s28 |
| **D25 / D26 / D27** | 🔴 `NONE` — all three registered in phase 80 |
| **D28** | 🟢 FIXED by a peer as phase 80 `DEF-027` during s32 |
| **D29** | 🔴 `NONE` — one-way gate latches; a peer's row, from phase 80 s21 |
| **D30 / D31** | 🟢 FIXED + DRIVEN s32 |
| **D32** | 🟢 FIXED by a peer during s33 as phase 80 `DEF-032` (`ff6183cd`) |
| **D33** | 🔴 `NONE` — six same-collection writes on the theme editor, **a candidate list, not a confirmed defect** |
| **D34** | 🆕 🔴 `NONE` — publish of a missing page answers 200; **runtime, belongs in phase 80** |

## Standing context

- ✅ **The template is generated, not authored.** Edit
  `packages/noodl-mcp/tests/sb00{4,5,6}Components.ts`, then `npm run template:site-builder`.
  `sb007Template.test.ts` asserts the committed artefact is byte-identical to a fresh generation.
  ⚠️ **Census literals live in FIVE files.** **s34 changed one comment in `sb004Components.ts`**
  (it claimed AC4's log gap still existed) and the regenerated artefact has **no diff**.
- 🔴 **`SECTION_SORT` lives in `sb005Components.ts`** and `sb006Components.ts` re-exports it. Do not
  reintroduce a second copy.
- ✅ **`sbr015-execution-steps-drive` needs no fixture, no running backend and no browser** — it
  authors through the real MCP door, deploys **two** backends on ephemeral ports, seeds both
  identically and tears them down. Prefer it as the pattern for any question about what the backend
  *recorded*, and `sbr006-unpublish-drive` for any question about a **row action**.
- ✅ **Older fixture, still on disk if wanted: `SBR-007 Page Editor Drive`**, backend
  `backend_mterfnli74qwv`, port **8601**, `SITE_SETUP_TOKEN=drive-token-007`,
  `owner@sbr007.test` / `drive-pass-007`. 🔴 **Drive a COPY.** ⚠️ Its `Section` table is EMPTY.
- ✅ **The setup token is a file, not a UI step**: `~/.noodl/backends/<id>/secrets.json`, `functions`
  namespace. `SecretsStore` re-reads on every call, so no restart.
- 🔴 **A node's port description lives in FOUR generated copies.** Changing one owes
  `catalog:generate` → `catalog:merge` → `docs:nodes` **and** `cloud-library:generate`.
- 🔴 **A source change is not a drive until the bundle carries it** — the viewer
  (`external/viewer/noodl.viewer.js`), the deploy runtime (`external/deploy/noodl.deploy.js`, a
  *different file*), and `nodegx-backend/dist`. **A template change is different** — project data,
  read from disk every boot, so no rebuild. **s34 changed no product source**, so no bundle is stale.
- ⚠️ **Peers were active in the shared checkout throughout s34** — phase-18 export work and a
  border sweep in `noodl-core-ui`/`noodl-editor`. s34's commit used **pathspecs naming only its own
  files**, and the one peer file it edited (phase 80's `UNOWNED-ROWS-TO-MEASURE.md`) was
  **committed and unmodified** when the edit was made — checked, not assumed.
- Shared checkout: **pathspec commits only, never `git add` to stage** (except to make an untracked
  file committable); `git status --porcelain | grep '^??'` before committing. Announce editor
  launches **and** teardowns. `test:ci` alone.
- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
