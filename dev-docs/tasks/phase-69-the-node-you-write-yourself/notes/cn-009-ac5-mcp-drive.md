# CN-009 AC5 — an agent discovers a kit node and places it. The drive.

**Written BEFORE the session was started, 2026-08-18, session 26.**

AC5: *"Build the caller: drive a real MCP session that discovers a kit node it was not told about
and places it. Tool output changing shape is the mechanism; **an agent successfully using an
unfamiliar node is the consequence**."*

## ⚠️ The honesty problem with me as the agent, stated first

I have read this phase. I cannot un-know that `nodegx.cashflow.Pill` exists, so "discovers" cannot
mean "was surprised". What *can* be graded, and is the thing AC5 actually cares about, is
**sufficiency**: is what the tools return enough to place the node correctly, using nothing else?

So the rule for this drive: **every field I write must be traceable to a tool response in this
session.** No reading `index.js`, no reading the task files, no port names from memory. If the tool
output is insufficient, the placement fails validation and that is the finding.

## The observations

| # | Observation | "works" looks like | "does not" looks like |
|---|---|---|---|
| **A1** | `list_node_types` names the kit's types with provenance | the 5 `nodegx.cashflow.*` types, each carrying `providedBy: 'project-kit'` and its `kitModule` | types absent (CN-003 not applied) — or present with **no provenance**, which is the half CN-009 found missing |
| **A2** | `get_node_type` says what the node is **for** | a `summary`/`docs` sentence sourced from the kit author's own `docs` | `summary` undefined — the CN-009 defect back: enrichment is keyed by type name and generated at repo-build time, so **a kit type can never be in it** |
| **A3** | Free-text discovery reaches the kit | `list_node_types({query})` with a word from the author's prose returns the node | `[]` — the measured pre-CN-009 state: `query:"pill"` worked, `query:"draggable"` returned nothing against a node whose docs open with that word |
| **A4** | 🔴 **The consequence.** A component placing the kit node, written from A1–A3 only, is accepted | `create_component` accepted **and** `validate_component` clean | rejected, or accepted-then-red — meaning the ports the tools described are not the ports the node has |
| **A5** | Control: a built-in answers unchanged in the same session | `Group` returns its usual ports, no `providedBy: project-kit` | a built-in carrying kit provenance ⇒ the overlay is leaking |
| **A6** | Control: the kit project's answers do not leak into a kitless one | a second server on a no-kit project lists **0** `nodegx.cashflow.*` | any ⇒ CN-009's trap 2, scoping |

⚠️ **A4 is the only row that is the consequence.** A1–A3 are mechanism and would each be equally
true of a surface that hands an agent a node it still cannot use.

---

# THE RESULTS — written after the drive

✅ **DRIVEN 2026-08-18, session 26. All six observations met, and the drive found a regression that
no suite could see.**

Server: `src/cli.ts` bundled by esbuild to a **scratch** path
(`scratchpad/mcp-build/noodl-mcp.cjs`), never over `packages/noodl-mcp/dist/` — peers' registered
servers load that file and four were running during this session. Started with `--allow-writes
--all-tools` (97 tools). Project: a `cp -R` of `cn001-kit-drive` (v2) with the **D8-tokenised**
cashflow kit copied in.

⚠️ **`cashflow-command-centre` cannot be used for this drive at all**: it is a legacy monolithic
`project.json` and the server refuses it by design, naming the migration. That is why the numbers
below come from `cn001-kit-drive`.

## A1 ✅ — provenance, on all five

`list_node_types` returned **147** types, five of them the kit's, each carrying
`providedBy: "project-kit"`, `kitModule: "Cashflow Kit"` and `availableIn: ["browser"]`.

## A2 ✅ — 23 in / 14 out, and it says what the node is FOR

`get_node_type({ type_names: ['nodegx.cashflow.Pill'], detail: 'full' })` — ⚠️ `type_names`, an
**array**, not `type_name`; my first call was rejected by the schema, which is why the handover says
to read `inputSchema` from `tools/list` first.

- **23 inputs, 14 outputs** — exactly the counts CN-009 AC2 names.
- `summary`: *"A draggable money pill that snaps to whole days and reports the day it lands on."* —
  the kit author's own `docs`, i.e. the field CN-009 found was being dropped.
- ✅ **D8's work is visible to the agent**: the colour defaults arrive as `var(--red-600)`,
  `var(--green-600)`, `var(--primary-foreground)`, not as hex.
- `docsUrl`: `undefined` — correct. This kit declares none, and D10 shipped the field today.

## A3 ✅ — the discovery half, and this is the one that changed

CN-009 measured that `query:"draggable"` and `query:"snaps to whole days"` both returned **[]**
against a `Money Pill` whose docs open with those words, while `query:"pill"` worked — so every
query you would try *knowing the node exists* passed, and only discovery failed.

| query | kit hits |
|---|---|
| `pill` | `nodegx.cashflow.Pill` |
| **`draggable`** | **`nodegx.cashflow.Pill`** |
| `day track` | `nodegx.cashflow.Lane` |
| `unaffordable` | `nodegx.cashflow.DangerBanner` |

Three of those four match on the **author's prose** and nothing else.

## A4 ✅ — THE CONSEQUENCE: the node was placed, and the acceptance is not vacuous

A component was created placing `nodegx.cashflow.Lane` and `nodegx.cashflow.Pill`, every port name
and value taken from A1/A2 output only. `create_component` accepted it —
`validation.summary {errors: 0, warnings: 0, infos: 0}` — `validate_component` returned **0/0/0 over
3 nodes**, and both kit node types are on disk with their parameters.

🔴 **The control that makes that mean something.** The same placement with two invented port names
(`pillAmount`, `dayNumber`) was **rejected, nothing written**, naming both against the kit type. So
"accepted" reflects the ports the node really has, not a check that waves kit types through.

## A5 ✅ / A6 ✅ — both controls

`Group` in the same session: 87 inputs, no `providedBy`, no `kitModule`. A second server bound to a
kitless project: **0** `cashflow` types and **0** `project-kit` types of any kind.

---

## 🔴 What the drive found that no suite could: D13 doubled every parameter finding

The rejection above listed `pillAmount` and `dayNumber` **twice each**.

`validateCandidate` merges the semantic validator's report with `preconditionDiagnostics`. D13 (this
session) registered `rules/parameterValue`, which runs `checkParameterValues` — the same function the
precondition set has always run. Every parameter-value finding therefore appeared twice: in
`diagnostics`, in the `readable` list an agent is shown, and in the `summary` counts.

⚠️ **Nothing went red, and the reason is worth keeping.** `cn004.test.ts` compares the two pipelines
by calling them **separately**, and the staging tests assert diagnostic *codes*, not cardinality. An
overlap between two sources is invisible to every assertion shaped like "is this finding present".

✅ **Fixed by deduping at the merge point on `diagnosticKey`** — the identity that file already
trusts for baseline exemption — rather than by removing `checkParameterValues` from the preconditions,
which would silently drop it for callers that run the preconditions alone (the editor's authoring
loop does exactly that). Regression test: `cn004.test.ts` → *"reports one mistake once, though two
pipelines now find it"*, which reddens when the dedupe is reverted.

🔴 **The lesson, and it is a general one: a check registered in a second pipeline is a DUPLICATE
before it is a feature.** D13's own tests all asked "is it reported?" — the question that cannot
detect being reported twice.
