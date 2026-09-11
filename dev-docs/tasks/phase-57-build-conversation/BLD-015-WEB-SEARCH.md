# BLD-015 — Web search

**Status:** 🟡 **deferred by Richard, 2026-08-10** · **Track B** · after BLD-011 · **the last unbuilt
Track B task, and the only one of the phase's remaining three that needs Richard to spend money
before a line can be written**

## The state today

**Nothing.** No client, no tool, no key, in either package:

```
grep -rln "web_search\|webSearch\|tavily\|serpapi\|brave.*search"  packages/noodl-editor/src packages/noodl-mcp/src
→ (no matches)
```

It is the only one of Richard's four asks with nothing at all to build on.

## The decision that shapes it: editor-side, not provider-native

Anthropic and OpenAI both offer a server-side web-search tool. Both are tempting: no key, no
backend, well-integrated.

**Do not use them.** LAS-009 shipped per-role providers — a user can legitimately have Anthropic on
`design` and Ollama on `act`, in one build. A provider-native tool would **appear on one role and
vanish on the next**, mid-conversation, with no explanation the user could act on. That is a worse
interface than no search at all, and it breaks phase 55's standing open-weight rule.

**One editor-side backend. Results injected as text. Identical on every provider.** The cost is one
API key in AI settings — one more thing to configure in a product that already asks for one.

**Q4 (open):** which backend, and who pays. Brave Search API and Tavily are the obvious two; Tavily
is built for LLM consumption and returns cleaner extracts, Brave is cheaper and more general.
**Richard's call — it is a recurring cost decision, not a technical one.**

## Build

1. **A `search` tool on the authoring loop**, dispatched by the editor, alongside the existing read
   tools. Its results become a `search` reference on the turn (BLD-011) so they are visible, costed
   and persisted like everything else.
2. **Results are extracts, not link lists.** A list of ten URLs makes the model fetch, which it
   cannot do. Return title + extract + URL, capped per result and in total, using the same
   truncation discipline as every other reference.
3. **Citations, and they are not decoration.** Every claim traceable to a source, rendered in the
   thread with **the URL and the time it was read**. The failure mode of search is a confident answer
   about an API that changed last year; a citation with a timestamp is the only thing that lets a
   user catch it.
4. **A user-initiated path too** — `⌕ Search` in the composer, so a user can hand the agent a result
   set deliberately rather than hoping it searches.
5. **Say when it searched, in the activity strip** — *"Searched the web · 2 queries"*, expandable to
   the actual queries. A search the user cannot see is a cost they cannot predict.
6. **Egress warning, once.** A search sends the user's words to a third party. Say so before the
   first one, not in a settings footnote.

## ⚠️ Not a browsing agent

This fetches search results and extracts. It does **not** click through a site, fill a form, follow a
flow, or authenticate. That is a different product with a different threat model, and it is
explicitly out of scope for the phase.

## Acceptance

- [ ] A question about a third-party API produces a searched answer with ≥ 1 citation carrying URL
      and read-time.
- [ ] The same conversation behaves identically with Anthropic, OpenAI and Ollama holding the acting
      role — **this is the whole reason for the editor-side decision, so it is the acceptance test
      that matters.**
- [ ] With no key configured, the tool is absent and the agent says so if asked to search — it does
      not fail mid-turn.
- [ ] Search results appear as a reference chip with a cost, and persist with the thread.
- [ ] The queries are visible in the activity strip.

## Register

| # | Finding | State |
|---|---|---|
| 1 | Q4 — backend and key not chosen. Blocks implementation, not design | 🟡 **deferred, not open** — Richard, 2026-08-10 (session 17): asked to choose between Tavily and Brave, he chose neither for now, so the task is **unscheduled rather than merely unstarted**. ⚠️ **Do not re-ask it as an open question each session.** It needs him to sign up for and pay for an account, which is a decision with a cost attached and no deadline. The design above is settled and needs nothing from him; only the account does |
