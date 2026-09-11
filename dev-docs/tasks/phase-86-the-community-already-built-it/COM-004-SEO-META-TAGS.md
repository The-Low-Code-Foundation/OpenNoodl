# COM-004 — SEO meta tags: the runtime can, the product cannot

🔴 **`Noodl.SEO.setMeta` is live in the runtime and has been for a long time. There is no node, no
prefab, and no way for a builder to reach it without writing JavaScript.** The community wrote the
missing piece years ago; it is the single largest gap the export exposes, and it is the *cleanest*
graph in the corpus.

## 1. The person sentence

**Someone ships a page and it previews correctly when it is shared — without writing a line of
JavaScript.**

## 2. What was measured

| reading | value |
|---|---|
| catalog types matching `seo`, or display name containing `meta` | **0** |
| library prefabs for SEO | **0** of 43 |
| `Noodl.SEO` in the runtime | ✅ live — `noodl-js-api.ts:45`, `Page.tsx:168` calls `setMeta`, `router.tsx:584` calls `setTitle` |
| the community graph | 17 nodes, 32 connections — **validates clean** through the strict gate |

**The runtime half is already built and already used.** The Router calls `setTitle` on every page
mount; `Page.tsx` calls `setMeta` for each entry in the page's metadata list. What is missing is
the authoring surface.

## 3. What the community graph already covers

Read [`corpus/components/SEO Meta Tag setter_3QQHDHXpAMaUw2ZPZFAwia/`](corpus/components/). It is
better than a first attempt would be:

- **Three tag families with grouped ports** — `General search engine` (title, description, robots),
  `Open Graph` (title, description, image, type, url override), `Twitter` (title, description,
  card, image).
- **`States` nodes constraining the enum-ish fields** — `og:type` to the 13 legal values,
  `twitter:card` to `summary,summary_large_image,app,player`.
- **Image dimensions read at runtime** — a `Javascript2` node loads the chosen image and publishes
  `imageWidth`/`imageHeight` into `og:image:width`/`og:image:height`, because social platforms
  render the preview wrong without them.
- **`og:url` defaulting to `window.location.href`** via an `Expression`, with an override port.
- **A written reference for every `robots` value** in the function's own trailing comment.

⚠️ It also encodes the image path with `encodeURIComponent` and concatenates it onto `href`, which
is worth checking rather than copying — that produces `https://host/page%2Fimg.png` for a relative
path, which is probably not what was meant.

## 4. The open question this task must decide

🔴 **Prefab, or node?** They are not equivalent and the choice should be made deliberately, once:

- **A prefab** ships tomorrow, is installable, and is editable by the person who installs it. It
  also means every project carries its own copy that drifts.
- **A node** puts meta tags in the picker where a builder looks for them, and makes the MCP able to
  author SEO without installing anything. It is more work and it is a catalog change.

⚠️ There is a third possibility the decision must not skip: **the page already has a metadata list**
that `Page.tsx` iterates. The right answer may be to extend *that* surface rather than add a node
beside it. Read `Page.tsx:168` and the page's metadata parameter before choosing.

## 5. Acceptance criteria

**AC1 — the decision is written down.** Prefab, node, or page-metadata extension, with the reason
and what was rejected. One paragraph, in this file. 🔴 Nothing else in this task starts first.

**AC2 — a builder can set Open Graph tags with no JavaScript.** Measured by building a page that
sets `og:title`, `og:description` and `og:image` through whatever AC1 chose, and reading the tags
out of the rendered document.

**AC3 — the tags reach a crawler, not just the DOM.** 🔴 **This is the criterion that can silently
fail.** A client-rendered `setMeta` writes the tag after the page loads; a crawler that does not
execute JavaScript sees nothing. Verify against the deployed output, not the editor preview. ⚠️ If
this needs SSR, it needs P16 RUN-002 and that dependency gets named here rather than discovered
later.

**AC4 — the enum fields cannot be set to nonsense.** `og:type` and `twitter:card` accept only their
legal values, as the community graph already does with `States`.

