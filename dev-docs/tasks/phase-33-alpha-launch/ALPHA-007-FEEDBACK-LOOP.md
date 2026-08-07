# ALPHA-007: A feedback loop that closes

## Metadata

| Field | Value |
|-------|-------|
| **ID** | ALPHA-007 |
| **Phase** | Phase 33 — Alpha Launch (Track R) |
| **Tier** | 2 — makes the alpha worth running |
| **Priority** | 🟠 High — it is the phase's third exit criterion, and it is the only Tier 2 task with **no prerequisites at all** |
| **Difficulty** | 🟢 Low–Medium — Part A is a dialog and a URL; the judgement is in the redaction and the payload contract |
| **Estimated Time** | Part A 2–3 days · Part B 1 day |
| **Prerequisites** | **None.** Deliberately — see "Why this does not depend on ALPHA-005" |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟢 Sonnet 5 for both parts; the redaction allow-list (§3) is worth a second pair of eyes |

## Objective

An alpha tester who hits a bug can report it, with evidence, in under thirty
seconds and without leaving the editor — and a contributor with write access can
pick that report up and act on it without ever asking the reporter a question.

Two halves of one loop. They are one task because they share a single artefact:
**the issue body**, which has to be legible to a human *and* parseable by an agent.
Designing either half alone gets that contract wrong.

## The shape, decided 2026-08-02

Recorded so it is not relitigated. Richard and Claude worked through four designs;
this is the one that survived, and the reasoning matters more than the conclusion.

**The app never transmits anything. The user's own browser posts the issue, under
their own GitHub identity, to a form they can read before submitting.**

The rejected alternatives, and why:

| Design | Why not |
|---|---|
| Ship a GitHub token, app files the issue | A token in an Electron app is extractable — `asar` is not encryption — and this repo is **public**. Write access to the repo for anyone who unzips the binary |
| Cloudflare Worker → email / auto-filed issue | The right *eventual* answer, and cheap. But it bakes an endpoint into a desktop binary that alpha testers will not re-download for months, it needs a privacy-policy amendment before it can ship, and it makes us the moderation queue. Buy it with evidence, not a guess — see "Deliberate non-goals" |
| Export a bundle to disk, tell the user to attach it | *More* friction than the prefilled URL, not less: find the file, open GitHub, sign in, paste. The failure mode of alpha feedback is silence, and every step between the frustration and the send loses people. Kept — as the fallback, not the path |

What the chosen design buys, beyond cheapness:

- **[`PRIVACY.md`](../../../PRIVACY.md) §5 stays true exactly as written.** It currently
  says "Nothing about a crash is transmitted … If it breaks, we find out because you
  tell us." A user-initiated browser handoff *is* "you tell us". No new promise.
- On a public repo, the reporter seeing the payload before it posts is not a nicety.
  It is the control that stops a tester's client API key becoming a permanent search
  result.
- Triage is free and already tooled: `gh issue list`, and the reporter gets a thread
  plus a notification when it is fixed. In an alpha that is what produces a *second*
  report from the same person.
- Nothing is baked into the binary that we could later regret, because there is no
  endpoint to regret.

## Why this does not depend on ALPHA-005

[ALPHA-003](./ALPHA-003-CRASH-AND-FEEDBACK.md) is blocked on ALPHA-005 for a good
reason: it transmits, and nothing transmits before a policy names it. This task does
not transmit, so it does not inherit that gate — which is precisely what makes it
the Tier 2 work that can start today. Splitting it out of ALPHA-003 is the point of
its existing separately.

**The handoff:** ALPHA-003 keeps the on-disk log scoping, `crashReporter`, `Help →
Open log folder`, and the no-provider state. Its scope §2 ("Report a problem") moves
here in full. The dependency between them runs the other way from what you would
expect: **this task owns the redactor** (§3), because it is the thing that publishes,
and ALPHA-003 reuses it for the on-disk log rather than writing a second one.

## Current state, measured 2026-08-02

