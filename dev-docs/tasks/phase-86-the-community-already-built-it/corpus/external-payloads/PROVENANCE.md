# The three external payloads — recovered 2026-09-11

COM-006 AC1. Three of the 29 community entries carried no content, only a URL to a payload hosted
somewhere we do not control. **All three links were still alive on 2026-09-11 and all three payloads
are now in this folder.** COM-006 AC4 asked that anything already dead be written down as dead:
**nothing was dead.**

Fetched over plain `curl` on 2026-09-11, between 14:17 and 14:19 CEST (12:17–12:19 UTC), from the
URLs exactly as the corpus records them.

| file | bytes | sha256 |
|---|---|---|
| `signup_template.zip` | 2,530,325 | `de1692c35529d4455e40ec6ec45e8fa52672438ef93a6157e667282ee3e384b1` |
| `chatcontainer-module.zip` | 19,352 | `e0c0240bfd79693a88ff7c189b18d7be5f4356406d844c19e8f4f43d5bb084eb` |
| `Directus-Prefab-for-Noodl-main.tar.gz` | 1,276,073 | `726128eb4ec869c034bdc7cb56ccc17420fa6996c4e7e7849305ad2921ff7de5` |

The archives are stored **verbatim, as the server sent them** — that is the recovery artefact. The
one exception is `chatcontainer-module-src/`, explained below.

---

## 1. `signup_template.zip` — Signup & Login template

- **Corpus entry:** `components/Signup & Login templ_3QQHDD8djjydVC4159389x/`
- **Source:** `https://drive.google.com/file/d/1lJsR2hlJmbtpOkCOFonxF7ZADYT0oGCF/view?usp=sharing`
- **Filename:** `signup_template.zip`, from the server's own `Content-Disposition`, not invented here.
- **Contents:** a whole Noodl project — `project.json` (470 KB, 29 components), the `material-icons`
  module, five PNGs, a spinner SVG, a `__MACOSX` sidecar, **and a live `.git` directory (1.4 MB)**.
  The author zipped their working checkout, so the project's own history came with it.

## 2. `chatcontainer-module.zip` — Infinite scroll chat module

- **Corpus entry:** `components/Infinite scroll chat_3QQHDoCCsWHb9odwivmVGF/`
- **Source:** `https://drive.google.com/file/d/1_3J7gFWTKt0_w0R6Pvm1_0z6nhFMiWaV/view?usp=sharing`
- **Filename:** `chatcontainer-module.zip`, from the server's `Content-Disposition`.
- **Contents:** a `noodl_modules` folder — `manifest.json`, a 14 KB webpack bundle, its
  `index.js.map`, and `index.js.LICENSE.txt`. One React node, `noodl.controls.chat-container`.

🔴 **`chatcontainer-module-src/` is a bonus recovery, and it is derived, not downloaded.** The
bundle shipped with a sourcemap that still carried `sourcesContent`, so the module's **original
un-minified source survived inside it**: `ChatContainer.jsx` (5,237 bytes — the complete component
and its whole node definition), `ChatContainer.module.scss` (280 bytes) and `index.js` (168 bytes).
Extracted from `index.js.map` in the zip above; regenerate it from the zip at any time. It is kept
because a readable 5 KB source is worth far more to COM-005 than a minified bundle, but the zip
remains the authority.

## 3. `Directus-Prefab-for-Noodl-main.tar.gz` — Directus prefab

- **Corpus entry:** `components/Directus prefab_3QQHDTBNaGpgGRTtQLHjAp/`
- **Source:** `https://github.com/The-Savvy-Tech/Directus-Prefab-for-Noodl`, default branch `main`,
  fetched as `/archive/refs/heads/main.tar.gz`.
- **Repository state on 2026-09-11:** created 2024-05-07, last pushed **2024-10-10**, not archived,
  8 stars, 7 forks, owner `The-Savvy-Tech` (an **organisation**, not a personal account).
- **Contents:** 31 files — `project.json` (plus a Dropbox-style *"DESKTOP-GS5GT1L's conflicted copy
  2024-06-27"* duplicate the author left in), three `noodl_modules` (`custom-html-module`,
  `data-context`, `material-icons`), the Roboto font family, a logo, `env.json.example`, a GitHub
  issue template.

### 🔴 Licence and authorship — COM-006 AC3

- **Licence: BSD 3-Clause**, confirmed two ways — the GitHub API reports `spdx_id: BSD-3-Clause`,
  and the repository's own `LICENSE` file reads *"Copyright (c) 2024, arladmin"*.
- **Sole contributor:** `arladmin`, 25 commits — the GitHub contributors endpoint lists no one else.
- **What BSD-3 permits:** redistribution in source and binary form, modified or not, provided the
  copyright notice, the conditions and the disclaimer travel with it. **So storing this archive here
  is already compliant**, and shipping a derivative would be too, on the same terms.
- **What BSD-3's third clause forbids:** using the copyright holder's or contributors' names to
  endorse or promote anything derived from it, without prior written permission. A NodeGX Directus
  prefab therefore must not be marketed as *"by The Savvy Tech"* or *"the Savvy Tech prefab"*.
- ⚠️ **The licence is not the whole of AC3.** AC3 asks whether the author would rather contribute it
  themselves — that is a courtesy question the licence does not answer, and it is **still open**. The
  README points at `docs.thesavvy.tech` and a commercial *"Boilerplate Kit"* built on this prefab, so
  the author has a live commercial interest in it. **Ask before building a derivative.**

### Named creators elsewhere in the corpus — the rest of AC3

The CSV has a dedicated **`Creator credits`** column, so this was read from the column rather than
from prose. **6 of 29 rows are credited, and every one of them names Richard Osborne** — Web RTC
video recorder, Simple audio recorder, Email signup validator, Better Markdown component, Masonry
grid for repeaters, Smooth scroll to bottom of a scrollable group. (`Created By Name` is populated on
only 4 rows, also all Richard.)

**Exactly one third-party creator is named anywhere in the CSV**, and it is in `Notes`, not in the
credits column: *"Coded by the very helpful Johan Olsson from Noodl"*, on **Multiple dropdowns with
filtered results**. The other 22 rows carry no attribution at all.

⚠️ COM-006 AC3 says *"several rows credit people by name"*. Measured, it is **one** row crediting one
person outside Richard. The attribution burden on this corpus is much smaller than the task assumed —
but Johan Olsson's row is real and must carry his name wherever that snippet goes.
