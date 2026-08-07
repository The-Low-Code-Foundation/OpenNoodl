# BCN-006 — Notes, steps 5 and 6

**Written 2026-08-01.** [BCN-006-NOTES.md](./BCN-006-NOTES.md) covers steps 1–4, 7 and 8 and
records steps 5 and most of 6 as **not done**. This is those, plus the auth half of
BCN-009 step 4 and the one-line close of the `emailVerified` defect BCN-006 could only
half-fix from the client.

> ✅ **The headline: OAuth is measured, not documented.** The rig had no OAuth provider on
> any backend, so step 5 could not be observed at all — which is exactly the condition
> under which this phase has shipped a wrong wire fact four times. A stub OIDC provider
> was stood up and PocketBase pointed at it, so discovery, PKCE, exchange and the session
> are all observed against a real server. **39 live checks, 0 failures.**
>
> ⚠️ **Directus SSO is refused and its `auth.oauth` cell moved `conditional` →
> `unsupported`**, for a reason that is not "not done yet". **Supabase auth stays gated**,
> and the last descriptor cell still claiming otherwise was corrected.

---

## 1. What was measured before anything was written

The rule this phase runs on, and it paid three times in one afternoon. Full output:
[`BCN-006-OAUTH-PROBE-OUTPUT.txt`](../phase-16-runtime-deploy-health/uba-e2e/BCN-006-OAUTH-PROBE-OUTPUT.txt).

### 1.1 The rig, as found

| | Measured 2026-08-01 |
|---|---|
| Directus `GET /auth` | `{"data":[],"disableDefault":false}` — **no SSO provider configured** |
| Directus `GET /auth/login/google` | ⚠️ **`404 ROUTE_NOT_FOUND`.** The route does not exist unless the provider does |
| Directus `GET /server/info` | `public_registration: false` (unchanged since step 4) |
| PocketBase `GET …/auth-methods` | `{password:{…}, oauth2:{providers:[],enabled:false}, otp:{enabled:false}, authProviders:null}` |
| PocketBase `POST …/auth-with-oauth2` | ⚠️ **`403 "The collection is not configured to allow OAuth2 authentication."`** — and identically for a bogus code and for an empty body |
| Parse `GET /auth/providers` | 404 (that route is `nodegx-backend`'s, not upstream Parse's) |

### 1.2 ⚠️ `authProviders` is `null`, not `[]` — and the descriptor's probe read it

PocketBase's `auth-methods` carries **two** spellings of the provider list: `oauth2.providers`
(0.23+) and `authProviders` (≤0.22, kept as a deprecated alias). The pocketbase descriptor's
`auth.oauth` probe said:

```
expect: 'an authProviders array with at least one entry'
```

On an instance with OAuth **switched off** that field is `null`. A probe reading it would have
**thrown** rather than reporting "no providers" — the exact failure mode a probe exists to avoid.
Corrected to `oauth2.enabled` / `oauth2.providers`, which are the live fields.

### 1.3 ⚠️ PocketBase's `authURL` arrives **incomplete**, ending in a bare `redirect_uri=`

With a provider configured, `auth-methods` answers:

```
authURL: "http://localhost:8113/authorize?client_id=…&code_challenge=…&code_challenge_method=S256
          &response_type=code&scope=openid+email+profile&state=…&redirect_uri="
```

The client appends its own redirect, **encoded**. Appending it raw, or assuming the parameter was
already complete, produces a provider error page rather than anything our code could report.
Mutation-tested: dropping the `encodeURIComponent` turns that live check red.

### 1.4 `state`, `codeVerifier` and `authURL` are minted **per attempt**

Every call to `auth-methods` returns a fresh triple. Caching the provider object and reusing it for
a second sign-in produces a code the exchange rejects. This is why {@link listAuthProviders}'
result carries the raw entry rather than a tidied one, and why `signInWithProvider` calls discovery
every time rather than once.

### 1.5 A refusal that is worth quoting

Replaying a spent code: `400 "Failed to fetch OAuth2 token."` A wrong `code_verifier`, once the
stub actually enforced PKCE: the same `400` — which proves PocketBase really forwards the verifier
to the provider rather than checking it itself.

---

## 2. The stub OIDC provider, and why a fixture was the honest answer

`bcn-006-stub-oauth-provider.mjs` — 130 lines, three endpoints, no signing:

```
GET  /authorize  -> 302 {redirect_uri}?code=…&state=…
POST /token      -> {access_token, token_type, expires_in}   (PKCE S256 verified)
GET  /userinfo   -> {sub, email, email_verified, name}
```