- **No in-app feedback path.** No "report a problem" anywhere in the UI. The Help
  menu exists (added by ALPHA-005, beside `About NodeGX`) and `HelpCenter.tsx` exists,
  so there are two natural homes and neither is occupied.
- **Three issue forms exist** and are good — `bug_report.yml`, `feature_request.yml`,
  `node_report.yml`, added 2026-07-30 (`47219e05`). Their field `id`s are the prefill
  contract and are listed in §2.
- **The triage queue they promise does not exist.** All three forms declare
  `needs-triage`; `node_report.yml` also declares `node-library`. **Neither label
  exists on the repo** — the label set is still GitHub's stock nine
  (`bug`, `documentation`, `duplicate`, `enhancement`, `good first issue`,
  `help wanted`, `invalid`, `question`, `wontfix`). GitHub drops labels it cannot
  resolve, so `gh issue list --label needs-triage` returns nothing by construction.
  Filed as **F72**.
- **No severity anywhere.** No form field, no label vocabulary. A queue with no
  severity is ranked by date, which is the wrong axis.
- **The evidence already exists and nobody is told.** Per finding A4,
  [`bugtracker.ts`](../../../packages/noodl-editor/src/editor/src/utils/bugtracker.ts)
  is **live in every packaged build** (`enabled = !Config.devMode`, and `devMode: true`
  appears only in `config-dev.js`). It tees `console.log` and installs
  `window.onerror`, appending to `<userData>/debug/log-<date>.txt`. The error tail this
  task wants is already being collected — which is also why §3 is not optional.
- **Electron makes this much cheaper than the prior art.** The reference
  implementation (a browser game) fetches `html2canvas` from a CDN to rasterise the
  DOM. `webContents.capturePage()` replaces that entire dependency with one call.
- **Six collaborators, four with `write` or better** (`gh api …/collaborators`,
  2026-08-02). Part B's audience is small and known, which is why a convention-based
  claim protocol is sufficient and no bot is required to enforce it.

---

# Part A — the report composer

Ships alone. Nothing else in the phase depends on it and it depends on nothing.

## 1. The entry point, and one design law

`Help → Report a problem…`, plus an item in the Help Center panel. No keyboard
shortcut in v1 — every convenient key is taken in an editor, and picking a bad one
is worse than a menu item.

**The law, inherited from the prior art and worth stating because it is easy to get
wrong:** the composer must open *over* whatever is already open, including an open
menu or modal, and must not dismiss it. Half of all UI bugs are about menus, and a
reporter that closes the thing being reported cannot report it.

Corollary: **the screenshot is captured at click time, not at send time.** By the
time the dialog has rendered, the evidence is behind it.

## 2. The composer, and the prefill contract

Fields the user fills: what happened (required), which surface, severity, and
"does it happen in a brand-new project?". Everything else is captured.

Fields the app fills, mapped to `bug_report.yml`'s `id`s — these are the contract,
and a rename on either side silently breaks the prefill:

| Form `id` | Source | Note |
|---|---|---|
| `what-happened` | user | required |
| `surface` | user, with a default guessed from focus | dropdown — **the value must match the option string exactly** |
| `version` | `app.getVersion()` | |
| `os` | `process.platform` + `process.arch` | maps exactly onto the four options; no guesswork |
| `fresh-project` | user | cannot be inferred — only the reporter knows |
| `steps` | user, optional | |
| `errors` | captured tail, redacted | `render: text` |
| `diagnostics` | captured, redacted | **new field — see §4** |

The URL is
`https://github.com/The-Low-Code-Foundation/OpenNoodl/issues/new?template=bug_report.yml&…`
with each `id` as a query parameter.

> **Do this first, before writing any dialog code.** Hand-construct one URL against
> the live template and open it in a browser. Confirm (a) that dropdown prefill works
> at all, (b) that the option strings match, and (c) the practical length ceiling.
> The whole shape of Part A rests on this working, it takes five minutes, and if it
> does not behave the design changes. Do not build the dialog on the assumption.
>
> Budget **≤6KB** of prefilled body regardless — long URLs are silently mangled
> rather than rejected, which is the worst failure mode available. Anything over
> budget is truncated into the issue and preserved whole in the exported bundle (§5).

