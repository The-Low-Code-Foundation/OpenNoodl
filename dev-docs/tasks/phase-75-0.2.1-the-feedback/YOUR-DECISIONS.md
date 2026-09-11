# What's waiting on you — in plain English

_Written 2026-08-28. No jargon, no code. Every item says what I need, what happens if you say
nothing, and what I'd do in your shoes._

There are **three kinds** of thing here:

1. **Two-minute answers** that are blocking finished, tested work from doing anything at all.
2. **Design choices** where I genuinely need your taste, not your permission.
3. **Content** — words and ideas only you have. This is the big one, and it's why the community
   tab is empty for every person who installs NodeGX today.

---

## 🔴 CORRECTION — the "deadline" I put at the top of this page was wrong

**Richard asked: "Why is there a deadline on the API key? I didn't set one."** He's right, and the
answer is that I invented the urgency.

- The claim traces to a costing note in an older phase: Claude Sonnet 5 is on **introductory pricing
  ($2/$10 per million tokens) through 2026-08-31**, after which it reverts to $3/$15.
- **That much is true** — checked against Anthropic's current pricing this session — and it does
  affect us, because the shipped app's default model *is* Sonnet 5.
- **But it is not a deadline.** Nothing breaks on 31 August. Getting an API key by then does not lock
  the cheaper rate in. It is a price rise on a model, which is a budgeting fact, not a task.

The only real consequence: our **cost reporting** goes wrong on 1 September unless one line in the
code is updated to the new price — and that line is mine to change, not Richard's.

⚠️ **What actually happened:** two separate notes got fused. *"We need a production API key"* is real
and open, **with no deadline**. *"Sonnet 5 intro pricing ends 31 Aug"* is real and is **not an
action**. I relayed a conclusion instead of the measurement behind it, and it grew a 🔥 and a
countdown on the way.

**Still open, still Richard's, no clock:** a production API key, and a decision on whether AI
features are on by default or behind a setting.

## ⏱️ The two-minute answers

These are finished, tested features that currently do nothing because one line is missing.

### 1. Who is allowed to hide an abusive message?

**What's built:** Chat moderation. Someone posts something vile, a moderator hides it. It's
written, tested (21 tests, 4 deliberate sabotage checks all caught), and it is **switched off**.

**Why it's off:** The system decides "are you a moderator?" by checking your handle against a list
in a settings file on the server. **That list is empty.** So the hide button returns "not found"
for everybody — including you. This feature has never once run outside a test.

**What I need:** Your community handle. That's it. One line, then I deploy and we watch it work.

**If you do nothing:** You have no way to remove anything anyone posts, on a public community.

> ⚠️ I've now written this same one-line request into ten consecutive handover notes. That's my
> failure, not yours — it needed asking directly, and this document is me asking directly.

### 2. Do you want tags, or are channels enough?

**What you said:** you wanted *"good tagging"*. What we ruled later was that users can't invent
their own tags.

**What's built:** Posts live in one of four **channels**, and the channel acts as the category.
There is no separate tag system.

**What I need:** Is that what "good tagging" meant? If yes, we're done and I'll close it. If you
meant something richer — several tags per post, a tag cloud, filtering by topic across channels —
say so now. **It's cheap to add and expensive to remove**, so the current no-tags default is the
reversible choice, but it's a default I picked, not a decision you made.

### 3. Which red for the delete button?

**The problem, concretely:** The "Delete" button in the confirm-delete dialog is red with white
text on it. In **dark mode** we can have *either* a readable label *or* a visible button edge, not
both:

|  | bright red | dim red |
|---|---|---|
| white text on it | ❌ hard to read | ✅ readable |
| its edge against the dialog | ✅ visible | ❌ nearly invisible |

Right now it uses the bright red at rest (so the white label is hard to read) and the dim red on
hover (so the button's edge nearly disappears while you're pointing at it). This same red is used
as a white-labelled button in **at least seven places** in the app, so it isn't a local fix — it's
a change to the palette.

**What I need:** two minutes looking at it in dark mode and telling me which bothers you more. My
recommendation: **darken the red slightly** so white text is comfortably readable on it, and keep
the edge for hover. That fixes all seven places at once.

---

## 🎨 The design choices — I need your taste here

### 4. A tutorial teaches the database, but tutorial mode switches the database off

