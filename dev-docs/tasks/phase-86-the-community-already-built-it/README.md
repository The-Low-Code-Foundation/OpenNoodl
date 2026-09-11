# Phase 86 — The community already built it

**Scoped:** 2026-09-10, from the community export Richard pulled out of the old Noodl community
site — years of shared components and a Bubble translation table, in
`nodegx_exports/`, vendored here as [`corpus/`](corpus/).
**Status: OPEN.** **Prefix: `COM`.**

> "Following on from our conversation about looking into existing components, maybe making new
> prefabs, more guides… let me know where you think this stuff could fit into: 1. The MCP
> improvements 2. New modules or prefabs 3. Bubble migration guidance (to steal people away from
> Bubble)." — Richard, 2026-09-10

## 1. The person sentence

**A person arriving from Bubble finds their own vocabulary answered, and an agent building for them
reaches for a part the community already proved — instead of both of them starting from nothing.**

## 2. 🔴 The finding that shapes the phase

The two halves of the export were built by different people for different reasons, years apart.
**They describe the same hole.**

The Bubble dictionary has 94 rows. **32 are blank** in both the "Noodl node" and "Noodl code"
columns — nobody ever filled them in. The node catalog has 176 types and 67 worked examples.
**26 picker types have no example at all.** Set the two lists side by side:

| the dictionary left blank | the catalog cannot demonstrate |
|---|---|
| `Current date & time` | `net.noodl.Now` |
| `is after`, `is before` (×4 rows) | `net.noodl.DateCompare` |
| `rounded down to (second, minute, …)` | `net.noodl.DateParts`, `net.noodl.DateAdd` |
| `<-range->`, `<-max->`, `<-min->`, `:start`, `:end`, `:center`, `overlaps with` | `net.noodl.DateDifference` |
| `:formatted as MD5 hash`, `:formatted as SHA1 Hash` | `net.noodl.Hash` |
| `:format as text`, `formatted as` | `net.noodl.ToCSV` / `ParseCSV` / `UUID` |

**These are the same hole seen from two sides.** The dictionary says *this is what an arriving
Bubble user will ask for first*. The catalog says *this is the corner of the product nobody has
written a worked example for*. Dates, hashing, CSV, ids — the unglamorous half, undocumented, and
sitting directly on the migration path.

That is why this is one phase and not three. **One body of work fills the example hole, answers the
migration question, and produces the reference page — because the missing artefact is the same
artefact.**

### 2.1 🔴 And the corpus is not clean — it is measured

The obvious plan is "import the 12 community graphs as examples". **It was tried, and the gate
refused 7 of them.** Converted with [`convert-exports.py`](convert-exports.py) and scored with the
example gate that already exists:

```
npm run catalog:examples -- --dir <candidates>     EXIT=1
5/12 examples validate clean (strict, warnings-as-errors)
```

The sharpest single finding: **the Dropzone graph — shared for years — wires
`Open File Picker.success`, and there is no such output.** The available outputs are `completed,
done, error, failure, file, name, path, sizeInBytes, type, unchanged`. Our own `file-upload` prefab
wires `done` and is correct, so this is the community graph being wrong (or predating a rename),
not the product.

⚠️ **Read that as the phase's governing caution.** A component that has circulated in a community
for years carries exactly as much authority as the gate gives it, and no more. Nothing here lands by
reputation. Full readings in [`MEASURED-2026-09-10.md`](MEASURED-2026-09-10.md).

## 3. What is actually in the export

33 files, 256 KB, two folders — and the `Components/` half is three different kinds of thing, which
matters because only one of them converts:

