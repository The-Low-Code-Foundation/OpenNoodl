# Phase 33 — What only a human can do

**Created:** 2026-08-03
**Why this file exists:** three of phase 33's seven tasks are not engineering, and the
things they wait on have lead times measured in days-to-weeks from *other people*
(Apple, a CA, a reader, a tester). Everything else in the phase is downstream of
them. This is the list, ordered by lead time — start at the top today, because
nothing an agent does shortens any of it.

Nothing here is a task an agent can take. Where an agent can do the half either side
of a human step, that is noted.

---

## Tier A — longest lead time, start today

### A1. Apple Developer ID + notarisation credentials → ALPHA-002

> **Updated 2026-08-04 — this is far smaller than it was written up as.** The
> certificate this item was waiting weeks for **already exists on Richard's
> machine.** A release build run locally with signing enabled found it in the
> keychain and signed the app with it:
>
> ```
> $ security find-identity -v -p codesigning
>   1) EADD3AB8… "Developer ID Application: Osborne Solutions (Y35J975HXR)"
>   2) 50350C36… "Apple Development: Richard Osborne (8B4P8393XX)"
>
> • signing  file=dist/mac-arm64/NodeGX.app type=distribution
>            identityName=Developer ID Application: Osborne Solutions (Y35J975HXR)
> ```
>
> A *Developer ID Application* certificate is exactly the type needed to
> distribute outside the App Store, and it is only issued to a paid Apple
> Developer Program membership. **There is no enrolment to wait for, no D-U-N-S,
> and no £79 to spend.** `APPLE_TEAM_ID` is `Y35J975HXR`.
>
> What is left is ~15 minutes of exporting, not days of waiting:
>
> 1. **Keychain Access → My Certificates →** right-click *Developer ID
>    Application: Osborne Solutions* **→ Export…**, save as `.p12`, set a
>    password. (Export the certificate row, so the private key goes with it.)
> 2. `base64 -i cert.p12 | pbcopy` → paste as the `CSC_LINK` secret.
> 3. The password from step 1 → `CSC_KEY_PASSWORD`.
> 4. `APPLE_TEAM_ID` → `Y35J975HXR`.
> 5. `APPLE_ID` → the Apple ID that owns the membership.
> 6. **appleid.apple.com → Sign-In and Security → App-Specific Passwords → +** →
>    `APPLE_APP_SPECIFIC_PASSWORD`. Takes about a minute.
>
> Only steps 5 and 6 involve anything not already on the machine. Notarisation
> is the *only* part still genuinely missing — the build already signs.

**The CI half is already built.** `.github/workflows/release.yml:80-89` already reads
every secret it needs and is written so that an absent secret produces an *unsigned*
artifact rather than a failed job — deliberately, so a human sees it. What is missing
is only the credentials.

Needed as GitHub repository secrets:

| Secret | What it is | Status |
|---|---|---|
| `CSC_LINK` | base64 of a **Developer ID Application** `.p12` | **cert exists — needs exporting** |
| `CSC_KEY_PASSWORD` | that `.p12`'s password | chosen at export time |
| `APPLE_ID` | the Apple ID used for notarisation | Richard knows it |
| `APPLE_APP_SPECIFIC_PASSWORD` | app-specific password for that Apple ID (or swap the workflow to an App Store Connect API key) | ~1 minute to generate |
| `APPLE_TEAM_ID` | the 10-character team ID | **`Y35J975HXR`** |

⚠️ *"Ship unsigned for the alpha" is not the shortcut it sounds like.* Gatekeeper
blocks unsigned macOS builds outright. ALPHA-002 §3 allows a deliberate unsigned
release **only** if paired with `dev-docs/guidelines/INSTALLING-UNSIGNED-BUILDS.md`
linked from the download page — never discovered by the user. Given that the
certificate already exists, taking that route now would be a choice, not a
constraint.

### A2. Windows code-signing certificate → ALPHA-002

Secrets `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD`, same wiring. An OV certificate is
cheaper but still accumulates SmartScreen reputation from zero; EV is immediate but
needs a hardware token and organisation validation. Windows is currently the *only*
platform with a complete artifact story, so this is the one place signing changes a
working path rather than an absent one.

**Decision needed:** buy for alpha, or ship Windows unsigned behind the same
install guide as A1.

### A3. Testers who are not Richard → ALPHA-001, and the phase's exit criterion

Phase 33's exit criterion is explicit: download, reach a working app, and report a
problem — *"each of those three demonstrated by someone who is not Richard and did
not build it."*

Needed:

