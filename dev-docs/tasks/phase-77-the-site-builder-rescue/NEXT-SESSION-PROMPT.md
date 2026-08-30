# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## State: **s33 closed SBR-006. A task went green, and no product source was touched to do it.**

s32 handed over a board rather than a defect register, and the top row was
**SBR-006 AC3's `Unpublish`, never clicked**. It is clicked now.
**`packages/nodegx-backend/tests/sbr006-unpublish-drive.test.ts` — 14 specs, all green, 67.9 s**, on
the whole template authored through the real MCP server, deployed with enforcement ON, and driven
in headless Chrome through the template's own sign-in form. **SBR-006 is CLOSED, all five ACs.**

Read in this order:

1. **[SBR-006 §5.14](SBR-006-THE-ADMIN-SHELL.md)** — the sequence, the mutant, and the three things
   that were not obvious.
2. **[TASKS.md → s33](TASKS.md)** — the session log entry, and the one reading handed on rather
   than acted on.
3. The register is **unchanged by this session** — no new defect row was filed, because none was
   found. That is the point of the entry, not an omission.

---

## 🔴 THE BOARD — this is the agenda. Build a task.

🔴 **Standing rule, set by Richard 2026-08-30 — read
[`dev-docs/guidelines/PHASE-EXECUTION.md`](../../guidelines/PHASE-EXECUTION.md) before doing
anything else:**

> **A defect becomes the next session's first job ONLY if it blocks an acceptance criterion.**
> Otherwise it is filed with an owner, and **the next session builds the next task.**

**Where the ratchet stands:** s19 → s32 filed 19 defect rows in 14 sessions and closed one task.
**s33 filed zero rows and closed one task.** That is the shape the rule is asking for; keep it.
🔴 **Seven tasks have still never been started.**

### 🟢 BUILD THIS: **SBR-015 AC4 — the re-read**

It is a **reading, not a build**, and it is the cheapest ✅ left on the board. AC4 was recorded 🟡
because `execution_steps` held **0 rows**. It does not any more, and s33 has a direct sighting of it:
**six** steps on every `publishPage` run, each named and each `success` —

```
JavaScriptFunction · JavaScriptFunction · RunTasks · SetDbModelProperties · SetDbModelProperties · noodl.cloud.response
```

✅ **AC4's literal wording is met by that reading, and its text was checked rather than assumed:**

> *"`execution_steps` either records cloud-function nodes or the task says why it cannot."*
> ⚠️ *"Smaller than it reads… This AC is about **graph** nodes being recorded, not about building a
> recorder."*

So the AC asks for **graph nodes named in the table** — which is exactly what the six steps above
are. 🔴 **It is NOT about a failure path** (a first draft of this handoff said it was, and that was
wrong — the task file says the opposite in as many words). ⚠️ **It also warns you off a trap in
advance**: *"do not expect `executions.sqlite` to name the failing node… the template has no `Log`
nodes. The fix's own Response is the readout, not the log."*

**First concrete step:** open [SBR-015 §4](SBR-015-A-FAILURE-WITH-NOWHERE-TO-GO.md), read AC4
alongside s33's reading, and either close it or write down precisely which clause is still short.
🔴 **Take the reading inside SBR-015's own instrument rather than citing s33's** — a criterion
closed on another task's incidental sighting is the pattern this phase keeps paying for.

### Then, in order

| | what |
|---|---|
| 2 | **SBR-012** — the raw-colour gate. ⚠️ **It owns SBR-004's AC3**, so it closes an AC in another task too |
| 3 | **SBR-005** — sections worth having; **owns AC3's gallery model**. The largest unbuilt piece |
| 4 | **SBR-009 / 010 / 011 / 013** — never built. SBR-011 was **ruled BUILD, not strike** |
| 5 | **SBR-003** — still owes the `var(--token)` dimension-port probe, and nothing else |
| last | **SBR-014** — re-verifies every person-sentence AC, so it **cannot run until the rest are built** |

### 🔴 The phase's end condition

**SBR-014 is the gate on closing phase 77**, and it re-verifies every person-sentence AC. It cannot
start while six tasks are unbuilt. 🔴 **That is the distance to done — not the length of the defect
register.**

⚠️ **AC3 of SBR-007 cannot be met at all** — **D15**, no drop-target capability in the runtime for a
file arriving from outside the page (`dataTransfer`, `dragover`, `dragenter`, `DragEvent` all **0**
against a **39**-hit `onClick` control over **369** files), re-measured at HEAD with a boundary
control at s29. **Phase 77 must not close pretending AC3 is met.**

---

## 🔴 What s33 paid for, and would pay again

