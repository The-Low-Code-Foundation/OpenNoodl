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

### ~~A1. Apple Developer ID + notarisation credentials → ALPHA-002~~ ✅ DONE 2026-08-07

> **CLOSED.** All five secrets are set on the repository (`CSC_LINK`,
> `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`,
> added 14:16–15:51 on 2026-08-07). Both **v0.1.3 and v0.1.4 built signed and
> notarised**, first time, with no entitlement problems:
>
> ```
> • signing  file=dist/mac-arm64/NodeGX.app type=distribution
>            identityName=Developer ID Application: Osborne Solutions (…)
> • notarization successful
> ```
>
> The knock-on that was not obvious from this item: **macOS auto-update was
> blocked on exactly this.** Squirrel.Mac will not install an update to an
> unsigned app, so the whole in-app updater — built and wired since REV-007 — had
> never been able to do anything. It is live as of v0.1.4.
>
> Still open, tracked at **A2**: Windows. `WIN_CSC_LINK` is unset and no artifact
> has been past SmartScreen on a clean machine.
>
> The original write-up follows, for the record.

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
artifact rather than a failed job — deliberately, so a human sees it. ~~What is
missing is only the credentials.~~ The credentials are in place; this held for
exactly as long as it took someone to export the certificate.

Needed as GitHub repository secrets — **all present:**

| Secret | What it is | Status |
|---|---|---|
| `CSC_LINK` | base64 of a **Developer ID Application** `.p12` | ✅ set 2026-08-07 |
| `CSC_KEY_PASSWORD` | that `.p12`'s password | ✅ set 2026-08-07 |
| `APPLE_ID` | the Apple ID used for notarisation | ✅ set 2026-08-07 |
| `APPLE_APP_SPECIFIC_PASSWORD` | app-specific password for that Apple ID (or swap the workflow to an App Store Connect API key) | ✅ set 2026-08-07 |
| `APPLE_TEAM_ID` | the 10-character team ID | ✅ set 2026-08-07 (`Y35J975HXR`) |

⚠️ *"Ship unsigned for the alpha" is not the shortcut it sounds like.* Gatekeeper
blocks unsigned macOS builds outright. ALPHA-002 §3 allows a deliberate unsigned
release **only** if paired with `dev-docs/guidelines/INSTALLING-UNSIGNED-BUILDS.md`
linked from the download page — never discovered by the user. **Moot for macOS
now** (builds are signed and notarised, and that guide should *not* go in macOS
release notes any more), and the real cost of having taken that route is now
visible: it also silently disabled auto-update, which nobody connected at the
time. The warning stands for **Windows**, which is still in exactly this position.

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

### B2. F63 — the leaked GitHub OAuth client secret ✅ **Fully closed 2026-08-07**

**Code fixed 2026-08-06.** Richard's decision was the **device flow**, and it is
built: `src/main/src/github-device-flow.js` (the polling state machine, 19 tests),
`github-oauth-handler.js` (Electron wiring, no secret, no `noodl://github-callback`),
and `GitHubDeviceCodeDialog` (the user code, which the flow cannot complete without).
The handler is also excluded from the `files` allow-list now, so it no longer ships
as readable source alongside the bundle.

**Both remaining GitHub admin actions done, 2026-08-07:** the client secret was
regenerated and the old leaked one (`c45276fa80b0618de06e5e2b09c1019ca150baef`)
deleted, and **Enable Device Flow** is ticked. Nothing in NodeGX consumes the new
secret value — the device flow uses the client **id** only, which is public by
design, so nothing needed updating on the code side.

**Still owed:** one live pass — Connect from the version-control panel, check the
dialog shows a code, complete it on github.com, and separately press Cancel there
to confirm the refusal message differs from a timeout. Not attempted this session.

Related and unowned: **F64** — `GitHubTokenStore.ts`'s docstring claims Electron
`safeStorage` "OS-level encryption"; the code uses only `electron-store`'s
`encryptionKey`, a literal embedded in the app. The AI keys *do* use `safeStorage`,
so the two credential stores disagree. `PRIVACY.md` §8 documents the real behaviour.
Decide whether to converge them before or after alpha.

