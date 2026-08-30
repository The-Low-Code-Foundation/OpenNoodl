# Phase 80 — Richard's rulings, 2026-08-30

**All five 🧭/🔒 rows ruled in one pass, plus the disposition of five newly-found phase 77 rows.**
Captured verbatim as decisions; **none of it is built.** The next session builds it — see
[NEXT-SESSION-PROMPT.md](NEXT-SESSION-PROMPT.md).

🔴 **Read the reason as well as the choice.** Two of these went against the recommendation put to
Richard, and a session that reads only the verdict will rebuild the argument.

---

## DEF-005 — membership · **BUILD BOTH HALVES**

> **(a)** a read-only `roles` output on the `User` node, resolved from the session the same way
> enforcement resolves it (`SecurityState.rolesForUser`), **and (b)** a cloud `List Users In Role`
> node.

**The security posture is unchanged and that is the load-bearing part of the ruling:** the
cloud-only rule on the role **writes** (`addusertorole`, `removeuserfromrole`) survives intact.
*"Adding the current user to a role from a client-side graph is one wire from a button to 'make me
an admin'"* — still right, still enforced. **Reading one's own roles grants nothing**; the server
decides every request regardless.

- **(a)** removes the round trip and the *flicker through "nothing here"* on the most common branch
  in the product. Without it every membership app writes a bespoke `myStanding` cloud function
  just to decide whether to render a page.
- **(b)** is what TPL-001 ships without. The junction exists and the resolver already walks it one
  way; there is no inverse of `getuserroles` today, so *"show me the member list"* — the most
  ordinary screen in a membership app — cannot be built at all.

🔴 **AC3 is not optional and is the whole reason (a) is safe**: a **negative control** asserting
that a user who edits the new output client-side is **still refused by the server**. Assert the
refusal, not just the read — and beside a known-firing signal, because *"the role read was
refused"* and *"the role read was never requested"* look identical and have opposite fixes.

⚠️ Both are a **port and a node** — neither is a new table or route, so neither owes the UNI-001
four sweeps. Keep it that way; a method fires none.

---

## DEF-013 — three spellings of a component name · **RE-DRIVE FIRST, THEN DECIDE**

**The ruling is deliberately not a fix**, because the measurement it would be based on is four
days old and the door has moved underneath it.

SB-012 §1's table was measured **2026-08-26**. Since then the door's `components` list has been
rebuilt from `authoredProjectViews`, **which overlays a plan's unapplied operations** — the exact
gap the table records. The two-pages-that-link-to-each-other plan may now stage clean, in which
case the row costs nothing and no ruling is needed at all.

✅ **First act: re-drive SB-012 §1's table at HEAD**, on a live server built from `src`, with two
throwaway pages that navigate to each other staged into one plan. Then, and only then:

- if it still fails → the three candidates stand, and **option 1 (resolve `target`/`template`
  against unapplied siblings) is the presumptive answer**: smallest change, fixes the plan door
  completely. Its known weakness is that it does nothing for `create_component`, the door an agent
  reaches for first and the one SB-005 actually used.
- 🔴 **Option 2 (downgrade to a warning) is ruled OUT permanently.** `repeater-template-unresolved`
  is one of SB-009's known-firing controls, and a Repeater whose template resolves to nothing is
  silently empty at runtime. **A door that fails closed and names its own fix is the better half of
  this defect.**
- option 3 (`create_components` plural, validated as a set) matches the problem's real shape and
  overlaps the plan door's remit; it stays on the table but needs its own decision.

⚠️ The two-pass workaround is cheap, written down, and graded by a known-firing control in
`sb005AdminPanel.test.ts`. **Nothing is blocked.**

---

## DEF-009 AC4 — the public `rateLimit` default · **60/min, burst 30 — matching `auth`**

🔴 **This went AGAINST the recommendation put to Richard**, which was to keep `null` and merely
record the reason. The decision is to **change behaviour**: a public, writing cloud function with
no `rateLimit` gets a real default.

**The number sits on the ladder the product already has** rather than inventing a rung:

| class | ratePerMinute | burst |
|---|---|---|
| oauth start | 20 | 20 |
| **`auth`** | **60** | **30** |
| `admin` | 300 | 100 |
| `data` | 1200 | 400 |

