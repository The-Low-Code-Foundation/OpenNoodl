# ALPHA-003: Find out when it breaks

## Metadata

| Field | Value |
|-------|-------|
| **ID** | ALPHA-003 |
| **Phase** | Phase 33 — Alpha Launch (Track R) |
| **Tier** | 2 — makes the alpha worth running |
| **Priority** | 🟠 High — without it, shipping teaches us nothing |
| **Difficulty** | 🟡 Medium — the policy decision is harder than the code |
| **Estimated Time** | 1 week |
| **Prerequisites** | ALPHA-005 (a privacy policy must exist before anything is transmitted) |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Fable 5** for the what-do-we-collect decision, then 🟢 Sonnet 5 for the plumbing |

## Objective

When NodeGX breaks on someone else's machine, we find out — and they can tell us
without leaving the app.

## Current state, measured 2026-07-30

- **No crash reporting.** No Sentry, no Bugsnag, no `crashReporter`. The only
  matches in the tree are inside gitignored webpack bundles (Electron's own).
- **No log file.** `app.getPath('logs')` is never used; `userData` is used once, for
  `editorSettings.json`. A packaged user who hits a bug has literally nothing to
  attach, which is why `ALPHA-003`'s sibling — the bug-report issue form — has to
  tell them that explicitly rather than asking for logs they cannot produce.
- **No in-app feedback path.** No "report a problem" anywhere in the UI.
- **`mixpanel-browser` was a declared dependency with zero call sites**, and its tree
  pulled in `@mixpanel/rrweb` — DOM session recording — so packaged builds shipped a
  session-replay library that collected nothing. Removed 2026-07-30 (`359bd8f5`).
  Noted here because it is the shape of the mistake to avoid repeating: a
  disclosure obligation with no benefit.
- The **only** existing telemetry is AIX-002's opt-in, local-first G2 signal.

## The decision that comes first

**What do we collect, and does it leave the machine by default?**

This is a Fable-tier call because it is expensive to reverse: the answer becomes a
promise in the privacy policy, and walking it back later is the thing users
legitimately resent. The options, honestly stated:

| | Collected | Leaves the machine | Cost |
|---|---|---|---|
| **A. Local only** | Crash dumps + a rolling log, on disk | Never — the user attaches them to an issue | Cheapest, most honest; we only learn from people who bother to report |
| **B. Opt-in remote** | Same, plus stack traces | Only after an explicit yes | Matches AIX-002's existing local-first precedent |
| **C. Opt-out remote** | Same | By default | Most data, worst fit for a product whose pitch includes not being surveilled |

**Recommendation: A now, B as the immediate follow-up.** A log file the user can
find is most of the value of crash reporting and carries none of the policy weight —
and it unblocks the bug-report form, which currently has to apologise for its
absence. Do not build C.

Whatever is chosen, it must match what the privacy policy says, and the policy is
ALPHA-005. Neither ships without the other.

## Scope

### 1. A log file that exists and that a user can find

Write to `app.getPath('logs')`. Rolling, size-capped, no project content and no
absolute paths beyond the project root — a log a user is willing to paste into a
public issue is worth more than a complete one they will not.

Renderer exceptions must reach it. The dev loop already mirrors renderer console
into main stdout and writes uncaught exceptions to `.logs/dev.log` (REV-008); this
is the same idea for packaged builds, where there is no terminal to mirror into.

### 2. `Help → Open log folder` and `Help → Report a problem`

The log is worthless if finding it requires knowing what `getPath('logs')` resolves
to on three platforms. "Report a problem" opens the GitHub issue form with version,
OS and architecture pre-filled — the three fields that are both essential to triage
and most likely to be wrong when typed from memory.

### 3. Electron's `crashReporter` for native crashes

A renderer that dies takes the JS error handler with it, so native crash dumps are
the only record of the worst class of failure. Local-only under option A: dumps land
in `crashDumps` and the Help menu can reach them.

### 4. Make the absence of a provider a first-class state, not a crash

Related and cheap while in here: the AI panels' no-provider path is one of
ALPHA-001's checks. A user with no API key is the *default* alpha user, and "the
panel throws" is a bad first impression that no amount of crash reporting improves.

## Acceptance criteria

1. A packaged build writes a findable log; a user can produce it in two clicks from
   the Help menu, on all three platforms.
2. An uncaught renderer exception, a main-process exception and a native renderer
   crash each leave a record.
3. "Report a problem" opens the issue form with version, OS and arch pre-filled.
4. Nothing leaves the machine that the privacy policy does not name — verified by
   reading the policy against the code, not by intent.
5. The log contains no project content, no credentials, and no absolute path above
   the project root. Verified by inspecting a real log after a real session, not by
   reasoning about the writer.
6. The bug-report issue form's "NodeGX does not write a log file yet" paragraph is
   **deleted**, because it is no longer true.

Criterion 6 is small and is the point: this task is finished when the apology in the
issue template can come out.
