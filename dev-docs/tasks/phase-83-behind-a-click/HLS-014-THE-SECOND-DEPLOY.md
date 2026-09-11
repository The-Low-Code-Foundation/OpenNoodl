# HLS-014 — The second deploy

⚠️ **GATED on ruling R4 and HLS-010's verdict. Do not start this before both.** If R4 says the
legacy deploy gets no CLI, this task changes shape or disappears; scoped now so that decision is
made with it in view rather than discovered afterwards.

## 1. The person sentence

**An agent ships a change to an app that is already live, and knows afterwards whether the live app
is now the app it built.**

## 2. Why it is a separate task

Every other task in this phase describes **the first deploy**. Richard's lifecycle framing
(README §1b) makes "updates" a first-class case, and it is not the same case:

- the target is not empty — `checkTarget` today refuses a non-empty folder or asks the author to
  confirm, and **there is no author to confirm** in CI;
- a partial write leaves a live app half-updated, which is worse than a failed export into an empty
  directory;
- "did it work?" stops meaning "did the command exit 0" and starts meaning "is what is being served
  what I built" — which is the phase's own end condition, asked continuously instead of once;
- an agent doing this unattended is **the case with nobody watching**, which is the standing warning
  this whole phase is written around.

## 3. Scope

- Redeploy over a live target: what is replaced, what is preserved, what is refused.
- `checkTarget`'s confirmation becomes an explicit flag rather than an interactive prompt, and the
  default is the safe one.
- A verdict an agent can read and act on, including for a partial failure.
- 🔴 **A way to ask "what is live now?"** and compare it to what was built. Without this, "updates"
  is a fire-and-hope.
- **Out of scope:** rollback. Record it as a deliberate deferral with a reason — an undocumented
  dropped promise is the one state a promise must not be in.

## 4. Acceptance criteria

1. **(person)** Deploy an app. Change one page. Deploy again. Load the site: the change is there and
   nothing else moved.
2. A deploy interrupted part-way leaves a state the next deploy can recover from, and says which
   state it is in. Driven by actually interrupting one — an **abandoned arm**, because a defect that
   self-heals is invisible to every arm that completes.
3. The "what is live?" check is read from the **served artefact**, not from a local record of what
   was sent. A client-side property is a fact about the client.
4. A second identical deploy is reported as identical, not as a fresh success.

## 5. Traps

- 🔴 **A control can read zero. Read it first.** Before asserting "nothing else moved", establish
  that the instrument can see a thing moving.
- 🔴 **A post-drive check reads the state the drive left.** Snapshot before each arm.
- ⚠️ Do not let this task quietly become the deploy implementation. If HLS-010's verdict is that
  there is no `deploy`, come back to this file and change it — do not build one here.
