# COM-006 — The three links that will rot

🔴 **Time-sensitive, and nothing else in this phase depends on a live link.** Three of the 29
community entries contain no content at all — only a URL to a payload hosted somewhere we do not
control. Two are personal Google Drive files.

## 1. The person sentence

**The community's work survives the disappearance of the accounts that hosted it.**

## 2. What is at risk

| entry | link | what it is |
|---|---|---|
| Signup & Login template | Google Drive file | a whole project — *"all signup and login flows you could want… including reset password and some Sendgrid examples"* |
| Infinite scroll chat module | Google Drive file | a `noodl_modules` folder, hand-installed |
| Directus prefab | `github.com/The-Savvy-Tech/Directus-Prefab-for-Noodl` | a connector project, imported then cherry-picked |

⚠️ **The Google Drive links are the urgent ones.** A GitHub repo under an organisation is
comparatively durable; a personal Drive file disappears when one person tidies up, and takes the
only copy with it. The export Richard pulled contains the URL, not the file.

## 3. Acceptance criteria

**AC1 — the three payloads are downloaded.** Into `corpus/`, beside the graphs, with a note of where
each came from and when. 🔴 **Do this first and separately from any decision about whether we want
them** — recovery is cheap now and impossible later, and the two questions have different deadlines.

**AC2 — each payload is dispositioned.** Superseded / wanted / discarded, with the reason:

- **Signup & Login** is very likely superseded by the `auth-pages` prefab. ⚠️ Its own CSV note says
  the hosted backend it relied on *"was removed completely in the open source editor"*, so it may
  not even open. Check before assuming either way.
- **Infinite scroll chat** overlaps the `virtual-list` module but is not the same thing — upward
  pagination and scroll anchoring, which `virtual-list` does not do. The `Smooth scroll to bottom of
  a scrollable group` snippet in the same corpus is the companion piece.
- **Directus** is the real candidate. We ship Supabase and Xano prefabs; Directus is the obvious
  third and the community already built one.

**AC3 — the Directus licence and authorship are checked before anything is copied.** 🔴 It is
someone else's repository. Licence, attribution, and whether its author would rather contribute it
themselves — asked, not assumed. ⚠️ The same courtesy applies to every named creator in the corpus
CSV; several rows credit people by name, including *"Coded by the very helpful Johan Olsson from
Noodl"*.

**AC4 — the corpus records what could not be recovered.** If a link is already dead, that is written
down rather than left as a URL that reads like a working one.

## 4. Why this is its own task

It is the only work in the phase with an external deadline, it is measured in minutes, and it
blocks the Directus decision entirely. Everything else here can wait; this cannot.
