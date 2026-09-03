# DEF-044 — A curated template with no home reaches the shelf, and installs silently

**Status: 🟢 BUILT AND GATED 2026-09-03 (s44).** Promoted out of
[UNOWNED-ROWS-TO-MEASURE.md §9](UNOWNED-ROWS-TO-MEASURE.md), where it had sat measured and unowned
since 2026-08-31. **Richard's ruling of 2026-08-31 already covered it** and nobody had noticed:
*"Refuse at publish, make sure people define a home page, it's a very basic requirement."*
[RICHARD-RULINGS-2026-08-31.md §2](RICHARD-RULINGS-2026-08-31.md) — *"A project with no home page
must not publish as a template"*, unqualified. The editor's door was built on it that day. **The
other two doors were not.**

⚠️ **The fix lives in the `nodegx-community` repo**, not this one — the second row in this phase
that does. Path: `/Users/richardosborne/vscode_projects/nodegx-community`, on top of `2bce720`.

---

## 1. What was wrong, re-measured at HEAD before anything was built

The row was written 08-31 and the phase's own house rule is that a carried-forward row is
unchecked until it is re-run. Re-derived 2026-09-03 against `nodegx-community` at `2bce720`:

| door | who uses it | home gate at HEAD |
| --- | --- | --- |
| `shareAsTemplate.ts` (this repo, `models/template/`) | a builder, from the launcher kebab | ✅ **refuses** — `templateHomeStatus`, built s38 |
| `scripts/publish-project-template.ts` | a curator with a `DATABASE_URL` | 🔴 **`rootNodeId` appears 0 times in the file** |
| `promoteTemplateSubmission` (the queue) | a reviewer clearing submissions | 🔴 **0 times in `scripts/promote-template-submission.ts` and 0 in `src/lib/templatesubmissions.ts`** |

**And there is no install-side rescue**: `createFromTemplate.ts` in this repo mentions no home field
at all — `rootNodeId`, `rootComponent` and `templateHomeStatus` are each **0 hits**. The person
lands on a page-scoped internal component and nothing on any surface says why.

### 1.1 🔴 The open question §9 left, answered: the queue does NOT inherit the editor's gate

§9 asked *"does the submissions path inherit the editor's gate — can a submission be filed by
anything other than the editor's door?"* **It can.**
`src/app/api/v1/community/templates/submissions/route.ts` is an ordinary authenticated write route
taking `files` as a JSON object. Any client with a session token can file one. The editor is one
client of three, and it is the only one that was refusing.

### 1.2 The fixtures said so before the code did

**Every publish fixture in the community suite had no home.** `GOOD` in
`fb005-project-templates.test.ts` was `{"name":"A list and a form"}`; the submissions queue's
happy path was `{"name":"A pricing page"}`; three more were the literal `{}`. Six spec files, eight
payloads, **zero home pages** — a suite modelling the thing it could not see.

---

## 2. What was built

**One predicate, at the one seam both curated doors pass through.**
`publishProjectTemplate` in `src/lib/projecttemplates.ts` is called by the curator's script *and*
by `promoteTemplateSubmission` (inside its transaction), so a single refusal there closes both.
That placement is the module's own stated doctrine — *"a caller that skips this module cannot skip
the gate"* — one level above the database because the rule needs a JSON parse and a **three-way**
answer a CHECK constraint cannot give without lying about a torn manifest.

- `templateHomeStatus(files): 'has-home' | 'no-home' | 'unreadable'` — a faithful copy of this
  repo's `shareAsTemplate.ts` predicate: both spellings (`rootNodeId`, legacy `rootComponent`),
  **non-empty** rather than merely present, `nodegx.project.json` then `project.json`.
- A `TemplateRefused('template-no-home', …)` whose sentence is **the editor's own words for the
  same refusal**, down to *"Make home"* — the affordance's real label, checked in
  `shareTemplateForm.ts:245` rather than guessed.

### 2.1 🔴 It is a SECOND COPY of the predicate, in a second repository, and there is no import path

Recorded rather than pretended away. The two files must stay identical and nothing mechanical
enforces it — a cross-repo import does not exist and neither does a shared package. What is in
place instead: the case table is written out in `tests/fb005-project-templates.test.ts` as data,
each file's header names the other by path, and both say *"if you change one, change both"*.
⚠️ **This is the drift shape [a second copy of a palette drifts silently] names. It is a known
cost of the fix, not an absence of one.**

### 2.2 ⚠️ The hole that is left, named in the spec that leaves it

`project_template_has_manifest` (`0020`) accepts `components/_registry.json` **alone**, and that
file carries no home field — so a registry-only payload is `unreadable`, is not refused, and
reaches the shelf with no home. `templateHomeStatus` abstains by design (*an unmeasured project is
not refused*), so closing this means ruling that a curated template must carry
`nodegx.project.json` — **a rule about the shelf, not about home pages.** There is a green spec
asserting the hole exists, so it cannot close by accident.

### 2.3 What was deliberately NOT done

**The submission route still takes a homeless project, and returns 201.** A proposal is not a
publication; refusing at submit would mean the editor is the only client that can explain what to
do about it, and that route serves any client. A spec pins the 201 and says that if a future
session moves the check, that arm moves with it.

---

## 3. Gates

| gate | reading |
| --- | --- |
| `tsc --noEmit -p tsconfig.json` (community) | **exit 0** |
| `fb005-project-templates` + `fb005-template-submissions` | **96 passed (96), exit 0** |
| the four neighbouring suites that publish templates (`fb005-binary-template-files`, `nat006-api-contract`, `uni011-mirror-api`, `uni005-data-inventory`) | **92 passed (92), exit 0** |
| 🔴 **the REVERTED arm** — the guard disabled with `false &&`, same command | **exit 1: exactly 4 failed, 92 passed** |

🔴 **The reverted arm is the reading that matters.** The four reds are the four refusal claims and
nothing else: every control — the presence arms, the legacy-spelling arm, the two abstentions, the
recorded hole and the predicate table — stayed green with the gate switched off, which is what
says the specs measure the gate rather than the fixtures.

⚠️ **The full community suite was NOT run** (~40 DB-resetting files, serialized). The blast radius
was derived instead: `grep -ran publishProjectTemplate tests scripts src` names six spec files and
all six were run. A caller reaching the shelf some other way would be outside that derivation.

### 3.1 ✅ REL-001 is not blocked — checked, not assumed

`templates/members-area/nodegx.project.json` carries `"rootNodeId": "app_root"`, so the template
0.2.2 puts on the shelf passes the new gate. **This was measured before the gate was written**, on
the principle that a release-blocking gate you did not check against the release is one you find
out about from Richard.

---

## 4. What a reader should not re-derive

- 🔴 **The ruling exists and is unqualified.** Nobody needs to ask Richard again about *whether* a
  homeless template may be published. §9 offered *"refuse at publish OR resolve-and-warn at
  install"* as an open decision; it was answered on 2026-08-31 for the builder's door in words that
  do not mention doors.
- 🔴 **`promoteTemplateSubmission` publishes inside one transaction**, so a refusal there rolls the
  promotion back and the submission stays `pending`. A gate that refused the publish and left the
  submission `accepted` would have been the worse defect — a queue row nobody looks at again — and
  there is a spec on it.
- ⚠️ **A home check must not refuse a module** was §2.1's warning and it does not bite here:
  `TEMPLATE_CATEGORIES` is `starter | data-app | dashboard | site | form | integration`. **There is
  no module category and no module route onto this shelf.** If one is ever added, it must not come
  through `publishProjectTemplate`.