### B3. A8 — the publish target's name → ALPHA-002 ✅ **Done 2026-08-06**

**Decided: rename now, before the first tag.** `The-Low-Code-Foundation/OpenNoodl`
was renamed to `The-Low-Code-Foundation/NodeGX` (`gh repo rename`, old name now
redirects). `packages/noodl-editor/package.json`'s `build.publish.repo`,
`issueForm.ts`'s `ISSUE_REPO`, `legal-window.js`'s fallback doc link, the issue
template's contact link, the README badge and release-download link, and
`scripts/alpha-007/create-labels.sh`'s `REPO` var all updated to match, `e8a53c94`.
Deliberately **not** touched: the README's product-name prose and the sibling
`opennoodl-hosting.com`/`opennoodl-cloudservice`/`opennoodl-better-backend` repo
names — that is a separate content decision, already made in REV-007 (rename scope
was branding + packaging identity only).

### B4. Permission to create the issue labels → ALPHA-007 §6 (F72) ✅ **Done 2026-08-06**

**Decided: create both, plus the severity vocabulary.** `bash
scripts/alpha-007/create-labels.sh` run against the (now-renamed) repo. Nine labels
live: `needs-triage`, `node-library`, `severity:blocker/serious/annoying/cosmetic`,
`triaged`, `needs-info`, `cannot-reproduce` — verified with `gh label list`.
`gh issue list --label needs-triage` now returns a real (empty) queue instead of
failing by construction.

### B5. The content origin's disposition → ALPHA-006 §5 ✅ **Repoint done 2026-08-13 (it was a live 404, not a tidy-up) — repo strip + `getDocsEndpoint()` still owed**

`the-low-code-foundation.github.io/opennoodl-docs` is not a docs site — it is the
editor's **content CDN for seven payload types**, six of which are not documentation
(F71). Moving or archiving it silently empties the Library panel, the Learn lesson
list and the new-project template picker, with no error.

**Decision (Richard, 2026-08-07): the payload stays in its own repo, not the main
monorepo.** Measured first, not assumed — the repo is 518 MB today (grown from the
spec's 413 MB), of which **~336 MB is live payload** (`static/library` 217 MB,
`static/lessons` 87 MB, `static/projecttemplates` 32 MB) that the running app
actually fetches, and only ~174 MB (`static/docs` + `static/nodes`) is dead
documentation media that gets deleted regardless of where anything else lives.
Dragging 336 MB of zips into the main repo's git history would be permanent (no
git-lfs configured here) and pay a tax on every future clone and worktree,
forever — rejected on that basis. Reasoning also holds for the stated reason:
this repo is expected to take community-contributed templates and lesson
content over time, and a lighter, purpose-specific repo is an easier target for
that than the full engineering monorepo.

**Both GitHub admin actions done, 2026-08-07:**

1. ✅ `opennoodl-docs` renamed to `nodegx-content` (`gh repo rename`, old name
   redirects). `getContentEndpoint()` **not yet repointed** — see below.
2. ✅ GitHub Pages enabled on `NodeGX` for `docs-site/`, `build_type: workflow`.
   `.github/workflows/deploy-docs.yml` built (triggers on push to `main` +
   `workflow_dispatch`) and **already deployed live** on the same push that first
   synced `main` — see `main-was-never-synced-2026-08-07` in memory for why `main`
   needed syncing at all. Confirmed serving: `https://the-low-code-foundation.
   github.io/NodeGX/` → 200.

**What's left, in order:** repoint `getContentEndpoint()` at `nodegx-content` (now
safe — the old name still redirects, but the rename is done), then strip
`opennoodl-docs`'s old doc content per §4's migration table, then the Help Center
repoint. None of it is an engineering unknown; nobody has done the actual repoint
+ strip yet.

