# Rich Text Editor — using it

A WYSIWYG rich text editor node built on **TipTap 3.30.2** (MIT, vendored into the module —
fully offline, no CDN, no API keys). Installing this module adds one node to the node picker:

## The `Rich Text Editor` node (Visual)

Drop it into any visual tree. It renders a toolbar (bold, italic, H1–H3, bullet list,
ordered list, link, undo, redo) above an editable content area.

### Inputs

| Port | Type | What it does |
|---|---|---|
| **HTML** | string | Sets the document content. Only applied when it differs from the editor's current HTML, so wiring the node's own HTML output back in does not loop. |
| **Placeholder** | string | Hint text shown while the document is empty. Updates live. |
| **Editable** | boolean | `false` hides the toolbar and makes the content read-only. Default `true`. |

### Outputs

| Port | Type | What it does |
|---|---|---|
| **HTML** | string | The document as an HTML string — updated on every edit (and once on mount). |
| **Text** | string | The document as plain text. |
| **Changed** | signal | Fires on every user edit (not on the initial content set). |

### Notes

- **Links**: the Link button prompts for a URL. Submitting an empty URL removes the link
  from the selection. Links do not open on click while editing (`openOnClick: false`).
- **Styling**: the toolbar and content chrome use design tokens
  (`var(--background)`, `var(--border)`, `var(--primary)`, …), so the editor follows the
  app theme with no configuration. Use the standard visual ports (size, margins) to lay it
  out; add your own CSS via the node's *CSS Class* / *CSS Style* advanced ports if needed.
- **Storing content**: persist the **HTML** output (e.g. into a Record/Object field);
  feed it back into the **HTML** input to restore.
- **Rendering stored content elsewhere**: the HTML output is raw HTML — render it with a
  component that sanitizes or trusts it deliberately. Content typed into the editor is
  ProseMirror-schema-constrained, but HTML pushed *into* the input is passed to TipTap's
  parser as-is.

## Demo

The module ships a `Rich Text Demo` component showing the node with preset content and a
placeholder.

## Provenance

Bundle built locally with `esbuild@0.25.9` (iife, minified, global `NodeGXTipTap`) from
`@tiptap/core@3.30.2`, `@tiptap/starter-kit@3.30.2`, `@tiptap/extensions@3.30.2` and their
ProseMirror dependencies. Exact package list and licence texts:
`project/noodl_modules/nodegx-richtext/LICENSE-tiptap.txt`.
