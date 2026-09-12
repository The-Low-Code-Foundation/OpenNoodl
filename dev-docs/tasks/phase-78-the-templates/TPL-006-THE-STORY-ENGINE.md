# TPL-006 — The story engine

**Opened 2026-09-11**, at Richard's request, after TPL-005 shipped:

> *"Can you think of another cool template or demo app we could build with our fancy new MCP and
> components and react nodes and whatnot that would blow the pants off people? Like you can build
> anything with Claude Code today, fine, but can you go in and edit it afterwards? I love how with
> the dungeon game you made that you can edit the static JSON file to create new levels. that's the
> ultimate 'ok Claude built you the foundation, now you can scale it up for free' type message"*

**Status: 🟢 BUILT, GATED AND DRIVEN 2026-09-12.** `templates/story-engine/` — 9 components, 88
nodes, 84 connections, **zero `noodl_modules`**, no backend, 0 validator errors, 62/62 on its gate,
and driven in a real browser with 0 console errors. **AC1–AC6 green. AC7 (the demo page) is blocked
and the blocker is the same D48/D44 pair that blocked TPL-005's. AC8 is Richard's.**

🔴 **The drive found the template's own headline defect in the product, not in the template**: a
`States` node with `useTransitions` on — the DEFAULT — never publishes a colour. Filed as **D49**,
which **replaces D43**. See §6.

Roster **#7, Interactive Fiction** — *"A branching story: passages, choices, and the state the
reader carries between them."* Chosen from four pitches (story engine, a Wordle-shaped daily puzzle,
a level editor feeding TPL-005's dungeon, a card battler) on **one criterion Richard stated in the
ask: how much new product a person gets per line of JSON edited.** He also ruled **the Remix page
is in scope** — *"it's the point"*.

---

## 1. 🔴 The criterion this template is graded against

Not "is it a good game". **The property being sold is that the data file is the whole creative
work.** TPL-005 got that property by accident — the five rooms happen to live in one `Static Data`
node in [`Pages/Play`](../../../templates/pixel-game/components/Pages/Play/nodes.json) — and Richard
named it as the thing he liked. This template engineers it on purpose.

The test of the property is a sentence that must be true when we are done:

> **A person can ship a completely different game by editing one JSON array, and never open the
> node graph once.**

A new dungeon level is *more of the same game*. A new `story.json` is **a detective novel, an
onboarding walkthrough, a D&D one-shot, a language lesson, a sales demo** — a different product,
from the same graph. That is the highest ratio on the eight-template roster and it is why this one
was picked over the other three.

### 🔴 The corollary: the graph must stay an interpreter, not a story

Any passage text, choice label, or story rule hard-coded into a node **breaks the claim**, because
it is content a person has to go into the graph to change. The gate must assert this, not trust it
(see AC6). A `Text` node whose `text` parameter is a literal line of the demo story is a defect in
this template even though it renders identically.

## 2. What was measured before the design was chosen

### 2a. ✅ Interactive fiction is the genre that does not want the missing node

TPL-005's first defect was **D40 — there is no ticker node** ([TPL-005 §2a](TPL-005-THE-PIXEL-GAME.md);
`Timer` is a one-shot delay, filed as
[`nodegx-has-no-ticker-node`](../../../dev-docs/tasks/phase-78-the-templates/TPL-005-THE-PIXEL-GAME.md)).
The dungeon had to become turn-based to survive it, and that was a compromise dressed as a design.

**Interactive fiction is structurally turn-based**: nothing moves until the reader chooses. The
product's sharpest limitation is invisible in this genre rather than worked around, which is a
better demo than the dungeon's.

### 2b. ✅ The Remix page is buildable with a shipped node — no module to carry

