# Next session — finish FIX-025 before 0.2.0

Richard filed twelve bugs on 2026-08-20 from using the app. **Eleven are fixed in the working
tree of two repos, uncommitted. Three things remain**, and one of them is the only way to know
whether the hardest fix worked.

Full write-up: `dev-docs/tasks/phase-74-0.2.0-bug-fixes/FIX-025-THE-LAUNCH-LIST.md`. Read it
before touching anything — several fixes deliberately reversed previously-specced behaviour, and
the reasons are recorded there rather than in the diffs.

## State you are inheriting

| repo | branch | state |
|---|---|---|
| `~/vscode_projects/OpenNoodl` | `cline-dev` | ~17 source files + 3 specs modified, **uncommitted** |
| `~/vscode_projects/nodegx-community` | `main` | `src/lib/pathing.ts` modified, **uncommitted** |

Measured at the end of that session — ⚠️ **re-measure, do not quote these**:

- editor: `npx tsc --noEmit -p packages/noodl-editor` clean · `tests-unit` **280 files / 4593 tests / 0 failures**
- platform: `npx tsc --noEmit` clean · `npx vitest run tests/` **52 files / 1257 tests / 0 failures** (~7.5 min)

🔴 **Nothing was driven.** The app was never launched. That is job 2 and it is not optional —
five of the eleven "fixed" items are visual and have only been verified by reading source.

---

## 1. 🔴 Deploy the platform and find out whether the intake 500 is actually fixed

**This is the highest-value thing in the session and it cannot be done locally.**

Richard: *"When I signed in and answered the questions and clicked 'build my path', I get
`POST https://community.nodegx.io/api/v1/me/intake 500`."*

Three earlier sessions failed to reproduce it. The cause was read out of the production journal:

```
[api] POST /me/intake failed: TypeError: The "string" argument must be of type string or an
  instance of Buffer or ArrayBuffer. Received an instance of Object
    at Function.str      ← postgres.js bytes.str (Buffer.byteLength)
    at Array.forEach     ← postgres.js Bind, serialising parameters
  code: 'ERR_INVALID_ARG_TYPE'
```

🔴 **It only fails inside the built Next bundle.** The identical statement with the identical
payload was run *on the production host, against the production database*, and **succeeded**. So
nothing you can run locally will exercise this fault — which is exactly why nine local
reproduction attempts across two sessions all came back clean.

`recordIntake` (`src/lib/pathing.ts`) now passes the JSON as a plain string cast `::text::jsonb`
instead of `sql.json()`, removing the `Parameter` wrapper — the only object on that path.

```bash
cd ~/vscode_projects/nodegx-community
npx vitest run tests/uni007-intake-and-pathing.test.ts   # 30/30 before you deploy
ops/deploy.sh 49.12.102.195                             # ssh alias `nexus`, key ~/.ssh/nexus_hetzner
```

**The whole test, after Richard answers the three questions in the editor:**

```bash
# ⚠️ Use the app's own DATABASE_URL — this exact form was verified working on the host.
#    Do not guess a psql user/db; the production credentials live only in that env file.
ssh nexus "cd /opt/nodegx-community && printf '%s\n' \
  'import postgres from \"postgres\"' \
  'const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} })' \
  'console.log((await sql\`select count(*)::int n from learner_intakes\`)[0].n)' \
  'await sql.end()' > ./count.mjs && set -a && . /etc/nodegx-community/nodegx-community.env \
  && set +a && node ./count.mjs; rm -f ./count.mjs"
```

⚠️ The script must be written **inside `/opt/nodegx-community`**, not `/tmp` — `postgres` resolves
from that directory's `node_modules`.

⚠️ **It was 0.** The intake has never saved for anybody, ever — so *one row is the pass*. If it is
still 0, the cause is already being logged:

```bash
ssh nexus "journalctl -u nodegx-community --since '1 hour ago' --no-pager | grep -A20 'me/intake failed'"
```

🔴 **The mechanism was never established, and the fix comment says so.** Every branch of
postgres.js's `Bind` ends at a serializer that returns a string, so *"an object reached
`bytes.str`"* should be impossible. **Do not spend the session theorising — three sessions have.**
If the 500 survives the deploy, instrument `Bind` inside the deployed bundle and read what the
parameter actually is.

⚠️ Two traps in that file, both already paid for:
- `${JSON.stringify(x)}::jsonb` **without** the `::text` is wrong — postgres.js takes the
  parameter type from the server's `Describe`, infers jsonb, and `JSON.stringify`s the JSON
  *again*, storing a string scalar. It broke five tests. Assert `jsonb_typeof` if you touch it.