- **at least one macOS, one Windows and one Linux tester** who have never built this
  project (ALPHA-002 criterion 3 requires the install be done by someone following
  `RELEASE-PROCESS.md` and nothing else);
- **a clean machine or fresh user account with clean `userData`** for ALPHA-001's
  cold-install pass. A fresh macOS user account is enough; a VM is better.

Recruiting is the slow part and it is independent of the build — start it before the
certificates land.

---

## Tier B — decisions only Richard can take

Each is cheap to make and expensive to leave open, because code lands on both sides
of them.

### B1. Publishing entity, contact address, governing law → ALPHA-005

`PRIVACY.md` and `TERMS.md` are complete and every claim in them is verified against
the source — except the contact/entity section, which is a marked `TODO` in an HTML
comment (stripped before display). Both files ship *inside the binary* via
`extraResources`, so this must be answered before any build reaches a stranger.

Three answers: the publishing entity's legal name, a contact address, and governing
law/jurisdiction. Coupled to A1's Apple enrolment — same entity.

### B2. F63 — the leaked GitHub OAuth client secret 🔴 **code fixed, two GitHub actions outstanding**

**Code fixed 2026-08-06.** Richard's decision was the **device flow**, and it is
built: `src/main/src/github-device-flow.js` (the polling state machine, 19 tests),
`github-oauth-handler.js` (Electron wiring, no secret, no `noodl://github-callback`),
and `GitHubDeviceCodeDialog` (the user code, which the flow cannot complete without).
The handler is also excluded from the `files` allow-list now, so it no longer ships
as readable source alongside the bundle.

**Two things only a human with admin on the OAuth app can do. Neither is optional.**

1. ⚠️ **Revoke the old client secret** — `c45276fa80b0618de06e5e2b09c1019ca150baef`,
   OAuth app client id `Ov23li2n9u3dwAhwoifb`. It has been public in a public repo
   and is **still valid until it is regenerated in the app's settings**. Deleting it
   from source does not un-leak it: every clone, fork and build already made still
   has it. Until this is done, F63 is not fixed — it is only no longer getting worse.
   *GitHub → Settings → Developer settings → OAuth Apps → this app → Generate a new
   client secret, then delete the old one.* Nothing in NodeGX consumes the new one;
   the device flow uses the client **id** only, which is public by design.

2. ⚠️ **Tick "Enable Device Flow"** on the same OAuth app. It is **off by default**,
   and GitHub does not warn you — the app just gets `device_flow_disabled` on the
   very first request. That case is handled distinctly and says so in plain words,
   but no user can do anything about it. *Same settings page, checkbox near the
   bottom, then Update application.*

**This has not been driven against live GitHub**, because both actions above have to
happen first — a device-code request against an app with the flow disabled cannot
succeed. Once they are done, the flow is worth one live pass: Connect from the
version-control panel, check the dialog shows a code, complete it on github.com, and
separately press Cancel there to confirm the refusal message differs from a timeout.

Related and unowned: **F64** — `GitHubTokenStore.ts`'s docstring claims Electron
`safeStorage` "OS-level encryption"; the code uses only `electron-store`'s
`encryptionKey`, a literal embedded in the app. The AI keys *do* use `safeStorage`,
so the two credential stores disagree. `PRIVACY.md` §8 documents the real behaviour.
Decide whether to converge them before or after alpha.

### B3. A8 — the publish target's name → ALPHA-002

`packages/noodl-editor/package.json` publishes to
`The-Low-Code-Foundation/OpenNoodl` for a product called NodeGX, so every download
URL and the auto-update feed say the old name.

Not safe to change casually: pointing `publish` at a repository that does not exist
breaks releases, and moving the repo breaks anything already published under the old
name. **Decide once, before the first tag anyone installs**, because the feed URL is
baked into each binary and alpha testers will not re-download for months.

### B4. Permission to create the issue labels → ALPHA-007 §6 (F72)

**Verified live today:** the repo's label set is still GitHub's stock nine. All three
issue forms have been declaring `needs-triage` since 2026-07-30, and
`node_report.yml` also declares `node-library`. GitHub silently drops labels it
cannot resolve, so every report filed since then is unlabelled and
`gh issue list --label needs-triage` returns nothing by construction.

There is also **no severity vocabulary at all** — no form field, no label — so the
queue can only be ranked by date.

The ALPHA-007 agent is preparing the exact `gh label create` commands as a script
rather than running them, because that repo is public. This needs a *"yes, create
these"* plus a look at the severity vocabulary before it is applied. Thirty seconds
of work behind one decision — do it before any tester files anything, not after.

### B5. The content origin's disposition → ALPHA-006 §5

