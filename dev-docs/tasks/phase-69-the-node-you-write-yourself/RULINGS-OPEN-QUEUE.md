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

---

# 🔴 REOPENED — two more, raised s26, measured s27

The ten above are all ruled. These two are **new**, and both were raised by s26 without a
measurement; s27 measured them before writing them down. Neither blocks closing the phase.

## 11. The semantic token set has no `--success`, `--warning` or `--info`

**Today, measured (s27)** in `packages/noodl-editor/src/editor/src/models/StyleTokensModel/DefaultTokens.ts`:
the semantic set carries **`--destructive`, `--destructive-hover`, `--destructive-foreground`** —
and there is **no `--success`, no `--warning`, no `--info`**. The palette scale does carry the raw
colours (30 `--green-*` / `--amber-*` / `--red-*` entries).

So a node with three status bands has no on-system way to say "good" or "caution". The cashflow kit
hit this and left a note in its own header explaining the compromise it chose: read **all three**
bands from the palette scale (`--green-600` / `--amber-600` / `--red-600`) so the node stays one
system, rather than mixing one semantic token with two palette ones. That is the best available
answer and it is still a kit reaching past the semantic layer for two thirds of a common pattern.

| | Option |
|---|---|
| **(a)** | **Add `--success` / `--warning` / `--info`**, each with `-foreground` and `-hover` to match `--destructive`'s shape. |
| **(b)** | Leave it; document "use the palette scale for status bands" as the intended pattern. |
| **(c)** | Add `--success` only — the one with a true semantic opposite in `--destructive`. |

**Recommendation: (a).** `--destructive` alone is a set with one member of a four-member family, and
every kit that needs the other three will independently invent the same workaround. ⚠️ **The cost is
real and is why this is a ruling, not a fix:** `DefaultTokens.ts` is the vocabulary **every** project
sees, so this widens the token surface for all of them, and existing projects would gain tokens their
themes have no values for. ⚠️ Worth pairing with a contrast check per theme — a palette token failing
AA has been found five times in this repo, and adding three semantic colours is exactly where a sixth
would come from.

## 12. `kitDiagnostics` prints outside `validate:project`'s summary, so an ERROR does not fail the run

**Today, measured (s27)** in `scripts/validate-project.ts`: kit diagnostics are printed at line 158
by `console.error(formatKitDiagnostic(diagnostic))` inside `validatorFor()`, which runs **before**
the report. The gate at line 219 is `totalErrors > 0 || (warningsAsErrors && totalWarnings > 0)`, and
`totalErrors` only ever accumulates `report.summary.errors` (line 204). **Kit diagnostics never reach
it.** A kit-level `ERROR` therefore prints above a summary that says `0 error(s)` and the process
exits `0`.

**This got more visible, not less:** D12 added `kit-unsupported-dynamic-port` as a fifth code to that
surface, and it is an **error** — the one an author most needs the CI run to stop on.

| | Option |
|---|---|
| **(a)** | **Fold kit diagnostics into the report**, so they count toward `summary.errors` and the exit code. |
| **(b)** | Keep them separate but add their severity to the gate expression only. |
| **(c)** | Leave it; treat kit diagnostics as advisory output. |

**Recommendation: (a).** The author's question is "did my project validate", and a surface that
answers `0 error(s)` immediately below an `ERROR` line answers it wrongly. ⚠️ **(b) is the cheap one
and is worse than it looks**: it fixes the exit code while leaving the printed summary still saying
`0 error(s)`, i.e. it makes the human-readable output and the gate disagree. ⚠️ Whichever is chosen,
the `--json` path needs the same treatment — it builds `jsonResults` from `toJSON(report, …)` only,
so kit diagnostics are absent from it entirely.

**RICHARD ANSWER:**

---

## 13. The documented kit-authoring pattern is incompatible with SSR — **BLOCKS CN-013 AC1**

**Today, measured (s27, on a real deploy).** Every kit begins `var React = window.React;`. Server-side
there is no `window`, so **all four kits in the drive fixture threw** and the SSR loader named each
one:

```
SSR: kit "Cashflow Kit" threw while loading server-side (window is not defined). Its nodes will be
missing from the server render and will appear only after hydration, which is a hydration mismatch.
```

🔴 **This is not a kit written badly — it is the kit written as documented.** `cashflow-kit`'s own
header teaches the pattern and CN-007 documents it, so the phase's flagship worked example is the
thing that fails. The consequence is not a blank page but a **hydration mismatch**: the client loads
the kits and the server does not, so the two renders disagree.

⚠️ **The other half of CN-013 AC1 is already fixed** (`8ea0f6c1`, `b886e1f9`): the deploy now ships
`kit-modules.js` and builds. This is the whole of what is left on that criterion.

