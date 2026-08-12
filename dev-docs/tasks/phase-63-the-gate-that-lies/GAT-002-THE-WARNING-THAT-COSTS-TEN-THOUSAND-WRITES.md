# GAT-002 — The warning that costs ten thousand writes

**Status:** 📋 open · **Tier 1: speed** · ~30 minutes · independent of everything else

## The observation

Across four runs on 2026-08-12, one repeated line was **68–76% of all log output**:

| Run | Lines | `Warning: we have more that 10000 listeners…` | Share |
|---|---|---|---|
| 19:10 (passed) | 17,406 | 12,368 | 71% |
| 22:31 | 12,082 | 9,163 | 76% |
| 22:55 | 13,615 | 9,412 | 69% |
| 23:40 | 15,396 | 10,496 | 68% |

## Why one `console.log` is not one `console.log`

[`model.js:17-19`](../../../packages/noodl-editor/src/shared/model.js):

```js
if (this.listeners.length > 10000) {
  console.log('Warning: we have more that 10000 listeners on this model, is this sane?');
}
```

The guard is `>`, not `===`. So it is not *"warn when we cross ten thousand"* — it is **warn on every
single `on()` call for the rest of the process's life**, once the array has ever passed 10,000.

And this runs in an Electron **renderer**, whose console is forwarded to stdout by
[`test.js:161-165`](../../../packages/noodl-editor/test.js):

```js
win.webContents.on('console-message', ({ level, message }) => {
  if (isCI || level === 'warning' || level === 'error') {
    console.log(`[renderer] ${message}`);
  }
});
```

`isCI` is true, so **every** renderer console message — not just warnings — crosses the renderer →
main IPC boundary and is written to a pipe. Ten thousand of them, in a run whose actual output is
about 2,700 spec lines.

## §1 — Warn once

`===` rather than `>`, or a latch. Either is a one-line change.

⚠️ **Keep the warning.** It is the only signal that the leak exists, and GAT-004 will want it while
working. The defect is the repetition, not the message.

⚠️ **A count is worth more than a latch.** *"12,368 registrations past the 10,000 mark"* tells GAT-004
the size of the problem; *"we crossed 10,000"* tells it nothing it did not already know. Report the
final count at the end of the run rather than the fact at the start.

## §2 — Decide what CI actually wants forwarded

`isCI ||` forwards `debug` and `info` from the renderer too. That is deliberate — `[spec-start]` lines
come through it and they are how a hung run's last spec is identified, which has been genuinely useful.

So this section is a **decision, not a cleanup**:

- keep `[spec-start]` (it names the spec a hang died in);
- ⚠️ **do not blanket-suppress `info`** to make the log shorter — that is how the next hang becomes
  undiagnosable, and this repo has a filed instance of exactly that reasoning going wrong (the
  10,000-listener flood was itself once mistaken for a defect signature *because* nobody had grepped a
  passing log).

The honest scope here is: forward what identifies progress, drop what is a repeated constant.

## §3 — Measure the saving, do not assume it

⚠️ **This task's own trap.** It is obvious that removing ~10,000 synchronous IPC writes makes a run
faster. It is **not** obvious by how much, and "obvious" is how this repo has previously shipped a
performance claim it could not defend.

Measure: one run before, one after, same tree, same seed (`NOODL_SPEC_SEED`), quiet machine, from
`tests/test-results.json` and wall clock. Record both numbers. If the saving is under a minute, say
so — it is still worth doing for the log's legibility, and a small honest number is better than an
implied large one.

## Acceptance

- A run that crosses 10,000 listeners logs the warning **once**, and reports a final count.
- `[spec-start]` still appears, so a hung run still names its last spec.
- The before/after wall-clock difference is measured at a pinned seed and **written down**, whatever
  it turns out to be.
- ⚠️ The listener leak is **unchanged** — this task does not touch it, and its acceptance must not be
  read as having fixed anything. See GAT-004.

## Register

| # | Finding | State |
|---|---|---|
| G7 | The warning fires on every `on()` past 10,000, not once at the crossing — the guard is `>` | ✅ read in source, `model.js:17` |
| G8 | It is 68–76% of all log output across four measured runs | ✅ measured 2026-08-12, four logs |
| G9 | In CI, *all* renderer console output is forwarded across IPC, not just warnings | ✅ read in source, `test.js:162` |
| G10 | The flood is **normal in a passing run** and its volume tracks how far the run got | ✅ standing repo knowledge, confirmed again here: the *passing* run had the **most** (12,368) |
| G11 | How much time it actually costs | ⚠️ **unverified — §3 exists because of this.** Per-line IPC cost on this hardware has never been measured |
