# ALPHA-005: The paperwork that ships with a binary

## Metadata

| Field | Value |
|-------|-------|
| **ID** | ALPHA-005 |
| **Phase** | Phase 33 — Alpha Launch (Track R) |
| **Tier** | 2 — makes the alpha worth running |
| **Priority** | 🟠 High — blocks ALPHA-003, and is an hour of work |
| **Difficulty** | 🟢 Low — mostly writing down what is already true |
| **Estimated Time** | 0.5–1 day, plus review by someone who is not us |
| **Prerequisites** | none (but decide ALPHA-003's collection policy in the same sitting) |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Fable 5** — short, but the words are commitments |

## Objective

Ship a binary with an honest account of what it does with a user's data and what
they are permitted to do with it.

## Why now rather than later

NodeGX is not a library. It is a downloadable application that:

- **sends project content to third-party AI providers** — Anthropic and three others
  via AIX-001's client — whenever a user uses the authoring loop, explain mode or
  review;
- stores an API key the user supplies;
- runs a **local backend** that persists user data to disk;
- has a telemetry switch (AIX-002's opt-in G2 signal);
- talks to GitHub via OAuth for version control;
- is about to grow crash reporting (ALPHA-003).

That is six data flows, none of which are currently described to the user anywhere.
A privacy policy is not a formality here — it is the document that decides ALPHA-003's
design, which is why ALPHA-003 depends on this and not the other way round.

## Current state

- `LICENSE` exists at the repo root.
- The root `package.json` has **no `license` field**.
- There is no privacy policy, no terms, and no in-app disclosure of any kind.
- `CONTRIBUTING.md` exists.

## Scope

### 1. Privacy policy

Written from the code, not from a template. It must name, specifically:

- **Which AI providers receive project content, and when.** "When you use AI
  features" is not specific enough — a user should be able to tell from the document
  whether opening a panel transmits anything, or only pressing a button does.
- **Where the API key is stored** and that it is not transmitted anywhere except to
  the provider it belongs to.
- **What the local backend writes to disk, and where.**
- **What telemetry exists**, that it is opt-in, and what a single event contains.
- **Crash reporting** — per ALPHA-003's decision. If the answer is "local only,
  nothing is transmitted", say exactly that; it is a better sentence than most
  products can write and it should not be buried.
- **GitHub OAuth scope**, and the fact that the callback scheme remains `noodl://`
  because it is bound to an externally-registered redirect URI (REV-007).

### 2. Terms / EULA

Alpha-appropriate and short. The clauses that actually matter: no warranty, no
guarantee of data preservation across alpha versions, and that project format
changes may require migration. Say plainly that legacy Noodl projects are not
guaranteed to import, consistent with
[`COMPATIBILITY-POLICY.md`](../../reference/COMPATIBILITY-POLICY.md) — a user who
discovers that after installing has a fair complaint; one who read it first does not.

### 3. Licence hygiene

Add the `license` field to the root `package.json` to match `LICENSE`. Confirm the
bundled third-party licences are accounted for — `blockly`, `lucide-icons` (ISC),
`qr-code` (MIT) and `confetti` (MIT) all ship inside the product, and the library
modules were chosen partly *for* their licences (LIB-003), so the record exists and
just needs collecting.

### 4. Reachable from inside the app

About window and first run. A policy nobody can find is not a policy.

## Acceptance criteria

1. A privacy policy exists that names all six data flows above, each verified
   against the code rather than assumed.
2. Terms exist and state the no-warranty, no-data-guarantee and import positions.
3. The root `package.json` declares a licence matching `LICENSE`.
4. Both documents are reachable from the About window and shown at first run.
5. Someone who did not write them has read them and can answer, from the documents
   alone: *"if I never touch the AI features, does anything leave my machine?"*

Criterion 5 is the real test. If the answer is not obvious to a careful reader, the
document is decorative.

## Explicitly out of scope

Legal review by an actual lawyer. That is a decision for Richard and a cost; this
task produces the honest draft that such a review would start from, and says so
rather than pretending to be one.
