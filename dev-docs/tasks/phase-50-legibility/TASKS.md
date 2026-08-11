# Phase 50 — the tasks (LEG: the review channel)

**Created:** 2026-08-10, out of [README.md](README.md) (2026-08-06) and a re-measurement of every
graph in reach.

**Every claim about existing code in these files was read in source, and every number was measured
on 2026-08-10, not inherited.** That rule is not decoration here: the phase README's central number
is four days old and its central claim no longer holds. Keep both rules for anything added.

---

## ⚠️ The premise correction, made before any task was written

The README opens with *"`agent-chat` is 262 nodes with 0 labelled… what the agent hands over is
several hundred anonymous nodes."* The first half is true. **The second half is false**, and it was
false before the README was written.

`project-examples/agent-chat` was built by hand during **AIX-005 on 2026-07-27** (`b95eddb4`), which
is *before* AAQ-005 declared the authoring vocabulary. It is not a sample of agent output. It is a
stale fixture, and it was the only thing being measured.

Measured across the 35 projects in `NodeGX test projects/`, counting `label` on every node in every
`nodes.json`:

| Corpus | Nodes | Labelled | With `metadata.comment` |
|---|---:|---:|---:|
| **Agent-authored** — the eleven phase-55/58 model runs | **1,123** | **1,003 (89.3%)** | **0** |
| Hand-authored — 34 `library/` prefabs and modules | 1,333 | 271 (**20.3%**) | **0** |
| Hand-authored — 3 QA fixtures | 137 | 14 (10.2%) | **0** |
| Every `project.json` in this repo, 65 of them | 5,509 | 1,083 (19.7%) | **0** |
| `project-examples/agent-chat` (2026-07-27, hand-built) | 262 | **0** | 0 |
| All 35 test projects, agent and hand alike | 2,045 | 1,554 (76.0%) | **1** |

Per model, which is the row that decides LEG-002:

```
196/ 196  100%  phase55-replay-sonnet
178/ 178  100%  phase55-s6-sonnet
149/ 149  100%  phase55-s8-kimi-k3-rerun
115/ 115  100%  phase58-awp006-deepseek
108/ 108  100%  phase55-s8-ds-probe
101/ 101  100%  phase55-s8-deepseek-v4-pro
 72/  72  100%  phase58-backend-deferred
 77/  88   88%  phase55-s6-haiku
  3/  19   16%  phase55-s6-qwen35-27b     ⚠️
  1/  94    1%  phase55-replay-haiku      ⚠️
```

And the labels are real, not `Button 3`. Sampled from `phase55-replay-sonnet` and
`phase58-awp006-deepseek`: *"Gradient overlay"*, *"Three up, collapsing"*, *"Piece count"*,
*"Category photo"*, *"Badge text"*. The README's out-of-scope note — *"`Button 3` is not a label; it
is a UUID with extra steps"* — was the right worry and it did not happen.

### Why it already works, and why that is the most useful thing in this phase

`label` is **in the authoring vocabulary**, declared once and read by both write doors:

```ts
// validation/authoringVocabulary.ts:143
{ name: 'label', kind: 'string', description: 'What this node is for, in this graph' },
```

An optional field with one clear sentence of description got 100% compliance from every frontier
model and near-zero from two cheap ones. **That is the whole finding of this phase**, and it points
the work somewhere other than where the README pointed it.

### What the corrected premise leaves standing — and it is sharper than the original

**`metadata.comment` is empty everywhere.** One comment in 2,045 agent-authored nodes; zero in 5,509
nodes across all 65 projects in this repo; zero in 34 hand-built library prefabs. Not low — *empty*.

And the mechanism is now known exactly, because `authoringVocabulary.ts` documents it against
itself (`SURFACE_DIVERGENCES`, AAQ-011 F14):

> ⚠️ `stateParameters`, `stateTransitions` and **`metadata`** reach disk through MCP (the storage
> schema allows additional properties) and **cannot be expressed in the editor at all**.

So the "why" channel is empty because **it is not in the vocabulary**, while the "what" channel is
full because it is. The same experiment, run twice, with the field present in one arm and absent in
the other, and a 1,003-to-1 result. LEG-001 is that arm being closed.

---

## The tasks

