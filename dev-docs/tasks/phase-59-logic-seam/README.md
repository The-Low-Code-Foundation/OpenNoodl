# Phase 59 — The logic seam: three ways to compute, and nobody can find any of them (Track LGC)

**Created:** 2026-08-09
**Status:** 📋 specced, not started. Tasks are **[TASKS.md](TASKS.md)** (LGC-001…008).
**Origin:** Richard, 2026-08-09, watching a test user's first-steps video:

> *"He keeps talking about a couple of things I find quite interesting… he's used to building math
> visually and not using expression nodes… and 'I'd really like to build my functions visually'."*

**Every claim about existing code in this phase's files was read in source.** Claims about
third-party plugin behaviour are marked ⚠️ **unverified** and must be confirmed against the plugin
before a task depending on them is worked. Keep both rules for anything added — the phase's central
finding is that a plausible premise about our own code was wrong twice in one sitting.

## The premise, in one sentence

A test user asked for two features on camera. **We shipped both.** He found neither, and one of them
is a full Blockly workspace with a math palette that has been in the product since phase 3.

## What is actually on disk

| The ask | What exists | Where |
|---|---|---|
| "build math visually" | **Blockly, with a math category** — `math_arithmetic`, `math_single`, `math_trig`, `math_round`, `math_modulo`, `math_constrain`, `math_random_int`, `math_random_float` | [`BlocklyToolbox.ts:130-142`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/BlocklyToolbox.ts) |
| "build my functions visually" | the same node — **and its ports are derived from its blocks**, so building the body publishes the signature | [`logic-builder-io.ts`](../../../packages/noodl-runtime/src/nodes/std-library/logic-builder-io.ts) `detectIO` |
| "people will plaster the canvas with `add` nodes" | **there are no math nodes.** No `Add`, `Subtract`, `Multiply`, `Round` anywhere in the std library or `node-catalog.json` | verified by grep, 2026-08-09 |

So the fear in the third row is a memory of another tool, and the two asks in the first two rows are
already answered by one node nobody opens.

**This phase is therefore not about capability. It is about the seam** — how a builder chooses
between the three ways to compute, and what they can see once they have chosen.

## ⚠️ The premise correction, made before any copy is written

The phase brief said the Function node has *"only one input signal and output signal"*. **It does
not.** Read in source:

- **Signal inputs:** every `Node.Signals.X = function(){}` in the script is registered as a signal
  input — [`javascriptnodeparser.js:202-210`](../../../packages/noodl-runtime/src/javascriptnodeparser.js).
  There is no limit. This is *in addition* to the built-in `Run`.
- **Signal outputs:** every `Outputs.Done()` **and** every `Outputs["Done"]()` call found in the
  script mints a signal output —
  [`javascriptnodeparser.js:353-366`](../../../packages/noodl-runtime/src/javascriptnodeparser.js).
  Also unlimited, and *in addition* to the built-in `Success`, `Failure` and `Done`
  ([`simplejavascript.ts:208-235`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts)).

This matters because LGC-001 writes the sentence every new user reads when choosing a node. **A
picker that says "one signal in, one signal out" would teach a falsehood to every builder who reads
it**, and it would be the only place the behaviour is written down — the exact shape of the NDA-017
defect, where a port description described a trap as if it were a feature.

**Decision needed from Richard, recorded in LGC-001 §2:** the copy either states the capability
truthfully, or states *"keep it to one in and one out"* as **advice**, phrased as advice. Both are
defensible. Silently asserting a limit that does not exist is not.

## What the research says, and what it changed

Searched 2026-08-09. Every one of the four features discussed in the originating conversation is
shipped and loved somewhere, and two of them are on npm.

| We wanted | Prior art | What it changed |
|---|---|---|
| live values on blocks | **App Inventor "Do It"** — right-click any block with a device connected, it runs immediately and balloons the result at a small equals sign. **Scratch/Snap!** — click a reporter, get a speech bubble | **push → pull.** We specced always-on badges. The loved version is *on demand*, needs no trace session, and is far cheaper. LGC-002 before LGC-003 |
| split screen | **MakeCode** — simulator left, blocks right, recompiling as you type; plus a two-editor Multi Editor | the left pane earns its place by being **the running thing**, not a second editor. LGC-008 puts the app there, not the node graph |
| define inputs/outputs in a panel | **`@blockly/block-plus-minus`** — add/remove inputs without mutator dialogs | mutators are a known novice cliff; do not build one |
| save a block group, reuse it | **Scratch backpack** (drag in, drag out in another project, copies not moves, account-scoped) · **`@blockly/workspace-backpack`** · **`@blockly/block-shareable-procedures`** — procedures "backed by explicit data models", shareable across workspaces | 🔴 **this row was wrong, and LGC-006 disproved it in source 2026-08-12.** The plugin shares *procedures* between *live* workspaces via events you forward yourself; it has no store, no persistence, and cannot represent an arbitrary block group. The backpack is the drawer only. **LGC-007 builds; it adopts one UI** |
| code view | **MakeCode** round-trips Blocks ⇄ JavaScript ⇄ Python | already have it — `generatedCode` is a port. Not a task; noted in "not here" |
| run scrubber | **NuzzleBug** — omniscient Scratch debugger with reverse stepping | validated, and it carries a warning (below) |

### ⚠️ The finding that argues against this phase, recorded because it does

*Block-based or graph-based? Why not both?* (Interacting with Computers 38(1), 2026) built almost
exactly this: a dual-canvas hybrid, imperative work as blocks, logic as data-flow graphs.
**The pure block-based group outperformed the hybrid group** on task completion, comprehension of
complex logic, and usability — *while both groups said they preferred the graph version*.

