# Phase 76 — next session

Read `TASKS.md` here first. **Tier 2 is closed.** SB-007 shipped the Site Builder as an
embedded template, so SB-001 through SB-008 are all ✅ and **nothing is left between this
phase and a template a user can pick from the launcher**. What remains is Tier 3 — five
open findings, all measured or derived, none of them blocking the phase's product.

Before touching the template, read **SB-007 §3** (why the content is generated) and
**§4** (F22). Before authoring any *cloud* component, read
`dev-docs/reference/BACKEND-AUTHORING-MODEL.md` §**"Four things a deployed graph does not
do the way the canvas does"**. Before authoring any *browser* component, read **SB-005 §7**
and **SB-006 §7**.

## Where s9 left it (2026-08-26)

**SB-007 DONE.** `embedded://site-builder`, category `site`, in `EmbeddedTemplateProvider`
beside `hello-world`. **22 specs** (`noodl-mcp/tests/sb007Template.test.ts`) + **12**
(`noodl-editor/tests-unit/sb-007/site-template.test.ts`), **6 mutants graded**.

🔴 **The template's content is GENERATED. Do not hand-edit
`site-builder.content.json`.**

```
npm run template:site-builder
```

The graphs live in `packages/noodl-mcp/tests/sb00{4,5,6}Components.ts` plus the `App`
shell in `sb007Template.ts`. The script authors all nineteen through the real MCP door
and reads them back with the editor's own `ProjectImporter`. `sb007Template.test.ts`
regenerates in-process and asserts **byte equality**, so an edit to a component set that
is not followed by a regeneration reddens with the line number, both strings, and the
command to run. Graded — that is exactly what M5 did.

🔴 **The finding, and it is the reason this task was not a one-liner.** Five sessions
authored eighteen components; every one of those runs authored into
`tests/fixtures/demo-app`, **which already contained the nineteenth** — an `App` holding
a `Router` named `Main`. `ROUTER = 'Main'` in `sb005Components.ts` is a reference to that
fixture's node, and eleven `RouterNavigate` nodes point at it.

Into a clean skeleton, the door writes five pages, **succeeds on all five, and registers
none**. `pageRegistration.ts` rules a router-less project legitimate — single-screen apps
exist — so `registrationSummary` returns `{}` and `registeredPages` is simply **absent
from the payload**. No diagnostic. No field to notice missing.

Measured as a one-edge arm with its control, because "nothing registered" has a dozen
causes that are not the missing router:

| | components | pages written | writes green | pages registered |
|---|---|---|---|---|
| no `App` | 18 | 5 | 5 | **0** |
| with `App` | 19 | 5 | 5 | **5**, start page `/Pages/Site` |

🔴 **F22 — FIXED. A hole shaped like a feature that had never existed.**
`EmbeddedTemplateProvider.instantiateContent` regenerates node ids and rewrites
connections — and not `graph.visualRoots`, which also names ids. It was never wrong
because it never had a population: `hello-world` is hand-written with none and was the
only embedded template. Every v2-door component carries one, and this template brought
twelve. **Measured red before the fix** (twelve dangling ids in an installed project),
then fixed.
⚠️ The near-miss worth carrying: a rewrite replacing *any string equal to an old id*
would have corrupted eight parameters in this template alone — `as: 'section'`,
`as: 'nav'`, `as: 'header'` and five `flexDirection: 'row'`. Graph ids and HTML element
names come from the same small vocabulary. The rewrite is structural.
⚠️ Cost is bounded and stated: `NodeGraphModel` re-derives `visualRoots` on save, so the
window is install → first save — and every reader that takes the file at face value is
inside it.

🧭 **SB-015 filed** — the one thing a template cannot carry. SB-004 §4's policy is
`security.json` in a **backend's** data directory; a template is a **project** directory,
and no path connects them. So the shipped graphs meet `defaultSecurityConfig()` and fail
**two opposite ways**: locally `devOpen: true` disables row-level ACL entirely (the exact
configuration SB-008 kept as its twin *because the same draft renders in it*), and
deployed, `devOpen: false` with `collections: {}` leaves `Page.find` at `authenticated`
so the public site shows the public nothing. **Each failure looks like the other's fix.**
Derived from source and cited; **not driven**.

