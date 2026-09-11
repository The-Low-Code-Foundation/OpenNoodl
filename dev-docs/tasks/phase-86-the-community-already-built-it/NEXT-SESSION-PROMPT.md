# Next session — phase 86

## The board, re-derived from the task files (2026-09-11, session 2)

| id | what | status |
|---|---|---|
| [COM-001](COM-001-THE-TWENTY-SIX-NODES-NOBODY-DEMONSTRATED.md) | The 26 undemonstrated node types | ✅ **BUILT** s2 — 5/5 ACs |
| [COM-002](COM-002-THE-BUBBLE-PHRASEBOOK.md) | The Bubble → NodeGX reference page | 🔴 **NEXT** — its answers now exist |
| [COM-003](COM-003-THE-COMMUNITY-GRAPHS-LAND-OR-DO-NOT.md) | Land the community graphs as examples, 5/12 measured | **OPEN** — instrument committed |
| [COM-004](COM-004-SEO-META-TAGS.md) | SEO meta tags | **OPEN** — AC1 is a one-paragraph decision |
| [COM-005](COM-005-THE-RECORDERS-AND-THE-MASONRY.md) | Audio/video recorder, masonry grid | **OPEN** — its chat-module input is now recovered |
| [COM-006](COM-006-THE-LINKS-THAT-WILL-ROT.md) | Recover the three external payloads | ✅ **BUILT** s2 — AC1/2/4 closed, AC3 🟡 on one ask |

**Two of six built. Commits: `503bb44e8` (COM-006), `95e0efac1` + `4d15ead3b` (COM-001),
`5f6634166` (the P85 table COM-001 moved).**

## The first job

🔴 **COM-002 — the phrasebook.** It is next because COM-001 just built the answers it has to write
down, and because it is the only remaining task whose input is complete. Read **COM-001 §7.2 and
§7.3 first** — they carry five rows' worth of answer that the dictionary itself cannot supply:

- **Three rows have NO answer and must be recorded as gaps, not left blank a second time:**
  `:ranked by`, `contains keyword(s)`, `doesn't contain keyword(s)`. 🔴 `Expression` `.includes()` is
  **not** the answer — the corpus's own note says Bubble tokenises, drops stop words and matches
  stems, and `.includes()` gets Bubble's own worked examples wrong in **both** directions. COM-001
  §7.2 nominates COM-002 as the owner of writing these down; **an unowned row gets rediscovered at
  full price.**
- **The two hashing rows get an answer that is a refusal.** `net.noodl.Hash` is SHA-256/384/512 only;
  MD5 and SHA-1 are deliberately absent because WebCrypto implements neither for digesting. A Bubble
  app's stored MD5 fingerprints will not reproduce — that is a re-hash, not a translation.
- **Bubble has a date-range TYPE and we do not**, which is why 16 of the 32 blank rows are range
  rows. The translation is not a missing feature: it is two `Date Compare`s and one identity, worked
  through in `bubble-do-two-date-ranges-overlap`.

Then COM-004 AC1 (a paragraph; ⚠️ read `Page.tsx:168` first — the page may already have the surface),
then COM-003 or COM-005.

## Ask Richard for

1. 🔴 **COM-006 AC3, the only thing blocking a built task.** The Directus prefab is BSD-3-Clause and
   organisation-owned, so the licence permits a derivative — but its README sells a commercial
   *"Boilerplate Kit"* built on it. **Would its author rather contribute it themselves?** That is a
   courtesy question only Richard can put, and the answer changes what gets built.
2. **COM-004 AC1** — SEO as a node in the picker, or a prefab people install?

## What session 2 recovered, and what it found

- **All three external links were still alive.** `corpus/external-payloads/` now holds
  `signup_template.zip`, `chatcontainer-module.zip` and the Directus tarball, each with URL, UTC
  timestamp, byte count and sha256 in [`PROVENANCE.md`](corpus/external-payloads/PROVENANCE.md).
- 🔴 **The chat module's ORIGINAL SOURCE survived inside its own sourcemap** — `sourcesContent` still
  held `ChatContainer.jsx` complete. **Check a minified community bundle for a sourcemap before
  calling it unreadable.** COM-005 should build from `chatcontainer-module-src/`, not the bundle.
- 🔴 **The signup template is superseded and it is not a judgement call**: its twelve cloud component
  names are an IDENTICAL SET to `library/prefabs/email-verification`'s twelve, and where they differ
  ours is larger. **But its one residue is a real hole** — searching every `project.json` under
  `library/`, every `Verify Email` component we ship is cloud-side. We ship the server half of email
  verification and **no page for the link in the email to land on**. That belongs to whoever next
  touches `auth-pages`; P86 does not own the shelf.
- 🔴 **AC2's description of the chat module was wrong**: it does scroll anchoring and **no pagination
  at all**. Judge it as anchoring plus scroll telemetry; it does not overlap `virtual-list`.

## Traps, session 2

- 🔴 **`grep` for a "sort or order port" matches `border`.** That near-miss almost recorded `:sorted`
  as a product gap. `Filter Collection` **does** sort — from its filter settings, not from a named
  port. **Measure the node, not the port list.**
- 🔴 **The example baseline was 72, not the 67 COM-001 asserted.** Re-measure before trusting a task
  file's arithmetic.
- 🔴 **Three enrichment files had no `examples` key at all**, not an empty one. A fix written as
  "replace `"examples": []`" skips them silently and leaves warnings standing.
- 🔴 **Moving the example corpus moves CMP-001's publish-rate spec** (`cmp001InterfaceDoctrine`),
  and the doctrine text in `interfaces.ts` plus three prose copies in `noodl-mcp/src` state the same
  figure. It went 26% → 33%. Expect that spec to go red whenever you add examples — that is what it
  is for.
- ⚠️ **`measure-interfaces.py` prints 32 where the spec reads 33.** 13/40 = 32.5%; Python breaks the
  tie to even, JavaScript breaks it up. Not a bug in either, but do not "fix" one to match.
- ⚠️ **Four noodl-mcp suites are red and none of them is P86's**: `tpl001Template`, `tpl003Template`,
  `sbr009ThemeEditorDrive`, `def018-def020-layout-drive`. Grep returns **zero** references to the
  enriched catalog or the doctrine in all four. Re-measure before inheriting them.
- ⚠️ Peers were live in this tree all session (P84 charts, then P18). **Commit by pathspec**, and
  `git add` untracked files first.
