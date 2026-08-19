# NAT-009 — Work you can take from the editor

| Field | Value |
|---|---|
| **Tier** | 3 |
| **Effort** | M/L |
| **Surface** | `editor`, `core-ui`, `platform` |
| **Rulings** | ✅ D4 · 🔴 **D5 OPEN** (write auth — responding is a write) |
| **Depends on** | **NAT-005**, **NAT-006** |

## The job

`/rfps` and `/rfps/[id]` are the jobs board — the surface where somebody says *"I need this built"*
and somebody else says *"I can build it"*. It has no API and the editor has never heard of it.

This is the surface with the strongest argument for living in the editor, because the person
qualified to answer an RFP is, by definition, sitting in the tool at that moment.

## Acceptance criteria

1. Browse open RFPs in the editor — the list, and one opened to its full brief, with whatever
   budget/timeline/skills fields the web page renders.
2. **Respond from the editor.** This is the whole point and it is a write; 🔴 **D5 gates it.**
3. See your own responses and their state. An offer you cannot check on is an offer you send once.
4. Posting an RFP from the editor is **explicitly in or out of scope in this file** — it is the one
   verb here that a person is more likely to do from a desk than from a graph. Recommendation: read
   and respond ship; posting stays on the web behind a labelled hand-off (D6's pattern).
5. Notifications are honest end to end: if responding is supposed to email the poster, that mail is
   verified to **send**, not merely to queue. 🔴 `outbound_emails` **has no drainer** (phase 67b) —
   a response that silently reaches nobody is worse than no board.
6. D15, and the standard four states.

## Traps

- 🔴 **The relay's `'relayed'` outcome.** UNI-004 built RFPs and coaching around a relay that mails
  the parties directly, and `notify()` returns `'relayed'` to mean "do not queue a second email
  about this". A new editor-side write path must pick its outcome deliberately or it either
  double-mails or silently mails nobody. Read UNI-004 before touching the notification path.
- 🔴 **Responding to an RFP may expose contact details between strangers.** Whatever the web does
  about revealing an email address, the editor must do the same thing — not a more convenient
  thing. This is the surface where "make it frictionless" and "do not leak a personal address" are
  in direct tension, and the web page already contains the decision.
- ⚠️ Money is mentioned on this board. Nothing in this task should imply the platform brokers,
  escrows or guarantees anything. Copy is a decision, not a detail.
- ⚠️ An RFP brief is long-form user content. It reaches the editor through the same
  `parsePostBody` → `Block[]` path as a post, or it does not reach the editor at all.