| Task | File | One line | State |
|---|---|---|---|
| **LEG-006** ⭐ | [LEG-006-THE-DESCRIPTION-THAT-IS-DELETED.md](LEG-006-THE-DESCRIPTION-THAT-IS-DELETED.md) | **live data loss** — a component `description` is authorable, and the next editor save deletes it | ✅ **in `cline-dev`** |
| **LEG-001** ⭐ | [LEG-001-THE-ONLY-FIELD-STILL-EMPTY.md](LEG-001-THE-ONLY-FIELD-STILL-EMPTY.md) | **the flagship** — `metadata.comment` into the authoring vocabulary, the one field the editor cannot express and nobody has ever written | ✅ **in `cline-dev`** — 🔴 live-model re-measurement NOT run |
| LEG-005 | [LEG-005-WHERE-THE-WHY-LIVES.md](LEG-005-WHERE-THE-WHY-LIVES.md) | a comment row in the property panel — today the only way in is a context-menu item you have to know about | ✅ **in `cline-dev`** — 🔴 never painted; drive in [notes §4](notes/leg-005-lane-notes.md) |
| LEG-004 | [LEG-004-FOUR-LINES-AND-A-TEXTCONV.md](LEG-004-FOUR-LINES-AND-A-TEXTCONV.md) | `.gitattributes` already exists and already names the four files; add one word to each and a textconv driver | ✅ **in `cline-dev`** |
| LEG-007 | [LEG-007-A-SPEC-FOR-A-FIX-NOBODY-MADE.md](LEG-007-A-SPEC-FOR-A-FIX-NOBODY-MADE.md) | paste already carries labels and comments. A regression spec, not a fix | ✅ **in `cline-dev`** |
| LEG-002 | [LEG-002-THE-GRAPHS-THAT-LACK-LABELS.md](LEG-002-THE-GRAPHS-THAT-LACK-LABELS.md) | the label diagnostic, **aimed the opposite way** from the README: advisory everywhere, blocking nowhere | ✅ **in `cline-dev`** — the corpus **rejected §3's own candidate**; see [notes](notes/leg-002-lane-notes.md) |
| LEG-003 | [LEG-003-THE-DIFF-ALREADY-SPEAKS-ENGLISH.md](LEG-003-THE-DIFF-ALREADY-SPEAKS-ENGLISH.md) | SUB-007 built and wired it. Drive it, then do the Explain-panel half | ✅ **in `cline-dev`** |

✅ **All seven are built and merged as of 2026-08-11 evening.** Four landed that morning via
`trial-leg` (`08c2b85a` → `e0732dd1`); the remaining three were built the same evening in three
parallel worktrees under `../OpenNoodl-worktrees/` and merged as `599ecd49` (LEG-001), `3c1aea66`
(LEG-005) and `c9ced40f` (LEG-002). Zero shared files between the three lanes, verified with
`comm -12` before merging; all three merges conflict-free.

**The blocker recorded against LEG-001 is fixed** — `fc36d61a`, which had to land first because
LEG-001 puts `comment` into the metadata bag and LEG-005 gives humans a way to edit it. It also
caught two seams in the same family: `ComponentModel` aliased its bag in both directions, and
`ProjectModel.duplicateComponent` was dropping the `description` LEG-006 had shipped four commits
earlier.

🔴 **Built is not closed.** Two measurements remain and one exit criterion has to be struck rather
than met — see [NEXT-SESSION-PROMPT.md](NEXT-SESSION-PROMPT.md) §2, §3 and §4. In short: **LEG-005
has never been painted**, **LEG-001's live-model re-measurement has not been run** (it costs money;
ask Richard), and **README exit criterion 2 compares against a hand-built fixture and is void**.

**Revised total: ~2 weeks**, against the README's ~4. Every day of the difference is work that was
already done by SUB-007, CAN-004 and AAQ-005 and never struck off.

## Suggested order, and why

1. **LEG-006 first.** It is the only task in the phase fixing something that is *actively losing
   data*: a description an agent writes is gone on the first editor save, and restoring it by hand
   is cosmetic because the next save strips it again. Everything else here adds legibility; this one
   stops legibility being destroyed.
