# Phase 44 — The Compute Ceiling (Track M: modules)

**Created:** 2026-08-06
**Status:** 📋 Specced, not started — 9 tasks. Post-alpha.
**Origin:** the NodeGX-vs-code comparison
([NODEGX-VS-CODE-A-REAL-APP.md](../../reviews/NODEGX-VS-CODE-A-REAL-APP.md) §4.1), which found that
a cloud function's inability to import anything was the single most consequential limitation in the
whole platform — and that the fix is roughly one parameter.

> Richard, 2026-08-06: *"The community would KILL for cloud function importing."*
> And on gating: *"make a 'danger mode' where someone can import any crazy crypto mining virus stuff
> from npm at their own risk… if they get blocked from the get go they might just give up and go
> back to pure code."*

Both are load-bearing and both are in scope. The curated kit is the **default**; danger mode is the
**escape hatch**; neither is allowed to pretend to be the other.

## The mechanism, measured

A Function node compiles through
[`simplejavascript.ts:443-453`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts#L443-L453):

```js
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
func = new AsyncFunction('Inputs', 'Outputs', 'Noodl', 'Component', prefix + script);
```

The body runs in **global scope**, which is exactly why CJS `require` is absent and everything Node
puts on `globalThis` is present. TALK-007 §3.1 measured what that means today: `process` with 79 env
keys, `Buffer`, `crypto.subtle`, `fetch`, `FormData`, `Blob`, `ReadableStream`, `WebAssembly`,
`Intl`, `setInterval` — and no `require`, no `module`, no `__dirname`.

**So the seam is a fifth parameter.** Everything else in this phase is policy, packaging, security
and UX. That asymmetry — two days of mechanism, three weeks of judgement — is the phase.

## The three things that make this harder than it sounds

### 1. The single-artifact deploy story is a real asset and open npm destroys it

`nodegx-backend` builds to one ~690KB esbuild bundle that runs on plain Node with no native
dependency and no ABI matrix. That property is why deployment is a script and not a sysadmin
exercise, and WF-004 chose `node:sqlite` specifically to keep it.

A curated kit compiled into that bundle preserves it. A `node_modules` tree does not. This is not an
argument against danger mode — it is the reason danger mode has to **announce** the change in deploy
shape rather than silently produce a folder that no longer deploys the way the docs say.

### 2. The trust model is already weaker than anyone thinks, and imports are not what breaks it

Worth stating plainly before anyone treats this phase as the moment risk arrives. TALK-007 §3.1,
already true today, with no modules at all:

- `process.env` is readable in full from any cloud function
- `process.exit` is callable
- `setInterval` outlives the request

An author who can write a Function node **already** has close to unlimited authority on that box.
The boundary people imagine is not there. Danger mode does not remove a boundary; it makes an
existing absence honest, and it adds exactly one genuinely new thing: **third-party code**, i.e.
supply chain. That is a real escalation and it is why the feature is named for the risk.

The thing that actually changes the picture is not imports — it is **agent-authored functions
deployed without a human reading them**, which is a live direction in this repo. MOD-007 owns that.

### 3. `sandbox.isolate.js` is dead code that is not allowed to become a silent second path

Nothing references it and `@cloud-runtime` resolves to `noodl-viewer-cloud/src/index.ts`. But
CWF-007's note is explicit that the isolate path stays real for whatever deploys through it. A
module kit that works in one path and silently no-ops in the other is a named failure shape here.
MOD-006 makes it refuse loudly instead.

## Tasks

| ID | Title | Est. | Notes |
|---|---|---|---|
| **MOD-001** | The module seam | 2 d | Fifth `AsyncFunction` parameter; a frozen resolver object threaded from the cloud runtime. Editor Function nodes get the *same* seam with an empty resolver, so browser and cloud differ by contents, never by shape. |
| **MOD-002** | The curated kit, v1 | 1 wk | ~12–15 packages, versioned, compiled into the backend bundle. Opening list: a decimal library, `zod`, an xlsx reader, a PDF text extractor, a date library, Stripe, a CSV parser, `jose`. **Selection criteria, not a wishlist:** pure JS (no native), maintained, small, and answering a gap the comparison actually found. Every entry carries a one-line "why this is in the kit". |
| **MOD-003** | `require` that teaches | 3 d | A shim resolving only the kit. Anything else throws a message that names what *is* available and links the kit page — the error is the documentation. Rejected alternative: named globals per module (pollutes, doesn't scale past ~5, doesn't match muscle memory). |
| **MOD-004** | Kit modules in intellisense | 1 wk | Extends [FH-019](../phase-42-first-hour/FH-019-TYPED-INTELLISENSE.md). Ship the kit's `.d.ts` files with the editor so a `require('decimal')` autocompletes in the code editor. Without this the kit is a docs page nobody reads. |
| **MOD-005** | **Danger mode** | 1.5 wks | See below — the biggest single task in the phase and the one with the most judgement in it. |
| **MOD-006** | Isolate parity, or a loud refusal | 3 d | The isolate path must either resolve the kit identically or refuse the function at load with a named error. Never silently absent. |
| **MOD-007** | The trust model, rewritten for agent authorship | 1 wk | The doctrine task. Who may author a function; what a function may reach; what changes when the author is an agent. Produces the policy the other tasks implement, and probably a per-function capability declaration. **Blocks nothing, gates deployment defaults.** |
| **MOD-008** | The kit request path | 2 d | An in-product "request a package" that files a structured issue with the use case. Exists so the answer to a missing package is a button rather than an email, and so the kit grows on evidence. |
| **MOD-009** | **Project-local shared modules** | 1 wk | See below. Found late, and it is the task that decides whether a serious computational core can live in NodeGX at all. |

**Total: ~6 weeks.** MOD-001…004 + MOD-009 are the shippable core (~3.5 wks) and could ship alone.

---

## MOD-009 — the one this phase nearly missed

Third-party modules are the loud request. **First-party shared code is the load-bearing one**, and
it only became visible when the built-world comparison tried to place a real computational core into
NodeGX and found there was nowhere to put it.

The reference app's calculation layer is 3,915 lines across nine files that call each other:
`social_charges` is used by `simulation`, `renta_modele`, `primes` and `seuil_salaire`. In NodeGX
today, every Function node's script is an **island** — `new AsyncFunction` gives it no module scope,
so there is no way for two functions to share a helper. The only workarounds are both bad:

- **Copy the helper into every function.** Now the RGDU rate exists in five places and a 2027 reform
  changes four of them.
- **Make every helper its own cloud function** and call it. Architecturally legitimate, and it is what
  [BACKEND-AUTHORING-MODEL.md](../../reference/BACKEND-AUTHORING-MODEL.md) implies — but you are
  paying a request-shaped hop for what was a function call, in a loop, inside a tax calculation.

**The fix:** a project may contain plain `.js` files under `lib/`, and a cloud function may
`require('./lib/social-charges')`. They are project files: versioned in git, diffed per file,
readable by an agent, and — critically — **testable by [phase 46](../phase-46-verification/README.md)
directly**, without going through a graph at all.

Design notes:

- Resolution order: kit → project `lib/` → (danger mode only) `node_modules`. A project file may not
  shadow a kit name, same rule as MOD-005.
- CommonJS only for v1. ESM in an `AsyncFunction` body is a different and larger problem.
- ⚠️ **`lib/` is untyped, and that is a regression worth naming.** MOD-004 ships `.d.ts` for *kit*
  modules; nothing types project code. Moving comcoi's calculation core would take type-hinted Python
  with `Decimal` throughout to untyped CommonJS — a real loss of guarantee in the one place
  correctness matters most (counter-review §C). Options, none free: allow `.ts` in `lib/` with a
  build step (kills the "no build" property); ship JSDoc-typed `.js` with `checkJs` in the editor's
  language service (cheaper, weaker); or accept it and say so. **Decide before MOD-009 ships, not
  after.**
- ⚠️ **`lib/` also breaks [phase 46](../phase-46-verification/README.md)'s determinism claim** —
  arbitrary CommonJS can reach `Date.now()`, `Math.random()` and `crypto.randomUUID()`, none of them
  catalog nodes. VER-002 now owns a `lib/` determinism contract; that is a cost this task creates in
  another phase and it should be counted here.
- These files are **not** graphs and are not pretending to be. That is the point: this is the
  honest escape hatch for logic that is genuinely code, sitting beside the graph rather than
  squeezed inside a node.
- The editor already has a real code editor (CED-001, CodeMirror 6) and typed intellisense
  (FH-019), so the authoring surface exists.

⚠️ **The obvious objection, answered:** does this not just re-admit "write everything in JavaScript"
and hollow out the visual model? No — for the same reason the workflow/function split works. The
graph stays the place where *orchestration, data flow and UI* live; `lib/` is where *pure
computation* lives; and the boundary is legible because it is a directory rather than a habit. A
tool that forces a decimal tax engine to be drawn as nodes is not being principled, it is being
unusable.

---

## MOD-005 — Danger mode, in detail

**The requirement, in Richard's framing:** a user who needs a package that isn't in the kit must not
hit a wall. Hitting a wall on day one is how you lose someone to pure code permanently, and they
never come back to tell you which package it was.

### What it is

A **project setting**, off by default: `functions.modules.unrestricted`. When on:

- the project gets a real `package.json` and a real `npm install`
- `require` resolves the kit **first**, then anything installed — so turning it on never changes the
  behaviour of a function that already worked
- the deploy artifact becomes bundle + `node_modules`, and the deploy flow says so *before* it
  writes the folder, not after

### What it must be honest about

Three disclosures, each at the moment it matters, and **none of them a modal that appears twice**:

1. **At the toggle.** What changes: third-party code now runs with the same authority as your own —
   which per §2 above is full `process` access on the deploy target. Plus: your deploy stops being a
   single artifact.
2. **In the function canvas.** A quiet persistent badge on any project in unrestricted mode. Not a
   banner, not a nag. It exists so a person opening someone else's project knows.
3. **In the deploy report.** A section listing exactly what will be installed, resolved from the
   lockfile. This is the one that matters for a team.

### The hard rules

- **An agent may not turn it on.** No MCP tool, no authoring operation, no plan step. A human ticks
  this box. "Agent writes a function that npm-installs a package" is a supply-chain attack with a
  friendly UI, and the whole point of the closed vocabulary is that the agent's blast radius is
  bounded. This is the one line in the phase with no negotiation in it.
- **The lockfile is committed.** Unrestricted mode without a lockfile in git means what shipped is
  unknowable. The setting requires it; the deploy refuses without it.
- **Kit shadowing is forbidden.** An installed package may not take a kit name. Otherwise `require('decimal')`
  means different things in two projects and every support conversation starts three steps back.
- **The isolate path refuses unrestricted projects outright** (MOD-006).

### Explicitly rejected

- **Open npm as the default.** Rejected: it re-imports lockfile drift, native modules, ABI matrices,
  install-time deploy failures, and — for the AI story specifically — package-name hallucination,
  which is one of the failure modes the closed vocabulary currently eliminates entirely.
- **A per-package approval prompt.** Rejected: it is the wall again, one step later.
- **A sandbox/permission system for third-party code.** Rejected for v1 as dishonest — we cannot
  contain it (§2), and a permission dialog implying we can is worse than a clear warning saying we
  cannot. Revisit only if MOD-007 concludes functions need real isolation, in which case it is that
  phase's work and applies to first-party code too.

### The success test

> Someone hits a missing package, turns on danger mode, installs it, and ships — **without filing an
> issue and without leaving the product.** And Richard still gets the request, through MOD-008,
> because they wanted it in the kit properly.

## Exit criteria

1. A cloud function computes a tiered social-charge calculation in exact decimal arithmetic, using
   a shared `lib/` helper that three other functions also use, with a test proving it against
   published reference values (needs [phase 46](../phase-46-verification/README.md)).
2. A cloud function parses an uploaded `.xlsx` and a `.pdf` and writes records from both.
3. A project in danger mode installs a package outside the kit, runs, deploys, and its deploy report
   names every installed dependency.
4. A project in danger mode is refused by the isolate path with a message naming the reason.
5. `require('fs')` produces an error a beginner can act on.