`bcn-006-oauth-rig.mjs on|off|status|clean` points the rig's PocketBase `users` collection at it
and puts it back.

**Why this and not "implement from the docs".** The alternative was writing PocketBase's and
Directus's redirect shapes out of documentation and shipping them untested. BCN-002 did that for
three Parse file cells and all three were wrong; BCN-003 for four descriptor cells; BCN-004 for
the presets' total; BCN-006 itself flagged Supabase rather than repeat it. Auth is the subsystem
where being wrong locks a user out of their own app.

**What is real and what is a fixture, stated plainly.** Real: PocketBase 0.30.0, its discovery
endpoint, its PKCE handling, its exchange, the JWT it issues, the user record it creates, and the
adapter's own code. Fixture: the identity provider, which authenticates nobody. Simulated: the
browser — `signInWithProvider` ends in `window.location.href = …` and `consumeAuthReturn` reads
`window.location.search`, so a minimal `window` is injected and the navigation it records is
followed by hand, which is precisely what a browser does with it.

⚠️ **PKCE had to be enforced in the stub before the "a wrong verifier is rejected" check meant
anything.** The first version did not check the challenge, and the check passed while asserting
only that the fixture was lenient. Recorded because it is the same class of mistake as the two
checks §7 caught.

⚠️ **The shared rig was changed.** `oauth2` was enabled on PocketBase's `users` collection with one
provider named `oidc`. Password sign-in on the same collection is untouched, so this cannot disturb
another worker's run; it is switched back off and the `bcn006b-subject-*` users deleted at the end
(§9). No container was restarted.

---

## 3. Stale premises

### 3.1 ⚠️ "Four redirect shapes" — there are two, and one of them is not a redirect shape

The task spec's step 5 says *"OAuth redirect handling per backend. Four shapes."* Two of the four
are not shapes we can implement at all, and the reasons are different in kind:

| Backend | Reality |
|---|---|
| Parse / NodeGX | BAK-004's `?nodegx_auth=<code>` + `/oauth/exchange`. Shipped |
| PocketBase | discovery → provider → `?code=&state=` → `auth-with-oauth2`. **Shipped, measured** |
| Directus | ⚠️ **not a redirect shape — a different session model.** See §3.2 |
| Supabase | there is no GoTrue to have a shape (BCN-006 §8.3, unchanged) |

### 3.2 ⚠️ Directus SSO: `conditional` was the wrong *question*, not the wrong answer

`auth.oauth` said "signing in with Google depends on which providers your Directus instance was set
up with". That reads as *your instance decides*. It does not: **even on an instance with three
providers configured, NodeGX cannot complete a Directus single sign-on.**

`/auth/login/{provider}` sends the browser to the provider and Directus hands the session back as
an **httpOnly cookie** — nothing in the URL, nothing in a response body. There is no mode that
answers with tokens the way `POST /auth/login` does. Consuming it needs `credentials: 'include'` on
every request and a `mode: 'cookie'` refresh, which is a **second session model beside
`SessionStore`**, not a fifth redirect shape. That is a decision with a blast radius past this
task.

So the cell is now `unsupported` with the sentence a builder reads:

> NodeGX cannot complete a Directus single sign-on yet. Directus returns the session as a browser
> cookie rather than in the response, which needs a different kind of session than NodeGX stores.
> Use email and password on this backend.

Password sign-in on the same instance is unaffected and stays `supported`. `listAuthProviders`
still reads `GET /auth`, so a builder can see what the instance offers even though we cannot drive
it.

### 3.3 ⚠️ "`Noodl.Users` is promise-based" — confirmed, and it bites in a second place

The handover's warning held. It also applies to `Noodl.Users.Current.logOut()` and `.fetch()`,
which are promises on the shared `_currentUser` object rather than on `Noodl.Users`. A driver that
passes callbacks sees every call time out while actually succeeding.

### 3.4 The `conditional`-means-unsupported rule has no probe behind it, for anything

Not a premise anyone stated, but worth writing down because it changes how `auth.oauth` had to be
built. `RestAuthAdapter.begin()` refuses a `conditional` capability unless the key is in
`probedCapabilities` — and **`UserService` constructs `new RestAuthAdapter()` with no options**, so
nothing is ever probed. Every `conditional` auth cell is therefore refused in the product today:
Directus sign-up, Directus and PocketBase email verification, and both password resets.

