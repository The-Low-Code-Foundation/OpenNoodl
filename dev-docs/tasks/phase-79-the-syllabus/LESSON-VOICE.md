# How a NodeGX lesson sounds

**Written 2026-09-05, while building spine lesson 2.** The [next-session
prompt](NEXT-SESSION-PROMPT.md) asked for this artefact and said it was the point of that session:
settle the voice once, so the remaining eleven lessons inherit it instead of each one re-deciding.

🔴 **Every rule below is measured across the three bundles that actually ship**, not chosen. Where
the three disagree, the disagreement is stated and the call is marked ⬜ **Richard's**. Nothing here
has been applied to lesson 1 or `log-a-thing` — changing shipped learner-facing copy is his, and
each fix named below is a one-line edit whenever he says so.

Reproduce every number in this file:

```bash
python3 - <<'PY'
import json,re
CONTR=re.compile(r"\b\w+'(t|re|ll|ve|d|m)\b|\b(it|that|there|here|what|who|he|she|let)'s\b", re.I)
for name in ('your-creature-on-screen','it-breaks-on-a-phone','log-a-thing'):
    d=json.load(open(f'project-examples/lessons/{name}/lesson.json'))
    txt=d.get('description','')+'\n'+'\n'.join(s.get(k,'') for s in d['steps'] for k in ('title','body','detail'))
    print(f"{name:26} words={len(re.findall(chr(91)+'A-Za-z'+chr(39)+chr(93)+'+',txt)):5} "
          f"em—={txt.count('—'):3} ' - '={len(re.findall(' - ',txt)):3} "
          f"contractions={len(CONTR.findall(txt)):3} **bold**={len(re.findall(r'[*][*][^*]+[*][*]',txt)):3} "
          f"`code`={len(re.findall('`[^`]+`',txt)):3}")
PY
```

## The corpus this is measured on

| | steps | popups | graded | words | em `—` | ` - ` | contractions | `**bold**` | `` `code` `` |
|---|---|---|---|---|---|---|---|---|---|
| `log-a-thing` | 8 | 2 | 6 | 1132 | **11** | 0 | **0** | 44 | 53 |
| `your-creature-on-screen` | 6 | 2 | 4 | 695 | **0** | **9** | **0** | 26 | 13 |
| `it-breaks-on-a-phone` | 7 | 2 | 5 | 1098 | **16** | 0 | **0** | 39 | 36 |

---

## 1. Structure — settled, all three agree

- **A lesson opens and closes with a `kind: "popup"`.** All three do. The intro says what you will
  have built and why it is worth the time; the outro names what you learned and hooks forward.
- **Four to six graded steps between them.** The brief asks for three to six; the corpus runs 4, 5, 6.
- **One action per step, and the `title` says which.** Titles are imperative and short —
  *"Add the card"*, *"Make it fold"*, *"Give the row its own box"*.

## 2. The `body` / `detail` split — the structural rule, and the one that matters most

> **`body` is what to do and why it works. `detail` is where the control is and what to do when it
> goes wrong.**

🔴 **Nothing load-bearing may live in `detail`.** The disclosure is collapsible and this editor
remembers a learner who collapsed it ([SYL-001](SYL-001-THE-HAND-HOLDING-HALF.md) slice B), so a
step whose instruction is only complete once `detail` is open is a step that fails silently for
every experienced learner.

**This is not theoretical — lesson 2 nearly shipped with exactly that defect.** Its step 2 asks for
a **Max Width** of 560, and `Group.maxWidth`'s unit dropdown opens on `%` rather than `px`. Put the
unit in `detail` and a learner who had collapsed it would set 560 per cent, be told they had not
done the step, and have no way to find out why. The words *"with its unit set to **px**"* are in
`body` for that reason, and the explanation of the dropdown is in `detail`.

**The test to apply:** if a learner did only what `body` says, would the step pass and the app work?
If not, the missing half is not a detail.

## 3. Punctuation — ⬜ **decide once; lesson 1 is the outlier**

The [next-session prompt](NEXT-SESSION-PROMPT.md) §4b framed this as *"Richard's curriculum uses em
dashes; my step prose downgraded them to hyphens"*. **Measuring the third bundle changes the
picture**: `log-a-thing`, which shipped first, already uses **11 em dashes and no hyphen-as-dash**.

So em dash is the house style in **two of three** bundles, and lesson 1's **9** hyphens are the
anomaly — not a habit to ratify but a lesson to correct.

⬜ **Recommended: em dash throughout.** The fix is nine substitutions in one file:

```bash
# preview first — this rewrites shipped learner-facing copy
python3 -c "
import json;p='project-examples/lessons/your-creature-on-screen/lesson.json'
t=open(p).read();print(t.count(' - '),'occurrences of \" - \"')"
```

Not applied. The prose is Richard's.

## 4. Contractions — settled by measurement, no call needed

**Zero true contractions across all three bundles, 2,925 words.** Every apostrophe in the corpus is
a possessive (`node's`, `Repeater's`, `creature's`). So *"you will have"*, *"it is"*, *"cannot"* is
not one author's tic — it is what the shipped corpus already does, unanimously.

✅ **Rule: no contractions.** It reads a half-step more formal than conversational English, and for
prose someone is reading while looking at an unfamiliar editor that is the right trade.

## 5. Formatting — settled, all three agree

| what | how | example |
|---|---|---|
| a node **type** | `**bold**` | Add a **Group** node |
| an editor **control or panel group** | `**bold**` | **Size Mode** is in **Dimensions** |
| an enum **value** the learner picks | `**bold**` | set it to **Content Height** |
| a name the learner **types** | `` `backticks` `` | rename it `Board` |
| a value the learner **types** | `` `backticks` `` | set **Max Width** to `560` |
| emphasis inside a definition | `*italic*` | *be as tall as whatever is inside you* |

⚠️ **Bold is doing two jobs** — node types and editor chrome — and nothing distinguishes them. All
three bundles do it, it has not caused a problem, and inventing a third weight would be worse.
Recorded so it is a decision rather than a drift.

## 6. Do we say "node"? — ⬜ **Richard's, and it needs a rule before lesson 5**

Lesson 1 says *"Add a **Group** node"*. Lesson 2 says *"Add a **Columns** node"* on first mention
and drops it afterwards. `log-a-thing` mixes both freely.

The question the prompt asked — *is there a lesson where we stop saying it?* — is still open.
⬜ **Suggested rule: say "node" on a type's first appearance in a lesson, and not again.** That is
what lesson 2 does by accident, and it survives a learner who starts at lesson 7.

## 7. The forward hook — ✅ mandatory, not stylistic

The spine's own lede is *"each concept is motivated by a problem the last lesson left you with"*, so
a closing hook is a structural obligation, not a flourish. Both spine lessons end on one:

- lesson 1 → *"Your creature currently ignores you completely. That is the next lesson."*
- lesson 2 → *"Your creature now has a row of things to do, and not one of them does anything —
  `Feed` is a word, not a button. That is the next lesson."*

🔴 **The hook names a concrete deficiency in the thing the learner just built**, not the next
lesson's topic. And it constrains the build: lesson 2 deliberately ends with three words that do
nothing so that `poke-it` has an opening problem. ⬜ **Lesson 12 owes something else instead** —
unruled.

## 8. How much "why" a task body gets — settled by practice

**One short paragraph per graded step, after the instruction.** Never before it: the body is read
with one eye on the canvas, so the first line has to be the thing to do.

The outro popup is where the why is allowed to be three bullets and to generalise beyond the lesson.

## 9. Spelling — ✅ British prose, product spelling in quoted labels

Step 3 of lesson 1 writes **Background Color** (the UI label, verbatim) inside a sentence offering
*"any colour you like"*. That is right, and it is now a rule rather than an accident: **quote the
control exactly as the editor spells it; write the prose in British English.**

## 10. Grading, which is a voice decision as much as a technical one

> **If the body names a value, the condition is `paramsEqual`. If the value genuinely does not
> matter, the condition is `hasParams` — and the body says so out loud.**

Both lessons hold this. Lesson 1's step 3 tells the learner in as many words that any colour will
do; lesson 2's step 4 says the words in the three Texts can be anything, and that the *names*
are what matter.

🔴 **The pressure only runs one way.** A condition stronger than its prose is a hard refusal at
`create_lesson`. A condition weaker than its prose passes every gate silently and ships. So the
review question is always *"could a learner satisfy every condition and still have an app that does
not work?"* — never the reverse.

## 11. What is still Richard's on both spine lessons

- ⬜ All step prose in both lessons is drafted by Claude and awaits his edit pass.
- ⬜ Both `description`s. Lesson 2's is his R2 draft with *"size gets negotiated by groups,
  direction and alignment"* changed to *"width gets negotiated with a limit, a share and a
  breakpoint"*, because the lesson as built teaches those three and does not teach alignment.
- ⬜ Both badges: `First Light`, `Holds Its Shape`.
- ⬜ §3 (em dash) and §6 ("node") above.
