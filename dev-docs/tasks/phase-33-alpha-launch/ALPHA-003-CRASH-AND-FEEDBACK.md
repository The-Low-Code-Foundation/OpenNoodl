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
  Re-verified 2026-08-06: still true at that date, and **fixed by this task** —
  `main.js` now calls `crashReporter.start({ uploadToServer: false })`.
- ~~**No log file.**~~ **This was wrong, and it was the load-bearing premise of
  the whole task.** Corrected 2026-08-06 by reading the code:
  `src/editor/src/utils/bugtracker.ts:97` sets `enabled = !Config.devMode`, and
  `devMode: true` appears **only** in `shared/config/config-dev.js:9`. So in every
  packaged build the BugTracker is live and has been since the fork. It creates
  `<userData>/debug/`, appends to `log-<date>.txt`, monkey-patches `console.log`
  so that *every* call is teed into that file with up to 10,000 characters of
  `JSON.stringify(data, null, 2)` attached (`bugtracker.ts:26–30`, `:64`, `:78`),
  and installs a `window.onerror` handler. `src/main/src/merge-driver.js:104–109`
  writes whole project graphs into the same directory when a project merge fails.

  It is right that `app.getPath('logs')` is never used — the directory is
  `<userData>/debug/`, not the platform log directory — which is presumably how
  the original survey missed it.

  Three consequences, and they are what the task actually turned out to be:

  1. **Nobody was ever told, and nobody was asked.** The log captures whatever
     `console.log` was handed, which in this editor includes project content.
  2. **It was unbounded.** One file per launch, forever, no size cap, never
     pruned. Confirmed by reading the writer: nothing deletes anything.
  3. So the task is **surfacing and scoping an existing log**, not adding one.

  All three are addressed by this task; see "What was built" at the end.
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

~~Write to `app.getPath('logs')`.~~ **Corrected 2026-08-06:** the log already
exists at `<userData>/debug/`, with a second writer (the Git merge driver) that
also uses that path. Moving it would orphan every existing file, break
`PRIVACY.md` §5 and §7, and buy nothing — the directory a user is pointed at by
a menu item does not need a memorable name. It stayed where it is.

The rest of this paragraph stands and is the actual work: rolling, size-capped,
no project content and no absolute paths beyond the project root — a log a user
is willing to paste into a public issue is worth more than a complete one they
will not.

Renderer exceptions must reach it. The dev loop already mirrors renderer console
into main stdout and writes uncaught exceptions to `.logs/dev.log` (REV-008); this
is the same idea for packaged builds, where there is no terminal to mirror into.

### 2. `Help → Open log folder`

The log is worthless if finding it requires knowing what `getPath('logs')` resolves
to on three platforms.

> **Moved out 2026-08-02.** "Report a problem" — the in-app composer and the
> pre-filled issue form — is now [ALPHA-007](./ALPHA-007-FEEDBACK-LOOP.md) in full,
> because it turned out not to transmit anything and therefore does not share this
> task's ALPHA-005 gate. It can ship today; this cannot.
>
> The dependency runs the other way from what you would expect: **ALPHA-007 owns the
> redactor**, being the thing that publishes. This task reuses it for the on-disk log
> rather than writing a second one. If ALPHA-003 runs first, write the redactor here
> to ALPHA-007 §3's specification and let it take the dependency.

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
3. ~~"Report a problem" opens the issue form with version, OS and arch pre-filled.~~
   **Moved to [ALPHA-007](./ALPHA-007-FEEDBACK-LOOP.md) criterion 1.**
4. Nothing leaves the machine that the privacy policy does not name — verified by
   reading the policy against the code, not by intent.
5. The log contains no project content, no credentials, and no absolute path above
   the project root. Verified by inspecting a real log after a real session, not by
   reasoning about the writer.
6. The bug-report issue form's "NodeGX does not write a log file yet" paragraph is
   **deleted**, because it is no longer true.

Criterion 6 is small and is the point: this task is finished when the apology in the
issue template can come out.

---

## What was built, 2026-08-06

Option **A** — local only, nothing transmitted. `crashReporter` is started with
`uploadToServer: false`, which is not a default that was shrugged at: there is
no endpoint, and building one needs a transmission policy ALPHA-005 does not
grant. Local capture composes with ALPHA-007's report bundle — the reporter
attaches a dump themselves, under their own name, having seen it.

| Criterion | Where |
|---|---|
| 1. Findable log, two clicks | `main.js` Help → **Open log folder**; reveals `<userData>/debug/` selecting the newest file. `Open crash report folder` beside it where the platform has one. |
| 2. Renderer exception / main exception / native crash each leave a record | `bugtracker.ts` `window.onerror` + wrapped `console.error`/`console.warn` → `debug/log-<date>.txt`; `installMainProcessErrorLog` → `debug/main-errors.txt`, then reproduces Node's default exactly rather than turning a crash into a zombie; native crashes → `crashDumps/` via `crashReporter`. |
| 3. — | Moved to ALPHA-007. |
| 4. Nothing leaves that the policy does not name | Nothing leaves at all. `PRIVACY.md` §5 rewritten in the same commit as the code. |
| 5. No project content, no credentials, no absolute path | `utils/debugLog.ts` runs every field through ALPHA-007's `report/redact`; `console.log` is no longer captured at all; 2000 chars per message, 800 per attached object. Demonstrated in `tests-unit/alpha-003/debugLog.test.ts` against the real call site that logs a project directory listing. |
| 6. Delete the apology | `.github/ISSUE_TEMPLATE/bug_report.yml` now points at the Help menu item. |

**Retention** (new, not in the original scope — the log turned out to be
unbounded): 14 days / 40 files / 20 MB for `debug/`, 30 days for crash dumps,
newest survives, swept once per launch in the main process because `debug/` has
a second writer in a different process. `src/main/src/debug-log.js`,
`tests-main/debug-log.test.js`.

**One redaction rule was written twice, and it is argued rather than accidental.**
ALPHA-007's `report/redact.ts` is TypeScript inside the renderer's webpack
bundle; `main.js` is plain JavaScript run directly by Electron and can require
neither it nor the bundle. So `debug-log.js` carries `redactHard`, which is not a
competing policy but a **strictly tighter floor** — it drops every URL (no
known-host allowance), every absolute path (not even `<app>` survives), and any
long opaque run rather than a named deny-list. It cannot leak something the
shared redactor would have caught, which is the property the tests assert. The
alternative was rewriting ALPHA-007's redactor as JS with a TS wrapper, for one
caller, in another task's file.

**Not built, deliberately:**

- **Scope item 4** (the AI panels' no-provider path). It is ALPHA-001's check and
  belongs to whoever runs that list; nothing in the log or the crash reporter
  changes it, and it was in this file only because it was cheap to do "while in
  here". It is not cheap to do blind.
- **Any transmission**, including opt-in. That is option B and it needs
  ALPHA-005 to name it first.
- **A sweep of `reports/`.** An ALPHA-007 bundle exists because a user clicked to
  make it; deleting their evidence is a worse failure than a large folder.
- **Redacting `git-*-merge-*.json`.** They are copies of a project by
  construction — the point is to diagnose the merge. Redacting them would make
  them useless. They are labelled instead, in the folder's README and in
  `PRIVACY.md` §5, as the ones not to attach.
