# TPL-005 — The pixel game

**Opened 2026-09-11**, at Richard's request, for 0.2.3:

> *"Let's build something cool to ship with 0.2.3 as a community shared template (I'll share the zip
> directly and we can publish another demo page to the nodegx homepage). We had some cool template
> ideas in a list before, I've forgotten which ones we declared most exciting for potential new
> users. Can we dig it out and decide which one to start with? Not a site template, something cooler
> that will show off NodeGX's node graph and power"*

**Status: 🟢 BUILT, GATED (56/56), DRIVEN, AND LIVE (2026-09-11).**
**<https://nodegx.io/templates/pixel-dungeon/>** — the second template demo on the site, beside the
business landing page. Deployed with the **shipped `nodegx deploy` CLI** (all 139 connections, 0
dropped), production viewer (1.49 MB, no source map), **0 console errors**, and played end to end on
the live URL: coin, room advance, attack, charge. Zip is cut from the gated artefact.
**Left: only Richard's look (AC8).** Nine components, 5 rooms,
50/50 gate green, played end to end in a real browser with real key events: coins counted, rooms
cleared, hearts taken, a death and a restart, and the world provably still when nobody presses
anything. **Left: Richard's look, and the publish/demo page.**

---

## 0. 🔴 The list is FOUND — this closes T1

**P78's first task was *"find or re-make the list"*, and both prior searches concluded it was not in
the repository** ([P78 README §"First task"](README.md), and
[RICHARD-RULINGS-2026-08-28 §9](../phase-75-0.2.1-the-feedback/RICHARD-RULINGS-2026-08-28.md):
*"I could not find 'the list we made'"*). **It was in the repository the whole time, in two places
neither search reached:**

