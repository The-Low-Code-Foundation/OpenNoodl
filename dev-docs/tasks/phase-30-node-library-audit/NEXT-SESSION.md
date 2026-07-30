# Phase 30 — next session

**Current to the commit that added this file.** Written 2026-07-30.

Work on `cline-dev`, commit directly to it, **explicit pathspecs on every commit**. End commit
messages with the Claude co-author line.

⚠️ If HEAD has moved past that commit, read PROGRESS.md's newest three log entries instead of this
file — they are always current; this file goes stale in one round.

## §0 — the state in four numbers

| | |
|---|---|
| NDA-012 | **15 of 17 categories, 79 of 155 nodes** |
| Defects found | **110**, in 66 nodes |
| Port documentation | **51.6%**, nodes at 0% **31** |
| Gates | runtime jest 1,231 · viewer 367 · cloud 57 · editor jasmine 1,894/0 · 3 typechecks clean · both catalog gates green *against a clean checkout* |

**Only Data (46) and Visual (29) are left**, and they are the two the spec ranked first and third by
expected yield. Every small category is done.

**The find rate has not declined after 79 nodes.** Animation set a record at 2.50 per node and
CustomCode came second at 2.00; the running average is 1.39. The one low score, Component Utilities'
0.63, has a *stated cause* — four of its eight nodes had already been remediated twice, by NDA-015
and NDA-004 §2 — which is a different thing from exhaustion. See FINDINGS **SR-i**.

## §1 — do these, in this order

### 1. **Data (46 nodes).** The last big one, and the highest-yield one.

29 of its 46 nodes are at 0% documentation, so NDA-005's C1 work is nearly all still there. Run it
as **one pass, not two** — NDA-012's C1 *is* NDA-005 — and read
[`PORT-DESCRIPTION-STYLE.md`](../../reference/PORT-DESCRIPTION-STYLE.md) first; it is normative and
settled.

It will not fit in one session. Split it by helper rather than alphabetically: `modelcrudbase`,
`dbmodelcrudbase`, the Collection/Array family, the Object nodes, the Repeater. **Read the helper
once and each node is minutes** — but record a helper defect *once* with its sites listed, or the
register reports a usage count. This batch had four such shapes and the worksheets show the format.

Then **Visual (29)** last: only 1 node is at 0%, so its C1 work is nearly done and only the other
eleven checks remain.

### 2. Three questions that earned their place, and are not in the twelve checks

- **"And what happens the second time?"** Found `Animation`'s latched start value — the fourth site
  of the one-shot shape, after Navigation's two.
