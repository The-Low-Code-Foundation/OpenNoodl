# CN-009 — The MCP surface for kits, inside the budget

| Field | Value |
|---|---|
| **Tier** | 3 |
| **Effort** | M |
| **Surface** | `mcp` |
| **Rulings** | ✅ **D7** — this task serves "this project"; **the shelf stays P65 / LBR-008's** |
| **Depends on** | CN-003 |

## ✅ AC5 MET — DRIVEN 2026-08-18 (s26). The task is CLOSED.

A real MCP session against a scratch-built bundle discovered the kit's nodes and **placed one**.
Full readings: [notes/cn-009-ac5-mcp-drive.md](notes/cn-009-ac5-mcp-drive.md).

| | |
|---|---|
| **A1** provenance | 5 kit types of 147, each `providedBy: project-kit` + `kitModule: "Cashflow Kit"` |
| **A2** detail | **23 in / 14 out** exactly, and a `summary` from the author's own `docs` |
| **A3** discovery | 🔴 **`query:"draggable"` now returns the Pill.** It returned `[]` when CN-009 measured it — and so did `"unaffordable"` and `"day track"`, which now find the Banner and the Lane |
| **A4** ✅ **the consequence** | a component placing `Lane` + `Pill`, written from A1/A2 output only, accepted at **0/0/0** and on disk |
| **A4 control** | the same placement with two invented port names is **rejected, nothing written** — so the acceptance is about real ports |
| **A5/A6** controls | `Group` unchanged and unattributed; a kitless project leaks **0** kit types |

⚠️ **`cashflow-command-centre` cannot serve this drive**: it is legacy monolithic `project.json` and
the server refuses it by design. `cn001-kit-drive` (v2) with the tokenised kit copied in is the
substitute, and the next person should expect the same refusal.

🔴 **The drive found a regression D13 caused the same session, which no suite could see:**
`validateCandidate` merges the rules report with the preconditions, and both now run
`checkParameterValues`, so every parameter finding was reported **twice** — including in the counts
an agent reads. Deduped on `diagnosticKey`; regression test in `cn004.test.ts`. The general form is
worth carrying: **a check registered in a second pipeline is a duplicate before it is a feature**,
and every test shaped like *"is this reported?"* is blind to it.

## The job

`list_node_types`, `get_node_type` and `find_tools` answer from the catalog, so they answer about
built-ins only. After CN-003 the overlay exists; this task spends it — an agent working in a project
with kits should see those node types with the same fidelity as built-ins, per **P1**.

## 🔴 The constraint that dominates the design

🔴 **CORRECTED 2026-08-15 — this task was scoped against a bar that had already moved.** The numbers
below are re-read from [`toolDisclosure.test.ts`](../../../packages/noodl-mcp/tests/toolDisclosure.test.ts),
not from the phase-69 scoping session:

| | tokens |
|---|---|
| LEG-001's bar (what this task was written against) | 8,200 |
| measured with **P67 / UNI-010 entirely absent** | **8,198** — two under |
| + UNI-010's `lesson` group, its `find_tools` enum value and its one-line `purpose` | **8,223** |
| **the bar today** | **8,280** — 57 tokens of slack |

**So the "56 of 58 banked tokens are spent" sentence was true and is now history.** What spent them
was phase 67's lesson-authoring group, and the bar was renegotiated to put LEG-001's slack back
rather than to make room for anything new. **The headroom this task has is 57 tokens, not zero — and
it is the same 57 tokens CN-006's `create_node_kit` is competing for.**

🔴 **The renegotiation carries an explicit condition, and it is binding on this task.** The test's own
note reads: *"this is the second renegotiation and there should not be a third … the `$ref` fix is
still the honest answer for the next one."* **CN-009 is the next one.** A design here that ends in
"raise the bar to 8,400" is the outcome that note forbids; the sanctioned move is the `$ref`ed node
schema, which pays for itself because the node schema is currently **inlined three times**
(`create_component.nodes`, `update_component.set.nodes`, `add_node.node`) at ~45 tokens per declared
field per rendering.

⚠️ `a-one-sided-budget-gate-reports-the-crossing-not-the-approach`: the gate tells you when you have
crossed, never that you are about to — which is exactly how UNI-010 spent the slack without knowing
it existed. Measure **before** designing the surface, not after implementing it, and **record the
margin on a passing run** rather than only the verdict.

Two consequences, both binding:

1. **This task must state what it displaces**, not only what it adds. A design that assumes room is
   not a design.
2. **Prefer enriching existing tools over adding new ones.** Kit types flowing through
   `list_node_types` costs nothing at the surface — the tool already exists and its description need
   not grow. A `list_node_kits` tool costs a full entry. CN-006 is *also* competing for this headroom
   with `create_node_kit`; the two tasks must agree on the split rather than each assuming it.

