# The tutorial workshop — you bring the ideas, I build them

**Filed:** 2026-08-28, at Richard's request: *"can we not make a task where you and I build them
together and I supply the ideas? We already had some 'basic CSS' ideas to help people understand
responsive UI design."*

**Status: ⬜ open, ready to start.** Parent: [FB-012](FB-012-MORE-TUTORIALS-AND-A-WAY-TO-SHARE-THEM.md),
whose section (a) already proposed exactly this and has been waiting on a working format.

---

## Why this is worth a task of its own

The machinery is **done**. The pipeline that validates tutorials runs in CI. The authoring tools
exist. What's missing is the one thing I can't produce alone: **the ideas, and the voice**.

And the payoff is unusually direct — tutorials are **served from the web**, not baked into the app.
Every one we publish shows up for **everyone who already installed 0.2.0**, with no update and no
download. Nothing else in this phase does that.

Today the tutorial shelf shows **nothing at all**, for everybody.

## How a tutorial is actually built (so the split of work makes sense)

A tutorial is three things in a folder:

1. **The finished app** — the thing the learner will have built by the end.
2. **The starter** — the same app with the learner's work removed.
3. **The steps** — the instructions, plus a machine-checkable condition for each one, so the app can
   tell the learner "yes, you've done that".

The useful part: **I don't build the starter by hand.** There's a tool that produces it by
*subtracting* the lesson steps from the finished app. So the honest order of work is: build the
finished thing, mark what the learner does, and the starting point falls out automatically and can
never drift from it.

## The split

**You bring — per tutorial, roughly a paragraph:**

- Who it's for, in one line. (*"Someone who's dragged a few nodes around and doesn't know why their
  layout breaks on a phone."*)
- **What they'll have built at the end.** Concrete and demoable.
- **The 3–6 things they must actually understand** by the end.
- Anything you've seen a real person get stuck on — those make the best steps.

**I bring:**

- Build the finished app in NodeGX and check it's genuinely clean (the validator counts errors; our
  one existing tutorial scores 0 and I'd hold new ones to that).
- Propose the step list, with the completion condition for each.
- Derive the starter, run the CI gate, publish it as curated.

**Then back to you:** the step instructions are **learner-facing prose in your voice**. I'll draft
them so you're editing rather than staring at a blank page, but the words that ship should be yours.
This is the bit I'd most like you not to delegate.

## Proposed first batch — five, starting with yours

| # | working title | teaches | notes |
|---|---|---|---|
| 1 | **Make it fit any screen** | why fixed pixel widths break, how a group's direction and alignment actually behave, and using the preview size switcher to see it | **Your responsive-UI idea.** I'd make this the flagship — it's the single most common beginner wall, and it demos beautifully |
| 2 | **Put something on a page, and style it** | the absolute floor: add a component, set text, change a colour, see it in preview | The first rung. Our own design notes use nearly this sentence as the test of whether the format works at all |
| 3 | **Log a thing** | collections, writing a record, reading it back | ✅ **Already built and clean.** Blocked only by the panel decision in [YOUR-DECISIONS.md](YOUR-DECISIONS.md) §4 |
| 4 | **A page that remembers** | variables and state — why the value resets and how to keep it | Replaces the orphaned *state on a page*, which ships from a folder that no longer exists |
| 5 | **Show something from the internet** | calling an API and drawing the result | The "now it's a real app" moment |

**Suggested order:** 1 → 2 → 4 → 5, with 3 folded in as soon as the panel question is answered.
One tutorial per working session is a comfortable pace; the first will be slower while we settle the
house style.

⚠️ **Each one also needs two or three sentences of web description** — the community page won't
publish a tutorial without them. Small, but it's writing, and it's yours.

## To start tutorial #1, I need this from you

Copy this, fill it in, and I'll come back with a built app and a draft step list:

```
WHO IT'S FOR:
WHAT THEY'LL HAVE BUILT BY THE END:
THE 3-6 THINGS THEY MUST UNDERSTAND:
WHERE YOU'VE SEEN PEOPLE GET STUCK:
ANYTHING IT SHOULD DELIBERATELY NOT COVER:
```

That last line matters more than it looks — the fastest way to make a tutorial bad is to let it
teach four things at once.

## Acceptance

1. Five tutorial bundles exist, each passing `npm run lessons:check` with **0 validator findings**.
2. Each has a starter derived from its own solution, so the two cannot drift apart.
3. Each is published as `curated` and visible on the community tutorials page.
4. Each step's completion condition has been driven — a real click-through, not just a passing test.
5. The prose is Richard's, or Richard-edited.

## Notes carried from FB-012

- Authoring surface: MCP `get_lesson_brief` / `create_lesson` / `check_lesson` / `derive_starter`.
- Gate: `npm run lessons:check` (`scripts/check-lesson-bundles.ts`), its own CI job, itself
  mutation-graded — 7 deliberate breakages plus an empty-corpus check.
- Publishing: `publish-tutorial-bundle.ts` attaches a bundle to a community article; the article
  body cannot be empty, which is why each tutorial needs its couple of sentences.
- ⚠️ The corpus today is **one** bundle (`log-a-thing`), and production has **zero** published
  tutorials.
