# Phase 75 — next session

**State as of 2026-08-26 (session 48).** Richard's brief is still **speed: keep knocking out phase
75**, so this file leads with the queue.

**Landed this session:** queue item 1 — **the platform half of FB-005 is DEPLOYED.** That was the
blocker session 46 found by driving, it was blocking T2–T5 at once, and it is gone. Full record in
[FB-005-SCOPE.md](FB-005-SCOPE.md) §4e.

## ✅ What the deploy did, and how it was verified

`ops/deploy.sh 49.12.102.195`, run from a **pristine `git clone` of `27be4d1`** rather than the
working checkout. 🔴 **That method is load-bearing, not ceremony**: the script **rsyncs the working
tree**, a peer session was committing to this machine all evening, and the clean-tree refusal's
first-ever production catch was a peer's half-finished file. A clone satisfies the refusal
*honestly* instead of silencing it with `--allow-dirty`, and it makes the host's stamp true.

Migrations `0020_fb005_project_templates`, `0021_fb005_template_submissions` and
`0022_fb005_licence_on_the_shelf` applied (19 already applied) **before** the restart. Service
`active`, stamped `✅ 27be4d19a10b on main, dirty=false`, TLS 200, sign-in start 302 → github.com,
capture hosting ✅, off-site backup ok. **Neighbours `200 → 200`** on `nodegx.io`,
`nexus.digitalbricks.io`, `digitalbricks.io`. `EXIT=0`.

| route | s46 | s48 | |
|---|---|---|---|
| `/api/v1/community/threshold` | 200 | **200** | positive control — held |
| `/api/v1/community/templates` | **404** | **200** | T3's shelf |
| `/api/v1/community/templates/submissions` | **404** | **200** | T5's queue |
| `/api/v1/community/templates/does-not-exist` | — | **404** | 🆕 **negative** control |

🔴 **The last row is the one s46's table did not have, and it is what makes the two 200s mean
anything.** A catch-all answering 200 to everything under `/templates` produces the middle two rows
byte-identically. ⚠️ **A control has a direction**: a known-firing signal discriminates a *silence*,
never a *noise*. When a finding flips from "X is missing" to "X is there", the old control stops
being evidence — re-running the original probe and watching it go green feels like the same
measurement and is a weaker one.

⚠️ **Production had been `acd4a9a` since 2026-08-24** — a two-day gap. The deploy script prints
`==> what is live now` **before** it deploys, read off `/etc/nodegx-community/deployed.json`. That
line is a free answer to *"is this shipped?"* and running a deploy is not the only way to get it.

## 🔴 READ THIS FIRST: the blocker moved, it did not disappear

`/api/v1/community/templates` → `{"items":[],"page":{"total":0}}`. **The shelf is real and empty.**
*"The curated shelf is empty"* has stopped being a **deployment** fact and become a **content** one,
and the two want opposite work.

- `scripts/publish-project-template.ts` is the publisher, and it takes a **database credential** —
  promoting is deliberately not something a client can do.
- **Which of Richard's eight templates go up is his editorial call**, and it is *not* only a matter
  of him choosing: §4c already measured that **three of the eight have no honest category**
  (`pixel-game`, `interactive-fiction`, `shared-canvas`). So publishing is blocked behind the
  **category vocabulary gap**, which is a small concrete change to `TEMPLATE_CATEGORIES` — but a
  vocabulary is a decision, so it needs Richard.

✅ **No defect on the empty path.** `communityapi.templates()` returns `ok` with `items: []`, and
`PlatformTemplateProvider.list` throws only on **non-`ok`** precisely so that
`TemplateRegistry.list` keeps the embedded templates beside an unreachable community. An empty
shelf renders as *empty*, not as an error. Verified by reading, not assumed.

## The queue — cheapest-first. Take the top one.

| # | item | size | state |
|---|---|---|---|
| 1 | **Publish a curated batch** | **S–M** | 🧭 **needs Richard**: which templates, and the 3-of-8 category gap. This is what makes T3/T4/AC2 real for a user — the machinery is now live and holds nothing |
| 2 | **A binary-capable template transport** | **M–L** | 🆕 **measured, not speculative: 5 of 25 real projects still cannot be shared**, and the residue is the author's own `fonts/*.ttf` and `assets/*.png` — nothing can restore those. See §4e |
| 3 | **FB-013** chat | **L** | 🔴 **ruled 08-22: OVERRULED, build it.** ⚠️ Its corpus does not exist either — FB-014 measured the bench at **3 posts, 2 threads, 1,369 chars** |
| 4 | **FB-005 T6** — star ratings | **M** | 🔒 **still needs a ruling.** Its precondition is closer than it was — the queue is live — but nothing has been submitted yet |

⚠️ **AC5's last mile is unverified and deliberately so.** The share button was driven end to end in
s46 and reached a 404; the routes now answer 200, but **nothing has been POSTed through the live
path**. Doing so files a real row on Richard's production queue and there is no withdraw route, so
it was left for him to authorise. 🔴 **The GET probe cannot stand in for it**: an authorised and an
anonymous `GET /templates/submissions` **both** returned `200 {"items":[]}`, which looks like a leak
and measures nothing — the queue holds zero rows, so the empty set fits *"correctly scoped"* and
*"wide open"* equally. Settled by reading the route (the anonymous empty list is deliberate and
documented; the `submitter_account_id` predicate lives inside `listMyTemplateSubmissions`, not the
handler). **An authorisation probe over an empty collection is not an authorisation probe** — which
is exactly why AC5 specifies *from a second account*.

## ⚠️ Small, unowned, not deploy-related

- 🔴 **`nodegx-community`'s `origin/main` is ELEVEN commits behind local `main`.** Every FB-005
  platform commit, plus FB-001/002/003/010/011/023/024, exists **only on this laptop**. Not
  blocking; it is the same shape as the finding that produced the deploy stamp in the first place —
  *a fact that lives in exactly one place.*
- **`MEMORY.md` is ~19,320 UTF-16 units against a 17,510 budget** and was already 1,815 over at the
  start of this session. s48 left it 5 units *smaller* than it found it while adding two facts, but
  the overage is real and predates this session.

## Carried forward, unchanged

Everything in the s47 file that is not superseded above still holds — the five defects the s46
drive found (the `Select`-in-a-`Modal` dismissal, which is **`BaseDialog`'s and still UNOWNED**;
the document-global radio `name`; nested `.DS_Store`; the 44%-of-real-projects refusal and its
`RESTORED_ON_INSTALL` fix at 13/25 → 19/25; the `absent` sentence that blamed an account for a
deployment gap). Also still open: the three `0021` findings, the licence-at-promotion defect, the
contrast items (`--theme-color-border-default` at 1.07:1; FB-002's selected pill at 1.16:1), and
the share dialog's **693 px of content in a 525 px viewport**, which puts the licence question —
the most consequential field — below the fold.

## Gates — session 48

**None run, and none owed.** This session changed **no OpenNoodl source** — the work was a
deployment of a separate repository plus documentation. `npm run test:ci` was deliberately not run:
a peer session was building and committing phase 76 throughout, and the recorded rule is that
`test:ci` is only meaningful **run alone on the machine**. ⚠️ The s47 tail's test:ci debt, if any,
is inherited unchanged rather than paid here.
