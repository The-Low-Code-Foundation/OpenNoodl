# Closing phase 67 — your list, in order

**Written 2026-08-18 (session 34), for Richard.** The agent-facing handover is
[NEXT-SESSION-PROMPT.md](NEXT-SESSION-PROMPT.md); this is the same close from your side.

> **The bar, unchanged:** *phase 67 closes when a stranger can reach `community.nodegx.io`, make
> an account, ask a question about a node from inside the editor, and get an answer — and when
> that site does not look like a placeholder.*

**Where it actually stands:** the site is built, the issuer is built, the editor's sign-in is built
and was driven end to end on localhost, and the site no longer has a dead-end page. **Nobody on
earth can make an account**, and the reason is not code — it is that no GitHub OAuth App exists and
the platform is served nowhere.

---

## 🔴 First, a correction to "the close is entirely yours"

**The decisions are yours. Some of the work behind them is mine, and it is not small.** Splitting
them is the difference between a list you can finish in an evening and a list that looks
impossible:

| | Yours — nobody else can do it | Mine — once you have decided |
|---|---|---|
| **E10** | Create the GitHub OAuth App, hand me two strings | wiring, verifying, the smoke drive |
| **E5** | **Decide where the platform runs** | everything after the decision |
| **E2** | nothing, once E5 is answered | 🔴 **All of it, and none of it exists yet** — measured today: no Dockerfile, no CI workflow, no `ops/`, only a dev-Postgres `docker-compose.yml` |
| **E6** | Open the sending account, own the domain | 🔴 **One file** — `src/lib/mail/smtp.ts` implementing a three-line interface, and `defaultTransport()` starts returning it |
| **E7** | Decide where images live | the upload path |
| **E8** | Run one `openssl` command | done already |
| **E9** | nothing | the smoke drive on the real box |

**So the honest shape of it is: two decisions and one form from you, then a day or so of build from
me, then a drive.**

---

## The order, and why it is this order

```
E10 (OAuth App) ─┬─► accounts work locally ─────────────► the last unproven arm closes
                 │
E5 (where?) ─────┴─► E2 (I build the deployment) ─► E9 (smoke drive) ─► PHASE CLOSES
                          ▲
E6 (email) ───────────────┘   (needed for the site to be honest, not for it to run)
```

🔴 **E10 and E5 are independent of each other and both are cheap. Do them in either order, but do
E10 first if you only have ten minutes**, because it is the one that turns a dead sign-in into a
working one without anything being deployed.

---

# 1. E10 — the GitHub OAuth App ⏱️ ~10 minutes

**This is the cheapest item on the list and the most blocking.** Without it
`/api/auth/github/start` answers **503** with a plain sentence, deliberately — so *nobody can make
an account*, which is the first verb in the closing bar.

### 🔴 Make TWO apps, not one — and this is the part worth reading

A GitHub **OAuth App has exactly one callback URL**. So one app cannot serve both your laptop and
the deployed site. Two apps costs nothing and it **decouples proving from deploying**: with the
local one, we can prove the GitHub half of the sign-in works *tonight*, without E5, E2 or a domain.

**Create both at:** GitHub → the **The-Low-Code-Foundation** org → Settings → Developer settings →
OAuth Apps → New OAuth App. ⚠️ **Under the org, not your personal account**, so it outlives any one
person's login.

| | App A — "NodeGX Community (dev)" | App B — "NodeGX Community" |
|---|---|---|
| Homepage URL | `http://localhost:3000` | `https://community.nodegx.io` |
| Authorization callback URL | `http://localhost:3000/api/auth/github/callback` | `https://community.nodegx.io/api/auth/github/callback` |

⚠️ **Byte for byte.** GitHub reports a mismatch as `redirect_uri_mismatch` **without saying which
side is wrong**, and it is the single most common half-hour lost in this kind of setup. No trailing
slash. `http` for local, `https` for the deployed one.

### What to hand me

For each app, the **Client ID** and a **Client secret** (generate one; GitHub shows it once).

