# Phase 79 — next session: the copy review

**Written 2026-08-28, end of session 3.** Richard, at the close of it:

> *"Can we make the next session prompt specifically about us reviewing the copy together, how the
> lesson presents itself, to set a precedent for all future lessons?"*

**So this session is not an engineering session.** It is the two of us reading lesson 1's words and
deciding how a NodeGX lesson sounds — once, so the next twelve inherit it instead of each one
re-deciding.

---

## 1. Why this is worth a whole session

Lesson 1 is **built, gated and driven** ([SYL-004](SYL-004-LESSON-1-YOUR-CREATURE-ON-SCREEN.md)) —
so nothing is blocked on it and there is no pressure to rush the words. What there *is*:

- 🔴 **Twelve more lessons inherit whatever we settle here.** Every choice below gets made again
  eleven or twelve times. Settling them once is the entire return on this session.
- 🔴 **The prose is currently mine.** The workshop's own split says the words that ship are
  Richard's. This is the pass that makes that true.
- ⚠️ **Lessons are served.** Published copy reaches every existing install with no update — so the
  voice we set is the voice already-installed users meet.

## 2. Read the copy from the file, not from a copy of it

🔴 **Do not paste the prose into this document or any other.** A second copy drifts from the
bundle silently, and then the review is of the wrong text. One command prints all of it:

```bash
python3 -c "
import json
d=json.load(open('project-examples/lessons/your-creature-on-screen/lesson.json'))
for i,s in enumerate(d['steps'],1):
    print('--- %d %s (%s)'%(i,s.get('title'),'popup' if s.get('kind')=='popup' else 'task'))
    print('BODY:');   print(s.get('body',''))
    if 'detail' in s: print('DETAIL:'); print(s['detail'])
    print()"
```

**467 words of `body`, 187 of `detail`, across 6 steps.** That is the whole review surface.

## 3. How to change a word — cheaply, and what it costs

**Prose only** (`title`, `body`, `detail`, `description`) → edit `lesson.json` in place, then:

```bash
npm run lessons:check > /tmp/lc.log 2>&1; echo "EXIT=$?"   # ⚠️ NOT `| tail` — $PIPESTATUS is empty in zsh
```

That is the whole loop. Prose does not touch the graph, so **no `derive_starter`, no
`create_lesson`, no re-drive.**

🔴 **The one exception, and it is the important one: `body` and `completeWhen` are a PAIR.**
If a rewrite changes *what the step asks for*, the condition has to move with it — and the
pressure only runs one way, because a condition **weaker** than its prose passes every gate
silently. The rule to hold:

> **If the body names a value, the condition is `paramsEqual`. If it genuinely does not matter,
> `hasParams` — and the step text should say so out loud.**

Changing a condition *does* mean re-running `derive_starter` → `create_lesson` → re-drive.

**To see edits in the editor**, the bundle must be re-installed — the running copy lives at
`~/Library/Application Support/NodeGX/Learning/your-creature-on-screen/`, separate from the repo.

## 4. 🔴 The precedent questions — the actual agenda

Each one is a choice lesson 1 has already made by accident. Ratify, or overrule and I will apply it
across the bundle.

### 4a. The `body` / `detail` split — the structural one, settle it first

Today: **`body` = what to do, then one short paragraph of why it works. `detail` = where the
control is, and what to do when it goes wrong.** Everything else follows from this, and it is the
one that most needs to be a rule rather than a habit — a later lesson that puts *why* into `detail`
hides the teaching from anyone who collapsed it.

⚠️ **The disclosure is collapsible and the learner's choice is remembered** (SYL-001 slice B). So
**nothing load-bearing can live in `detail`.**

### 4b. Punctuation — there is a real inconsistency to fix

🔴 **Richard's curriculum descriptions use em dashes; my step prose downgraded them to hyphens.**
Measured, not assumed — the *same sentence*, both files:

| | em dash `—` | hyphen-as-dash ` - ` |
|---|---|---|
| Richard's `curriculum.json` description | **1** | 0 |
| the bundle's `description` | 0 | **1** |
| all six steps' `body` + `detail` | **0** | **8** |

