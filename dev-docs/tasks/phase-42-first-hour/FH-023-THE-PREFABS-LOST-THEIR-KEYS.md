# FH-023 — Four shipped prefabs lost their keys

**From:** the tail [FH-018](FH-018-THE-CONFIG-NODE-IS-INERT-AND-ITS-ENDPOINT-IS-PUBLIC.md) left
behind when the Config node was deleted (commit `dbd3116f`), recorded in
[`library/prefabs/AUDIT.md:415-423`](../../../library/prefabs/AUDIT.md).
**Depends on:** [CWF-009](CWF-009-THE-SECRET-NODE.md) — the `Secret` node (commit `3fb06d03`), which
is the replacement.
**Status:** ✅ **shipped 2026-08-06.** All nine nodes replaced, all four prefabs configurable again,
and the gate that would have caught this in the first place now exists.

## What was reported

FH-018 deleted `DbConfig` outright. Its closing note:

> ⚠️ **Four shipped prefabs are now in that state** — `send-grid` (1 node), `email-verification`
> (3), `mail-gun` (2), `stripe` (3), each inside a `…/Settings` cloud-function component feeding an
> API key to a Component Output. Left loud rather than rewired to a `String` node, which would ship
> an empty API key that looks like it works.

So four of the 29 shipped prefabs paint a red dashed missing-type placeholder on install, and the
only thing that would make them work again is a node that did not exist when they were written.

## The mechanism — confirmed at file:line, and the brief was wrong twice

### 1. Where the nine nodes are (confirmed, and this half is exactly right)

Read out of each `project/project.json`; every one sits in a `…/Settings` component whose only job
was to turn a config key into a Component Output:

| Prefab | Component | `configKey` | Is it a credential? |
|---|---|---|---|
| send-grid | `/#__cloud__/SendGrid/Settings` | `SendGridAPIKey` | **yes** |
| mail-gun | `/#__cloud__/MailGun/Settings` | `MailGunAPIKey` | **yes** |
| mail-gun | `/#__cloud__/MailGun/Settings` | `MailGunDomainName` | no |
| stripe | `/#__cloud__/Stripe/Settings` | `StripeAPIKey` | **yes** |
| stripe | `/#__cloud__/Stripe/Settings` | `StripeCheckoutSuccessUrl` | no |
| stripe | `/#__cloud__/Stripe/Settings` | `StripeCheckoutCancelUrl` | no |
| email-verification | `/#__cloud__/SendGrid/Settings` | `SendGridAPIKey` | **yes** |
| email-verification | `/#__cloud__/Sign Up/Settings` | `EmailVerificationDomain` | no |
| email-verification | `/#__cloud__/Sign Up/Settings` | `EmailVerificationFrom` | no |

⚠️ **Correction 1 — "nine Config nodes, all reading API keys" is wrong.** Four are credentials.
Five are per-deployment *configuration*: a Mailgun sending domain, two Stripe checkout redirect URLs
(which carried `useDevValue: true, devValue: "http://localhost:8574/…"`) and the verification email's
domain and From address. That distinction decides what the replacement is allowed to be, so it is
recorded before anything is built rather than discovered halfway through.

### 2. Every one of the nine is read **server-side** (so the browser question does not arise)

The brief's decisive trap — *"if a prefab's key is read on the browser side, the honest answer may be
that the prefab needs restructuring"* — was checked and does not fire. Walking every component in the
four prefabs for instances of a `…/Settings` component: **14 consumers, all of them under
`/#__cloud__/`.** No front-end component in any of the four instantiates a Settings component, and
stripe — the one prefab with a substantial front end (`/Stripe/Subscriptions/Plan Picker`, `Buy
Products`, …) — reaches its cloud functions through `CloudFunction2`, never through Settings.

So the swap is legitimate for all nine. The restructuring these prefabs need is a different one, and
it is §3.

### 3. The real restructuring: `DbConfig` was a value getter, `Secret` is an action

This is the whole engineering content of the task.