## 3. The redactor

This is the part that deserves care. Everything below leaves the machine and lands
on a public repo, permanently, under the reporter's name.

**Never included, at all:** project graph content, node parameter values, component
or page names, file contents, anything from the SecretsStore or Cloud Services
config, any AI provider key.

**Included, as shape not content:** component count, node count by *type*, connection
count, whether a backend is configured (boolean, never the endpoint), open component
kind.

**Transformed:** the home directory to `~`; any path inside the project to
`<project>/…`; anything matching a credential shape (`sk-…`, `ghp_…`, `Bearer …`,
AWS key ids, `?key=`/`token=` query params) to `[redacted]`.

**The log tail is not attachable raw.** `bugtracker.ts` tees *every* `console.log`
with up to 10,000 characters of attached data, and the merge driver writes whole
project graphs into the same directory. Take only lines matching error/warning
patterns, from the last few minutes, redacted, capped.

Acceptance for this section is behavioural, not intentional: see criterion 4.

## 4. A `diagnostics` field, written for two readers

Add one textarea to `bug_report.yml`:

```yaml
  - type: textarea
    id: diagnostics
    attributes:
      label: Diagnostics
      description: Filled in automatically by "Report a problem" in the editor. Leave blank if you are filing by hand.
      render: json
```

`render: json` fences it, so it is a stable, machine-locatable region in the issue
body — `gh issue view N --json body`, then read the fence. **This is the join between
Part A and Part B**: it is what lets a contributor's agent reproduce from the report
instead of interrogating the reporter, and it is the reason these are one task.

Keep the schema flat, stable, and versioned (`"schema": 1`). Part B parses it; a
silent shape change breaks triage without breaking anything visible.

Also add a **severity** dropdown while in this file (F72 — there is none today).
Note that a `labels=` URL parameter will *not* work for this: applying labels needs
triage permission, and a reporter is not a collaborator, so severity has to be a form
field that Part B's labelling step reads.

## 5. Send, and the fallback

On **Send**, three things happen together:

1. The screenshot goes to the **clipboard** as an image — downscaled to ≤1600px wide
   and encoded at ~q0.8. A retina editor window is 1–3MB raw and base64 inflates it
   another third; at 1600/q0.8 it is 150–300KB and still perfectly legible.
2. The browser opens the prefilled form.
3. The composer **stays open behind it**, saying: *your screenshot is on the
   clipboard — press ⌘V in the description box*, with a **Reveal in Finder** button
   pointing at the exported bundle.

The bundle is the fallback and is written every time, unconditionally: one folder
per report, holding the screenshot and the diagnostics JSON. There is one clipboard
and the user may well clobber it on the way to the browser; and a tester who refuses
to use GitHub at all can send that folder to a human instead.

---

# Part B — the contributor side

Small, and it is what makes the reports worth collecting. Audience: the four
collaborators with `write` or better.

## 6. A label vocabulary that exists

Create the labels the forms already declare, plus the severity set the new field
needs, plus a claim mechanism. Assignee is the claim — it is native, visible on the
list view, and needs no convention to be understood.

The queue contract is `gh issue list --label needs-triage --json …`. It returns
nothing today (F72); after this it returns the queue.

## 7. A `/triage` skill in the repo

`.claude/skills/triage/SKILL.md`, checked in, so every contributor gets it from a
clone with no setup beyond `gh auth login`. It should:

1. Read the open queue, ranked by severity, then by kind, then recency.
2. **Group before proposing.** Several reports are frequently one root cause; say so
   rather than fixing the same thing three times. This is the single highest-value
   behaviour in the prior art's version of this skill.
3. Read the `diagnostics` fence (§4) and the screenshot before reading the prose
   twice — the picture is usually faster.
