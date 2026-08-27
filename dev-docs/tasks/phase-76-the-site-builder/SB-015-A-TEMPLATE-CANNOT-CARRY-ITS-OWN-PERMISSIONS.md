# SB-015 — a template cannot carry the permissions its graphs assume

**Status: ✅ BUILT s12.** Derived s9, **driven s11**, **built s12** as shape 1: the
template ships `site-builder.security.json`, a new project receives it as
`nodegx.security.json`, and the backend installs it as its own `security.json`
before `SecurityState` reads one. **22 specs + 5 editor specs**
(`nodegx-backend/tests/sb015-project-policy.test.ts`,
`noodl-editor/tests-unit/sb-015/template-ships-a-policy.test.ts`).

⚠️ **One provisioning path is wired and one is not** — see §7. The MCP spawner
passes `--project-dir`; the editor's `ServiceSupervisor` does not yet.

---

## 1. The claim

SB-004 §4's security policy is what makes this template's publication boundary real:

```
Page, Section, Theme, SiteSettings   find/get: public   create/update/delete: role:admin
ContactMessage                       find/get/update: role:admin   create: nobody   delete: nobody
publishPage, duplicatePage           call: role:admin
submitContactForm                    call: public
claimSite                            call: authenticated
defaults.creatorOwns                 false
devOpen                              false
```

That is `security.json` in a **backend's data directory**. SB-007 ships a **project
directory**. There is no field in `project.json`, no file in the v2 layout, and no
mechanism in `provisionBackend` that carries a project's required policy to the backend
it provisions — `backendRequirementFor` is about *"this node needs a backend at all"*,
not about what that backend must permit.

So a person who picks Site Builder gets nineteen graphs that assume the table above, and
a backend that has none of it.

## 2. What they get instead, and it fails in two opposite ways

`defaultSecurityConfig()` (`packages/nodegx-backend/src/security/model.ts:282-301`):

```ts
devOpen: true,
defaults: { permissions: { find/get/create/update/delete: 'authenticated' }, creatorOwns: true },
collections: {}, functions: {},
```

**Locally, nothing is enforced.** `devOpenActive` is `devOpen && loopback`
(`state.ts:200-201`), and it disables row-level ACL entirely (`state.ts:286-287`). So on
the machine where the site is built, **every draft is visible to every anonymous
visitor** — the exact configuration SB-008 kept as its dev-open twin *because the same
draft renders in it*. The template appears to work and its one product does not.

**Deployed, nothing is visible.** A non-loopback bind with `devOpen: true` refuses to
start (`state.ts:182-188`), and its message says *set `devOpen: false` (then configure
collection permissions)*. Set it false with `collections: {}` and `Page.find` falls back
to the default — `authenticated` — so the public site serves nothing to the public. The
contact form's `create` is `authenticated` too, and `claimSite` has no `functions` rule.

🔴 **The two failure modes are opposite, and each looks like the other's fix.** Somebody
who hits the second and reaches for the first has turned the boundary off.

## 3. Three shapes, and the ruling is which

✅ **RULED s11 (Richard): shape 1 — the template ships a policy file and provisioning
applies it.** Taken with §5's drive in hand rather than against the derivation alone: both
failures are silent, one of them is misattributed (F24), and one half is a privilege
escalation (F23 → SB-016), so nothing that depends on the author noticing arrives in time.

⬜ **Not yet designed, and the two objections §3 raises against this shape are still
live** — a project-level artefact every existing project lacks, and a policy travelling
with a *shared* project is a policy its recipient did not write. Both are about what
happens on the receiving end, so the design needs to say what a recipient is shown. ⚠️ And
the local case still needs its own answer (below): applying a policy file does not by
itself decide what `devOpen` should be on the machine the site is built on.

1. **The template ships a policy file and provisioning applies it.** A
   `nodegx.security.json` (or a `security` block in `nodegx.project.json`) written into
   the project by the template and read by `provisionBackend`. Most direct; adds a
   project-level artefact every existing project lacks, and a policy that travels with a
   *shared* project is a policy a recipient did not write.
