# DEP-007: The Deploy Assistant — Sizing, DNS, Diagnosis

## Metadata

| Field | Value |
|-------|-------|
| **ID** | DEP-007 |
| **Phase** | Phase 26 — Deployment (Track K) |
| **Tier** | 4 — provisioning & assist |
| **Priority** | 🟡 Medium |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 1–1.5 weeks |
| **Prerequisites** | DEP-005; DEP-006 for the sizing surface |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Opus 5** — deciding what the assistant may and may not do is the task; the plumbing is small |

## Objective

Put the AI where deterministic code is genuinely bad: recommending a server size for *this* project,
explaining DNS to someone who has never pointed a domain, and reading a failed deploy's logs to say
what broke and what to do — without letting it anywhere near the deploy path itself.

## Background

The scoping decision this task exists to implement:

> The deploy path is deterministic code. The AI is a guide and a troubleshooter, never load-bearing.
> Every step from "click Deploy" to "the app is live" runs offline with no model configured.

The maintainer's current practice is to have an agent do the whole thing, which works because he can
read what the agent did and correct it. That property does not survive contact with the target user
of this phase, and a deploy that only succeeds when a model improvises cannot be reproduced, tested,
or supported when someone files a bug.

What *is* genuinely hard for deterministic code:

- **"Which server should I buy?"** depends on the project — how many collections, whether it uses
  files, whether workflows run on a schedule, whether realtime is on. A lookup table gives everyone
  the same answer.
- **"How do I point my domain at this?"** is a different conversation for every registrar, and the
  user's actual question is usually not the one they typed.
- **"It failed"** produces a log the user cannot read. Mapping a Docker error, a Caddy TLS failure or
  a disk-full message to a next action is exactly what a model is good at.

DEP-007 is additive by construction. **If it is never built, tiers 1–3 remain a complete product.**
Anything that stops working when no API key is configured is a bug in this task.

## Current State

| Piece | Where |
|---|---|
| Provider-agnostic AI client | `models/AiAssistant/client/AiClient.ts` — features branch on registry **capabilities**, never model ids |
| Model registry | `client/models.ts` — the only place model ids and pricing live |
| Credentials | `store/AiCredentials.ts` |
| Agentic tool loop | `models/AiAssistant/authoring/` — `AuthoringSession.ts`, `tools.ts` |
| Chat UI patterns | `views/panels/AiAuthoringPanel`, `ExplainPanel` |
| Explain-mode precedent | AIX-004 — read-only explanation over project state; **the closest shape to this task** |

## Desired State

### 1. A hard boundary, enforced in code

The assistant has **no tool that mutates anything**. No SSH execution, no provider API writes, no
file writes, no deploy triggering. Its tools are read-only: project shape, target configuration
(never secrets), the last deploy's log, health-check results.

This is not a guideline to be observed carefully — it is a property to be enforced by the tool
registry and asserted by a test that enumerates the assistant's tools and fails if any of them can
write. AIX-005 found a runtime-wide bug only by running the app; boundaries that exist only in a
prompt are boundaries that will be crossed.

Where the assistant wants an action taken, it says so and the **user** presses the existing button.

### 2. Sizing recommendation

On DEP-006's size step, an optional annotation derived from the project: collection count, whether
files/realtime/workflows/email are used, expected concurrent users if the user says. Output: a
recommended type with one sentence of reasoning, and an explicit note that the smallest option is
usually right to start with and resizing later is easy.

Falls back to a static sensible default with no AI configured, and the step must look deliberate in
that state rather than broken.

### 3. DNS explainer

After a deploy, if the target's site URL is a domain the user owns, produce concrete instructions:
the record type, the name, the value, and — if the user names their registrar — where that lives in
that registrar's UI. Plus the two facts that cause most of the confusion: propagation is not
instant, and the certificate is issued automatically once the record resolves.

If the site URL is an sslip.io address, offer the "how do I use my own domain" path instead.

### 4. Deploy failure diagnosis

The highest-value part. On a failed deploy, offer "explain this". Input: the deploy log (scrubbed),
the failing step, the preflight results, the target config minus secrets. Output: what failed, why,
and the next action — with an honest "I am not sure, here is what I would check" when it does not
know. A confidently wrong diagnosis of an infrastructure failure is worse than none, because the user
cannot evaluate it.

**Secrets must be scrubbed before the log leaves the machine.** The backend already ships a scrubber
(`noodl-viewer-cloud/src/execution-history/scrub.ts`, used by WF-006 for request headers and bodies).
Reuse it and extend it for deploy output rather than writing a second one. A test plants known
secret-shaped values in a log and asserts none reach the prompt.

### 5. Cost and consent

Sending a deploy log to a model provider is sending infrastructure detail off the machine. Ask the
first time, per project, and remember the answer. AIX-007 already established token-cost patterns for
this codebase — follow them rather than inventing a budget mechanism.

## Implementation Steps

1. **Read AIX-004 (explain mode) first.** A read-only assistant over structured state is exactly this
   shape, and it already solved context assembly and panel presentation.
2. Read-only tool set + the enumeration test that fails on any mutating tool.
3. Log scrubbing, extending the existing scrubber, with the planted-secrets test.
4. Sizing annotation on DEP-006's step, with the no-AI fallback.
5. DNS explainer.
6. Failure diagnosis, with the consent gate.
7. **Verify against real failures.** Induce at least four: wrong SSH key, no Docker, disk full,
   TLS failure on a domain that does not resolve. Record what the assistant said for each and
   whether it was right. A diagnosis feature evaluated only on hypothetical logs has not been
   evaluated.

## Success Criteria

- [ ] Every deploy flow completes with **no AI provider configured**, and the assistant's absence
      looks deliberate.
- [ ] A test enumerates the assistant's tools and fails if any can write.
- [ ] A test plants secrets in a deploy log and asserts none reach the prompt.
- [ ] Four induced real failures produce diagnoses recorded verbatim in the notes, with an honest
      assessment of which were right.
- [ ] The assistant says "I am not sure" on at least one of them, or the honesty of the prompt is
      re-examined.
- [ ] Sizing recommends the smallest adequate option on a small project.
- [ ] DNS instructions name record type, name and value for a real domain.
- [ ] Sending logs to a provider is consented to once per project.
- [ ] No new AI client, credential store, or model registry is introduced.

## Out of Scope

- The assistant performing any action, including "just this one safe one".
- Provisioning without confirmation.
- Writing the app's code, fixing the project, or changing the graph — other AIX tasks own all three.
- A general "infrastructure chat". The assistant is scoped to deployment questions and says so when
  asked something else.
- Automatic DNS record creation via registrar APIs.

## Traps

- **Features branch on registry capabilities, never model ids** (AIX-001). Do not add a
  `if (model === …)` anywhere.
- **`costUsd` is `number | null`** — null means unpriced, a local model reports a real 0. Do not
  collapse them.
- **Node tests cannot prove a browser API call** (AIX-005's finding). The live pass matters more than
  the suite here.
- **A confident wrong answer about infrastructure is worse than no answer**, because the user has no
  way to evaluate it and may act on it against a production machine. Prompt for calibration, and
  check whether it actually calibrates rather than assuming the instruction worked.
- **The deploy log is the most sensitive thing this phase handles.** It can contain hostnames, IPs,
  usernames, environment variable names and occasionally values. Scrub, test the scrubbing, and show
  the user what will be sent before it is sent.
