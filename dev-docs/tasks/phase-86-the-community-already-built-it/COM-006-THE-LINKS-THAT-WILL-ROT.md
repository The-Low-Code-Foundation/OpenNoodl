# COM-006 — The three links that will rot

> ✅ **BUILT 2026-09-11 (session 2). AC1, AC2 and AC4 are closed; AC3 is closed on the licence and
> open on one courtesy ask.** All three links were still alive; all three payloads are recovered into
> [`corpus/external-payloads/`](corpus/external-payloads/PROVENANCE.md). Outcome and readings in §5.

🔴 **Time-sensitive, and nothing else in this phase depends on a live link.** Three of the 29
community entries contain no content at all — only a URL to a payload hosted somewhere we do not
control. Two are personal Google Drive files.

## 1. The person sentence

**The community's work survives the disappearance of the accounts that hosted it.**

## 2. What is at risk

| entry | link | what it is |
|---|---|---|
| Signup & Login template | Google Drive file | a whole project — *"all signup and login flows you could want… including reset password and some Sendgrid examples"* |
| Infinite scroll chat module | Google Drive file | a `noodl_modules` folder, hand-installed |
| Directus prefab | `github.com/The-Savvy-Tech/Directus-Prefab-for-Noodl` | a connector project, imported then cherry-picked |

⚠️ **The Google Drive links are the urgent ones.** A GitHub repo under an organisation is
comparatively durable; a personal Drive file disappears when one person tidies up, and takes the
only copy with it. The export Richard pulled contains the URL, not the file.

## 3. Acceptance criteria

✅ **AC1 — the three payloads are downloaded.** Into `corpus/`, beside the graphs, with a note of where
each came from and when. 🔴 **Do this first and separately from any decision about whether we want
them** — recovery is cheap now and impossible later, and the two questions have different deadlines.

✅ **AC2 — each payload is dispositioned.** Superseded / wanted / discarded, with the reason:

- **Signup & Login** is very likely superseded by the `auth-pages` prefab. ⚠️ Its own CSV note says
  the hosted backend it relied on *"was removed completely in the open source editor"*, so it may
  not even open. Check before assuming either way.
- **Infinite scroll chat** overlaps the `virtual-list` module but is not the same thing — upward
  pagination and scroll anchoring, which `virtual-list` does not do. The `Smooth scroll to bottom of
  a scrollable group` snippet in the same corpus is the companion piece.
- **Directus** is the real candidate. We ship Supabase and Xano prefabs; Directus is the obvious
  third and the community already built one.

🟡 **AC3 — the Directus licence and authorship are checked before anything is copied.** 🔴 It is
someone else's repository. Licence, attribution, and whether its author would rather contribute it
themselves — asked, not assumed. ⚠️ The same courtesy applies to every named creator in the corpus
CSV; several rows credit people by name, including *"Coded by the very helpful Johan Olsson from
Noodl"*.

✅ **AC4 — the corpus records what could not be recovered.** If a link is already dead, that is written
down rather than left as a URL that reads like a working one.

## 4. Why this is its own task

It is the only work in the phase with an external deadline, it is measured in minutes, and it
blocks the Directus decision entirely. Everything else here can wait; this cannot.

---

## 5. Outcome — session 2, 2026-09-11

### 5.1 AC1 / AC4 — recovery

**All three links were still alive. Nothing had rotted yet.** Fetched 14:17–14:19 CEST, stored
verbatim in [`corpus/external-payloads/`](corpus/external-payloads/) with URL, UTC timestamp, byte
count and sha256 for each in [`PROVENANCE.md`](corpus/external-payloads/PROVENANCE.md). AC4's list of
what could not be recovered is therefore **empty, and recorded as empty** — which is the reading AC4
wanted, not a reason to skip it.

Two things the recovery turned up that the task did not predict:

- **The signup zip contains a live `.git` directory** (1.4 MB of the 2.5 MB). The author zipped a
  working checkout, so that project's own history came along with it.
- 🔴 **The chat module's original source survived inside its own sourcemap.** The shipped bundle is
  14 KB of minified webpack output, but `index.js.map` still carried `sourcesContent` — so
  `ChatContainer.jsx` (5,237 bytes: the complete component *and* its whole node definition),
  `ChatContainer.module.scss` and `index.js` are all recovered, in
  [`chatcontainer-module-src/`](corpus/external-payloads/chatcontainer-module-src/). **A minified
  community bundle is worth checking for a sourcemap before anyone decides it is unreadable.**

### 5.2 AC2 — the dispositions

#### Signup & Login template → **SUPERSEDED.** Measured, not assumed.

The task said *"very likely superseded by the `auth-pages` prefab"*. It is superseded by **three**
prefabs, and the cloud half is not merely similar — it is the same artefact:

🔴 **The template's 12 `/#__cloud__/…` component names are an identical set to
`library/prefabs/email-verification`'s 12.** Not a subset, not an overlap — `A == B`. Six of the
twelve match on node count *and* connection count as well; in the other six **ours is the larger**
(e.g. `Send Verification Email` 8 nodes/10 connections there, 9/14 here). Our prefab is the evolved
descendant of this template, so there is nothing in its cloud half to take back.