2. **The permissions panel derives a proposal from the graph.** The information is
   there — every `Create Record`'s access rules, every `CloudFunction2`'s name — and the
   panel already knows the vocabulary (`ruleVocabulary.ts`). A button, not a file. Costs
   a derivation nobody has written and cannot be complete (a rule the graph never states
   cannot be derived).
3. **It stays manual and the template says so.** A `PROJECT.md` in the template naming
   the table in §1. Cheapest, and the one that is certainly not enough: the failure is
   silent in both directions and neither message points at permissions.

⚠️ **Whichever is chosen, the local case needs its own answer.** `devOpen: true` on a
fresh backend is a deliberate ease-of-start decision that predates this template, and it
is right for most projects. It is wrong for the only kind of project whose product is
*what a stranger cannot see* — and the template cannot tell.

## 4. What is measured and what is not

✅ **Read from source, cited**: the default config, `devOpenActive`'s effect, the
non-loopback refusal, the absence of any project→backend policy path.

✅ **DRIVEN s11.** `packages/nodegx-backend/tests/sb015-default-policy-drive.test.ts` —
**15 specs**, three configurations of one authored project, driven in headless Chrome with
no credential of any kind. §2 is now a measurement, and it was **understated in both
directions**. See §5.

The instrument is SB-008's, extracted to `tests/helpers/site-drive.ts` and shared rather
than copied, so the control here and the control there cannot drift. Everything either
side of `security.json` — the authoring, the authoring *order*, the deployed bundle, the
seed script, the browser, the settle loop — is one function called three times.

🔴 **Arm A writes no `security.json` at all**, which is what `provisionBackend` leaves
behind; the backend mints its own. The suite asserts the minted file equals
`defaultSecurityConfig()` byte for byte, so the arm is about provisioning and not about a
constant typed into a test.

## 5. What the drive found

One project, one seed, three policy files. The control (D) is SB-004 §4's policy and
renders the site SB-008 measured.

| reading | **A** — as provisioned | **C** — `devOpen: false`, nothing else | **D** — SB-004 §4 |
|---|---|---|---|
| `enforced` | `false` | `true` | `true` |
| anonymous `/` (published) | renders | 🔴 **not found** | renders |
| anonymous `/secret` (draft) | 🔴 **renders in full** | not found | not found |
| the draft in the site's nav | 🔴 **yes, on every page** | — (nav empty) | no |
| anonymous `GET /classes/Page` | `200`, **2 rows** | `403` | `200`, 1 row |
| stranger signs up → `publishPage` | 🔴 `200`, **draft published** | 🔴 `200`, **draft published** | `403`, still a draft |
| asked to bind beyond localhost | refuses, `DEV_OPEN_ON_PUBLIC_BIND` | starts | starts |

§2's two halves are confirmed exactly. Two things it did not say:

🔴 **F23 — the function gate does not fall back the way the collection gate does, and it
falls back *open*.** §2 reads the deployed failure as *nothing is visible*, which is a
claim about collections. Functions never consult `defaults`: with no `functions` entry the
rule comes from **the graph's own `Allow Unauthenticated` port**
(`effectiveFunctionRule`, `security/model.ts:592-596`) — ticked is `public`, unticked is
`authenticated`. Of this template's four endpoints, `submitContactForm` (ticked) and
`claimSite` (unticked) happen to land on the rule SB-004 §4 wanted; **`publishPage` and
`duplicatePage` land on `authenticated`, and `signup` is `public` by default.** So
becoming a principal who may drive the site's admin verbs costs one request — and a cloud
function runs **as system** (`service.ts:492-499`, the master key bypasses CLP and ACL),
so the call is a privileged write, not an attempt at one. Measured as a consequence and
not as a status code: the stranger's draft comes back `published: true`. **The deployed
failure is not one-directional** — the collection half serves the public nothing while
the function half hands a stranger the site's admin verbs.

