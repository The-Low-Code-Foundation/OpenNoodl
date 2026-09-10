# Next session — phase 86

## Where session 1 left it (2026-09-10)

Scoped from the community export Richard pulled out of the old Noodl community site. **Six tasks
written, one instrument committed, the corpus vendored. No product code changed.**

Read [`README.md`](README.md) first — §2 carries the finding that makes this one phase rather than
three.

## State

| | |
|---|---|
| **Written, not built** | COM-001 … COM-006 |
| **Measured** | everything in [`MEASURED-2026-09-10.md`](MEASURED-2026-09-10.md) — re-run before inheriting any of it |
| **Instrument committed** | [`convert-exports.py`](convert-exports.py) — exports → candidate examples, reproduces 12/12 from the vendored corpus |
| **Corpus vendored** | [`corpus/`](corpus/), 31 files |
| **Committed?** | ✅ **yes — `121fd5c5f`**, the whole folder including the 32-file corpus |

## Before anything else

✅ **Nothing. The folder is committed** (`121fd5c5f`, verified 2026-09-10 by P85 s3:
`git ls-files …/corpus/` returns 32). The earlier "commit this by pathspec first" instruction is
done and has been struck.

⚠️ **The pathspec advice still applies to YOUR commit.** Peers work in this tree continuously — P85
s3 found live edits in `nodegx-export/` and in `noodl-mcp/src/catalog.ts` during one session — so
commit by pathspec, this folder only, and `git add` untracked files first or the pathspec commit
skips them.

🔴 **P85 s3 read your corpus, and it settled a boundary you should know about.** `Components.csv`
is CMP-004 AC3's seed (P85 spent two sessions believing it did not have it). The division is
COM-003 §7's own and P85's docs now state it in the same words: **P86 turns the corpus into examples
and into the three missing library entries; P85 owns the shelf that carries them and its
granularity.** Nothing here changed.

## The first job

In order:

1. 🔴 **COM-006 AC1** — download the three external payloads. Minutes of work, external deadline,
   and two of them are personal Google Drive links. Nothing else in the phase competes with this
   for urgency and nothing else depends on a live link.
2. **COM-001** — the 26 undemonstrated nodes, briefed from the dictionary's 32 blank rows. Highest
   leverage in the phase: it closes a standing `merge.js` warning, gives the MCP examples where it
   has none, and produces the migration answer as a by-product.
3. **COM-004 AC1** — the prefab/node/page-metadata decision for SEO. One paragraph, and it unblocks
   the largest single library gap. ⚠️ Read `Page.tsx:168` before deciding; the page may already have
   the surface.

## Ask Richard for

Nothing blocking. Two judgement calls he may want:

- **COM-004 AC1** — SEO as a node in the picker, or a prefab people install? A node is more work and
  puts it where builders look.
- **COM-006 AC3** — the Directus prefab is someone else's repo. Ask its author to contribute it, or
  build our own?

## ✅ An ask from another phase is now answered

**P85's NEXT-SESSION-PROMPT lists "Ask Richard for: the CSV of community logic and visual nodes"**,
the seed corpus CMP-004 AC3 cannot close without. **It is [`corpus/`](corpus/).** Point CMP-004 AC3
at it. 🔴 Do not build a second shelf in this phase — COM-003/004/005 make the parts, CMP-004 owns
the shelf.

## Traps found in session 1

- 🔴 **The obvious plan failed on the majority.** "Import the community components as examples"
  scores **5/12**. It was tested before it was written down; do not re-plan it as though it were
  free.
- 🔴 **A years-old community component wires a port that does not exist** (`Open File Picker.success`;
  our own prefab correctly wires `done`). Circulation is not verification.
- 🔴 **`wc -l` overstates the dictionary 4×** — 404 lines, 94 records, embedded newlines in quoted
  fields.
- 🔴 **A bare-fence parse undercounts the graphs 10 vs 12** — the corpus also uses ```` ```json ````
  and ```` ```css ```` tags.
- ⚠️ **`timeout` does not exist on this box.** BSD userland.
- ⚠️ **Piping `npm run` into `tail` gives you `tail`'s exit status.** Both gate readings were re-taken
  by redirecting to a file and reading `$?`.
- ⚠️ **`MEMORY.md` had 14 units of headroom before this phase's pointer.** Free space before adding
  anything else.
