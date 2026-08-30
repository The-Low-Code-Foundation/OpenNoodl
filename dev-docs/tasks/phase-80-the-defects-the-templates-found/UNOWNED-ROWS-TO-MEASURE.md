# The five unowned rows that need a measurement, not a re-read

**Written s23 (2026-08-30) at Richard's instruction.** The
[unowned register](TASKS.md#findings-this-phase-raised-that-nobody-owns) holds twelve rows. Seven
were re-measured at HEAD in s23's closing sweep and all seven still hold. **These five could not
be** — each needs a live backend, a screen, or a run, and a grep answers a different question.

🔴 **They are written up here rather than re-asserted in the register, because carrying an
unchecked row forward as though it were checked is how a register becomes a backlog** — the
failure this phase exists to answer. None of them is a task row yet. **Measure first; the row is
what the measurement says it is.**

⚠️ **Every one of these was true when written.** The question is not "was this real?" but **"is
this reading still right at HEAD?"** — a staleness-scoped check confirms everything and is the
mistake phase 77's re-measure nearly made.

---

## 1. `publishPage` issues its refusal after making the page public

**Needs:** a live local backend + the site-builder template installed.

**Recorded reading (DEF-014 s10).** `POST /functions/publishPage` answers **400 "This page could
not be published."** and the page comes back `published: true` with `ACL['*'].read === true`. The
function writes the flag and opens the ACL, *then* runs the sections query that was failing.

**What to measure.** DEF-014 removed **the cause and not the ordering**. So: force *any* later
failure inside that function (a deliberately bad section row will do) and read the page's stored
`published` and ACL afterwards. If the state still opens before the refusal, the row is real and
narrower than it reads — it is about **ordering**, not about that one query.

**Why it matters to a person:** they are told the page could not be published, about a page that
is published and world-readable, and their own admin panel says *draft*. They cannot see it.

⚠️ **It is the template's graph** (phase 77/78's), and DEF-014 §5 says not to fix it from the
backend side. So even if it measures true, **the fix is not phase 80's** — the row's value is
telling phase 77 where it lives.

---

## 2. A second project deploying to a shared local backend kills the backend process

**Needs:** two projects and one backend. **Reproducible outside the editor entirely**, with `curl`
against the committed `nodegx-backend/dist/cli.js` — so no editor code is implicated.

**Recorded reading (DEF-015 s11).** Two `PUT /admin/workflows/<name>` calls carrying bundles that
declare the same component names. First answers `200`. Second answers **nothing** — the process is
gone, on `Error: Duplicate component name /#__cloud__/site/SetSectionAccess`. An **uncaught throw
on an async path**: `loadWorkflow` is `await`ed from the PUT handler, the rejection escapes, Node
exits non-zero. The editor sees only `TypeError: fetch failed` and `ServiceSupervisor` logs
`exited (code=1)` with no reason, because the backend's stderr is not forwarded.

**What to measure.** Re-run the two-PUT sequence at HEAD. Confirm (i) the process still dies, and
(ii) the editor still cannot see why.

**Why it is not exotic:** the product advertises it. The backend card says *"1 attached · 23
others"*, and every site-builder project shares all seven cloud components, so **any two of them
collide on the first deploy of the second**. A *copy* of a project is always a new bundle
(`<projectName>-<hash of directory>`), never a replacement. ⚠️ `Start ephemeral` does **not** avoid
it — it drops data persistence, not the workflows directory.

**Two candidate fixes, and they are not the same size.** Catching the rejection so the PUT answers
400 and the backend survives is **small and clearly right** — that half needs no ruling. Deciding
what *should* happen when two projects deploy the same component names to one backend (namespace
per bundle / refuse the second / last-writer-wins) is a design question with a person attached.
✅ **Split them: ship the survival half, register the semantics half.**

---

## 3. The backend card cannot see a backend-side change — its only refresh is a push

**Needs:** the editor open, a backend serving fewer functions than the project declares.

