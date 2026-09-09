# HLS-010 spike instrument

Kept, rather than deleted with the spike, for two reasons: **HLS-015 AC2 is graded with the
reverted arm this harness provides**, and a spike whose numbers cannot be re-run is a claim rather
than a measurement.

## What it is

`hls010-spike.ts` calls the editor's **real** `deployToFolder` in a plain Node process. It asserts
nothing — a stack trace is the answer it is after. `build-spike.mjs` is
`packages/noodl-preview/build.mjs` with the entry point swapped, so the bundle is built **exactly
the way `nodegx serve` is**; every alias and shim is the shipping one.

## Running it

🔴 **`cd packages/noodl-editor` first.** That is not incidental — it is finding C68. The deploy
runtime is addressed relative to `process.cwd()`, so from anywhere else this fails with
`ENOENT … /src/external/deploy/index.json`.

```sh
# 1. build (from anywhere)
SPIKE_OUT=/tmp/hls010.cjs node dev-docs/tasks/phase-83-behind-a-click/hls010-spike/build-spike.mjs

# 2. copy a project — 🔴 never deploy the original; deployToFolder does not set _isReadOnly (C69)
cp -R templates/landing-pages /tmp/lp

# 3. run, from the editor package
cd packages/noodl-editor
node /tmp/hls010.cjs /tmp/lp /tmp/deploy-out              # good arm
SKIP_LIB=1 node /tmp/hls010.cjs /tmp/lp /tmp/deploy-nolib # negative control (C67)

# 4. measure
cd -
node dev-docs/tasks/phase-83-behind-a-click/hls010-spike/measure-deploy.js /tmp/deploy-out   /tmp/lp
node dev-docs/tasks/phase-83-behind-a-click/hls010-spike/measure-deploy.js /tmp/deploy-nolib /tmp/lp
```

## What it should say

| | roots |
|---|---|
| good arm | `21 component(s) WITH a root, 0 WITHOUT` → ✅ |
| `SKIP_LIB=1` | `0 WITH a root, 21 WITHOUT` → 🔴 blank page |

Both arms report `deployToFolder RESOLVED` and write eight files. **That is the point.**

🔴 **Do not grade this with a connection count.** It reads **93/93 in both arms**. `roots` is the
field that moves, and `measure-deploy.js` is the thing that reads it.

## Reproducibility

Both arms were re-run after this folder was moved out of `packages/noodl-preview`, and produced
byte-identical bundle hashes — `index-842da8235ea3dad0.js` (good) and `index-8ab1c061cf564938.js`
(control).