2. **LEG-001** — the field that has never once been written, and the mechanism is a table entry plus
   two renderers. The 1,003-to-1 natural experiment says what to expect.
3. **LEG-005** with it, or immediately after. LEG-001 gives the agent a way to write a comment;
   LEG-005 gives a human a way to find one. Shipping either alone leaves half a channel.
4. **LEG-004** — the cheapest thing in the phase now that `.gitattributes` and the driver-install
   path are known to exist. One word on four lines, one new main-process entry point, one renderer
   that already exists.
5. **LEG-007** — half a day. It is a spec over behaviour that already works, and its value is that
   nothing in the suite currently notices if it stops.
6. **LEG-002** — worth doing, worth doing *late*, and worth doing with the opposite polarity to the
   one specced. See its file.
7. **LEG-003** — mostly a drive plus the Explain half. Do not budget a week for it.

## Standing constraints

- ⚠️ **Do not gate on labels for authored output.** The README specced `BLOCKING_WARNINGS` for
  agent-authored graphs and advisory for hand-built. **The measurement inverts it**: agents label at
  89%, humans at 20%. A blocking rule aimed at authored output would fire on the corpus that already
  complies and never on the one that does not. LEG-002 §2 has the full argument, and it ends at
  *advisory both ways*.
- ⚠️ **`agent-chat` is not evidence about agents.** It is a hand-built 2026-07-27 fixture. Any
  document, exit criterion or measurement that reads its 0/262 as an agent-output number is wrong.
  The README's exit criterion 2 is written on that mistake and is corrected in LEG-002 §5.
- **`metadata` is a bag, and `comment` is the only key this phase may add to it.** `metadata.merge`
  and the CED-001 code-history key already live there, and `NodeGraphNode.fromJSON` runs
  `stripCodeHistoryMetadata` on the way in
  ([`NodeGraphNode.ts:180`](../../../packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphNode.ts)).
  Anything added must survive that strip and must not be stripped by it.
- **The vocabulary is enforcement in MCP and instruction in the editor.** zod rejects a malformed
  MCP call before the handler runs; the editor's `toSubmitPayload` casts unchecked. So
  `requiredIn: ['mcp']` is a breaking change to a shipped external API and `requiredIn: ['editor']`
  is a sentence a model reads. `authoringVocabulary.ts`'s own header says this; LEG-001 obeys it.
- ⚠️ **A v2 editor save is lossy by construction.** `buildComponentV2Files` writes exactly
  `$schema/id/name/path/type/modified` plus `metadata` and `ports`
  ([`ProjectExporter.ts:297`](../../../packages/noodl-editor/src/editor/src/io/ProjectExporter.ts)).
  Any new component-level field must be added there *and* to `ProjectImporter`, or it is deleted on
  the next save and the loss is silent. This is LEG-006's whole subject and it is a trap for LEG-001
  too.
- **Structure > gate > documentation**, inherited from phase 58 and unchanged. Which is why LEG-001
  (a field in the vocabulary) precedes LEG-002 (a rule about it), and why neither waits on docs.
- **Adopt > build**, inherited from phase 59, and it lands hard here: three of the seven tasks are
  smaller than specced because the thing was already built. Grep before budgeting.

## What is deliberately not here

- **Auto-generated labels.** Unchanged from the README, and the measurement makes it moot: real
  labels are already being produced by every model that matters.
- **A GitHub app or diff bot.** LEG-004 fixes the command line and says so. GitHub's web PR view
  does not run `textconv`, and pretending otherwise is the failure mode the README named.
- **Comment export to generated code.** That is [EXP-006](../phase-18-code-export-v2/EXP-006-EXPORT-AUTHORING-INTENT.md),
  which is *not started and blocked on EXP-002* having a generator to inject into. LEG-001 makes the
  comments exist; EXP-006 remains the task that carries them out. Do not fold it in here — a phase
  that depends on a blocked task in another phase cannot exit.
- **Requiring a comment on every node.** Noise defeats it, and the measurement gives no reason to
  think a required field behaves like an optional one at scale. LEG-001 declares it optional and
  described, which is the arm that produced 1,003 labels.
- **A second comment surface.** `commentsmodel.ts` canvas regions already exist and are a different
  thing (a region on the canvas, not a note on a node). No task here touches them.
