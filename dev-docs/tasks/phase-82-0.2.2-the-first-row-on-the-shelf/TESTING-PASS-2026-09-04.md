# The testing pass — 2026-09-04

_Richard drove a pre-0.2.2 build and reported nineteen things in a single afternoon, in the order he
hit them. This file is the register: what each one was, what happened to it, and **who owns what is
left**. Nine were fixed the same day; the rest are rows._

🔴 **This file exists so nothing here is rediscovered at full price.** Every unfixed finding below
carries an owner or the literal word `NONE`. A row with no owner is a row somebody pays for twice.

⚠️ **Read a row's FINDINGS, not its status.** Three of these were reported as one thing and turned
out to be another, and two were found by reading the *sibling* of something reported.

---

## §1 Fixed in the same session

All nine are in the working tree, **not committed**. Each was measured twice — the gate green on the
fix, and the same gate red against a reverted arm — because a reading that fits is not a reading
that excludes.

| # | what he hit | what it actually was | readings |
|---|---|---|---|
| 1 | Visual Function errored on its own default | `done` is on `RESERVED_OUTPUTS`; both signal blocks defaulted to it. Now `Output1`, **shared** by define and send so an all-defaults program runs | gate 7/7 `EXIT=0`; reverted `EXIT=1`, 2 specs |
| 2 | the error persisted after he fixed the program | the runtime error bus **raises and never withdraws**; only a viewer reconnect cleared it. A good run now withdraws what is no longer true | 7/7 `EXIT=0`; reverted `EXIT=1`, 3 specs; 496 tests; `tsc` 0 |
| 3 | checkbox would not visually uncheck | the **author's** icon had no `checked` gate at all — FB-020 gated the built-in tick and left this path open | 21/21 `EXIT=0`; reverted `EXIT=1`, 3 specs |
| 4 | — *(not reported)* | **Radio Button had the identical defect**: an author icon drew on every option in the group at once. Found by reading the checkbox's sibling | same suite |
| 5 | "Open project folder" did nothing | it revealed `<dir>/project.json`, which **v2 projects do not have** — the manifest is `nodegx.project.json` and migration deletes the legacy file. `showItemInFolder` is a silent no-op on a missing path | `tsc` 0 |
| 6 | workbench dropdown missed a new component | `getComponents()` returns the **live array** and `addComponent` pushes in place, so React's `Object.is` bail-out discarded every re-read. Reopening worked because a new project model is a new array | ⚠️ **NOT GATED** — see §3 |
| 7 | every icon was white | one shared default fed Icon, Checkbox, Radio and Button. Now black. Text Input and Select had already set black by hand — the same judgement reached one node at a time | 11/11 `EXIT=0`; reverted `EXIT=1`, 3 inheriting nodes; 1156 viewer tests |
| 8 | *(his ruling)* Button icon = label colour | Button is the one node where **no constant works**: `primary` is a filled ground, `outline`/`ghost` are transparent with dark text and were **already invisible**. Ships no default, inherits | 11/11 `EXIT=0`; reverted `EXIT=1` |
| 9 | Hello World and Site Builder in the create modal | both now **held** — registered, not offered | 278 tests, 9 suites; near-miss reintroduced → `EXIT=1` |

### 🔴 §1.1 Two things in that table were wrong before they were right

**Finding 2's first fix ate its own warning.** A refused *signal* send fails inside the
`sendSignalOnOutput` wrapper, which returns from the wrapper and **not** from `_executeLogic` — so a
run that was refused still reaches the success path. Clearing everything there withdrew the warning
raised microseconds earlier. The test caught it; the fix now withdraws only what this run did not
re-raise.

**Finding 9 nearly broke every blank project.** `hello-world` was first deleted from the registry
outright, on the reasoning that nothing imported it. That was true of the *symbol* and false of the
*id*: `DEFAULT_PROJECT_TEMPLATE` is `'embedded://hello-world'` and `resolveTemplateUrl` returns it
whenever no template was chosen — so it is the source of every **blank** project, and deleting it
would have made *Quick Start* throw `Unknown embedded template` while the shelf looked correct.
Richard had said so himself — *"I start a blank app and that has the hello world thing"* — and it was
read as description rather than dependency. It is now **held, not removed**, and
`template-needs-backend.test.ts` reddens if anyone tries again.

### ⚠️ §1.2 D1's premise was false, and this is where it was false

Richard's D1 (2026-09-04) held the site builder from 0.2.2 believing *"holding costs no action — it
is not in `templates/` and has never been staged for publication."* True of the community shelf, and
false of the editor: it sat in `EmbeddedTemplateProvider`'s map and `list()` returned the whole map,
so **every 0.2.2 user would have been offered the held template in the create wizard.** Holding costs
exactly one line — `HELD_TEMPLATE_IDS` — and that line now exists. Phase 77 unholds it by deleting
one string.