> **2026-08-13 — the repoint is done, and the sentence above was wrong about why
> it was safe.** "The old name still redirects" is true of `git` and the REST API
> and **false of GitHub Pages**, which follows no rename redirect at all. So the
> six payloads were not waiting on a repoint — they had been **hard 404 since the
> 2026-08-07 rename**: an erroring Library panel, an empty lesson list and an
> empty template picker, for six days, in the build going out as 0.1.7.
>
> The rename broke it a **second** way, independently. It re-ran Pages as a
> `legacy` build (`build_type: legacy`, source `main:/`), which publishes the repo
> tree verbatim — where the previous *Docusaurus* build flattened `static/**` up to
> the site root. The payloads are therefore one level down now, so the endpoint is
> `.../nodegx-content/static`, **not** `.../nodegx-content`. Note the API reads
> green throughout: `has_pages: true`, `status: "built"`. Only fetching a real
> payload path shows the 404.
>
> Proved by mirroring every call site's URL join against the live origin: **115 of
> 116 URLs 200** — all 29 prefabs and 26 modules, each one's index entry, zip and
> icon, plus `lessons/`, `tutorials/` and `projecttemplates/`. The single failure
> is `whats-new/feed.json`, which is **not** a regression: no `feed.json` has ever
> existed in that repo (`gh search code` → 0 hits) and `whats-new.ts` is written to
> treat an unreachable feed as a normal state.
>
> **The `/static` suffix is conditional and someone will trip on it.**
> `nodegx-content`'s `pages.yaml` still triggers a Docusaurus deploy on any push to
> its `main`. The next such push flips the published tree back and the suffix must
> come off in the same breath, or the Library panel breaks again identically.
> Deciding that — delete `pages.yaml` and keep the repo a dumb file tree, or
> restore the workflow build and drop the suffix — is the owed follow-up, and it
> should happen before anyone pushes to that repo.
>
> **`getDocsEndpoint()` still carries the dead `opennoodl-docs` origin**, so all
> four genuine docs links are 404: NodeLabel's "read more", the node picker's docs
> link, the MCP settings docs probe, and the library card's "Read docs". This is
> the "Help Center repoint" above and it is *not* a one-line change — the live
> `NodeGX` site serves `/NodeGX/docs/...`, which does not match the paths those
> call sites join (`nodeDocs.path`, `MCP_DOCS_PATH`, the index's
> `/library/prefabs/<slug>/`). It needs a path mapping, or those pages published at
> the paths that already exist. `EXTERNAL_LINKS.docs` *was* a clean one-liner and
> is now `.../NodeGX/`.

Not blocking ALPHA-006 §1, which is running now and works entirely off the bundled
catalog.

### B6. Verify the GitHub issue prefill by hand → ALPHA-007 §2 🔴 **Re-check needed — the first attempt found a different bug entirely**

