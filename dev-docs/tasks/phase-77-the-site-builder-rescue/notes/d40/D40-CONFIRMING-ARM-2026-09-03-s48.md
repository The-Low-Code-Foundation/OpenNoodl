# D40 — the confirming arm, on a project the wizard made

**2026-09-03, session 48.** Owner **SBR-002**. This is the arm s47's fix write-up named as owed and
did not run: *"a **wizard-created project driven in the editor** was not re-driven — that is the
confirming arm and it is cheap, but it was not run."*

It has now run, and it reverses.

---

## 🔴 Which instrument this is, and which one it is not

`opennoodl-a0` raised the right hazard before this started: D40's own row records **two instruments
disagreeing** — phase 81 VIB-001 measured `unreachablePx = 0` on all 44 shots and concluded *"the
document scrolls regardless"*, while the judge's per-shot line for D40's run read
`scroll=NO unreachable=92px` on a comparable page. A green from one instrument would look like
confirmation and would not be one.

**So, stated plainly:**

| | |
|---|---|
| ✅ **The instrument used here** | a headless Chrome (`scripts/devtools/drive-page.js`) against the **editor's own live preview server** on `:8574`, reading `#root`'s computed style, `document.scrollingElement`'s scroll geometry, and `elementFromPoint` at a real control's centre |
| ❌ **The instrument NOT re-run** | phase 81 VIB-001's `unreachablePx` sweep. Nothing below touches it. Its contradiction with the judge line remains **open**, and the s47 write-up's explanation of it — that a corpus mixing two create paths yields both readings — is still an **explanation, not a measurement** |

⚠️ Also not measured here: a **packaged** Electron window. Every reading in this row's history,
including this one, is a browser.

---

## What was driven

1. The editor's **create wizard**, clicked through end to end: `New project` → `Start from a
   Template` → name `d40-wizard-drive` → the **Site Builder** card (verified selected by its
   `TemplateCard--selected` class before `Next`, because a click that reports success and lands
   nowhere is this phase's most repeated trap) → `Create Project`.
2. The project it wrote: `NodeGX test projects/d40-wizard-drive`.
3. The editor opened it on `/Pages/Setup`, and its preview server served it on `:8574`
   (`<title>Site Builder</title>`).
4. One browser, held open across all three readings, at **1440×313** — a window short enough that
   the public site's content (387px) does not fit in it. Viewport was never the variable in this
   row: D40's original measurement was identical at 756×469 and 1280×900.

## The three readings

One variable: the **Body Scroll** checkbox in the editor's own project settings panel
(`[data-property=bodyScroll]` — the control a person ticks, not a disk edit).

| at 1440×313, `http://127.0.0.1:8574/` | **ON** (as the wizard made it) | **OFF** | **ON again** |
|---|---|---|---|
| `document.body.className` | `body-scroll` | `""` | `body-scroll` |
| `#root` computed `overflow` / `position` | `visible` / `static` | **`clip` / `fixed`** | `visible` / `static` |
| `scrollingElement.scrollHeight` vs `clientHeight` | **387 > 313** | 313 = 313 | **387 > 313** |
| `scrollTop` after scrolling to the bottom | **74** | **0 — did not move** | **74** |
| the `Home` button's `top`, before → after scrolling | 322 → **248** | 322 → **322** | 322 → **248** |
| `elementFromPoint` at its centre | **`SPAN\|Home`** | **`null`** | **`SPAN\|Home`** |

🔴 **The middle column is the control this arm needed.** Without it, "the page scrolls" is a green;
with it, it is a *difference* produced by one setting, in the same browser, on the same page, with
the same verb. And the middle column reproduces D40's original signature exactly — a document that
believes it is one screen tall, a `scrollTop` that will not move, and a real control below the fold
whose `elementFromPoint` is `null`.

⚠️ `elementFromPoint` returning `null` is *"outside the viewport"*, which is also what *"behind a
modal"* reads as — the ambiguity `members-drive.ts` warns about in its own source, and the thing
that made this defect look like a blocked button for fourteen sessions. It is used here only
alongside the geometry, never on its own.

## The setting reached the runtime, and `#root` is what says so

`opennoodl-a0` also flagged the quiet failure mode: a running preview takes its settings from the
editor's in-memory `ProjectModel` over `ViewerConnection`, so a disk edit under a live editor could
be both invisible and later overwritten — and it fails toward *"scrolls in both arms"*, which reads
as *"`bodyScroll` is not what fixed it"*: a wrong conclusion about a correct fix.

It did not bite, because the intervention went through the **settings panel** rather than the disk,
and because `#root`'s computed style was read in every arm. **`clip` / `fixed` in the middle column
is the positive evidence that the change landed in the runtime** — an intervention that never
arrived would have left `visible` / `static` there. No reload was needed; the flip was live.

🔴 **What that licenses is narrow.** The measurement says *the settings-panel route propagates to a
running preview over `ViewerConnection`, with no reload*. It says **nothing** about the disk route:
editing `nodegx.project.json` under a live editor is **still unmeasured**, and the hazard as
`opennoodl-a0` stated it — invisible now, overwritten later — is untested rather than disproved.
Anyone taking the disk route owes it their own `#root` reading, which is the cheap tell for which
arm is actually live.

## Two further readings on the same project

- **On disk**, `nodegx.project.json` → `settings` reads
  `{ htmlTitle: "Site Builder", navigationPathType: "path", bodyScroll: true }`.
  ⚠️ Note the filename: a wizard-created project is written in the **v2 on-disk format**
  (`nodegx.project.json` + `components/`), so a check that greps `project.json` finds nothing here.
  It still reads `bodyScroll: true` after the OFF→ON round trip, so the toggle did not strand the
  file in the reverted state.
- **In the product's own settings UI**, the Body Scroll row arrives
  `checked`, `aria-checked="true"` — the wizard's project is born with it on, read off the surface
  a person looks at.

## The headless half, and its own mutant control

`tests-unit/sb-007/site-template.test.ts` now asserts on the `project.json` that
`EmbeddedTemplateProvider.install` actually writes — not on `site-builder.content.json`. The two are
different claims: `instantiateContent` stands between them and is the only code in the path that has
to understand the content.

🔴 **The assertion was checked against a reverted arm rather than trusted for being green.** With
`bodyScroll` deleted from `site-builder.content.json`: **exactly that test reddens (1 failed, 13
passed)**, and its sibling — *"control: the other settings survived instantiation too"* — stays
green, so the failure is about the field and not about the settings block. Artefact restored, md5
back to `42abe93c0046ec30bf0c3602b5dd9065`.

## What this arm now supports, and what it still does not

✅ **"A project the wizard makes scrolls."** Measured on the artefact the wizard wrote, through the
editor's own preview, with a control that reproduces the defect on the same page.

❌ It does **not** settle VIB-001. It does **not** speak for a packaged Electron window. And it is
about **this template** — any other create path that writes a `settings` block by hand owes the same
check. `tpl001Template.ts:127` already carries the setting; that is the second of the two, and it
has not been driven.

---

Picture: `s48-wizard-project-scrolled-1440x313.png` — the full 387px page in the ON arm, at a
viewport 313px tall.
