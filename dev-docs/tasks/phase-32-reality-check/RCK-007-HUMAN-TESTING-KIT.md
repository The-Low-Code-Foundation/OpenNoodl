# RCK-007: The Human Testing Kit — Link, Consent, Briefs

## Metadata

| Field | Value |
|-------|-------|
| **ID** | RCK-007 |
| **Phase** | Phase 32 — Reality Check (Track Q) |
| **Tier** | 3 — humans |
| **Priority** | 🔴 Critical |
| **Difficulty** | 🟠 Medium–High — the consent and masking half is the part that can go legally wrong |
| **Estimated Time** | 2–2.5 wks |
| **Prerequisites** | RCK-006; DEP-002/DEP-003 for a real URL (preview-only otherwise) |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** |

## Objective

Lower the cost of getting five humans to test an app from *"organise a study"* to *"send five people a
link"* — with consent handled properly and no chance of capturing a stranger's personal data.

## Background

The synthetic round removes the excuses. This task removes the *work*, which is the thing that actually
stops people once they have run out of excuses.

Two blockers, both concrete:

1. **"I don't know five people."** The barrier is not really acquaintance; it is that asking feels like
   asking a favour proportional to the effort involved. A link that works on their phone with no
   install, no account and a five-minute brief is a WhatsApp message. A "usability study" is not.
2. **"What would I even ask them to do?"** The builder does not know how to write a task that does not
   lead the witness. This is precisely Richard's coaching expertise, and it can be generated: NodeGX
   reads the graph and the journeys and proposes tasks phrased as outcomes.

The control-panel chapter's `USER_JOURNEYS.json` had the right instinct — *"rendered as interactive
pass/fail checklists. Failed steps generate a Cline-ready bug report with full context"* — but aimed at
the builder testing their own app. This aims it at strangers, which changes everything about consent.

## Current State

| Piece | State |
|---|---|
| A real URL | DEP-002 (local full-stack), DEP-003 (Netlify/Cloudflare) — Phase 26 |
| Session record | RCK-005, source-agnostic by design |
| Observer view | RCK-006, awaiting sessions to watch |
| Findings | OPS-003, with `ops/redact.ts` for the redaction policy |
| Consent, masking, anything user-facing | nothing |

## Desired State

### 1. The tester link

A share link into a deployed or previewed app in **session mode**:

- opens on a phone, no install, no account, no NodeGX knowledge required
- a consent screen first (§3), then the brief (§2), then the app
- records the session in RCK-005's format
- expires, and is revocable

Where the app has auth, session mode must be able to hand the tester a scratch account — otherwise the
first thing five strangers hit is a sign-up wall and the test measures the sign-up wall. (Which is
sometimes the point; make it a choice, not an accident.)

### 2. Task briefs, generated

From the graph and the journeys, the AI proposes 2–3 tasks, phrased as outcomes:

> ✅ *"Book a session with a coach for next week."*
> ❌ *"Click Browse Coaches, then pick one, then click the blue Book button."*

Same rule as RCK-001's `intent`, same enforcement, same reason: the second phrasing leads the witness
and measures nothing. The builder edits; the generator establishes the register.

Plus the **observer script** — Richard's coaching, in the product, at the moment it is needed:

> Sit beside them. Say nothing. Press the button when you want to speak. If they stall completely, ask
> *"what are you trying to do right now?"* — never *"have you tried the menu?"*

### 3. Consent, and it is not a checkbox

The one part of either phase that can go legally wrong rather than merely badly. Built from the first
commit:

- a plain-language screen before anything is recorded: what is captured (screen, clicks, timings), what
  is not (camera, microphone, keystrokes in masked fields), who sees it, how long it is kept
- explicit start, and a **stop-and-delete** control visible throughout the session
- no dark patterns, no pre-ticked boxes, no continue-implies-consent
- the consent text is versioned and stored with the session, so what someone agreed to is recoverable

### 4. PII masking, by default and by construction

A stranger will type their real name, real email, and possibly a real card number into your app.

- **All form input values are masked at capture** — recorded as type and length, never as content.
  Unmasking is per-field, opt-in, and requires the field to be marked non-sensitive by the builder
  *before* the session.
