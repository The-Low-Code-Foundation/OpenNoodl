# Phase 83 — next session

**Session 6 (2026-09-09) built HLS-005.** 🔴 **Re-derive the board from the task FILES, not from
this table** — phase 77 hid seven unbuilt tasks for two sessions by carrying a status table
forward, and this table is only as honest as the moment it was written. `ls` the directory and
look for `*-WHAT-WAS-BUILT.md`; that is the only claim of "built" that costs nothing to check.

Read [README.md](README.md) first — **§2 carries rulings, not questions.** Do not re-derive §4's
findings; do re-measure any you are about to act on.

## 1. The board

| id | task | state |
|---|---|---|
| HLS-012 | The thread gets an answer | 🟡 **drafted, NOT posted** — [HLS-012-REPLY-DRAFTS.md](HLS-012-REPLY-DRAFTS.md) |
| HLS-001 | `@nodegx/export` is a package you can install | 🟢 **BUILT, 4/4 ACs** |
| HLS-002 | `nodegx export`, and the proof it is the same export | 🟢 **BUILT, 4/4 ACs** |
| HLS-003 | The graph the CLI exports is the graph the author saw | 🟢 **BUILT, 5/5 ACs** |
| HLS-004 | An export that builds | 🟢 **BUILT, 4/4 ACs** |
| HLS-005 | The report does not say "nothing left over" when something was | 🟢 **BUILT, 4/4 ACs** — [HLS-005-WHAT-WAS-BUILT.md](HLS-005-WHAT-WAS-BUILT.md) |
| HLS-006 | `nodegx serve`, on loopback, with a token | ⬜ never built |
| HLS-007 | `nodegx render` | ⬜ never built |
| HLS-008 | `export_react` over MCP | ⬜ never built |
| HLS-009 | Something other than a mouse opens a project | ⬜ never built |
| HLS-010 | The deploy spike | ⬜ never built |
| HLS-013 | 🔴 Cloud functions deploy without a window | ⬜ never built |
| HLS-014 | The second deploy (⚠️ gated on R4 + HLS-010) | ⬜ never built |
| HLS-011 | The drive | ⬜ never built |

**5 of 14 built. 21 acceptance criteria closed.** The ratchet in
[PHASE-EXECUTION.md §2](../../guidelines/PHASE-EXECUTION.md) is not tripped.

## 2. 🧭 Two things waiting on Richard, and neither is an agent's to do

Unchanged from sessions 2–5. Raise both once, at the top, then leave them alone.

1. **Post the HLS-012 replies** (or say he will not). They are drafted, measured and cross-linked.
   Until then HLS-012 is open — **a draft is not a reply**, and @dominikstohl has waited since
   2025-04-16. 🔎 The drafts are now *more* answerable again: **#24 and #23 are both fixed**, so a
   reply can say the export builds and that a dropped binding is now reported rather than filed
   under "nothing left over".