**Decide: em dash throughout, and I will fix all 9 instances.** ⚠️ It is a one-line `sed` away, but
it is the kind of thing that silently becomes house style if it ships once.

### 4c. Spelling — British voice, American product

Step 3's body says **Background Color** (quoting the UI label verbatim) and the surrounding prose
says *"any colour you like"*. That is defensible — quote the control, write the voice — but it is
currently an accident. **Rule it**: quoted UI labels keep the product's spelling, prose is British.

### 4d. Contractions

Currently none: *"you will have"*, *"it is"*, *"cannot"*. That reads formal. Richard's own
curriculum lines are similarly uncontracted, so this may already be right — but for the most
beginner-facing lesson we ship it is worth choosing on purpose rather than inheriting from me.

### 4e. Formatting of node names and labels

Today: node **types** in bold (**Group**, **Circle**), things the learner **types** in backticks
(`Card`, `Creature`). Consistent so far. Worth fixing as a rule because it is the convention most
likely to rot across twelve lessons.

### 4f. Do we say "node"?

*"Add a **Group** node"* in lesson 1 versus *"Add a **Group**"* later. Beginner-friendly early,
noise by lesson 5. **Is there a lesson where we stop saying it?**

### 4g. The forward hook

The outro ends: *"Your creature currently ignores you completely. That is the next lesson."*
The spine's own lede is *"each concept is motivated by a problem the last lesson left you with"* —
so a closing hook is arguably **mandatory**, not stylistic. If we agree that, every lesson owes one
and lesson 12 owes something else instead.

### 4h. How much "why" a task body gets

Currently one short paragraph per step. Is that the ration, or does the why belong only in the
popups, keeping task bodies purely instructional?

## 5. Lesson-1-specific calls, still open

- ⬜ **The badge**: `First Light`.
- ⬜ **Does the creature get eyes?** One Circle today. Eyes need absolute positioning, which is
  lesson 2's subject — so this is a real call, not a detail.
- ⬜ **The `description`** currently says "creature" where Richard's curriculum entry says
  "picture", because there is no picture yet ([SYL-003](SYL-003-THE-CREATURE-YOU-CHOSE.md)).
  ⚠️ **The curriculum file and the bundle each carry a description and they can drift.**

## 6. What we should write down at the end

A **LESSON-VOICE.md** in this phase, holding whatever §4 settles, and referenced from the MCP
authoring brief so the next lesson is written to it rather than to taste. 🔴 **That artefact is the
point of the session** — the edited copy is the by-product.

---

## 7. Everything else, briefly — none of it is this session's work

- **Lesson 1**: built, F1–F4 pass, `lessons:check` green, driven with a control pair.
  [SYL-004](SYL-004-LESSON-1-YOUR-CREATURE-ON-SCREEN.md).
- ⬜ **R2's `it-breaks-on-a-phone`** still needs Richard's `description`. Mechanics fully
  pre-cleared; it is a two-line data edit. See [the rulings](RICHARD-RULINGS-2026-08-28.md#r2).
- ⬜ **[SYL-002](SYL-002-THE-CHAIN-THAT-CANNOT-DRIFT.md)** still blocked: needs two spine lessons.
- ⬜ **[SYL-003](SYL-003-THE-CREATURE-YOU-CHOSE.md)**: the avatar picker, independent.
- 🔴 **Curriculum findings from Richard's stuck-list, awaiting his call**: the component system —
  which he named *first* — is spine lesson **10 of 12**; and **`Variable` appears in no lesson at
  all**, though he named it top-five.
- 🔴 **Unfixed product defect**: pressing "Check my work" on an incomplete step **removes the
  instructions** (body *and* the `detail` disclosure leave the DOM) and shows no new feedback. It is
  the runner, so `log-a-thing` has it too.
- ⚠️ **For whenever lesson 2 is built**: conditions take **type** names, and `Button`, `Variable`,
  `Text Input`, `Checkbox`, `Radio Button` and `Cloud Function` are the type names of the
  **deprecated** nodes. `poke-it` needs `net.noodl.controls.button`.
