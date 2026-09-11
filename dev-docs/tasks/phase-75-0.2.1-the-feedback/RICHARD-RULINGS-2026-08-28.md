# Richard's rulings — 2026-08-28

_All nine answers to [YOUR-DECISIONS.md](YOUR-DECISIONS.md), captured verbatim with what each
unblocks. **Nothing below has been implemented yet** — this session captured the answers and ran
out of context. The work is queued in the phase files named against each._

---

## 🔴 FIRST: I was wrong about the API-key deadline, and the correction matters

Richard asked: *"Why is there a deadline on the API key? I didn't set one."*

**He is right — he didn't, and I mislabelled it.** Traced to source:

- The claim came from a note in `phase-15/AIX-007-NOTES.md`: Claude Sonnet 5 is priced at an
  **introductory $2/$10 per MTok through 2026-08-31**, reverting to $3/$15.
- **Checked against the current Anthropic pricing table this session: the intro rate and the
  2026-08-31 date are real.** It is Anthropic's pricing on a model, not anything Richard set.
- It **does** touch us: `models.ts:220` shows the shipped app's **default model is
  `claude-sonnet-5`**, priced in-repo at the intro rate.

🔴 **But it is NOT a deadline, and I put it at the top of a decisions page as one — with a
three-day countdown and a 🔥.** Nothing breaks on 31 August. Obtaining a production key by then
does not lock the rate in. It is a ~50% list-price rise on the default model: a **budgeting fact**,
not an action with a clock.

The code itself already said so, at `models.ts:226`: *"A stale price here does not break requests,
it only misreports cost."* The single real consequence is that **our cost reporting goes wrong on
1 September unless one line is updated** — and that line is mine to change, not Richard's.

⚠️ **Two separate notes got fused into one urgent item**: "we need a production API key" (real, open,
**no deadline**) and "Sonnet 5 intro pricing ends 31 Aug" (real, a price change, **not an action**).
This is the register's relayed-conclusion trap: a footnote in a costing note became a banner three
phases later. ✅ **Relay the measurement, not the conclusion — and re-derive urgency at the point
you assert it.**

**Queued:**
- ⬜ Update `pricing` in `models.ts:227` to `$3/$15` on or after 2026-08-31 (one line, ours).
- ⬜ Production `ANTHROPIC_API_KEY` — still genuinely open, still Richard's, **no deadline**.

---

## The nine answers

### 1. ✅ Moderator handle — `richardosborne14` / `richard@digitalbricks.io`

> *"I think I signed up with my Github so I'd be richardosborne14 or richard@digitalbricks.io"*

**Queued:** ⬜ Confirm which value `isModerator` compares against (GitHub handle or email) by reading
the C5 allowlist code, add it to `~/nodegx-community-deploy.env` as `NODEGX_MODERATORS`, deploy with
`ops/deploy.sh 49.12.102.195`, then **drive the hide against production** — the verb has still never
run outside a spec. ⚠️ **Read the comparison before writing the value**; putting the wrong one of the
two in the file leaves the route 404ing exactly as it does today, and looks identical.

### 2. ✅ Channels — but admins can create new ones without a code change

> *"Let's do channels, but let the admins create new channels for the community without modifying the codebase"*

**This is a scope change, not just a ruling.** Today four channels are hardcoded. Making them
admin-editable means: a `channels` table, an admin surface to add/rename/retire one, and every place
that treats the channel set as a fixed enum re-pointed at the table.

⚠️ **Retirement, not deletion, is the hard part** — a channel with posts in it cannot simply vanish.
Ruled implicitly by "create"; the retire path needs designing.

**Queued:** ⬜ New task in P75 §FB-013 — *admin-managed channels*. Free tags stay unbuilt: this
answers the "good tagging" question as **channels, made flexible**.

### 3. ✅ Dim red for the delete button — and that alone does not finish the job

> *"Dim red for the delete button"*

Measured this session, both themes:

| | dark | light |
|---|---|---|
| white label on `danger-dim` | **4.83** ✅ | **6.57** ✅ |
| `danger-dim` edge on the dialog | **2.61** ❌ | 5.96 ✅ |
| `danger` edge on the dialog | **4.52** ✅ | 4.38 ✅ |

Richard's choice **fixes the label**, which was the half that was actually failing (white on bright
`danger` is 2.79:1 in dark). But `danger-dim` as the *outermost* tone leaves the button's boundary at
2.61:1 in dark — still under 1.4.11's 3:1.

✅ **The implementation that honours the ruling and clears both:** fill `danger-dim` **plus an
explicit `danger` border**. Label 4.83 / 6.57, boundary 4.52 / 4.38 — both pass, both themes. This
is a reading of the ruling, not a departure from it, but it is **flagged for Richard to reject** if
he wanted a ringless button.

