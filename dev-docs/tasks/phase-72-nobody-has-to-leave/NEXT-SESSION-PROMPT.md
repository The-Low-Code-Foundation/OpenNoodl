# Next session — phase 72

**Written 2026-08-19, eighth session.** **NAT-007's reading half landed, and it was driven against
a platform everybody thought was undeployed.** A thread now opens *in place* in the launcher tab
and the editor's rail, renders every post, and says honestly what it cannot do. **The writes —
reply and accept — are the whole of what is left, and they are one ruling away.**

## Read first, in this order

1. [NAT-007](NAT-007-A-THREAD-YOU-CAN-ACTUALLY-ANSWER.md) §Status — the AC table and six findings.
   🔴 **Read it before NAT-008/009/010/011**: it names the D15 branch order all four need, and the
   two ways this client has now silently outlived the platform's payload.
2. [NAT-015](NAT-015-A-GRAPH-YOU-CAN-PULL-INTO-YOUR-PROJECT.md) §Status — **it is blocked, and not
   for the reason anyone expected.**
3. `packages/noodl-editor/src/editor/src/models/community/threadview.ts` — the pattern a Tier-3
   surface's view model follows, and the six-branch state machine with its order argued.
4. [TASKS.md](TASKS.md) §The order, then [README §4](README.md) — five rulings open (D5, D6, D7,
   D8, D10).

## What happened this session

**`2d3960a7`.** AC1, AC2, AC3 and AC8 close; AC5 half-closes; AC4, AC6 and half of AC7 are writes
and wait on D5. Gates on the committed tree: `typecheck:editor` and `typecheck:editor-tests` clean ·
`test:main` **268 suites / 4350 tests / 0 failures** · core-ui jest **28 / 521 / 0**. 97 new tests,
**verified red 12 of 12**.

### 🔴 The platform is LIVE, and four handovers in a row say it is not

`https://community.nodegx.io/api/v1/community/threads` answers **200**, with two real threads
Richard posted from the editor this morning. `communityorigin.ts`, the task files and every
handover since UNI-001 say it is deployed nowhere. ✅ **Check it before you build a stub.** This
task's whole read half was driven end to end against the real thing, and two of the findings below
exist only because of that.

⚠️ The live wire really does carry `2026-08-19 11:19:27.206885+00` — NAT-006's pooled-connection
finding, in production, on the field every row and every post renders.

### 🔴 A field this client declared, the platform has never sent

`ForumThread.externalId` was a Discourse leftover. Both surfaces built their browser hand-off out
of it, so **every thread anybody clicked opened `/bench/undefined`.** Second time in this file:
the `{forum: 'absent'}` arm went the same way. Both sides compile, TypeScript checks the
declaration against its *consumers* and never against the wire, and the value arrives `undefined`
rather than as an error. ⚠️ **Neither was found by a test, and nothing would find the third.**

### 🔴 The port list renders twice — and fixing it here would be the bug

The post body says the ports in prose and the `node_excerpt` attachment says the same ports as
structured rows. Eleven ports, twice, one screen. **The web does it too** — measured on the same
thread, not assumed. So this editor is mirroring faithfully, and a unilateral fix would make the
editor disagree with the web, which is the one thing D15 says a mirror may not do. Left alone
deliberately; it is one decision on the composer/renderer pair.

### 🔴 NAT-015 cannot be built, and the reason is upstream of it

**Nothing anywhere composes a `graph_fragment`.** The kind is in the enum, the database accepts
it, the web renders it — and the editor *refuses* to emit one, on purpose, with a UNI-016 spec
asserting it never will. NAT-015's own first sentence is false and the file that made it false says
so. Building the producer means publishing an **unredacted** graph, which is P67's *"a port name is
user content whenever its type is"* at full strength — a ruling, a consent surface, and *then* the
S/M this task was scoped as. ✅ **The seam NAT-007 was told not to split is built and specced**, so
nothing is lost by the delay.

## Where to start

🔴 **D5 is now the highest-value decision in the phase, and it is cheaper than it looks.** One
fact, measured this session: the platform **already accepts the editor's device-flow bearer token**
on `POST /api/v1/bench/threads/:id/posts` — `apiViewer` reads the header, `answerThread` asks
nothing more. So D5 is not *"can it work"*, it is *"should an identity-scoped token post, or does
it need a re-consent step"*. Answering it closes **NAT-007 AC4, AC6 and AC7's second direction**,
plus NAT-006 AC5, plus the write half of NAT-009 and NAT-010. Nothing else in this phase unlocks
that much.

**If Richard is not available to rule**, the next best session is **NAT-008 (the people are the
product)** or **NAT-011 (the University beside your project)**: both are read-only surfaces, both
are unblocked, and both now have the vocabulary *and* the view-model pattern to copy. **NAT-004**
(light by default on the web, S, `nodegx-community`) is still the only unstarted Tier-1 task.

🔴 **Still do not close NAT-009 AC5, NAT-010 AC5 or NAT-013 AC4 on the strength of NAT-006.** They
close when mail reaches a human — NAT-014 AC2/AC7.

## Loose ends

- ⚠️ **Eight phase-72 files remain modified and uncommitted from previous sessions** (NAT-006/009/
  010/011/012/013 and the README). They carried somebody else's unlanded edits before this session
  and still do — my status sections were **inserted** into NAT-007/015 rather than written over
  them. Everything of mine is committed by pathspec.
- ⚠️ A peer landed TUT-001 work in `BackendServicesPanel`, `tsconfig.tests-main.json` and
  `tests-unit/tut-001/` during this session. Untouched, and the `test:main` figures above include
  their suites.
- ⚠️ **AC4's rail-and-launcher drive did not include a thread with an accepted answer**, because no
  thread on the live platform has one. The state is specced; it has not been looked at.
- ⚠️ **Storybook still does not start** (NAT-005 AC4), the ~99 fill-role files and the active-line
  contrast finding are unchanged from the last five handovers.