`DbConfig` published `value` from a synchronous getter, so a Settings component was a *pure value
source*: it had no inputs, no signals, and every consumer simply read `Settings.API Key` as a
standing value. `noodl.cloud.secret` is an action node — `fetch` (**Do**) in, `done`/`failure` out,
`value` readable only once `Done` has fired
([secret.ts inputs/outputs](../../../packages/noodl-viewer-cloud/src/nodes/cloud/secret.ts), catalog
`availableIn: ["cloud"]`). There is deliberately no auto-read: *"only the port mints an outcome
token, and `read` has no other caller"*.

Therefore **every Settings component becomes a fetcher and every consumer has to sequence it**:

```
Component Inputs.Fetch → Secret₁.fetch
Secret₁.done  → Secret₂.fetch → … → Secretₙ.done → Component Outputs.Ready
Secretᵢ.failure → Component Outputs.Failure
Secretᵢ.value   → Component Outputs.<the value port it already had>
```

and each consumer's trigger moves one hop:

```
   before:  Component Inputs.Do → Function.run
   after:   Component Inputs.Do → Settings.Fetch
            Settings.Ready      → Function.run
            Settings.Failure    → Component Outputs.Failure
```

The Secret nodes are **chained rather than fanned out** so that "all of them are ready" needs no
combinator node — there is no And/Join in the cloud vocabulary and inventing one for this would be a
worse answer than three wires.

