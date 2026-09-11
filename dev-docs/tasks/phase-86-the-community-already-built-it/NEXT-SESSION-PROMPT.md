# Next session — phase 86 is CLOSED

## The board, re-derived from the task files (2026-09-11, session 5)

| id | what | status |
|---|---|---|
| [COM-001](COM-001-THE-TWENTY-SIX-NODES-NOBODY-DEMONSTRATED.md) | The 26 undemonstrated node types | ✅ **BUILT** s2 — 5/5 |
| [COM-002](COM-002-THE-BUBBLE-PHRASEBOOK.md) | The Bubble phrasebook | ✅ **BUILT** s3 — 5/5 |
| [COM-003](COM-003-THE-COMMUNITY-GRAPHS-LAND-OR-DO-NOT.md) | Land the community graphs as examples | ✅ **BUILT** s4 — 5/5, all 12 landed |
| [COM-004](COM-004-SEO-META-TAGS.md) | SEO meta tags | ✅ **BUILT** s4 — 5/5 |
| [COM-005](COM-005-THE-RECORDERS-AND-THE-MASONRY.md) | Recorders + the masonry | ✅ **BUILT** s5 — 5/5 |
| [COM-006](COM-006-THE-LINKS-THAT-WILL-ROT.md) | Recover the three external payloads | ✅ **BUILT** s2 — AC3 🟡 on one ask |

**🔴 Six of six. The phase is closed. Do not open a COM-007 — pick up the next phase.**

Commits: `503bb44e8` COM-006 · `95e0efac1`+`4d15ead3b` COM-001 · `361bd94eb` COM-002 ·
`ec2ee76bf` COM-003 · `7b53349a1`+`c45838b9d` COM-004 · `e32ee52c6` COM-005 ·
`1fad0cad7` a P85 icon repair this phase did not own and committed separately.

## What session 5 built

- **`library/modules/media-recorder`** — a `Record Media` node. Audio or video, an optional
  `Media Stream` input so it can record a stream `Web Camera` already opened, a `File` straight out
  (no base64 round trip), a blob URL the built-in `Video` node plays, and `Permission Denied` /
  `Device Busy` / `No Device` on their own ports.
- **`scripts/library/drives/media-recorder.js`** — 34 checks, both modes, exit 0.
- **Three examples**, published on five node pages. Corpus 101 → **104**.
- **D5 filed** in [`DEFECTS-THE-COMMUNITY-CORPUS-FOUND.md`](DEFECTS-THE-COMMUNITY-CORPUS-FOUND.md).

## 🔴 Still open, and NOT this phase's

1. **COM-006 AC3 — the Directus author.** Richard's ask, unchanged since s3. ⚠️ We are **NOT**
   missing a Directus connector: `nodegx-backend-contract/src/descriptors/directus.ts` calls it the
   best-evidenced third-party descriptor. Measure what the community prefab adds over that **before**
   asking its author for anything.
2. **Five unowned defects**, all in `DEFECTS-THE-COMMUNITY-CORPUS-FOUND.md`. **D1 is the one that
   matters** — `Open File Picker.success` was renamed to `done` in `a139a3ce5` (ERG-001 §4,
   2026-08-02) with no alias, no migration and no warning; four ports moved in that one commit and
   the rule had been applied seven times. That is the migration story a 0.2.x product needs *before*
   it has users. **D5** (new): the module SDK's own `onNodeDeleted` hook throws at unmount.
3. **`library:icons:check` and `library:verify-dist` were RED at HEAD** when this session started —
   three P85 prefabs from `45929d94c` shipped with no icon. Repaired in `1fad0cad7`. ⚠️ Worth asking
   why P85's gates did not catch it.

## Traps, session 5

- 🔴 **`mounted: false` is NOT an unmount.** Hiding a Group removes its children from the DOM and
  leaves the component's **non-visual nodes alive and running** — a recorder kept the microphone
  live. Only a **route change** deletes the node scope and calls `_onNodeDeleted`. The drive harness
  now ships an `/Away` page so any teardown arm can measure the real thing.
- 🔴 **A general signal fired after a specific one overwrites it.** `Failure` and `Permission Denied`
  both wired to a `States` node — the obvious wiring — and whichever lands last wins. Fire the
  general one **first**.
- 🔴 **A fixed sleep against a device that warms up grades the wrong step.** 1.6s read the status
  *before* the fake microphone handed over its track and failed nine later arms — none of them about
  the recorder. Poll. ⚠️ And a track goes live one beat **before** the node publishes `Started`, so
  the poll condition needs both halves.
- 🔴 **An example is invisible until an ENRICHMENT file names it.** `catalog:examples` validated all
  three at 104/104 and `docs:nodes` wrote 195 files, and **not one of the three reached a page** —
  a node's `examples: [...]` array in `docs/node-catalog/enrichment/<node>.json` is what publishes
  it. `demonstrates` does not. This is session 4's `.filter(Boolean)` trap wearing a second face.
- 🔴 **`npm run library:icons` is `--all-missing`** — it repairs every entry, not yours. Check
  `git status` after running it and commit anyone else's separately.
- ⚠️ **`grep` skipped `render-check.js` as binary** and reported "no matches" for `require(`. Use
  `-a`. This is in memory and it still cost a wrong turn.
