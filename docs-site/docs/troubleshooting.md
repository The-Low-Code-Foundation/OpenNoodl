---
title: Troubleshooting
sidebar_position: 5
---

*Describes NodeGX 0.1.0.*

This page collects known issues that have already bitten real users, harvested from the
project's own engineering notes rather than guessed at. If something you're hitting isn't
here, it may simply not be written down yet.

## An Icon node shows raw text like "dehaze" instead of a glyph {#icon-shows-raw-text}

**Symptom:** An Icon node (or an icon on a Button, Checkbox, Select, etc.) renders a plain
word — `dehaze`, `account_circle`, and so on — instead of a symbol.

**Cause:** That word is the *name* of the icon glyph, from an icon font. It only renders as a
picture when the project has the matching icon-set module installed; without the module, the
browser has no font to turn that name into a glyph, and nothing warns you this is missing.

A new project starts with two font/icon modules already installed — `inter` (the default
typeface) and `lucide-icons` — but **not** Material Icons, which is a separate, optional
module. If your project (or an icon you picked, or one an AI-authored graph referenced) uses
a Material Icons name, you'll see the raw name until you install it.

**Fix:** Open the node picker (the **+ Add node to graph** button), switch to the **Modules**
tab, search for "Material Icons", and click **Install**. This adds the module's manifest to
your project's `noodl_modules/` folder and injects its stylesheet.

**One more thing to know:** the Material Icons module loads its font from a live Google Fonts
URL rather than shipping the font file inside your project. That means both your editor
preview *and* your deployed app need internet access to render those glyphs — if you need
icons to work fully offline, `lucide-icons` (installed by default) is the safer choice.

## When the preview doesn't update {#when-the-preview-doesnt-update}

**Symptom:** You've changed something in the graph, but Preview still shows the old
behavior.

**Fix:** Click the **Refresh preview** button in the top bar, or press **Cmd/Ctrl+R**. This
reloads the running preview against your current graph.

If that doesn't help — for example, after changing something more structural like the
project's React runtime version, or after a version-control merge — there's a stronger
reset: **Cmd/Ctrl+Shift+X**, which also clears the node-library cache before refreshing the
preview. Reach for this if a plain refresh doesn't clear it up.

## Where projects live on disk {#where-projects-live-on-disk}

**NodeGX does not put your projects in a fixed default folder.** When you create a project,
the **Browse...** step opens your operating system's normal folder picker with nothing
pre-selected — you choose where it goes, and NodeGX creates a folder named after your project
inside whatever location you picked. If you're not sure where a project ended up, check
whatever folder you selected when you created it (the launcher's project list will also show
you the path for each project you've opened before).

This is different from the editor's own application data — its logs, its cache of downloaded
library modules and templates, its settings — which does live in a fixed, OS-standard
location (on macOS, `~/Library/Application Support/NodeGX`). That folder is NodeGX's own
configuration, not your project. Deleting it won't delete any project you've built; it also
won't help you find one.

## Getting more help

If something isn't covered here, check the rest of the concept pages for the vocabulary you
need to search with, or ask in the project's community channels.
