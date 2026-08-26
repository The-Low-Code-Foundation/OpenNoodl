# SB-016 — the function gate has no defaults tier, and falls back open

**Status: ✅ BUILT s12.** The deploy interlock ships
(`security/state.ts`, `UNDECLARED_FUNCTION_ON_PUBLIC_BIND`), with the endpoint
scan extracted so the gate and the runner share one predicate
(`workflow/functionDeclarations.ts`). **30 specs / 5 mutants graded**,
`nodegx-backend/tests/sb016-function-gate-interlock.test.ts`.

🔴 **§4's open predicate is settled by measurement, and the reason §4 gave for
the narrow candidate was wrong.** See §6.

**MEASURED s11 as SB-015 F23, in a browser-adjacent drive over real HTTP.**
Filed rather than absorbed into SB-015 because it is **not a template gap**: it is a
property of every NodeGX project that deploys with the default security posture, and
which of three dispositions it takes is a ruling.

---

## 1. The claim, and it is measured

On a backend running `defaultSecurityConfig()` with `devOpen: false` — the state
SB-015 arm C measures, and the state the startup refusal's own instruction produces —
**a stranger who signs up can call the site's admin endpoints, and the call runs as
system.**

Measured, not derived (`nodegx-backend/tests/sb015-default-policy-drive.test.ts`):

| | arm C — defaults, `devOpen: false` | arm D — SB-004 §4's policy |
|---|---|---|
| stranger `POST /users` | `201` | `201` |
| stranger `POST /functions/publishPage` | `200` | `403` |
| the owner's draft afterwards | 🔴 `published: true` | `published: false` |

🔴 **The consequence is asserted, not the status code.** s10's finding in this phase was
an endpoint that answered the correct refusal *having already granted the caller admin*,
so what this reads is the record the owner gets back.

## 2. Why it happens, and why it is not the collection behaviour

Two gates, two fallbacks, and only one of them has a defaults tier.

**Collections** fall back to `defaults.permissions` — `authenticated` in the shipped
default, so an undeclared collection is closed to anonymous callers. That is SB-015's
"deployed, nothing is visible" half, and it fails *shut*.

**Functions never consult `defaults` at all.** `effectiveFunctionRule`
(`security/model.ts:592-596`):

```
a config entry wins; otherwise the graph's `Allow Unauthenticated` decides
  (ticked = public, unticked = authenticated)
```

So with `functions: {}` every endpoint resolves to `authenticated` or `public` from its
own Request node, and **nothing in the security file can lower it**, because there is no
tier to lower it from. `signup` is `public` by default, so `authenticated` costs one
request.

And the call is not an attempt at a privileged write — it *is* one. A cloud function
runs as system: `service.ts:492-499` hands the runtime the master key, which "resolves to
the admin principal and bypasses CLPs/ACLs". So the function gate is the **only** thing
between the caller and a system-privileged write. There is no second boundary behind it.

⚠️ **The precedence itself is deliberate and documented** — the source comment says so in
as many words, and naming it changed nothing about what an undeclared function does. The
finding is not that the rule is undocumented. It is that **the two gates fail in opposite
directions from the same file**, and the one with no defaults tier is the one whose
callers run as system.

## 3. How much of a real template it exposes

Of Site Builder's four endpoints, with `functions: {}`:

| endpoint | `Allow Unauthenticated` | resolves to | SB-004 §4 wanted | agrees? |
|---|---|---|---|---|
| `submitContactForm` | ticked | `public` | `public` | ✅ |
| `claimSite` | unticked | `authenticated` | `authenticated` | ✅ |
| `publishPage` | unticked | `authenticated` | `role:admin` | 🔴 no |
| `duplicatePage` | unticked | `authenticated` | `role:admin` | 🔴 no |

Two of four land right **by coincidence** — the graph port happens to encode the intended
rule. The two that do not are exactly the two privileged ones, because
`Allow Unauthenticated` has two values and the policy this template needs has three.
🔴 **The port cannot express `role:admin` at all**, so no amount of careful authoring
closes this from the graph side.

## 4. Three dispositions, and which is the ruling

1. **Give functions a defaults tier.** `defaults.functions.call`, consulted between the
   config entry and the graph port. Symmetric with collections, and a deployer who sets
   one line gets a closed posture. ⚠️ Changes what an existing undeclared function does
   on every backend already deployed — the migration is the cost, not the code.
