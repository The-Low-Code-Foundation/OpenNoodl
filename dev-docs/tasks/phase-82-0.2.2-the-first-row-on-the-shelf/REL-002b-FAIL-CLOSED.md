# REL-002b — Fail closed, and a designed first run

_Built and closed 2026-09-01, session 5. Run-sheet row 5._

Carried from phase 81 as VIB-008's correctness half: register rows **V3** (gating) and **V4** (the
first-run state).

---

## The verdict

**Both ACs met, driven against a real enforcing backend.**
[`packages/nodegx-backend/tests/rel002b-fail-closed.test.ts`](../../../packages/nodegx-backend/tests/rel002b-fail-closed.test.ts)
— **37/37**, four arms, two backends, three browsers.

Two defects were found on the way, **neither of them in the template**. Both are registered below
with reproductions, owner `NONE`; neither blocks an AC. One of them cost most of the session and is
a live trap for the next person who writes a two-backend drive.

---

## 1. 🔴 V3's recorded mechanism was WRONG, and the correction changed what the fix had to be

The row said:

> the members chrome gates on `done` only, so it **fails open** when no backend is bound: the
> gate's failure mode is to show the protected surface.

**Measured at HEAD, before anything was built, that is not what the artefact did.** Every gated
group on all six protected pages already carried `mounted: false` — `memberArea`, `moderatorTools`,
`tools`, `queue`, `directory`, `panel`, all of them — and `mounted` defaults to `true`
([`react-component-node.ts:1900`](../../../packages/noodl-viewer-react/src/react-component-node.ts#L1900)),
so those defaults are decisions somebody made. The member and moderator **content** was never
revealed by a failed standing read.

What the artefact actually did, measured on the shipped directory with no backend bound, at
1280×900:

| page | where it ended up | what it showed |
|---|---|---|
| `/members` | **`/members`** | band + `Sign out` + 3 nav + *"We could not check your membership just now."* |
| `/meetings` | **`/meetings`** | band + `Sign out` + 3 nav — **and nothing else at all** |
| `/post` | **`/post`** | same |
| `/requests` | **`/requests`** | same |
| `/directory` | **`/directory`** | same |
| `/account` | **`/account`** | same |

So the true defect was **two** things the row had not named:

1. 🔴 **Nothing refused.** All six stayed on the protected URL. The content was hidden by six
   parameter defaults; no gate had *decided* anything. That distinction is not academic — the
   person who installs this template and adds a seventh page inherits a refusal if the refusal is a
   decision, and inherits **nothing** if it was six defaults.
2. 🔴 **The band asserted a session that did not exist.** A `Sign out` button, an association slot
   and a members' nav, shown to a reader who had never signed in and could not have.

And **five of the six said nothing whatever** about why they were empty. Only `/members` carried
the unknown notice.

✅ **A recorded row can be a hypothesis; the artefact is the ruling** — the fourth time this phase
family has hit that, and the first where believing the row would have produced a *wrong fix*
(hunting for a missing `mounted: false` that was already there in all six places).

---

## 2. What was built

All of it in the **generator**, [`tpl001Components.ts`](../../../packages/noodl-mcp/tests/tpl001Components.ts),
then regenerated with `npm run template:members`. The generator is the source of truth and
`tpl001Template.test.ts`'s byte gate proves the artefact is its output — **verified first that
regeneration was a clean no-op**, so nothing in this diff could be misattributed.

### 2.1 The gate refuses — `Members/Standing`

A new **`Denied`** signal with **two producers**, which are the two ways a page can be one you may
not read:

- `decide` fires it when the server answered `visitor` (alongside the existing `Visitor` output).
- `failed` fires it when the server **could not be asked at all** — the half that did not exist.

The six protected pages now navigate on `chrome.Denied` instead of `chrome.Visitor`.

### 2.2 The band stops claiming a session — `Members/Chrome`

A new `isSignedIn` boolean, consumed **inside the band and forwarded to nobody**: it answers *"is
there a session"*, which is the band's question, while `isMember` answers *"may this person read"*,
which is the pages'. `topRow` and `nav` both gain `mounted: false` and are driven from it.

### 2.3 The first run has a screen — `Pages/Landing`

🔴 **V4's mechanism, exactly:** `actions` — the *"Ways in"* group holding `Members sign in` and
`Ask to join` — was **the only group on the page with no `mounted: false`**. Every other card
defaulted closed. So when the association query never answered, `actions` was the one thing left
standing, which is precisely the photograph V4 was filed from: an eyebrow, a gap where the name
should be, and two buttons. Three states — never answered / answered-and-unclaimed /
answered-and-claimed — collapsed into one, and the one they collapsed into had no words on it.

Built: `actions` gains `mounted: false`, and a new **`waitingCard`** carries the third state.

🔴 **`waitingCard` is the only node in the template mounted by DEFAULT, and that is the design.**
"The query has not answered" is the state the page is in before anything happens, so it is the
state the page starts in; `read` publishes `unanswered = false` and takes it down when an answer
arrives.

⚠️ **It is deliberately NOT hung off `association.failure`** — see §4.1. That design would have
been dead in the only case it exists for, and would have looked correct in review.

---

## 3. The drive — four arms, and why each one is there

| arm | backend | session | result |
|---|---|---|---|
| **member** 🔴 CONTROL | real, complete | signed in, moderator | **stays** on all six; offered the band |
| **visitor** | real, complete | none | ejects to `/` from all six; **never offered `Sign out`**, painted or in markup |
| **unreadable** 🔴 THE ROW | real, `myStanding` **not deployed** (404) | signed in, moderator | ejects to `/` from all six |
| **unbound** | none at all | none | ejects to `/`; landing shows the designed card |

🔴 **The member arm is what makes the other three mean anything.** Three arms that all end on `/`
are equally consistent with a template that ejects *everybody* — a gate wired to refuse
unconditionally passes a visitor-and-failure-only spec perfectly and is a broken product. **The
control caught exactly that**: the first run of this file had the member on `/` too, and only the
control said so.

**The observable is `location.pathname`, read out of the live page.** ⚠️ `Visit.url` echoes the URL
that was **requested**, not where the page ended up, so an ejection assertion written on it would
have passed on every arm including the broken ones.

**The `unreadable` arm varies one thing** — `myStanding` subtracted from the disk-derived
`CLOUD_KEYS`, asserted to be exactly one shorter. Both halves are asserted over HTTP *inside the
run*: the function really is absent (**404**) and the same token really is good on the same backend
(`myNotifySetting` → **200**). Without that pair, "ejected" is equally consistent with a session
that was never valid.

**§4's control is the half that matters for V4**: the waiting card is **gone** on both arms where a
backend answered. Without it, "the card is on the unbound arm" is satisfiable by a card that is
always on — which is its own defect and would have read as a pass.

---

## 4. Two defects found, registered not built — owner `NONE`

Neither blocks an AC. Both are reproduced here so they are not re-derived at full price.

### 4.1 🔴 `DbCollection2` never fires `failure` when no backend is bound

**Measured.** A probe copy of the template with `association.failure` wired to a visible `Text`:
with no backend bound the text stayed at its default. `failure` **did not fire**. The console
instead carries `TypeError: Cannot read properties of undefined (reading 'results')`.

**Mechanism, read from source:**
[`ParseWireAdapter._makeRequest`](../../../packages/noodl-runtime/src/api/backends/ParseWireAdapter.ts#L216)
does `try { json = JSON.parse(xhr.response || xhr.responseText); } catch (e) {}` and then, on a
`200`, calls `options.success(json)` — with `json` **undefined**. `query`'s success handler
([line 359](../../../packages/noodl-runtime/src/api/backends/ParseWireAdapter.ts#L359)) then
dereferences `response.results` and throws **before** the node's own `if (results !== undefined)`
guard can run. The guard was written for this and never gets a chance.

It reaches a real user: with no backend the request goes to a relative path, and an SPA host
answers **200 with `index.html`** — which is standard static-hosting behaviour, not a harness
artefact.

⚠️ **This is NOT the same claim as D4.** `tpl001-refused-query.test.ts` proved `failure` *does* fire
on a genuine **403**. The two coexist: a refusal is legible, a **missing backend** is not.

✅ **It did not block AC3** once the waiting card was designed as a default state rather than a
`failure` branch — which is the only reason this is a register row and not the session's first job.
🔴 **But it would have silently disarmed the obvious design**, and that design would have passed
review.

### 4.2 🔴🔴 Starting a second `BackendService` in the same process invalidates the first one's sessions

**This cost most of the session and it presents as a template defect.**

Measured one variable at a time — the *only* change was where `serviceB.start()` sits relative to
backend A's browser work:

| `serviceB.start()` | browser signs in | `myStanding` with the browser's own token | member-only fn |
|---|---|---|---|
| **before** arm A | ✅ localStorage holds `roles: ["admin"]` and a well-formed `r:` token | **`visitor`** | **500** |
| **after** arm A | ✅ same | **`moderator`** | **200** |

A session minted over HTTP against the same backend seconds earlier read `moderator` in **both**
cases, so the account, the roles and the function were never in question — only sessions the first
backend had issued.

The symptom is *"a signed-in moderator is ejected by the gate"*, which is exactly what this file was
built to detect. **Three hypotheses were chased and disproved first** (arm ordering on one page, a
malformed token, a Parse-wire response shape) before the two-backend variable was isolated.

✅ **Until it is fixed, a drive that needs two backends must finish with the first before starting
the second.** The ordering in the spec is load-bearing and carries a loud comment saying so.

⚠️ It also broke a *correct* diagnostic step: replaying the browser's token from Node is not the
same request the browser makes — the browser carries an `installationId` the replay does not. The
spec keeps the replay only as a *supporting* reading; the load-bearing control is what the **page**
shows.

---

## 5. What is NOT closed here

- **V15 and V29** — the widths and the centring — are **REL-002c**, and REL-002c is where Richard's
  WORTHY ruling lands. Nothing in this task asks for a look ruling.
- The `waitingCard`'s **appearance** is a designed state, not a judged one. If REL-002c restyles the
  landing page, that card is part of the page it restyles.

## 6. Suites this change owed, all green

| suite | result |
|---|---|
| `rel002b-fail-closed.test.ts` (new) | **37/37** |
| `tpl001Template.test.ts` — incl. the **byte gate** | **72/72** (two pinned counts updated, §6.1) |
| `tpl001-members-drive.test.ts` | 59/59 |
| `tpl001-empty-states` + `tpl001-refused-query` | 20/20 |
| `tpl002-account-drive` + `tpl002-notifications` | 51/51 |
| `ac2-page-editor-drag-drive.test.ts` | 23/23 |
| **the whole `noodl-mcp` package** | **1085/1085**, 83 suites |

### 6.1 The two pinned assertions that moved, and why they are not a weakened gate

- **`Members/Standing`'s declared output set** — `Denied` and `isSignedIn` added. The neighbouring
  *"no wire names a port its target component does not declare"* check is what makes this a real
  interface gate rather than a list to keep in step.
- **The `mounted`-gate census, 49 → 52.** The band's two plus the waiting card. Both new comments
  say what the three are, so the number stays a claim about the template rather than a tally.

⚠️ **`.look.ts` files are not run by jest** — `testMatch` is `**/tests/**/*.test.ts`. `vib001-members.look.ts`
and `tpl001-rows.look.ts` read this template and were **not** exercised by any run above.
