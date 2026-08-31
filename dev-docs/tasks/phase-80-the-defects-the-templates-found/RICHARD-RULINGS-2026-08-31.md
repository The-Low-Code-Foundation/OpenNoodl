# Richard's rulings — 2026-08-31 (session 36)

**Captured, not built.** Four decisions ruled, and each ruling carries new scope that did not
exist before it. Read this before touching DEF-036, DEF-007, DEF-033 or DEF-037.

---

## 1. DEF-036 — ❌ **Option B. A wire must NOT declare a column on the accounts table.**

> *"Just defining your ports on a data node is not a good idea to let new users do, and it'll
> create the bad habit of not thinking about the schema as a preamble to performing a data logic
> action."*

🔴 **The recommendation was A and it was overruled on a product-shape argument, not a cost one.**
The point is not that a stray column is expensive; it is that **the schema is meant to be thought
about first**, and a door that mints columns from wires teaches people to skip that step. Do not
re-open this by re-arguing the 271 dropped wires — Richard knows, and the answer is to make the
schema visible, not to route around it.

### What to build instead — three parts, all new scope

**1. An "Add a field" button on the data node itself.** When someone asks *"where's the First Name
field?"* because they never added it to the schema, the node is where they are looking, so the way
out belongs there. It should jump **straight into the table's schema editor** — ideally the exact
table already chosen in that node's dropdown, not the data editor's front door.

**2. When no backend is attached (or it is not running): show nothing and say why.** No Add button,
no field list, **a warning that the project has no backend attached or that it is not active right
now.** ⚠️ This is the case DEF-036 §2 measured — an empty schema today produces *no ports and no
explanation*, which is exactly what makes the dropped wires unreadable. **This warning is the part
that actually closes the person-sentence**, not the button.

**3. A wire to a field that no longer exists stays on the canvas, drawn dotted, and errors.**
Richard: *"originally in Noodl, when a connector was connected to a node where that field had, for
example, been deleted from the schema, it would remain but be a dotted line, and the errors would
flag that the port doesn't exist anymore, which I think is a good method too."*

✅ **Half of this already ships.** DEF-034 built exactly that dash: FB-021's dashed rendering for a
wire the editor calls questionable, and DEF-034's canvas arm was driven in s35. **What to check
before building**: whether a *missing schema field* currently reaches that dashed state or goes
straight to `level: 'error'` and silent deletion. DEF-036 §2 says these wires are
`con-no-target-port` / `con-no-source-port`, **both `error`** — and DEF-034 kept errors deleting.
🔴 **So today they are dropped, not dashed. That is the gap this part closes.**

⚠️ **Scope note:** parts 1 and 2 are *"for our own internal DB"* — Richard said so explicitly. Do
not generalise the Add-a-field button to external backends without asking.

---

## 2. DEF-007 — ✅ **Refuse at publish.** Plus: protect the home page from deletion.

> *"Refuse at publish, make sure people define a home page, it's a very basic requirement."*

Matches the recommendation. A project with no home page must not publish as a template.

### 🆕 New, and not previously on any row: guard the *deletion* of a home page

> *"Can we at the same time make the app scream loudly when someone tries to delete a home page?
> There's already the big error in the preview when no homepage has been selected, but to stop
> people making the accidental deletion mistake."*

The existing preview error is **after the fact** — it tells you the house has no front door once
you are already outside. The ask is to catch the moment of deletion instead. ⚠️ **This is a
separate work item from the publish gate**, and neither one substitutes for the other: publish
catches a project that never had a home, deletion catches one that had a home and lost it.

---

## 3. DEF-033 — ✅ **Show the truth.** Panel shows `-1`, node behaviour unchanged.

> *"Yeah just make it show the truth, that seems like a no brainer."*

Matches the recommendation: align the declared default to `-1` so the panel shows what already
runs. Nothing anyone has built changes behaviour.

🔴 **This row belongs to phase 18, not phase 80.** The ruling is captured here because it was given
here — **P18 must be told, and P18 builds it.** Do not build it from this lane.

---

## 4. DEF-037 — ❌ **Option B. Derive it. The preview must always be truthful.**

> *"That's dumb, the preview is supposed to be a true, live, auto updating view of what's in the
> node canvas at all times."*

🔴 **The recommendation was A (hand-annotate four ports) and it was overruled on principle.** The
argument that carried is not about these four ports: **a preview that is only sometimes truthful is
the defect**, and hand-marking individual ports leaves the class alive — which is precisely how
Checkbox got missed while Radio Button was fixed.

### ⚠️ AC3 as written now contradicts the ruling and must be rewritten

DEF-037 **AC3** currently reads: *"the fix must not be 're-render the whole preview on every style
change'."* That was a previous session's constraint, not Richard's. **The ruling supersedes it.**
Whoever builds this rewrites AC3 rather than trying to satisfy both.

### 🧭 An implementation reading, offered but NOT ruled on — confirm before relying on it

There are two different callers of `setStyle`, and only one of them is the preview:

- **An author changing a parameter in the editor.** Happens at human speed, a handful of times a
  minute. **Nothing is gained by bypassing React here, and correctness is lost.**
- **A wire or animation driving a style at runtime** (opacity per frame). This is the hot path the
  DOM-patching fast path was built for.

So *"always re-render on an editor-driven change, keep the fast path for runtime-driven ones"*
would satisfy the ruling in full without making animation slow. ⚠️ **This is a reading of the
ruling, not the ruling.** If Richard means the fast path should go entirely, that is a bigger and
different change — **ask before building.**

---

## 5. DEF-007 AC4 — ✅ **Ruled: move it into the codebase AND add the test.**

AC4 asks for one thing: *every path that loads a project, and whether it runs the upgrade step
(`applyPatches`).* §6's table already answers it — **4 of the 6 load paths skip the upgrade.** The
content was never the problem; **where it lives is.**

Ruled: take **both** steps, not the cheap half.

1. **Move the table out of this task file** into the codebase — beside `applyPatches` itself and/or
   `dev-docs/reference/`. A task file is a record of a phase; when P80 closes nobody maintains it,
   and AC4's own words are *"the **seam's** documentation"*.
2. **Add a test that fails when a new path reaches `ProjectModel.fromJSON` without going through
   `applyPatches` first.**

🔴 **Step 2 is the point, and the reason is the same one that decided DEF-037.** This is a
hand-maintained list of "which things need the special treatment" — exactly the kind that decayed
until Checkbox was missed while Radio Button was fixed. Without the test it is a snapshot that
looks authoritative and goes quietly wrong the first time someone adds a seventh load path.
