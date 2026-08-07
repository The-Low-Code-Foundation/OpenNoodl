# OPS-010: Launch Guidance — the assistant that knows your app and what it still needs

## Metadata

| Field | Value |
|-------|-------|
| **ID** | OPS-010 |
| **Phase** | Phase 31 — Readiness & Operations (Track P) |
| **Tier** | 3 — the sweep |
| **Priority** | 🟠 High — it is the phase's most user-visible surface and the only one aimed squarely at someone who has never launched anything |
| **Difficulty** | 🟠 Hard — the code is a session and a registry contribution; the prompt discipline and the check honesty are the work |
| **Estimated Time** | 2–2.5 wks |
| **Prerequisites** | OPS-001 (registry + levels). Soft: OPS-006 (security checks), OPS-007 (meta), DEP-004/005 (targets, secrets) |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Fable 5** — a system prompt that must refuse to give legal advice while still being genuinely useful, and a set of checks that must say *unknown* rather than guess, is judgement work |

## Objective

A builder who has never opened Google Cloud Console, never pointed a domain, and never heard of DKIM
can ask the editor "what do I still need to do before real people use this?" — and get an answer that
is about **their** app, scoped to **their** declared ambition, with hand-holding through the parts that
happen in someone else's browser tab.

## Background

Phase 31 as specced answers *what is missing*. [OPS-001](./OPS-001-MATURITY-LADDER.md#L74-L82)'s
`ReadinessItem` carries `title`, `why` and `check` — it can say *"strangers can't sign in until email
is configured"* and then leave the user exactly where they were. Nothing in the phase carries a **how**.

That gap is where the audience this product is for actually stops. The scoping conversation
(2026-07-30) named nine things builders freeze on — OAuth, legal pages, DNS, email relays, monitoring,
hosting, object storage, SSH, onboarding — and the pattern across all nine is the same: the mechanism
usually already exists in NodeGX (BAK-004 shipped OAuth, BAK-002 shipped SMTP, BAK-006 shipped S3),
and what is missing is *knowing the list exists and where you are in it*.

**The decision taken:** guidance is delivered by the AI assistant, which knows the project, rather than
by a library of written tutorials.

The argument for that is staleness. A runbook reading *"Cloud Console → Credentials → Create OAuth
Client ID"* is wrong within eighteen months because Google moves the button, and forty such runbooks is
a maintenance liability that lies confidently to beginners. An assistant that holds the project's
actual state can adapt; a paragraph committed in 2026 cannot.

**The counter-pressure that shapes every rule below:** no configured provider has web access
([`models.ts:110`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/models.ts#L110)
— capabilities are `streaming`, `tools`, `agentFlow`, `sampling`; there is no search or fetch). The
model's knowledge has a cutoff, consoles move, and a fluent description of last year's UI is *more*
harmful than silence because a beginner cannot tell the difference. So the assistant is the guide, and
**the check is the arbiter**. The model never declares success.

This does not contradict [Phase 26's decision](../phase-26-deployment/README.md#L79-L88) that the AI is
never load-bearing in a deploy. Deploying is deterministic and stays deterministic. *Explaining what a
DNS record is to someone who has never made one* is the fuzzy work that decision explicitly reserved
for the assistant. OPS-010 is the same boundary, applied wider.

## Current State

| Piece | State |
|---|---|
| Readiness registry | OPS-001, unbuilt. `ReadinessItem` has `why`, no `how` |
| Advisory AI session | `models/AiAssistant/explain/` — AIX-004. Bounded context, hand-written system prompt, streamed turns, `[Label](noodl-node:ID)` citations that drive canvas navigation. **The precedent to follow** |
| Project context assembly | `AiAssistant/authoring/ContextBuilder.ts`, `explain/assemble.ts`, `review/assembleProject.ts` — three existing shapes, none project-wide-plus-config |
| AI providers | `client/providers/` — anthropic, openai, ollama. No web access on any |
| Model absence | AI features degrade to unavailable; phase 15 hit a real out-of-credit period. A checklist that needs a key is a checklist a stuck user cannot read |
| OAuth mechanism | BAK-004 — Google/GitHub/passwordless, configured on the backend |
| Email mechanism | BAK-002 — SMTP, templates, reset, verify. Owns canonical `baseUrl` |
| Storage mechanism | BAK-006 — zero-dep SigV4, S3-compatible |
| Legal / consent / data-rights | nothing anywhere in the product |

## Desired State

### 1. `guidance` on the registry item

One field added to OPS-001's `ReadinessItem`. Every part of it works with **no model configured**:

```ts
interface ReadinessGuidance {
  /** One or two sentences. Always rendered. The no-model floor. */
  summary: string;

  /** 3–6 steps, written STRUCTURALLY — see §4. Optional; omit rather than pad. */
  steps?: string[];

  /** The vendor's own documentation. Linked, never paraphrased at length — it is the thing that stays current. */
  authority?: { label: string; url: string };

  /** What is handed to the guidance session when the user asks for help. */
  brief: GuidanceBrief;
}

interface GuidanceBrief {
  /** Which project facts this item's conversation needs. Keeps context bounded and auditable. */
  needs: Array<'level' | 'deployTargets' | 'backendConfig' | 'routes' | 'schema' | 'authNodes' | 'externalLinks'>;
  /** Extra prompt framing for this item only. Never repeats the global rules. */
  note?: string;
  /** Marks items where §6's disclaimer discipline applies. */
  sensitivity?: 'legal' | 'security' | 'financial';
}
```

`summary` + `steps` + `authority` + `check` is a complete, useful, offline checklist. The assistant is
the layer above that, not the price of entry.

### 2. The guidance session

`models/AiAssistant/readiness/` — `GuidanceSession`, built on `ExplainSession`'s shape (bounded
context, streamed turns, citations back into the project). It is **advisory and read-only**: it never
edits the graph, never writes config, never runs a deploy. The one exception is §6's template
insertion, which goes through the normal authoring apply path with a diff the user approves.

It is entered three ways:

- **"Help me with this"** on any unmet readiness item — the item's `brief` frames the conversation.
- **"What do I still need?"** from the readiness panel — a whole-ladder conversation scoped to the
  declared level.
- **A question typed into the panel** — same session, no item selected.

The session is given: the declared level, every registered item with its current `ReadinessState` and
evidence, and only the project facts the active item's `needs` list requests. Not the whole project —
the same bounded-context discipline `explain/` already enforces, for the same reason.

### 3. The level scopes the conversation

The assistant discusses items **at or below the declared level**. Asked about something above it, it
answers in one sentence and names the level it belongs to — it does not talk a Playing user through
DKIM. This is the ladder's promise (*"nothing above the declared level is nagged about"*) applied to
the one surface that could most easily break it, because a chatty model will happily volunteer the
whole list.

It may ask, once, whether the level still matches what the user is doing. Then it drops it.

### 4. Steps are structural, and the prompt says why

Both the authored `steps` and anything the model generates obey the same rule, which exists solely
because neither can see the current console:

- **Name what to look for, not where it is.** "Find the section called *Credentials*" — never "click
  the third item in the left sidebar", never a pixel position, never a screenshot.
- **Name the concept the user is trying to achieve**, so they can navigate a renamed UI themselves:
  *"you are creating an OAuth client — an identity for your app that Google will recognise — and
  telling Google which URL it may send users back to."*
- **State uncertainty when the UI may have moved.** "If the wording has changed, you are looking for
  whatever creates credentials for a web application."
- **The authority link is the source of truth for the steps**, and the prompt says so out loud to the
  user rather than hiding it.

### 5. The check is the arbiter, always

Every guidance conversation ends at a **"Check it"** button that re-runs `check()`. The model is
forbidden — in the system prompt, explicitly — from telling the user they are done. It may say *"that
should be everything; run the check"*. It may not say *"you're all set"*.

This is the single most important rule in the task. An assistant that congratulates someone whose OAuth
callback is still broken has done more damage than no assistant, and it is the exact failure a fluent
model will produce by default.

When a check fails after guidance, the failure text goes back into the session as the next turn's
input. That loop — attempt, check, real error, diagnosis — is the whole value, and it is the part a
written tutorial structurally cannot do.

### 6. Legal, security and financial items carry their disclaimer in the prompt

Per the 2026-07-30 decision: **the disclaimers live in the system prompt, not in each item's prose**,
so they cannot be forgotten when an item is added and can be revised in one place.

For `sensitivity: 'legal'` the prompt establishes, and the UI repeats once in the panel:

- NodeGX does not provide legal advice and the assistant must say so plainly when the topic arises —
  once, in a clause, not as a repeated disclaimer paragraph that trains people to skip it.
- It may explain **what a document is for** and **that a jurisdiction commonly requires one** (a
  privacy policy, terms, France's *mentions légales*, a cookie notice) without asserting what the law
  requires of this user.
- It may generate a **clearly-marked starting template** — structurally sound, with the project's own
  facts filled in where NodeGX knows them (what data the app collects, from the schema; which
  third-party processors are configured, from the backend config) and `[REVIEW THIS]` markers where it
  does not.
- Every template carries a persistent, non-dismissible banner in the generated page: *this is a
  starting point, not legal advice, and must be reviewed by a qualified professional before you rely
  on it.* The banner is part of the inserted component, so it travels with the project and someone has
  to deliberately delete it.
- The authority link is the jurisdiction's own regulator where one is known (CNIL, ICO), never a
  summary blog.

`'security'` and `'financial'` sensitivities take the same treatment with their own sentence — the
assistant does not certify that an app is secure, and does not predict what anything will cost.

The template is inserted as real routes and components in the user's project through the authoring
apply path, with a reviewable diff. It is not a PDF and not a copy-paste block.

### 7. The checks this task contributes

OPS-010 registers the derivable items the scoping session identified. **Levels below are proposals;
OPS-001's taxonomy pass ratifies them** and its boundaries win in a conflict.

| id | Level | Mechanism it checks | Notes |
|---|---|---|---|
| `launch.password-reset` | Sharing | BAK-002 | Reset was built and is never tried before launch. A locked-out first user does not come back |
| `launch.contact-route` | Sharing | routes | Trivial, universally forgotten, and required by several of the jurisdictions in the legal item |
| `launch.small-screens` | Sharing | styles/graph | **Heuristic — resolves `unknown`, not `unmet`.** See Traps |
| `launch.link-preview` | Sharing | OPS-007 meta | Defers to OPS-007 if built; the acceptance case is "pasted into WhatsApp" |
| `launch.legal-pages` | Live | routes + §6 | Presence of routes only. Never an opinion on adequacy |
| `launch.data-rights` | Live | schema | Can a user be deleted and their data exported? If the policy promises erasure and nothing implements it, the policy is a lie |
| `launch.consent` | Live | analytics module | `not-applicable` unless OPS-005's module is installed. We ship the trigger, so we own the warning |
| `launch.backend-down` | Live | graph | A data node with no error branch is a permanent spinner. Genuinely derivable |
| `launch.signup-abuse` | Live | BAK-009 | Rate limits exist; an open signup endpoint belongs at Live, not Scale |
| `launch.email-deliverability` | Live | BAK-002 + DNS | SPF/DKIM/DMARC — the actual reason mail lands in spam, and the item most worth an assistant |
| `launch.oauth-configured` | Live | BAK-004 | `not-applicable` when the project has no auth nodes |
| `launch.domain-tls` | Live | DEP-005/007 | Caddy auto-renews TLS; **domain expiry is the uncovered risk** |
| `launch.env-split` | Live | DEP-004 | Do not test against live data |
| `launch.runtime-cost` | Live | advisory + config | OPS-009 meters authoring spend. Nothing meters the deployed app: egress, a runaway cron, an AI key called from a public page |
| `launch.key-escrow` | Live | DEP-004 secrets | Narrow and checkable: do deploy credentials exist in exactly one place with no second copy? The builder locking themselves out is as fatal as an outage |

Items whose mechanism is unbuilt register and resolve `not-applicable` with a `because` naming the
task that will supply them. They must not resolve `unmet` — a cross for something the product cannot
yet do is a lie about the user's project.

### 8. The AI can read the guidance

No new MCP tool. OPS-001's `project_readiness` gains the `guidance` field, per the phase decision that
a new endpoint is a finding rather than a licence. An external agent asked to "get this ready for real
users" then sees the same steps and the same authority links the panel shows.

## Implementation Steps

1. **Extend `ReadinessItem` with `guidance` and land the no-model rendering first** — summary, steps,
   authority link, check button. Demonstrate the checklist is useful with the AI switched off before
   any session code exists. This ordering is deliberate and is the guard against the whole feature
   becoming unusable to a user without credit.
2. `GuidanceSession` in `models/AiAssistant/readiness/`, modelled on `explain/ExplainSession.ts`, with
   `needs`-bounded context assembly.
3. The system prompt: level scoping (§3), structural-steps discipline (§4), the never-declare-success
   rule (§5), and the three sensitivity treatments (§6). **Write this before the checks** — it is the
   deliverable that the rest hangs off, the same way OPS-001's taxonomy is.
4. Panel integration: per-item "Help me with this", whole-ladder "What do I still need?", free-typed
   question, and the check-fails-feeds-back loop.
5. The four Sharing checks + guidance content.
6. The legal templates and their non-dismissible banner, through the authoring apply path.
7. The remaining Live checks, in the table's order.
8. `project_readiness` carries `guidance`.
9. **Live pass**: with no API key, walk the whole checklist and confirm it is coherent and useful. With
   a key, take one genuinely unconfigured project through `launch.oauth-configured` end to end,
   including a *failed* check followed by a corrected one. Screenshot both themes.

**Minimum shippable:** steps 1–5. That is a working offline checklist plus a guidance session proven on
four items, and it is a coherent stopping point if the phase runs long.

## Success Criteria

- [ ] Every item's summary, steps, authority link and check work with **no AI provider configured**.
- [ ] The assistant never declares an item complete; only `check()` does. Verified by an adversarial
      prompt attempting to elicit "you're all set".
- [ ] A Playing project shows no launch guidance anywhere, and asking the assistant about DKIM at
      Playing gets one sentence and a level name, not a walkthrough.
- [ ] Legal guidance states it is not legal advice once, plainly, without a repeated disclaimer block.
- [ ] A generated legal template lands as real routes via a reviewable diff, carries the
      non-dismissible banner, fills in facts NodeGX knows, and marks `[REVIEW THIS]` where it does not.
- [ ] `launch.small-screens` resolves `unknown` with a `because`, never a cross.
- [ ] Items whose mechanism is unbuilt resolve `not-applicable` naming the owning task.
- [ ] A failed check after guidance feeds its failure text back into the session as the next turn.
- [ ] No authored step names a UI position, a sidebar index, or a button colour.
- [ ] `project_readiness` returns `guidance` identically to what the panel renders.
- [ ] Screenshots: no-model checklist, an item's guidance conversation, a legal template diff — both themes.

## Out of Scope

- **Performing external setup.** No creating OAuth clients, no provisioning Brevo, no buying domains.
  Most of these providers have no account-creation API at all — Hetzner was chosen for DEP-006 *because*
  it does. Each integration is credential storage plus a support burden, and it fails in a dashboard we
  cannot see.
- **New hosting adapters.** Hostinger and OVH are DEP-005/006's business and not until Hetzner is proven.
- **End-user onboarding for the built app.** "Getting *your users* into *your app*" is a template and a
  set of nodes — phase 21 territory. Filing it here would bury it. Open question for Richard.
- **Judging adequacy of anything legal.** Presence of a route is the ceiling.
- **Uptime monitoring vendors.** The Live rung item exists in OPS-001; healthchecks.io / Uptime Kuma
  integrations are unspecced and stay that way.
- **Translating guidance.** English only in this task; OPS-007 §4 owns the i18n export shape.

## Traps

- **The model will describe a console it cannot see, fluently.** No provider has web access. This is
  the defining constraint and §4 exists entirely for it. Test with a deliberately obscure provider flow
  and confirm the answer hedges rather than invents.
- **A fluent model congratulates people.** "Great, you're all set!" is the default behaviour and the
  worst possible output. §5's rule needs an explicit adversarial test, not a prompt line and hope.
- **`unknown` will want to collapse into `unmet`** — OPS-001 already flags this, and
  `launch.small-screens` is the case that will force it. "Does this work on a phone" is not derivable
  from a graph; what *is* derivable is "these pages use fixed widths above 600px". Report that, resolve
  `unknown`, and ask the human to look. Faking a boolean here discredits the whole panel.
- **Disclaimer fatigue is a real failure mode.** A legal disclaimer on every message trains users to
  skip all of them, including the one that matters. Once, plainly, in a clause.
- **Bounded context, or this becomes the most expensive feature in the editor.** The `needs` list is
  not decoration. A whole-ladder conversation that ships the entire project on every turn will be
  noticed on the OPS-009 meter immediately.
- **Guidance content is Richard's, like LEARN-002's curriculum.** The engineering is a session and a
  registry contribution. The summaries, the step wording and the legal templates are authored product
  voice, and an executor that generates all fifteen unsupervised will produce fifteen plausible,
  unreviewed, occasionally-wrong paragraphs.
- **`ProjectModel.setSetting` used to throw** (RUN-002) — the same warning OPS-001 carries, and the
  template-insertion path touches project state.