## What to build

- **`list_node_types`** includes kit types, marked with their provenance so an agent can tell whose
  node it is (✅ D1 makes provenance a first-class fact, and an agent needs it for the same reason a
  human does).
- **`get_node_type`** resolves a kit type to its real ports — the same shape it returns for a
  built-in. **P1: no reduced-fidelity path for kit nodes.**
- **`find_tools`** matches kit node names and their `docs` text.
- **`validate_component` / `validate_project`** inherit CN-004's behaviour automatically. Confirm it
  rather than re-implement.

## Acceptance criteria

1. `list_node_types` in the cashflow project returns the five kit types, with provenance, and the
   built-ins unchanged.
2. `get_node_type('nodegx.cashflow.Pill')` returns the **same port detail** the editor's property
   panel shows. Compare against the measured counts (23 in / 14 out) rather than eyeballing.
3. **The surface still passes the token gate at its current bar of 8,280**, with the measurement
   recorded in the task notes — before and after, **as a margin, not as a pass**. Raising the bar a
   third time does not satisfy this criterion.
4. In a project with no kits, every tool's output is unchanged.
5. **Build the caller**: drive a real MCP session that discovers a kit node it was not told about and
   places it. Tool output changing shape is the mechanism; an agent successfully using an unfamiliar
   node is the consequence.

## Traps

- ⚠️ **The MCP `dist/` goes stale, and a fresh `dist/` can still mislead** — running servers load
  from `/Applications/…`, so reaching one needs a repackage. Check the **path and start time** of the
  server you are testing, or you will verify last week's build.
- ⚠️ Do not let kit types leak into a *different* project's answers. One server is bound to one
  project; CN-003's overlay must be scoped, and this is where a leak would first show.

## Out of scope

- Library/shelf discovery and `install_prefab` — ✅ **D7** leaves those with P65's rescoped LBR-008,
  which layers on CN-003 rather than duplicating it.

---

# ✅ BUILT — session 17, 2026-08-17

**4 of 5 acceptance criteria met. AC5's consequence half is not, and says so below.**
`src/catalog.ts` only; 14 tests in [`tests/cn009.test.ts`](../../../packages/noodl-mcp/tests/cn009.test.ts),
**8 of 8 mutations killed**, full `noodl-mcp` jest **599 passed / 51 suites**.

## 1. ✅ AC3 first, because the task says to measure before designing

```
before:  [surface] 8223 tokens / 20 resident tools — 57 under the 8280 budget
after:   [surface] 8223 tokens / 20 resident tools — 57 under the 8280 budget
```

**The margin is unchanged, because this task spent nothing.** No tool description, input schema or
group `purpose` was touched — every fact added travels in a **response**, which the gate does not
measure and a model does not pay for on turns it does not ask. That is the task's own constraint 2
("prefer enriching existing tools over adding new ones") taken to its end, and it settles the binding
renegotiation condition: **there is no third renegotiation, and the `$ref` fix is still unspent and
still available to whoever needs it next.**

⚠️ So the "what does it displace" answer is *nothing* — but note that is a property of this design,
not of the problem. A version that explained provenance in `list_node_types`' description would have
cost ~15–25 of the 57.

## 2. 🔴 Two of the five criteria were already met, and the reasons differ

s16 flagged this and asked for it to be confirmed rather than inherited. Confirmed, by running the
tools against the **real cashflow project** (`NodeGX test projects/cashflow-command-centre`) through
CN-003's headless extractor:

| | before any change here |
|---|---|
| `list_node_types` → the five `nodegx.cashflow.*` types | ✅ all five |
| `get_node_type('nodegx.cashflow.Pill')` | ✅ **23 inputs / 14 outputs** — exactly AC2's counts |
| …with provenance | 🔴 **absent** — row and detail both dropped `providedBy`/`kitModule` |
| `validate_component` / `validate_project` on a kit node | ✅ inherited from CN-004, confirmed |

**AC2 was met on arrival.** AC1's *"returns the five kit types"* half was too; its *"with
provenance"* half was not, and that is the half ✅ **D1** exists for.

## 3. 🔴 The finding: a kit reached the agent with no statement of what it was for

Not in the task, and worth more than the provenance it was found beside.

`summary` was read from `enrichment`, which is generated at **repo-build time and keyed by type
name** — so **a kit type can never be in it**. The author's `docs` sentence was carried faithfully
into the overlay by `@nodegx/kit-catalog` and then dropped here. A kit node therefore arrived at the
model as a name, a category and a list of ports, with nothing saying what it does.

