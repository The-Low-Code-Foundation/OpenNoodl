# Closing phase 67 — your list, in order

**Rewritten 2026-08-18 (session 35), after your four decisions.** The agent-facing handover is
[NEXT-SESSION-PROMPT.md](NEXT-SESSION-PROMPT.md); this is the same close from your side.

> **The bar, unchanged:** *phase 67 closes when a stranger can reach `community.nodegx.io`, make
> an account, ask a question about a node from inside the editor, and get an answer — and when
> that site does not look like a placeholder.*

---

## 🟢 What your four answers changed, in one paragraph

You answered E5 (**nexus-1**), E6 (**Brevo**), E7 (**Hetzner Object Storage**) and the remainder
(**a phase 67b**). Three of those turned into build work the same session, and all three are done:
**E6 is closed in code**, **E2 — the deployment — exists and is the largest thing that was missing
from this phase**, and **E7 turned out to need no code at all for the thing it was blocking**.

**The list is now one form and one command.** Everything else on it is waiting on those.

---

## 🔴 What is left, and it is genuinely short

| | What | Whose | Time |
|---|---|---|---|
| **1** | **The GitHub OAuth App** — the same form as before | **Yours** | ~10 min |
| **2** | **Verify a sending domain in Brevo** — new, small, and it is the one thing E6 cannot do for itself | **Yours** | ~15 min + DNS |
| **3** | **One `openssl` command** for the link secret | **Yours** | 30 sec |
| **4** | **Run the deploy** | Mine — ⚠️ **but I have not run it and will not without you saying so** | ~10 min |
| **5** | **E9 — the smoke drive** on the real box | Mine | after 4 |

---

# 1. E10 — the GitHub OAuth App ⏱️ ~10 minutes

**Unchanged from the last version of this list, and still the most blocking thing on it.** Without
it `/api/auth/github/start` answers **503** with a plain sentence, deliberately — so *nobody can
make an account*, which is the first verb in the closing bar.

### 🔴 Make TWO apps, not one

A GitHub **OAuth App has exactly one callback URL**, so one app cannot serve both your laptop and
the deployed site. Two costs nothing and it decouples proving from deploying.

**Create both at:** GitHub → the **The-Low-Code-Foundation** org → Settings → Developer settings →
OAuth Apps → New OAuth App. ⚠️ **Under the org, not your personal account.**

| | App A — "NodeGX Community (dev)" | App B — "NodeGX Community" |
|---|---|---|
| Homepage URL | `http://localhost:3000` | `https://community.nodegx.io` |
| Authorization callback URL | `http://localhost:3000/api/auth/github/callback` | `https://community.nodegx.io/api/auth/github/callback` |

⚠️ **Byte for byte.** GitHub reports a mismatch as `redirect_uri_mismatch` **without saying which
side is wrong**. No trailing slash. `http` for local, `https` for the deployed one.

---

# 2. 🆕 E6's remaining half — verify a sending domain in Brevo ⏱️ ~15 minutes

**This is new on your list and it is small, but it is the difference between mail that sends and
mail that queues.**

🔴 **The good news first: you did not choose a new provider.** Brevo is already live — `nodegx.io`'s
waitlist has posted to that account for months, **from nexus-1, the very box you just chose**. So
the API key exists (it is in `OpenNoodl/.env`), the account exists, and the source IP is already
authorised.

**What is missing is a verified *sending domain*.** The platform stamps every notification with an
envelope of `notifications@mail.nodegx.io`, and Brevo will refuse to send as a domain it has not
seen you prove you own.

**What to do:** Brevo → Senders, Domains & Dedicated IPs → **Domains** → add **`mail.nodegx.io`** →
add the SPF/DKIM/DMARC records it gives you to the `nodegx.io` DNS.

> ⚠️ **`mail.nodegx.io` specifically, byte for byte.** That exact string is now the database
> default (migration `0012`), and the envelope is checked against it **by a Postgres trigger** — so
> a mismatch is not a soft failure, it refuses the row. If you would rather send from a different
> subdomain, tell me and I will move the default; do not just verify a different one.

🔴 **Why this was not on the old list:** the old list said E6 was *"one file — `smtp.ts`"*. That was
true and the file is written. What it missed is that the database still had `mail.nodegx.dev` in
it — a domain that was never registered — left over from before D2 was amended to `.io`. Deployed
as it stood, every envelope would have been stamped with a domain you do not own.

---

# 3. `NOTIFICATION_LINK_SECRET` ⏱️ 30 seconds

```
openssl rand -base64 32
```

🔴 **Until it exists, no notification email goes out at all** — that is E8 working as designed.
Quiet is the correct failure; silent-and-forgeable was the bug.

---

## 🔐 Where to put all of it

**One file, which I read and you can delete afterwards** — `~/nodegx-community-deploy.env`:

```
GITHUB_OAUTH_CLIENT_ID=Iv1.xxxxxxxx          # App B, the deployed one
GITHUB_OAUTH_CLIENT_SECRET=xxxxxxxx
NOTIFICATION_LINK_SECRET=<the openssl output>
```

**You do not need to put `BREVO_API_KEY` in it** — the deploy reads that from `OpenNoodl/.env`,
where it already is. **Do not paste any of these into a chat or a commit.**

> The **dev** OAuth pair (App A) goes in a separate file if you want the local drive first —
> `~/nodegx-oauth-dev.env`. That is optional; it only buys proving the GitHub half on localhost
> before deploying.

---

# 4. E2 — the deployment ✅ **BUILT 2026-08-18, NOT RUN**