- **Read the module's `setup`.** [`test/corpus/setup-harness.ts`](../../../packages/noodl-runtime/test/corpus/setup-harness.ts)
  now exists (NEXT-SESSION's item 2 last round, done): `driveSetup({module, type, nodes})` returns
  `portNames()`, `warnings`, `setParameter()`. Read its `importComplete`/`announceNodes` notes before
  concluding a node publishes nothing — a module that publishes nothing here has usually not been
  driven, and the fix is a flag rather than a defect report.
- **"Does a name in this port string round-trip?"** New this round, and it found two defects
  independently in one day. Anywhere the library concatenates author-chosen names into a flat port
  name and decodes with `split('-')`, a hyphen in the name breaks it. FINDINGS **SR-iii**.

### 3. The three copies of the `setup` harness are still there.

`setup-harness.ts` is written and used by the new corpus file, but NDA-009, NDA-010 and NDA-012's
Navigation test still carry their own `emitter()` + fake graph model. Collapsing them is a
mechanical change and would take twenty minutes; it was left out this round to keep the commit
about the audit.

### 4. NDA-017 §2 — only if Richard has decided §1.

Do not start from the spec body; §0's correction is written into the spec in place.

## §2 — what needs Richard. Surface it; do not decide it.

Only the first two block anything.

1. **NDA-017 §1, which BLOCKS §2.** Never-arrived detection vs. an upstream-pending notion in the
   runtime vs. making NDA-004 §3's completion-signal sequencing discoverable. The spec recommends
   A + C now, B separately; §0 added a constraint to A in place — the seed also reaches the graph
   with no `Run` at all, which a control-signal check cannot see.
2. ⚠️ **`Logic Builder` has been blocked for NINE handovers, and it is now costing more than the
   node.** Another session holds `logic-builder.ts` uncommitted, plus an untracked
   `logic-builder-io.ts` it imports and a modified `enrichment/logic-builder.json`. Consequences,
   all confirmed this round:
   - **NDA-004 §3 cannot close** (9 of 10; this is the tenth).
   - **NDA-012's CustomCode category cannot close** (4 of 5).
   - **Every catalog regeneration picks up their in-progress work.** This round it silently included
     an `editorName: 'hidden'` removal — caught only by the strip-and-compare check in §3 — and
     regenerating the catalog now requires copying three files aside, `git checkout`-ing them,
     generating, and copying back.

   This is a scheduling question, not a coding one: either that session lands its work or the file
   is released.
3. **Two creatable nodes read "Delete Record"** — `DeleteDbModelProperties` (Parse-wire) vs
   `noodl.byob.DeleteRecord` (BYOB). Neither is deprecated, so the collision survives the fix that
   keyed `register.js`'s preserved verdicts on the rendered cell.
4. **NDA-004 §2's ⏳ item 9, the deprecated five. FIVE data points now and they still disagree.**
   `Script Downloader` does network I/O with no failure surface (easiest "yes"). `Number Blend` is
   deprecated and the healthier of its pair. The deprecated `Cloud Function` has a `Failure` signal
   with no reason port anywhere. `Signal To Index` is deprecated and its one alleged defect was
   unobservable. And now **`Index To String` is deprecated and its signal ordering is *correct*** —
   more than several non-deprecated nodes manage. **Deprecation tracks age, not quality.**
5. **NDA-010 §1 item 1** — should a popup's Component Outputs *be* its close results.
6. **`Value Changed` cannot see an Object or Array being edited** — needs a decision, not a patch.
7. **The picker-integrity question, which now has a fourth member.** `net.noodl.user.SignInWith` and
   `net.noodl.user.RequestMagicLink` cannot be added to a graph while four *deprecated* auth nodes
   can (CS-i); `On App Error` was registered and working but absent from the picker; `Page Inputs`
   was in the picker with no connectable ports (NV-i, **live-verified fixed this round**). Each was
   found by a different accident and **none by any check this phase runs.** A picker-integrity check
   would have caught all of them and does not exist.
8. **Three of the four dynamic-port mechanisms carry no documentation channel at all** (FINDINGS
   **SR-ii**). `numberedInputs` writes no metadata entry, and the Port Editor panel writes none —
   which means `Component Inputs` and `Component Outputs`, the nodes that define **every
   component's public interface**, are undocumentable by any means the library has. NDA-005's
   coverage number measures one mechanism of four. Whether that is a bug or a scope boundary is
   Richard's call.

## §3 — carry these; they were learned the hard way

- **⚠️ The catalog substitution dance, now proven rather than inferred.** Copy the three working-tree
  logic-builder files to a temp dir → `git checkout` them → `node scripts/node-catalog/generate.js`
  → `node scripts/node-catalog/merge.js` → `npm run catalog:check` and `npm run catalog:merge:check`
  → copy back → **confirm with `git status` that their work is back**. Both gates exited 0 this
  round. Say in the commit message that you verified against a clean checkout.
- **Make the strong assertion.** Not "the catalog differs only in the ports I documented" but *strip
  the fields I added and the result is byte-identical to HEAD*. It is what caught the logic-builder
  contamination above, which read as an innocuous two-line diff.
- **⚠️ Never `git checkout <path>` to undo a probe.** Copy the file aside first and `cp` it back,
  then re-run the suite to prove the restore landed. Used four times this round without incident.
- **A discrimination check should predict its own failures before it runs.** Reverting all five
  fixes at once was expected to redden exactly 7 of 13 rows and leave 6 controls green; it did
  exactly that, which is stronger evidence than reverting them one at a time would have been —
  because the *controls* are the claim.
- **`flagOutputDirty` on a signal output sends a value, not a pulse** (`node.ts:647-650`,
  `outputproperty.ts:114-137`). It is silent, it typechecks, and it means the port never fires. Worth
  a repo-wide grep: `flagOutputDirty` on any port declared `type: 'signal'`.
- **A test that asserts on the sender's own signal log cannot tell a pulse from a value.** Wire the
  port to a receiver with a signal input and count arrivals. That is why the `Date To String` rows
  build a graph rather than using `node-harness`.
- **A low find rate needs a cause before it is evidence.** Twice now: Cloud Services' dip was sibling
  dilution, Component Utilities' was prior remediation. Neither was exhaustion, and neither could be
  told apart from exhaustion by the number alone.
- **A sweep aimed at named nodes does not cover the class those nodes belong to.** NDA-004 fixed
  `Expression` and `Function` and never asked "what else hosts user code" — there were four, in
  three packages. Same shape as CS-ii.
- **A live suspicion can be pointed at the wrong component, not merely be wrong.** The Page Inputs
  panel was fine; the *popup inside it* renders a code editor. Neither was distinguishable without
  opening it.
- **CDP:** `--target=editor` for the project window, `--target=dashboard` for the launcher.
  `findNodeWithId` returns the **canvas view**, not the model — read `.model` for `parameters` and
  `dynamicports`. `node.type` is a bound type *object*, not a string. Wrap every eval in an IIFE.
  Never `cdp reload`.
- Run each jest suite **from inside its package**. **Bash cwd persists across calls.** The editor
  suite takes ~6 minutes; run it in the background.

## §4 — the tree carries another session's work. Never commit it.

`logic-builder.ts` + untracked `logic-builder-io.ts` and **its two test files at
`packages/noodl-runtime/test/logic-builder-{io,node}.test.ts`** — ⚠️ those sit in the runtime test
directory, so `git add packages/noodl-runtime/test` sweeps them in. Use file-level pathspecs and
check `git diff --cached --name-only` before every commit.

Also: the whole `BlocklyEditor` directory, `docs/node-catalog/enrichment/logic-builder.json` +
`examples/code-logic-builder-greeting.json`, `docs/research/`, icon assets +
`scripts/generate-icons.js`, core-ui `Icon`/`Logo`/`PrimaryButton` + `icon-component/deploy.svg`,
`CanvasTabs`, `EditorTopbar`, `main.js`, `ServiceSupervisor.js`, `nodegx-backend/src/cli.ts`,
`dev-docs/reference/TYPE-ESCAPE-HATCHES.md`, the phase-25 screenshots, phase-18 PROGRESS/README +
the untracked EXP-007 spec, and a dev-tooling set (`package.json`, `scripts/start.ts`,
`scripts/devtools/*`, `.claude/skills/run-editor/SKILL.md`).

Use the dev tooling freely — `npm run dev:debug`, `npm run dev:stop`, `npm run cdp` all work. Just
never commit it.