- Screenshots are captured with input contents obscured at render time, not blurred afterwards. A
  blur applied post-capture means the unblurred frame existed.
- Anything auth-related is never unmaskable.
- Reuse `ops/redact.ts`'s rules rather than authoring a second policy that will drift from it.

### 5. Sessions with and without an observer

- **Observed** — RCK-006's live view, the highest-value mode, and the one the brief encourages.
- **Unobserved** — the link works alone; no live view, no help-button findings, and the report says so.
  Fewer findings by design, and better than nothing, which is what most people will actually manage.

### 6. Team members do not count

The gate (RCK-008) counts *human sessions by people not on the team*. This task supplies the honest
signal, not a defence:

- an attestation at session end: *was this person involved in building the app?*
- obvious duplicate detection (same device, same session, immediate repeats)
- and, in the UI, the plain sentence: **this gate only protects you from yourself**

No anti-gaming machinery beyond that. It is a phase decision and it is deliberate: engineering against
someone determined to cheat costs more than it saves and insults everyone using it honestly.

### 7. Round two exists

RCK-008's gate requires *change and re-test*, not just test. So a round is a first-class object: its
prediction (RCK-006), its sessions, its findings, and — for round two — a fresh prediction and
different testers. The kit must make starting round two obviously easy, because that is where the
winners separate.

## Implementation Steps

1. **Consent and masking first.** Not last. The rest of the task is built on top of a capture path that
   is already safe.
2. Session-mode link: expiry, revocation, scratch accounts where auth exists.
3. Brief generation with outcome-phrasing enforcement + the observer script.
4. Observed and unobserved modes.
5. Rounds, and the round-two path.
6. Attestation + duplicate detection + the honest sentence.
7. **Live pass**: five real people, on their own phones, on a real deployed URL, at least two observed.
   Confirm no PII reached storage — **grep the session store for the tester's own email and name.**

## Success Criteria

- [ ] A link opens on a stranger's phone, with consent, brief, and app, with no install or account.
- [ ] Consent is explicit, versioned, stored with the session, and revocable mid-session with deletion.
- [ ] Form values are masked at capture; screenshots obscure inputs **at render**, not after.
- [ ] A grep of the session store for a real tester's name and email finds nothing — run for real.
- [ ] Briefs are outcome-phrased; the generator refuses instruction-phrasing.
- [ ] Observed and unobserved modes both produce records, and the report states which.
- [ ] Rounds exist; starting round two with a new prediction is obvious and quick.
- [ ] The "protects you from yourself" sentence is in the UI.
- [ ] Five real human sessions completed and recorded.

## Out of Scope

- **A tester marketplace or recruitment panel.** Phase decision. Scope is your own recruits.
- **Incentives, payments, scheduling.** Not ours.
- **Camera, microphone, or facial expression capture.** Deliberately never. It changes the consent story
  and the value is in the screen and the presses.
- **Cross-project or aggregate benchmarking.** ECO-004, gated on G3.
- **Accessibility auditing with real assistive tech users.** Enormously valuable, an entirely different
  consent and recruitment problem, and it deserves its own task rather than a footnote here.

## Traps

- **Masking added later is masking that failed once.** The first unmasked session is a real person's
  real data in a project folder that gets zipped and emailed. Build the capture path masked and never
  ship an unmasked one behind a flag.
- **Post-capture blurring is not masking.** The unblurred frame existed, was written somewhere, and may
  be in a temp file. Obscure at render.
- **A scratch account is a live account.** If session mode hands out credentials, they can reach real
  data. Scope them, expire them, and make sure BAK-003's CLPs apply to them like anyone else.
- **The consent text will be written once and never versioned.** Then it changes, and you cannot say
  what any historical tester agreed to. Version from the first commit.
- **Expiring links are security, not tidiness.** A live tester link is an unauthenticated door into a
  pre-release app, indexable if anyone shares it. Expire by default and short.
- **Brief generation will drift into instructions** exactly as RCK-001's `intent` does, and here the
  cost is a test that measures nothing while appearing to have gone well.
- **Unobserved sessions will become the default** because they are easier, and they produce far fewer
  findings. The kit should make observed the recommended path in wording and in flow — without blocking
  the easier one, which is still much better than nothing.
</content>
