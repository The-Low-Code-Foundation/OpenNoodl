# DEF-009 — A public write door ships with no limit and nothing says so

> ✅ **CLOSED 2026-08-30 (s26). ACs 1–3 met 2026-08-29 (`44298914`); AC4 built s26** —
> see §6 below for the decision, its reason, and the correction the corpus forced.
>
> 🟡 **BUILT 2026-08-29 (`44298914`) — ACs 1–3.**
> `checkPublicWriteDoor` in the shared precondition set: fires
> `public-write-door-unlimited` (warning, never blocking) when a cloud function's Request
> ticks `allowNoAuth`, its configured `call` does not close the door, its graph holds a
> record-mutating node, and no `rateLimit` with `ratePerMinute > 0` exists for it in the
> project's `nodegx.security.json`. The message names both settable surfaces. **`security`
> undefined = do-not-check, null = no-policy-file, kept distinct** so a caller that cannot
> read the project root never warns about members-area's `claimAssociation`, which IS
> limited. Threaded through `preconditionDiagnostics` (all three MCP doors) — the drive
> spec (`def009PublicWriteDoorDrive.test.ts`) grades the threading, since a check whose
> option nobody passes never runs (DEF-002 AC6's story). 11 editor specs + 2 mutants
> killed. **Corpus** (`calibrate:door`, 178 projects): 110 public doors, **27 unlimited
> write doors in 23 projects — every one the shipped site-builder's `submitContactForm`**.
> **Scope 3 done**: `site-builder.security.json` now sets `10/min, burst 10` on it, the
> members-area shape. The members template build also seeds its policy before authoring,
> so its generator log stopped reporting three limited doors as unlimited.
> **AC4 (the default question) was Richard's** — ruled 2026-08-30 and built the same day (§6).

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


---

# 6. AC4 — the default, its reason, and what the corpus said back

> 🧭 **Ruled by Richard, 2026-08-30. Built s26, 2026-08-30.**
> **A public, record-writing cloud function with no `rateLimit` is limited to
> 60 requests a minute, burst 30, per caller.**

## 6.1 The decision and the reason, as AC4 requires

The reason is a **rung, not a number**. The product already grades its own
endpoints, and the ruling put a public write on the same rung as logging in:

| class | ratePerMinute | burst |
|---|---|---|
| oauth start | 20 | 20 |
| **`auth`** | **60** | **30** |
| `admin` | 300 | 100 |
| `data` | 1200 | 400 |

*"A public write is not a lighter act than logging in."* A contact form
submitted 30 times in a burst and then once a second sustained is far past any
human use; a bot writing rows until the disk is full stops cold.

🔴 **The ruling went AGAINST the recommendation put to Richard**, which was to
keep `null` and merely record the reason. AC4 is satisfied either way — it asks
for a written reason, not a change — and the change is the harder half, so it is
the half that is built and graded.

## 6.2 Where it lives, and the one distinction the whole thing rests on

`effectiveFunctionRateLimit` in `nodegx-backend/src/security/model.ts` is now
**THE** per-function resolver — the dispatcher's, the admin panel's and the boot
announcement's. The superseded `functionRateLimit` was **deleted** rather than
left beside it: two resolvers for one question is how a panel ends up showing one
number while another is enforced, which is the failure `effectiveFunctionRule`
already exists to prevent.

🔴 **`{ ratePerMinute: 0, burst: 0 }` is the limiter's existing *unlimited*
convention and the default must not collide with it** — the ruling's own caveat.
The old resolver normalised a zeroed policy to `undefined`, which made
*"the author asked for no limit"* and *"nobody said"* the same reading. They are
now different readings with different outcomes:

| in `security.json` | source | budget spent |
|---|---|---|
| `rateLimit: { 60, 30 }` | `declared` | 60/30 |
| `rateLimit: { 0, 0 }` | `declared` | **none** — a deliberate opt-out |
| no `rateLimit` key, public + writes | `public-write-default` | **60/30** |
| no `rateLimit` key, anything else | `none` | the class bucket alone |

⚠️ **An entry that sets only `call` has said nothing about rate.** The admin PUT
deletes a field when sent `null`, so "there is an entry" is not consent —
reading it as consent would exempt every function anyone ever bothered to
configure.

## 6.3 🔴 The corpus check the ruling demanded, and it did not confirm the shape

**The command, written down this time** (s25 could not reproduce s17's and had to
measure a different population):

```
npm run calibrate:door -- "$HOME/vscode_projects/Noodl projects" \
                         "$HOME/vscode_projects/NodeGX test projects" --json
```

**179 projects · 620 cloud components · 114 public doors · 27 unlimited public
write doors in 23 projects.** The count is the same as the ruling's evidence.
**The composition is not.**

The ruling was made on *"27 unlimited public write doors across 23 projects, **all
`submitContactForm`**"* — a homogeneous population of trivial contact forms, for
which 60/30 is obviously generous. Measured at HEAD, **17** are
`submitContactForm` and **ten are not**:

| function | projects | shape |
|---|---|---|
| `ses_sns_response` | LearnBook, LearnBook test, LB copy backup | **SES/SNS delivery webhook** |
| `stripe-webhook` | Resourceful, open-noodl-hosting | **payment webhook** |
| `Stripe/Process payment` | Resourceful | **payment webhook** |
| `Copy nocodb course` | Resourceful | bulk import |
| `OLD Copy purchased course` | Resourceful | bulk import |
| `Set Team Roster Record Properties` | emdashdev | bulk write |
| `backendStatus` | open-noodl-hosting | status ping |

All four projects date from 2024–2025 and were in the 178 the original sweep
walked, so **the claim was an overstatement when it was written**, not drift
since. ✅ *Prose that overstates is still prose* — the count was right and the
sentence after it was not.

🔴 **The ruling asked me to "confirm none of them legitimately bursts past 30."
I cannot, and three of the ten are exactly the shape that does.** A provider
callback is not a human at a form: an SES bounce fan-out or a Stripe retry storm
can arrive far faster than 30 in a burst, and a 429 to a provider is a
notification that may never be delivered again.

**Built anyway, as ruled** — the decision is Richard's and the hazard is bounded
by two things that are built and graded rather than described:

1. **The escape hatch is explicit and cheap** — `{ ratePerMinute: 0, burst: 0 }`
   opts an endpoint out entirely, and it is named in the boot line, in the door
   warning and in the admin panel.
2. **`functionRateLimitAnnouncement` names every affected endpoint at start-up**,
   deliberately outside the non-loopback block that guards the other rate-limit
   warnings — those are about how the service is exposed, this is about a budget
   that applies wherever it runs. 🔴 **This is AC1's other half.** *"Nobody can
   fill my database from my contact form without me having been told that was
   possible"* has a twin the moment a default exists: nobody's webhook should
   start refusing a provider's retries without the operator having been told
   either — and they are told by their own log at boot, not by the provider's
   dashboard a week later.

## 6.4 What else read the field

s25's lesson, applied before building rather than after: **a ruling can be right
and not know what it costs**, so grep the field's other readers and run them both
ways.

- 🔴 **The door's own message said the class bucket was "the only bound until one
  of those is set."** That sentence became false the moment the default existed —
  the check would have gone on telling authors they were unmetered while the
  backend metered them. It now says which of **two** things is true, because two
  states reach that line and they are no longer the same state: an undeclared door
  is told the default and its numbers; a deliberately zeroed one is told it has
  opted out. Both arms are asserted, and the superseded sentence is asserted
  **absent**, so a door that says it again is a regression rather than a
  rewording.
- **The admin panel** reported the declared `rateLimit` and nothing else — honest
  while undeclared meant unlimited, a lie afterwards. It now carries
  `effectiveRateLimit` + `rateLimitSource` beside the faithful declared value,
  which is `timeoutMs`'s existing treatment (CWF-018) rather than a new idea.
- **`GET /admin/workflows`** now reports `writesRecords` per function, because the
  panel cannot show what budget applies without it.

## 6.5 Evidence

`packages/nodegx-backend/tests/def009-public-write-default.test.ts` — **14 specs,
real HTTP, real service, enforcement on.** Nothing measures "the row did not
appear": every arm reads the status and the 429's own text, whose numbers tell
the per-function bucket from the shared class one (600/min, burst 200).

🔴 **A known-firing signal sits beside every absence.** `declared-tight`
(1/min, burst 1) refuses on its second call in the same fixture, over the same
transport, in the same run — so "not limited" is an absence of a limit and not an
absence of a request.

**Pre-fix, on the same spec** (M1 — the dispatcher reading the declared policy
only, which is HEAD's behaviour): the 31st call to a public writing function
returned **200**. Post-fix it returns **429** naming `60/min, burst 30`.

**Six mutants, each killed by its own arm:**

| | mutation | killed by |
|---|---|---|
| M1 | dispatcher not wired (= pre-fix) | the writer is limited at 30 |
| M2 | a zeroed policy read as "nobody said" | the `{0,0}` opt-out |
| M3 | the write condition dropped | the public read-only arm |
| M4 | the public-posture condition dropped | the shut-door writer |
| M5 | the announcement stops filtering | it names only what it bounds |
| M6 | the backend write list drifts by one type | the cross-package agreement |

⚠️ **M6 is the one that guards a real hazard.** `RECORD_WRITE_NODE_TYPES` now
exists **twice** — in the editor's door and in `nodegx-backend`'s
`functionDeclarations.ts` — in packages that cannot import each other. The door
**warns** about exactly the population the default **limits**, and a type renamed
on one side would silently narrow one of them. The spec reads the other file and
compares, with a control asserting the list was actually parsed so an equality
against `[]` cannot pass for agreement.

Suites green: `nodegx-backend` **123/123 files, 1466 passed** (one expectation
updated: `GET /admin/workflows` carries the new field);
`noodl-editor tests-unit/def-009` 13/13; `noodl-mcp def009PublicWriteDoorDrive`
2/2. The corpus sweep re-run after the door edit reports the same 27/23, so the
predicate moved with the message and not under it.
