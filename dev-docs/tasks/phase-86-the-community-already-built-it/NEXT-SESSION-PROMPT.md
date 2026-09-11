# Next session — phase 86

## The board, re-derived from the task files (2026-09-11, session 4)

| id | what | status |
|---|---|---|
| [COM-001](COM-001-THE-TWENTY-SIX-NODES-NOBODY-DEMONSTRATED.md) | The 26 undemonstrated node types | ✅ **BUILT** s2 — 5/5 ACs |
| [COM-002](COM-002-THE-BUBBLE-PHRASEBOOK.md) | The Bubble phrasebook | ✅ **BUILT** s3 — 5/5 ACs |
| [COM-003](COM-003-THE-COMMUNITY-GRAPHS-LAND-OR-DO-NOT.md) | Land the community graphs as examples | ✅ **BUILT** s4 — 5/5 ACs; **all 12** landed |
| [COM-004](COM-004-SEO-META-TAGS.md) | SEO meta tags | ✅ **BUILT** s4 — 5/5 ACs |
| [COM-005](COM-005-THE-RECORDERS-AND-THE-MASONRY.md) | Audio/video recorder, masonry grid | 🔴 **NEXT — the only one left** |
| [COM-006](COM-006-THE-LINKS-THAT-WILL-ROT.md) | Recover the three external payloads | ✅ **BUILT** s2 — AC3 🟡 on one ask |

**Five of six built.** Commits: `503bb44e8` COM-006 · `95e0efac1`+`4d15ead3b` COM-001 · `361bd94eb`
COM-002 · `ec2ee76bf` COM-003 · `7b53349a1`+`c45838b9d` COM-004.

## The first job

🔴 **COM-005 — the recorders and the masonry.** It is the last task in the phase, and session 4
handed it two things:

1. **The masonry CSS is its source material.** `corpus/components/Masonry grid for rep…` is the only
   CSS-block snippet in the corpus, and [`SNIPPETS-DISPOSITIONED.md`](SNIPPETS-DISPOSITIONED.md)
   routed it here rather than discarding it. ⚠️ **AC4 says "under an honest name"** — read the CSS
   before naming anything: it is `flex-wrap: wrap` with `align-items: flex-start`, which is a
   *variable-width row wrap*, **not** masonry (no column balancing). The AC anticipated exactly this.
2. **Both recorders already landed as worked examples**, which is AC5's raw material:
   `community-simple-audio-recorde` (24 nodes) and `community-web-rtc-video-record` (17 nodes), both
   through the strict gate. ⚠️ They depend on the **Custom HTML module** for their preview players,
   declared via `requiresModules` — so "one module or two" (AC1) now has a third answer available:
   *extend `web-camera`, and let the preview stay Custom HTML*.

⚠️ **Before deciding AC1, measure `library/modules/web-camera`.** COM-005 was written before anyone
had read it. The same mistake COM-004 made — asserting a gap without checking the surface that
already exists — is the cheapest one available here, and it cost COM-004 its entire premise.

## Ask Richard for

1. 🔴 **COM-006 AC3 — the Directus author.** Unchanged from s3. BSD-3-Clause and organisation-owned,
   so the licence permits a derivative. ⚠️ **We are NOT missing a Directus connector** —
   `nodegx-backend-contract/src/descriptors/directus.ts` calls it *"the best-evidenced third-party
   descriptor… the backend this repo has actually stood up and driven"*. **Measure what the community
   prefab adds over that before asking its author for anything.**
2. **[D1](DEFECTS-THE-COMMUNITY-CORPUS-FOUND.md#d1) needs an owner outside this phase** — see below.

## 🔴 Four defects this phase found and does not own

All four are in [`DEFECTS-THE-COMMUNITY-CORPUS-FOUND.md`](DEFECTS-THE-COMMUNITY-CORPUS-FOUND.md).
**D1 is the one that matters.**

**D1 — renaming a built-in node's port breaks every project that wired it, silently.** `success` was
a real `Open File Picker` output from the initial commit until `a139a3ce5` (ERG-001 §4,
**2026-08-02**) renamed it to `done`. **Four ports moved in that one commit**, and ERG-001's own
message says the rule had been applied seven times. It shipped **no alias, no migration and no
warning** — verified: there is no `deprecatedPorts`/`portAliases` registry anywhere in the runtime,
and the only `renamePortWithName` is for *component* ports a user renames by hand. A project that
wired `success` now holds a dead wire, and the only explanation of why exists in a commit message.

⚠️ **This is the migration story a 0.2.x product needs before it has users, not after** — and the
community corpus is the only reason we know, because it is old enough to predate us.

D2 the `Expression` ending in `//` (from COM-002) · D3 the community's Repeater snippet does not
compile, **closed** by documenting `For Each`'s `inputMappingScript` · D4 an unexplained
`setTimeout(…, 50)` in the dropdown recipe, filed as a question and explicitly not a claim.

## What session 4 built, in one line each

- **`docs/node-catalog/examples/community-*.json`** — 12 new examples, corpus 89 → **101**. Generated.
- **[`graphs.py`](graphs.py)** — the ledger: every authored title/description and every declared
  correction, each with a `why`.
- **`scripts/node-catalog/moduleNodeTypes.js`** — one *verified* answer to "is this module type
  real?", read by **both** gates that ask it.
- **`Page.tsx`** — `og:type` and `twitter:card` become enums; two new specs (11 tests).

## Traps, session 4

- 🔴 **An example's `description` is PUBLISHED.** `generate-node-docs.js` renders `**title**` and the
  description verbatim onto `docs-site/docs/nodes/**`. Three descriptions written for a corpus reader
  shipped referencing *"the corpus"*, *"the phase's standing caution"* and *"COM-004"* before a grep
  caught them. `title`/`description` are also **required** by `merge.js`, so the export's truncated
  20-character directory name would have become the public title.
- 🔴 **`catalog:examples` green is not the pipeline.** `docs:nodes:check` read **clean** with twelve
  new examples already on disk, because `generate-node-docs.js` resolves them out of the **enriched**
  catalog with `.filter(Boolean)` — an unknown id is silently skipped, not reported. The sequence is
  **`catalog:generate` → `catalog:merge` → `docs:nodes`**, and each `:check` only grades the step
  before it.
- 🔴 **The same question gets asked by two pipelines.** `catalog:examples` and `catalog:merge` both
  refused the same three module-backed examples, from different files with different messages, ten
  minutes apart. If you teach one gate something, **grep for the second one before believing you are
  done.**
- 🔴 **Never hand-edit `docs/node-catalog/examples/community-*.json`** — they are generated. Edit
  `graphs.py`, then `./convert-exports.py docs/node-catalog/examples && npm run catalog:merge && npm
  run docs:nodes`.
- ⚠️ **A JSON round-trip reformats a shared file.** Rewriting 21 enrichment files with
  `json.dump(indent=2)` turned compact inline arrays multi-line: **182 insertions for 31 citations**.
  Reverted and redone as a textual insert — **28 insertions**. On a tree with live peers that
  difference is a collision you do not need.
- ⚠️ **`convert-exports.py` now imports `graphs.py`, so it writes `__pycache__`.** Added to
  `.gitignore` this session; it was not there before.
- ⚠️ **Peers were live all session** (P18, templates, landing-pages, MCP, and P84 FLD-010 landed
  mid-session as `0d6d4df5f`). **Commit by pathspec**, `git add` untracked first, and check the
  commit's own file list afterwards — `git show --stat` is the only proof you swept nothing.