**60/min, burst 30, per key.** A contact form submitted 30 times in a burst and then once a second
sustained is far beyond any legitimate human use; a bot writing rows until the disk is full is
stopped cold. The product already assigns this weight to **logging in**, and a public write is not
a lighter act than that.

⚠️ **It changes behaviour for every existing public writing function, so it owes a corpus check
before it lands** — the sweep already counted **27 unlimited public write doors across 23
projects, all `submitContactForm`**. Re-run it, confirm the shape, and confirm none of them
legitimately bursts past 30. 🔴 **Do not measure the limiter by "the row did not appear"** — a
refused write and a filtered read are the same shape.

`burst: 0` / `ratePerMinute: 0` is the limiter's existing "unlimited" convention; the default must
not collide with it.

---

## DEF-025 — the label default · **FLIP AT CREATION, IN BOTH DOORS**

Not a runtime flip. The editor **and** the MCP door author `useLabel: true` onto **newly placed**
`Checkbox` / `Radio Button`, in the `STARTER`-params shape.

- **New work gets a real click target**; **no existing rendering moves**; nobody's checkbox
  suddenly renders the literal string **"Label"**. That last consequence is what makes the blunt
  flip (option 1) not a candidate, and it remains ruled out.
- **Both doors, not one.** They are the two ways a toggle gets created. Fixing only one leaves the
  other producing controls whose words are not a tap target — and then the advisory
  `label-not-a-click-target` warning fires **on the product's own output**, which is exactly the
  situation s17 already hit when `catalog:examples` went 61/62 on a shipped recipe.

✅ The advisory rule shipped at s17 stays as it is: 43 true firings over the corpus are legitimate
legacy instances, which is `raw-color-literal`'s situation and not a promotion.

⚠️ **The catalog-flip spec arm from s17 already anticipates this**: the rule reads the effective
default from the catalog, so on the day a default flips the rule falls silent on unset ports **with
no second edit**. Check that arm still holds after this lands — it is also the only thing that
makes the authored-bag-only mutant killable.

---

## DEF-007 §3.2 — disk and load disagree · **THE TEMPLATE WRITES EXPLICIT VALUES**

Drive the **56 disagreements across 13 components** to zero by making template generation write the
values, rather than by teaching the disk-reading paths to apply the load-time migrations.

**Why the narrow one.** It is what phase 78 D14 chose for its own template. The artefact becomes
correct **as written**, so export, MCP and headless render agree without changing what four
packages read. The wide option re-grades every corpus that reads from disk.

⚠️ **Sequencing is a real constraint, not a caveat.** `site-builder.content.json` is **phase 77's
live lane** — they landed `505d9b38` during s23 and their D30/D31 work touches the same generator.
✅ **Check `git log -5 --` on that file and its mtime before starting**, and coordinate rather than
race.

🔴 **AC3 is a PAIR and must stay one**: the artefact rendered from disk **and** the same project
loaded in the editor, asserted together. Either one alone is the state this task exists to
distinguish. And the byte gate cannot help — it compares the artefact to a fresh run of the same
generator, so a field neither side writes is a field both sides "agree" about. **It passed over D9
exactly this way.**

The seam itself is already documented (§6): the whole thing is one call, `applyPatches(content)`
immediately before `ProjectModel.fromJSON(content)`. Editor open ✅ and VCS snapshot ✅ apply it;
headless preview, code export, MCP and template generation ❌ do not. **Applying the migrations on
the disk paths stays named as the wider follow-up** — this ruling narrows the fix, it does not
delete the gap.

---

## The five phase-77 rows with no home · **REGISTER ALL FIVE IN PHASE 80**

Registered as **DEF-028** (D13, build determinism) · **DEF-029** (D15, no file-drop) ·
**DEF-030** (D16, the ratchet that cannot fail) · **DEF-031** (D22, no `text-overflow`) ·
**DEF-032** (D32, the migration grade that reaches 1.5%). By reference — phase 77's register keeps
the measurements.

**Not a fresh phase 81**, which was offered: a phase boundary is what produced this situation
twice already, and DEF-005/013 show that rows survive a boundary only by being carried explicitly.

D12 and D29 stay with phase 77 — both template-side. **Seven found, five carried, two placed
elsewhere**, named so the split is a decision and not a gap.
