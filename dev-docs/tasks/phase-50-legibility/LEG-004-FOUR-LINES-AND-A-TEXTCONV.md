# LEG-004 — the four patterns are already written; add one word to each

**Status:** 📋 open · **Est. 2 d** (README said 4) · **Track: outside the editor**

## What already exists, which is most of it

The README budgeted four days for *"a `.gitattributes` + `textconv` driver"*. Both halves of the
hard part are already in the repo.

**The attributes file exists**, at the root, with exactly the right pattern set — and the same list
is generated for every project the editor touches:

```ts
// noodl-git/src/core/init.ts:28-33
export const NOODL_MERGE_ATTRIBUTES = [
  'project.json merge=noodl',
  'components/**/component.json merge=noodl',
  'components/**/nodes.json merge=noodl',
  'components/**/connections.json merge=noodl'
];
```

**The install path exists.** `installMergeDriver`
([`init.ts:6-23`](../../../packages/noodl-git/src/core/init.ts)) writes `merge.noodl.driver` into
the repo config, pointing at the Electron binary with a flag; `git.ts:839` calls it on every
`_setupRepository`, so existing repositories are upgraded automatically. The dispatch is
`main.js:1360` and the handler is `main/src/merge-driver.js`.

**The renderer exists.** `DiffFormatter.ts` was written for this, and says so in its header:

> The catalog is injected as a name provider so this module stays usable in headless contexts
> (**git merge driver**, tests) without the catalog JSON.

So LEG-004 is: **one word on four lines, one config key beside an existing one, one main-process
entry point beside an existing one, and a renderer that is already headless.**

## §1 — ⚠️ The thing the README got wrong, and it changes the deliverable

`textconv` is **not** a diff renderer. Git invokes it on **one file at a time**, with no base, and
diffs the two resulting texts itself. So the output cannot be
`Connected Button 'Submit Order'.click → Navigate 'Checkout'.navigate` — that sentence is a function
of *two* versions, and `formatChange` needs both.

What textconv must emit is a **stable, line-oriented rendering of a single file whose textual diff
reads well.** Different job, and the design lives entirely in that constraint:

- **One fact per line.** A node's label, type and parameters must not share a line with anything
  that changes independently, or one edit reddens five lines.
- **Deterministically ordered**, and *not* by file order. Node ids are reminted on paste and
  reordered by every writer; sort by a stable key (path then label then type then id) so an
  unrelated reordering produces no diff at all.
- **Positions excluded, or last.** `x`/`y` change constantly and mean nothing to a reviewer. The
  panel already has this distinction — `FormatOptions.includeCosmetic` defaults to false — so borrow
  the policy rather than inventing a second one.
- **Ids present but not leading.** A reviewer needs to be able to grep one; they should not have to
  read one.

A sketch of the shape, not a spec:

```
Pages/Checkout · Group "Order summary"
  Pages/Checkout · Group "Order summary" · width = 100 %
  Pages/Checkout · Group "Order summary" · [id 6f2a…]
Pages/Checkout · Button "Submit Order"
  Pages/Checkout · Button "Submit Order" · click → Navigate "Confirmation".navigate
```

Repeating the path prefix on every line is deliberate: `git diff` shows changed lines with three
lines of context, and a bare `width = 100 %` in a 900-node file names nothing.

## §2 — The wiring

1. **`NOODL_MERGE_ATTRIBUTES` → `merge=noodl diff=noodl`** on all four lines, and rename the constant
   to match what it now declares. Every repo the editor sets up gets it; the root `.gitattributes`
   is edited to match by hand.
2. **`installMergeDriver` also sets `diff.noodl.textconv`**, same binary, new flag, same
   `process.env.devMode` branch. It is already the function that upgrades existing repositories, so
   this is the whole distribution story.
3. **`main/src/textconv-driver.js`**, beside `merge-driver.js`, dispatched from `main.js` next to the
   existing `--merge` check. Git passes the file path as the single argument; the driver reads it,
   renders, writes to stdout, exits.
4. **The renderer** reuses `GraphSnapshot` for parsing and the naming rule from `DiffFormatter`
   (`nodeName`: label when the user gave one, else catalog display name, else raw type). Extract
   that rule rather than copying it — three independent copies of one semantics is a defect this
   repo has shipped twice.

⚠️ **Do not let the driver fail loudly.** Git treats a non-zero textconv exit as an error on an
otherwise ordinary `git log`. On a parse failure, emit the raw file and exit 0 — the same policy
`safeGraphDiff` already applies in the panel, for the same reason.

⚠️ **Spawning Electron per file is the performance risk.** `git log -p` over a component's history
invokes textconv once per blob per revision. Measure it on a real history before calling this done;
if it is unusable, the answer is a slimmer entry point, not a slower one nobody runs.

## §3 — The limit, stated rather than implied

**GitHub's web PR view does not run `textconv`.** Neither does any other forge's web diff. This task
fixes `git diff`, `git log -p`, `git show` and `git blame` **on the command line**, for anyone who
has opened a NodeGX project in the editor at least once.

The browser case needs a rendered artifact or a bot, it is real, and it is explicitly **not** in this
phase. The README was right to insist the distinction be stated, and it is the one sentence that
must appear in whatever user-facing note ships with this.

⚠️ `git blame` deserves its own caveat: textconv changes what `git blame` *displays*, not what it
attributes. Line attribution is still computed on the stored JSON. Do not promise otherwise.

## Acceptance

- After `installMergeDriver` runs on a fresh clone, `git diff` on a changed `nodes.json` renders
  named nodes and ports, with no additional user setup.
- **Renaming one node's label produces a one-line diff.** This is the whole test of the ordering and
  one-fact-per-line rules, and a naive renderer fails it.
- **Moving a node on the canvas produces no diff at all**, and reordering nodes within a file
  produces no diff at all.
- A malformed or partially-written file renders as raw JSON and exits 0 — `git log` never errors.
- ⚠️ **Timed on a real history**: `git log -p` over a component with ≥20 revisions, wall clock
  recorded. The number goes in the register whether or not it is comfortable.
- The user-facing note says *command line*, and does not imply GitHub.

## Register

| # | Finding | State |
|---|---|---|
| L14 | `.gitattributes`, the four patterns, the driver-install path and a headless renderer **all already exist**. The README budgeted 4 days for work that is largely `merge=noodl` → `merge=noodl diff=noodl` | ✅ read in source |
| L15 | ⚠️ textconv sees **one file, no base** — it cannot emit `formatChange` sentences. The deliverable is a stable line-oriented rendering, which is a different design | ⚠️ the correction |
| L16 | A non-zero exit breaks ordinary `git log`. Fail soft to raw JSON, per `safeGraphDiff`'s precedent | ⚠️ the trap |
| L17 | One Electron spawn per blob per revision. Unmeasured; measure before shipping | 📋 open |
| L18 | GitHub's web view does not run textconv. Say so; do not imply the browser case is fixed | ⚠️ standing |
