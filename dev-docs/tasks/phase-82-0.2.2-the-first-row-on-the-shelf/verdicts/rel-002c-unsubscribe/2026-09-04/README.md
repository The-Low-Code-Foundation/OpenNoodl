# `/unsubscribe`, door arm, after judgement 3 — 2026-09-04

The four **full-page** shots and their text dumps for the one page Richard ruled **SHITTY** on
2026-09-04, taken after the way back was built.

🔴 **This is a HAND-PICKED subset, and saying so is the point.** The run was
`vib001-members.look.ts`, **EXIT=0, 2/2, 60 shots**, writing the whole 44 MB verdict tree at
`phase-81/verdicts/vib-001/2026-09-04/`. **That tree is deliberately NOT committed** — one page
changed, and 44 MB of unchanged re-renders would ride on a branch that is already several hundred
commits behind a push. Only this page's evidence is kept, and it is copied rather than moved, so the
manifest in the phase-81 tree still describes the run that produced it rather than this directory.

Reproduce the whole run with:

```
npx jest --config packages/nodegx-backend/jest.config.js \
  --testMatch '**/tests/**/*.look.ts' --runTestsByPath \
  packages/nodegx-backend/tests/vib001-members.look.ts
```

## What the shots show

| width | content | scrolls | unreachable |
|---|---|---|---|
| 988 (preview) | 713px | yes | 0 |
| 1280 | 900px | **no** | 0 |
| 1900 | 1080px | **no** | 0 |
| 390 | 844px | **no** | 0 |

🔴 **The button is in and the void is still there.** The outline control *"Sign in to your account"*
sits under the notice; the footer begins about **220px** below it. §7.3 measured *"~190px of void
above its footer"* and the option Richard chose read *"the void closes"*. **A 60px control was added
to a 190px gap.** Whether that lifts the page off SHITTY is his ruling and nobody else's — see
[`RICHARD-RULINGS-2026-09-04.md`](../../../RICHARD-RULINGS-2026-09-04.md) §6.4.

⚠️ The render is the **refusal** arm — no token, which is the state the harness opens the page in
and the reader D39's own text says is most likely to want a way out. The confirmation arm carries a
longer sentence and therefore slightly less slack.