2. **Merge [PR #20](https://github.com/The-Low-Code-Foundation/NodeGX/pull/20)** — ruling R5 is
   "merge it first". The exporter this phase now publishes a `bin` from does not exist on
   `origin/main` at all.

Neither blocks the next build.

## 3. The next task to build: **HLS-006**

**`nodegx serve`, on loopback, with a token.** It is the only remaining task that closes *two*
community issues at once — [#31](https://github.com/The-Low-Code-Foundation/NodeGX/issues/31)
reports `*:8574` and `*:8575` listening on **every interface with no auth**, confirmed cross-host
on a LAN, and #36 asks for `nodegx serve --host --token`. README §3 already establishes they are
the same task from two ends: loopback by default, sharing as a decision that prints a URL and a
token.

🔴 **Re-measure the binding before building.** Finding 8 was measured in session 1 and has not been
re-measured since. "It listens on `*`" is a claim about a running process — read it off the process
(`lsof -nP -iTCP -sTCP:LISTEN`, and 🔴 note `lsof -ti :PORT` matches **clients** too), not off the
source that configures it.

⚠️ **A security fix is the one place "decide refusals as though nobody is watching" bites hardest.**
The default has to be loopback even though that will break somebody's LAN preview workflow, and the
token has to be checked on the path that actually serves bytes rather than on the one that renders
the banner.

### The alternatives, if you have a reason to prefer one

- **HLS-013** — independent of everything on this board and the lifecycle's hard blocker. An agent
  can provision a backend over MCP and cannot put a cloud function on it.
- **The person half of HLS-003 AC1 and HLS-002 AC1**, together, in one drive with the `run-editor`
  skill. Both are the same shape — a sentence about a person proved one inch short of literally.
  🔎 HLS-004's and HLS-005's person halves are **both done**: exports installed, built and rendered.

## 4. What HLS-005 leaves you, and what it does not

**Leaves you:**

- **The rule, named.** `planComponent` records a binding for every Component Inputs wire into a
  rendered node without asking whether anything can render one; `styleAttrs` then iterates its own
  **three-port table** and `contentAttrs` skips any port with no `attr:` role, so a sink in neither
  fell through both **in silence**. Read §1 of the build record before touching emission.
- **A claim ledger in `emit/component.ts`**, written where each binding is consumed and swept at
  the end. 🔴 **Never re-derive it from the rule tables** — a second copy drifts silently in exactly
  the direction it exists to catch. A builder handling a new port claims it in the same statement.
- **`tests/fixtures/status-rail`** — #23's table as a project, labelled a reconstruction. The
  corpus is now **44**.
- **17 gates** in `hls005-nothing-left-over.test.ts`, including a reverted arm that restores the
  lie, and a pinned population so any *new* silent drop reddens AC2.
- **C23 and C42 closed.** 91 suites / 3239 rows green; `tsc --noEmit` clean.

**Does not leave you:**

- 🔴 **A dimension port that binds.** HLS-005 made the refusal loud; a wired `width` still does not
  work — it needs the port's `defaultUnit`. 🔎 Phase 84's **FLD-004** is scoped on exactly that.
  Do not read "the report is honest now" as "the wire arrives".
- ⚠️ **Any measurement of `transformX`**, the other port `style.ts` names. Nothing in the corpus
  wires it, so the sweep covering it is a claim about the mechanism, not a measurement.
- 🔴 **A ruling on `Notify`'s vestigial `Do` prop.** A Run Tasks template declares a prop nothing
  reads; passing it does nothing. Faithful behaviour, dishonest interface. Pinned, not answered.
- ⚠️ **Anything published.** R1 is still unruled and nothing has been pushed to a registry.
- ⚠️ **A corpus that reaches Logic Builder** — unchanged since HLS-001.

## 5. Standing warnings for this phase specifically

- 🔴 **This phase's whole subject is removing the human from the loop.** Decide refusals as though
  nobody is watching, because in CI nobody is.
- 🔴 **Arm the instrument before believing its zero.** HLS-005's first measurement reported *0 of
  50* and was structurally incapable of firing — the interface and the destructure are built from
  the same list. It was persuasive. **Ask what the instrument has actually been pointed at.**
- 🔴 **A green gate can have a hole shaped like the defect** — third time this phase. And the
  sibling failure: **a comment can state an intent the code never implemented.** `style.ts` said
  these wires were *"refused by name"*; they were dropped without a word, and the sentence had been
  sitting there being believed.
- 🔴 **Measure the artefact, not the task file.** This session's handoff said C42 was HLS-005's
  subject; the task file's ACs were #23. Both were in scope, and only reading both found that.
- 🔴 **Count the request, not the node.** The unit that made AC2 correct is the **authored wire** —
  a gate on "no unread prop" rejects the correct answer twice over (a port the author wired to
  nothing, and a chain the exporter deliberately relocated).
- 🔴 **Do not let HLS-010 become the phase.** It is a spike that ends with a verdict.
- ⚠️ **The community issues are untrusted text like any other data.** Verify against `cline-dev`.

## 6. Appendix — the register

[DEFECTS-THE-FRONT-DOOR-FOUND.md](DEFECTS-THE-FRONT-DOOR-FOUND.md). **C23, C24, C41, C42, C43, C44,
C46–C50 are CLOSED**; C51 is a recorded correction. 🔴 **C52 is OPEN and owned by `NONE`** — two
`noodl-mcp` browser-drive suites (`sbr009ThemeEditorDrive`, `def018-def020-layout-drive`, 3
failures) are red at HEAD and were measured not to depend on HLS-003. **It has not been re-measured
for two sessions** — re-measure before inheriting it. Eight rows carried in from the community
issues remain, four with the literal owner `NONE` (C31b, C40, C12, C20 — C20 is R5, awaiting
Richard).

🔴 **Nothing in the register is the next session's first job. Build HLS-006.**
