# SB-014 — The row nothing creates

**Status: ✅ FIXED s10, by §4's fix 1.** Nothing in the site-builder template created a `Theme`
record, so on every new site the theme editor's **Save wrote nowhere** and the site kept the shipped
palette permanently. `claimSite` now mints the `Theme` singleton beside the `SiteSettings` one, in
the same graph and with the same world-read ACL.

Probe, now the evidence it is fixed:
`packages/nodegx-backend/tests/sb008-public-site-drive.test.ts`, describe **"✅ F20"**, plus
`sb004-publication-invariant.test.ts` **"🔴 writes exactly ONE of each singleton"**.

## 1. What was measured

On a real backend, immediately after a real `claimSite` and before the drive seeded anything:

- `GET /classes/Theme` as the owner → **0 rows**.
- `GET /classes/SiteSettings` → the row `claimSite` wrote.

And a census over all three component sets (`sb004Components.ts`, `sb005Components.ts`,
`sb006Components.ts`) of every `NewDbModelProperties` node — the only record-creating node type any
of them uses:

| collection | creators |
|---|---|
| `Page` | 2 (`Admin` creates a draft, `duplicatePage` copies one) |
| `Section` | 2 |
| `ContactMessage` | 1 |
| `SiteSettings` | 1 (`claimSite`) |
| **`Theme`** | **0** |

⚠️ The control beside it, so an empty list is an absence and not a broken census: creators *do* exist
and the `SiteSettings` count is asserted at exactly 1.

## 2. Why the panel cannot make one

`Pages/ThemeEditor` saves through **`SetDbModelProperties`** with `idSource: 'explicit'`, and the id
comes from `theme.firstItemId` — the `Query Records` node over an empty collection. `firstItemId` is
`undefined`, so the save has no target.

It fails silently rather than loudly, which is the part that makes it a defect rather than an
inconvenience: the author types a colour, presses Save, is navigated back to the list by the
`goBack` wire, and nothing anywhere says the write did not happen.

## 3. What it costs

Both halves of the theme contract SB-006 asserted are structurally correct and behaviourally dead on
a fresh site:

- SB-005's `buildTokens` writes `{ colorPrimary, colorBackground, colorText, fontFamily }`;
- SB-006's `applyTheme` reads exactly those keys and sets three CSS custom properties plus a family.

The cross-file contract holds. There is simply never a row for it to hold *over* until somebody
writes one through the REST API by hand — which is what SB-008's drive had to do to measure the
theme half at all.

## 4. Two fixes

1. **`claimSite` seeds a default `Theme` the way it already seeds `SiteSettings`.** One more
   `NewDbModelProperties`, the same `SITE_SETTINGS_RULES` ACL (the public site reads it), a default
   token set. The pattern is one node away in the same component and the row is world-readable for
   the same reason.
   ⚠️ It touches `claimSite`, which is also **SB-013**'s subject — do them together or the second one
   re-grades the first one's mutants for nothing.
2. **The theme editor creates on first save.** A `Condition` on `theme.isEmpty` choosing between a
   `NewDbModelProperties` and the existing `SetDbModelProperties`.
   ⚠️ `isEmpty` is `true` **before** the first fetch by contract (`dbcollectionnode2.ts:410-419`), so
   this branch must be driven from `fetched` and not from load — the same trap SB-006 §1 recorded and
   the reason its not-found panel is computed in a code node.

🧭 **1 is the smaller change and the one that matches how `SiteSettings` already works**, which is
the argument for it: a template with two singletons should mint both in the same place. It is filed
rather than taken because it edits a **closed** task's graph, and because a default palette is a
product decision — the shipped tokens are already a reasonable default, and seeding a row that
duplicates them makes the theme editor's first Save a no-op *visually* even when it works.

## 5. What this is an instance of

A record class with a reader, an editor and **no creator** is invisible to every check this phase
has: the authoring doors validate one component at a time, the structural specs assert what each
graph reads and writes, and a cross-file contract check compares the two ends of a pipe that is never
filled. It took a run on a **freshly claimed** backend — the state a real first user is in and no
fixture ever is — to see it.

⚠️ Worth a corpus sweep of its own: **for every collection a template reads, is there a node that
creates it?** That is a question a linter could ask of any project, and nothing asks it today.

## 6. What s10 shipped, and the product decision it declined to make

Fix 1, taken with SB-013 in one pass over `claimSite` so the second did not re-grade the first's
mutants. One `NewDbModelProperties` node, `SITE_SETTINGS_RULES` for its ACL, chained
`mark.done → seedTheme.store → res.send`.

🔴 **The seeded tokens are the four keys, all empty**, and that is deliberately not a palette
decision. `applyTheme` only overrides a custom property when the value is truthy, so an empty set
renders exactly what the site already ships — seeding it changes nothing a visitor sees and gives
the editor a row to write to. It is byte-for-byte the shape `buildTokens` produces from a form saved
with every field blank, so the seeded state and the authored state are one state. §4's objection —
*"seeding a row that duplicates the shipped tokens makes the first Save a visual no-op even when it
works"* — is answered rather than accepted: with empty tokens the first Save is the first thing that
has ever had a visible effect.

⚠️ **The failure edge is wired to the SUCCESS response, not the refusal.** By the time this node
runs the role is granted and the settings row is written: the site *is* claimed. Answering `This
site cannot be claimed.` would send a real admin away believing they are not one, with no second
claim possible — a worse outcome than a missing convenience row. The theme row is a convenience;
the claim is the contract. Asserted in `sb004Authoring.test.ts`.

✅ **§5's general shape is now a check rather than a moral.** SB-008's census asserted `Theme` had
no creator; it now asserts each singleton has **exactly one**, named. That is the linter question
§5 asked for — *for every collection a template reads, is there a node that creates it?* — asked
over this template. Asking it of any project is still open, and is the better half of the idea.
