# NAT-015 — A graph you can pull into your project

| Field | Value |
|---|---|
| **Tier** | 3 |
| **Effort** | S/M |
| **Surface** | `editor` |
| **Rulings** | inherits **D15**; the redaction rule from P67's *"a port name is user content whenever its type is"* |
| **Depends on** | **NAT-007** — and 🔴 **do it in the same session**, on the renderer it builds |
| **Promoted** | Was **UNI-018** in phase 67b. Moved here 2026-08-19: it is the closing sentence of this phase, and it is the second half of a seam NAT-007 opens anyway |

## The job

`AskAboutNodeDialog` publishes a redacted graph fragment with a question. NAT-007 makes that
fragment **render** in the editor. This task makes it **arrive**: the answer to *"why doesn't this
work"* is often a corrected graph, and today the only way to act on one is to read it and retype it.

Pull it into your own project — as a selection you place, not as a file you import.

## 🔴 Status — 2026-08-19 (session 8): BLOCKED, and the blocker is that nothing makes one

**Not started, and it should not be started until a decision is made.** NAT-007 built the seam this
task plugs into — `pullFor`, the one verb, the drawn-and-refused state with its named list, all
specced. What it cannot plug into is a fragment, because **no client anywhere composes a
`graph_fragment`.** Measured across both repositories on 2026-08-19:

| Where | What is there |
|---|---|
| `attachment_kind` (migration 0009) | the kind exists in the enum |
| `lib/attachments.ts` | `parseAttachments` accepts it |
| `components/Attachment.tsx:187` | the web **renders** one — and deliberately draws no pull button, because *"UNI-018 is the task that makes this button work"* |
| the editor | **never emits one**, and `uni-016/nodeartifact.test.ts:306` asserts it never will |
| the web | has no composer at all — the only `parseAttachments` callers are the two API routes |

🔴 **This task's own first sentence is false, and the file that made it false says so.**
*"`AskAboutNodeDialog` publishes a redacted graph fragment"* — it does not. `nodeartifact.ts`
considered exactly that and refused, in writing: the excerpt is *"types and wiring with every name
bucketed to `<component>`/`<unknown>`; deliberately NOT executable and not reconstructible.
Filing it under the kind that means 'this can be pulled' would hand UNI-018 a population it cannot
honour."* That reasoning is right, and it is what leaves this task with nothing to pull.

### 🔴 So the real shape of this task is a ruling, not an S/M build

AC3 asks that a pulled fragment be **functionally the fragment**. A functionally-equivalent graph
cannot be bucketed — bucketing is what destroys it. So a `graph_fragment` publishes **real node
types, real component names and real parameter values** out of somebody's project, and P67's rule
applies at full strength: *a port name is user content whenever its type is.*

That is a decision about what leaves a person's machine, which is the class of thing this phase
turns into a ruling. It needs, at minimum:

1. **A ruling** on whether an unredacted graph fragment may be published at all, and by whom.
2. **A consent surface** — UNI-011 AC2's *"what it will send is shown before it sends"* — over a
   payload much larger and much more revealing than the excerpt that rule was written for.
3. **Then** the pull: node-type checking against the local install, id rewriting with
   per-connection fields, one undoable step, and the launcher's no-project state.

⚠️ **Item 3 alone is the S/M this task was scoped as.** Items 1 and 2 are not in it and were not
noticed when it was written, because the task inherited a premise from UNI-018 that UNI-016 had
already overturned.

### ⚠️ What NAT-007 left in place, so nothing has to be rediscovered

The handover was explicit that these two must not be split across sessions, and the reason given
was the shared seam. **The seam is built and specced** — `CommunityAttachmentPull`
(`label` / `onPull` / `blockedReason`), asked **per attachment** by `composeThreadView`, drawn
disabled beside its named reason rather than hidden, with a control asserting an attachment
offering no pull draws no verb. A session that picks this up writes the producer and the applier,
not the plumbing.

🔴 **Do not build a pull for a kind nothing produces.** That is *build the caller* with the arrow
reversed — the consumer exists and the producer does not — and it would ship a verb that no
attachment in the world can offer.

---

## Acceptance criteria

1. A rendered attachment offers **one verb**: put this in my project. It lands where a paste lands,
   selected, undoable in one step.
2. **Node types the local install does not have are handled before anything is written**, not
   after. A fragment from someone running a kit you have not installed is the normal case, and the
   answer is a named list and a refusal to half-apply — 🔴 never a graph with holes in it. A
   partially-applied pull is worse than a refused one because it looks like it worked.
3. The pull **round-trips**: attach a fragment from project A, pull it into project B, and B's
   graph is functionally the fragment. Driven in the real editor with two real projects, not
   asserted over serialised JSON. ⚠️ Round-trip specs on this codebase have passed *around* dropped
   per-connection fields before.
4. **Nothing is written to a project without an explicit action.** Opening a thread must not touch
   the graph; the editor's own history has a case where merely opening a project dirtied every
   component, and this is the same shape.
5. It works from **both** thread surfaces — rail panel (inside a project) and launcher tab (not
   inside one). 🔴 From the launcher there is no project to pull into: that state is designed, not
   discovered at runtime.
6. D15: a refused viewer never reaches an attachment, so never reaches this verb.

## Traps

- 🔴 **Do not grow an "edit and repost" affordance.** NAT-007's trap says rendering is safe because
  the publish path redacted the fragment on the way out. A pull brings that fragment *into* a
  project; if the same UI then offers to send it back, user content round-trips out without
  passing the redaction a second time. **In is not a licence for out.**
- 🔴 **`forEachNode` stops on a truthy return.** Any traversal written to collect node types or
  rewrite ids will silently visit part of the graph. This has bitten this codebase before.
- ⚠️ **Ids must be rewritten, and connections rewritten with them.** A fragment carries ids that
  may already exist in the target project. Per-connection fields are the ones that get dropped.
- ⚠️ **This is the verb that makes the community worth having in the editor at all** — and it is
  also the smallest task in Tier 3. If it slips, the phase still closes; say so rather than letting
  it hold NAT-007.