> 🔐 **Do not paste secrets into a chat or a commit.** Put them in a file I can read and you can
> delete — `~/nodegx-oauth-dev.env` — as:
> ```
> GITHUB_OAUTH_CLIENT_ID=Iv1.xxxxxxxx
> GITHUB_OAUTH_CLIENT_SECRET=xxxxxxxx
> ```
> and tell me the path. The production pair goes on the server later, not on your laptop.

**What I do with it:** point a local server at App A and drive the whole loop — browser sign-in,
account creation, the editor's device flow, sign-out — which closes the **one arm of UNI-001 that
has never been proved** (the GitHub half; everything else was driven in session 33).

---

# 2. E5 — where does the platform run? ⏱️ a decision, not a task

**This is the real fork in the road, and it is a bigger question than it looks**, so here is what
is actually being asked.

The landing page already runs on **nexus-1 (`49.12.102.195`)** as an *additive tenant* beside
`nexus.digitalbricks.io` and `digitalbricks.io`. That pattern is proven and safe: it writes one
Caddy drop-in, refuses to run unless the main config imports the drop-in directory, and curls both
neighbours before and after so a deploy that breaks one cannot read as a success.

🔴 **But the landing page is static files, and this is not.** The community platform is a
long-running Node server **plus a Postgres holding real people's accounts** — the first *stateful*
thing you would put on that box. That changes the question from "is there room" to:

| | **A — nexus-1, beside the other two** | **B — a new Hetzner box** |
|---|---|---|
| Cost | £0 | ~€5–10/month |
| Speed | today | needs your Hetzner **server limit raised** (it blocked a new server before) |
| Risk | 🔴 a third tenant on a box where **Caddy is all-or-nothing**, now with a database and backups to think about | clean blast radius |
| Backups | you inherit them for two live sites too | isolated |
| Your own words | *"raise it when we're doing the learning / community stuff"* | ← this is that moment |

**My recommendation: B, a new box** — because the moment real people have accounts, "the community
platform is down" and "digitalbricks.io is down" must not be the same sentence, and because you
already said you would raise the limit when this work arrived. ⚠️ **A is a perfectly good answer
for an alpha** if you would rather spend nothing until somebody actually signs up — and if you pick
it, I will follow the landing page's additive pattern exactly and curl the neighbours either side.

**Answer with one word: `nexus-1` or `new box`.** If it is a new box, I will also need to know when
the limit is raised, because I cannot create it.

---

# 3. E2 — the deployment ⏱️ mine, once E5 is answered

Nothing to do here except know what you are getting. **Measured today: this repo has no Dockerfile,
no CI workflow and no `ops/` directory** — the only compose file is the dev Postgres. So this is a
build, not a button, and it is the largest remaining piece of work in the phase.

What I will build once you have answered E5: a container image for the Next server, a Postgres with
a backup, migrations applied on deploy, a Caddy reverse-proxy drop-in following the landing page's
additive pattern, and a deploy script that **verifies the neighbours before and after**.

### 🔴 The five environment variables the deployment needs

There are exactly five. Three are yours to supply, two are mechanical:

| Variable | Value | Who |
|---|---|---|
| `SITE_ORIGIN` | `https://community.nodegx.io` | me — ⚠️ **but it defaults to `http://localhost:3000`**, and unset it mints cookies **without `Secure`** and builds callback URLs pointing at a laptop. It is as load-bearing as the secret below |
| `GITHUB_OAUTH_CLIENT_ID` / `_SECRET` | App B's pair | **you** (E10) |
| `NOTIFICATION_LINK_SECRET` | `openssl rand -base64 32` | **you** — see below |
| `DATABASE_URL` | the deployed Postgres | me |

---

# 4. Set `NOTIFICATION_LINK_SECRET` ⏱️ 30 seconds

```
openssl rand -base64 32
```

Keep the output for the deployment. 🔴 **Until it exists, no notification email goes out at all** —
that is E8 working as designed: over `https` an unset secret means the whole no-session path is
unconfigured, so minting a link **throws**, verification returns null (a token forged from the
published dev default is refused), and `notify` records the row and reports `unconfigured` rather
than sending a forgeable unsubscribe link. **Quiet is the correct failure; silent-and-forgeable was
the bug.**

---

# 5. E6 — a transactional sending account ⏱️ ~20 minutes, and it has a deadline of sorts