## Gates, s9

- noodl-mcp **63 suites / 769** ✅ · editor jest **347 / 5751** ✅
- `typecheck:mcp`, `typecheck:editor`, `typecheck:editor-tests` all exit **0** (unpiped)
- `test:ci` **run solo** (editor source changed): **`Jasmine: 2856 specs, 4 failures (failed)`**,
  seed 89171, all four `AIX-006 style vocabulary` **by name** — the floor. Compound exited **1**,
  which is what a clean floor does. **No debt.**
- ⚠️ The first full noodl-mcp run showed 2 reds in `projectOwnsBackend.test.ts` **while the
  editor's 347-suite jest was running concurrently**. Alone: 12/12. Full suite alone:
  63/769. Contention, not a regression — and recorded rather than dropped.

## Next work, in order

1. **SB-013 + SB-014 together** — both edit `claimSite`; separately, the second re-grades
   SB-004's five mutants for nothing. SB-013 recommends the one-wire fix and says what it
   costs; SB-014 recommends seeding a `Theme` the way `SiteSettings` already is. Both
   touch a **closed** task, which is why they are filed rather than taken.
2. **SB-015** — needs a ruling on which of three shapes, and the drive that would turn §2
   into a measurement is the natural companion to SB-008: same instrument, one config
   apart, in the state a real first user is in and no fixture ever is.
3. **SB-009 / SB-010 / SB-011 / SB-012** — all measured-not-fixed, all needing a corpus
   sweep or a ruling rather than an argument.
4. ⚠️ **Still owed from s8**: `BACKEND_DOCTRINE_MD` (`prompts/backend.ts`, editor source)
   does not carry rule 3's new second half. The text is already written in
   `BACKEND-AUTHORING-MODEL.md` and can be lifted verbatim — the same shape as s4's
   omission that s5 closed. It puts `test:ci` back in scope, so ride a window.
5. 🧭 **Richard's, still open**: F8 (does a contact message reach anyone),
   `Section.kind`'s fifth value with no destination, D3 (does SB-003's boundary fix ride
   0.2.1), and now SB-015's three shapes.

## Traps that will bite here specifically

- 🔴 **A green authoring run means well-formed and nothing else.** Seven sessions have
  produced one; four shipped something broken. s9's is the sharpest yet — five *green*
  page writes into no router at all.
- 🔴 **An absence in a payload is not a signal.** `registeredPages` missing and
  `registeredPages: {}` and a failed write all read identically from a green result. Same
  shape as SB-008's rule: an absence claim needs a signal known to fire beside it.
- 🔴 **The artefact and the component sets are two populations.** The door checks a
  reference against what is on disk *when the write happens*; a shipped project is a
  different set. That is why `sb007Template.test.ts` re-asks closure over the artefact.
- 🔴 **All three component sets are data files** — `sb004Components.ts`,
  `sb005Components.ts`, `sb006Components.ts`. Edit graphs there, never in a spec; **four**
  suites now drive those, and the fourth writes a committed file.
- 🔴 **An authored node id is a request, not a handle (F9).** Read a written graph by node
  **type** or **label**.
- **The MCP dist on this machine is stale** and the bound servers run it. Author through
  `createServer` from `src`.
- ⚠️ `npm run template:site-builder` runs `ts-node -T` deliberately: type-checking that
  program takes ts-node past 2 GB and it dies on a native stack trace with no TypeScript
  error to read. The types are covered by `typecheck:mcp` and the spec; the seventy lines
  in `scripts/` are not, because `scripts/` is in no `tsc` program here.
- Shared checkout: commit by pathspec (untracked ⇒ `add` + `commit` in **one chain**),
  never stage-then-commit; announce before any editor launch/teardown; `test:ci` **alone**
  — and **not beside another package's jest**, which is what s9's two reds were.