| | Option |
|---|---|
| **(a)** | Give the SSR loader a `window` shim carrying `React` before evaluating a kit. |
| **(b)** | Change the documented pattern to a guarded accessor; update the worked example and the scaffold. |
| **(c)** | Declare kits browser-only under SSR; keep today's diagnostic as the honest answer. |

**Recommendation: (a) then (b).** (a) is small and makes every kit that exists today work; (b) stops
new ones being written against a global that may not exist. ⚠️ **(c) is a real option and is what
ships right now** — the diagnostic already names the kit, the cause, the consequence and the fix.

🔴 **The trap inside (a), which `kit-modules.js` already argues against itself.** Its comment says
faking a DOM *"would let a kit register nodes that cannot render server-side anyway, trading a named
failure for a silent one."* A shim carrying only `React` does not have that problem; a shim that
grows into a fake `document` does. If (a) is chosen, the ruling should say **`React` and nothing
else**, so the next session does not widen it to `document` and turn a loud failure quiet.

**RICHARD ANSWER (2026-08-18, s28): ✅ (a) then (b).** Shim `React` onto `window` in the SSR loader
so every kit that exists today works server-side, then move the documented pattern to a guarded
accessor and update the worked example and the scaffold.

🔴 **The shim carries `React` and NOTHING ELSE.** Not `document`, not a DOM. The moment it grows, a
kit registers nodes that cannot render server-side anyway and a **named** failure becomes a
**silent** one — which is the trade `kit-modules.js` already refuses in its own comment, and it is
right to. If a later session finds a kit that needs more than `React`, that is a new ruling, not a
widening of this one.

⚠️ **(b) is not optional follow-up.** Without it, new kits keep being written against a global that
may not exist and the shim quietly becomes load-bearing forever.

---

## 14. Should one bad kit definition cost its own node, or the whole app?

**Today, measured (s27 hit it; s28 pinned it with a test).** A kit logic node with no `category`
throws out of `registerModule`, which does not catch. The loop aborts, the module's remaining nodes
never register, and **the whole viewer renders nothing** — `reactMounted: false`, `rootChildren: 0`.
One missing field in one node of one kit takes down the entire preview.

⚠️ **s28 fixed only the naming.** The message now says which node, in which kit, and what the
consequence is. The blast radius is untouched, and
`test/registration-failures-name-the-kit.test.ts` asserts it is untouched — so this cannot drift
under a later commit without someone changing that test on purpose.

🔴 **The two failure modes in this family already behave differently, which is the real argument for
a ruling.** A kit with a *syntax error* is isolated: its nodes vanish, its neighbours live, the
viewer stays mounted, and it **recovers** when fixed. A throw inside `defineNode` takes everything
down. Same authoring mistake, opposite outcomes, and nothing documents why.

| | Option |
|---|---|
| **(a)** | Catch per definition: the bad node is skipped and reported, the kit's other nodes register, the app runs. |
| **(b)** | Catch per **kit**: the whole kit is skipped and reported — matching how a kit that throws at *load* already behaves. |
| **(c)** | Leave it: a malformed definition is an authoring error and a loud dead app is the honest signal. |

**Recommendation: (b).** It makes the two failure modes agree — a broken kit costs its own nodes and
nothing else, whether it broke at parse time or at registration time — and it is the behaviour the
SSR loader already chose deliberately (*"a kit that throws costs its own nodes and nothing else"*).
⚠️ **(a) is the tempting one and is the half-registered state CN-015 already calls the alarming
case**: nodes before the bad definition live, ones after it are gone, and the kit looks partly fine.
⚠️ Under (b) or (a), the reported failure must reach **Settings → Kits** by the same channel the
load-time failures use, or a quietly missing node replaces a loud dead app — strictly worse.

**RICHARD ANSWER (2026-08-18, s28): ✅ (b) — skip the whole kit and report it.** A broken kit costs
its own nodes and nothing else, whether it broke at parse time or at registration time. The two
failure modes stop disagreeing.

🔴 **The condition this ruling does NOT relax: the failure must reach Settings → Kits.** Skipping a
kit silently is strictly worse than today's loud dead app — it replaces a blank screen the author
cannot miss with a missing node they will blame on a typo. The reporting channel is not a nicety
attached to (b); it is what makes (b) safe.

⚠️ **`test/registration-failures-name-the-kit.test.ts` asserts the CURRENT blast radius** (*"still
aborts the module"*, and that a node after the bad one does not register). Implementing this means
**changing that test on purpose** — that is exactly why it was written that way. Do not delete it;
rewrite it to assert the new contract, so the next change to this behaviour is also deliberate.