`the-low-code-foundation.github.io/opennoodl-docs` is not a docs site — it is the
editor's **content CDN for seven payload types**, six of which are not documentation
(F71). Moving or archiving it silently empties the Library panel, the Learn lesson
list and the new-project template picker, with no error.

The decision: the old repo stops being a docs site and becomes the content host,
stripped to the payloads. That is a repo/hosting call with a 413 MB asset question
attached (1,621 PNGs and 315 MP4s all show the pre-refresh editor and are wrong after
phases 23–28 — dropping them is the largest single saving).

Not blocking ALPHA-006 §1, which is running now and works entirely off the bundled
catalog.

### B6. Verify the GitHub issue prefill by hand → ALPHA-007 §2 🔴

**This one can change ALPHA-007's design, so do it early.** The composer builds a
prefilled `issues/new` URL against `bug_report.yml`'s field `id`s. Whether GitHub
actually honours a prefill into a **dropdown** (`surface`, `severity`, `os`,
`fresh-project`) cannot be checked without a signed-in browser session:
`issues/new` redirects to sign-in for any request without a session cookie, and no
`gh` API renders an issue form. Anonymous requests and an `Authorization: token`
header both return the login page.

Run `node scripts/alpha-007/prefill-probe.js`, open the URL it prints, and check the
eight points listed beside it. **If all four dropdowns come back empty, the payload
has to move into the body and the field contract changes shape.**

Two minutes of work, and it is the only thing standing between ALPHA-007 Part A and
its acceptance criterion 3.

### B7. Discord / Discussions — does either exist? → ALPHA-006 §6, ALPHA-007

The Help Center's old "community Discord" and "support forum" links pointed at
**Noodl's**, not ours, so ALPHA-006 removed them rather than guess a replacement
URL. GitHub Discussions is also off (`has_discussions: false`, checked 2026-08-03).

So NodeGX currently has **no community channel of any kind** in the product. For an
alpha whose whole purpose is hearing back from testers, that is worth a deliberate
answer: create a Discord and link it, enable Discussions, or accept that issues are
the only channel and say so in the Help Center.

---

## Tier C — a person, but not a decision

### C1. An outside reader for PRIVACY.md and TERMS.md → ALPHA-005 criterion 5

The criterion the spec calls *"the real test"*: someone who did not write the
documents reads them and answers **"if I never touch the AI features, does anything
leave my machine?"** from the documents alone.

The honest answer is *no project content, but the app talks to three services
regardless* — the auto-updater, the what's-new feed, and Algolia. The policy says so
in a "short answer" section rather than burying it. Whether that lands is exactly
what cannot be self-certified.

Costs one reader and half an hour.

---

## Tier D — scope calls, so effort does not drift into them

Not blockers. Worth writing down so they are decided rather than discovered.

| # | Question | My recommendation |
|---|---|---|
| D1 | **Phase 37 (project tabs)** — specced 2026-08-02, nothing built, six tasks of main-process architecture | **Out of alpha, in writing.** Phase 33 excludes feature work by rule, and this is the most attractive unstarted thing on the board |
| D2 | **Phase 17's LEARN-007…010** — four new untracked specs | Park with the phase. Phase 33's README already holds phase 17 as a G3 question |
| D3 | **ERG-005 §1** — phase 35 calls it the headline unstarted piece, and §0 doubled its scope | A genuine call. Component Inputs/Outputs is the only mechanism in the library that cannot be documented at all, and a user hits it on their second component |
| D4 | **NDA-014 criterion 1** — a Function `object` output wired to a Text node renders `[object Object]`; the live check on 2026-08-01 found the JSON mirror could never fire on any graph | Fix before ALPHA-001. It is a first-ten-minutes-visible defect on a contract believed closed, and ALPHA-001 will find it anyway |
| D5 | **NDA-005 (port documentation)** is §0-only — 95% of 2,650 ports | Not alpha-blocking, but it is the AI authoring loop's largest single input, and ALPHA-006 §1 makes it *visible* by putting the enrichment in the help panel |

---

## What is NOT on this list, and why

- **AI provider credit** — was the blocker on phase 38's remaining criteria. Phase 38
  closed on 2026-08-03, so treat this as discharged unless a run says otherwise.
- **A GitHub account for AIB-008 criterion 7** — discharged by `bf35a9f4`.
- **ALPHA-006 §1 being blocked on phase 30 Tier 1** — Tier 1 is complete
  (NDA-001/002/003/013). §1 is unblocked and running now.
- **ALPHA-007 Part A** — no prerequisites by design; it transmits nothing, so it does
  not inherit ALPHA-003's ALPHA-005 gate. Running now.
