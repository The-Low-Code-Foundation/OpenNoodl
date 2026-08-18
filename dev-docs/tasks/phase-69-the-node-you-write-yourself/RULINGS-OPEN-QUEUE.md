# Phase 69 — the open ruling queue

**For Richard, 2026-08-18 (s24). Ten items, meant to be answered in one pass.**

Each carries **what is true today (measured, not assumed)**, the options, and a recommendation —
because a neutral ten-item menu is slower to answer than ten opinions you can overrule. ✅ **Ruled
decisions go into [RULINGS.md](RULINGS.md) as D9+**; this file is the queue, and it empties.

✅ **QUEUE CLEARED 2026-08-18.** All ten are ruled: #2–#10 as **D9–D17**, and #1 as **D18** after a
measurement pass showed the question was the wrong one. **Nothing in this phase is blocked on a
decision.** This file is now the record of how each was decided; the rulings themselves live in
[RULINGS.md](RULINGS.md).

---

## 1. 🔴 Should a kit be able to run in the CLOUD runtime? — **BLOCKS CN-013**

**Today, measured (s24):** the cloud runtime *accepts* kits — `registerModule` works there, and a
hand-registered kit node answers `200`. What is missing is a **loader**: `CloudRunner`'s constructor
calls `registerNodes` and nothing else, and `load(exportData, projectSettings)` has no parameter a
module could arrive through. A kit node in a cloud function therefore **hangs** the request (no
error, no answer) until CWF-018's timeout fires.

⚠️ **Writing that loader means executing a kit's arbitrary JavaScript inside the backend process** —
next to the database, the secrets and every other tenant's request. ✅ **D6 ruled only on the
browser**, where the blast radius is one page.

| | Option |
|---|---|
| **(a)** | **Leave the cloud unsupported.** s24 already made this honest and loud: `runtimes:["cloud"]` now raises a `kit-loads-nowhere` error naming the kit, in both the CLI and the editor. |
| **(b)** | Load kits server-side for **locally-authored projects only**. |
| **(c)** | Load them behind CN-017's verify-on-install consent gate. |

**Recommendation: (a) for now.** It is already built and honest, and (b)/(c) both put third-party
code beside the database before CN-017 exists to reason about it. ⚠️ (b) is the tempting one and is
the weakest: "locally-authored" is a claim about provenance that nothing currently records.

**RICHARD ANSWER:** I think we kind of need this though. If someone wants to add the AWS SDK or Stripe SDK, or even the Anthropic SDK, why wouldn't we let them? I'd say as long as it's adding like a known npm package or something 'officially recognised', it's fine. But then again if you have a user and their Cloud Code says "I'd love to code that custom cloud function node for you to make your project sing, but I can't because NodeGX says no" that's a bit shit too.


### 🔴 MEASURED AFTER RICHARD'S ANSWER (s24) — the question was the wrong one

Richard's need is real. **The mechanism he is picturing does not exist in a kit**, and four
measurements say the SDK case is a much bigger feature than this ruling:

1. **`manifest.dependencies` is a list of SCRIPT PATHS/URLS, not npm packages.** Census of every
   manifest in the repo: only **test fixtures** use it, and the values are
   `https://cdn.example.com/vendor.min.js` / `vendor/local-lib.js`. Every real module **vendors its
   library inline as a UMD browser build**. So "add the Stripe SDK to a kit" today means vendoring a
   browser UMD build — which is not what the Node builds of Stripe/AWS/Anthropic are.
2. 🔴 **The editor's cloud-function preview runs in an ISOLATE where `require` is deliberately
   stubbed to an error** (`sandbox.isolate.js:23` — `"Error, require not supported: "`).
3. 🔴 **The deployed backend runs cloud functions IN THE SERVICE PROCESS** (`WorkflowRunner`,
   `@cloud-runtime` statically bundled), where `require` *would* work. **So preview and production
   disagree about the one API the SDK case needs** — a kit using an SDK would behave differently in
   the two, which is the exact failure class this phase keeps fixing.