Ordering is safe and this was read rather than assumed: `Node.prototype.flagOutputDirty` →
`sendValue` → `output.sendValue` delivers to connected inputs **synchronously**
([node.ts:699-703](../../../packages/noodl-runtime/src/node.ts#L699-L703)), and `doRead` flags
`value` dirty *before* `reportOutcomes(…, 'done')`. So `Value` has already landed when `Done` pulses.

### 4. ⚠️ The trap that would have made this ship a double-send

`Function` (`JavaScriptFunction`) inputs **re-run the script on every value change, by default**:

```ts
if (this.shouldRunOnValueChange('in-' + name)) this.scheduleRun();
```
([simplejavascript.ts:423](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts#L423)),
and `runOnValueChange` reads *absent* as ticked
([run-on-value-change.ts:41-45](../../../packages/noodl-runtime/src/run-on-value-change.ts#L41-L45)).

Today that is survivable in these prefabs by accident: `DbConfig` delivers the key at **load**, when
every other input is still `undefined`, so the spurious run throws early and harmlessly. Move the key
to fetch-time — *during* the request, when `To`, `From`, `Subject` and `Html` are all populated — and
the arriving key **auto-runs a complete send**, and then `Settings.Ready → run` sends it again.

So every Function node whose `run` this task re-times has `runOnChange-in-<name>: false` written for
each of its value inputs. That is not a workaround: it restores the contract these graphs were
authored against, which NDA-017 replaced (`if (!this.isInputConnected('run'))` used to make every
value input passive the moment `Run` was wired). **See the loose end at the foot of this doc — that
behaviour change was never migrated, and it is not confined to these four prefabs.**

### 5. Why the gate did not catch any of this

`npm run library:check` reported **58/58 entries clean** with nine missing-type nodes in the shipped
library, because `unknownNodeType` is `severity: warning` unless `--strict`
([rules/unknownNodeType.ts:34](../../../packages/noodl-editor/src/editor/src/validation/rules/unknownNodeType.ts#L34))
and the gate only fails on errors. Its own module comment says the opposite —
*"this only fails CI on errors (broken references — **an unknown node type**, a nonexistent port)"*
([scripts/library/check.ts:13-15](../../../scripts/library/check.ts#L13-L15)). The comment describes
the check somebody believed they had written.

## The decision, per prefab

Stated per prefab as the brief asks, with the reasoning that produced each one.

| Prefab | Verdict |
|---|---|
| **send-grid** | **Swap to Secret** + sequence its one consumer. 1 node → 1 Secret. |
| **mail-gun** | **Swap to Secret** + sequence its one consumer. 2 nodes → 2 Secrets. The domain is not a credential but rides the same door — see below. |
| **stripe** | **Swap to Secret**, sequence **9** consumers. 3 nodes → 3 Secrets. Two of the three are redirect URLs; their `devValue` localhost defaults are lost, deliberately. |
| **email-verification** | **Swap to Secret** *and* genuinely **restructure one component**: `/#__cloud__/Sign Up/Actions/Format Email` had **no signal at all**, so there was nothing to hang a fetch off. |

**Why the five non-credentials also go through `Secret`, and why that is not sloppiness.** A `String`
node was rejected for the reason the brief gives. But so was "String for the five, Secret for the
four": the five are all *per-deployment* values, and the Secret node's `functions` namespace is the
only door a cloud function has to a per-deployment value by name
([BACKEND-AUTHORING-MODEL § Secrets](../../reference/BACKEND-AUTHORING-MODEL.md),
[SecretsStore module comment](../../../packages/nodegx-backend/src/config/SecretsStore.ts)). Splitting
them would mean two configuration mechanisms per prefab, one of which fails silently. The policy
permits it — `functions` is *"the namespace the author of the project owns"*, and the only prohibition
runs the other way (**no subsystem may put its own credential in `functions`**). The prefab READMEs
say plainly which entries are secret and which are not.

**Why `Format Email` is the one true restructure.** It is a pure value transform: `Content` in →
`Content` out, with `Settings.Domain` feeding a Function that has no `run` wire and therefore
auto-runs on input change. Two things break if the Domain merely arrives later: the Function throws
`"You must specify the domain…"` on the run triggered by `Content`, and `Content` provably arrives
first (`request.pm-Email` is set before `receive` pulses, so `String Format` produces `formatted`
before any fetch can complete). The fix is to give the component the signal it never had — `Do` in,
`Done` out, both value inputs made passive — and to lift the Settings instance out of it into the two
cloud functions that call it, which fetch once per request.

## Slices

### Slice 1 — the four Settings components become fetchers

Replace each `DbConfig` with a `noodl.cloud.secret`, add `Fetch` to Component Inputs and
`Ready`/`Failure` to Component Outputs, chain the Secrets. Names are ALL-CAPS with `_` so that the
store key and the `NODEGX_SECRET_<NAME>` env suffix are the same string
(`functionSecretEnvName` upper-cases and replaces non-alphanumerics —
[SecretsStore.ts:190-192](../../../packages/nodegx-backend/src/config/SecretsStore.ts#L190-L192)):

`SENDGRID_API_KEY` · `MAILGUN_API_KEY` · `MAILGUN_DOMAIN` · `STRIPE_API_KEY` ·
`STRIPE_CHECKOUT_SUCCESS_URL` · `STRIPE_CHECKOUT_CANCEL_URL` · `EMAIL_VERIFICATION_DOMAIN` ·
`EMAIL_VERIFICATION_FROM`

Eight names for nine nodes: both `SendGrid/Settings` copies (send-grid's and the one
email-verification bundles) resolve the same `SENDGRID_API_KEY`, which is the correct answer for two
components that AUDIT.md §3.5 already diffed as identical.

### Slice 2 — sequence the 14 consumers

Move each trigger one hop through `Settings.Fetch`/`Settings.Ready`, wire `Settings.Failure` to the
component's `Failure` output where one exists, and untick `runOnChange-in-*` on every Function whose
`run` moved.

### Slice 3 — restructure `Format Email`

`Do` in, `Done` out, `Domain` becomes a Component Input, the Settings instance moves to
`Request Reset Password` and `Send Verification Email`.

### Slice 4 — write down what an author now has to do

Three surfaces, because the one an author reaches depends on where they are:

1. `library.json` `description` — the library card, read **before** install.
2. `library/prefabs/<slug>/README.md` — the full recipe: both doors, exact JSON, env names, and what
   the failure looks like.
3. Node **labels** inside the Settings components — the canvas is where an author lands when they
   open the prefab, and the label is the only text the canvas can carry.

### Slice 5 — the check that makes this class of defect impossible to ship again

Not "edit nine nodes and look at them". `library:check` gains a **missing-type** rule: a library
entry may not contain a node whose type resolves to neither the catalog nor a component reference —
**unless the entry ships `project/noodl_modules/`**, because a code module's whole purpose is to
provide node types the catalog cannot enumerate (measured: `modules/avatar` 47 × `Avatar`,
`modules/pdf-viewer` 1 × `module.inlineHtml`; no prefab ships one). It fails the gate, in the same
shape and the same output as the font rule beside it.

## Traps

- ⚠️ **A String node ships an empty key that looks like it works.** The brief's framing, and it is
  the reason the five non-credentials also went through `Secret` rather than half-way.
- ⚠️ **The double-send in §4.** A rewire that only moves wires and does not untick
  `runOnChange-in-*` sends every email twice and creates every Stripe session twice, and no gate in
  this repo would say so.
- ⚠️ **`Secret` is cloud-only** (`availableIn: ["cloud"]`). Putting one in a front-end component of
  a prefab would be a Secret node in a browser bundle. All 14 consumers were checked for this.
- ⚠️ **`secrets.json` does not travel with a deploy.** A prefab that works on the author's machine
  and 401s in production is the *expected* failure; the READMEs say so in those words, because the
  node's own error message does.
- ⚠️ **Stripe's `devValue` localhost defaults are gone.** `useDevValue`/`devValue` were `DbConfig`
  ports and have no equivalent on `Secret`. A stripe checkout now needs its two URLs provisioned
  even in local development. Deliberate: an unprovisioned redirect that silently points at
  `localhost:8574` in production is the exact failure this task exists to remove.
- ⚠️ **Two stripe components have no `Failure` output** (`Events/Process Stripe Payment Event`,
  `Events/Process Stripe Subscription Event`). One was added to each rather than dropping the
  failure on the floor — a webhook handler that cannot say it failed is its own defect.

## Done when

- ✅ No node of type `DbConfig` remains anywhere under `library/`.
- ✅ `npm run library:check` fails on a library entry containing a missing-type node — proven by
  re-introducing one and watching the gate go red, not by reading the code.
- ✅ Every one of the nine values is reachable by a cloud function through `noodl.cloud.secret`, and
  none of them is reachable from a browser bundle.
- ✅ Each of the four prefabs states its own configuration requirement on the library card and in a
  README beside it, naming every secret.
- ✅ `library:check`, `catalog:check`, `cloud-library:check`, `catalog:merge:check`,
  `typecheck:cloud`, `typecheck:runtime` all green.

## Loose ends — filed, not fixed

1. **NDA-017 silently changed every graph that had `Run` wired.** The old idiom
   (`if (!this.isInputConnected('run')) …`) meant *"wiring the control signal makes every value
   input passive"*. The per-input checkbox replaced it with *"absent means ticked"*, and **nothing
   migrated existing graphs** — there is no writer of `runOnChange-*` anywhere outside tests. Every
   `Run`-driven Function, Expression and Filter node in every project authored before 2026-08-01
   therefore auto-runs on inputs its author expected to be passive. This task unticked the boxes on
   the 11 Function nodes it re-timed inside these four prefabs; the general case is a runtime-wide
   decision (a migration, or `defaultEnabled` conditioned on `run` being connected) and belongs to
   whoever owns NDA-017.
2. **`scripts/library/check.ts`'s module comment claimed the check this task had to write.** The
   comment is now true. Worth recording as its own class: a comment that describes the check
   somebody meant to write reads exactly like one that describes the check they did.
3. **The Function nodes' own `failure` outputs are still unwired** in the two stripe event
   processors. Pre-existing; the new `Failure` output carries the Settings failure only.
4. **`DELIBERATELY_UNBOUND` in `nodeCapabilities.ts` still carries a `DbConfig` row** — FH-018's own
   loose end, still open, still gated by nothing.