2. **Make the deploy interlock refuse a function it cannot resolve from config.** A
   non-loopback bind with endpoints that resolve only from the graph port refuses to
   start and names them. Fails loud rather than open, changes no existing running
   backend, and is the same shape as the `devOpen` interlock that already exists.
   ⚠️ Turns a working deploy into a refused one for anybody relying on the graph port.
3. **Leave the mechanism and close it upstream** — whatever SB-015's ruling turns out to
   be, a policy that reaches the backend carries a `functions` block, and this stops
   being reachable for projects that get one. ⚠️ Does nothing for a project that does
   not, which today is every project.

✅ **RULED s11 (Richard): disposition 2 — the deploy interlock refuses.** A non-loopback
bind whose endpoints resolve only from the graph port refuses to start and names them.

Why it is the right one of the three, stated so the next session does not relitigate it:
it **fails loud** where the current behaviour fails open, it changes **no already-running
backend** (the refusal is at start, and a backend that starts today with a `functions`
block keeps starting), and it is **the same shape as the interlock that already exists**
two lines away — `DEV_OPEN_ON_PUBLIC_BIND` already refuses a deploy over a security
setting and already names the fix in its message. ⚠️ Its cost is real and is the thing to
watch: a deploy that works today, relying on the graph port, becomes a refused one. So the
message must name **every** unresolved endpoint and the exact `functions` block to paste —
the failure this task is about is a failure of *messages*, and a refusal that says only
"some function is unresolved" reproduces it one layer up.

✅ **The predicate is settled — see §6.** The broad one ships.

## 5. What is measured and what is not

✅ **Driven**: the table in §1, over real HTTP against a real SQLite backend, with the
consequence read off the record rather than off the response.

✅ **Read from source, cited**: the precedence, the absence of a functions defaults tier,
the master-key execution context.

⬜ **Not swept.** Whether other shipped or templated projects have endpoints in the same
shape is the corpus question, and it is the same disposition SB-009 and SB-010 carry:
the fix is not the argument, the sweep is.

⬜ **Not measured**: `duplicatePage` by a stranger. It resolves identically by the same
line of code and the table above states it from the source rather than from a drive —
recorded as derived, because one endpoint was driven and the other was not.


---

## 6. The predicate, measured — and §4's stated reason for the narrow one is false

§4 offered a refinement and a reason to prefer it: *refuse only where the port
resolves to `authenticated`*, because "of this template's four endpoints, that
predicate refuses exactly the two that are wrong."

🔴 **It does not.** Read off the shipped bundle
(`sb016-function-gate-interlock.test.ts`, `choosing the predicate`):

| endpoint | port | resolves to | SB-004 §4 wants | wrong? | broad refuses | narrow refuses |
|---|---|---|---|---|---|---|
| `submitContactForm` | ticked | `public` | `public` | no | ✅ | — |
| `claimSite` | unticked | `authenticated` | `authenticated` | no | ✅ | 🔴 ✅ |
| `publishPage` | unticked | `authenticated` | `role:admin` | **yes** | ✅ | ✅ |
| `duplicatePage` | unticked | `authenticated` | `role:admin` | **yes** | ✅ | ✅ |

The narrow predicate refuses **three**, not two: `claimSite` is unticked, so it
resolves to `authenticated` from the port, and `authenticated` is exactly what
SB-004 §4 wants for it. §4's claim was a plausible reading of §3's table taken
one column at a time — the *wrong* column and the *unticked* column are not the
same set, and the table shows both.

🔴 **The finding underneath is that neither predicate discriminates**, and no
startup-time predicate can. What separates `claimSite` from `publishPage` is an
intention that exists in neither the graph port nor the config. So "refuse
exactly the wrong ones" was never available, and the choice is actually between
*declare every endpoint* and *declare every endpoint except the ones open to the
world*.

**The broad predicate ships**, and the reason inverts §4's:

- ticking `Allow Unauthenticated` **is** an affirmative act, but it is one
  performed on a canvas, possibly by somebody else, possibly a year ago — and its
  consequence is *the only endpoints an anonymous stranger can reach at all*. An
  interlock that waves those through is silent about precisely the surface it
  exists to protect. On this template the narrow predicate exempts exactly one
  endpoint, and that endpoint is the `public` one;
