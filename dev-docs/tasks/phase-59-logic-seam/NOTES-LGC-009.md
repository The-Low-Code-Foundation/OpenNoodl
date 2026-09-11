# LGC-009 — build notes, decisions, and what is still owed

Built 2026-08-12 on branch `lgc009-hat`, off `cline-dev` at `76c9a092`. Everything below is
either a decision with its reasoning, a measurement, or a correction to something the task file
or the finding said about the current code.

---

## 1. The `detectIO` clash: the mechanism, and why it does not depend on document order

**The question.** A hat names a signal. `noodl_define_signal_input` also names a signal. The task
file called that *"a second, competing declaration of the same port"* and pointed at LGC-004's
register **L39** — `detectIO` resolves a clash by **document order**, which an author cannot see.
Acceptance criterion 3 fixes the behaviour (*one port per signal, not two*) and leaves the
mechanism open.

**The mechanism chosen: the hat is a mention, not a second store.** `HAT_BLOCK_TYPE` was added to
`processBlock` in `logic-builder-io.ts`, pushing a `PortMention` **identical in every field** to
the one `noodl_define_signal_input` pushes:

```ts
mentions.push({ name, plug: 'input', kind: 'signal', declaredType: 'signal' });
```

Both public projections then key on the name — `signalNames` on a `Set`, `interfacePorts` on a
`Map` — so two blocks naming one signal are one port, and nothing new was needed to make that so.

**Why this and not the alternatives:**

| Option | Rejected because |
|---|---|
| A precedence rule — *"the hat wins"* / *"the declaration wins"* | It **manufactures** the tie-break L39 is about. There is nothing to arbitrate. |
| Delete `noodl_define_signal_input`, make the hat the sole declaration | A migration of the block set, and it removes the ability to declare a signal input you handle inside a bigger stack. |
| A hat registry in the editor, keyed by workspace | L10 and L11 exactly: unreachable from the viewer window that publishes ports, and a second store of one fact. |

**🔴 The property that makes this correct is that it cannot depend on document order, and the
reason is specific rather than lucky.** L39's defect is confined to value-port **types**:
`valuePorts` takes the *first* mention's `declaredType`, so a bare `get input count` serialised
above its own `Define input count type number` leaves the port at `'*'`. **A signal port has no
type.** There is no fact for two declarations of a signal to disagree about, so there is nothing
to resolve, so there is no invisible tie-break to get wrong.

The two dedupes are order-independent for the same underlying reason, and both directions are
asserted:

- `signalNames` — a `Set` keyed on the name. Order changes which mention is *first*; it cannot
  change the set.
- `interfacePorts` — `declared` is an OR over **every** mention, and the kind resolution upgrades
  `value → signal` but never downgrades, so a name used as both reads as a signal whichever comes
  first (L42, unchanged).

**How it is graded.** `packages/noodl-runtime/test/logic-builder-hat.test.ts` asserts every claim
in **both document orders** and compares the two whole results to each other, because an assertion
in one order passes just as well against an implementation that picked a winner by position. It
also pins L39's value-port behaviour **unchanged** in the presence of a hat, so a future edit that
gave the hat a type fails there.

---

## 2. One hat or several: one block type, parameterised by signal name

**Built as one block type with a `NAME` text field**, so a program can carry one hat or several.
This is the steer I was given and I did not find an argument against it. In its favour:

- It is the shape every other Noodl block in this grammar already has — a port name in a free-text
  field. A per-signal *block type* would have to be minted whenever a signal was renamed.
- It forecloses neither ruling. "One hat per program" is a constraint that can be added later over
  the same block; "a hat per signal" is what it already permits.
- It is what makes acceptance criterion 3 a real question rather than a vacuous one: an unnamed
  hat could not clash with anything.

**🔴 The cost of that choice, stated plainly, because the label over-promises.** The hat reads
*"▶ when [run] is received"*. With **one** hat — what the migration writes, and what a new program
opens with — that is literally true. With **two**, it is not: the node runs its whole
`generatedCode` on any signal, so both bodies run whichever signal arrived. See §3.

---

## 3. 🔴 HAT-DISPATCH — the follow-on, and the correction it carries

**The brief said per-signal dispatch is "a runtime semantics change". It is not.** The runtime
already passes the trigger:

```ts
// logic-builder.ts, _createExecutionContext
// "Which signal input started this run, so a program with several of them can branch on it."
__triggerSignal__: triggerSignal
```

