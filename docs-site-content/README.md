# Staged docs content — not yet wired into anything

This directory is **not a website**. It's the authored prose for
[ALPHA-004](../dev-docs/tasks/phase-33-alpha-launch/ALPHA-004-USER-DOCS.md) §1, §2 and §4 —
the concept set, the getting-started walkthrough, and the harvested troubleshooting entries —
written ahead of [ALPHA-006](../dev-docs/tasks/phase-33-alpha-launch/ALPHA-006-DOCS-PLATFORM.md),
which has not yet built the Docusaurus site (`docs-site/`) this content is meant to live in.

Nothing in this directory is built, published, linted, or read by any tool today. It's staged
so the writing isn't the long pole once the site exists.

## What's here

```
concepts/
  node-port-wire.md        node, port, wire
  signal-vs-value.md       the highest-value distinction in the product
  components.md            components, and why a component is also a node
  canvas-and-sheets.md     the canvas, sheets, and the visual tree
  preview-vs-deployed.md   preview vs deployed
  data.md                  arrays, objects, variables, records
  frontend-vs-backend.md   what runs in the browser vs the backend
getting-started.md         one linear tutorial: a working two-page app with data
troubleshooting.md         authored, harvested known issues — not invented
```

## What's deliberately NOT here

**The node reference** — per-node ports, defaults, and behavior — is out of scope for this
content on purpose. ALPHA-004's governing rule is **"derive, never author twice"**: the node
reference is generated from `docs/node-catalog/enrichment/` (`node-catalog-enriched.json`),
per [ALPHA-006 §3](../dev-docs/tasks/phase-33-alpha-launch/ALPHA-006-DOCS-PLATFORM.md). If a
node's ports need better prose, the fix belongs in the enrichment data, per
[`dev-docs/reference/PORT-DESCRIPTION-STYLE.md`](../dev-docs/reference/PORT-DESCRIPTION-STYLE.md)
— not here.

## When ALPHA-006 lands

These files are meant to be dropped into `docs-site/` more or less as-is (frontmatter and
relative links are already shaped for a Docusaurus-style site). Re-verify every fact in them
against whatever version of NodeGX is current at that point — each file states the version it
describes, and this content will drift the same way any other documentation does.
