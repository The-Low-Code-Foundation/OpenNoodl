#!/usr/bin/env python3
"""
COM-003's ledger — everything this phase says about a community graph that the graph does not
say about itself.

🔴 **This file exists so that no correction is invisible.** `convert-exports.py` is mechanical:
it reshapes an export into the example format and changes nothing else. But the corpus needs four
things the export cannot supply, and each of them is a place where OUR judgement replaces the
community's bytes:

    title / description   the export's title is the truncated 20-char directory name
                          ("Simple audio recorde"), and `generate-node-docs.js` renders
                          `**title**\\n\\n description` onto a node page. Landing the truncation
                          would publish it.
    requires_modules      a type the catalog cannot carry because the catalog is built from
                          built-in types only (COM-003 AC3)
    rename_ports          a wire naming a port that no longer exists (COM-003 AC4)
    drop_parameters       a parameter the runtime provably never reads (COM-003 AC2's neighbours)

Every entry carries a `why`. A correction without a reason is indistinguishable from a typo, and
in six months nobody will be able to tell which of these was measured and which was guessed.

🔴 **Why the prose lives here and not in the landed JSON.** The landed examples are GENERATED.
A hand-edited description in `docs/node-catalog/examples/*.json` is deleted the next time anyone
re-runs the converter, silently, and the loss looks exactly like a file nobody touched. Keeping
the authored text in the generator's own source is what makes re-running it safe.

⚠️ **The two rules this file may not break**, both inherited from `convert-exports.py` §2:

1. A correction may not invent a wiring the community never wrote. `rename_ports` re-points a wire
   at the port that wire's target was renamed TO — it does not connect anything new.
2. A correction may not change what the graph renders. `drop_parameters` removes only parameters
   the gate has *proved* are never read ("inert", "never read" — its words), so the render is
   byte-identical with them gone. Setting the enabling parameter instead (`useLabel: true`) would
   change the render, and that is a guess about intent, not a conversion.

@module dev-docs/tasks/phase-86/graphs
"""

