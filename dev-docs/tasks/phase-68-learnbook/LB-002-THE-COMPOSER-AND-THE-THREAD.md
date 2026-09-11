# LB-002 — the composer and the thread

**Surface:** platform · **Tier 1** · **Effort:** L · **Blocked on:** LB-001's tree (lands together
with it as the walking skeleton)

## Premise

The exchange is the product. A thread reads like a comment tree (LearnBook's model, "like a reddit
thread"): the coach's opening post, then replies by coachee or coach. The composer is where
LearnBook earned its keep — a real WYSIWYG with image upload/insertion and **a good table
constructor** (Richard's emphasis from the original), not a markdown box.

## Scope (v1)

- **The composer**: a bought/OSS rich-text editor component (Tiptap or equivalent — L1's posture:
  this is exactly what we do *not* hand-build), configured for: headings, lists, links, bold/italic,
  code, **tables with a constructor UX**, and **image upload** (drag-drop + picker) storing to the
  platform's object storage. Output stored as structured content (e.g. Tiptap JSON), rendered
  server-side sanitised — never raw HTML from the client.
- **Replies**: flat-with-quoting in v1 (a thread is one conversation between ≤ a handful of
  people — nested branching is forum cosplay). Edit window for one's own posts, with an "edited"
  marker; no deletes of others' posts except coach-moderation (LB-010 wires reporting).
- **Cross-references**: an inline reference to another program/module/thread the *reader* can
  access, rendered as a titled chip that links. 🔴 The reference stores the target **id**, never a
  URL, and renders only if the reader can see the target (LB-001 criterion 1's rule reaches
  embeds).
- **Attachments rail on the composer** — the *slot* ships here (files listed under a post); the
  storage/quota machinery and recorder are LB-007. v1 slot accepts nothing until LB-007 lands, or
  small files only behind the same quota check — implementer's call, recorded in the PR.
- **Unread state per thread per participant** — stored here, consumed by LB-003's notifications
  and the tree UI's unread badges.

## Acceptance criteria

1. Coach posts rich text with an image and a 3×4 table; coachee sees it pixel-faithful; a
   malicious payload in content (script tag, event handler, javascript: URL) is inert — proved by
   a sanitisation test suite, not by trying a few strings in the browser.
2. A reply round-trip updates unread state for the other party and not for the author.
3. A cross-reference to a thread the coachee cannot see renders as nothing (not a broken chip)
   for them, and as a working chip for the coach.
4. An uploaded image is reachable only through an authorised URL — a logged-out fetch of the blob
   URL fails. (The D8 habit: prove the negative on the wire, not in the UI.)

## Not in v1

Nested reply branching, reactions, @-mentions, drafts sync across devices, full-text search,
collaborative editing of a post.
