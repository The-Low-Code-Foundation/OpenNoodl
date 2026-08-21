# Next session — one action from Richard closes bug 6, then FIX-026

FIX-025 is **committed and driven**. Both repos are clean of it. What is left is one thing only
Richard can do, one task that was deliberately scoped rather than guessed at, and the release
re-measure.

Read `FIX-025-THE-LAUNCH-LIST.md` first — several fixes deliberately reversed previously-specced
behaviour and the reasons are recorded there, not in the diffs.

## State you are inheriting

| repo | branch | state |
|---|---|---|
| `~/vscode_projects/OpenNoodl` | `cline-dev` | FIX-025 committed as `0f97fcef`. ⚠️ Other sessions' uncommitted work is in the tree (`scripts/library/check.ts`, `AskAboutNodeDialog.module.scss`, several `dev-docs/` phases) — **it is not yours; do not sweep it into a commit** |
| `~/vscode_projects/nodegx-community` | `main` | intake fix committed as `c5d3ad5` and **deployed to nexus-1** |

Measured at the end of 2026-08-21 — ⚠️ **re-measure, do not quote these**:

- editor `npm run typecheck:editor` exit 0 · `npm run test:main` exit 0, **300 suites / 4865 tests / 0 failures**
- platform `npx tsc --noEmit` exit 0 · `tests/uni007-intake-and-pathing.test.ts` **30/30**
- deploy verified: site 200, sign-in 302, all three neighbours 200

---

## 1. Bug 6 — the last half of the proof, and it needs Richard

The fix is **deployed and present in the built bundle** (checked directly:
`.next/server/chunks/7561.js` reads `values (${b}::uuid, ${JSON.stringify(c)}::text::jsonb)` —
no `sql.json`). What is **not** proved is that the route now answers 200, because
`learner_intakes` is still 0 rows: nobody has taken the intake since the deploy.

🔴 **Do not try to prove it by driving the intake yourself.** Two routes were attempted on
2026-08-21 and both were refused by the sandbox, correctly: one used Richard's stored editor
session (spending his credential and writing him a learner path he did not choose), one minted a
disposable probe account on the production host. **Neither should be worked around.**

✅ **Ask Richard to answer the three questions in the Learning tab and press *Build my path*.**
Then, read-only:

```bash
ssh nexus "cd /opt/nodegx-community && printf '%s\n' \
  'import postgres from \"postgres\"' \
  'const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} })' \
  'console.log((await sql\`select count(*)::int n from learner_intakes\`)[0].n)' \
  'await sql.end()' > ./count.mjs && set -a && . /etc/nodegx-community/nodegx-community.env \
  && set +a && node ./count.mjs; rm -f ./count.mjs"
```

⚠️ The script must be written **inside `/opt/nodegx-community`** — `postgres` resolves from that
directory's `node_modules`. **One row is the pass.** If it is still 0:

```bash
ssh nexus "journalctl -u nodegx-community --since '1 hour ago' --no-pager | grep -A20 'me/intake failed'"
```

🔴 **The mechanism was never established and the fix comment says so. Do not theorise — four
sessions have.** If the 500 survives, instrument `Bind` inside the deployed bundle and read what
the parameter actually is.

⚠️ Two traps in `src/lib/pathing.ts`, both already paid for: `::jsonb` **without** the `::text`
stores a double-encoded string scalar (assert `jsonb_typeof` if you touch it), and ~8 other
`sql.json()` call sites were deliberately left alone — convert them only if a second route
reports the same `TypeError`.

---

## 2. FIX-026 — per-step restore

`FIX-026-PUT-IT-BACK.md` is written and scoped. **Read it before starting**: the drive found that
its stated foundation was false. `Learning/<slug>/` is the learner's *working copy*; there is no
pristine original beside it, and the one real source (`entry.source.path`) is in `/tmp` for one
of the two installed lessons. **That is a decision for Richard**, and the task file lays out three
options with a recommendation. Do not start coding before it is made.

---

## 3. Re-measure the release

`release-0-2-0-state.md` predates all of this and its floors are for a different tree. FIX-025
touched `noodl-editor`, `noodl-core-ui` and the platform.

⚠️ `test:ci` is the unmeasured one. Run it **alone** — a timed-out run exits 1 exactly like the
clean floor, so completion is the summary line and never `$?`, and never pipe it.

---

## Traps this session paid for, worth carrying

- 🔴 **`npm run dev:debug` runs the app against the LIVE `NodeGX` userData** — the same lesson
  folders, register and community session the real app uses. **Back up
  `~/Library/Application Support/NodeGX/Learning/`, `learning_folder.json` and
  `lessonProgress.json` before driving a lesson, and restore after.** Verified restorable with
  `diff -rq`.
- 🔴 **The running editor rewrites `learning_folder.json` from memory.** Editing it to move a
  lesson's resume point does nothing while the app is up — it flushed my change straight back.
- ⚠️ **A popup-only lesson step opens a modal that nothing in the CDP helper can dismiss** —
  there is no `key` command, and a synthetic `Escape` on `document` does not reach
  `KeyboardHandler`. A synthetic `keydown` with `key: 'Delete'` / `key: 'z'` + `metaKey` **does**
  work for node-graph commands (`KeyCodeUtils.fromString(event.key)`). To reach the canvas on a
  popup step, resume the lesson on a card step instead.
- ✅ **`window.__nodeGraphEditor` is a real global** and has `forEachNode`, `selectNode`,
  `findNodeWithId`. It is how to select a node without canvas coordinates. Its methods take
  **view** nodes (`n.model.label`), not model nodes.
- ✅ Tag-then-click is the reliable way to click a computed element:
  `eval("...el.setAttribute('data-drive','x')")` then `cdp click "[data-drive=x]"`.
