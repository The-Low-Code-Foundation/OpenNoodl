# Publishing 0.2.0 — the prompt

**Written 2026-08-21**, after a day of fixing bugs found by using the alpha. Read
[RELEASE-PROCESS.md](../../guidelines/RELEASE-PROCESS.md) before touching §3.
The user-facing notes are [RELEASE-NOTES-0.2.0.md](./RELEASE-NOTES-0.2.0.md) — **in
the repo this time**, because the previous copy lived in a session scratchpad and
only survived by luck.

---

## ✅ DONE — the re-cut happened on 2026-08-21, 19:13Z. §0, §1 and §2 are CLOSED.

**The draft on GitHub now is the new one.** Everything below §0 is kept as the
record of how it was cut; read §3 and §4, not §1/§2.

| | |
|---|---|
| old draft | deleted (built from `6fdf9de2`, 42 commits stale) |
| `v0.2.0` now points at | **`ffc08ae0`** — the head of `cline-dev`, pushed |
| release run | [32515694302](https://github.com/The-Low-Code-Foundation/NodeGX/actions/runs/32515694302) — **all 6 jobs green** |
| draft | `isDraft: true`, **15 assets**, notes attached, **NOT published** |

Verified by reading the artifacts, not the ticks:

- **15 assets**, and `verify draft release is complete` printed
  `✓ all 9 expected artifacts are present, and latest-mac.yml covers both architectures`.
- **`latest-mac.yml` lists all FOUR mac files under one `version: 0.2.0`** —
  downloaded and read; the four sizes match the asset listing byte for byte.
- **Both mac legs signed and notarised** — `identityName=Developer ID Application:
  Osborne Solutions`, `notarization successful`, ticket stapled, on arm64 *and* x64.
- **Built from `ffc08ae0`** — the run's logs carry that sha three times and the old
  `6fdf9de2` zero times.
- `RELEASE-NOTES-0.2.0.md` is attached as the body, **"Known limitations" intact**.
  No Gatekeeper-bypass text anywhere, so §3's macOS warning is not at risk.

🔴 **WHAT IS LEFT IS §3, AND IT IS NOT A MACHINE'S JOB.** Clean-machine
verification cannot be done from this checkout — a dev machine has already trusted
the app, which is the exact failure §3 exists to prevent. Then a human clicks
Publish.

### ⚠️ §1a is now WRONG, and the correction is worth more than the step

**Do not run `npm run ci:build:editor` locally.** `pr.yml` has a
`Build (viewer + editor bundles)` job that runs `npm run ci:build:editor` verbatim
(`pr.yml:187`), and it went **green on `ffc08ae0` at 18:45:40Z** — the same commit
that was tagged. §1a's premise ("`pr.yml` had not run for a week") was true on
08-20 and is false now. The measurement already existed remotely; running it here
would have been redundant *and* risky, with the machine at **16.6G of 17.4G swap**
under a live editor stack.

### The two reds, re-measured by NAME on `0ce2e958` (`ffc08ae0` is docs-only over it)

- **`Test (editor)`: `2849 specs, 4 failures`, every one `AIX-006 style vocabulary`.**
  The floor, name for name — down from 10.
- **`Lint`: `tsfixme` only.** It fails first, so `colors`, `icons:css` and
  `tokens:css` are **skipped, not passed**.

Neither blocks: `release.yml` runs no tests at all.

---

## 0. 🔴 THE DECISION, AND IT COMES FIRST: THE DRAFT MUST BE RE-CUT

**Do not publish the existing draft.** It was built from the `v0.2.0` tag on
2026-08-20, and **41 commits have landed since — 14 of them fixes.** None of them
is in those artifacts.

```
git rev-list v0.2.0..cline-dev --count          # 41
git log v0.2.0..cline-dev --format='%s' | grep -cE '^(fix|feat)'   # 14
```

What publishing the current draft would ship to a first-time user:

| in the draft | reality |
|---|---|
| the twelve bugs Richard filed from using it | ❌ unfixed |
| the dark theme's grey-on-grey inks | ❌ unfixed |
| *Log a thing* | ❌ **impossible to finish** — see below |
| "21 problems" reported as a count | ❌ still a cap |
| inline `fx` expressions | ❌ still reported as invalid |

🔴 **The tutorial is the one that decides it.** `log-a-thing` grades steps against
the built-in database, and `Backend Services` — the only surface that can create or
bind one, and the only route to Schema and Data — was disabled inside every lesson.
The first actionable step of the tutorial we are shipping *could not be completed by
anyone*. Fixed in `0ce2e958` and **driven end to end on 2026-08-21**: database
created and bound on open, port listening, Schema reachable, step 1 validated by
Richard. That fix is **not** in the draft.

✅ **Re-cutting is clean, and RELEASE-PROCESS §2 already says why**: the draft is
`isDraft: true` and has never been published, so nothing is being rewritten that
someone could have pulled. The version in
`packages/noodl-editor/package.json` is **already `0.2.0`** — no bump is needed.

---

## 1. Before you re-cut

| check | expected |
|---|---|
| `git rev-list --left-right --count origin/cline-dev...cline-dev` | `0 0` — pushed and current |
| latest push run on `cline-dev` | 8 of 10 jobs green |
| `Test (editor)` | **4 failures, all `AIX-006 style vocabulary`** — the floor, see §4 |
| `Lint` | red on `tsfixme` only — a decision, see §4 |
| `npm run ci:build:editor` | **exit 0. Run it.** See §1a |

### 1a. 🔴 `ci:build:editor` is the cheapest way to not repeat 08-20

The first `v0.2.0` build failed on **all four platforms** at once, and every local
gate had passed: `getExcludedNodeModules()` is only reached when `production` is
true, so the dev config, `test:ci`, `typecheck`, `lint` and `test:main` never load
it. The only gate covering it is `ci:build:editor`, and `pr.yml` had not run for a
week. **Run it before tagging.** It is the production bundle path and nothing else
touches it.

---

## 2. The re-cut

```bash
# 1. the draft, and the tag it was built from
gh release delete v0.2.0 --yes
git push --delete origin v0.2.0
git tag -d v0.2.0

# 2. re-tag at the tip you actually want
git tag v0.2.0 <sha>            # the head of cline-dev, checked first
git push origin v0.2.0
```

⚠️ **`gh release delete` first, then the tag.** Deleting the tag while a release
still points at it leaves a release referencing nothing, which reads as a published
artifact with no source.

The tag push triggers the release workflow. It takes **~16 minutes** across four
legs plus `merge mac update feed` and `verify draft release is complete`.

### What the finished draft must contain — 15 assets, checked directly

Both mac arches (`mac-arm64.dmg/.zip`, `mac-x64.dmg/.zip` + blockmaps),
`win-x64.exe` (+ blockmap), `linux-x86_64.AppImage`, `linux-amd64.deb`, and
`latest.yml` / `latest-mac.yml` / `latest-linux.yml`.

- ✅ **`latest-mac.yml` must list all FOUR mac files under one `version: 0.2.0`.**
  A single-arch feed has no symptom on the machine that cut the release.
- ✅ **macOS must report `notarization successful`** and a stapled ticket.
- 🔴 **Do not read a published artifact as evidence a job was green.**
  electron-builder uploads as it goes, so a leg can put an AppImage in the draft
  and then fail building the `.deb`. `verify-release-assets` runs `if: always()`
  and names what is missing; its rules self-test with
  `node scripts/check-release-assets.js --self-test`.

---

## 3. Verify, then publish

🔴 **Verify on CLEAN machines, never a development machine** — a dev machine has
already trusted the app and masks signing problems.

- **macOS**: `spctl -a -vvv /Applications/NodeGX.app` → `accepted`,
  `source=Notarized Developer ID`; `xcrun stapler validate` → *"The validate action
  worked!"*; no Gatekeeper prompt on first launch.
- **Windows**: **unsigned.** `WIN_CSC_LINK` is unset and no artifact has been past
  SmartScreen. Keep the unsigned-install instructions in the **Windows** notes only
  — 🔴 **never paste them into the macOS notes**, which is signed and notarised;
  that text would tell mac users to bypass Gatekeeper for no reason.
- **Linux**: `chmod +x NodeGX-*.AppImage && ./NodeGX-*.AppImage` on a clean
  Ubuntu 22.04+.

Then: paste [RELEASE-NOTES-0.2.0.md](./RELEASE-NOTES-0.2.0.md), **keep the "Known
limitations" section** (auto-update downloads silently and installs on quit —
without that sentence it reads as broken to the person it is working for), and
**GitHub → Releases → the draft → Publish**.