It is the **eighth parameter** of the compiled function, it is already declared in
`_compileFunction`, and its own docstring says it exists for exactly this. `generatedCode` stays a
single string. So dispatch is a **one-line generator change** —
`if (__triggerSignal__ === "<name>") { …body… }` — and no runtime change at all.

**It is deliberately not built here**, for two reasons:

1. Acceptance criterion 1 requires a hatted program to generate what today's hatless one
   generates. A guard is not that.
2. 🔴 **It has a casing trap that would silently stop programs running.** The node's built-in
   `Run` port calls `this._executeLogic('run', …)` — **lower case** — while a block-declared
   signal input passes its own name verbatim, and Do It passes `PROBE_TRIGGER_SIGNAL`. A hat named
   `Run` would match none of them. That is why `DEFAULT_HAT_SIGNAL` is `'run'`: it is the string
   the built-in port actually sends, **and** it is in `RESERVED_INPUTS` so it publishes no port.
   The default hat is the one that would work on the day dispatch lands.

**What a HAT-DISPATCH task would have to settle:** what a *hatless* stack does once some code is
gated (run always? never?); what Do It's `PROBE_TRIGGER_SIGNAL` matches; and whether the guard is
emitted only when a program has more than one hat (tempting, and it makes the generated shape
depend on a global property of the workspace — treat with suspicion).

---

## 4. What "mandatory" was built to mean

**The tooling supplies the hat; the generator does not refuse without one.**

- `CanvasTabsContext.openTab` passes every workspace through `ensureHatsInJson(…, { seedEmpty:
  true })` on the way into the block editor. A saved program acquires its hat the first time
  anyone opens it and is written back on the first edit; a program with no blocks opens with a hat
  already on the canvas.
- **Nothing is written to disk on open.** Opening a program and closing it again changes no bytes,
  which is what LGC-002 §2 and LGC-004 #13 grade.
- 🔴 **The generator is deliberately not a second enforcement point.** A refusal that writes its
  silence over `generatedCode` has shipped twice on this feature — `disableOrphans` (reverted
  `f1b57c0f`) and the cycle guard (driven 2026-08-12). A third would be this one. The tell that a
  stack is not part of the program is `disableOrphans` — *drawn*, model state, criterion 4 — not a
  silently shorter string on disk.

---

## 5. Two defects found by measurement while building

### 5.1 🔴 `withBlockProbes` painted a chain-head declaration block hollow on every run

`withBlockProbes` decided "this block emitted code" with `generated !== ''`. But `blockToCode` on
a statement returns that block's code **plus its whole `next` chain** (`scrub_` appends it), so a
block that emits nothing itself is non-empty whenever anything is stacked under it.

Consequence, verified in `BlockValueTrace.markFor`: such a block lands in `probedIds`, emits no
`__s(…)` (it is `suppressPrefixSuffix`), therefore never appears in a run frame, therefore renders
**hollow — "did not run" — on every run**. That contradicts the module's own docstring (*"a block
that generates nothing … must render neutral"*).

It was pre-existing: any `Define input` at the top of a stack. `block-probes.spec.ts` misses it
because its `Define input` is a *separate top-level block* rather than the head of the stack —
**a spec passing around the defect it was written for.** LGC-009 escalates it from occasional to
universal, because a hat is the head of every stack, which is how it surfaced.

Fixed by asking the honest question — *can this block emit a probe at all?* — i.e.
`suppressPrefixSuffix`, which is the same fact Blockly's own `blockToCode` consults.

### 5.2 🔴 Re-registering `disableOrphans` would have taken Do It out with it