**AC5 — the image dimension behaviour is verified or dropped.** Either the width/height publication
works (and the `encodeURIComponent` path question in §3 is resolved), or it is left out rather than
shipped broken.

## 6. What this does not own

SSR/SSG rendering mode — P16 RUN-002. The site-builder's own per-page SEO description field —
P77 SBR-007. ⚠️ Both touch SEO and neither is this: RUN-002 is *how the page is rendered*,
SBR-007 is *one field in one editor*, and this is *meta tags as an authoring surface in any graph*.

---

## 7. 🔴 CORRECTION, measured 2026-09-11 (COM-003 session 4) — §2's headline is wrong

**"There is no node, no prefab, and no way for a builder to reach it without writing JavaScript"
is false.** The `Page` node already carries **13 meta-tag ports**, and they are in the catalog:

```
python3 -c "... node-catalog.json ... typeName == 'Page'"
  Page inputs total: 26
  meta ports: description, robots,
              og:title, og:description, og:url, og:type, og:image, og:image:width, og:image:height,
              twitter:card, twitter:title, twitter:description, twitter:image
```

`packages/noodl-viewer-react/src/components/navigation/Page/Page.tsx:32` declares `META_TAGS`;
`nodes/navigation/page.ts:208` folds every entry into `inputProps` with `propPath: 'metatags'`,
grouped as **"Experimental SEO"**, "General" and "Image". `Page.tsx` then calls
`Noodl.SEO.setMeta(key, value)` for each.

### Why §2's measurement missed it

It counted **nodes**: *"catalog types matching `seo`, or display name containing `meta` — 0"*. That
is true and it is the wrong population. The authoring surface is a **port group on a node that
already exists**, named for the page it belongs to, not for the tags it sets. ⚠️ A census over the
wrong noun returns zero and reads exactly like an absence.

### What this does to the task

**AC1's three options are not equal any more.** The third one — *extend the page metadata surface* —
is largely **already built**, which makes "prefab or node?" a question about something the product
mostly has. What is actually missing is smaller and sharper than a new node:

| the community graph has | the `Page` node has | gap |
|---|---|---|
| `title` | — (the Router calls `SEO.setTitle` per page) | none, different mechanism |
| `description`, `robots` | ✅ ports | none |
| the 7 Open Graph fields | ✅ ports | none |
| the 4 Twitter fields | ✅ ports | none |
| `og:type` / `twitter:card` constrained by `States` | plain **string** ports | 🔴 **AC4 is unmet** — nonsense is settable |
| `og:image:width`/`height` computed by loading the image | ports the author fills **by hand** | 🔴 **AC5** — the community solved this and we did not |
| `og:url` defaulting to `location.href` | port, no default | ⚠️ a forgotten `og:url` is blank rather than right |

🔴 **And the group is still called "Experimental SEO"** — for `description` and `robots` only, while
the Open Graph and Twitter ports beside them are not marked experimental. Whatever AC1 decides, that
label is a claim about supportedness that somebody chose once and nobody has revisited.

### AC3 is in better shape than feared, and the reason is written down

`Page.tsx` deliberately applies the tags **in the render body on the server** and in an effect in the
browser, with a comment explaining that SSR runs `ReactDOMServer.renderToString`, effects never run,
and `injectSeo` builds the served `<head>` from the buffer this fills. `static/ssr/inject-seo.js`
exists and `tests/ssr-inject-seo.test.js` covers it.

⚠️ **That is the mechanism, not the outcome.** Whether a crawler sees the tags still depends on the
project being built in an SSR/SSG mode, which is **P16 RUN-002** — so AC3's dependency is now *named*
rather than discovered later, which is what AC3 asked for. The client-only deploy path still writes
the tags after load, and a crawler that does not execute JavaScript still sees nothing there.

### 🔴 What the next session must NOT do

**Do not build a node or a prefab before re-reading this section.** Both would duplicate 11 of 13
ports that already ship. The live question is narrower and better: *should `og:type` and
`twitter:card` become enums, should `og:image:width`/`height` be computed, should `og:url` default,
and is "Experimental" still true?* — plus whether that surface is **discoverable**, which is the one
real thing a prefab or a node would buy and the ports do not.
