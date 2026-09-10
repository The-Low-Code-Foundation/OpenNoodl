# CMP-003 — The doctrine forbids the most reused thing in every real Noodl app

🔴 **The decomposition doctrine said *"Do not plan a component for: a single node."* The
single most instantiated components in the production app we have, and in the library the original
Noodl team shipped, are single-node named utilities.** A model that follows the rule will never
write `Sanitise email`, and the next page grows its own anonymous Function that does the same thing
under no name at all.

✅ **AC1 and AC4 closed 2026-09-10.** Both doctrine copies now state the test as a NAME, not a
node count. AC2 is half done and AC3 waits on the CMP-002 build.

## 1. The person sentence

**A builder opening somebody else's NodeGX project finds the small pieces of thinking under names
they can read — `Format full name`, `Is Trainer check` — instead of finding the same three-line
Function copied into four pages under no name at all.**

Checkable by a person: open a project's shared logic folder and read the component names out loud.
If the list is a set of jobs, it was factored. If the folder does not exist and every page carries
its own unnamed Function nodes, it was not.

## 2. What was measured

Instrument: [`measure-logic-components.py`](measure-logic-components.py), committed beside this task.
"Logic-only" is decided by the enriched catalog's own `isVisual` field, so it is the product's
classification and not a regex over type names. **Working nodes** exclude `Component Inputs` /
`Component Outputs`, which are the interface rather than the work.

| | LearnBook v5.1 (production) | `library/prefabs` (the Noodl team) |
|---|---|---|
| components in the population | 334 total | 197 total, 42 entries |
| **logic-only components** | 37 in the two shared logic folders | **80** |
| **instantiations of those** | **107**, project-wide | — (reuse is within an entry) |
| exactly one working node | 9 of 37 | **20 of 80** |
| one or two working nodes | 21 of 37 | **45 of 80** |
| used 0 or 1 times | 17 of 37 | — |

The top of the reuse table, all from LearnBook:

```
10 x  /#Global logic components/n8n/Core components/n8n core component
 9 x  /Global logical components/Is Trainer check                 (3 nodes, 1 working)
 9 x  /Global logical components/Generate Google icon object      (3 nodes, 1 working)
 9 x  /Global logical components/Format full name                 (5 nodes)
 9 x  /Global logical components/Bulk add relations               (7 nodes)
 8 x  /Global logical components/Navigate to lesson section 1     (12 nodes)
```

### 2.1 🔴 Two numbers in this task were wrong when it was filed, and one of them mattered

Session 1 measured with an uncommitted script. Session 2 could not reproduce two of the four
figures, and the resolution is worth carrying because it is the phase's own §6 rule failing in
practice:

- **"37 components, 107 instantiations"** — ✅ correct, but **only counting BOTH logic folders**.
  LearnBook v5.1 has two: `/Global logical components/` (25) and `/#Global logic components/` (12).
  A prefix filter on the obvious one reads **25 / 88** and looks like a refutation of the task file
  rather than a narrower question. The instrument now names both, in a constant, with a comment.
- **"80 logic-only components, 49 of them one node"** — the 80 is exact; **the 49 reproduces under
  no definition**. One node in the graph: 0. A single graph root: 0. Two nodes or fewer: 3. Three or
  fewer: 21. One working node: **20**. One or two working nodes: **45**. `--definitions` prints the
  table.

⚠️ **The argument is unharmed and the honest number is better.** "45 of 80 are one or two working
nodes" says the same thing as the claim it replaces and survives being checked. A number nobody can
re-derive is one the next session must either believe or re-litigate — which is what happened here.

### 2.2 The honest nuance, kept

17 of the 37 LearnBook logic components are used 0 or 1 times. **Extraction is not free and is not
always repaid in reuse.** But the second reason stands at one use: a named `Sanitise email` in a
shared folder is findable by the next builder, and an anonymous Function on page 4 is not — it gets
recreated. **Findability is the case; reuse is the bonus.** The doctrine now says so rather than
implying that a small graph is the exception.

## 3. Acceptance criteria

**AC1 — the "when not to" rule stops forbidding it.** ✅ **DONE, 2026-09-10.**
`DECOMPOSITION_DOCTRINE_MD` and `DECOMPOSITION_PLANNING` (`prompts/decomposition.ts`) no longer open
their exclusion list with *"a single node"*. Both now state the test — **a name a person would use,
not a node count** — and both carry the new rule *"A named utility is a component however small it
is"* with the measured citations. The two texts were corrected together on purpose: the file's own
header warns that a copy which drifts from the doctrine it enforces silently wins, and the planner's
copy carried the same wrong sentence.

**AC2 — the playbook's tenth pattern.** 🟡 **HALF DONE, 2026-09-10** — P10 is written into CMP-001
§3 with its citations and its three rules. The other half is CMP-001 AC2: the list does not yet ship
anywhere a model reads it, so P10 currently teaches nobody.

P10, the named utility: what shape it has (Component Inputs
→ one working node → Component Outputs), where it lives (a shared logic folder, not beside a page),
and what it is called (a job, in the imperative or as a check — `Format full name`, `Is Trainer
check`, not `Function 3`). Belongs in CMP-001 §3 beside P1–P9, and travels wherever CMP-001 AC2 puts
that list.

**AC3 — a built page produces at least one.** In the CMP-002 graded build, at least one named
logic-only component exists in a shared folder and is instantiated. 🔴 **Graded on the component
tree, not on the tool-call log** — unlike CMP-004 AC5, the question here is what got built, and a
model that calls nothing but produces `Format price` has passed.

**AC4 — the ledger row states the logic-component count.** ✅ **DONE, 2026-09-10.** `STUDIED-APPS.md`
has a `logic` column and all four rows are filled, so the next app studied answers "did it factor its
small thinking?" the same way it answers the interface question. Reported by
`measure-logic-components.py`.

🔴 The column earns itself on the first reading: the shipped landing-page template has **0 logic-only
components of 21**, against 80 of 197 in the prefabs and 37 in LearnBook's shared folders. That is a
fourth failing metric on the arm CMP-002 has to beat, and no existing column showed it.

## 4. What this task does not own

- **Whether the shelf can hold a one-node part.** That is CMP-004 AC3 — the shelf's unit is a whole
  prefab today, so a builder who writes a good `Sanitise email` still has nowhere to put it. This
  task makes the utility a component; CMP-004 makes it shareable.
- **The interface half.** CMP-001. A logic component still owes its parent an output.

## 5. Instrument

[`measure-logic-components.py`](measure-logic-components.py) — reproduces every number above.

```
./measure-logic-components.py                # prefabs + LearnBook v5.1
./measure-logic-components.py --definitions  # the "49" table in §2.1
./measure-logic-components.py --app <project.json>
```