**And it cost the kit its only free-text handle.** `list_node_types`' `query` searches the summary,
so — measured on the cashflow kit before the fix:

| query | before | after |
|---|---|---|
| `"draggable"` | **[]** | `nodegx.cashflow.Pill` |
| `"snaps to whole days"` | **[]** | `nodegx.cashflow.Pill` |
| `"pill"` | `…Pill` | `…Pill` (matched the *name*, which is why the gap was invisible) |

That third row is why nobody noticed: every query anyone would try while *already knowing the node
existed* worked. Only a query by subject — the kind you type when you do **not** know — returned
nothing.

⚠️ **This is CN-008 finding 3 again, in the other consumer.** It was two bugs, not one reachable
twice: the editor reads the repo-build `enrichedNode()` table and this reads the merged catalog
document, so there is no shared upstream that could have held the rule. The fix is deliberately the
same shape as s16's (`kitDocs`), gated the same way, and each side's comment points at the other.

🔴 **The gate is load-bearing and its obvious test cannot fail.** `docs` is one field over two
vocabularies — prose on a kit node, a **URL** on a shipped one (158 of 175 built-ins carry one; 158
of 158 are `docs.noodl.net`). But all 175 built-ins *also* have an `enrichment.summary`, so the
fallback is never reached for them whether it is gated or not: "no built-in shows a URL as its
summary" passes against a completely ungated implementation. The suite's control is therefore a
hand-built node shaped so the fallback **would** fire, and it dies when the gate is removed.

## 4. ⚠️ One scope reading, stated rather than taken quietly

The task says *"**`find_tools`** matches kit node names and their `docs` text."* **Built as
`list_node_types({query})` instead**, for a reason that is structural rather than convenient:

- `find_tools` reveals **deferred tools**. `list_node_types` and `get_node_type` are in the
  **`core`** group and are **resident** — always advertised. So there is no tool for `find_tools` to
  reveal in answer to a kit node's name; the clause as literally written is a no-op.
- Making it match anyway would mean widening the `project` group's `purpose` line, which is re-sent
  on every turn, costs resident tokens out of the same 57, **and is guarded by a deliberate control**
  (`kitTools.test.ts`, *"⚠️ CONTROL — a query about what it DOES does not find it"*) written
  precisely so that trade is re-decided out loud rather than drifted into.

So the capability the clause is after — *find a kit node by what it does, not by knowing its name* —
is delivered, on the resident tool that already answers node questions, for zero tokens. **The
`find_tools` control is untouched and still green.**

## 5. ⚠️ AC5 — the caller is built and driven; the consequence is not met

AC5 asks to *"drive a real MCP session that discovers a kit node it was not told about and places
it"*, and then says the quiet part itself: *"Tool output changing shape is the mechanism; an agent
successfully using an unfamiliar node is the consequence."*

**Built:** a real server over the real protocol walks the whole chain — search by subject
(`"percentage"`, a word in the kit's `docs` and in neither the type name nor the display name) →
read `providedBy: "project-kit"` / `kitModule: "Demo Kit"` off the row → `get_node_type` for the
ports → `create_component` placing the node with a port learned from that answer → validator clean →
files on disk. Its control places the same node with `vlaue` for `value` and gets
`unknown-parameter … did you mean \`value\`?` — the diagnostic, not just a refusal, because "the
validator agreed" is otherwise indistinguishable from "the validator skipped a type it never knew"
(CN-002's state).

🔴 **Not met: the choice to search for "percentage" is mine, not a model's.** Like CN-008's AC1 this
needs a live model, and it cannot be run headlessly. AC5 is the only criterion still open.

## 6. Traps handled

- ✅ **The `dist/` trap.** Nothing here was verified against a packaged server. The suite builds
  CN-003's extractor from source per run (`buildKitExtractor`); a **registered** MCP server still
  loads from `/Applications/…` and does **not** have this change until a repackage.
- ✅ **No leak across projects.** AC4 is asserted over the whole catalog with the overlay cleared:
  zero rows gain a kit field **and** zero summaries start with `http` — the second half matters
  because an ungated fallback changes row *content* without adding a key, which no key-counting
  assertion would see.
- 🔴 **The cashflow figures above are recorded measurements, not assertions.** That kit lives outside
  the repo under no gate (§5 of the phase's carried list), so a suite reading it would pass on this
  machine and fail in every other checkout. Every assertion runs on `tests/fixtures/kit-app` and
  `tests/fixtures/kit-hazards`, which are versioned — and `kit-hazards` is what makes the two-kit
  case real, since a bug stamping every row with the *first* kit's name passes a one-kit fixture.