🔴 **F24 — a refusal renders as the not-found panel, so the failure is not merely silent
but misattributed.** A `403` on `Page.find` reaches the site as an empty result, and an
empty result is what an unpublished slug produces. Arm C's *published home page* draws the
same panel as arm D's *genuine draft*: same message, same `<h1>`, same tab title.

⚠️ **The first version of that spec claimed the two screens were identical and was red** —
which is why it is a spec and not a sentence. They differ in exactly one way, and the
difference points away from the cause: the genuine draft still carries the site's chrome
(the settings row and the nav are answered, so the reader sees *Kestrel Joinery* and a nav
band above the message), while arm C loses those too and renders the bare string. So arm C
reads as *an empty site*, not as *a refused one*. The only other trace is a console
`query-records/query-failed` — the same shape as SB-008 F18, and no structural spec reads
it.

So the person in arm C is told **"That page could not be found"** about a page they have
just published, on every URL of their own site, including the root. The screen points at
publishing. The cause is a file they have never seen and were never given — and the
instruction they *have* been given points at arm A.

⚠️ **Both instructions that exist name only half the fix.** The startup refusal says *set
`devOpen: false` (then configure collection permissions)* — the second half in
parentheses. The `SECURITY DEFAULTS APPLIED` warning a fresh backend prints
(`service.ts:228`) says *Set `"devOpen": false` in security.json to test enforcement
locally* and does not mention collection permissions at all. Following either literally
produces arm C.

⬜ **Still not driven**: the editor's own provisioning path. This drive constructs the
data directory the way SB-008 does rather than calling `provisionBackend`, so it measures
*what a backend with the default policy does* and not *that provisioning produces one*.
The second half is §1's source reading — neither provisioning path mentions security at
all, re-checked s11 — and it is a one-line grep rather than a drive.


---

## 6. What was built (s12), and the answers §3 owed

### 6.1 The shape

| piece | where |
|---|---|
| the artefact a template ships | `noodl-editor/…/templates/site-builder.security.json` |
| the field that carries it | `ProjectTemplate.securityPolicy` (optional) |
| what puts it in a project | `EmbeddedTemplateProvider.install` → `<project>/nodegx.security.json` |
| what applies it | `nodegx-backend/src/security/projectPolicy.ts` |
| when | service startup **step 1.4**, before `SecurityState` |
| how a spawner asks for it | `--project-dir <dir>` (`BackendServiceOptions.projectDir`) |

The project-side file is **exactly a backend's `security.json`**, validated by
the same `validateSecurityConfig`. One grammar, no translation layer, nothing to
drift.

### 6.2 §3's first objection — "a project-level artefact every existing project lacks"

True, and **the absence is the no-op**. A project with no `nodegx.security.json`
provisions exactly as it does today; a spawner that passes no `--project-dir`
behaves exactly as it does today. Nothing migrates. The mechanism is opt-in by
construction rather than by a flag somebody has to remember.

### 6.3 §3's second objection — "a policy a recipient did not write"

The design owes an answer for what a recipient is shown, and it is three things
rather than a dialog:

1. **It is a file at the project root**, not a block inside
   `nodegx.project.json`. A recipient can open it, diff it, and delete it, and it
   shows up in a review of the project the way any other source file does. That
   is the whole reason it is not a nested field.
2. **It can only ever replace the defaults.** `applyProjectPolicy` writes only
   when the backend has no `security.json` — the rule `deploy/entrypoint.sh` has
   followed since WF-003. A received policy cannot loosen a posture somebody set;
   the only thing it can displace is `defaultSecurityConfig()`, which is what the
   backend was about to mint anyway. Graded by a mutant.
3. **When it cannot apply, that is said out loud.** `backend-already-configured`
   is a named outcome with a message, because *a correct policy that is not the
   one being enforced* is SB-015's own bug, and the only difference here is that
   we know it. The MCP provision reports the same thing in its `warnings` when it
   adopts or reuses a backend, where no start happens for the service to notice.

