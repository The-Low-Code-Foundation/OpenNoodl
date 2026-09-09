# HLS-012 — The thread gets an answer

**Do this first. It is a reply, not a build.** @dominikstohl asked a reasonable, well-researched
question on a public repo on **2025-04-16** and has had no answer in seventeen months. The answer
takes one paragraph and we have it.

## 1. The person sentence

**Someone who asks a straight question about NodeGX on GitHub gets a straight answer.**

## 2. What the answer actually is

Measured 2026-09-09, so the reply can be specific rather than apologetic:

- The 2.9 `noodl build` CLI documented at `docs.noodl.net/2.9/cli/commands/build/` **was never part
  of the open-sourced code.** He is not blind. The only trace of a `noodl-cli` package in this repo
  is an abandoned plan in
  [`TASK-002` CHECKLIST.md](../phase-1-dependency-updates/TASK-002-legacy-project-migration/CHECKLIST.md),
  marked *"❌ replaced by GUI"*.
- There are now **two** different "builds", and #11 and #36 are about different ones — say so, with
  the README's §3 distinction, so the thread stops being one conversation about two features.
- What is genuinely close: `export` (§3), what is not: `deploy` (§3), and what is being built here.

## 3. Scope

- A reply on [#11](https://github.com/The-Low-Code-Foundation/NodeGX/issues/11) containing the answer
  above, naming this phase, and **not** promising a date (R1 is unruled).
- A reply on [#36](https://github.com/The-Low-Code-Foundation/NodeGX/issues/36) confirming the parts
  its measurements got right, naming the two it could not see from a sourcemap (the outbound deep
  imports, and the DEF-007 seam), and correcting the `deploy` row's price.
- Cross-link #11 ↔ #36 ↔ #23 ↔ #24 ↔ #31 ↔ #38 so the phase is legible from any of them.
- 🧭 Richard sends them, or approves the text. **An agent does not post to the community on its own
  account** — the replies are drafted here and handed over.

## 4. Acceptance criteria

1. **(person)** Open #11 in a browser as a logged-out visitor. The most recent comment answers the
   question that was asked, in the first sentence, without requiring the reader to open #36 first.
2. Each of #23, #24, #31, #36, #38 links to this phase or to the issue that carries its work.
3. Nothing in either reply states a release or a date (R1 is unruled — a relayed urgency decays
   into a deadline).

## 5. Traps

- 🔴 **Do not open the reply with an apology for the delay.** Answer the question; the delay is
  visible without being narrated.
- ⚠️ #36's field report links a `claude.ai/code/artifact` URL. Do not cite it as a source in a public
  reply — cite the repo paths, which anyone can check.
- 🔴 **Do not tell him to read `cline-dev` without saying why `main` looks empty** (finding 12). That
  is the actual cause of his confusion and of #36's sourcemap archaeology.
