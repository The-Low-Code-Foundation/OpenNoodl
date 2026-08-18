# Phase 69 — rulings register

Decisions made by Richard. A ruling here is binding on every task; where a task must *honour* one,
[TASKS.md](TASKS.md)'s last column names it. Superseding a ruling means editing this file and
saying why, not quietly building something else.

**Status: ✅ ALL 8 RULED (2026-08-15). The queue is empty; no task in this phase is blocked on a
decision.** The "must honour" column in [TASKS.md](TASKS.md) is now a record of obligations, not of
things being waited on.

---

## D1 — Node kits are a **first-class project concept**, with provenance shown ✅

**Ruled 2026-08-15.** Kits get their own editor surface: a kits list (natural home is beside
ERG-002's Libraries section in Settings), a "New node kit" create command that writes the scaffold
and opens `index.js`, and **provenance in the property panel** — a node says which kit and version
it came from, with a link to its docs.

**P1 is therefore narrowed, deliberately, and this is the binding form:**

> **P1 — a custom node is a node: there is no *capability* difference between a kit node and a
> built-in.** Provenance *display* is explicitly allowed and wanted — when a node misbehaves you
> need to know who wrote it. What is forbidden is a capability, an API, a validation path or an
> authoring affordance that a kit node cannot reach because it is not first-party.

⚠️ **Note for task authors:** this does **not** gate CN-003. The catalog overlay is required for
validation and the AI whichever way D1 went; D1 only added the editor surface on top.

### D1a — "opens `index.js`" means a real in-app file editor ✅

**Ruled 2026-08-16**, on a question CN-006's editor half could not answer for itself.

D1's create command says it "opens `index.js`". **The editor had nothing that could do that.** Its
CodeMirror is bound to Function-node *parameters*; the two propertyeditor modals are portals over a
node parameter; and the only precedent for reaching a file at all was `shell.showItemInFolder` (3
uses), which hands the author to Finder and a different application. So the clause had three
possible readings — `shell.openPath`, `showItemInFolder`, or new work — and picking the cheap one
quietly would have decided a ruling by implementation convenience.

**Richard ruled for the literal reading: build the file editor.** Built in CN-006 s10 as
`CodeFileDocument` + `ProjectCodeFileModel` — a full-height document with a save, dirty state,
baseline-checked writes and external-edit detection.

**Consequence, and it is wider than kits:** the editor now has a general file-editing surface.
`openCodeFile(projectRelativePath)` opens any file inside the open project. Nothing else uses it
yet; a task that wants to edit a project file no longer needs to invent one.

---

## D7 — Phase 69 owns the catalog spine; LBR-008 is rescoped ✅

**Ruled 2026-08-15.** The two tasks share a mechanism but not a scope, and the split follows the
scope:

- **CN-003 (this phase) — "this project".** The exact, complete overlay of what is *installed here
  right now*. Feeds **validation**, so it must be right rather than cheap.
- **LBR-008 (P65) — "the shelf".** Discovery of the ~58 library entries you could *install*, plus
  `install_prefab`. Must be **cheap** — an index, not 58 `get_node_type` calls — and it now layers
  on CN-003 rather than reinventing it.

**Obligation:** P65's `TASKS.md` LBR-008 row carries a pointer to this ruling so the next person to
pick it up does not rebuild the spine. Done 2026-08-15.

---

## D3 — The MCP server extracts; the editor reuses what the viewer already sent ✅

**Ruled 2026-08-15**, on a measured asymmetry rather than a preference:

- **The editor does not need to extract anything.** It already holds the full definitions —
  `NodeLibrary.instance` was measured on 2026-08-15 carrying all five kit types with complete port
  counts, delivered by the running viewer over `sendNodeLibrary`. The editor-side overlay reads
  that.
- **The MCP server does need to extract**, because it is headless and has no viewer. It executes
  the kit's `index.js` and reads the live register — the same technique as
  `scripts/node-catalog/extractor-entry.js`, using the existing `scripts/node-catalog/dom-shim.js`.

**Consequences that are now binding:**

- Only **one** process ever executes project kit code for extraction. Do not add a second.
- 🔴 **No on-disk cache.** A stale cache reads exactly like a correct answer, which is this repo's
  most expensive recurring failure. If extraction proves too slow in practice, the escalation is an
  **in-memory, per-server-session cache keyed on module mtime** — never a file.
- The editor and MCP paths will therefore have *different* sources for the same facts. CN-003 must
  include a check that they agree, or the divergence will be discovered by a user.

---

## D4 — Kit-declared types count as known; strict mode errors only on the truly unresolvable ✅

**Ruled 2026-08-15.** With the overlay in place, "unknown" splits in two:

- **Resolved by a kit** ⇒ treated as known, and **fully checked** — parameter values, port names,
  the lot. `--strict` does not error on it.
- **Still unresolvable** ⇒ unchanged: a warning by default, an error under `--strict`.

This fixes the contradiction where a greenfield project using a kit could not pass its own gate.

⚠️ **Expect this to surface real breakage the first time it runs.** Turning checks on for types that
have never been checked will find wrong port declarations in existing kits — possibly including the
phase's own cashflow reference kit. That is the ruling working, not failing. Richard accepted this
explicitly rather than take the softer "warn for one release" option, so **do not quietly downgrade
the new checks to warnings** when they first go red.

---

## D2 — JavaScript is the supported path; types ship, but nothing needs a build ✅

**Ruled 2026-08-15.** Plain JS is *the* way to write a kit. Alongside it we publish a `.d.ts`
derived from `react-component-node.ts` so editors and agents get the definition shape and
autocomplete — reachable from a JSDoc `@type` annotation, with **zero build step**.

**Binding consequence:** if a task ever finds itself proposing a compile step on the author's side,
it has broken this ruling. The whole proof this phase rests on is that no toolchain is required; a
supported TypeScript route would re-introduce exactly what we removed and create a second path to
maintain.

---

## D5 — Ship a **new, smaller** reference kit; the cashflow kit is not it ⚠️

**Ruled 2026-08-15, against the recommendation — recorded as such deliberately.**

The reference kit the library ships is a deliberately minimal one (1–2 nodes), optimised to be read
as a starting point.

⚠️ **The known cost, accepted knowingly at ruling time:** a minimal kit **will not demonstrate
composition or P2** — the cashflow kit's whole didactic value is that its running-balance rule lives
in a stock `Function` node and its ~60 decisions are ports. A 1–2 node kit cannot show that. The
first thing people copy will therefore teach them less.

✅ **Required mitigation, and it is not optional:** **CN-007 (docs) must carry the cashflow kit as a
worked example** even though the library ships the minimal one. If the docs also shrink to the
minimal kit, P2 loses its only demonstration and the ruling's cost becomes uncontained. A task that
drops the worked example must say so out loud and re-open this ruling.

**Status of the cashflow kit:** proof-of-concept and documentation material, in
`NodeGX test projects/cashflow-command-centre`. Not shipped content, so it needs no licence sweep —
but it must stay working, because CN-007 depends on it.

---

## D6 — Verify on install, record provenance, explicit consent for third-party ✅

**Ruled 2026-08-15.** Three parts:

- **Locally-authored kits run freely.** A kit you wrote in your own project is not gated — gating it
  would couple authoring to distribution and make the scaffold useless.
- **Third-party kits are verified on install**, reusing ERG-002's `verifyLibrarySource` sandbox
  pattern (`vm` context shaped like a browser tab, confirm what it actually defines).
- **Provenance is recorded**, and running a non-first-party kit takes **explicit consent**.

This is what makes D1's provenance display load-bearing rather than cosmetic: the property panel is
where a user finds out whose code is running.

---

## D8 — Design tokens by default in the scaffold; not enforced ✅

**Ruled 2026-08-15.** The scaffold emits `var(--token)` colour and spacing ports, and the docs teach
it. **Nothing validates it** — an author may hardcode, and legitimate cases exist (brand colours,
data-viz palettes).

The bridge already handles this: AIB-001's units handling in `react-component-node.ts` detects a
`var(--token)` string on a units-typed port and passes it through un-suffixed, rather than producing
`var(--space-4)px`. That work is done; this ruling is about making it the default an author falls
into rather than one they have to discover.

⚠️ **Applies to this phase's own output too.** The cashflow kit currently hardcodes hex throughout —
it was a proof, not a model. Before CN-007 uses it as the worked example, it must be brought onto
tokens, or it will teach the opposite of D8 and P2 at the same time.

### ✅ The cashflow kit is on tokens — built 2026-08-16 (s14), **not yet driven**

8 distinct hex values and 2 `rgba()` literals became 10 `var(--token)` references, all 10 resolved
against `buildDefaultTokenMap()` and mutation-proven. See
[notes/cn-007-d8-token-drive.md](notes/cn-007-d8-token-drive.md) — 🔴 **the rendered result is
still unmeasured**; a peer held the editor for the whole session.

**Two things came out of it that outlive the edit:**

1. 🔴 **The hex was in the file TWICE, and only one copy was a port default.** Every colour read
   `props.positiveColor || '#1F8A4C'` in the JSX beside a `default: '#1F8A4C'` on the port. A
   declared `default` **is** assigned to props at initialize (`react-component-node.ts:905-919`), so
   the `||` arm was a second copy of the decision living in the JavaScript — free to drift from the
   port it shadowed, and invisible to any sweep that only reads port declarations. ⚠️ **A "move it
   onto tokens" task that only rewrites `default:` leaves the constant behind and reads as done.**
2. ⚠️ **The semantic token set has `--destructive` but no `--success` and no `--warning`.** A kit
   with three status bands has to reach into the palette scale for two of them. The kit now takes
   all three from the scale (`--green-600` / `--amber-600` / `--red-600`) so they read as one
   system; mixing one semantic token with two palette ones was the alternative and it is worse.
   This is a gap in the vocabulary, not in the kit.

🔴 **The cashflow kit lives OUTSIDE this repo** (`NodeGX test projects/cashflow-command-centre`), so
this change is **not under version control and not covered by any gate**. D5 says it must stay
working because CN-007 depends on it; nothing enforces that. Worth a task number.

---

# D9–D17 — the queue, cleared in one pass (2026-08-18)

**Richard answered nine of ten together** from [RULINGS-OPEN-QUEUE.md](RULINGS-OPEN-QUEUE.md), which
carried the measured state and a recommendation for each. **#1 (cloud kits) is NOT ruled** — it came
back with a use case rather than a choice, and the measurement that followed changed the options;
see the queue doc. The nine below are settled.

## D9 — A kit that shadows a built-in is **reported, not refused** ✅

Ruled (a). Precedence stays as it is: the catalog gives the built-in priority, the **runtime gives
the kit priority**, and `kitDiagnostics` says so in the words CN-015 corrected. ⚠️ **Binding
consequence:** an existing module may override deliberately, and **0 of 29 shipped modules have ever
been run** (LBR-004) — so the blast radius of changing this is unknown, not small. Do not "tidy" the
two-rules-disagree comment in `health.js` by deleting one half; both halves are true.

## D10 — A kit gets a separate `docsUrl`; `docs` stays prose ✅

Ruled (b). `docs` is **one field over two vocabularies** — a URL on all 158 shipped nodes that carry
one, prose on a kit — and CN-006b's property panel wants a link it cannot get. A new `docsUrl` field
carries it. ⚠️ **Sniffing `http` was rejected**: it is a guess about the author's intent encoded in a
regex, and it mislabels a kit whose prose merely opens with a URL. **Owner: CN-006b's surface, plus
the scaffold and `ReactNodeDefinition`/`NodeDefinitionOptions`.**

## D11 — The open-panel refresh is a rough edge, fixed in a LATER PHASE ⚠️

Ruled: accept, **but Richard asked explicitly that it be fixed later rather than dropped.** An open
property panel does not re-render on `libraryUpdated`; it recovers on any re-selection (measured
twice, six polls over 30 s untouched). 🔴 **This is a deferral with an owner, not a wontfix — it
needs a task number in the next phase.** Not in CN-014's scope.

## D12 — `channelPort` is **rejected at kit-load with a diagnostic** ✅

Ruled (c). The port is erased in every surface and every state, `DynamicPortChannel` is commented out
(`nodelibrary.ts:94-106`), and the census found **one occurrence in 177 types — a test fixture's own
kit node**. ⚠️ Doing nothing was the status quo and the worst of the three: the port silently
vanishes and the author cannot learn why. Reviving the editor-side manager was rejected as real work
for zero non-fixture users.

## D13 — `validate:project` **will** check parameter values ✅

Ruled: take the call. `checkParameterValues` has one production caller, so parameter values are
checked for **no node of any provenance** — 26 unverified on `cashflow-command-centre` alone, read as
a pass. 🔴 **`cn004.test.ts`'s last block asserts that silence deliberately: REPLACE it when the call
is taken, do not delete it** (CN-002's rule — a silence baseline is replaced, never removed).

## D14 — Close `NodeDefinitionOptions`' index signature ✅

Ruled: do it. On a logic node only *required*-field typos are caught today; `displayNodeName` and
`docs` misspellings are **silent** (measured s24). ⚠️ **Binding consequence: this makes a SECOND
deliberate divergence**, and `drift.test.js`' *"the one deliberate divergence"* row exists to catch
exactly that — **update that row to name both divergences with their reasons**; do not delete it.
**Owner: CN-005.**

## D15 — `find_tools`' purpose line does **not** name kits ✅

Ruled: no. The surface sits at **8,223 of 8,280** tokens with a written *"there should not be a third
renegotiation"*, and the real discovery gap was `summary`, now fixed for free in responses.
`tests/kitTools.test.ts`' control stays as it is.

## D16 — Suppress the `Page` parameter-skip `info` specifically ✅

Ruled: suppress, and say why in the code. `Page` declares neither `title` nor `urlPath` statically,
so **96 of 947 measured skips are `Page`** — a declaration gap in one shipped type, not a check
finding something. ⚠️ **Richard's caveat, recorded because it is a testable worry, not a mood:**
*"hope it doesn't have any negative effect on page authoring by the LLM."* So the suppression must be
**narrow to `Page`'s two undeclared fields** — suppressing the node type wholesale would hide a real
parameter error on a page and is exactly the effect he is asking about.

## D17 — Gate the GREEN typechecks now; the red ones get their own task ✅

Ruled. `typecheck:editor` and `typecheck:mcp` are **0 errors** (re-measured s24) and go into a gate so
they cannot rot. `typecheck:runtime` is red at 2 (pre-existing `TS2451` in `test/editorconnection.*`)
and `typecheck:core-ui`'s reported 44 `TS2307`s are **unmeasured since s23** — both raised separately.
⚠️ **Gating a script that is already red just turns the gate off again.**

## D18 — A cloud loader for **pure-JS** logic kit nodes; SDKs are a separate task ✅

**Ruled 2026-08-18, after the measurement reframed the question.** Richard's first answer asked for
the Stripe / AWS / Anthropic SDK case; measuring the mechanism showed that is **not what this ruling
can deliver**, and the two halves are now split.

**What is ruled IN (CN-013):** build the loader so a kit's **logic** nodes register in the cloud
runtime. The runtime already accepts them — `registerModule` works there and a hand-registered kit
node answers `200` (s24). What is missing is any caller: `CloudRunner`'s constructor calls
`registerNodes` and nothing else, and `load(exportData, projectSettings)` has no parameter a module
could arrive through. This serves date maths, validation, transforms, formatting, pricing rules —
**everything that needs no `require`**, which is why it behaves the same in preview and production.

**What is ruled OUT of phase 69:** server-side **SDK dependencies**. Four measurements say why:

1. `manifest.dependencies` is **script paths/URLs, not npm** — only test fixtures use it at all, and
   every real module vendors a UMD browser build inline.
2. The editor's cloud preview runs in an **isolate where `require` is stubbed to an error**
   (`sandbox.isolate.js:23`).
3. The deployed backend runs cloud functions **in the service process**, where `require` *would*
   work — so **preview and production disagree about the one API the SDK case needs**.
4. A deployed backend is **a single prebuilt `cli.js`** copied into the image, with no `npm install`
   and no `node_modules`, deliberately. **There is nowhere for a user's package to land.**

🔴 **Binding consequences for whoever builds CN-013's cloud half:**

- ⚠️ **Say what it does not cover, in the diagnostic and in the docs.** A logic kit node that reaches
  for an SDK must fail with a sentence naming the limit, not with the hang that s24 just removed.
- ⚠️ **Verify preview AND production, not one of them.** The isolate and the service process are
  different execution contexts and this ruling exists because they disagree.
- 🔴 **This does not re-open D6.** A pure-JS kit node in the service process is still third-party
  code beside the database; CN-017 still owns the trust story for anything not first-party.
- **The SDK story wants its own task and probably its own phase** — it reopens the deployed-backend
  packaging decision, the isolate's `require`, and the trust boundary together.