**Queued:** ⬜ `.DeleteConfirmationDeleteButton` in the border sweep — un-pin the known-open defect,
implement, mutate. ⬜ Then the same pair across the **other six** `danger`-as-white-labelled-fill
stylesheets (`PrimaryButton`, `CellEditor`, `DataGrid`, `EasyMode`, `AddColumnForm`, `TitleBar`).

### 4. ✅ Unlock Backend Services when a tutorial needs the database — option (a)

> *"unlock backend services when a tutorial needs a DB"*

**Queued:** ⬜ FIX-027 items 14/15/16. Derive the unlock from the lesson's own step conditions (a
step carrying a collection condition unlocks the panel) rather than a hand-maintained flag —
`lessonprotection.ts` already computes what a step needs. ⚠️ Item 16 is separate and still open: the
lesson says *"the Data panel"* while the rail says *Backend Services* — a wording fix in
`log-a-thing/lesson.json`, needed whichever way the unlock is built.

### 5. ✅ Restore deleted lesson nodes — option (a), and the reasoning is recorded

> *"Go for a. — I don't think a lot of people will leave a tutorial in the middle and wait weeks
> before picking it up, and if they do and the folder is gone then they start again"*

✅ **The stated reason matters more than the choice** — it says the weeks-later learner is an
acceptable loss. That is the assumption (b) would exist to remove; if it ever turns out to be wrong,
this line is what to revisit. Recorded so the next session doesn't re-litigate it.

**Queued:** ⬜ FIX-026, option (a): resolve the source the same way `reset()` does, refuse with the
same shape of message when it has gone. Roughly a day.

### 6. ✅ Intake questions should change the path — on three axes

> *"The intake questions should change if the learner gets recommended beginner, int or advanced
> tutorials, and if they get more visual functions or code functions tutorials, if they want to try
> JS or not basically. Everything else is probably common to everyone"*

That is a complete spec, and a small one:

| axis | values |
|---|---|
| **Level** | beginner / intermediate / advanced |
| **Function style** | visual functions ↔ code functions (i.e. *"do you want to try JS?"*) |
| everything else | common to all learners — **explicitly out of scope** |

**Queued:** ⬜ FIX-027 item 22. Needs each tutorial tagged with a level and a function-style, then
`pathing.ts` filtering on the two answers. ⚠️ **The tags are content, not code** — they land in the
same pass as the tutorial batch, so this task follows the new tutorial phase rather than leading it.

### 7. ✅ Retire *state on a page*

> *"retire the states on a page tutorial"*

**Queued:** ⬜ Remove the bundle reference, and take the `state-on-a-page` blocker off FB-012's
pipeline item — the "ships from nowhere" question closes with it. Its slot in the batch goes to
**"A page that remembers"** from the tutorial workshop's list.

### 8. ✅ The `tsfixme` gate — my call, hygiene matters

> *"I dunno about the 'fix this later' thing, I leave that decision up to you, but codebase hygiene
> is important to me"*

**Taking the decision, and taking the hygiene point seriously:**

1. ⬜ **Reorder first** so a `tsfixme` failure stops masking the three checks behind it — two of
   those verify colours and icons, i.e. exactly the class of defect the border sweep keeps finding.
   **This is the part that matters and it is not a judgement call.**
2. ⬜ **Then re-baseline** the ratchet to today's number so the gate is honest and holds the line.
3. ⬜ **Then a paydown task** — ~37 markers across 45 files — scheduled, not open-ended, so the
   baseline ratchets *down* rather than being frozen at the high-water mark.

⚠️ Step 2 alone would be the version that quietly blesses the debt. Step 3 is what makes it hygiene
rather than accounting, and it is the one to defend if the phase runs short.

### 9. ✅ Templates and the syllabus each get their own phase

> *"Let's make a few templates in a new phase please"* · *"Let's make a phase to fill in the syllabus."*
> *"Let's continue working on the phase 77 site builder template and work on other ones later in a
> new phase (the other ones from the list we made, can't remember where it is)"*

- **[phase-78-the-templates](../phase-78-the-templates/)** — created this session. The template batch,
  including the other site-builder templates once the list is found.
- **[phase-79-the-syllabus](../phase-79-the-syllabus/)** — created this session. Filling in the 15
  lessons that exist as titles with no words.
- **P77 continues unchanged** on the site-builder template — a peer is mid-SBR-003 on it.

🔴 **I could not find "the list we made".** Searched `phase-70/71/76/77`, the P75 task files, and the
adjacent-markets research for a named list of template ideas; the only concrete set is *"Richard's
eight 0.2.1 templates"*, referenced in P75 TASKS but **never enumerated anywhere in the repo** —
and three of those eight are the ones with no honest category. ⬜ **Ask Richard where the list is,
or re-make it with him** — it is the first task in phase-78.