- after the broad refusal is satisfied, `security.json` describes **every**
  endpoint the backend serves — which is the property the panel, the audit trail
  and the next deployer all read it for. The narrow one leaves a permanent
  undeclared tier.

So the refusal does not say *this is wrong*. It says **you have not said**.

## 7. The message, graded like code

⚠️ §4's ruling made the message a requirement, and this task is about a failure
of *messages*, so it is asserted rather than reviewed. What it contains, and what
each property is defended by a spec for:

- **every** unresolved endpoint by name, with its port state and what this deploy
  would enforce — never "some function";
- `<-- callable by anyone on the internet` on the ones resolving to `public`, and
  not on the others;
- the `security.json` path, by path;
- why it happened — no defaults tier, and the call runs as system;
- the `functions` block to paste, **merged with any entries that already exist**
  (a deployer with three declared and one not who pastes a one-key block has just
  undeclared the other three — graded by a mutant), and preserving sibling fields
  like `timeoutMs`;
- 🔴 **every rule in the block is the one being enforced right now**, so pasting
  it changes nothing about who can call what. The refusal asks for a decision to
  be *recorded*, not for behaviour to change, and the zero-risk answer has to be
  the one in front of somebody under time pressure. Graded by a mutant that emits
  `authenticated` for everything;
- and then *tighten it*: `role:admin` is what the port cannot express, and
  `authenticated` means any account that can sign up.

🔴 **And that the message is SUFFICIENT is a separate spec from every claim about
its text**: the block is extracted from the refusal, written into `security.json`,
and the same service started again. Text assertions say the message is plausible;
that one says following it gets you out.

## 8. Where it runs, and why not where the runner is

Startup **step 1.5**, beside `DEV_OPEN_ON_PUBLIC_BIND`, reading the workflow
bundles straight off disk (`scanDeployedFunctions`).

🔴 It cannot use the `WorkflowRunner`, which is the obvious source: the runner
comes up at **step 5**, and the HTTP server listens at **step 3**. An interlock
that fires after the port is open is not an interlock. There is a spec for
exactly that — the refusal happens and the chosen port is still bindable
afterwards.

⚠️ The cost of a second reader is drift, so the predicate itself
(`findRequestNode`, the `/#__cloud__/` prefix, SB-003's has-a-Request-node rule)
moved into `workflow/functionDeclarations.ts` and `WorkflowRunner` imports it.
A spec asserts the two agree over a real deployed bundle — same names, same
workflow, same port — rather than trusting that they must.

## 9. What this changes for existing deploys

- **A loopback backend: nothing.** The interlock is gated on a non-loopback bind,
  and the known-firing control for every "it started" reading in the suite is the
  same undeclared config starting at `127.0.0.1`.
- **A non-loopback backend with no cloud functions: nothing.** The scan answers
  `[]` and there is nothing to declare.
- **A non-loopback backend with functions and a complete `functions` block:
  nothing.** It was already resolved.
- **A non-loopback backend with functions and no rules: it now refuses**, with
  the block to paste. This is the cost §4's ruling named, and it is real.

🔴 **Including this repository's own container deploy.** `deploy/entrypoint.sh`
copies `deploy/security.production.json` on first run, and that file is the
shipped default with `devOpen: false` — `collections: {}`, `functions: {}` —
which is arm C exactly. Any project with cloud functions deployed that way lands
in the state SB-015 measured, and now gets the refusal instead. `deploy/README.md`
says so.

## 10. Still not done

⬜ **The corpus sweep.** §5's question stands: whether other shipped or templated
projects have endpoints in the same shape. The interlock makes the answer *loud
at deploy time* rather than *known in advance*, which is a different thing.

⬜ **A defaults tier for functions (disposition 1) is not built and was not
ruled.** The asymmetry in §2 is still there: an undeclared collection falls back
to `defaults.permissions`, an undeclared function falls back to a checkbox. The
interlock means a *deployed* backend can no longer be in that state silently; a
loopback one still can.

⬜ **`duplicatePage` by a stranger is still underived rather than driven** in the
sense §5 meant — but its port is now read off the artefact by the same scan as
`publishPage`'s, so the two rows have the same provenance. The remaining gap is
the HTTP call, not the resolution.