`classifyBlockForDoIt` refused any block with `!block.isEnabled()`. Under `disableOrphans`, a
**floating value block** — parentless with an output plug — is disabled, and that is the one shape
Do It exists for (the finding's own first correction). The refusal is also a lie: nobody switched
it off, and `REASON_DISABLED` sends the author looking for a checkbox they never ticked.

Now refused only when something *other* than `ORPHANED_BLOCK` is wrong. A block carrying the
orphan reason **and** a real one is still refused. **A no-op today**, since nothing registers the
listener; it exists so criterion 4 is one line rather than a regression.

⚠️ Blockly does **not** export the reason constant — `Blockly.constants` publishes
`MANUALLY_DISABLED` and two field names, and `ORPHANED_BLOCK` lives only inside
`blockly_compressed.js`. `DoIt.ts` therefore holds a string literal, and
`hat-orphans.spec.ts` runs the real `Events.disableOrphans` and reads the reason back off a real
block, so a Blockly upgrade that renames it fails a spec rather than silently un-fixing this.

---

## 6. Corrections to what the task file and the finding say about the current code

1. **The saved-program population is two programs in three nodes, and a fourth entry appears and
   disappears.** `lgc59-drive` and `lgc59-cycle` hold the two programs. **`tier1-tails`** holds a
   third `Logic Builder` node whose workspace is the empty
   `{"blocks":{"languageVersion":0,"blocks":[]}}` — no migration needed, but it is the state a
   migration is most likely to get wrong, so it is a fixture. A fourth, `lgc59-drive-qa`, existed
   during the first count and had vanished twenty minutes later: it is a scratch copy a concurrent
   live drive makes and removes. **A population count taken while another session is driving
   includes that session's temporary files.**

2. **Per-signal dispatch needs no runtime change.** See §3. The brief's framing ("a runtime
   semantics change") is wrong about the current code; `__triggerSignal__` is already delivered.

3. **The hat does not, by itself, make `disableOrphans` safe for Do It.** The finding's own
   correction says the floating value block is the real blast radius, and a hat does not change
   that — a floating value block is still an orphan, correctly. §5.2 is the part that had to be
   built for criterion 4 to be reachable.

4. **`disableOrphans` still serialises `disabledReasons` for a genuinely stranded block**, hat or
   no hat. So LGC-002 §2 / LGC-004 #13's byte-identical-on-reopen criterion holds for a *tidy*
   program and not for one with a block parked to one side. That is a ruling still owed, and it is
   not one the hat settles.

5. 🔴 **`packages/noodl-runtime/dist-types` is a build artefact, gitignored, and in a git worktree
   it is a symlink into the primary checkout.** The root `tsconfig.json` maps
   `@noodl/runtime/src/*` at it, so `npm run typecheck` cannot see a runtime export added in the
   same commit until `build:types` is re-run — and re-running it from a worktree writes into
   somebody else's tree. **Measured, both ways:** with the stale artefact, `npx tsc --noEmit`
   reports 7 × TS2305 in exactly the five files that import the new constants; with a freshly
   generated declaration tree (emitted to a scratch directory and symlinked in for the
   measurement), it is **clean, exit 0**. `npm ci` runs `prepare` → `build:types`, so CI sees the
   fresh tree. `scripts/lgc009/tsconfig.json` documents the same trap for the migration script.

---

## 7. What is owed, and by whom

| # | Owed | Who |
|---|---|---|
| 1 | **Acceptance criterion 4.** Register `Blockly.Events.disableOrphans` in `BlocklyWorkspace.tsx` (one line, where the tombstone is) and drive it: a hatted program survives a drag with `generatedCode` and `disabledReasons` unchanged. Not built here — that file is owned by another session this week, and the criterion says driven, not asserted. | a drive, after merge |
| 2 | **The tab seam is wired but not specced.** `CanvasTabsContext.openTab` calling `ensureHatsInJson` reaches React and cannot be graded by `tests-unit` (`testEnvironment: 'node'`, no jsdom). The transform it calls is specced to the byte; *that the context calls it* is not. | a drive |
| 3 | **The fixture migration.** See the run steps in the report / §8. | Richard |
| 4 | **HAT-DISPATCH.** §3. | a task |
| 5 | **`build:types` in `packages/noodl-runtime`** before the typecheck gate is green in a shared worktree. §6.5. | whoever merges |
| 6 | **The hat's label is only true for a one-hat program.** §2. Either dispatch lands, or the copy changes. | a ruling |

---

## 8. Running the fixture migration

```
cd /Users/richardosborne/vscode_projects/OpenNoodl-worktrees/lgc009-hat
npx ts-node -P ./scripts/lgc009/tsconfig.json -r tsconfig-paths/register \
  ./scripts/lgc009/migrate-hat-fixtures.ts --check \
  "/Users/richardosborne/vscode_projects/NodeGX test projects/lgc59-drive/project.json" \
  "/Users/richardosborne/vscode_projects/NodeGX test projects/lgc59-cycle/project.json"
```

Drop `--check` to write. Verified on **copies** of both fixtures: the diff is **one line** each —
the `workspace` parameter of node `c6` in `/ErgCodes` — and nothing else in a 2295-line file moves.
`generatedCode` is deliberately untouched.

⚠️ **`lgc59-cycle` was in active use by a live drive in the primary checkout while this was
built**, which is why nothing here was run against the real fixtures.
