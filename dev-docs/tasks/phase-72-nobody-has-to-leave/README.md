# Phase 72 — Nobody Has To Leave

**Created:** 2026-08-19, out of a review conversation with Richard on the community surfaces
shipped by UNI-011 (session 37). **Prefix:** `NAT`.
**Surfaces:** `editor`, `core-ui`, `design-tokens`, `platform` (`nodegx-community`).

> **The concept, in one sentence.** NodeGX's whole promise is that development is **local** — so a
> community you can only *read about* in the editor and must *participate in* through a browser is
> the promise leaking; this phase makes the community a native client of the editor, and makes both
> it and the editor stop looking like a terminal at 2am.

Richard's words, which are the phase's acceptance bar:

> *"I had expected that we'd have a native interface in the launcher such that nobody would in
> theory ever have to leave it."* — and — *"the fucking thing just bumps you out to the browser
> page. Can we please scope that whatever you do in the editor can be viewed and solved in the
> editor."*

---

## 1. What is actually there today, measured

Three findings, and none of them is the one the review started from.

### A. It is not "too dark". The default body colour fails AA — in **both** themes.

`--theme-color-fg-muted` resolved out of the canonical
[`colors.css`](../../../packages/noodl-core-ui/src/styles/custom-properties/colors.css):

| pair | dark | light | AA (4.5) |
|---|---|---|---|
| `fg-muted` on `bg-1` | **3.93** | **3.62** | ✗ both |
| `fg-muted` on `bg-2` | **3.66** | **3.43** | ✗ both |
| `fg-muted` on `bg-3` | **3.17** | **3.16** | ✗ both |
| `fg-default-shy` on `bg-1` | 5.98 | 5.34 | ✓ |
| `fg-default` on `bg-1` | 8.26 | 7.49 | ✓ |
| `primary` on `bg-1` | 6.92 | 4.57 | ✓ (dark is fine — see trap) |

And [`Community.tsx`](../../../packages/noodl-core-ui/src/preview/launcher/Launcher/views/Community.tsx)
declares `const shy = { color: 'var(--theme-color-fg-muted)' }` and then uses it for **the viewer
line, all four empty states, every health readout and the error text**. Nearly every word on that
page is sub-AA grey. That is the "sad", and it is a token choice, not a mood.

### B. The site already fixed this — and fixed it by leaving the shared palette behind.

`nodegx-community` vendors the editor's `colors.css` verbatim (`npm run tokens:sync`, drift-tested
by `tests/uni013-token-drift.test.ts`). But its `globals.css` defines its own
`--site-fg-secondary: var(--theme-color-fg-default-shy)` and points every piece of secondary copy
at *that*, because — in its own words — pointing them at `fg-muted` failed "AA's 4.5:1 for
normal-size text, on the lede of every page". It then **gated it**: `tests/uni013-contrast.test.ts`
asserts ~30 named fg×bg pairs at 4.5:1, in both themes.

🔴 **So the site is protected and the editor is not.** The launcher's Community tab looks worse
than the same content on the web *because it uses the raw token the site refused to use*. UNI-013
existed to make one palette serve both surfaces; what actually happened is one surface routed
around the palette and took its gate with it. Fixing this upstream is NAT-001/002.

### C. People, jobs, coaching and University are not missing from the UI — they are missing from the API.

The platform has **19 pages** (`/people`, `/rfps`, `/coaching`, `/university`, `/tutorials`,
`/orgs`, `/u/[handle]`, …) and **15 API routes**, and the editor's mirror is built entirely from
`/v1/community/home` + `/v1/community/threads`. There is **no endpoint at all** for people, RFPs,
coaching, University, tutorials-as-a-list, replays-as-a-list, orgs or profiles.

The launcher shows three sections because three is all the editor can see. This was not a scoping
oversight in the launcher — it is a missing contract, and it is why the review felt like something
had been left out. NAT-006 is the task that closes it, and every Tier-3 task depends on it.

### D. Every community action in the editor is `openExternal`. All of them.

- [`ProjectsPage.tsx:1325-1328`](../../../packages/noodl-editor/src/editor/src/pages/ProjectsPage/ProjectsPage.tsx) — thread, article, replay, and the community itself
- [`CommunityPanel.tsx:58`](../../../packages/noodl-editor/src/editor/src/views/panels/CommunityPanel/CommunityPanel.tsx) — the rail panel's only navigation verb
- [`AskAboutNodeDialog.tsx:353`](../../../packages/noodl-editor/src/editor/src/views/DialogLayer/components/AskAboutNodeDialog/AskAboutNodeDialog.tsx) — you ask from the editor, and are shown the door

Not one community object can be read to its end inside the editor. A thread's *title* is in the
editor; its *answer* — the thing you needed — is in Chrome.

---

## 2. The four principles

Acceptance criteria in every task, not sentiment.

**P1 — Read it and answer it, in the editor.** A task ships when the thing it mirrors can be
*completed* in the editor, not previewed there. Rendering a title and handing off is the failure
this phase exists to end. "Open in browser" survives as a footnote on every surface — never as the
mechanism.