⚠️ **What it is NOT is a sandbox.** A policy file can say `find: "public"` on
every collection, and a recipient who provisions without reading it gets that.
The claim is *visible and inert-by-default*, not *safe to run unread* — which is
equally true of the graphs in the same project, and those already execute.

### 6.4 §3's ⚠️ — the local case

§3 flagged that applying a policy does not by itself decide what `devOpen` should
be on the machine the site is built on. **The answer is: whatever the file says,
verbatim**, and the reason is that any other answer re-opens the gap it closes. A
policy applied everywhere except the one field that decides whether it is
*enforced* would leave the author testing a site with the boundary off and
shipping one with it on — which is arm A and arm D in the same session, and the
whole of §2.

So Site Builder ships `devOpen: false` and is enforced from its first local run.

🔴 **That has a cost, and it is stated here rather than discovered later.** With
the boundary on locally, an author is an anonymous visitor to their own machine
until they hold the `admin` role — and on this template the only thing that grants
it is `claimSite`, which needs a `SITE_SETUP_TOKEN` secret in the backend's
`secrets.json` that **provisioning does not write** (the MCP provision module's
header says so in as many words: *a provision creates no credential material of
its own*).

✅ **DRIVEN s13, and the prediction was wrong in the direction that matters.**
`tests/sb015-first-local-run.test.ts` — **14 specs / 3 mutants**, two arms whose
only difference is whether `secrets.json` carries `SITE_SETUP_TOKEN`. The policy
arrives the way a person's does: `nodegx.security.json` at the project root,
installed by `applyProjectPolicy` from the `--project-dir` the spawner now
passes. Both arms are `enforced: true` and ran byte-identical policies.

| | as provisioned (`no-token`) | one secret later (`with-token`) |
|---|---|---|
| `claimSite` | **400** | 200, `claimed: true` |
| roles held, read off `/admin/roles` | **`[]`** | `['admin']` |
| create Page / Section | **403 / 403** | 201 / 201 |
| `publishPage` | **403** | 200 |
| `SiteSettings` row to configure | **never minted** | updated, 200 |
| the author's own home page | **"That page could not be found."** | `Welcome` / `Kestrel Joinery` / nav `['Welcome']` |

🔴 **F27 — §6.4 predicted "a site that renders, a nav, and an admin panel whose
every write is refused". What a person actually gets is the NOT-FOUND PANEL on
their own home page**, title `Site`, no nav, nothing to configure. The refusal is
not at the edge of the experience, it is at the start: `claimSite` is what mints
`SiteSettings` (SB-013) and `Theme` (SB-014), so with it refused there is no row
for the admin panel to point at and no page for the site to draw.

