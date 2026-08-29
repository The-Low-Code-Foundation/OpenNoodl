# DEF-009 — A public write door ships with no limit and nothing says so

**Source: phase 76 F3**, recorded 2026-08-26 and **filed nowhere**. Its own text says *"Open
question for Richard / possibly a core gap to file."* It appears **exactly once** in the whole of
phase 76 and was never picked up.

🔴 **It is the clearest instance of the failure phase 80 exists to stop**, which is why it is here
rather than in a register: a security-relevant finding that ended its life as a sentence in a task
file.

## 1. The premise as recorded, and what is actually true

**F3, as written:** *"`submitContactForm` is a public door that writes rows, and no rate limiting
was found in the sweep. It is the correct shape (one function, fixed row, `create: 'nobody'`
everywhere else), but a template that ships with a public write endpoint should say what stops a
bot."*

🔄 **Half refuted at HEAD, 2026-08-29.** Rate limiting is not missing from the platform:

- `packages/nodegx-backend/src/ops/rate-limit.ts` — one limiter for the service, 65 references
  across the backend
- **per function**: `PUT /admin/permissions/functions/:name` sets
  `call / runAs / rateLimit / timeoutMs` (`server/admin-security.ts:9,231,273`), with
  `rateLimit: { ratePerMinute, burst }`
- `service.ts:194` already **warns at boot** when `rateLimit.enabled` is false on a non-loopback
  bind, and at `:186` when `trustedProxies` is `["*"]`

✅ **So the mechanism exists, is per-function, and the service already knows how to complain about
its own configuration.**

## 2. The row that survives, and it is narrower and still real

**Nothing connects the mechanism to the author.** A template ships a function whose `call` posture
is public and whose body writes rows, its `rateLimit` is `null`, and:

- the template does not set one,
- the MCP door does not mention it when a cloud function is authored with public access,
- and the boot-time warnings fire on **service-wide** configuration, never on **this endpoint being
  unlimited**.

**Where it bites a person.** The site owner who installs the template and gives out the URL. A bot
finds the contact form and writes rows until the disk is full — and the one person who could have
set a limit was never told there was one to set.

⚠️ **`submitContactForm` is the correct shape otherwise** and that is worth keeping in view: one
function, a fixed row, `create: 'nobody'` everywhere else. The defect is not the endpoint's design.

## 3. Scope

1. **A warning where the author is** — the door, when a cloud function is authored or validated with
   a public `call` posture, a write in its graph, and no `rateLimit`. Same family as
   [DEF-002](DEF-002-THE-DOOR-DOES-NOT-CHECK-CONNECTIONS.md) and it may as well land beside it.
2. **A default worth having** — decide whether a public function's `rateLimit` should default to
   *something* rather than `null`. 🧭 **Richard's**: a default that is too low breaks a legitimate
   burst, and a default of `null` is what shipped.
3. **The template sets one**, as evidence, not as the acceptance.

## 4. Acceptance criteria

1. **A person's sentence:** *nobody can fill my database from my contact form without me having been
   told that was possible.*
2. Authoring a public, writing cloud function with no `rateLimit` produces a **named** diagnostic.
3. 🔴 **A negative arm**: the same function with a `rateLimit` set, and a public **read-only**
   function, both produce nothing. A warning that fires on every cloud function will be switched off
   within a week.
4. Whatever is decided about a default is **written down with its reason**, including if the decision
   is to keep `null`.

## 5. Traps

- 🔴 **The premise of this row was already half wrong once.** Re-read `ops/rate-limit.ts` and
  `admin-security.ts` before concluding anything is missing. *A reading that fits is not one that
  excludes.*
- 🔴 **`grep` for the mechanism a ruling names.** F3 concluded "no rate limiting" from a sweep that
  did not find it; it was there.
- ⚠️ **A refused write and a filtered read are the same shape** — do not measure the limiter by
  "the row did not appear".
- ⚠️ **A new route owes four sweeps** (UNI-001); a **method** fires none. This should need neither.