**P2 — One palette, one gate, both surfaces.** The fix lands in the canonical `colors.css` and
reaches the site, the launcher and the editor together. A surface that needs a local override has
found a palette bug — file it upstream instead. Every fg×bg pair either passes 4.5:1 (3:1 non-text)
in **both** themes or is not shipped, and that is enforced by a spec, not a screenshot.

**P3 — Local-first behaviour, not just local-first marketing.** The community is a remote resource
in a tool that promises local development. Every surface states what it does with no network:
what is cached, what is stale, what is simply unavailable — and none of them may present an outage
as an empty community. UNI-011 already paid for this once (`loading` is its own case precisely so
a 300ms fetch does not render "no discussions yet").

**P4 — The security posture is not negotiable for a nicer UI.** The editor's main window runs
`nodeIntegration: true, contextIsolation: false` ([`main.js:406-408`](../../../packages/noodl-editor/src/main/main.js)).
Remote community HTML in that window gets Node. Native rendering over JSON is the default; where a
webview is genuinely the answer it is a *separate, sandboxed* surface on the
[`legal-window.js:278`](../../../packages/noodl-editor/src/main/src/legal-window.js) precedent
(`sandbox: true`), and it is argued in the task, not assumed.

---

## 3. Prior art — read before starting

- **P67 / UNI-011** built what is there now (rail entry, four sections, threshold-as-readout).
  🔴 **D21 reversed D16 on 2026-08-19**: the tab ships even when empty. This phase inherits that
  and must not re-add a gate. The view model is owned by
  `noodl-core-ui/.../Launcher/views/Community.tsx` and imported *by the editor* — the odd-looking
  path is deliberate (core-ui cannot import the editor). Keep it one model; two would be the defect.
- **P67 / D15 — the hidden viewer.** `surface: 'hidden'` must draw **nothing** — not a message, not
  an empty state. An org-minor whose school switched the community off is answered with a 404 so
  that *a pupil is not told a door exists*. 🔴 Every new surface in this phase inherits D15, and
  the **known remainder** is that the rail *icon* is still drawn for that viewer
  (`SidebarModel.register` is synchronous at setup, no async predicate,
  [`router.setup.ts:262`](../../../packages/noodl-editor/src/editor/src/router.setup.ts)).
  🔴 **Moved into this phase 2026-08-19 as NAT-012 AC7** — the task whose whole job is auditing
  every door was previously forbidden from closing this one, which is ledger tidiness buying a
  worse product. An icon is a door.
- **Phase 67b** keeps: UNI-017 (triage), UNI-006/007 (the assignment bridge), UNI-008 (hosting),
  UNI-010's remainder, UNI-012 (F4 on a packaged install), E7's capture-upload half, and 🔴
  **off-host backups**. Where a NAT task would answer one of those, it says so and defers rather
  than forking it. **Two items left 67b for this phase** — the mail drainer (NAT-014) and
  pull-a-graph (NAT-015) — each because a phase-72 acceptance criterion depends on it.
- 🔴 **Measured 2026-08-19, and in neither phase's notes before today: no mail leaves the
  platform at all.** `drainOutbox` is written, thoroughly tested against a real database, and
  **imported by exactly two files, both tests** — no route, no npm script, no systemd unit. The
  relay queue `outbound_emails` has no drainer *and* no transport, pinned to an unregistered
  domain. 67b's README records D19 as *"met for the Bench"* on the strength of a transport
  existing; a transport is not a delivery. **[NAT-014](NAT-014-THE-QUEUE-THAT-NOTHING-EMPTIES.md)**
  owns it and must amend the P67 ruling record.
- **UNI-013** owns the token-sync machinery. Any change to `colors.css` here must be followed by
  `npm run tokens:sync` in `nodegx-community` **and** a re-run of its drift test, or the site
  silently keeps the old palette.

---

## 4. Rulings queue — OPEN as of 2026-08-19

Richard settled four in the opening conversation. **D9 is now settled and D11/D12 were added and settled with it**; **D5 was settled on 2026-08-20**, so **four remain** (D6, D7, D8, D10) — D10 was added on 2026-08-19 with NAT-014.

**Settled 2026-08-19:**
- ✅ **D1 — Fix the shared tokens.** Not a community-scoped override. The whole editor changes
  appearance and that is accepted; it buys AA across the product. (NAT-002, NAT-003.)
- ✅ **D2 — The site follows the OS and falls back to *light*.** Dark stays available and stays
  the no-JS fallback; a first-time visitor whose OS says nothing gets the bright page. (NAT-004.)
- ✅ **D3 — Native, read *and* reply.** Not read-only, not a webview. Build the missing API and a
  native client. (NAT-006 through NAT-011.)