**Recorded reading (DEF-015 s12).** With the backend genuinely serving three and the project
declaring four, the card kept reading **four ✓ and zero warnings** through a panel close/open
**and** a full renderer reload — backend verified as still serving three afterwards, so it was a
stale reading and not a silent re-push. The panel **hides rather than unmounts** (a stamp set on
the section survived the toggle), so `useEffect` never re-fires; `CloudFunctionsSection` refreshes
on exactly two things, mount and `CLOUD_FUNCTIONS_DEPLOY_STATE_CHANGED` with `isPushing` false —
and a push whose export hash is unchanged **returns early without `notify()`**.

**What to measure.** Reproduce the stale reading at HEAD, then check whether the `missing` row can
render at all: a successful push always leaves the backend holding exactly the project's
endpoints, so `missing` is empty by construction immediately after one. **It can only render when
a push failed.**

⚠️ **Not a defect in DEF-015's fix, and the header is honest** — it says `pushed 54s ago`. The
**rows** overclaim: *"in the project, not on this backend"* reads as a statement about the backend
*now*. Candidate fixes: refresh on panel open, poll while visible, or **reword to say *at last
push*** — the cheapest and possibly the right one.

---

## 4. `Record.Fetched` fires when the `Id` merely binds

**Needs:** a run. **The description half is already fixed** (s28) — it promised *"the record has
been read and the property outputs are up to date"*, false in both halves on that path, and was
regenerated through the catalog, the cloud library and the docs site because **there are four
copies of it**.

**What is left is a behaviour question, not a measurement one:** should a signal named `Fetched`
fire without a fetch at all? `setModel` sends it from the `Id` input setter, where `Model.get(id)`
has minted an empty local model and nothing has been read. **This is deliberate, and `Done` exists
because of it.**

**What to measure.** How many corpus graphs actually depend on the bind-time firing. Two candidate
repairs — fire only when the bound model has data, or split the bind announcement onto its own
port — and **both re-grade browser graphs that rely on today's shape**, so the corpus count *is*
the decision.

🧭 Plausibly Richard's once the number exists.

---

## 5. The one `domelement` port cannot reach the destination its own description names

**Needs:** the typecast table executed, and a wire attempted. Cheap, but not a grep.

**Recorded reading (P77 D27, s29).** `Video.onVideoElementCreated` is typed `domelement` and
described as *"for a **Group to scroll to** or a script to reach"*. `Group`'s
`Scroll To Element - Element` is typed `reference`, and `canCastPortTypes('domelement','reference')`
over the shipped `typecasts` table is **`false`**. The editor refuses the wire the description
prescribes, with a `type-mismatch`.

🔴 **And it would not have worked if it had connected.** `Group.tsx:113` calls
`noodlChild.getDOMElement()` — it wants the **node**; `Video.tsx:217` sends the raw element, which
has no such method, and the guard would report *"no rendered DOM element — it may not be mounted"*
about an element that **is** mounted. **Two defects in eight words of description.**

**Measured over the 175-node catalog:** `domelement` has **1** output, **0** inputs, and reaches
**0** typed inputs (the 14 it reaches are `*` wildcards). Control: `reference` has **27** outputs —
`this`, on every visual node — which is the working wire, one identifier away.

**Shape of the fix, ascending:** repair the description (⚠️ **four generated copies**); or widen
`scrollToElement` to accept either and add the cast; or leave the port as the script hatch it is.

🔴 **Why this row exists at all.** Phase 77's D23 proposed *"a `domelement` output on `Group`,
three lines, `video.ts` is the template"* as a fix. Copying this port would have added a **second**
unconnectable port and read as closed. **The row was stopped because the fix was checked before it
was written.**

---

## How to work these

1. **Measure one, fully, before starting the next.** Five half-measurements is the state this file
   exists to end.
2. **Every measurement needs a known-firing control beside it.** Three of the five are absence
   claims, and *"refused"* and *"never requested"* are identical readings with opposite fixes.
3. **Write the result into the register row itself**, whichever way it goes. 🔴 **Keep the
   disproved ones, marked** — a row that reverses a belief is the most valuable kind, and phase
   78's D4 is the worked example.
4. **A row that measures true gets a `DEF-0xx` id and a person's sentence**, or it is not a row.
   Ids `DEF-033`+ are free as of 2026-08-30.
