# Next session — phase 86

## The board, re-derived from the task files (2026-09-11, session 3)

| id | what | status |
|---|---|---|
| [COM-001](COM-001-THE-TWENTY-SIX-NODES-NOBODY-DEMONSTRATED.md) | The 26 undemonstrated node types | ✅ **BUILT** s2 — 5/5 ACs |
| [COM-002](COM-002-THE-BUBBLE-PHRASEBOOK.md) | The Bubble phrasebook | ✅ **BUILT** s3 — 5/5 ACs |
| [COM-003](COM-003-THE-COMMUNITY-GRAPHS-LAND-OR-DO-NOT.md) | Land the community graphs as examples, 5/12 measured | 🔴 **NEXT** — instrument committed |
| [COM-004](COM-004-SEO-META-TAGS.md) | SEO meta tags | **OPEN** — AC1 is a one-paragraph decision |
| [COM-005](COM-005-THE-RECORDERS-AND-THE-MASONRY.md) | Audio/video recorder, masonry grid | **OPEN** — its chat-module source is recovered |
| [COM-006](COM-006-THE-LINKS-THAT-WILL-ROT.md) | Recover the three external payloads | ✅ **BUILT** s2 — AC3 🟡 on one ask |

**Three of six built.** Commits: `503bb44e8` COM-006 · `95e0efac1`+`4d15ead3b` COM-001 · `361bd94eb`
COM-002 · `5f6634166` the P85 table COM-001 moved.

## The first job

🔴 **COM-003 — land the community graphs.** It is next because it is the only remaining task with a
committed instrument and a measured starting point (5/12 through the gate), and because COM-002 just
handed it two things:

- **The 14 standalone code snippets are COM-003's**, not the phrasebook's. COM-002 §7.4 explains the
  judgement: `Add params to URL` and `Check window width` are NodeGX recipes in *our* vocabulary, not
  Bubble operators, and putting them in a table whose whole asset is Bubble's search terms dilutes
  the one thing that makes it findable. If they want a page, it is a different page.
- **[`corpus/components/PARSE-ERA-ROWS.md`](corpus/components/PARSE-ERA-ROWS.md)** marks the three
  Parse-era components and re-tests the claim. ⚠️ Mark them, do not delete them, and do not promise
  them: none has been *run* against a live Parse Server.

🔴 **Before landing anything, read COM-002 §7.1.** The community's code was executed for the first
time and **18 of its rows are demonstrably wrong**. The graphs come from the same people and the same
years. Circulation is not verification — and the gate refusing 7 of 12 is the same signal.

Then COM-004 AC1 (a paragraph; ⚠️ read `Page.tsx:168` first), then COM-005.

## Ask Richard for

1. 🔴 **COM-006 AC3 — the Directus author.** BSD-3-Clause and organisation-owned, so the licence
   permits a derivative; their README sells a commercial kit built on it. ⚠️ **The question changed
   in s3** — see COM-006 §5.2's boxed correction. `nodegx-backend-contract/src/descriptors/
   directus.ts` calls Directus *"the best-evidenced third-party descriptor, because Directus is the
   backend this repo has actually stood up and driven"*, probed against a live Directus 11. **We are
   not missing a Directus connector.** Measure what the community prefab adds over that before asking
   its author for anything.
2. **COM-004 AC1** — SEO as a node in the picker, or a prefab people install?

## 🔴 A defect this phase found and does not own

**An Expression whose text ends in a `//` comment does not compile.** `expression.ts` wraps the body
as `return ( text );` on one line, so the comment swallows the closing `);` and it fails with
`Unexpected token '}'` — naming nothing the author wrote and never mentioning comments. `grep` finds
no test covering it. **Nominated owner: the runtime.** The fix is a newline before the `);`, and it
wants a spec beside it. Three community rows are written that way, which is how we know they have
provably never been run.

## What session 3 built, in one line each

- `scripts/bubble-phrasebook/rows.js` — 94 operators, one source of truth for the page AND the checker.
- `scripts/bubble-phrasebook/check.js` — `npm run docs:bubble:check`. Executes all 77 code cells in
  the **product's own sandboxes**, and re-executes the 11 original community snippets to prove the
  page's accusations. **Two accusations were wrong and it caught them.**
- `scripts/bubble-phrasebook/build.js` — `npm run docs:bubble`. Refuses to write if a cell fails.
- `docs-site/docs/coming-from-bubble.md` — generated; never hand-edit it.

## Traps, session 3

- 🔴 **An unquoted heredoc mangles backslashes as well as backticks.** `<<PY` instead of `<<'PY'`
  turned eleven `.join('\n')` into `.join('<real newline>')` and broke the module. Quote it.
- 🔴 **"The old code is broken" is a claim — execute it.** Two rows accused the community table of a
  bug and its code returned the right answer. The checker now fails the build on that, and the count
  of code faults went 13 → 11.
- 🔴 **`docs-site/docs/nodes/**` is generated from the enriched catalog, so ADDING A CATALOG EXAMPLE
  MAKES IT STALE** and only `npm run docs:nodes:check` says so. It had been red since `b438e8c05`
  (P85, 09-10) before anyone noticed. It is clean now; re-run it after touching examples.
- ⚠️ **`docusaurus.config.js` sets `markdown.format: 'detect'`,** so a `.md` file is plain CommonMark
  and `{/* … */}` renders to the reader as literal text. Use an HTML comment. Admonitions and
  `{#anchor}` do work.
- ⚠️ **The node TYPE is not the node's display name.** `Filter Collection` is **Array Filter** in the
  editor and `For Each` is **Repeater**; both were written the wrong way round first. The generator
  resolves every node it names against the node reference and fails on one it cannot find.
- ⚠️ **`wc -l` on the dictionary reads 404; the record count is 94** (newlines inside quoted CSV
  fields), and slicing a code cell to 420 chars makes it *look* truncated when it is not.
- ⚠️ Peers were live in this tree all session (P18, templates, landing-pages, form-fields).
  **Commit by pathspec**, `git add` untracked first, and check `git diff package.json` before
  committing a shared file.
