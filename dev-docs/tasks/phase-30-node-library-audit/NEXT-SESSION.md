# Phase 30 — next session

**Current to `74eda43d`** (Navigation audited). Written 2026-07-30.

Work on `cline-dev`, commit directly to it, **explicit pathspecs on every commit**. End commit
messages with the Claude co-author line.

⚠️ If HEAD has moved past `74eda43d`, read PROGRESS.md's newest three log entries instead of this
file — they are always current; this file goes stale in one round. Two handovers running have opened
with a warning that the previous one was stale, which is itself the argument for reading PROGRESS
first.

## §0 — the state in four numbers

| | |
|---|---|
| NDA-012 | **10 of 17 categories, 52 of 155 nodes** |
| Defects found | **71**, in 45 nodes |
| Port documentation | **46.1%**, nodes at 0% **54** |
| Gates at `74eda43d` | runtime jest 1,218 · viewer 367 · cloud 57 · editor jasmine 1,894/0 · 3 typechecks clean · both catalog gates green *on a clean checkout* |

**The find rate is not declining.** Navigation scored **1.88 defects per node** — the highest of any
category — and every one of its 8 nodes carried at least one. The Cloud Services dip (1.14) is
explained and closed: five sibling nodes diluting an average, exactly as that entry argued. There is
still no evidence for stopping.

## §1 — do these, in this order

### 1. Keep going on NDA-012 + NDA-005. Seven categories, 103 nodes left.

| Category | Nodes | at 0% docs |
|---|---|---|
| Data | 46 | 29 |
| Visual | 29 | 1 |
| Utilities | 9 | 7 |
| Component Utilities | 8 | 6 |
| CustomCode | 5 | 5 |
| Animation | 4 | 4 |
| Cloud | 3 | 2 |

**Recommended next: the small remainder as one batch — Component Utilities, Utilities, CustomCode,
Animation, Cloud (29 nodes).** Then Data (46), which the spec ranks highest-yield, then Visual (29)
last: only 1 node is at 0% there, so its C1 work is nearly done and only the other eleven checks
remain.

Run it as **one pass, not two**: NDA-012's check C1 *is* NDA-005. One read per node, verdict and port
sentences written together — that batching is the only reason 8–22 nodes fit in a session. Read
`PORT-DESCRIPTION-STYLE.md` before writing any description; it is normative and settled.

**Ask "and what happens the second time?" on every stateful node.** That question is not in the
twelve checks, and it is what found both of Navigation's latched actions. Nothing else would have.

**Read the module's `setup`, not just the node definition.** Six of Navigation's fifteen defects were
in editor-time dynamic-port code, and every one was invisible to the ordinary corpus because
`graph-harness` does not call `setup`. FINDINGS **NV-v**.

### 2. Consider promoting the `setup` harness to a shared fixture.

NDA-009, NDA-010 and now NDA-012's Navigation file each hand-rolled the same fake graph model
(`emitter()` + a `graphModel` with `components`/`getNodesWithType` + a recording `sendDynamicPorts`).
Three copies. Given that this is where the defects are concentrating, promoting it beside
`graph-harness.ts` would pay for itself inside one category. Not started.

### 3. Ten minutes on the Page Inputs property panel.

Live QA showed the `Path Parameters` / `Query Parameters` headers with **no entries**, after setting
the parameter *programmatically* rather than through the UI. That is as likely an artifact of
bypassing the panel as a defect; the stringlist editor is untouched by this change, and
`Navigate To Path` has carried a `displayName` on the same port type since before it. Click the `+`,
type a name, check the model and ports update. **Do not write it up until that is done** — the
phase's own rule is that an uncited ⚠️ is a suspicion.

### 4. NDA-004 §3's last mute node: Logic Builder.

**Check `git status` on `packages/noodl-runtime/src/nodes/std-library/logic-builder.ts` FIRST and skip
if still dirty.** Blocked by another session's uncommitted rewrite for **eight** handovers now.

### 5. NDA-017 §2 — only if Richard has decided §1.

Do not start from the spec body; §0's correction is written into the spec in place.

## §2 — six things that need Richard, and are not coding tasks

Surface them; do not decide them. Only the first blocks anything.

1. **NDA-017 §1, which BLOCKS §2.** Never-arrived detection vs. an upstream-pending notion in the
   runtime vs. making NDA-004 §3's completion-signal sequencing discoverable. The spec recommends
   A + C now, B separately; §0 added a constraint to A in place — the seed also reaches the graph with
   no `Run` at all, which a control-signal check cannot see.
2. **Two creatable nodes read "Delete Record"** — `DeleteDbModelProperties` (Parse-wire) vs
   `noodl.byob.DeleteRecord` (BYOB). The defect also has a victim in our own tooling:
   `scripts/node-audit/register.js` keyed preserved verdicts on the display name, so the ten
   deprecated/replacement pairs collided. Fixed by keying on the rendered cell, but `Delete Record`
   still collides because neither node is deprecated.
3. **NDA-004 §2's ⏳ item 9, the deprecated five.** Four data points now and they do not agree.
   `Script Downloader` does network I/O with no failure surface at all (easiest "yes"). `Number Blend`
   is deprecated and is the *healthier* of its pair. The deprecated `Cloud Function` has a `Failure`
   signal but no reason port anywhere on the graph. And now `Signal To Index` is deprecated, is a
   perfectly reasonable node, and its one alleged defect turned out to be unobservable. **Deprecation
   tracks age, not quality**, and whatever decides these dispositions must not assume otherwise.