That is defensible as a floor (Directus registration really is 403 by default; PocketBase really
does log mail instead of sending it), and it is **not** what OAuth wanted. So
`signInWithProvider` does not route through `begin`: the discovery call it makes **is** the probe,
asked of the instance rather than of a table. Gating on the descriptor first would refuse before
asking, using a weaker source of truth than the one a request away.

⚠️ **The other four conditional cells remain refused with no way to settle them.** That is a real
product gap, it is not this task's, and it is recorded in §10.

### 3.5 `Set User Properties` on a REST backend offered ports that wrote nothing

Found while building step 6, and it is BCN-006's own "nothing is silently missing" promise failing
inside the family the spec names. `RestAuthAdapter.setUserProperties` strips a list of server-owned
fields from the body it sends. Nothing stopped the *port generator* offering them — so on
PocketBase, `verified` looked like every other input, accepted a value, and was discarded before
the request went out.

Closed by making both halves read one exported list, `REST_USER_READONLY_FIELDS`, with a test that
fails if they drift.

---

## 4. What shipped

### 4.1 Step 5 — OAuth

`RestAuthAdapter` gains `listAuthProviders`, `signInWithProvider`, `consumeAuthReturn` and an
`oauthReturn` state, matching `ParseAuthAdapter`'s surface so the `Sign In With` node needs no
change at all.

**Discovery before navigation** is the one design decision, and it came from §1.1 rather than from
taste. A provider that is not configured fails late and badly on both backends — Directus lands the
user on its own 404 JSON, off your app; PocketBase answers 403 only after a round trip through a
provider. Asking first costs one request and turns both into a sentence on the node's own `error`
port.

**The flow is parked in storage before the navigation**, under `<session key>.oauth-pending`,
because the code comes back on a **fresh page load** and PocketBase's exchange needs the
`codeVerifier` minted before the redirect. Nothing in memory survives that.

**The trigger is the parked flow, not `?code=`.** `code` and `state` are the most generic query
parameters in existence; triggering on them alone would consume somebody else's callback. Once a
flow exists, `state` is compared — a mismatch is refused **without issuing a request**.