🔴 **Rollback is forward, never down.** electron-updater never moves a user to a
lower version. A bad 0.2.0 is fixed by unpublishing it (edit → draft) and shipping
**0.2.1**.

---

## 4. What is red on purpose, and what is still open

**Two CI jobs are red and neither blocks the release** — `release.yml` runs no
tests at all.

- **`Test (editor)` — 4 failures, all `AIX-006 style vocabulary`.** Down from 10;
  the other six were two real bugs, both now fixed and both shipping in this cut
  (see §2b⁸/§2b⁹ of `NEXT-SESSION-PROMPT.md`). ⚠️ The job has **no baseline
  mechanism**, so a known-failure set reads red. **Compare by NAME, never by
  count** — a matching count is not a matching set.
- **`Lint` — `tsfixme` only.** +37 `TSFixme`, +125 `any`. **68% is test files**;
  32 of the 52 shipped-source additions are in one `.d.ts`. 🔴 **The "just type the
  one `.d.ts`" move was withdrawn and measured unavailable** — it breaks one of its
  own rules. What is left is to raise the baseline **visibly, in the PR**.
  ⚠️ `Lint` fails on `tsfixme` first, so `colors`, `icons:css` and `tokens:css` are
  **skipped, not passed**. Do not report them green.

### Still Richard's, and none of it blocks publishing

- **The tutorial is not published to the community platform.**
  `/api/v1/community/tutorials` is 200 and empty. Publishing one needs a public
  page at `community.nodegx.io/tutorials/log-a-thing` — Richard's copy to write.
  ✅ **Not on the critical path**: tutorials are *served*, not shipped, so
  publishing one later reaches every 0.2.0 install with no app update.
- **Production has no `ANTHROPIC_API_KEY`**, so *"Explain this for me"* answers
  `unavailable`. ~$0.03 per learner once ever. ⚠️ Intro pricing ends **2026-08-31**.
- **FIX-026 (put a deleted node back)** is deferred to a later phase by decision.
  🔴 Its stated foundation was false — `Learning/<slug>/` is the learner's working
  copy, and there is no pristine original beside it. Proved on this machine:
  `state-on-a-page`'s only source was in `/tmp` and has been **gutted**, so that
  lesson cannot be reset at all.
- **SUB-011's embrace-vs-freeze posture** is still an empty placeholder, and its
  out-of-scope rule ("no `fx` UI on more port types until it lands") is still live.

### Two loose ends worth an hour, not a release

- `plan-doc-writer.test.ts` settles an **asynchronous** undo write with a fixed
  `setTimeout(…, 30)`. It flaked once on CI and will again. Fix the constant.
- Nine local backends on the reference machine, several unowned leftovers.