Preference and performance diverged. Three things follow and they are standing constraints for
every task here:

1. **A test user's stated preference is not evidence the thing will work.** The video is evidence of
   a *discoverability* failure, which is what it literally shows. It is not evidence that a Blockly
   pane will make anyone faster.
2. **The cost lands at the boundary**, so minimise crossings. A builder should enter blocks once for
   a whole computation, not fifteen times for fifteen fragments.
3. **Therefore the no-math-nodes line gets stronger, not weaker.** Richard's instinct to refuse a
   canvas full of `add` nodes is the same instinct as this paper's finding. Do not soften it.

### The scale finding, which promotes LGC-007

App Inventor projects run to a **median of 54 blocks**, with a coin-flip chance of exceeding 30, and
the literature names the failure mode directly: block environments lower the barrier for *learning
and developing* but not for *reading, tracing and maintaining* — "viscosity".

**So LGC-007 (save a group, reuse it) is not a delight feature. It is the only known mitigation for
the thing that kills block programs**, and `workspace-minimap` / `plugin-workspace-search` in LGC-006
are not polish either. Both move up the order. ⚠️ LGC-006 found both of those plugins carry
hardcoded colours that ignore our theme flip — they are adoptable, but neither is free.

### The warning attached to the debugger work

NuzzleBug's evaluation found children *could* debug effectively with it, but that "systematic
debugging requires dedicated training" — and that even when the tool answered correctly, learners
struggled to comprehend the fault or the fix.

**Values alone do not close the loop; framing does.** We already ship the right verb for this: the
observe MCP has `why_is_this_empty`. LGC-003 §3 files bringing that verb into the workspace as the
follow-on, because an *interrogative* debugger is the thing that was validated, not a wall of
numbers.

## The seam this phase builds

Three ways to compute, one sentence each, chosen in the picker:

| | for | shape |
|---|---|---|
| **Expression** | a one-liner over a few inputs | text, no signals |
| **Function** | real JavaScript, many inputs and outputs, async, side effects | text, signal-driven |
| **Visual Function** (today: Logic Builder) | the same as either, built from blocks instead of typed | blocks, signal-driven |

All three are already `category: 'CustomCode'`
([`expression.ts:121`](../../../packages/noodl-runtime/src/nodes/std-library/expression.ts),
[`simplejavascript.ts:84`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts),
[`logic-builder.ts:96`](../../../packages/noodl-runtime/src/nodes/std-library/logic-builder.ts)),
so the category exists and the choice inside it is simply never explained.

## What this phase is not

- **Not a new language.** Blockly is already in the product; nothing here adds a second visual
  grammar. The IwC finding is why.
- **Not math nodes.** No task adds `Add`, `Subtract` or `Round` to the node library, and no task
  should. If arithmetic on the canvas is ever reconsidered, it is a separate decision with the IwC
  paper attached to it.
- **Not a rename of the Function node.** Richard ruled on this: the Blockly node is not becoming
  "Function". The existing Function node keeps its name and its job.
- **Not the AI-authors-blocks idea.** It is genuinely promising — blocks are a small strictly
  validated vocabulary, so they are a far safer AI target than freeform graph authoring, and it
  bears on phase 55's whole problem — but it is a phase of its own and it depends on LGC-007's
  definition store existing first. Filed, not scheduled.

## The ordering rule this phase inherits

Phase 58 settled it and it applies unchanged: **structure > gate > documentation.**

With one addition earned by the research above: **adopt > build.** Any task here that reimplements a
`@blockly/*` plugin needs a written reason why the plugin was insufficient.

🔴 **And the correction that rule earned on its first use.** The draft said *"two of the eight tasks
are mostly `npm install` plus wiring"*. LGC-006 tested that by reading the plugins' published source
rather than their READMEs, and **one of the two was wrong**: LGC-007 is the largest job in the phase.
The reasons are written down in [LGC-006](LGC-006-PLUGIN-SWEEP.md), which is what the rule asks for.
`adopt > build` still holds — it just costs an hour of reading to apply, and a README is not that
hour. Three package names in the sweep did not even exist as written.

## The exit test

> **Status, 2026-08-12** — see [NEXT-SESSION-2026-08-12e.md](NEXT-SESSION-2026-08-12e.md).
> Items **1, 2 and 4 are built, merged and driven**. Item **3** (LGC-002) is built and wired but
> **not driven** — it needs a running preview, because the acceptance is *live* values. Item **5**
> is the phase's remaining gate: LGC-007's engine has always existed, its **user-reachable surface
> did not**.
>
> 🔴 **This test needs a human tester, and the A/B below needs two groups of them.** No session can
> close it. The achievable target is *every item attemptable, with the code behind it driven* —
> which is not the same claim, and must not be reported as one.


A person who has never opened NodeGX is told only *"make the total equal price × quantity, rounded
up"*, and with nobody explaining components, ports or `Define input`:

1. types `multiply` into the node picker and is **offered the three logic nodes with an example
   each**, rather than getting zero results (LGC-001);
2. places the visual one and can **see its inputs and outputs without being taught** where they live
   (LGC-004);
3. **right-clicks a block and sees its value** (LGC-002);
4. can watch the app and the blocks **at the same time** (LGC-008);
5. saves the calculation and **drops it into a second one** (LGC-007).

Then the honest measurement, per the IwC warning: **run it both ways.** Half the testers get the
node graph only, half get the blocks. If the blocks group is not faster, we have built a preference,
not an improvement — and that is worth knowing before it ships.