- 🔴 **The ORDER of the acts was the measurement, not ceremony.** The stored row starts
  `published: false` — so a drive that clicked `Unpublish` on a fresh draft and read `false` would
  have passed **on a button wired to nothing**. The reading it wants is the state the row was
  already in. Publishing first, *through the same menu*, is what puts a known-firing `true` there.
  ✅ **Before asserting a value, ask what the assertion would read if the mechanism did nothing.**
- 🔴 **A same-endpoint sibling still had to be clicked, and the gap had a shape.**
  `sb004-publication-invariant` has driven `publishPage`'s unpublish direction over HTTP for many
  sessions, which makes *"s22 covered it by proxy"* very tempting. But **`in-publish: false` is a
  constant on the node, not a value on a wire** — a `CloudFunction2` that never carried it would
  call the same endpoint, answer **200**, record `success`, and **publish the page again**, with the
  pill then saying the opposite of what was asked for. ✅ **Ask what the failure would LOOK like
  before deciding an existing spec already covers a sibling.**
- 🔴 **The first run went 13/14 and the red was the SEED, not the product.** The seeded page
  answered **200 to an anonymous reader before anything was published** — which fits a serious
  defect exactly, because `canAccessRecord` really does read an **absent** ACL as public
  (`model.ts:701-718`), and `sb004Components.ts` carries a 🔴 comment saying so. It is **not** that:
  `/Pages/Admin`'s `create` node — the template's own `New page` path — writes `ADMIN_ONLY_RULES`,
  so a page a **person** creates is born admin-only. The drive's seed had reached past the
  template's own door with a raw `POST /classes/Page`. ✅ **A seed that bypasses the product's own
  creation path is not a fixture, it is a second product** — and what excluded the defect reading
  was going and reading the create node, not the other thirteen greens.
- 🔴 **A mutant wire must be named by BOTH ends here.** SBR-007's `dropWire` matches on the
  properties alone, and `(onClick, call)` names **three** wires in `Admin/PageRow` — publish,
  unpublish and duplicate. Its own `removed:1` would have caught that loudly, but only after a
  wasted run; `dropWireById` in the new file cannot reach it.
- ⚠️ **`| tail -N` on a backgrounded run throws away the evidence.** Two runs' console readings were
  lost to it before the third was captured whole. The log lines a drive prints are the record; do
  not pipe them through a truncating tail.

---

## Richard's, still small and still unanswered — carried from s26, untouched by s27–s33

**D20's fix moved the actions.** The heading grows as well as shrinks — `layout.ts` assigns
`flexGrow` and `flexShrink` in the same branch, so there is no third option — which puts
`Preview`/`Save page` at the **right** of the header rather than clustered beside the title. Nothing
is clipped at any width; the question is only whether that look is wanted. **Two parameters revert
it** (`sizeMode: 'contentSize'`, drop `width`) at the cost of putting D20 back.

---

## ✅ The instruments — SEVEN, and they answer different questions

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

```
# the row-action drive — 14 specs, ~68 s, seeds its own backend, no fixture needed
cd packages/nodegx-backend && npx jest sbr006-unpublish-drive --runInBand

# the shipped-screen drive
cd packages/nodegx-backend && npx jest ac2-page-editor-drag-drive     # 23 specs, ~6 min

# the gesture-mechanism drive
cd packages/noodl-mcp && npx jest ac2DragGestureDrive

# the cloud-function drive
cd packages/nodegx-backend && npx jest sb004-publication-invariant

# the template gate — byte-identity with a fresh generation
npm run template:site-builder && cd packages/noodl-mcp && npx jest sb007Template
```

- 🔴 **Read the stored rows, never the answer** — *and count them.*
- 🔴 **Seed through the product's own door, or write the ACL the product's own door writes.**
  s33 §5.14.4 is what that rule costs when it is skipped.
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

## Gates taken at s33

- ✅ **`sbr006-unpublish-drive` — 14/14, 67.9 s**, three times (13/14 on the first, seed fixed, then
  twice green; the last on the committed bytes).
- ⬜ **Nothing else was run, deliberately.** **This session changed no product source** — the only
  delta is one new spec file — so no existing suite could have moved. 🔴 **And `sb007Template` was
  NOT run on purpose**: a peer held uncommitted D32 work in it all session (since landed as
  `ff6183cd`), so any reading would have been about their in-flight edit rather than anything here.
  ⚠️ **That gate is therefore UNREAD at this HEAD by this session** — if you need it, run it fresh.

## The register — an APPENDIX, not the agenda

🔴 **Every row below is `BACKLOG` unless it says `BLOCKS <AC>`.** Do not open a session on one of
these while a task is unbuilt.