🔴 **And that screen now has THREE pixel-identical causes** — a genuine draft
(SB-008), a policy-refused read (s11's F24), and this, an empty site nobody could
claim. They want three different fixes, and **the one a person reaches for first
is turning the boundary off**, which is arm A. §2's sentence about each failure
looking like the other's fix has a third member now.

⚠️ **The prediction being wrong is itself the fifth instance** of this phase's
recurring shape — a statement in a task file carrying a confident description of
a result nobody had measured. The two-arm design is what made it safe to be
wrong: the `with-token` control renders a real page through the same instrument,
so "the author saw nothing" could not be read as a broken harness.

⬜ **Still not fixed.** Two candidate answers, neither built: the template's setup
page mints and stores the token itself, or provisioning seeds `SITE_SETUP_TOKEN`
when it applies a policy that references one. 🆕 The measurement adds a
consideration neither candidate had: whatever is chosen must also account for the
*screen*, because even a correct fix leaves the not-found panel as the thing an
author sees the moment anything else goes wrong.

### 6.4a F28 — both candidates in §6.4 are refuted, and the option set was the wrong shape

**s14 read the source before building either candidate. Neither survives, and the
reason is the same in both cases: there is no product surface that stores a
function secret.** This is recorded as its own subsection because §6.4's ⬜ is not
"pick one and build it" any more.

**Candidate A — "the template's setup page mints and stores the token itself" — cannot
be built.** The only door that writes the `functions` namespace is
`PUT /admin/secrets/:name` (`src/server/admin-secrets.ts`). It is admin-gated, and its
own header records that admin-gating is relaxed *only* under dev-open on a loopback
bind — the posture SB-015 deliberately does not ship. So under `devOpen: false` a
browser graph reaches that door only by carrying an admin credential, which is the one
thing a template must never contain. A setup page could instead keep the token in a
*collection*, but that removes condition (1) of the gate, and §6's own note says (2)
alone is check-then-write and not atomic — i.e. it reopens SB-013's escalation.

**Candidate B — "provisioning seeds `SITE_SETUP_TOKEN`" — is viable only in a form
neither §6.4 nor the module headers describe, and its obvious form is self-defeating.**

- The MCP provision module's invariant (*"a provision creates no credential material
  of its own"*, `provision.ts` §Secrets) is a deliberate property of **both** spawners.
  A mint belongs where the backend already mints `adminToken` — `SecurityState` at
  first start — not in either spawner. That much is a re-siting, not an objection.
- 🔴 **But a minted token the author cannot read is not a fix**, and the obvious way to
  tell them is closed: `SecretValueScrubber` (`src/ops/log-scrub.ts`) reads *every*
  value in the `functions` namespace of length ≥ `MIN_SCRUBBABLE_LENGTH` (8) and
  replaces it in the log sink. A backend that mints `SITE_SETUP_TOKEN` and then prints
  it prints `REDACTED`.
- ⚠️ **And it would not fail cleanly.** The scrubber's table refreshes on a
  `REFRESH_INTERVAL_MS` (5s) interval, so a line printed inside the window between the
  mint and the next refresh emits the **real token**. That is a fix that works
  sometimes — green in a spec that prints immediately, redacted for the person who
  reads the log a minute later, and a credential in a logfile when it does work.

🔴 **The fact under both of them: there is no renderer surface that sets a function
secret** — so an author's only way to provision `SITE_SETUP_TOKEN` today is to hand-edit
a mode-0600 `secrets.json` inside a backend data directory the editor never shows them.

⚠️ **The first version of this paragraph said "`/admin/secrets` has no caller", and that
was wrong in two layers out of three.** Corrected by re-census, the chain is:

| layer | state |
|---|---|
| backend route `GET/PUT/DELETE /admin/secrets` | ✅ **mounted** — `AdminSecretsRoutes` imported, constructed (`HttpServer.ts:466`) and in the route table (`:926-937`), admin-gated |
| main-process IPC `backend:listSecrets` / `setSecret` / `deleteSecret` | ✅ **exist** (`BackendManager.js:340-348`), proxying exactly those three |
| a renderer panel that calls them | ❌ **none** — 0 callers in `editor/src`, re-counted with a reader that opens every file |

**So the ruled build is the last mile only**, not a route plus a bridge plus a panel.

🔴 **How the wrong version was produced, because it is the reusable part.** Two grep
lies, both already known here, stacked:

1. the census was run with `--include="*.ts" --include="*.tsx"`, and **`BackendManager.js`
   is a `.js` file** — the IPC bridge was excluded by the filter, not absent;
2. **`HttpServer.ts` contains one NUL byte**, so grep skips it as binary and says
   nothing — the route table is invisible without `-a`.

⚠️ The control that was supposed to catch this *did* fire (`admin/roles` → 5), which is
exactly why it did not help: **both control and subject were read through the same two
blind spots**, so a known-firing control proved the instrument ran, not that it could
see. A control only bounds the error when it sits on the *other* side of the suspected
blindness — here that would have meant a control in a `.js` file, or in a NUL-carrying
one. Re-counting with a Python reader that opens every file regardless of extension is
what actually settled it.

⚠️ **This is the sixth instance of the phase's recurring shape, and the first one this
task file produced itself** — the previous five were a wrong *number* inside a correct
recommendation (SB-013's row count, SB-016 §4/F25, s11's F24, s13's F26's call-site
count, s13's §6.4 prediction). The refutation of the two candidates stands; the
*measurement offered as its foundation* did not, and it was written in the same session
that catalogued the pattern. **A census is a measurement and inherits its instrument's
blind spots — state which files it opened.**

⬜ **What this leaves open is a ruling, not a build.** The three shapes now on the
table, with what each actually costs:

1. **Build the missing Secrets panel** (or an MCP tool) that calls the door CWF-009
   already shipped. It is a capability the product is missing anyway — every function
   secret has this problem, not just this template's. ✅ **Smaller than first stated**:
   the route and the IPC bridge both exist, so this is a renderer panel over three
   channels that are already there.
2. **Mint at first start and surface it once through a channel the scrubber does not
   sit on** — the editor's backend panel reading it over IPC, not the log. Narrower,
   but it adds a read-back path, and `admin-secrets.ts` §2 refuses one by construction
   for reasons that still hold.
3. **Drop the secret from the gate on a loopback bind only** — i.e. `claimSite`'s
   condition (1) is satisfied automatically when the request is local. Smallest, and it
   is the one that trades the boundary for convenience, which is arm A wearing a hat.

🧭 **Richard's call**, because (1) is a product surface, (2) reverses a documented
refusal, and (3) narrows a boundary he ruled on in §3.

✅ **RULED s14 (Richard): shape 1 — build the missing Secrets panel.** The largest of
the three and the only one that adds no new credential path: it calls the door CWF-009
already shipped, keeps `admin-secrets.ts`'s two rules intact (one namespace, no
read-back), and fixes the problem for *every* function secret rather than for this
template's one. (2) was rejected because a read-back is refused by construction and the
scrubber's refresh window makes the log channel leak-sometimes rather than fail-closed;
(3) because it trades the boundary §3 ruled on for convenience.

✅ **Also ruled s14: the screen is fixed in the same session**, not deferred behind the
panel — all three shapes leave the not-found panel ambiguous, so the work is independent
of which one won.

### 6.4b What s14 built, and the two orderings the drive had to teach it

✅ **The Secrets panel is built** (`views/panels/secrets/`), registered as the
**eighth** backend surface and reachable from the Backend Services card's overflow
menu. It lists what is provisioned by name, writes a value, removes one, offers a
generated 32-byte base64url value, and reports the environment's second door on
every row. **33 specs / 10 mutants, 10 killed**
(`tests-unit/sb-015/secrets-panel-model.test.ts`).

**Two things it deliberately does not do.** It never asks for a value back —
`admin-secrets.ts` §2 refuses that by construction and the panel does not work
around it, so a value is legible exactly once, in the field the author typed it
into. And it does not mint anything server-side: the *generate* button draws from
`window.crypto` in the renderer and sends the result through the ordinary `PUT`,
because a backend that mints a credential has to then say what it is, and its only
channel for that is the log — which `SecretValueScrubber` redacts on a 5-second
refresh, i.e. it would leak the real value *sometimes*.

🔴 **The panel's decisions live in `secretsPanelModel.ts`, not in the component.**
This repo's jest is `testEnvironment: 'node'` with no jsdom and no
`@testing-library/react`, and the panel calls `window.require('electron')` at module
scope — a spec that imported it would fail to *load*, which reads as a broken
harness rather than a broken decision. Extracted, the decisions are graded over real
inputs. Same move as SB-016's endpoint predicate and s13's `buildSpawnArgs`, for the
same reason. ⚠️ **The spec imports the backend's own `SecretsStore` constants and
pins both copies against one table**, because the renderer duplicates a name pattern
and an env-prefix transform that nothing previously failed on when they disagreed.

---

✅ **F27's screen is fixed.** `Pages/Site` gained `diagnoseNotFound`, which drives
both the panel's `text` and its `visible`. Three causes, three sentences:

| state | what it now says |
|---|---|
| a claimed site, a slug with no published page | *That page could not be found.* |
| nobody has completed setup | *This site has not been set up yet.* |
| the read was refused | *This site’s pages are not available right now.* |

⚠️ **None of the three names a credential, a collection, a policy or a recovery
step**, and a spec asserts that: all three are read by *visitors*, and a 404 that
explains how the site is administered is a different defect. The author-facing
instruction belongs in the editor — which is what the Secrets panel now is.

🔴 **Two orderings were wrong on the first pass, and the drive is what caught both.
Neither was visible from the graph.**

1. **An unclaimed site makes the Page query FAIL, not come back empty** — nothing
   has created the collection, because `claimSite` is what writes the first rows.
   So "refused" and "not set up" are true simultaneously, and reading the failure
   first reported F27's state as a refusal: true, and useless to the person who has
   to fix it. **The condition that EXPLAINS the other has to win.**
2. 🔴 **`claimed === false` is not evidence of an unclaimed site.** It is computed
   from the settings query's `items`, and a **refused** query publishes an empty
   `items` exactly like an **empty** one does — `Run` is additive, so the reader
   runs on `items` arriving whether or not `fetched` ever fired.
   `sb015-default-policy-drive`'s arm C is the refused case and was reporting
   itself as "this site has not been set up yet".

   ✅ Fixed by wiring the settings query's **`error`** in beside it: a refused
   settings read is answered first and never as "not set up". **This is the
   known-firing-signal rule in its exact form** — an absence (`items` is empty) only
   means what you think beside a signal that distinguishes *refused* from *absent*,
   and the two want opposite fixes.

⚠️ **Both orderings were found by running the drives, not by reading the graph**, and
both first versions passed every spec that existed before the drive was re-run.

---

### 6.4c Three specs that asserted the defect, and what happened to them

Fixing F27 turned three green specs red, and **all three were correct when written** —
they were measurements of the state SB-015 had documented. They are rewritten to assert
the *fix*, with what they used to say preserved in the comment:

- `sb015-first-local-run` *"F27 — the site draws THE NOT-FOUND PANEL"* → now asserts
  the state names itself and borrows neither of the other two sentences;
- `sb015-default-policy-drive` *"renders a REFUSAL as the not-found panel — the same
  screen a draft draws"* → now asserts the **difference**, plus the control that a
  genuine draft still reads as an ordinary not-found (a "fix" that made *everything*
  say "refused" would have destroyed the distinction just as thoroughly);
- `tests-unit/sb-007/site-template` node-id count 192 → 193.

🔴 **And one mutant stopped biting, which is the reusable part.**
`sb006PublicSite`'s *"a not-found reader that acts before rows arrive"* found its
target by `scriptOf(n).includes('Outputs.missing')` — the page reader. When
visibility moved onto `diagnoseNotFound` the mutant went on mutating a node the
assertion no longer read, and **survived**. It failed loudly, because a surviving
mutant is a red spec, and that is the only reason it did not quietly become
decoration. ✅ It now resolves its target **through the wire** it is asserting about,
so it follows the decision wherever the graph puts it.

⚠️ Its sibling assertion was `toContain('if (Inputs.rows === undefined) return;')` — a
**source-text** check that pins a spelling rather than a property, and passes on a
guard that has been commented out or made unreachable. It now **runs** the script with
no inputs and asserts nothing is published, which is the actual invariant.

### 6.5 The finding that came free

🔴 **`SITE_SECURITY` was a typed constant in a test helper, so SB-008 measured a
publication boundary produced by a file no project would ever receive.** The
suite was correct and the thing it validated was unshipped. `helpers/site-drive.ts`
now imports `site-builder.security.json`, so there is one copy and what SB-008
measures is what a person gets. **SB-008's own 20 specs pass unchanged**, which is
the check that the substitution changed nothing.

### 6.6 Where SB-015 and SB-016 meet

The shipped policy declares all four endpoints, which is exactly what satisfies
SB-016's deploy interlock. One spec pair asserts both directions over a real
non-loopback start of a real authored project:

| | `nodegx.security.json` present | absent |
|---|---|---|
| non-loopback start | **starts**, `enforced: true`, `publishPage: role:admin` | 🔴 `UNDECLARED_FUNCTION_ON_PUBLIC_BIND` |

⚠️ With a third arm beside them, because a difference asserted between two specs
is consistent with the interlock having been switched off between them: the
defaults still refuse in the same run.

### 6.7 The second spawner, wired (s13)

✅ **The editor's spawner passes `--project-dir`, and §1's claim now holds for
both spawners.** The chain §7 named is closed end to end: renderer call site →
`backend:start` IPC → `BackendManager.startBackend` → `ServiceSupervisor` config
→ the `args` array. **20 specs / 7 mutants**, split across the two runners that
can each see one half — `tests-unit/sb-015/editor-spawner-passes-project-dir.test.ts`
(12) and `tests-main/local-backend/service-supervisor-project-dir.test.js` (8).

🔴 **F26 — §7 said "more than one call site (auto-start on project open, the
panel)". There are FOUR.** The two it names, plus `provisionBackend` (the AI
plan's spawner, which §7 names as the *start* of the threading rather than as a
call site) and `models/lessonbackend`, which nothing had named at all. So the
census §7 asked for was not a formality: threading a field through the three
sites a reader can list leaves the fourth silently on the old path, and a
behavioural spec over the reachable ones would have been green with it broken.

