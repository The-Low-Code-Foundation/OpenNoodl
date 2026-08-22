# PDF Viewer — configuring it

## ⚠️ Requires the Custom HTML module

This entry **depends on the standalone Custom HTML module** and does not work
without it. The `/PDF Viewer` component is built around the `Custom HTML`
node (`module.inlineHtml`), which that module registers. PDF Viewer used to
bundle its own copy of the module's code; it no longer does, because two
copies of `custom-html-module` in one project overwrite each other.

**Install order does not matter, but both installs must happen:**

1. Install **Custom HTML** from the Modules library.
2. Install **PDF Viewer**.

Until Custom HTML is installed, the `Custom HTML` node inside `/PDF Viewer`
shows as a red dashed placeholder and nothing renders.

## Using it

Place the `/PDF Viewer` component and set:

- **PDF URL** — the URL of the PDF to display. It is URL-encoded for you and
  handed to Google's document viewer (`docs.google.com/viewer`) inside an
  `<iframe>`, so the URL must be publicly reachable — the viewer runs on
  Google's servers, not in your app.
- **Width** / **Height** — the size of the viewer group.

A sample PDF URL is pre-wired as the default.