4. Claim by assigning, work, and close **with the commit referenced**, never silently.
5. Say plainly when the queue is empty. That is an answer, not an error.

There is a working reference implementation of this skill at
`~/vscode_projects/dead-weight/.claude/skills/triage/SKILL.md` — the ranking rules and
the "group before proposing" step port over almost verbatim; only the source changes
from a local directory to `gh`.

Contributors act under **their own** GitHub identity via `gh`. Nothing new to
authenticate, no shared credential, and the audit trail is per-person.

## 8. The Claude GitHub App — evaluate, do not assume

Separately from §7, the Claude GitHub App allows `@claude` in an issue comment to
open a PR without a local checkout — triage from a phone, and a first pass on a
report before anyone sits down.

**Evaluate it, do not adopt it blind.** The specific questions, on a *public* repo:

- Who can trigger it, and is the write-access check the default or something we
  configure? An unmetered `@claude` on a public repo is a stranger spending our
  tokens.
- Whose key pays, and what is the ceiling?
- Does it interact sanely with §7's assignee-as-claim convention, or does it race a
  human who has already claimed the issue?

Recommendation: ship §6 and §7 first, run the queue by hand for a fortnight, and
adopt §8 only if the queue volume justifies it. It is additive either way.

---

## Deliberate non-goals, and the trigger to revisit

**No transmission from the app. No worker, no form service, no telemetry.** Not
because they are wrong — the Cloudflare Worker is the right eventual answer — but
because they are unjustified until we know the browser handoff loses people.

**The trigger:** testers reporting bugs to us in conversation, on Discord, or in
person that never became issues. That is the drop-off, and it is the only signal
we will get — we cannot measure the handoff without telemetry we have deliberately
chosen not to have, and the spec should say so rather than implying a metric exists.
If that happens more than a couple of times, build the worker; the capture, the
redactor and the payload are identical, and only the sink changes.

**Not in scope:** attaching the project. Public repo, and §3 exists.

## Acceptance criteria

1. From a **packaged** build, `Help → Report a problem…` produces a GitHub issue
   with version, OS/arch, surface and the diagnostics block correctly filled, and a
   screenshot in the body — performed end to end by someone who did not build it, on
   at least two platforms.
2. The composer opens over an open menu without dismissing it, and the screenshot
   shows that menu. Verified by doing it, not by reading the code.
3. Every field the app prefills lands in the right form field. A renamed `id` on
   either side is caught by a test, not by a reporter filing an issue with an empty
   version field.
4. **Redaction is verified against a hostile fixture, not by intent:** a project
   containing an API key in a node parameter, a backend endpoint, a component named
   after a client, and a path outside the project root produces a report containing
   none of them. This criterion fails if it is argued rather than demonstrated.
5. The exported bundle exists after every send, and `Reveal in Finder` opens it on
   all three platforms.
6. `gh issue list --label needs-triage` returns the queue, and `/triage` ranks it,
   groups duplicates, and closes an issue with a commit reference — demonstrated on
   a real report, end to end.
7. A tester with no GitHub account has a stated path that does not involve one, and
   it is written in the composer, not just in this document.

## Open questions for Richard

1. **Severity scale.** Five levels (`whenever` → `drop everything`, per the prior art)
   or three (`low`/`medium`/`high`)? Five was chosen deliberately in the game and
   worked; three is easier for a stranger to answer honestly.
2. **Bug only, or all three forms?** The composer could route to
   `feature_request.yml` and `node_report.yml` from a type selector — the capture is
   useful for a node report too. Cheap now, awkward to retrofit.
3. **The non-GitHub fallback needs an address** (criterion 7). ALPHA-005 already owes
   a contact address for the legal documents' TODO — same decision, worth making once.
4. **Discord.** F69 records that the Discord linked from the Help Center is *Noodl's*,
   not ours. If there is to be a NodeGX server it is the natural home for the fallback
   and for §8's overflow — but it is a community-management commitment, not a
   technical one.
5. **§8** — appetite for the Claude GitHub App on a public repo at all, given the
   token-spend question?