`UserService` bridges `oauthReturn` for *both* adapters (it used to be a one-off subscription
beside the Parse adapter's construction) and asks both for a return leg. The two cannot be confused
— `?nodegx_auth=` versus `?code=` plus a parked flow — so asking both costs nothing and stops a
return being dropped because the picker happened to resolve elsewhere.

### 4.2 Step 6 — the user record's ports

`user-ports.ts`, consumed by `user.ts` and `setuserproperties.ts`. Three rules, and only the first
is obvious:

1. **The accounts table is not a parameter.** There is one per backend and its name is decided by
   the backend's *type* — `_User`, `directus_users`, `users`, and **nothing for Supabase**, whose
   `auth.users` is not reachable through PostgREST. A Class dropdown here would offer a wrong
   answer.
2. **A Parse-wire backend's ports do not change, including the one a tidier rule would drop.**
   `shouldShowField` hides fields marked `hidden`, and `parseFieldToSchemaField` marks `ACL`
   hidden — so applying it uniformly would silently remove the `prop-ACL` output the `User` node
   has always emitted, taking whatever was wired to it. The filter runs for REST backends, where
   `hidden` means a field a builder deliberately hid in the backend's own admin, and not for the
   Parse wire. Same asymmetry, same reasoning, as `record-ports.ts`' rule 1. The test asserts the
   **exact** Parse port list, not a subset.
3. **A port is never offered for a field the write path throws away.** §3.5.

⚠️ **A many-to-one relation *does* get a port and that is deliberate**: an FK's own value is a
scalar (the target's id), and a Parse `Pointer` on `_User` has always produced a `*` port here.
What is skipped is a `Relation` — a record *set*, which is not a value at all.

### 4.3 BCN-009 step 4's auth half — the `Backend` picker

`User` and `Set User Properties` gain a `backendId` input built by `backendPickerPorts`, hidden when
the project has one backend and counted over **both** metadata keys (the near-miss BCN-004 recorded:
a project with the built-in backend *and* one Directus lives in two keys and would otherwise count
one).

`UserService` grew handle-aware resolution behind it: `_handle(backendId?)`, `currentFor(backendId)`,
and an optional `backendId` on all eleven methods. **Absent and `_active_` mean exactly what they
meant before**, so no existing project moves — the same no-silent-migration rule
`resolveBackend`'s docblock settled for the Record family. An id the project no longer has resolves
to `undefined` and is reported with a sentence rather than falling back somewhere else.

### 4.4 `emailVerified`, closed at the end that could close it

BCN-006 §10.2 called this *"half fixed, and the other half is not mine"*, and named the fix: one
line in `nodegx-backend/src/server/users.ts::signup`. It is now written, and measured end to end:

```
signup 201 {"objectId":"…","createdAt":"…","sessionToken":"r:…"}
login  200 {…,"emailVerified":false,…}     typeof = boolean
me     200 {…,"emailVerified":false,…}     typeof = boolean
```

⚠️ **The type is asserted, not just the value.** SQLite has no boolean type and this codebase has
been bitten by it before — `isFlagSet` exists because `record.emailVerified === true` was false for
a verified user. The column is inferred as `Boolean` by `AdapterFacade` and comes back as a real
boolean; a regression to `0` would reach a graph as a truthy-looking number.

The client-side default BCN-006 added stays, and is now belt-and-braces rather than the whole
answer.

### 4.5 Descriptor `auth.*` rows

| Cell | Before | After |
|---|---|---|
| `pocketbase.auth.oauth` | `conditional`, probe read `authProviders` | `conditional`, probe reads `oauth2.enabled`/`oauth2.providers`; evidence is the measured round trip |
| `directus.auth.oauth` | `conditional` | **`unsupported`** — §3.2 |
| `supabase.auth.oauth` | `conditional`, reason implied only their dashboard mattered | `conditional`, reason names GoTrue like its five neighbours |
| `supabase.auth.magicLink` | ⚠️ **`supported`** | **`conditional`** — §4.6 |

### 4.6 ⚠️ `supabase.auth.magicLink` was the last cell claiming a capability the product lacks

BCN-006 corrected its five neighbours and flagged that it had not edited the descriptors. This one
survived that sweep because its evidence string reads like a fact about Supabase — *"magic links
are a first-class Supabase flow"* — and it **is** one. The cell is not about Supabase, though. It is
about whether NodeGX can drive it, and `RestAuthAdapter` refuses every Supabase auth call with
`SUPABASE_AUTH_UNSUPPORTED` before a request is issued.

So a builder on Supabase saw `Request Magic Link` offered as fully supported, wired it up, and got
a refusal at runtime — the precise failure the phase's central promise exists to prevent, in the one
family where the spec names it by example.

`conditional` rather than `unsupported`, like its neighbours: the editor treats it as unavailable
until a probe says otherwise, and the day a GoTrue is stood up this is a cell to promote rather
than rewrite.

---

## 5. The decision on Supabase auth

**Left `conditional`. No GoTrue was added, and no Supabase auth was implemented.** The four (now
six) cells keep their `DOCUMENTED, NOT PROBED` evidence and `RestAuthAdapter` keeps refusing with
one sentence naming what is missing.

The reasoning, since the handover offered both options:

1. **The rig's "Supabase" is one Postgres and one PostgREST.** GoTrue is a separate service and
   standing it up is not a compose line — it wants its own JWT secret shared with PostgREST, its own
   schema migrations into `auth.*`, an SMTP or an inbucket for the flows that email, and PostgREST
   restarted to trust the same secret. That is a rig change three other workers are running against.
2. **A GoTrue in the rig would not be the thing a user has.** Hosted Supabase differs in exactly the
   places auth is fragile — the anon key versus a user JWT (the spec's own trap list names this),
   provider configuration, email templates, and rate limits. A locally-measured GoTrue would license
   claims that a hosted project could still contradict, which is a *worse* outcome than a stated gap
   because it looks like evidence.
3. **BCN-006 already drew this line and it was right.** *"An unprobed GoTrue implementation would be
   the fourth time this phase shipped a documented cell a real server contradicted, and it would do
   it in the one subsystem where being wrong locks a user out of their own app."*

What did change is that the descriptor now says the same thing the code does, in all six auth cells
rather than five (§4.6). The gap is a stated gap rather than a promise.

**What it would take**, so the next person is not re-deciding from scratch: a `gotrue` service in
`uba-e2e/docker-compose.yml` sharing `PGRST_JWT_SECRET`, `GOTRUE_DB_DATABASE_URL` pointed at the
same Postgres, `GOTRUE_SITE_URL` and an SMTP sink; then the five endpoints in the task spec's table
probed the way §1 probed PocketBase's; then a `supabase` entry in `PROFILES`. The adapter is shaped
for it — `restAuthProfileFor` answering `undefined` is the only thing routing Supabase into
`refuse`.

---

## 6. The live pass

**68 checks, 0 failures**, across three instruments that cover different halves. The editor was run
**from this worktree** (`npm run dev:debug`), which compiles the worktree's own sources —
`BCN-009-NOTES` §6.1's claim to the contrary is stale and cost an earlier run its whole live pass.

⚠️ **The editor's ports were contended.** `8574` and `8080` were held by two other workers'
sessions for the first half of this task; the pass was taken when they freed rather than by killing
anything. `--target=viewer` for the preview webview, `--target=editor` for the editor window —
`--target=dashboard` really is stale advice.

### 6.1 The preview window — the XHR branch — **16/16**

Project: the committed QA fixture, copied to a scratch directory (a dev launch rewrites the project
it opens) with `cloudservices` pointed at a `nodegx-backend` on `:8112`. ⚠️ `Noodl.Users` is
promise-based; `Current.logOut()` and `Current.fetch()` are promises too.

| | Result |
|---|---|
| `signUp` | ✅ resolved, signed in, **`Current.email` populated** (BCN-006's fix, still fixed) |
| …`emailVerified` | ✅ **`false`, not `undefined`** |
| `logOut` → `logIn` | ✅ same id, email and `emailVerified: false` both survive |
| ⚠️ **a user created over raw HTTP, outside the client** | ✅ **`emailVerified: false`** |
| …after an explicit `Current.fetch()` | ✅ still `false` |
| a wrong password | ✅ rejects with the **string** `"Invalid username/password."`, session survives |

**Row four is the headline.** BCN-006 §10.2 measured exactly this case and recorded
`emailVerified=undefined`, calling it *"the honest close of this defect"* and *"owed, unowned"*. It
is closed.

### 6.2 The editor canvas — the ports — **13/13**

Two nodes placed in the fixture's `/Logic/Session Controller`, read back off the project model.

**With one backend (the Parse wire), the port set is byte-identical to the old generator's:**

```
User:  prop-objectId(string) prop-createdAt(date) prop-updatedAt(date) prop-ACL(*)
       prop-emailVerified(boolean) prop-nickname(string) prop-loyaltyPoints(number)
       prop-joinedAt(date)  + one changed-<field> each  + loggedIn/loggedOut/sessionLost
Set:   prop-objectId prop-ACL prop-nickname prop-loyaltyPoints prop-joinedAt
```

`authData`/`password`/`username`/`email` excluded on the reader, and `emailVerified`/`password`
additionally on the writer — the historic lists, and **`prop-ACL` is present**, which is rule 2 in
§4.2 holding in the real editor rather than only in a unit test. **No `backendId`**: one backend,
picker hidden.

| Then | Result |
|---|---|
| a Directus backend added to `backendServices` | ✅ **the picker appears with no other trigger** — the new subscription |
| the dropdown's entries | ✅ `["_active_", "_endpoint_", "bcn006b-directus"]` — **both metadata keys** |
| ports with the picker unset | ✅ still `_User`'s — no existing project moves |
| picker set to Directus | ✅ `prop-first_name`, `prop-last_name`, `prop-title`, `prop-status` |
| …and the `_User` ones | ✅ gone |
| `password` / `tfa_secret` / `id` / `auth_data` | ✅ none offered |
| `status` | ✅ an **enum dropdown**, not a text field |

### 6.3 The OAuth driver — **39/39**

[`bcn-006-oauth-driver.ts`](../phase-16-runtime-deploy-health/uba-e2e/bcn-006-oauth-driver.ts) /
[output](../phase-16-runtime-deploy-health/uba-e2e/bcn-006-oauth-driver.output.txt). See §8.2.

---

## 7. Mutation testing

**The instruction that earned its place twice.** Every check below was made to fail on purpose, and
**two of them turned out not to be checking anything.**

### 7.1 The live OAuth driver

| Mutation | Result |
|---|---|
| Delete the `state` comparison in `consumeAuthReturn` | ✅ 2 failures |
| Append the redirect **un-encoded** to `authURL` | ✅ 1 failure |
| Never clear the parked flow after a return | ⚠️ **0 failures — see §7.3** → after the fix, ✅ 1 failure |
| Skip discovery and navigate on a guess (`|| providers[0]`) | ✅ 2 failures |
| Never park the flow before navigating | ✅ 4 failures |

### 7.2 The unit suites

| Mutation | Result |
|---|---|
| Apply `shouldShowField` to the Parse wire too (drops `prop-ACL`) | ✅ 3 failures |
| Guess PocketBase's accounts table as `_User` | ✅ 3 failures |
| Stop deriving the REST ignore list from the adapter's | ✅ 2 failures |
| Show the `Backend` picker on a single-backend project | ✅ 1 failure |
| Let a provider error fall through to an exchange | ✅ 1 failure |
| Let Directus fall through to a start leg instead of refusing | ✅ 1 failure |
| Read the deprecated `authProviders` alias | ✅ 3 failures |
| Report PocketBase's OTP as a magic link | ⚠️ **0 failures — see §7.4** → after the fix, ✅ 1 failure |
| Remove `emailVerified: false` from `nodegx-backend`'s signup | ✅ 1 failure |

### 7.3 ⚠️ "A refresh cannot replay the code" was not testing that

The check ran `consumeAuthReturn` a second time and asserted `false`. It passed with the
flow-clearing line deleted — because by then `stripQueryParams` had already removed `?code=` from
the simulated address bar, so the second call was returning `false` for want of a code rather than
for want of a flow.

Rewritten to **re-install the window with the code still present**, which is what a user who
presses Back or reloads from history actually gets. That is the case that must not re-exchange, and
it is now the case being tested.

### 7.4 ⚠️ "OTP is not a magic link" was not testing that either

`magicLink: {enabled: false}` was mutated to `{enabled: otp.enabled === true}` and the suite stayed
green — the rig's OTP is off, so both spellings answer `false`. The claim is only testable on a
fixture where they differ, and a case with `otp.enabled: true` was added. The live driver's
equivalent check has the same weakness and is **not** claimed as evidence for this property.

### 7.5 The live pass

| Mutation | Result |
|---|---|
| Remove `emailVerified: false` from the backend, rebuild, restart, **re-run in the preview window** | ✅ **3 failures, and they reproduce the recorded defect** |
| Remove `metadataChanged.backendServices`, rebuild the viewer, reload the preview | ⚠️ **inconclusive first time — see §7.6** → after the fix, ✅ 1 failure |

The `emailVerified` mutation is worth quoting because of what **still passed**:

```
✅ Current.emailVerified is FALSE, not undefined   — emailVerified=false      ← the CLIENT default
❌ …emailVerified still FALSE after logIn          — emailVerified=null
❌ ⚠ …for a user created outside the client        — emailVerified=null
❌ …and still FALSE after an explicit fetch()      — emailVerified=null
```

The first line is BCN-006's client-side default, doing exactly what it did before: masking the gap
for the one account the page just created, and for no other. That is the whole argument for the
backend line in one screen.

⚠️ It reports **`null`, not `undefined`**, because the column now exists in the SQLite file from
earlier runs and the row simply has no value. On a genuinely fresh backend it is `undefined`. Both
are equally unusable to a graph, and a reader chasing this should not be thrown by the difference.

### 7.6 ⚠️ The third check that was not checking anything — and this one hid inside a mutation

The first attempt at mutating the port subscription came back **`❌ ✅`**: the precondition failed
and "the check" passed. Neither result meant what it looked like.

The sequence was *clear the metadata → assert the picker is gone → set it → assert the picker is
back*, and it ran against a page whose nodes had registered **while a backend was configured**. So
the picker was already there from the initial build; clearing did nothing (correct, with the
subscription removed) and setting it did nothing either — but the assertion could not tell "it
reappeared" from "it never left".

Rebuilt to start from the **absent** state: clear the metadata, reload the preview so the nodes
register with no picker, *then* add a backend. The mutated build now fails the check and the
restored build passes it. Recorded because the failing half was the *precondition* and the passing
half was the *claim* — the exact shape that reads as "mostly working".

### 7.7 A fourth, found by the check failing for the right reason

The final port pass failed *"unset still means the endpoint"* on a run where nothing was wrong: the
`Backend` picker is a **saved parameter**, and it had persisted from the previous run's
`setParameter`. A reset was added. The failure was the check doing its job — the parameter is
honoured and it persists, which is what it is for.

### 7.8 One mutation that revealed a driver defect rather than a code defect

Removing the parking line made the driver **crash** (`JSON.parse` of `undefined`) rather than report
a red check. A crashed driver and a broken driver look identical from the outside, so the parse was
made tolerant; the mutation now names what broke.

---

## 8. Evidence

### 8.1 Gates, each run in this worktree

| Gate | Result | Baseline |
|---|---|---|
| `noodl-runtime` | **89/90 suites, 1712 passed, 13 skipped, 0 failed** | 1682/1695, 0 failed — **+30** (16 `user-ports`, 14 `rest-auth-adapter`) |
| `noodl-viewer-react` | **35/35 suites, 373 passed, 0 failed** | 373 — unchanged |
| `nodegx-backend` | **67/67 suites, 730 passed, 10 skipped, 0 failed** | +1 (`emailVerified`) |
| `nodegx-backend-contract` | **169 passed, 0 failed** | 169 — unchanged |
| `tsc` | clean — runtime, contract, viewer (`--skipLibCheck`) | |
| `catalog:check` | clean before the merge; ⚠️ **stale after it, and not from this diff** — see below | |
| `tsfixme` ratchet | still red at the **inherited** `any +33`; **no entry from this diff** | it was `+26`; the rise is other work in this batch |
| Live OAuth driver | **39 passed, 0 failed** | new |
| Live pass, preview window | **16 passed, 0 failed** | new |
| Live pass, editor canvas | **13 passed, 0 failed** | new |

⚠️ `npm --prefix packages/noodl-runtime run build:types` first, or four corpus suites do not start
and the run reads `79/84`. ⚠️ `noodl-runtime`'s bare `npx jest` crashes in
`@jest/reporters/getResultHeader` and reports a meaningless "1 of 23"; that is the reporter, not the
suite.

⚠️ **`catalog:check` is stale on the merged tree and it is not this task's.** Regenerating produces
a diff containing only `signfileurl`'s new `urlKind` / `isShareable` / `bucket` / `path` /
`recordId` ports — BCN-007's work, merged from `cline-dev` without a regeneration. Checked rather
than assumed: the regenerated file contains **no** change to `net.noodl.user.User` or
`net.noodl.user.SetUserProperties`, which is what one would expect, because the `Backend` picker and
the property ports are *dynamic* and the catalog records static ports. The regeneration was
**reverted** rather than committed — it is another worker's artefact and committing it here would
collide with their own. `catalog:check` was clean on this task's own commit.

⚠️ **The `tsfixme` ratchet was already red** at an inherited `+26` and is now `+33` on the merged tree. Every file in
the "grew since baseline" list belongs to other work; the one entry this task would have added
(`type Any = any` in the new test, copied from its neighbour) was removed rather than accepted. **It
was not re-baselined.**

### 8.2 What the OAuth driver proves, section by section

| § | Proves |
|---|---|
| 1 | Discovery on three backends: PocketBase's configured provider with its display name, Directus's empty list read without erroring, Supabase refused **with no request issued** |
| 2 | The whole round trip — parked flow, PKCE challenge carried, provider 302, state echoed, exchange, `id`→`objectId`, `verified`→`emailVerified`, the code stripped from the address bar, and **the resulting token accepted by PocketBase (HTTP 200)** |
| 3 | Four refusals, each naming its own reason: an unconfigured provider (listing the ones that exist), Directus's cookie session, Supabase's GoTrue, and an empty provider input |
| 4 | A foreign `state` is refused **and no request is issued** |
| 5 | A `?code=` with no parked flow is ignored entirely |
| 6 | `readAuthMethods` against the live payloads of both backends |

### 8.3 The editor gate

Not run. Nothing in this diff reaches `packages/noodl-editor`, and BCN-006's own notes established
that its single failure (`Git local tests can handle merge with conflicts in project.json`) is
REV-010's documented merge-driver-needs-a-built-app problem rather than any task's.

---

## 9. Rig hygiene

- **PocketBase's `users` collection had `oauth2` enabled** with one provider (`oidc`) pointing at
  the stub. Switched back off with `node bcn-006-oauth-rig.mjs off`; `auth-methods` reports
  `{providers:[], enabled:false}` again, as found. Password auth was never touched.
- **`bcn006b-subject-*` users** created by the round trips were deleted with
  `bcn-006-oauth-rig.mjs clean`.
- **No container was restarted.** `articles` and `authors` were not touched at all.
- A `nodegx-backend` ran on **8112** with its own scratch data dir, and the stub provider on
  **8113**. Both are gone.

---

## 10. Could not verify

Stated plainly, because a verification claim that overreaches is worse than none.

1. **Supabase auth remains entirely unverified**, by construction and by decision (§5).
2. ⚠️ **Directus's populated `GET /auth` shape is not measured.** The rig's is empty and configuring
   a provider needs environment variables and a restart of a shared container. `readAuthMethods`
   accepts **both** spellings Directus has shipped (a bare string, and `{name, driver, label}`) and
   **neither has been seen populated**. If a Directus user reports an empty provider list with SSO
   configured, this is the first place to look.
3. **Directus SSO end to end** is refused rather than implemented (§3.2), so nothing is claimed for
   it.
4. **No OAuth flow has been driven through a real browser's `window.location`.** The driver injects
   a `window`; the preview pass covers the real one for the *Parse* wire, which is the branch a
   deployed app on our own backend takes. A PocketBase provider round trip in a real browser needs a
   project configured against PocketBase and a provider a browser can reach — recorded rather than
   claimed.

4b. **No `Set User Properties` write was driven against Directus or PocketBase.** The live editor
   pass proves the *ports* are right; `RestAuthAdapter.setUserProperties` is covered by unit tests
   only, and the field-stripping is asserted against a fake `fetch` rather than a real 200.
5. **The `Sign In With` node itself was not driven**, on either backend. Its `applyReturn` reads
   `oauthReturn` and the events, both of which are covered; nothing here says the node fires its
   signals correctly. Same gap BCN-006 recorded, same instrument would close it.
6. **PocketBase's accounts collection is a default, not a discovery.** Any collection of
   `type: "auth"` can hold accounts, and the editor's `parsePocketbaseSchema` does not record a
   collection's type — so the cache cannot say which ones they are. `users` is the same default the
   adapter uses, so ports and wire agree; a project that renamed it gets **no property ports**,
   which is visible rather than wrong.
7. **The four remaining `conditional` auth cells still cannot be settled** (§3.4). Directus sign-up,
   both email verifications and both password resets are refused in the product because nothing
   populates `probedCapabilities`. Real, not this task's, and it wants a probe runner the Backend
   Services panel triggers.
8. **`Noodl.Users` still has no backend picker**, and deliberately. The public API's `Current` reads
   the default backend; the picker lives on the `User` and `Set User Properties` nodes. A project
   with two backends and a script reading `Noodl.Users.Current` gets the default one.
8b. **Two `User` nodes on two backends were never run side by side.** `currentFor` is exercised in
   the ordinary single-backend shape by every check in §6.1, and the picker's *resolution* by every
   check in §6.2 — but no page has had one node signed into the endpoint and another into Directus
   at the same time. That needs a Directus project with a user, which is item 7's probe problem
   wearing a different hat.

9. ⚠️ **`Logged Out` and `Session Lost` still fire on every `User` node whichever backend signed
   out.** The *model* is now re-read per backend (a `User` node on Directus keeps reporting its own
   account when the Parse user signs out), but the **signals are global**. Narrowing them would
   change when an existing project's graph runs, which is not a change to make quietly. Recorded as
   a residual.
10. **Cross-tab and SSR** are unchanged from BCN-006 — still not exercised in two real tabs or
    against a real server render.

---

## 11. Criterion 4

> *"A logged-in user stays logged in across an access-token expiry, on every backend that has one."*

**It did not move, and it did not need to.** BCN-006 step 4 met it for **Directus and PocketBase**
on a genuine 25-second expiry, and this work touches neither the lifecycle controller nor
`performRefresh`.

What this work adds is that a session **obtained through a provider** enters the same machinery: the
OAuth exchange resolves through `setSession`, which calls `lifecycleController(handle).sessionChanged()`
exactly as a password login does. So a PocketBase OAuth session is scheduled for refresh on the same
path — asserted structurally by the driver (the session is stored and its token accepted), **not**
observed across an expiry, because that would mean reconfiguring the rig's token TTL a second time
while other workers were running against it.

Supabase remains outside the criterion for the reason in §5.

---

## 12. What the next person inherits

**Ready:**
- `signInWithProvider` / `consumeAuthReturn` / `listAuthProviders` on `RestAuthAdapter`, with
  `PROFILES` shaped so a Supabase entry is the only thing missing for Supabase.
- `user-ports.ts`, which any node needing the accounts table can consume.
- `bcn-006-stub-oauth-provider.mjs` + `bcn-006-oauth-rig.mjs`, so the next OAuth change is
  measurable in one command rather than unmeasurable.

**Left deliberately:**
- Directus SSO (§3.2) — wants the cookie-session decision first.
- Supabase auth (§5) — wants a GoTrue and the judgement in §5.2.
- A probe runner for `conditional` cells (§3.4, item 7) — the largest of the three, and the one
  most visible to a builder today.