- ~8 other `sql.json()` call sites were deliberately left alone. Only convert them if a second
  route reports this same `TypeError`.

---

## 2. 🔴 Drive the editor and look at the five visual fixes

Use the `run-editor` skill. **Verify the consequence, not the mechanism** — write down what you
expect to see *before* you look, or you will confirm whatever renders.

| bug | how to reach it | what must be true |
|---|---|---|
| **1** Blockly drawer | Open any Visual Function node → the block editor. Open a toolbox category with more blocks than fit, scroll to the bottom of the left flyout. | The **last block is fully visible above the Run bar**. Previously the SVG was a strip-height too tall and its bottom was clipped, so scrolling further never revealed it. |
| **8** step checkmarks | Open the *Log a thing* lesson (Learning tab). | An **incomplete** step shows **one empty ring**. A **completed** step shows **one filled tick**. Previously incomplete steps drew both glyphs overlapping. |
| **9** "Check my work" | Same lesson. It has 2 popup steps (ungraded) and 6 card steps (graded). | The control is **absent** on the two popup steps and **present** on the six card steps, showing a line like *"Looking for …"* before any run. |
| **10** step popup | Click a step whose body is long. | It stays on screen, **scrolls inside itself**, and can be closed. Previously it overflowed top and bottom with no way to scroll or dismiss. |
| **11b** delete confirm | Open *State on a page*, select the `Caption` Text node on Home, press Delete. | A confirm appears **naming the step** ("Add a second Text"). Cancel keeps the node; confirm deletes it. Deleting an unrelated node must **not** prompt. |

Traps that will cost you an hour each if you skip them:

- 🔴 **A stray Chrome on port 9222 steals CDP** and presents exactly like an editor crash. Set
  `NOODL_REMOTE_DEBUG_PORT`. Two editors cannot coexist on one port.
- 🔴 **Drive a copy of a project** — opening one rewrites it, and now writes three files into it.
- 🔴 **`reload --target=viewer` reloads the EDITOR.** An empty `NodeLibrary` means the viewer died.
- 🔴 A React write is **not visible in the same `eval`** — measure in a second call or you will
  record a false negative.
- ⚠️ Lessons live in `~/Library/Application Support/NodeGX/Learning/{state-on-a-page,log-a-thing}/`.
  The live app is **`NodeGX`**, not `OpenNoodl` — all three exist and hold different stale state.

**Bug 11a is already proven by spec** (`tests-unit/fix-025/nested-node-path.test.ts`) but is worth
one end-to-end pass: in *State on a page*, adding a Text labelled `Caption` to Home should now
tick the last step. All three of that lesson's graded steps were unreachable before.

---

## 3. Build the half of 11b that was not built — per-step restore

Richard asked for **both** a warn and a restore. Only the warn exists.

> *"It's easy to accidentally delete bits of the tutorial app that are needed to complete the
> session, and you might not remember what you deleted."*

Restore means: put back the nodes the current step needs, from the pristine lesson source, with
their parents and parameters, **without discarding the learner's other work**, and inside one undo
group. It was left because it mutates the graph and could not be verified without a drive — not
because it was judged unnecessary. Say that plainly if it slips again.

What is already there to build on:

- `src/editor/src/models/lessonprotection.ts` — already computes **which** nodes a step needs, from
  the same `completeWhen` conditions grading reads. Reuse it; do not add a second list.
- `LearningFolderModel.reset()` — the existing **destructive** recovery path (throws away the whole
  project copy). This is the thing restore has to be better than.
- The pristine source is the installed bundle under `Learning/<slug>/`.

⚠️ **Derive from the conditions, never from a hand-written `protected:` field in the lesson
format** — a second statement of the same fact drifts on the first edit. That argument is why the
warn works at all, and it applies identically here.

---

## 4. Then commit, and re-measure the release

Nothing is committed in **either** repo. Two traps recorded from previous sessions on this
checkout:

- 🔴 **Never `git stash` here** — `pop` crashes a live editor.
- 🔴 Use `git commit <pathspecs>`, **never stage**; a sibling session's commit sweeps staged files.
  Untracked files need `add` + `commit` in **one** chain.

`release-0-2-0-state.md` predates all of this and its floors are for a different tree. FIX-025
touched `noodl-editor`, `noodl-core-ui` and the platform.