> **2026-08-07: Richard ran the probe URL, already signed in, and got a completely
> blank issue form — not just empty dropdowns, the "What happened" textarea was
> blank too.** That is NOT the failure mode this item was written to catch (partial
> prefill on dropdowns specifically). Root cause: `origin/main` — the branch GitHub
> reads issue templates from — had **no `bug_report.yml` at all**, because `main`
> had never received any fork work since 2025-09-09 (see `main-was-never-synced-
> 2026-08-07` in memory; fixed the same session, PR #19 merged). GitHub silently
> fell back to the generic blank-issue form, which only recognises `title=`/`body=`
> and ignores every custom field id. **This item is unblocked again and needs a
> fresh run** — `bug_report.yml` is on `main` now, so the template itself should
> resolve; whether the four dropdowns actually honour their prefill values is still
> the open, original question.

**This one can change ALPHA-007's design, so do it early.** The composer builds a
prefilled `issues/new` URL against `bug_report.yml`'s field `id`s. Whether GitHub
actually honours a prefill into a **dropdown** (`surface`, `severity`, `os`,
`fresh-project`) cannot be checked without a signed-in browser session:
`issues/new` redirects to sign-in for any request without a session cookie, and no
`gh` API renders an issue form. Anonymous requests and an `Authorization: token`
header both return the login page.

Run `node scripts/alpha-007/prefill-probe.js`, open the URL it prints, and check the
eight points listed beside it. **If the dropdowns come back empty, the payload has to
move into the body and the field contract changes shape.**

> **Two corrections, 2026-08-06.** The script **now exists at `HEAD`** — it was on an
> unmerged branch until the ALPHA-007 merge (`80d221c0`), so anyone who tried this
> instruction before then found nothing and had no way to tell why.
>
> ~~And this item named four dropdowns... There is no `severity` field.~~ **Wrong,
> re-checked 2026-08-06 while running the probe for real.** `bug_report.yml` has
> **four** dropdowns, not three: `surface` (:26), `severity` (:53-56), `os` (:74) and
> `fresh-project` (:87). The `severity` field was added in `c57f729a` (ALPHA-007
> §2-§4, 2026-08-03) — the "only three" correction above was written the same day as
> the merge that made it wrong, on an unmerged branch it hadn't seen yet. Check all
> four dropdowns, including whether "Blocks me — I cannot work around it" (note the
> em dash) survives the prefill.

`node scripts/alpha-007/prefill-probe.js` run 2026-08-06 — it builds against the
renamed `NodeGX` repo correctly, payload is 1567 bytes (budget 6144). **Still needs a
human with a signed-in GitHub browser session to open the URL and confirm the
dropdowns actually land** — that part cannot be done headlessly (`issues/new`
redirects anonymous and token-authenticated requests alike to sign-in). Two minutes
of work, and it is the only thing standing between ALPHA-007 Part A and its
acceptance criterion 3.

### B7. Discord / Discussions — does either exist? → ALPHA-006 §6, ALPHA-007 ✅ **Answered 2026-08-06**

The Help Center's old "community Discord" and "support forum" links pointed at
**Noodl's**, not ours, so ALPHA-006 removed them rather than guess a replacement
URL. GitHub Discussions is also off (`has_discussions: false`, checked 2026-08-03).

> ⚠️ **This item's premise stopped being true on 2026-08-03 and it took three days to
> notice.** POL-002 (phase 39) put a Discord invite in the product:
> `packages/noodl-core-ui/src/constants/externalLinks.ts:82` is
> `https://discord.gg/dZw4w5pKf9`, and both the Help Center and the launcher footer
> link it. So the claim below — "no community channel of any kind" — is **wrong at
> HEAD**.
>
> **The question is therefore different, and smaller:** is that invite live, is it
> ours, and does it have anyone in it? A dead invite link in the Help Center of an
> alpha build is worse than no link, because a tester who clicks it concludes the
> project is abandoned rather than that the channel is elsewhere. GitHub Discussions
> is still off (`has_discussions: false`, 2026-08-03).

~~So NodeGX currently has **no community channel of any kind** in the product.~~ For an
alpha whose whole purpose is hearing back from testers, that is worth a deliberate
answer: confirm the Discord and staff it, enable Discussions, or accept that issues are
the only channel and say so in the Help Center.

**Richard confirmed 2026-08-06: the Discord invite is live and staffed.** No product
change needed — the Help Center and launcher footer links stay as they are.

⚠️ **New, found while resolving this item:** `.github/ISSUE_TEMPLATE/config.yml`'s
"Question or general discussion" contact link points at `.../discussions`, but GitHub
Discussions is still off (`has_discussions: false`). A reporter who clicks it hits
GitHub's "Discussions aren't enabled" page — the same bad experience B7 was written to
avoid for Discord, just on the other channel. Either enable Discussions or repoint that
link at the Discord invite / a discussion-shaped issue form. Unowned — not filed as an
F-number because it's a one-line config fix, not a mechanism defect.

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
| D4 | ~~**NDA-014 criterion 1** — a Function `object` output wired to a Text node renders `[object Object]`~~ | ✅ **Already fixed**, `461859be` (2026-08-02, the day after this row's own 2026-08-01 live check). Re-verified 2026-08-07: `packages/noodl-runtime/test/corpus/nda-014-outbound-string-cast.test.ts` (9 cases) passes clean on `cline-dev` HEAD. Another row that outlived its fix — see `registers-outlive-their-fixes` |
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