The client half falls to prefabs we already ship: Log In / Sign Up / Forgot Password / Reset Password
→ `auth-pages`; Show Toast and its four variants → `toast`; Loading Spinner → `progress-circle`;
Profile Image Component → `avatar`.

⚠️ **The task's warning that the template "may not even open" rests on a misread, and it matters.**
The CSV note says the hosted backend *"was removed completely in the open source editor"* — what was
removed was Noodl's **hosted SaaS backend**, not cloud functions. Cloud functions are a live, shipped
surface: `library/prefabs/email-verification` ships twelve `/#__cloud__/` components today, and
`noodl-viewer-cloud` builds. So the template would open fine. **It is superseded on merit, not dead
on arrival** — and a task that had assumed "dead" would have thrown away the one finding below.

🔴 **The residue is one page, and it is a real hole.** `auth-pages` has four pages — Sign In, Sign Up,
Forgot Password, Reset Password — and **no Verify Email page**. Searching every `project.json` under
`library/`, the only `Verify Email` components we ship anywhere are cloud-side
(`email-verification`'s two, plus `totp`'s Verify Token). **We ship the server half of email
verification and nothing for the link in the email to land on.** The community template has that
page. That is the single thing worth taking from this payload, and it belongs to whoever next touches
`auth-pages` — **not to this phase**, which does not own the shelf.

#### Infinite scroll chat module → **WANTED for COM-005 — and the task's description of it is wrong.**

It is **one React node**, `noodl.controls.chat-container`: one signal input (`Scroll To Bottom`) and
five outputs (`At Bottom`, `Scroll Position`, `Scrolling`, `Scroll Start`, `Scroll Stop`). The
mechanism, read from the recovered source: a flex column with `justify-content: end`, a sentinel
`<span>` at the bottom, and a `ResizeObserver` that calls `scrollIntoView` on it **only while the
user is still tracking the bottom** — tracking being re-derived on every scroll from
`scrollTop + clientHeight + 1 >= scrollHeight`, the `+1` there because `scrollTop` can be half a pixel
short and never reach the bottom.

⚠️ **AC2 called it "upward pagination and scroll anchoring". It does the anchoring and no pagination
at all** — there is no page counter, no fetch, no prepend, no scroll-offset restoration. Paging is
graph-side, driven by the `Scroll Position` and `At Bottom` outputs. Judge it as a *scroll-anchoring
and scroll-telemetry* node.

That also settles the overlap question in the other direction: `virtual-list` is **windowed rendering
at a fixed row height**, rows absolutely positioned over a spacer. Chat bubbles are variable-height,
so the two do not compete — and neither one does what the other does. **Complementary, not
duplicative.** ⚠️ Note before anyone ships it: it is a **2024-era webpack bundle**, and whether it
builds against today's `@noodl/noodl-sdk` is unmeasured. The recovered source is what to build from.

#### Directus prefab → **WANTED. The licence permits it; the courtesy ask does not.**

> 🔴 **Session 3 correction, found while building COM-002 — read this before acting on the paragraph
> below.** We do not start from nothing on Directus, and the case for copying a community prefab is
> much weaker than this task assumed. `packages/nodegx-backend-contract/src/descriptors/directus.ts`
> already exists and its own header calls Directus **"the best-evidenced third-party descriptor,
> because Directus is the backend this repo has actually stood up and driven"** — introspection and
> runtime CRUD probed against a live Directus 11 in RUN-003, aggregation, distinct and search in
> BCN-001. So Directus is not a missing connector; it is a backend we already speak, with better
> evidence behind it than Parse. **What the community prefab adds is a Noodl-era project-level
> connector and some UI, which may be entirely superseded.** Measure that before asking its author
> for anything — the courteous question is a different one if the answer is "thank you, we already
> have this".


Confirmed as the obvious third connector beside `supabase` and `xano` — `library/prefabs/` has no
Directus entry. **BSD 3-Clause**, `Copyright (c) 2024, arladmin`, organisation-owned, last pushed
2024-10-10, not archived. BSD-3 permits redistribution and derivatives on the standard terms, so
storing the archive is already compliant. **Its third clause forbids using the holder's or
contributors' names to endorse or promote a derivative** — a NodeGX Directus prefab must not be
presented as "the Savvy Tech prefab".

🔴 **This is what keeps AC3 at 🟡.** The licence question is closed; AC3's *other* half — whether the
author would rather contribute it themselves — is a question only Richard can put, and the answer
changes what gets built. The repo's README sells a commercial *"Boilerplate Kit"* built on this
prefab, so the author has a live interest in it. **Ask before building a derivative.** Full reading in
[`PROVENANCE.md`](corpus/external-payloads/PROVENANCE.md).

### 5.3 The attribution sweep, measured

AC3 also asks for the same courtesy toward every named creator in the corpus CSV. The CSV has a
dedicated `Creator credits` column, so this was read from the column, not from prose:
**6 of 29 rows are credited and all six name Richard Osborne.** Exactly **one** third-party creator
is named anywhere in the file, and it sits in `Notes`: *"Coded by the very helpful Johan Olsson from
Noodl"*, on **Multiple dropdowns with filtered results**. The remaining 22 rows carry no attribution.

⚠️ AC3 said *"several rows credit people by name"*. Measured, it is one. The attribution burden on
this corpus is far smaller than the task assumed — **but Johan Olsson's name travels with that
snippet wherever COM-002 takes it.**