---

## §2 What is left, and who owns it

### §2.1 Rows opened on this board

| row | what | why it is 0.2.2 |
|---|---|---|
| [REL-012](REL-012-THE-LESSONS-NOBODY-RECEIVES.md) | the lesson bundles ship in no artefact a user receives | 🔴 **blocks** — a fresh install opens Learning empty |
| [REL-013](REL-013-THE-TEMPLATES-TAB.md) | the launcher Templates tab is still a placeholder | the create modal already reads the registry; the tab reads nothing |
| [REL-014](REL-014-THE-VALUE-THE-FIELD-DESTROYS.md) | a `var()` value is destroyed by touching its field | **data loss**, unrecoverable through the UI |
| [REL-015](REL-015-THE-SHELVES-YOU-CAN-FILL.md) | People self-listing, and publishers for replays and tutorials | Richard has the content and no way to put it anywhere |

### §2.2 Already owned elsewhere — **do not open a duplicate row**

| finding | owner | evidence |
|---|---|---|
| the token **picker** is built and mounted nowhere; the Design Tokens panel is `devMode`-gated | 🔴 **FIX-015's successor phase** (green-lit, not yet created) | [FIX-015](../phase-66-0.1.7-bug-fixes/FIX-015-THE-TOKENS-NOBODY-CAN-EDIT.md) is a **ruled scope** with eight rulings; its slice 1 is exactly this. REL-014 takes only the *data-loss defect*, which FIX-015's gap list A–J does not name |
| Community chat has no composer in the editor | **FB-013**, phase 75 | its board row already reads *"The launcher composer is unbuilt; free tags are unruled"* |
| default tutorial **content** | **FB-012**, phase 75 | blocked on Richard's brief, rolls forward on purpose |
| the empty template shelf | **FB-005**, phase 75 → closes on **REL-001** | the shelf is real and empty; publishing the members' area is what fills it |

### 🔴 §2.3 Unowned — owner `NONE`

These are real, they are recorded, and **nobody is going to do them** until someone claims them.
They are listed so that fact is visible rather than implied.

| finding | shape | owner |
|---|---|---|
| **Circle → a Shape/SVG node** — premade shapes plus pasted SVG. Richard: *"you'd be a hero"* | a plan exists and is in [NOTES-UNOWNED-NODE-WORK](NOTES-UNOWNED-NODE-WORK.md); **extend in place, no migration** | `NONE` |
| **Video node** — mp4 only; no YouTube or Vimeo anywhere; no start/end time | plan in the same notes file; mp4 start/end is **half built** already | `NONE` |
| **Dropdown** places invisible with no options; wants two defaults and a beginner JSON mode | research incomplete — the one agent that did not report | `NONE` |
| **Filter properties bar** — ~59px tall, and its field has no border and no fill, so contrast against the panel is **1.00:1** | sibling controls in the same panel already use a contrast-graded border token; the stylesheet has **five other consumers**, so scope it | `NONE` |
| **"Add style variant" vs "Style → Variant"** — two genuinely different systems, emitted adjacently with no separator | one test asserts the literal port name `'Variant'` | `NONE` |
| **Button `outline`/`ghost` icons** were invisible before §1's fix and are now correct *by inheritance* — but no gate pins the variants themselves | a render-level gate over all five variants | `NONE` |

---

## §3 ⚠️ The one fix that is not gated

Finding 6 (workbench dropdown) is **fixed and ungated**. `@testing-library/react` is not installed in
this repo, so the menu cannot be opened and read in a spec, and a second editor cannot be launched
while Richard's is running. A source-text assertion was deliberately **not** written — it would pass
on dead code.

**What would close it:** a drive against a real editor — create a component, open the scope chip,
read the menu — or `@testing-library/react` as a dev dependency, which would also unblock the
several other launcher views that currently have no render coverage.

---

## §4 What this pass says about the instruments

Three findings were invisible to green suites, and each was invisible for the same reason: **the
suite only ever saw the arm that works.**

- FB-020 has six specs on the checkbox and every one is either iconless or already checked, so the
  author-icon path had no case at all.
- The site-builder shelf had 226 green specs and none asked *what does `list()` return in a shipped
  build*.
- The Blockly palette had specs on every block's behaviour and none on its **default**.

✅ The three gates written this session are all **population-derived** rather than list-based: the
block-defaults gate reads `Blockly.Blocks`, the icon-colour gate counts `addIconInputs` call sites on
disk, and the template gate distinguishes *held* from *removed* by asking the provider both
questions about the same id. A node or block added next month is inside all three the day it lands.