- ✅ **D4 — All four surfaces are in scope**: people/profiles, jobs/RFPs, coaching, University.
- ✅ **D9 — `fg-muted` is RETIRED**, not raised and not kept-and-forbidden. It is now an alias of
  `--theme-color-fg-default-shy`, so the ~217 `color:` declarations that name it keep working and
  all of them get AA. The *value* it held is not lost: `fg-disabled` and `border-control` now carry
  `neutral-600` deliberately, and those were the two jobs it was doing that were correct.
  ⚠️ Richard chose this over the README's own recommendation (raise it, keep the step), accepting
  that the "quieter than shy" step disappears. (NAT-002 — **done 2026-08-19**.)

**Settled 2026-08-19, second round — raised by NAT-001's measurements, not by the review:**
- ✅ **D11 — The accent splits into a fill role and a text role.** `--theme-color-primary` is 4.03:1
  on bg-0, 4.33 on bg-2 and 3.99 on bg-3 in **light** — every ground the editor paints links on —
  while clearing everything in dark. `--theme-color-fg-accent` is the text half: `primary` in dark
  (no split needed, and one would have collided with `primary-highlight`, which is a link's hover)
  and `#0e5fd0` in light, the value `nodegx-community` had already proved as `--site-fg-accent`.
  🔴 This was NOT in the review's scope. It is independent of `fg-muted` and no amount of fixing
  `fg-muted` would have touched it. (NAT-002 — **done**; ~99 files still paint words with the fill
  role and are queued, see NAT-002's remainder.)
- ✅ **D12 — The status colours split the same way.** `success` is 3.81:1 in light on bg-2 and
  `danger` is 4.46:1 in **dark** on bg-4 — the composer's sign-in error, on the ground every
  dialog paints. `--theme-color-fg-success` / `-fg-notice` / `-fg-danger` are the text halves, one
  step along the existing ramps; the fill roles keep their values and their jobs. ⚠️ In dark,
  `fg-success` and `fg-notice` deliberately equal their fills, because those already read — the
  spec asserts the *conditional*, not a difference, so a correct answer is not rejected.
  (NAT-002 — **done**.)

✅ **D5 — settled 2026-08-20. The editor gets the same session scope as the browser.** A
device-flow token *is* a session; the editor posts exactly as the web does, with no re-consent step
and no second, narrower grant. ✅ **The measurement this was ruled on:** the platform already
accepts the editor's bearer token on `POST /api/v1/bench/threads/:id/posts` — `apiViewer` reads
`Authorization: Bearer` and `answerThread` asks nothing further — so D5 was never a capability
question. ✅ **The follow-up the ruling created is DONE — 2026-08-20, s10, `eb563f4`.** The device flow's
consent copy was authored for identity and now authorises writes; `/auth/device` states the scope
(the browser's reach, no more) rather than a list of verbs that NAT-009/010 would make stale.
🔴 **And it states what nobody had written down: the grant can only be ended from the editor.**
`SESSION_TTL_SECONDS` is 30 days and this platform has no account page, no session list and no
web-side revoke — so a lost laptop holds a 30-day write credential that cannot be reached. The spec
asserts that absence, so adding `/account` later fails the test rather than quietly falsifying the copy. 🔴 **It does not widen anything else.** Same scope as the
browser means exactly the browser's scope: a write the web refuses this account, the editor is
refused too, and D15 is unchanged. **Unblocks NAT-007 AC4/AC6/AC7-second-direction, NAT-006 AC5,
and the write halves of NAT-009 and NAT-010.**

**Open — each blocks the task named:**
- 🔴 **D6 — How much long tail stays browser-only?** Orgs, assignments, shelf items and the admin
  surfaces are 8 of the 19 routes and none was named in the review. Recommendation: leave them on
  the web behind an explicit "this opens in your browser" affordance, and say so in the UI rather
  than silently. **Blocks NAT-012's navigation model.**
- 🔴 **D7 — Moderation in the editor.** If people can post from the editor they can post badly
  from the editor. Report/flag/delete-own — which of these ship, and does the editor need to render
  a moderation state at all? **Blocks NAT-007's post rendering.**
- ⚠️ **D8 — Caching policy.** What persists to disk between editor sessions, where, and for how
  long — this is user data on a local-first tool and it is a privacy decision, not a perf one.
  **Blocks NAT-013.**
- 🔴 **D10 — Does the double-blind relay survive v1?** `outbound_emails` is pinned by trigger to
  `relay.nodegx.dev`, an unregistered domain, and UNI-004's design needs *inbound* mail for
  double-blind replies. Three options: register the domain and build inbound; keep the relay
  outbound-only with replies through the site (v1's stated ruling); or retire the relay and route
  everything through `notification_deliveries`, deleting `notify()`'s `'relayed'` outcome with it.
  🔴 The third is the only one where a person is never told they were emailed when they were not.
  **Blocks NAT-014 AC4**, and shapes NAT-009 and NAT-010.


---

## 5. What this phase is not

- It is not a redesign of the community *site's* information architecture. The 19 routes stay.
- It does not move the community into the editor's process. It is a client; the platform is the
  system of record.
- It does not close phase 67b. Where the two touch, 67b keeps ownership — **except for the two
  items formally moved here on 2026-08-19** (NAT-014, NAT-015) and the rail icon (NAT-012 AC7),
  which are struck from 67b's ledger rather than tracked in both places.