### 🟢 [D32](DEFECTS-THE-SITE-BUILDER-FOUND.md#d32) — **FIXED by a peer during s33.** Off the board.

`sb007Template`'s `gradeMountTriggered` examined **1 of 65** of the migration's writes, which is how
D31 shipped past a suite that already knew about the migration. A peer fixed it in parallel with
this session and landed it as **`ff6183cd` — `fix(p80/def-032)`**, touching
`packages/noodl-mcp/tests/sb007Template.test.ts` (+294) plus phase 80's own register. ✅ **Verified
from `git log`, not from the working tree** — s33 first recorded it as an uncommitted-edit sighting
and then re-checked once the commit landed.

⚠️ **Note the register it moved to: it is `DEF-032` in PHASE 80**, not a phase-77 row any more.
🔴 **IDs collide across registers — qualify them.** ✅ The lesson survives the fix:
**count what a checker REACHED, not just what it flagged.**

### The register otherwise

No row was added by s33, and no open row `BLOCKS` an AC except **D15**.

## Where the phase now stands

🔴 **Re-derived from the task FILES at s33.**

| | verdict |
|---|---|
| **SBR-001 / SBR-002** | ✅ closed s2 / s4 |
| **SBR-003** | 🟡 built, swept, driven — **owed: the `var(--token)` dimension-port probe** |
| **SBR-004** | 🟢 AC1/2/4 driven · AC3 is SBR-012's |
| **SBR-005** | ⬜ **OPEN, never built** — **and it owns AC3's gallery model** |
| **SBR-006** | 🟢 **CLOSED s33 — ALL FIVE ACs.** AC3's three actions all clicked: Publish + Duplicate (s22), **Unpublish (s33)** |
| **SBR-007** | 🟢 AC1 ✅, AC4 ✅, AC5 ✅ · **AC2 ✅ ALL THREE HALVES AND ON THE SHIPPED ARTEFACT** (s27/s30/s31/s32) · AC3 blocked by D15 alone · D18/D20/D24/D30/D31 ✅ |
| **SBR-008** | ✅ all five, s18 |
| **SBR-009** | ⬜ **OPEN, never built** — the theme editor demos itself |
| **SBR-010** | ⬜ **OPEN, never built** — messages |
| **SBR-011** | ⬜ **OPEN, never built** — live preview; **ruled BUILD, not strike** |
| **SBR-012** | ⬜ **OPEN, never built** — the raw-colour gate; **it owns SBR-004's AC3** |
| **SBR-013** | ⬜ **OPEN, never built** — the doctrine rule |
| **SBR-014** | ⬜ **OPEN, and LAST** — re-verifies every person-sentence AC |
| **SBR-015** | AC1/2/3 ✅ s13 · **AC4 🟡 — the re-read is the next job, and it looks like a CLOSE.** AC4 asks for **graph nodes recorded**; s33 read six, each named |
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
| **D29** | 🔴 `NONE` — one-way gate latches; **a peer's row**, from phase 80 s21 |
| **D30 / D31** | 🟢 FIXED + DRIVEN s32 |
| **D32** | 🟢 **FIXED by a peer during s33 as phase 80 `DEF-032` (`ff6183cd`)** — `sb007Template`'s reach, 1 of 65 |

## Standing context

- ✅ **The template is generated, not authored.** Edit
  `packages/noodl-mcp/tests/sb00{4,5,6}Components.ts`, then `npm run template:site-builder`.
  `sb007Template.test.ts` asserts the committed artefact is byte-identical to a fresh generation.
  ⚠️ **Census literals live in FIVE files.** **s33 changed none of this** — it added a spec only.
- 🔴 **`SECTION_SORT` lives in `sb005Components.ts`** and `sb006Components.ts` re-exports it. Do not
  reintroduce a second copy.
- ✅ **`sbr006-unpublish-drive` needs no fixture and no running backend** — it authors, deploys and
  seeds its own, on an ephemeral port, and tears it all down. Prefer it as the pattern for driving a
  row action over reusing the manual `SBR-007 Page Editor Drive` backend.
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
  read from disk every boot, so no rebuild. **s33 changed no product source**, so no bundle is stale.
- ⚠️ **Peers were active in the shared checkout throughout s33** — D32 in `noodl-mcp`, a border
  sweep in `noodl-core-ui`/`noodl-editor`, and phase-18 export work that was committed mid-session.
  s33's commit used **pathspecs naming only its own files**.
- Shared checkout: **pathspec commits only, never `git add` to stage** (except to make an untracked
  file committable); `git status --porcelain | grep '^??'` before committing. Announce editor
  launches **and** teardowns. `test:ci` alone.
- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