4. 🔴 **A deployed backend is a single prebuilt `cli.js` copied into the image** — no `npm install`,
   no `node_modules`, and the Dockerfile says this is deliberate (so the image is not "whatever npm
   resolved that morning"). **There is nowhere for a user's npm package to land.**

⚠️ **So the message conflates two different features**, and they should not be decided together:

- **Pure-JS logic nodes server-side** — date maths, validation, transforms, formatting, pricing
  rules. These need **no `require`** and would work with a loader alone. Small, and inside phase 69.
- **Server-side SDK dependencies** — Stripe, AWS, Anthropic. These need a dependency story the
  product does not have (points 1–4). **Not a phase 69 ruling.**

⚠️ **And on *"NodeGX says no" is a bit shit too*** — agreed, but note what happens **today**: a kit
node in a cloud function **hangs the request** until a timeout, saying nothing. s24 replaced that
with an error naming the kit. So the near-term state is *"it says no clearly"*, which is strictly
better than the current silence and **forecloses nothing**.

✅ **RULED (b) — D18.** Build the loader for pure-JS logic nodes in CN-013; the SDK story becomes its
own task outside this phase. Recommendation as it stood: It gives real capability now, it is honest about what it does not cover, and it
does not pretend a dependency mechanism exists.

---

## 2. Should the runtime refuse a kit that shadows a built-in?

**Today, measured (s22):** precedence is **two rules that disagree**. The catalog gives the built-in
priority; the **runtime gives the kit priority** (`NodeRegister.register` is an unguarded assignment
and `viewer.jsx` registers built-ins first). So **validation checks the built-in's ports while the
app runs the kit's code**. The shipped message used to say the opposite of what happens; s22
corrected the wording.

**(a)** leave it and report — current state. **(b)** built-ins win at registration too, so the layers
agree. **(c)** refuse the kit's node and error at load.

**Recommendation: (a).** ⚠️ (b) and (c) are behaviour changes and an existing module may override
deliberately — and **0 of 29 shipped modules have ever been run** (LBR-004), so the blast radius is
genuinely unknown rather than small.

**RICHARD ANSWER:** a sounds fine

---

## 3. What should a kit's `docs` field be able to say?

**Today, measured (s21, on a real viewer payload):** `docs` is **one field over two vocabularies** —
on a shipped node it is a **URL** (158 of 175 carry one, all `https://docs.noodl.net/…`, zero prose);
on a kit node it is the author's **prose**. CN-006b's spec assumed a URL and a kit author cannot
express one.

**(a)** leave it prose-only. **(b)** add a separate `docsUrl`. **(c)** sniff `http` and render a link.

**Recommendation: (b).** ⚠️ (c) is cheap and is **a guess about the author's intent encoded in a
regex** — a kit whose prose happens to start with a URL gets a link nobody asked for.

**RICHARD ANSWER:** Yep b is good

---

## 4. The open-panel refresh — fold into CN-014, or accept as a rough edge?

**Today, measured twice (s20):** an open property panel does not re-render on `libraryUpdated`. It
showed a stale label through **six polls over 30 s untouched**, then updated on one re-selection — so
the variable is the selection change, not elapsed time.

**Recommendation: accept as a rough edge, note it in CN-014.** Clicking any other node and back
recovers it, and authoring does that constantly. Severity is far below the bug behind it (the frozen
definition needed a restart and mislabelled itself as *"dynamic ports don't work"*).

**RICHARD ANSWER:** Fine but to be fixed in a later phase please

---

## 5. What should `channelPort` do?

**Today, measured (s19):** the form is **erased in every surface and every state** — absent from the
static `ports` list, the Properties tab, the Ports tab *whose header promises "every port on this
node"*, the connection popup, and `getPorts()` with the runtime live and the node mounted. The
exporter strips it expecting an editor-side manager, and `DynamicPortChannel` is **commented out**
(`nodelibrary.ts:94-106`). Census: `channelPort` occurs **once in 177 types** and it is a test
fixture's own kit node — zero built-ins use it, which is why nothing ever went red.

**(a)** revive the editor-side manager. **(b)** stop the exporter stripping the port. **(c)** reject
it at kit-load with a diagnostic.

**Recommendation: (c).** 🔴 **Doing nothing is the current state and it is the worst of the three** —
the port silently vanishes and the author has no way to learn why. (c) is cheap and honest; (a) is
real work for a feature with one non-fixture user, which is none.

**RICHARD ANSWER:** c sounds fine

---

## 6. Widen the project gate to check parameter VALUES?

**Today, measured (s11):** `checkParameterValues` has **one production caller**, so
`validate:project` / `validate_project` check parameter values for **no node of any provenance** —
kit or built-in. On `cashflow-command-centre` that left **26 parameters** unverified while the report
read as a pass.

**Recommendation: yes, take the call.** ⚠️ **`cn004.test.ts`'s last block asserts the silence
deliberately — replace it when the call is taken, do not delete it** (CN-002's rule: a silence
baseline is replaced, never removed).

**RICHARD ANSWER:** yes sounds fine

---

## 7. Close `NodeDefinitionOptions`' index signature? — **CN-005's call**

**Today, measured (s24):** on a **logic** node only *required*-field typos are caught (misspelling
`category` makes a required field go missing). Misspelling an **optional** top-level field is
**silent** — confirmed on `displayNodeName` and `docs`. CN-005 closed exactly this for
`ReactNodeDefinition`, whose property set really is closed.

**I tried it: it works and breaks nothing.** ⚠️ But it creates a **second** deliberate divergence and
turns `drift.test.js`' *"the one deliberate divergence"* row red — and that row exists to catch
precisely this.

**Recommendation: do it, and update the drift row to name two divergences with their reasons.** The
typo class it catches is the commonest authoring error there is.

**RICHARD ANSWER:** ok sounds good

---

## 8. Should `project`'s `find_tools` purpose line name kits?

**Today:** it does not; naming them costs resident tokens on every turn. `tests/kitTools.test.ts`
carries the control that fails if the line changes. Narrowed by s17, unanswered since.

**Recommendation: no.** The surface sits at **8,223 of 8,280** tokens with a written *"there should
not be a third renegotiation"*, and s17 showed the discovery gap was really `summary`, which is now
fixed for free in responses.

**RICHARD ANSWER:** no then

---

## 9. "Clean" is no longer "an empty diagnostics array" for any page

**Today, measured (s18):** `Page` declares **neither `title` nor `urlPath`** statically, so **96 of
947 measured parameter skips are `Page`**. Every page in every project now emits `info` diagnostics
that no author can act on. `warnings` stays 0.

**Recommendation: suppress the `Page` case specifically and say why in the code.** It is not a check
finding something; it is a declaration gap in one shipped type.

**RICHARD ANSWER:** Ok I guess, hope it doesn't have any negative effect on page authoring by the LLM

---

## 10. The ungated typechecks

**Today:** seven of eleven `typecheck:*` scripts run in **no gate**, and `scripts/` is in none of
them. ✅ s24 re-measured two on its own changed surfaces: **`typecheck:editor` 0, `typecheck:mcp` 0**.
`typecheck:runtime` was **red at 2** (pre-existing `TS2451` redeclarations in `test/editorconnection.*`)
and `typecheck:core-ui`'s reported 44 `TS2307`s have **not** been re-measured since s23.

**Recommendation: gate the green ones now** (`editor`, `mcp`) so they cannot rot, and raise the
red ones as their own task rather than blocking on them. ⚠️ Gating a script that is already red just
turns the gate off again.

**RICHARD ANSWER:** Sounds good
