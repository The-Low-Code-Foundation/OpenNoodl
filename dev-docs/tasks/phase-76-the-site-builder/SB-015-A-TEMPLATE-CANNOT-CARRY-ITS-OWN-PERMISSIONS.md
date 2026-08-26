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