- **The order**, ruled by Richard 2026-08-26 —
  [`phase-76/README.md:13-15`](../phase-76-the-site-builder/README.md#L13-L15). It was written as a
  parenthetical inside a sentence about *why the site builder goes first*, which is why a grep for
  "list" or "roster" never found it.
- **All eight with their descriptions** —
  [`template-search.test.ts:121-190`](../../../packages/noodl-editor/tests-unit/fb-005/template-search.test.ts#L121-L190),
  the FB-005 T4 search corpus, *"built from Richard's own roster"*. **A test fixture was the only
  enumeration of the product roster that existed.**

⚠️ **That is the finding, not a trivium.** The roster had to survive as a search fixture because no
document owned it. It is now written down below, in a task file, where the next person looking for
it will find it.

| # | Template | The description as it was written | Status |
|---|---|---|---|
| 1 | Site Builder | *A public website whose pages are records, with an admin panel your client edits without opening the graph.* | P76 / P77 |
| 2 | Personal Landing Page | *A single page about you: a short bio, links, and a contact form that emails you.* | 🟢 TPL-003 / TPL-004 |
| 3 | **Pixel Game** | *A tile grid, a sprite you move with the keyboard, and a score that counts up.* | **⬜ THIS TASK** |
| 4 | Storefront | *Products, a basket and a checkout, backed by Stripe.* | ⬜ |
| 5 | Membership Hub | *Sign-up, log-in and roles, with pages only members can reach.* | 🟢 TPL-001 |
| 6 | Data Dashboard | *Charts and tables over your records, filtered by date.* | ⬜ |
| 7 | Interactive Fiction | *A branching story: passages, choices, and the state the reader carries between them.* | ⬜ [TPL-006](TPL-006-THE-STORY-ENGINE.md) |
| 8 | Shared Pixel Canvas | *Everyone draws on one grid at the same time, over the realtime hub.* | ⬜ |

### 🔴 "Which ones we declared most exciting" — the honest answer is that nobody ever did

There is **no recorded excitement ranking**, and the build order is not one in disguise: the site
builder went first *because it was the hardest* (`phase-76/README.md:15`), which is the opposite of
a ranking by appeal.

What the repo *does* record is a sharper signal, and it points at exactly the three Richard was
reaching for. P75 found that **three of the eight have no honest category** in the ruled vocabulary
(`starter`, `data-app`, `dashboard`, `site`, `form`, `integration`): **`pixel-game`,
`interactive-fiction` and `shared-canvas` are none of the six**
([FB-005-SCOPE §"The second finding"](../phase-75-0.2.1-the-feedback/FB-005-SCOPE.md#L514)). They
broke the vocabulary **because they are the three that are not a website and not a CRUD app** — the
vocabulary was written for business apps and these three are not business apps. That is the list he
remembered, and it was legible only as a defect report.

---

## 1. Why this one, and what the delivery constraints settled

Richard's delivery is **a zip he shares directly, plus a demo page on the nodegx.io homepage**. That
pair is decisive and it eliminated two of the three candidates before any design work:

- 🔴 **Shared Pixel Canvas is out.** It is the biggest idea on the roster and the worst fit for this
  delivery: it needs the realtime hub, so **the zip does not run standalone** and the demo page needs
  a live backend hosted and kept up. Held for a release where a hosted demo has an owner.
- 🔴 **Storefront is out.** It needs Stripe keys **a template cannot ship** — the same constraint
  that split TPL-002 out of TPL-001 for SMTP.
- ✅ **Pixel Game and Interactive Fiction are both pure frontend**: the zip runs on open, the demo
  page is a static deploy.

**Pixel Game wins over Interactive Fiction on the demo page.** It is playable in two seconds with
nothing to read, it is unmistakably not a website, and it exercises the parts of the graph a site
template never touches. Interactive fiction is conceptually elegant — the node graph mirrors the
story graph — but a reader app demos and photographs poorly. It stays on the roster.

---

## 2. The three facts measured before the design was chosen

### 🔴 2a. There is no ticker node. NodeGX ships nothing that repeats.

`packages/noodl-viewer-react/src/nodes/std-library/timer.ts` is `name: 'Timer'`,
**`displayName: 'Delay'`** — a one-shot: `Duration`, `Start`, `Restart`, `Stop`, `Started`,
`Finished`. A grep for `Interval` / `requestAnimationFrame` across
`noodl-viewer-react/src/nodes/` and `noodl-runtime/src/nodes/` returns **only** a page transition
and the agent websocket nodes. **Nothing in the product gives a frame or a tick.**

A real-time loop would therefore be a `Delay` whose `Finished` re-enters its own `Restart`, or a
`setInterval` hidden inside a Function node. **Whether either holds a stable loop is an unmeasured
unknown**, and a template whose first acceptance criterion is an unknown is a defect hunt wearing a
template's name — which is the thing the standing rule
(*build the tasks, don't farm the defects*) exists to stop.

✅ **Turn-based needs no ticker at all: one keypress is one step.** That is why the shape below was
chosen, and it is the same shape Richard's own roster sentence describes — *"a sprite you move with
the keyboard, and a score that counts up"*. Never *"a sprite that moves"*.

⬜ **Register the absence, do not fix it here.** "NodeGX has no way to make anything happen
repeatedly without writing JavaScript" is a product finding about the node library, owned by the
runtime, and it belongs in the defects register — not inside a template.

### 2b. A grid is a Repeater over Static Data — and the level can be a string a person edits

`For Each` (`foreach.tsx:211`, **`displayNodeName: 'Repeater'`**) instantiates nothing unless its
`template` input **names a component** — a string beginning with `/`. Items alone render silence,
and nothing validates it (see the standing note on the unchecked For Each template). So: one
`Static Data` node holding the levels → `items` → a `Cell` component on `template`.

🔴 **This is the template's best teaching moment and it should be designed for, not discovered:** a
level is a string, and a person who has never opened NodeGX can add a sixth level by editing one
node. AC4 below is that criterion.

### 2c. The keyboard is a library module, and it must be carried in the project

**There is no built-in keyboard node.** Key input is `library/modules/keyboard-shortcuts` — one
hand-written file, `"dependencies": []`, no build step. It accepts `arrowup` / `up` / `left` etc.,
and it has the ports this needs:

- **`Allow Auto-Repeat`** — **off by default**; a held arrow key fires once. For a turn-based game
  that default is arguably right, but it must be a decision, not an accident.
- **Modifiers match exactly**, and bare keys are **suppressed while focus is in a text field** — so
  the game must not put focus in an input, or the arrows go dead. That is a real trap on a page with
  a "your name" field.
- The listener is removed on node delete/unmount, which is the leak this module was written to avoid.

⬜ **The module must be vendored into the project's `noodl_modules/`**, or the zip lands on a
machine that has never installed it and the game does not respond to the keyboard at all. **Measure
this on a clean profile — not on this machine, where it is installed.**

Also available and free: **`library/modules/confetti`** for the win state.

---

## 3. What it is

A **turn-based dungeon crawl**. One keypress is one step; the world steps when the person does.

```
########
#..c..E#
#.##.#.#
#.c..@.#
#.#.##.#
#E..c..#
#....>.#
########

@ you   c coin   E enemy   > exit   # wall
HP 3    Score 40    Level 1/5
```

- **Arrow keys move one tile.** A wall refuses the move and costs nothing.
- **Coins** are collected and raise a visible score.
- **The exit** advances to the next level.
- **Enemies step only when the person steps** — one tile toward them, never through a wall. Sharing
  a tile costs 1 HP.
- **HP at zero restarts the level**, keeping the score honest about what happened.
- **Five levels**, each a string in one `Static Data` node.
- **Confetti on the last exit.**

### 🔴 The design rule this task is graded against: the game must live in the graph

The failure mode is obvious and it is fatal to the entire point of the template: **one Function node
holding `step()`, and a Repeater drawing whatever it returns.** That ships a game and shows off
nothing — a person opening it learns that NodeGX is a way to host JavaScript.

So the per-move decision — *is it a wall, a coin, the exit, an enemy* — is **graph**: `Condition`,
`Expression`, `Switch`, `States`, `Variables`, component instances with `Component Inputs`. JS is
permitted where a graph would be theatre rather than clarity (parsing a level string into cells,
one enemy's step choice) and **nowhere else**. AC5 makes this countable.

---

## 4. The person sentence

> ✅ **"Someone who has never used NodeGX unzips this, presses Run, plays a game with the arrow
> keys, and then opens the graph and can see where the rule that stopped them walking into a wall
> is written."**

Both halves are load-bearing. A game that plays but whose logic is one opaque JS node **fails this
sentence while passing every mechanical criterion** — which is exactly the failure P77 shipped
eighteen honest tasks into.

## 5. Success criteria

🔴 **Every criterion here is one a render cannot meet.** TPL-004 recorded its click-drive (AC8) as
*"the only one a render cannot meet"*. For this template **that is true of all of them** — a
screenshot cannot press a key, and `render_report` returning clean says only that something was
drawn. **The gate is a CDP key-drive, and a photograph is evidence of the look and of nothing else.**

- 🟢 **AC1 — it runs with no install and no backend.** The project serves from its own
  directory and the arrow keys move the sprite. 0 console errors across every session below.
  ⚠️ **Honest scope:** driven from the prepared artefact through `render-from-disk`, which scans the
  project's *own* `noodl_modules/` (`1 scanned, 4 module script(s) injected`) — so the keyboard came
  from the artefact and not from this machine. **Not yet opened from a zip on a second machine**;
  that is the one arm of AC1 still owed.
- 🟢 **AC2 — the three consequences, driven in a browser.** Each read off the rendered DOM after
  real key events, never asserted against source text:
  - **A coin raises the count.** Four steps right onto the coin at (5,1): the coin left the board and
    Coins read 0 → 1.
  - **The exit advances the room.** Walking the rest of room 1 (right 9, down 6, left 1): Room read
    `1 / 5` → `2 / 5`, the banner read **"Room cleared."**, and room 2 loaded with its own enemy at
    (4,7) and its own three coins — the positions "Company" declares.
  - **Hearts reaching zero restarts the room.** Walking into the enemy: Hearts 3 → 2 → 1 → 0, at
    which point **Coins 3 → 0** (you drop what you were carrying), the banner read **"They got
    you."**, and the next press showed Hearts back at 3 with the room's coins and enemy restored and
    the room number kept at `2 / 5`.
- 🟢 **AC3 — the world steps only when the person does. BOTH ARMS.**
  - **The control arm, which is the one that grades it:** enemy at `4,7` with **no keypress at all**,
    read at t=0s, t=2s and t=4s — `4,7` every time. Without this arm any enemy that moves at all
    passes.
  - **Then one press at a time:** `4,7` → `3,7` → `3,6` → `3,5`, one tile per press, each step toward
    the player.
  - ✅ And a **refused** move is not a turn: standing against a wall and pressing into it eight times
    moved nothing, the enemy included. Bumping a wall does not cost you the room.
- 🟢 **AC4 — a sixth room is one edit.** The rooms are one `Static Data` node of
  `{ name, grid }`; §7 of the gate appends a sixth, checks the parser reads it unchanged, and pins
  the thing that makes it honest: **the "1 / 5" a person sees is `out-levelCount`**, so a sixth room
  says `1 / 6` on its own. The gate also asserts nothing in the parser names the number five.
- 🟢 **AC5 — the game is in the graph.** Gated four ways, and the counts come off the authored
  project rather than a literal: the **six `Condition` gates** each exist with **both** `eval` and
  `condition` fed; **every** `Condition` in the template is a declared gate (so no branch is
  undocumented); the `Function` nodes are **exactly** the six named seams (a seventh reddens); and
  **no Function script** contains `Noodl.Variables`, `Noodl.navigate`, `setTimeout`, `setInterval`,
  `document.`, `window.` or `fetch(` — a seam answers a question, it does not decide anything.
- 🟢 **AC6 — the keyboard module travels.** `noodl_modules/keyboard-shortcuts` is in the
  artefact, `preparePixelArtefact` **refuses to write without it**, and the gate asserts it.
  🔴 It is a precondition of *authoring*, not packaging: the door refuses the node type with
  `unknown-node-type` and writes nothing until the module is in the project (§2c).
- 🔴 **AC7 — the demo page. BLOCKED, and the blocker is measured: D44.** The headless deploy
  (`deploy-from-disk.cjs`, the path the live business-landing-page demo used) **silently dropped 39
  of 136 connections** — every wire into an `Expression`, `Set Variable`, `String Format` or `States`
  dynamic port, because those are minted in a `setup()` guarded on the editor connection. Exit 0,
  `state: "complete"`, and the served build loaded with **0 console errors and only the exit tile
  drawn**. The gutted build was **removed from `nodegx-web` rather than published**.
  ⬜ Routes: Richard deploys from the editor seat (where `editorConnection` exists — likely fine,
  **untested**), or D44 is fixed first. **Do not publish a build whose own census says it dropped
  wires.**
- ⬜ **AC8 — the look.** Richard's, by looking. Photographed at 900×1200; what the shots already
  cost is in §7 below.

## 7. What the drive changed about the look, and the two defects only looking found

🔴 **Three of this session's four real defects were invisible to a green gate**, which is the
argument for §5's opening line restated as history rather than as doctrine.

1. 🔴 **Every NaN comparison is false.** At load nothing has written `playerX`, so `px + dx` is
   `NaN`, and `x < 0 || y < 0 || x >= w || y >= rows.length` passed **all four** checks — the next
   line read `rows[NaN].charAt(NaN)`. **Eight thrown scripts before a single key was pressed, and
   the board drew perfectly.** Fixed with a `Number.isFinite` guard first in both wall readers.
2. 🔴 **The board had no legible maze.** The first palette gave the floor a ground one step off
   the wall's and an edge one step off its own ground: 108 faint boxes. **A player who cannot see
   the room cannot play**, and no check but looking could say so. The floor is now the page's own
   ground with **no edge at all** — it recedes, and what is left standing is the wall. Locked by a
   gate in §4 so it cannot come back.
3. 🔴 **A white band under the whole game.** `bodyScroll: true` leaves `#root` static, so
   everything below the content was the browser's white — `getComputedStyle(document.body)` read
   `rgb(255,255,255)` under a dark app. A Group's `backgroundColor` cannot reach the body; the
   stylesheet now sets it.
4. ⚠️ **And one that was my instrument, twice**, recorded because both readings were briefly
   believed: a probe read `node.name` where the field is `typeName` (making a working kit look
   absent — see D41), and a style census read the *cell* Group's `color` rather than the glyph's,
   making the working ink look unapplied. **Both were corrected by measuring again, not by
   reasoning.**

🔴 **And the fourth was the instrument lying about the product at a repo-wide scale** — D42: the
render harness had been emitting **zero** shipped design tokens since HLS-001 moved them, so the page
under measurement had no padding, no gaps and no border widths. The template was already correct and
**the invited fix was to hardcode pixels into it**. Fixed in the harness (0 → 192 tokens), not here.

## 6. Known blockers and open rulings

- 🔴 **The category.** `pixel-game` is **none of the six ruled slugs**, and the platform's CHECK
  constraint forces it to `starter` — *"a pill labelled **Starter** holding a game is not a filter,
  it is a bin"*. This is **P78's T3**, and it is a platform migration plus a ruling, both Richard's.
  ⚠️ **It does not block this task as Richard has scoped the delivery** — a zip and a demo page need
  no shelf row — but it **does** block the shelf, so the two must not be conflated in a status line.
- 🔴 **Delivery shape is Richard's call and is not yet made.** TPL-003's history is the warning: it
  was built as a curated directory, then Richard ruled it **embedded** (`embedded://landing-pages`),
  which is a different artefact. He has asked here only for **a zip and a demo page**, so build the
  project directory and **do not assume either shelf path**.
- ⬜ **Auto-repeat** (§2c) is an open decision: off means one press is one step, cleanly; on means a
  held arrow walks. Decide it deliberately and write down which.
- ✅ **The missing ticker** (§2a) is registered as **D40**, owner `NONE` deliberately — it blocks no
  AC here, and promoting it would make a product investigation a template task's first job.
- ✅ **Three more found by building this**, all registered and none fixed here:
  **D41** — a library module's registration depends on which *other* modules are installed beside
  it (`confetti` fails in a two-module project, registers among all 32; three others fail in that
  arm). It cost this template its confetti.
  **D42** — the render harness emitted 0 shipped design tokens. **Fixed**, in the harness.
  **D43** — a value wired into a `States` node's `currentState` never changed its state, while
  `to-<state>` signals into the same node worked. Worked around; it cost the board its States node.

  🔴 **D43 IS DISPROVED AND REPLACED BY D49 — RE-MEASURED 2026-09-12 IN A BROWSER BY TPL-006, which
  is the re-measurement this row asked for. This row is now rewritten rather than left half-true.**

  **The state changes.** TPL-006's `Story/Passage` is driven by exactly that wire and its `string`
  value output changed on cue. **Ten** components in `library/prefabs` do the same wire — not the
  four the 09-11 re-reading found — and four of those are inside repeated rows, so neither "a value
  cannot drive it" nor "a repeater breaks it" survives.

  **What actually broke this board:** a `States` node with `useTransitions` **true — the port's
  DEFAULT** — publishes its `string` and `boolean` values on a state change and **never publishes a
  `color` or a `number`**. `Game/Cell`'s States node carried **three colour values and nothing
  else**, so every one of its outputs was in the frozen class and the board came out monochrome.
  The only conclusion available from an all-colour node was the wrong one. Full measurement, two
  arms and a six-sample time series: **[D49](DEFECTS-THE-TEMPLATES-FOUND.md)**.

  🔴 **AND IT PREDICTS TWO THINGS ABOUT THIS TEMPLATE, NEITHER OF THEM MEASURED.** `plBoardStates`
  and `plBannerStates` set no `useTransitions`, so it is `true`. Their `string` values (`title`,
  `line`, `cls`) and `boolean` (`shown`) should work — and their **`color` values (`edge`, `tone`)
  should be dead**, which is consistent with Richard having seen the banner text and asked *"you
  also don't see any 'died' animation"*. ⬜ **Setting `useTransitions: false` on both is a two-word
  change and nobody has driven it.** Do that before the next look.
- ⬜ **AC1's second arm**: open the zip on a machine where `keyboard-shortcuts` was never installed.
  Everything says it will work and nothing has measured it.