`Text Input` takes `type: 'textArea'`
([`text-input.ts:74-90`](../../../packages/noodl-viewer-react/src/nodes/controls/text-input.ts#L74-L90)),
so the paste-JSON-and-play surface needs **nothing installed**. Contrast TPL-005, which had to carry
`keyboard-shortcuts` into the project as a library module ([TPL-005 §2c](TPL-005-THE-PIXEL-GAME.md)).
**This template can ship with zero `noodl_modules`** — a strictly easier artefact to zip, deploy and
open.

### 2c. ⬜ UNMEASURED — how state between passages is held

The reader carries flags and an inventory between passages. Candidates are a `Variable`, an
`Object`, or a `Function` that owns the state. 🔴 **Before choosing, read
[`Function` `Outputs` publishes only on change](../../../dev-docs/tasks/phase-78-the-templates/TPL-005-THE-PIXEL-GAME.md)** —
a mutated-in-place object does not re-publish, which is exactly the shape a naive inventory takes.
**Measure it with a two-passage fixture before building the real thing.**

## 3. What it is

A reader lands on a page of prose with two to four choices under it. Clicking one moves them to
another passage. Some choices are **conditional** — they appear only if the reader is carrying
something or has visited somewhere — and some **give** them something. A sidebar shows what they
carry. There is a restart.

### The data shape — the entire authoring surface

One `Static Data` node holding an array. This is the contract a person edits, and it is the thing
the README teaches:

```json
[
  {
    "id": "start",
    "title": "The lamp-room",
    "text": "Rain on the skylight. The keeper's log is open on the desk.",
    "choices": [
      { "label": "Read the log", "goto": "log", "gives": "the keeper's name" },
      { "label": "Climb to the lantern", "goto": "lantern" },
      { "label": "Say the name aloud", "goto": "ending-true", "requires": "the keeper's name" }
    ]
  }
]
```

Four verbs, and no more: **`goto`** moves, **`requires`** hides a choice until you carry a thing,
**`gives`** hands you one, and an absent `choices` array is an ending. A person who understands
those four words can write a novel. 🔴 **Resist a fifth verb** — every one added is a line of the
README nobody reads and a branch in the interpreter.

### The Remix page — Richard's ruling, and the answer to his jab

*"You can build anything with Claude Code today, fine, but can you go in and edit it afterwards?"*

A `/remix` page with a textArea, a **Play** button, and a **Copy current story** button. Paste an
array, play it immediately. This makes the scaling loop work **without opening the editor at all**,
while the graph sits behind it for the person who wants to change the **rules** rather than the
**content**. Two doors, both open, in the first ten seconds.

🔴 **It must report a bad paste in prose, not fail silently** — the first thing anyone does on that
page is paste something malformed, and a blank screen there kills the whole pitch.

## 3b. The demo story — *The Last Light*

**Written 2026-09-11** with the `story-craft` and `prose-craft` skills Richard supplied, and living as
a real artefact at [`tpl-006-the-last-light.json`](tpl-006-the-last-light.json) so the build can drop
it straight into the `Static Data` node.

You are the relief keeper. The boat put you on the rock an hour ago, the lamp is cold, and Aldis —
the man you came out to relieve — is not in the lighthouse.

🔴 **The reason it is this story and not atmosphere: the mechanic and the theme are the same thing.**

- **Want** (external, concrete, on a deadline): get the light burning before dark.
- **Need** (internal, opposed): read the man before acting on him — and reading costs minutes the
  light does not have. The two pull against each other, which is the only reason there is a story.
- **The crisis is a real dilemma**, not a puzzle with a right answer: a light on the water that
  should not be there, and a shout from the rocks. Light the lamp and four men you never meet go
  home, and Aldis is at the foot of the north stair at six. Go down and you carry him up, and behind
  you the reef takes the boat *because there is no light*. **Neither is wrong. Both cost somebody.**
- **The third way out is gated on `requires: "what Aldis wrote"`** — it exists only for a reader who
  stopped and read the log, because the log is where he recorded that the south stair is rotten and
  where the old oil lamp lives. ⚠️ **Reading is the key.** In a template whose argument is *the
  writing is the product*, that is what the mechanic ought to be about.
- **It does not tidy up.** The ending where nobody drowns is the ending where Aldis will not speak to
  you, and the supply does not come for three days.

⚠️ **The left-hand panel of the proposal's Plate 2 is load-bearing and must stay true in the build:
there is no greyed-out row, no padlock, no hint.** A reader who never opened the log never learns the
third way existed. A future "helpful" affordance that reveals locked choices would break the story,
not just the plate.

## 4. The person sentence

*A writer with no code opens the template, deletes the demo story, pastes their own, and has a
playable branching game — then sends the URL to someone.*

## 5. Success criteria — measured 2026-09-12

🔴 **Every criterion here except AC2, AC4 and AC6 is one a render cannot meet**, so the evidence is
split on purpose: the gate (`tpl006Template.test.ts`, 62/62) grades what is true of the artefact,
and a CDP drive of a real browser grades what happens when somebody clicks. **Neither half is
sufficient**, and the §7 record says which is which.

- 🟢 **AC1 — it plays. Driven in a browser, 0 console errors, every clause of the AC separately.**
  - **A choice moves passages.** `The lamp-room` → `The gallery` on one click.
  - **A `gives` choice puts a thing in the inventory.** After *Read the log*, **What you carry**
    read `what Aldis wrote` and the empty-state line was gone — so both halves of the `Inverter`
    flag pair are wired.
  - 🔴 **A `requires` choice is ABSENT BEFORE and PRESENT AFTER, and both halves were read.** Same
    passage, same session, the only variable being the `gives` choice taken in between:
    at *The gallery* carrying nothing the choice list read
    `["Light the lamp", "Go down to the rocks"]`; carrying `what Aldis wrote` it read those two plus
    `Light the oil lamp first, then take the north stair`. **Present-after alone would have graded
    nothing.**
  - **An ending offers a restart**, the eyebrow reads `AN ENDING`, the note reads *"That is an
    ending. Start again and the other roads are still there."*, and the choice list is empty.
  - **A restart clears the inventory** — back at `The lamp-room` with *"Nothing yet."*
  - ⚠️ **Honest scope:** driven through `render-from-disk`, which serves the prepared artefact
    against the working-tree runtime. **Not yet opened from a zip on a second machine**, and not
    yet through the shipped deploy — see AC7.
- 🟢 **AC2 — the demo story is worth reading.** [`tpl-006-the-last-light.json`](tpl-006-the-last-light.json)
  — *The Last Light*, 7 passages, 3 endings. The gate walks it: unique ids, every `goto` resolves,
  every passage reachable, ≥2 endings, and 🔴 **the gated ending is reachable ONLY through the
  choice that gives its key** — a second walk that refuses every `gives` and every `requires` choice
  cannot reach it. **Subject still Richard's to overturn** (§6); overturning it costs the prose and
  one file.
- 🟢 **AC3 — the Remix page round-trips. Driven.**
  - **The box opens holding the story that is playing** — 3,939 characters of pretty-printed JSON on
    first load.
  - **Paste → play.** A two-passage array typed into the box, *Read this story*, and the reading page
    came up on `Monday, 9.02` with the header reading **`Your story — 2 passages`**. Its `gives`
    choice and its ending both worked.
  - **Round trip.** Back on `/remix` the box held the pasted story — 376 chars, 2 passages,
    first id `desk`.
  - **Four malformed pastes, four readable messages, and it stayed on `/remix` every time**:
    not JSON (*"That is not valid JSON yet: Expected property name…"*), an object rather than a list
    (*"the outermost brackets have to be [ ] rather than { }"*), a dangling `goto`
    (*"A choice in "a" points at "nowhere", and there is no passage with that id."*), and an empty
    box.
  - ⚠️ **DEVIATION FROM THE AC's WORDING, and it is a design decision rather than a shortfall.**
    The AC asks for a **Copy current story** button. There is no button: the box is already full, so
    "copy the current story" is select-all in a box a person is editing anyway. A literal clipboard
    write would have meant carrying `library/modules/clipboard`, which costs AC4 and walks into
    D41's two-module registration failure, to buy an affordance the page already has.
- 🟢 **AC4 — zero `noodl_modules`.** Asserted on the artefact directory, not on the intent:
  `prepareStoryArtefact` **refuses to write** if `noodl_modules/` exists and is non-empty, and the
  gate reads the directory. The first template on the shelf a person can unzip and open with nothing
  installed.
- 🟢 **AC5 — gated and drift-locked, on the TPL-005 recipe.** `tpl006Components.ts` /
  `tpl006Theme.ts` / `tpl006Template.ts` / `tpl006Template.test.ts` in `packages/noodl-mcp/tests/`,
  and `scripts/generate-story-template.ts` (`npm run template:story`) writing
  `templates/story-engine/`. The drift gate runs **the same builder** rather than a twin. **0
  validator errors; one warning, argued with rather than suppressed** (D50) and asserted exactly, so
  a *new* warning reddens.
- 🟢 **AC6 — the no-content-in-the-graph gate, and it is stronger than the AC asked for.**
  - The scan reads **every authored parameter** of every node for **all 20** passage titles, passage
    texts and choice labels, in both the raw and the JSON-escaped spelling, and asserts they occur in
    **exactly one**: `/Story/Source::srStory::json`. ⚠️ Written as *exactly one*, not *none* — the
    story has to live somewhere and that somewhere is the authoring surface.
    🔴 The escaped spelling is not belt-and-braces: checking only the raw form found **13 of 20** and
    would have read seven leaked paragraphs as clean.
  - 🔴 **And §8 proves the claim by doing it.** The template is built a second time with a completely
    different four-passage story and **every component's graph is diffed**: exactly one component
    differs, and inside it exactly one parameter of one node. *A person ships a different product by
    editing one JSON array.*
- 🔴 **AC7 — a demo page on nodegx.io. BLOCKED, and the blocker is inherited, not new.** The same
  **D44/D48** pair that blocked TPL-005's: the devtool deploy path drops every wire into a dynamic
  port, and the shipped `nodegx deploy` CLI's health filter is inert. **This template is more
  exposed than TPL-005**, because its engine is `Expression`, `Set Variable`, `String Format`,
  `States` and — the one nothing has measured — a `For Each`'s `itemOutput-*` / `itemOutputSignal-*`
  ports, all of which are minted in a `setup()` guarded on the editor connection.
  ⬜ **Do not publish a build whose own census says it dropped wires.** Routes unchanged: Richard
  deploys from the editor seat, or D44 lands first.
- ⬜ **AC8 — Richard's look.** Outstanding on TPL-003, TPL-004 and TPL-005 too; not a blocker on the
  rest. Four screenshots at 1100×1400 were taken this session and one of them changed the build —
  see §7.

## 6. Rulings, and the one that was disproved

### 🔴 D43 IS DISPROVED AND REPLACED BY D49. This template is the re-measurement the handoff asked for.

D43 read *"a value wired into a States node's `currentState` never changes its state."* **It does.**
`Story/Passage` is driven by exactly that wire and its `string` value output changed on cue in a
browser — the eyebrow read `You are here`, then `An ending`. Ten components in `library/prefabs` do
the same wire, four of them inside repeated rows.

**What is actually broken is bigger and it is not about `currentState`:** a `States` node with
`useTransitions` **true — the port's DEFAULT** — publishes its `string` and `boolean` values on a
state change and **never publishes its `color` or `number` values at all**. Two arms, identical but
for that parameter, each against a freshly restarted server; and a six-sample time series (0, 60,
150, 320, 700, 1500 ms) showing the string flip at 60 ms while both colours sat unchanged at every
sample. Full row, the table and what it predicts about TPL-005 and TPL-004:
**[D49](DEFECTS-THE-TEMPLATES-FOUND.md)**.

✅ **TPL-006 ships `useTransitions: false` on both its States nodes**, the reason is in the
parameter, and the gate pins it so a later session cannot undo it by tidying.

### 🙋 Still Richard's, and still open

- 🔴 **The category slug.** `interactive-fiction` is **none of the six ruled slugs** (`starter`,
  `data-app`, `dashboard`, `site`, `form`, `integration`), exactly like `pixel-game`. **This now
  blocks the shelf for two templates** and is phase-78 `T3`. It blocks neither the build, the zip
  nor the demo page.
- 🟡 **The demo story's subject.** He asked for the story straight after reading the lighthouse
  mockups, which is a go in substance, and *The Last Light* is written and shipping. He can still
  take it to the support-desk variant — **that costs the prose and one file**, because
  `STORY_FILE` is the only thing the build reads.

### ✅ §2c is answered: the state is three `Variable`s

The open design question was whether the reader's state should be a `Variable`, an `Object` or a
`Function` that owns it. It is three app-wide `Variable`s — `storyAt`, `storyCarrying`, `storyPasted`
— and the trap under it (`Function` `Outputs` publishes only on change, so a mutated-in-place array
never re-publishes) is handled the way TPL-005 handled it: **every seam that returns a list builds a
fresh array**. A `Function` owning the state was ruled out by the template's own rule that no seam
stores anything, and the gate asserts it.

## 6b. What the build and the drive cost, and the three things only looking found

🔴 **Three of this session's defects were invisible to a green gate**, which is the argument for the
drive restated as history:

1. **A `States` node with transitions on never publishes a colour** (D49). The gate was green, the
   graph is right, and the passage panel never changed colour. Found by reading a computed style.
2. **A dead-end passage was labelled "A passage that is not there."** The `stuck` state mapped onto
   the panel's `lost` state, so two different data mistakes wore one label — and the one it wore
   sent a person looking for the wrong bug. `Story/Passage` grew a fourth state.
3. **`visible` reserves its box.** Two empty lines on the reading page left ~130px of nothing
   between the choices and the inventory. The design doctrine's *"falsiness is free conditional
   rendering"* names `visible`; for a line that must **collapse** the port is `mounted`, which is
   what TPL-005 recorded from the other side. Found in the first screenshot.

### 🔴 And one instrument failure that nearly shipped three false findings

`render-from-disk.js` builds its HTML **once at startup** and serves that snapshot. Three rebuilds
were driven against a stale server and produced three confident, wrong readings — including a
"transitions are not the cause" that was the exact opposite of the truth. Every reading above was
re-taken with the server **restarted between arms**. *An instrument must be armed before it
measures, and a frozen fixture answers a different question once its subject has moved.*

## 6c. Two things the build learned about the doors

- 🔴 **Two pages that link to each other cannot be authored in one pass.** `create_component`
  **refuses** a `RouterNavigate.target` naming a component that does not exist yet
  (`unresolved-navigation`, *"rejected — nothing was written"*), and the pages cannot simply be
  swapped because `nextStartPage` gives home to the **first page registered**. So `Pages/Read` is
  written first, then `Pages/Remix`, and the one door between them arrives as a two-operation
  `update_component` delta (`READ_REMIX_DOOR`). The gate asserts the wire is in the artefact, so a
  delta that silently did nothing would redden rather than ship a button that goes nowhere.
- 🔴 **A `Text` with `sizeMode: 'contentSize'` renders `white-space: pre` and does not wrap**
  (`Text.tsx:79-85`). Every other template in this repo sets `contentSize` on almost every `Text`
  because their strings are short; this one's are paragraphs with blank lines in them, so a
  `contentSize` prose node runs off the right of the screen on a page that otherwise looks perfect.
  `PROSE_NODES` names all six and the gate asserts none of them is content-sized.

## 6d. The artefact, in numbers

| | |
|---|---|
| components | 9 — `App`, `Story/Source`, `Story/Passage`, `Story/Choice`, `Story/Carried`, `Story/Sidebar`, `Story/Paster`, `Pages/Read`, `Pages/Remix` |
| nodes / connections | 88 / 84 |
| `Condition` gates | 5, each with both `eval` and `condition` fed, and **every** `Condition` is a declared gate |
| `Function` seams | 5, and the gate asserts the set is exactly those five |
| library modules | **0** |
| backend | none — no `__cloud__`, no `nodegx.security.json`, no `cloudservices` |
| components publishing outputs | 3 of the 6 non-page components (`Source`, `Choice`, `Paster`) |
| design tokens | 36 project overrides on the `minimal` preset, 18 contrast pairs recomputed by the gate |
| gate | 62/62 · `typecheck:mcp` clean |

⚠️ **`Story/Passage`, `Story/Carried` and `Story/Sidebar` publish nothing, and that is stated rather
than hidden.** CMP-001 asks what a parent can learn from a component and says to answer out loud when
the answer is nothing: they are the prose, the pill and the panel, and what a reader does to them is
read them. There is no fifth verb for dropping a carried thing, so a `dropped` output would be a port
nobody could wire.

## 7. Why not the other three

Recorded so the next reader does not re-derive the comparison:

- **A Wordle-shaped daily puzzle** — cheapest build, loudest instant recognition, photographs best,
  and "swap one JSON array for your niche" is a ten-second demo. **The strongest runner-up, and the
  better pick if 0.2.3 gets close and this one is not done.**
- **A level editor feeding TPL-005** — the only idea that *produces* data rather than consuming it,
  and it demos the realtime hub. Deferred because it improves a shipped template rather than adding
  a new one to an almost-empty shelf.
- **A card battler** — adding a card in six lines of JSON is thrilling, but card effects are
  *behaviour*, so it needs a mini-DSL interpreter in the graph. That either looks brilliant or
  collapses into one `Function` node with a switch statement in it, and the downside is a demo that
  argues *against* the product.
