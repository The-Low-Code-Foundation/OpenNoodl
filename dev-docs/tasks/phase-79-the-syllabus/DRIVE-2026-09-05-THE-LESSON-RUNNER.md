# The lesson-runner drive — lessons 2, 3, 4 and 5

**Run 2026-09-05, session 8.** The first job five hand-offs in a row have named, and the one thing
no spine lesson except lesson 1 had ever had done to it: **a lesson graded by the runner inside a
running editor.** All four undriven spine lessons now have a control pair.

## How it was set up

A **fresh profile** — `NOODL_USER_DATA_DIR=<scratchpad>/profile npm run dev:debug -- --quiet`, seeded
with nothing but `firstRunLegal.json`. Richard's own profile was never touched, read or written.

🟢 **The seed does the installing on its own.** A fresh profile opened the Learning tab with all
**8 shipped lessons already on the shelf**, "Not started 0%". No `learning_folder.json` surgery was
needed for the starters, and the native-file-dialog install path was never involved.

**The control pair, per lesson:**

| arm | what it is | what it must read |
|---|---|---|
| negative | the installed **starter**, untouched | *not complete* |
| positive | a **`[SOLVED]`** copy of the same install, with `components/Pages/Home/{nodes,connections}.json` replaced by the bundle's own `solution/` | *complete* |

🔴 **Why a second install rather than editing the open project.** Swapping a live project's files
underneath the editor is a race against its own flush. Copying the installed directory, patching the
two files that differ (`diff -rq` says only those two ever differ), and registering a second entry in
`learning_folder.json` makes both arms **cold opens of the same runner**, which is the thing being
measured. The register survived a renderer reload without the seed pruning the extra entries.

⚠️ **Every reading below was confirmed against the `Learning/` directory `mtime`** before being
believed — a click that silently misses looks exactly like a lesson that refuses to tick, and it
happened twice during this drive (see *What went wrong*).

## What it answers

| question | answer |
|---|---|
| 🔴 **does the runner grade a `connection` at all?** | ✅ **YES.** `Poke it [SOLVED]` finished, which needs all three of its connection conditions true |
| 🔴 **a wire whose source is 5 segments deep** | ✅ **YES** — `…:#Home:#Page shell:#Board:#Poke .onClick → /Pages/Home:#Poked .flip` |
| 🔴 **a 6-segment node path** | ✅ **YES** — lesson 2 step 3 grades `…:#Board:#Care:#Feed`, `#Play` and `#Sleep` |
| 🔴 **`paramsEqual` against a `{value, unit}` object** | ✅ **YES** — lesson 2's `maxWidth 560px` and `smallBreakpoint 480px` |
| 🔴 **a runtime-minted SIGNAL input** | ✅ **YES** — lesson 4's `Counter.increase` and `.reset` |
| 🔴 **a runtime-minted OUTPUT** | ✅ **YES** — lesson 4's `Counter.currentCount` into a `Text.text` |
| 🔴 **a port minted by what the learner TYPED** | ✅ **YES** — lesson 5's `{count}` in a format string and `pokes` in an expression, both graded as connection targets |
| 🔴 **`paramsEqual` round-tripping a string with `{braces}`** | ✅ **YES** — `format: "Nibbles has been poked {count} times"`, and the prose renders the braces intact |
| 🔴 **`Expression.result`** | ✅ **YES** — lesson 5 step 5 |
| 🔴 **the negative control** — does an untouched starter refuse? | ✅ **YES, all four**, observed on screen |

**The negative arm is what makes the positive arm mean anything.** Four lessons completing on open
would be equally explained by a runner that ticks everything it is shown; four starters *refusing*
on the same code path is what rules that out. Lessons 4 and 5 are the sharpest cases — their
starters already contain every earlier lesson's work, so they refuse on exactly the step they add.

| lesson | negative | positive |
|---|---|---|
| 2 `it-breaks-on-a-phone` | ✅ refused, 5 empty circles | ✅ *"Nice work"*, 5 ticks |
| 3 `poke-it` | ✅ refused | ✅ *"Nice work"*, 5 ticks |
| 4 `it-forgets-you` | ✅ refused, held at *"Looking for a Counter called “Pokes”"* | ✅ *"Nice work"* |
| 5 `show-what-it-feels` | ✅ refused, held at *"…format set to "Nibbles has been poked {count} times""* | ✅ *"Nice work"* |

## What it does NOT cover, stated rather than implied

- **The install-from-a-folder path.** Same gap lesson 1's drive recorded: the real installer goes
  through a native file dialog CDP cannot drive. The starters here arrived via the **seed**, which is
  the path every shipped lesson actually takes, and the folder picker stays covered only by
  `tut-004/the-real-bundle-installs.test.ts`.
- **A learner's own edit.** Both arms are cold opens. Nothing here observed a condition flipping from
  refused to complete *while the editor watched* — lesson 1's drive did that (add a `Card`, re-check,
  auto-advance) and it is still the only observation of it.
- **Whether a learner can physically draw a signal wire on the canvas.** The runner grades one
  correctly; that a person can produce one by dragging is a separate question this drive did not ask.

## What went wrong, and what it costs the next drive

🔴 **Two clicks reported success and landed nowhere.** `npm run cdp -- click` returns
`clicked … at x,y` whether or not anything received it. Both times the card was below the fold and
`scrollIntoView` had not settled. **`elementFromPoint` before every click**, and — because that can
still race — **confirm the consequence**: the `Learning/<id>` directory `mtime` moves the moment a
lesson project is opened, and it is the only honest witness to which copy is on screen.

⚠️ **A substring title match opened the wrong lesson.** Asking for a card whose text contains
`Poke it` matched **It forgets you**, whose description opens *"Poke it twice…"*. Match the card's
own `h3` exactly, then walk from each `Start` button up to its own `h3` — climbing up from the
title instead overshoots to the grid and stamps the first of ten buttons.

⚠️ **A click-through loop is not worth writing.** Fourteen scripted `NEXT` clicks advanced nothing;
one hand-issued click on the same button finished the lesson. Whatever the race is, the
`[data-drive]` stamp does not reliably survive the re-render between the `eval` that sets it and the
`click` that uses it. Drive these by hand — it is four commands per lesson.
