# ERG-005 — Component Inputs / Outputs

| Field | Value |
|---|---|
| **Tier** | 2 |
| **Prerequisites** | none for §1. §2 is a design decision and should not start before §1 lands |
| **Recommended executor** | 🔴 Opus for §1 (a mechanism with no documentation channel is a plumbing problem, not a writing one) |
| **Origin** | Richard, 2026-08-01: *"they're sacred, there are a lot of things to know about them"* |

## Why this is not just a documentation task

`Component Inputs` and `Component Outputs` **define every component's public interface** — they are how
a component tells the rest of the project, and the AI authoring loop, what it accepts and returns.

They are also **the only mechanism in the library that cannot be documented by any means the library
has.** Their ports come from the **Port Editor panel**, which is one of four dynamic-port mechanisms
and one of the three that carry no `description` channel at all (FINDINGS **SR-ii**):

| Mechanism | Documentation channel |
|---|---|
| Declared ports | ✅ `description` — fixed by NDA-005 §0 |
| `sendDynamicPorts` | ❌ carries no `description`; nothing has asked it to |
| `numberedInputs` | ❌ writes no metadata entry at all (`nodedefinition.ts:100-131`) |
| **Port Editor panel** | ❌ **worst of the four** — and it is this task's |

So NDA-005 reports these nodes as `n/a` on coverage, and the audit's 90.4% library-wide figure
measures one mechanism of four. **An author cannot be told the rules, the validator cannot enforce
them, and the AI loop cannot know them.** That is the defect; the prose is the easy part.

## §0 — The rule nobody has written down

Richard, from memory, and it needs verifying against source before it is documented as truth:

> when you declare inputs and outputs, they only become a 'type' instead of Any when you connect them
> inside the component to something with a clear type. So if you define on the Component Input
> 'orderNumber' and connect it to a number node, or a Function or Script number input, or a state
> Number input, then when you place that component it'll expect a number.

**§0 is blocking and it is measurement, not writing.** Establish, live:

1. Is the inferred type taken from the first connection, the most recent, or something else?
2. What happens when an input is connected to two things of **different** types inside the component?
3. What happens when the connection that supplied the type is **deleted** — does the outer contract
   revert to `Any`, and do existing outer connections survive?
4. Does the same rule govern `Component Outputs`, or only inputs?
5. Does the inferred type reach the **catalog** — i.e. can the validator and the AI loop see it, or is
   it editor-only?

⚠️ **Do not answer these from source alone.** Both `Page`'s dead `Title`/`Url Path` ports and
`Page Inputs`' total absence of connectable ports lived inside `setup()`, **which `graph-harness` does
not call** — three findings this phase. Drive the editor.

⚠️ **And treat the recollection as a hypothesis.** Phase 30 found four stale spec premises in a single
batch, and its standing rule is that an inherited claim is a hypothesis whoever inherits it must test.
That applies to a remembered rule too, including this one. If §0 contradicts §0's own quote, the
measurement wins and this file gets corrected.

## §1 — Give the mechanism a documentation channel

The build. Whatever §0 measures is unwritable until this exists.

- The Port Editor's port definitions gain a `description`, carried through to the catalog the same way
  NDA-005 §0 carried declared ports' descriptions (which had been declared on both port types and
  **copied nowhere** — the field authors were told to write was inert).
- The two nodes themselves get real prose: what they are for, and §0's typing rule stated plainly.
- The rule reaches the **AI authoring loop's context**, because "add a component input" is a thing the
  loop does and it currently cannot know what happens next.
- ⚠️ **`description` is canonical** (Richard, 2026-08-01). Enrichment `ports` may only add what the
  source cannot know; `tooltip` is display-only and derived. Do not put this prose in enrichment
  because the channel is easier.

Consider whether the same fix serves `numberedInputs` — two nodes (`String Mapper`, `Index To String`)
are undocumentable through it, and if one change covers both mechanisms it should.

## §2 — The typing decision (do not start before §1)

Should a Component Input carry an **explicit** type instead of inferring one?

**Recommendation: add the explicit option, keep inference as the default, do not make it breaking.**

**For inference.** It is genuinely good ergonomics and it is part of why components feel light to
build. Nobody wants to declare a type for a value that is obviously a number.

**Against, and it is a real failure mode.** The type of a component's **public** interface is decided
by an implementation detail **inside** it. An innocent internal rewiring silently changes the contract
every caller depends on, with nothing on the outside saying why — and phase 30 has a name for this
shape: it is the same class as `Slider`'s private border generator drifting four ways from the shared
one, and as a reader and a writer of the same state resolving to different components (FINDINGS
**F-i′**). Hidden coupling between an internal choice and an external contract.

An optional "pin this to Number" costs nothing when unused and gives an author a way to say *this is
the contract* rather than *this is what I happened to wire*.

⚠️ **§2 is a discussion after §1, not before.** Right now nobody — including the person who would make
the decision — can read the current rule anywhere. Changing an undocumented rule means the change
cannot be described either.

## Success criteria

1. §0's five questions are answered by driving the running editor, and the answers are in this file.
   Where they contradict the remembered rule, the measurement is recorded as the correction.
2. The Port Editor mechanism carries a `description` through to the catalog.
3. `Component Inputs` and `Component Outputs` have real prose, including the typing rule, reachable by
   an author in the editor and by the AI loop in its context.
4. NDA-005's coverage instrument reports these two nodes honestly — a real figure, or `n/a` with the
   reason, not 100% on `0/0`.
5. §2 is written up as a decision for Richard with §0's measurements attached. **No typing behaviour
   changes in this task.**