4. **NDA-010 §1 item 1** — should a popup's Component Outputs *be* its close results.
5. **`Value Changed` cannot see an Object or Array being edited** — needs a decision, not a patch.
6. **Two of BAK-004's three shipped auth nodes cannot be added to a graph.**
   `net.noodl.user.SignInWith` and `net.noodl.user.RequestMagicLink` are absent from
   `nodelibraryexport.ts`'s picker index (`:688-699`) while four *deprecated* auth nodes are listed,
   and neither has a `docs` URL. "Which auth nodes should the picker offer" is a product question the
   same size as the deprecated-five one.

⚠️ **Item 6 gained a sibling this session, and the pair is worth raising as one thing.** `Page Inputs`
was in the picker and had **no connectable ports at all**, since the initial commit. That is three
distinct "a node in the library that an author cannot actually use" findings — CS-i, `On App Error`,
and NV-i — each found by a different accident and none by any check this phase runs. **A
picker-integrity check would have caught all three and does not exist.** Probably worth its own task.

## §3 — carry these; they were learned the hard way

- **A dismissal is a hypothesis, and so is an assertion handed to you.** `Signal To Index` arrived in
  the handover as a confirmed defect "exactly as `Receive Event` did". It reordered cleanly and the
  discrimination check then showed the reorder changes **nothing observable**, for a mechanical
  reason worth knowing (FINDINGS **NV-ii**). Verify the premise even when the previous session was
  confident — especially then.
- **Whether signal-before-value is *visible* depends on `initialize`, not on ordering.** A receiver's
  input queue is per port and is drained by `Object.keys` (`node.ts:531,543`); the first insertion
  happens at connect time and only when the source value is not `undefined` (`node.ts:452`). A node
  whose paired value port initialises to a real value masks its own defect for the life of the node.
  **A sweep for this class cannot use "does a test catch it" as the test.**
- **⚠️ Never `git checkout <path>` to undo a probe.** It reverted every edit made to `showpopup.ts`
  this session, not just the two-line revert under test. Use a targeted `perl -0pi -e` or a `cp` from
  a saved copy, and re-run the suite after restoring to prove the restore landed.
- **The catalog substitution technique has a better form.** Instead of `git hash-object -w` +
  `git update-index --cacheinfo` + a pathspec-less commit: **copy the three working-tree
  logic-builder files to a temp dir, `git checkout` them, run the generators and both gates for real,
  then copy back.** It uses the ordinary tooling, *proves* the gates green rather than inferring it,
  and has no index surgery to get wrong. (The gates read the working tree, so they are red in this
  tree by construction — say in the commit that you verified against a clean checkout.)
- **Make the strong assertion, not the banked one.** Not "differs only in the ports I documented" but
  *strip the fields I added and the result is byte-identical to HEAD*. It isolated the one legitimate
  extra change this session — `PageInputs.parameterEncoding` flipping `known: false → true`, a
  *consequence* of restoring its `setup`, which would otherwise have read as contamination.
- **A port description written while a defect is open documents the defect.** Second instance:
  `Signal To Index`'s `signalTriggered` said "*but before Index has been updated — read Index on the
  next frame*". When you close a defect, check the description you wrote for it.
- **Evals in the CDP console share one scope** — `var t` twice is a `SyntaxError`. Wrap every eval in
  an IIFE.
- **`node.type` in the editor's graph model is a bound type *object*, not a string.** `x.type === 'Foo'`
  is silently always false and cost this session two wrong readings in a row. Use
  `typeof x.type === 'string' ? x.type : x.type && x.type.name`.
- **A find rate diluted by sibling nodes is not a find rate falling.** Count distinct defects, count
  shared-helper defects once, and say so — the per-node number is a usage count.
- Run each jest suite **from inside its package** (from the repo root it picks up node_modules and
  reports ~5,600 suites). **Bash cwd persists across calls** — check where you are. The editor suite
  takes ~6 minutes; run it in the background. A red suite may not be yours: check
  `git status --porcelain` on the failing path first.

## §4 — the tree carries another session's work. Never commit it.

`logic-builder.ts` + untracked `logic-builder-io.ts` and its two test files — ⚠️ **those two test
files sit in `packages/noodl-runtime/test/`, so `git add packages/noodl-runtime/test` sweeps them in.
Use file-level pathspecs, and check `git diff --cached --name-only` before committing.**

Also: the whole `BlocklyEditor` directory (four untracked files),
`docs/node-catalog/enrichment/logic-builder.json` + `examples/code-logic-builder-greeting.json`,
`docs/research/`, icon assets + `scripts/generate-icons.js`, core-ui `Icon`/`Logo`/`PrimaryButton` +
`icon-component/deploy.svg`, `CanvasTabs`, `EditorTopbar`, `main.js`, `ServiceSupervisor.js`,
`nodegx-backend/src/cli.ts`, `dev-docs/reference/TYPE-ESCAPE-HATCHES.md`, the phase-25 screenshots,
phase-18 PROGRESS/README + the untracked EXP-007 spec, and a dev-tooling set (`package.json`,
`scripts/start.ts`, `scripts/devtools/*`, `.claude/skills/run-editor/SKILL.md`).

Use the dev tooling freely — `npm run dev:debug`, `npm run dev:stop`, `npm run cdp` all work. Just
never commit it.