**Postmark, SES or Resend — pick one, open the account, verify a sending domain.** You will need to
add DNS records (SPF/DKIM) for whichever domain you send from.

🔴 **Why this is not optional and not deferrable-forever:** D19 — the ruling that made the Bench
ours rather than bought — was made **on the condition** that email lands. Its own words: *"a forum
where 'someone answered you' never reaches an inbox is a forum nobody returns to."* The `log`
transport covers development and **cannot ship**.

**What I need from you:** which provider, the API key, and the sending domain (e.g.
`community.nodegx.io` or `mail.nodegx.io`). **What I do:** write `src/lib/mail/smtp.ts` against the
existing three-line `Transport` interface and flip `defaultTransport()`. The seam was built for
this — swapping transports is a change of *destination*, never of *content*, and the suite already
holds the `log` transport to the same field-by-field expectations the real one must meet.

---

# 6. E7 — where capture images live ⏱️ a decision, genuinely cheap

Today a `capture` stores **dimensions and consent and no image**, so **nothing has to be migrated**
whenever you decide. Options: an S3-compatible bucket (Hetzner Object Storage, Cloudflare R2), or
a directory on whichever box E5 picks.

⚠️ **It now blocks a second thing.** UNI-020 shipped a *"Download the starter project"* button that
renders only when an article has a URL — and **nothing can ever supply one** until artefacts have a
home. So E7 is no longer only about screenshots.

---

# 7. E9 — the smoke drive ⏱️ mine, and it is the last thing

Every gate in both repositories runs against localhost. E9 is me signing in on the real box over
real HTTPS, asking a question from inside the editor, answering it, and watching the email arrive.
**When that passes, the phase closes.**

---

# 🔴 One more decision that arrives at the close

Eight scoped tasks are **deliberately not in the close** and need a home rather than a drift:
UNI-017 (the queue), UNI-018 (pull a graph), UNI-007's intake, UNI-006's bridge, UNI-011's in-editor
views, UNI-008 (hosting), UNI-010's remaining slice, UNI-012 (the packaged-install check) — plus
**UNI-013 slice 4, the twelve badge artworks, which are yours and are not code**.

**They become a phase 67b, or they fold into phase 68.** Worth deciding when you close, so it is a
choice rather than something that happened.

---

# What to paste into a fresh session

**If you have done E10 (either app):**

> Continue phase 67, `dev-docs/tasks/phase-67-nodegx-university/`. Read
> `CLOSING-THE-PHASE-RICHARDS-LIST.md` then `NEXT-SESSION-PROMPT.md`. **The GitHub OAuth App
> exists** — credentials are at `<path>`. Wire it up locally and drive the whole sign-in loop
> end to end, including the GitHub half, which has never been proved. Report what a real stranger
> would now hit.

**If you have answered E5:**

> Continue phase 67, `dev-docs/tasks/phase-67-nodegx-university/`. Read
> `CLOSING-THE-PHASE-RICHARDS-LIST.md` then `NEXT-SESSION-PROMPT.md`. **E5 is answered:
> `<nexus-1 | new box>`.** Build E2 — the deployment — and treat the landing page's additive Caddy
> pattern as the precedent: curl the neighbours before and after, and refuse to proceed if either
> moves. Do not deploy with `SITE_ORIGIN` unset.

**If you have done neither and want the site better meanwhile:**

> Continue phase 67, `dev-docs/tasks/phase-67-nodegx-university/`. Read
> `CLOSING-THE-PHASE-RICHARDS-LIST.md` then `NEXT-SESSION-PROMPT.md`. Nothing in the close is
> unblocked, so build **UNI-023** — it is the cheapest remaining item and UNI-020 just gave it the
> node vocabulary it wanted. ⚠️ Do not draw a second pill style. And **look at the site in the
> LIGHT theme**, which nobody has done in four sessions.

---

# What you do NOT need to do to close this phase

So the list does not grow by accident: **not** a Paddle account (D7 — coaching payments are a later
tranche), **not** the twelve badge artworks (the profile renders a family mark and a tier colour
rather than a broken image, which was the point of doing it that way), **not** GitHub Pages, **not**
hosting (UNI-008), **not** the editor's Learning section. None of them is in the closing sentence.