# The 12 clipboard-JSON graphs in the corpus, keyed by the id `convert-exports.py` derives.
#
# `demonstrates` is NOT set here — it is computed from the node types actually present, so it
# cannot drift away from the graph the way a hand-kept list does.
GRAPHS = {
    'community-ag-grid': {
        'title': 'Mount a third-party grid, and unmount it again',
        'description': (
            "The smallest complete statement of the lifecycle pair: a `Javascript2` node that reaches a "
            "DOM element "
            "belonging to a `Group`, hands it to a library that is not Noodl's, and — the half "
            "that is almost always missing — tears that library down again on "
            "`Node.Signals.WillUnmount`. Only two nodes, and the pattern generalises to every "
            "grid, chart, map and editor in the ecosystem. ⚠️ The community wrote this against "
            "AG Grid loaded separately; the graph does not bundle it, and neither the script's "
            "CDN tag nor the licence AG Grid asks for is part of what lands here. Read it for "
            "the mount/unmount shape, not as a working grid."
        ),
    },
    'community-better-markdown-comp': {
        'title': 'Markdown with a stylesheet of your own',
        'description': (
            "The Markdown module renders a string as a document, and this wraps it in the two "
            "things the raw node leaves to you: a `CSS Definition` scoped to the surrounding "
            "`Group`, so headings and lists inherit the project's type scale instead of the "
            "browser's defaults, and a `Component Inputs`/`Component Outputs` pair that makes "
            "the whole thing one reusable part rather than a node you re-style at every call "
            "site. The `States` node switches the stylesheet — that is how a light and a dark "
            "rendering of the same document stay one component."
        ),
        'requires_modules': [
            {
                'module': 'markdown',
                'nodes': ['Markdown'],
                'why': (
                    "`Markdown` is registered by the Markdown module, which this repo ships in "
                    "`library/modules/markdown/`. The node catalog is generated from built-in "
                    "types only, so a module type is 'unknown' to it however real it is."
                ),
            }
        ],
    },
    'community-csv-download': {
        'title': 'Turn rows into a file the browser downloads',
        'description': (
            "Two `JavaScriptFunction` nodes in series and no backend anywhere: the first folds an "
            "array of objects into CSV text, the second wraps that text in a `Blob` and hands "
            "`URL.createObjectURL` the result, and `External Link` opens it. That URL is the "
            "whole trick — it is a real, fetchable address that exists only inside this tab, so "
            "the download never leaves the browser and nothing has to be uploaded first. "
            "⚠️ Compare it with `net.noodl.ToCSV` before reusing the conversion half: the built-in "
            "node handles quoting and embedded delimiters, which hand-rolled CSV usually does not. "
            "The half worth copying is the object-URL download."
        ),
    },
    'community-dropzone': {
        'title': 'Drag a file onto the page, or click to browse',
        'description': (
            "A drop target built the way the browser actually requires: a `Javascript2` node adds "
            "`dragover`/`drop` listeners to the element on `Node.Signals.DidMount` and removes "
            "them on `WillUnmount`, because a listener attached without a matching removal "
            "survives the component and fires against a node that is gone. `Component Children` "
            "means the drop zone wraps whatever you put inside it rather than dictating its own "
            "appearance, and `Open File Picker` gives the same component a click-to-browse path, "
            "so one part answers both ways a person supplies a file. ⚠️ One wire in the original had to be "
            "re-pointed to land here: it named an `Open File Picker` output called `success`, "
            "which was real when this was written and is now called `done`."
        ),
        'rename_ports': [
            {
                'node': 'open-file-picker',
                'from': 'success',
                'to': 'done',
                'why': (
                    "🔴 MEASURED, and it is the opposite of what this phase first assumed. "
                    "`success` was a REAL port on Open File Picker from the initial commit until "
                    "2026-08-02, when `a139a3ce5` (ERG-001 §4) renamed it to `done` as part of "
                    "the outcome contract. The community graph was correct when it was written; "
                    "OUR rename is what made it wrong, six weeks ago. The wire is re-pointed at "
                    "the port the old one became — not repaired by guesswork. See COM-003 §AC4 "
                    "and the defect row it filed: the rename shipped no alias and no migration, "
                    "so every user project that wired `success` has the same dead wire and no "
                    "message telling them so."
                ),
            }
        ],
    },
    'community-email-signup-validat': {
        'title': 'Check an email is well-formed and not already taken',
        'description': (
            "Sign-up validation as a chain of small truths rather than one function: an "
            "`Expression` says the field is non-empty, a `JavaScriptFunction` says it looks like "
            "an address, and a `DbCollection2` query says nobody has it yet — and an `And` node "
            "combines them into the one boolean the button enables on. The `Timer` in front of "
            "the query is the detail worth copying: it debounces, so the database is asked once "
            "the typing stops instead of once per keystroke. ⚠️ The two `Inverter` nodes read as "
            "clutter until you notice what they buy — 'no user came back' is the success case "
            "here, and inverting it keeps every input to the `And` meaning 'this is fine', which "
            "is what makes the combination readable at all."
        ),
        'drop_parameters': [
            {
                'node': 'email-input',
                'parameter': 'label',
                'why': (
                    "`net.noodl.controls.textinput` reads `label` only when `useLabel` is true, "
                    "and this node leaves `useLabel` at its default of false — so the text was "
                    "never rendered in the community's own app either. Dropped rather than "
                    "switched on: setting `useLabel: true` would add a visible label the author "
                    "never had, which is a guess about intent. Removing a parameter the runtime "
                    "provably never reads cannot change the render."
                ),
            }
        ],
    },
    'community-seo-meta-tag-setter': {
        'title': 'Set the meta tags a link preview reads',
        'description': (
            "Seventeen nodes that exist because the runtime writes no `<meta>` tags for you: a "
            "`JavaScriptFunction` reaches `document.head` and sets title, description, canonical "
            "URL, robots, the Open Graph set and the Twitter card, each fed from its own `String` "
            "or `States` node so a page can override one without restating the rest. The "
            "`Expression` defaulting the URL to `location.href` is what stops a forgotten "
            "`og:url` pointing at the wrong page. ⚠️ Nothing here needs a node that does not "
            "exist — but nothing here is done for you either, so budget the seventeen nodes."
        ),
    },
    'community-simple-audio-recorde': {
        'title': 'Record audio in the browser and save it',
        'description': (
            "The full arc of a MediaRecorder capture, which is longer than it looks because three "
            "different things have to be true before a single byte is recorded. A "
            "`JavaScriptFunction` asks for microphone permission and a `Switch` gates everything "
            "on the answer; a `Javascript2` node owns the recorder itself and accumulates chunks; "
            "a second one runs the seconds counter; a third converts the finished `Blob` into the "
            "shape `NewDbModelProperties` can store. ⚠️ Permission is asynchronous and revocable, "
            "which is why the gate is a node and not an assumption — a recorder started before "
            "the user has answered produces silence rather than an error. The preview player is "
            "a Custom HTML node because an `<audio>` element with a blob URL is the shortest "
            "honest way to play back something that has no file yet."
        ),
        'requires_modules': [
            {
                'module': 'custom-html',
                'nodes': ['module.inlineHtml'],
                'why': (
                    "`module.inlineHtml` is registered by the Custom HTML module, shipped in "
                    "`library/modules/custom-html/` and already used by this repo's own "
                    "`library/modules/pdf-viewer` project. Unknown to the catalog for the same "
                    "reason as every module type: the catalog carries built-ins only."
                ),
            }
        ],
        'drop_parameters': [
            {
                'node': 'stop-button',
                'parameter': 'width',
                'why': (
                    "The button sizes itself to its content, so `net.noodl.controls.button` never "
                    "reads `width` — the gate's word for it is 'inert'. Dropped rather than "
                    "resolved with `sizeMode: \"explicit\"`, which would pin a width the author "
                    "never actually got and change the layout."
                ),
            }
        ],
    },
    'community-strobe-blinking-bu': {
        'title': 'Blink a button, and stop cleanly',
        'description': (
            "A strobe is a good miniature of a hard problem: something that keeps running after "
            "the signal that started it, and therefore has to be stopped by something other than "
            "the thing that started it. A `Javascript2` node owns the interval, a `Switch` turns "
            "it on and off, a `States` node carries the two appearances, and a `Number` makes the "
            "period an input instead of a literal. ⚠️ The half people leave out is the reset — "
            "stopping an interval without restoring the state leaves the button frozen in "
            "whichever half of the blink it happened to be in, which looks like a different bug "
            "entirely. This one restores it."
        ),
        'drop_parameters': [
            {
                'node': 'group',
                'parameter': 'height',
                'why': (
                    "The `Group` sizes to its content, so `height` is never read. Dropped rather "
                    "than switched to `sizeMode: \"explicit\"`, which would fix a height the "
                    "community's layout never had."
                ),
            }
        ],
    },
    'community-tinymce-text-editor': {
        'title': 'Load a rich-text editor from a CDN at runtime',
        'description': (
            "The interesting node here is the one that loads nothing visual: a "
            "`JavaScriptFunction` that injects a `<script>` tag and resolves once it has loaded, "
            "so the editor library arrives at run time rather than being bundled. That is the "
            "pattern to take away — it is how any large third-party library gets into a NodeGX "
            "app without inflating the build. The `Javascript2` node then mounts TinyMCE onto a "
            "`Group`'s element, a `CSS Definition` reconciles the editor's chrome with the "
            "project's tokens, and `Cloud File` plus `NewDbModelProperties` give pasted images "
            "somewhere to live. ⚠️ `tinymce-api-key` is a `String` node holding an empty value — "
            "TinyMCE's CDN build wants your own key, and this graph deliberately does not carry "
            "one."
        ),
    },
    'community-tiptap-text-editor-r': {
        'title': 'One button component that drives any editor command',
        'description': (
            "A toolbar has a dozen buttons that differ only in a label, an icon and the name of "
            "the command they run — so this makes them one component with those three as inputs. "
            "A `States` node turns the button's type into its label, a `JavaScriptFunction` calls "
            "the matching command on the editor instance, and `Component Outputs` reports back "
            "whether the mark is currently active so the button can render as pressed. The "
            "lesson is not about Tiptap: it is that 'twelve buttons' and 'one button placed "
            "twelve times' are the same screen, and only one of them is editable later. 🔴 A "
            "component parameter arrives ONLY through a `Component Inputs` node whose ports are "
            "plugged `output` — that inversion is what makes this work, and it is the single "
            "most common thing to get backwards."
        ),
    },
    'community-tiptap-text-editor': {
        'title': 'A rich-text editor with a toolbar and local drafts',
        'description': (
            "The larger companion to the single-button component: a `Static Data` node holds the "
            "list of toolbar commands, a `For Each` draws one button per entry, and the editor "
            "itself is mounted by a `JavaScriptFunction` onto a `Group`'s element. Two details "
            "are worth more than the editor. The draft is saved to `localStorage` on a `Timer` "
            "and read back on mount, which is the whole of 'don't lose my work' and costs two "
            "function nodes. And `Model2` plus `SetModelProperties` keep the document in the "
            "project's own data model rather than only inside the third-party editor, so "
            "something other than the editor can read what was typed. ⚠️ The toolbar is driven "
            "by data, so adding a command is a row in the `Static Data` node — not a new button."
        ),
        'drop_parameters': [
            {
                'node': 'button',
                'parameter': 'iconIconSource',
                'why': (
                    "`net.noodl.controls.button` reads `iconIconSource` only when `useIcon` is "
                    "true AND `iconSourceType` is `icon`; neither holds on this node, so no icon "
                    "was ever shown. Dropped rather than enabled — turning the icon on would add "
                    "a glyph the toolbar never rendered."
                ),
            }
        ],
    },
    'community-web-rtc-video-record': {
        'title': 'Record video from the camera and store the result',
        'description': (
            "The same shape as the audio recorder and worth reading beside it, because what the "
            "two have in common is the part that generalises: ask for the device, gate every "
            "control on the answer, let one `Javascript2` node own the `MediaRecorder`, and "
            "convert the finished `Blob` before anything tries to store it. Video adds the "
            "preview problem — you need a live `<video>` element while recording and a playable "
            "one afterwards — which is why a Custom HTML node holds the player rather than an "
            "`Image`. ⚠️ `getUserMedia` requires a secure origin: this works on `localhost` and "
            "over HTTPS and fails on a plain-HTTP deploy, which is a deployment fault that "
            "presents as a permission one."
        ),
        'requires_modules': [
            {
                'module': 'custom-html',
                'nodes': ['module.inlineHtml'],
                'why': (
                    "As the audio recorder: `module.inlineHtml` comes from the Custom HTML "
                    "module in `library/modules/custom-html/`, and the catalog carries built-ins "
                    "only."
                ),
            }
        ],
        'drop_parameters': [
            {
                'node': 'video-recorder-prefab',
                'parameter': 'columnGap',
                'why': (
                    "A `Group`'s `columnGap` applies only when it lays out in a row or wraps; "
                    "this one is a column that does not wrap, so the gap was never read. ⚠️ Note "
                    "this parameter ALSO carried a raw `20px` literal — tokenising it to "
                    "`var(--space-5)` would have produced a tidy value on a port the runtime "
                    "never consults, which is a worse artefact than the one we started with. "
                    "Inert parameters are dropped BEFORE spacing is tokenised, for this reason."
                ),
            }
        ],
    },
}