**The bug, as you found it:** In *Log a thing*, step one tells you to click the **Data** tab. It
isn't clickable. The error message then helpfully suggests you go to **Backend Services** — which
is the exact panel that tutorial mode disables. **The lesson cannot be finished.**

**Why I haven't just fixed it:** Whoever disabled those panels was reasoning case by case — there's
a comment next to a *different* panel saying hiding it "would be a functional loss". So the
disabling was a decision, not an oversight, and I'd be overturning it blind.

**The real question:** a lesson that teaches the database has to be able to reach the database.
Three ways:

- **(a)** Unlock Backend Services **only** when a lesson step actually needs the database.
- **(b)** Unlock it always; keep the other two panels locked.
- **(c)** Let a lesson say "open this panel for me" as one of its steps.

**My recommendation: (a)** — the lesson's own steps already declare what they need, so nothing has
to be maintained by hand, and tutorial mode stays as focused as you designed it.

### 5. When a learner deletes something the tutorial needs, how do we put it back?

**The problem you raised:** it's easy to delete a piece of the tutorial app by accident, and then
the step can never be completed.

There is already a "Reset" — but it's a sledgehammer: it throws away **everything** the learner has
done. We want something kinder that puts back just the missing piece.

The catch is knowing what the piece *looked like* originally:

- **(a)** Look it up the same way Reset does. **Cheap, one day.** But it reads from a temporary
  folder, so the learner who most needs this — weeks in, folder long since cleared — is exactly the
  one it fails for.
- **(b)** Take a private snapshot when the tutorial is installed. **Always works**, even offline.
  Costs some disk space and adds a folder the learner can see.

**My recommendation: (a) now, (b) later** — (a) is a day's work and covers the common case, and (b)
slots in behind it later without redoing anything.

### 6. Should the three intake questions actually change the learning path?

**What happens now:** a new learner answers three questions about themselves, and the path they get
is **barely different** whatever they answer.

**What I need:** either "yes, make it matter" — and then I need to know what a beginner should see
versus someone who's built apps before — or "no, drop the questions", which is honest and takes
five minutes.

### 7. A tutorial that ships from nowhere

There's a second tutorial, *state on a page*, that exists in **neither** copy of the code. It's
referenced by a path on somebody's old temporary folder. It works today only because it's already
installed on machines that have it.

**What I need:** a decision on where it should live so it can be rebuilt and shipped properly — or
permission to retire it and replace it with one of the new ones we're about to write.

### 8. A quality gate is failing, and it's hiding three others

**In plain terms:** there's an automated check that stops the codebase getting sloppier over time.
It's currently failing — the code got sloppier faster than the limit allowed (about 37 new
"I'll-fix-this-later" markers across 45 files).

**The bit that actually matters:** because that check fails **first**, three other checks that run
after it — including two that verify colours and icons — **never run at all**. So one red light is
masking three switched-off ones.

**What I need:** pick one — (a) raise the limit to today's number and stop the bleeding from here,
(b) spend a session paying the debt down, or (c) reorder so a failure here stops hiding the others.
**My recommendation: (c) then (a)** — get the hidden checks running again today, then hold the line.

---

## 📝 The content — and why this is the highest-leverage thing you can do

**Right now, a person installs NodeGX, clicks Community, and finds three empty shelves.**

| shelf | what's there today |
|---|---|
| **Templates** | **Nothing.** The machinery is built, deployed and driven end to end. Nobody has published a single template — and by your own ruling, you're the one who publishes. |
| **Tutorials** | **Nothing.** The server honestly answers "0 tutorials". One tutorial bundle exists in the codebase; none are published. |
| **Syllabus** | 15 lessons exist as **titles with no words in them**. |

Two specific things I need from you on templates:

- You have **eight** templates earmarked for this release. **Three of them don't fit any of the
  categories we agreed** — so either we add a category, or those three get filed somewhere that
  misdescribes them.
- Each published template needs a couple of sentences of description. That's writing, not code.

**The leverage:** tutorials and templates are **served from the web**, not baked into the app. Every
one we publish appears for **everybody who already installed 0.2.0** — no update, no download. It's
the only work in this phase that improves the product for existing users the day it lands.

---

## ✅ And one thing that needs nothing from you

**The border sweep** — see [WHAT-IS-A-BORDER-SWEEP.md](WHAT-IS-A-BORDER-SWEEP.md). It's the ongoing
accessibility fix for buttons whose outlines were nearly invisible. 35 surfaces left, the shared
component library is finished, and the only piece needing you is the red-button question above.