⚠️ **That is the fourth time this phase a recommendation's own numbers were
low or wrong** — SB-013's row count, SB-016 §4's "exactly the two that are
wrong" (F25), s11's F24 spec, and now this. The pattern is specific enough to
state as a rule: *a count stated in a task file is a hypothesis, and deriving it
again costs minutes.*

**Two things close the hole rather than one**, because they close different
halves and neither covers the other:

1. **`projectDir` is a required positional parameter** of the shared helper
   (`models/BackendServices/startLocalBackend.ts`), not a field on the options
   bag. It may be `undefined` — a lesson has no policy and a spec has no project
   — but it cannot be *omitted*, so a fifth call site fails to compile until its
   author has decided. An options field would have defaulted to silence, which
   is the failure this task exists to end.
2. **A census asserts no renderer module invokes `backend:start` except the
   helper.** The compiler cannot see a call that bypasses the helper; the census
   can. Its own known-firing arm is the helper itself, so a scan that matched
   nothing cannot read as a pass.

🆕 **The census reddened when it was written, on prose.** Matching a *quoted*
`backend:start` reads as the tighter instrument and is the looser one: it counts
`ProjectBackendLifecycle`'s module note, which names the channel in backticks,
and it lets a template literal through. Stripping block comments and matching the
bare string is both tighter and simpler — and line comments are deliberately left
in, because a census that cries wolf is fixed by rewording a comment while a
census that misses a call is the defect.

🆕 **`buildSpawnArgs` was extracted from `ServiceSupervisor.start()`**, the same
move SB-016 made for its endpoint predicate and for the same reason: `start()`
spawns a real service bundle that need not be built, so the only assertion
available over the argv would have been a source-text one — which passes just as
happily on unreachable code. Extracted, the argv is graded as behaviour, over the
real module.

⚠️ Recorded because it is the near-miss: **`--data-dir` and `--project-dir` are
two different paths and `BackendManager` had the data directory to hand** (it
already records it as `projectDir` in the orphan registry, where the name means
something else). A mutant that hands the supervisor `backendPath` reddens four
specs.

## 7. What is still not done

⬜ **Nothing has opened a project made from this template in the editor.** SB-007
recorded that and it is still true; the local-case measurement in §6.4 is the same
drive.

⬜ **The `secrets.json` half.** A policy travels; the secret a policy's graphs need
does not. See §6.4.

⬜ **Only embedded templates can carry a policy.** `securityPolicy` is on
`ProjectTemplate`, so `PlatformTemplateProvider`'s `community://` shelf has no
channel for one. Not needed today (Site Builder ships embedded) and named so it is
not assumed.
