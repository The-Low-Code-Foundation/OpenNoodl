# UIX-010 — re-measurement and inventory (step 1)

**Date:** 2026-07-26
**Status:** step 1 (re-measure + inventory) done. The redraw and the `IconSize`
retune are **not** started, and §"Why the retune did not land here" says why that
was the right call rather than a shortfall.

---

## 1. The spec's numbers are stale — both of them

The task says "Measured at task creation (2026-07-26): **88 of 149**", and tells you
to trust the live count. Re-run of the command in the spec:

```sh
cd packages/noodl-core-ui/src/assets/icons/icon-component
ls *.svg | wc -l        # 154   (spec: 149)
grep -L 'stroke=' *.svg | wc -l   # 92  (spec: 88)
```

**154 glyphs, 92 fill-drawn.** Five glyphs and four fill-drawn ones arrived between
the spec being written and now. Anything in the spec computed from 88/149 — effort
estimate, "the remainder" framing — should be recomputed from 92/154.

## 2. `IconSize` is not mistuned, it is inert — with a number on it

UIX-011 residual 5 flagged this; here it is quantified.

`IconSize` maps to four class names (`is-size-default` / `-large` / `-small` /
`-tiny`) and `Icon.tsx` applies them as `css[size]`. **`Icon.module.scss` defines
none of the four.** CSS modules are locally scoped, so the `is-size-*` rules that do
exist elsewhere (`TabBar`, `Checkbox`, `Title`, `Label`, `Select`, …) are different
classes in different files and cannot apply here. `css[size]` is `undefined`,
`classNames` drops it, and the attribute never reaches the DOM.

**130 call sites across `noodl-editor/src` + `noodl-core-ui/src` pass
`size={IconSize.*}` and every one of them is a no-op.**

What actually sizes a glyph today: `.Root` has no dimensions and `svg { width: 100%;
height: 100% }`, so an `<Icon>` fills whatever box its host gives it. Sizing is
100% host-driven. That is *why* nothing looks broken despite the enum being dead —
and it is also why switching the enum on is not a cosmetic change.

## 3. Inventory of the 92

Regenerate with the script recorded in §6.

| viewBox | count | | viewBox | count |
|---|---|---|---|---|
| `0 0 31 31` | 30 | | `0 0 24 25` | 6 |
| `0 0 25 25` | 26 | | `0 0 31 30` | 4 |
| `0 0 24 24` | 20 | | `0 0 25 24` | 3 |
| `0 0 16 16` | 2 | | `0 0 30 30` | 1 |

Only **2 of 92** are already on the 16 grid. The spec's warning about rescaling
without re-fitting applies to essentially the whole batch.

**71 have consumers; 21 have none.** The 21 are delete candidates *subject to the
caveat below*:

```
arrows_in_line_vertical  chat_fill        check_circle_fill   checkbox
component_fill           dropdown         file_filled         note_pencil
page_input_arrow         pause_circle     plus_circle         plus_square
question_fill            radiobutton_group_line               roll
search_corner            search_square    seo                 star
viewport_horizontal_arrow                 viewport_vertical_arrow
```

⚠️ **`check_circle` / `check_circle_fill` must not be deleted on this evidence.**
They have no `IconName.*` consumer because the lessons task checkmark is *inlined*
as markup in `models/lessonformat.ts` and only **"kept in sync by shape"** with them
by comment (UIX-011 §3). A naive zero-consumer sweep deletes the reference shapes for
a live glyph. Two more — `component_fill`, `file_filled` — are not in the `IconName`
enum at all, so they are unreachable through `Icon` by any route and are the safest
deletions in the list.

Per-glyph table (file, stem, `IconName` key, viewBox, reference count):
`/tmp/uix010-inventory.json` when the script is re-run.

## 4. Confirmed hand-offs from UIX-011

Residual 4 handed over three glyphs; all three check out as fill-drawn:

| glyph | viewBox | consumers |
|---|---|---|
| `lightning` | `0 0 16 16` — already on grid, needs stroking only | 1 |
| `pin` | `0 0 24 24` | 1 |
| `pin_fill` | `0 0 24 24` | 1 |

## 5. Why the retune did not land here

The spec is explicit that the `IconSize` retune goes **last and live**: *"verified
against a running editor rather than swapped as a blind constant change"*, because
*"a size change ripples through rail, toolbar, panels, and launcher simultaneously —
this is the step that needs eyes"*.

Switching the enum on is a bigger change than the spec anticipated, because it is not
a retune of working sizes — it is **turning on sizing that has never been on**, at 130
call sites whose authors picked a value that has never had an effect. Whatever those
call sites *meant* has never been seen, so there is no "before" to compare against.

And the one thing the spec demands for it — a live before/after screenshot corpus —
was not available: this checkout has concurrent sessions writing to it, and HMR
re-mounts the editor mid-capture (see LIB-005-NOTES, "Trap: HMR from a concurrent
session"). Landing it blind is the specific failure mode the spec was written to
prevent, so it is left for a session with a quiet checkout.

**Recommended order when it is picked up:** decide first whether `IconSize` should
exist at all. The honest options are (a) delete the enum and its 130 call sites,
formalising host-driven sizing, which is what the app already does and demonstrably
looks fine; or (b) give it real per-context px values and accept a 130-site visual
diff. (a) is a smaller change than (b) and loses nothing that is currently working.
The spec assumes (b); it was written before anyone knew the enum was dead.

## 6. Regenerating this

```sh
node <<'JS'
const fs=require('fs'),path=require('path'),cp=require('child_process');
const R='packages/noodl-core-ui/src', I=R+'/assets/icons/icon-component';
const tsx=fs.readFileSync(R+'/components/common/Icon/Icon.tsx','utf8');
const body=tsx.slice(tsx.indexOf('export enum IconName'),tsx.indexOf('export enum IconSize'));
const byStem=new Map([...body.matchAll(/(\w+)\s*=\s*'([^']+)'/g)].map(m=>[m[2],m[1]]));
const fill=fs.readdirSync(I).filter(f=>f.endsWith('.svg')&&!/stroke=/.test(fs.readFileSync(path.join(I,f),'utf8')));
for (const f of fill){const stem=f.replace(/\.svg$/,''),key=byStem.get(stem);
  const n=key?+cp.execSync(`grep -rn "IconName\\.${key}\\b" packages/noodl-editor/src ${R} --include=*.ts --include=*.tsx | grep -v index.bundle.js | wc -l`,{encoding:'utf8'}).trim():0;
  console.log(n,f,key||'(not in IconName)');}
JS
```

Count `size={IconSize.` occurrences the same way to re-check the 130.