**The largest missing piece of this phase now exists.** The old list said *"no Dockerfile, no CI
workflow, no `ops/`"*. There is now an `ops/` in `nodegx-community`, and it follows the landing
page's pattern exactly, because that pattern is the one that has already survived a deploy onto
this box.

**What it does:** installs Node and Postgres if absent, creates the database and a role with a
generated password, writes a systemd unit, writes **a Caddy drop-in and validates the whole config
before reloading** (backing the drop-in out if it does not validate), installs a **daily `pg_dump`
with 14 days of retention**, pushes the source, builds on the host, **migrates**, restarts, and
verifies.

### 🔴 It curls all three neighbours before and after, and fails if any of them moves

`nodegx.io`, `nexus.digitalbricks.io`, `digitalbricks.io` — all three were **200** when I checked
today. The deploy records them before, compares after, and **exits non-zero if any code changed**.

### 🔴 The four refusals, all checked on your laptop before a byte moves

It will not run without `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`,
`NOTIFICATION_LINK_SECRET` or `BREVO_API_KEY`, and it refuses any `SITE_ORIGIN` that is not
`https://`. ⚠️ That last one matters more than it looks: unset, it defaults to
`http://localhost:3000`, mints session cookies **without `Secure`**, and builds callback URLs
pointing at a laptop — a site that comes up and half-works.

### ⚠️ `community.nodegx.io` already resolves to `49.12.102.195`

Checked today. **There is no DNS step.** Caddy will fetch a certificate on reload.

### 🔴 A defect this uncovered, which had nothing to do with deployment

**The migrations could not be run twice.** 155 `create` statements across twelve files, **not one**
`if not exists` — they are all written as a first run. So a second deploy had exactly two functions
available and both were wrong: `applySchema` errors partway through, and **`resetSchema` succeeds,
because it drops the schema first — it would have taken every account on the box with it and
reported nothing at all.**

There is now a migration ledger that applies only what is unapplied, records a checksum of each
file, and refuses to continue if a migration that has already run has since been edited. Nine
specs, including both controls — one asserting `applySchema` fails, and one asserting `resetSchema`
**does not fail** and empties the table, so nobody reads this and concludes a mistake would be
caught.

---

# 5. E7 — where artefacts live ✅ **ANSWERED, and it needed less than anyone thought**

You chose **Hetzner Object Storage**. 🔴 **The thing E7 was blocking needs no code**: UNI-020's
*"Download the starter project"* button renders when `articles.project_url` is set, that column
already exists, and a public object URL can simply be written into it. Upload a starter project to
a bucket, paste the URL, the button appears.

**What is still owed** is the **capture image upload path** — and it is genuinely blocked on you in
the same way E10 is: it needs S3 credentials minted from the Hetzner console. A `capture` stores
dimensions and consent and **no image**, so nothing has to be migrated whenever you do it. It is
scoped into **phase 67b**, not into this close.

---

# 6. E9 — the smoke drive ⏱️ mine, and it is the last thing

Every gate in both repositories runs against localhost. E9 is signing in on the real box over real
HTTPS, asking a question from inside the editor, answering it, and watching the email arrive.
**When that passes, the phase closes.**

---

# 🟢 The remainder has a home — phase 67b

You chose a new phase over folding into 68. It exists:
[`dev-docs/tasks/phase-67b-the-community-remainder/`](../phase-67b-the-community-remainder/README.md).

⚠️ **It also carries two gaps found today that were on nobody's list**, and the first is the kind
worth knowing about:

**`outbound_emails` has no drainer.** UNI-004's relay queue — RFP responses, coaching messages — is
written and read back and **nothing sends it**. E6 gave the *notification* queue a real transport,
which covers *"someone answered you"* on the Bench. But a notification whose outcome is `'relayed'`
defers delivery to that second queue, so **the database records that a person was emailed by
something that never sends**. Its envelope is also pinned to `relay.nodegx.dev`, still unregistered.

The second: **the backups are on the same box as the database.** That survives a dropped table, not
a lost host.

---

# What to paste into a fresh session

**When you have done 1, 2 and 3:**

> Continue phase 67, `dev-docs/tasks/phase-67-nodegx-university/`. Read
> `CLOSING-THE-PHASE-RICHARDS-LIST.md` then `NEXT-SESSION-PROMPT.md`. **E10 is done and the
> secrets are at `~/nodegx-community-deploy.env`; `mail.nodegx.io` is verified in Brevo.** Run
> `ops/deploy.sh` against nexus-1, then do E9 — the smoke drive over real HTTPS. Curl the three
> neighbours before and after and stop if any of them moves.

**If you have only done E10 and want the GitHub half proved locally first:**

> Continue phase 67. **The dev OAuth App exists** — credentials at `~/nodegx-oauth-dev.env`. Wire
> it up locally and drive the whole sign-in loop end to end, including the GitHub half, which has
> never been proved.

**If you want the site better meanwhile and nothing above is done:**

> Continue phase 67. Nothing in the close is unblocked, so build **UNI-023** — the cheapest
> remaining item. ⚠️ Do not draw a second pill style. And **look at the site in the LIGHT theme**,
> which nobody has done in five sessions.

---

# What you do NOT need to do to close this phase

**Not** a Paddle account (D7), **not** the twelve badge artworks (the profile renders a family mark
and a tier colour rather than a broken image, which was the point), **not** GitHub Pages, **not**
hosting (UNI-008), **not** the editor's Learning section, **not** the Hetzner S3 credentials (phase
67b). None of them is in the closing sentence.