| kind | n | what it is | where it goes |
|---|---|---|---|
| **clipboard-JSON graphs** | 12 | 146 nodes total; real components (SEO setter 17 nodes, audio recorder 24, Tiptap 28) | COM-003 → examples; COM-004/005 → library |
| **code snippets** | 14 | Function/Script bodies, one CSS block, one 4 KB cloud function | COM-002 → the phrasebook's code column |
| **external links** | 3 | 2 Google Drive files, 1 GitHub repo | ✅ COM-006 — **recovered 2026-09-11**, [`corpus/external-payloads/`](corpus/external-payloads/PROVENANCE.md) |
| **the dictionary** | 94 rows | Bubble operator → NodeGX node + code; 62 answered, 32 blank | COM-001, COM-002 |

## 4. Tasks

| id | what | status |
|---|---|---|
| [COM-001](COM-001-THE-TWENTY-SIX-NODES-NOBODY-DEMONSTRATED.md) | Fill the 26-node example hole, using the dictionary's 32 blank rows as the authoring brief | ✅ **BUILT** 2026-09-11 — 5 of 5 ACs; 17 examples, warnings 26 → 0, corpus 72 → 89 |
| [COM-002](COM-002-THE-BUBBLE-PHRASEBOOK.md) | The Bubble → NodeGX reference page, in Bubble's vocabulary. Fill the 32 blanks; re-test the Parse-era rows | ✅ **BUILT** 2026-09-11 — 5 of 5 ACs; 94 rows, 0 blank, 77 code cells executed, 18 community rows found wrong |
| [COM-003](COM-003-THE-COMMUNITY-GRAPHS-LAND-OR-DO-NOT.md) | Land the community graphs as examples — through the gate, not around it. 5/12 measured | **NEXT** — instrument committed; COM-002 §7.4 hands it the 14 snippets and the Parse-era marker |
| [COM-004](COM-004-SEO-META-TAGS.md) | SEO meta tags. No node, no prefab, runtime API already there — the biggest library gap in the export | **OPEN** |
| [COM-005](COM-005-THE-RECORDERS-AND-THE-MASONRY.md) | Audio recorder, video recorder, masonry grid — the three remaining gaps our 74 library entries do not cover | **OPEN** |
| [COM-006](COM-006-THE-LINKS-THAT-WILL-ROT.md) | Recover the three external payloads before they vanish; decide on Directus as the third connector | ✅ **BUILT** 2026-09-11 — all three links were still alive, all three recovered; AC3 🟡 on one ask for Richard |
| — | [`MEASURED-2026-09-10.md`](MEASURED-2026-09-10.md) | every reading this phase rests on, with the command that produced it |
| — | [`convert-exports.py`](convert-exports.py) | the instrument: exports → candidate examples. Converts; does not certify |

## 5. What this phase does not own

🔴 **Putting community parts on the installable shelf is [CMP-004](../phase-85-the-component-is-the-backbone/CMP-004-THE-SHELF-NOBODY-IS-TOLD-ABOUT.md) AC3, not this phase.**
That AC already names this export as its seed corpus — *"Richard has a CSV of community-contributed
logic and visual nodes — that is the seed corpus, and AC3 is not done until it is on the shelf and
installable"* — and P85's NEXT-SESSION-PROMPT lists it under **Ask Richard for**. ✅ **That ask is
answered**: the corpus is in [`corpus/`](corpus/). COM-003/004/005 produce the *parts*; CMP-004
owns the *shelf* they go on. Do not build a second shelf here.

Also not owned: whether any existing prefab is good (`library/prefabs/AUDIT.md`); SSR/SSG rendering
mode, which is P16 RUN-002 and is a different question from meta tags in a graph; the site-builder's
own per-page SEO description field, which is P77 SBR-007.

## 6. The success line

**A Bubble user's own words reach a working answer, and the corner of the catalog that answer lives
in has worked examples.** Concretely: the 32 blank dictionary rows are filled or explicitly refused;
`catalog:examples` covers the 26 undemonstrated types; and the reference page exists in Bubble's
vocabulary rather than ours.

⚠️ The phase does **not** claim a migration tool. Nothing here reads a Bubble app. It is a
phrasebook and a parts bin, which is what the export actually is.
