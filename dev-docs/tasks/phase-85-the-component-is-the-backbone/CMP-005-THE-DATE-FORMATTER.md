# CMP-005 — The date formatter is eight placeholders, and the docs tell you to go write JavaScript

🔴 **`Date To String` cannot render "Thursday, 10 September 2026" or "3:05 pm". Its own
`whenToUse` text says so and sends the author to a Function node with `Intl`.** That is the shelf
problem in miniature: the product ships the answer *"write it yourself"* for the single most
ordinary thing an app does with a date.

> "Yeah the date formatter I think exists somewhere in the nodes, but it sucks. Building a real date
> formatter prefab would be amazing (or a node if more sensible)." — Richard, 2026-09-10

## 1. What was measured, 2026-09-10 (session 3)

`packages/noodl-runtime/src/nodes/std-library/datetostring.ts`. `Date To String` is **not
deprecated**, is in the node picker, and runs in `browser` and `cloud`.

**The whole formatter is one `.replace()` chain with eight tokens:**

```
{date} {month} {monthShort} {year} {yearShort} {hours} {minutes} {seconds}
```

Everything below is read off that chain, not inferred:

| what an app routinely needs | why it is unreachable today |
|---|---|
| **a weekday** — "Thursday", "Thu" | no token. 🔴 `net.noodl.DateParts` **has** `dayName` and `dayOfWeek` — the data is one node away and the formatter cannot see it |
| **a full month name** — "September" | only `{monthShort}` exists, and it renders "Sep" |
| **a 12-hour clock** — "3:05 pm" | `{hours}` is 24-hour, always. No meridiem token |
| **unpadded numbers** — "9 Sep" | every field goes through `('0' + n).slice(-2)`, so it is "09 Sep" or nothing |
| **an ordinal** — "10th" | no token |
| **a locale** — "sept." in French | 🔴 the node's ONLY `Intl` call hardcodes `'en-US'`, for `{monthShort}`. The `timeZone` port is IANA-aware; **the language is not configurable at all** |
| **relative time** — "3 days ago" | no token |
| **a literal brace** | "everything else is copied through", so `{date}` cannot be printed as text |

⚠️ **The token syntax is bespoke.** It is not moment, not date-fns, not `Intl`, not `strftime`, so
nothing an author already knows transfers — and the only place the eight tokens are written down is
the port's own `description` string.

### 1.1 🔴 The product already documents the gap and ships the workaround

`node-catalog-enriched.json`'s `whenToUse` for this node, verbatim:

> *"For formats beyond these tokens (locale-aware dates, relative times like '2 h ago'), use a
> Function node with Intl or a date library. **Note there is no {day}-of-week token.**"*

This is not an undiscovered defect. It is a known one with the workaround written into the docs,
which is what makes it a CMP task rather than a bug row: **the shipped advice is "write it from
scratch", beside a shelf that exists.**

### 1.2 Two hypotheses measured and REJECTED — do not re-derive them

- ❌ **"The replace chain clobbers prefixes."** `{month}` is replaced before `{monthShort}`, and
  `{year}` before `{yearShort}`, which is the classic ordering bug. **It is not one:** `\{month\}`
  requires a literal `}` immediately after `month`, and `{monthShort}` has `S` there. No defect.
- ❌ **"Changing the node risks the shipped content."** `grep -ro "Date To String" library templates`
  returns **0**. Not one of the 43 prefabs and not one template uses it. The byte-identical
  constraint is about **user projects**, which is a real constraint — but nothing we ship would
  notice, and **nothing we ship demonstrates the node either**. Its single catalog example
  (`logic-autosave-after-typing`) is an example of autosave, not of formatting.

## 2. The decision this task owes first: a node, or a part?

Richard left it open, and the two answers have different reach:

| | **extend the node** | **ship a component/prefab** |
|---|---|---|
| reach | every existing project, no install, no version bump | only projects that install it |
| size | new tokens in one `.replace` chain plus `Intl` calls the file already makes | a component wrapping a `Function`, plus an interface |
| risk | a shipped runtime node: existing output must stay byte-identical (the file's own comments record that this has already been fought once, for `timeZone`) | none to the runtime; but it sits BESIDE `Date To String`, so the shelf then offers two date formatters and an author must choose |
| fixes the actual complaint? | **yes** — the complaint is that the node sucks | **no** — it routes around the node, and `whenToUse` still says "write a Function" |

**Recommendation: the node, additively — then a part that demonstrates it.** The tokens are missing
from the place tokens belong, the diff is small, and a prefab cannot repair a node's own
documentation. ⚠️ But this is AC1: **write the decision down before writing code**, because a
half-built version of either is worse than either.

✅ **And the part is now cheap.** CMP-004 AC4 shipped `export_to_library`, so a date-formatting
component built in a real project can be put on the shelf by exporting it — which is also what makes
this the natural first entry for CMP-004 AC3's *single-part* granularity.

## 2.1 ✅ AC1 — THE DECISION, session 4: **the node, additively; the part comes after and is exported, not hand-authored**

**Decided 2026-09-10 (session 4). Both, in that order, and the node first.** The complaint Richard
raised is *"it exists somewhere in the nodes, but it sucks"* — a part built beside `Date To String`
leaves the node exactly as bad and adds a second thing to choose between, which is the failure mode
§2 named. The tokens are missing from the place tokens belong: one `.replace()` chain, in a file
that already constructs `Intl.DateTimeFormat` twice. **AC2 and AC4 are therefore changes to
`datetostring.ts`**, and the demonstration part (AC5) is built afterwards in a real project and put
on the shelf with `export_to_library` — which is CMP-004 AC3's single-part granularity earning its
first entry rather than a second formatter competing with the first.

🔴 **What happens to the `whenToUse` sentence** — the AC's own condition. Today it reads *"For
formats beyond these tokens (locale-aware dates, relative times like '2 h ago'), use a Function node
with Intl or a date library. Note there is no {day}-of-week token."* After AC2/AC4 **both of its
clauses are false**, so it is not softened, it is replaced: the weekday and locale halves are struck
out and the sentence keeps only the part that stays true — **relative time** ("3 days ago"), which
§4 puts out of scope for a reason (it depends on "now", so it is a node with a clock in it, not a
token). A `whenToUse` that still says "go write JavaScript" for a weekday after this ships is the
same defect wearing the fix as a hat.

### 2.2 🔴 A THIRD document promises this node a capability it does not have

`Date Parts` ships `dayName`, and its port description reads, verbatim:

> *"The English name of the weekday. **For a localised name, format through Date To String**."*

`Date To String` has no weekday token **and** hardcodes `'en-US'`, so the localised name it sends
the author to collect cannot be obtained there by any format string. That is now three places
saying different things about one gap: the node's own port description (silent), the catalog's
`whenToUse` (documents the gap, ships "write it yourself"), and a sibling node's port description
(points at a capability that does not exist). ✅ **`Date Parts`' sentence becomes TRUE with AC4** —
it needs no edit once the locale port lands, which is a second, independent reason to fix the node
rather than route around it.

### 2.3 🔴 THE ONE SHIPPED EXAMPLE THAT SETS A FORMAT SETS A MOMENT.JS PATTERN

`grep -rn "formatString" docs/node-catalog/examples/*.json` returns **exactly one line**, and it is
wrong:

```json
{ "id": "saved_time", "type": "Date To String", "parameters": { "formatString": "HH:mm:ss" } }
```

`HH:mm:ss` is moment/date-fns syntax. This node substitutes **brace tokens only** and copies
everything else through, so that example's status line renders *"Saved a1b2c3d4 at HH:mm:ss"* —
the literal letters, in the shipped corpus, in an example an agent is given as the idiomatic
wiring. ⚠️ It validates: the example gate checks that `formatString` is a real port, not that its
VALUE means anything. **A parameter can be inert and still pass every gate** — see
[[an-inert-parameter-in-a-corpus-example-teaches-a-lie]]. Fixed to `{hours}:{minutes}:{seconds}`.

✅ It is also §1's *"the token syntax is bespoke, so nothing an author already knows transfers"*
with a measurement attached: **the corpus itself reached for the syntax it knew** — and the
corpus was written by us.

## 3. Acceptance criteria

**AC1 — the decision, in writing, before any code.** One paragraph in this file: node, part, or
both, and why. It must name what happens to `whenToUse`'s "use a Function node with Intl" sentence,
because a fix that leaves that sentence standing has not landed.

**AC2 — the tokens an app actually needs exist.** At minimum: weekday (long and short), full month
name, 12-hour clock with a meridiem, unpadded variants, and an ordinal. Graded by a spec that
formats **one fixed instant** through every token and asserts each rendered string — not by reading
the source for the token names.

**AC3 — 🔴 existing projects render byte-identically.** The default format and all eight current
tokens, over a fixed instant, before and after, in both the local-zone and the `timeZone` branch.
Additive only: no current token changes meaning, and the default `{year}-{month}-{date}` is
untouched. ⚠️ This is the AC most likely to be skipped and the only one whose failure reaches
someone's shipped app.

**AC4 — the locale stops being hardcoded, or the decision says why it should not be.** Today
`'en-US'` is written into the one `Intl` call. Either a locale port (defaulting to today's
behaviour, so AC3 still holds), or a paragraph explaining why English month names are correct for
every NodeGX app — one of the two, written down.

**AC5 — it is reachable by someone who does not already know.** A catalog example that IS about
formatting, and a shelf entry, so that CMP-004 AC2's own worked example — *"is there a date
formatter?"* — has an answer on the shelf rather than a node buried in Utilities.

⚠️ **AC2 shipped, and it answers that question with `intl-format`** (see §4). So AC5's remaining
half is no longer "give the shelf an answer" but **"make the two answers tell the truth about each
other"**: the node covers formatting a date you have, `intl-format` covers formatting relative to
now and formatting numbers, lists and plurals. Whatever is built for AC5 has to say which is which,
or an author picks by whichever they met first.

## 4. What this does not own

The other four date nodes (`Date Add`, `Date Compare`, `Date Difference`, `Date Parts`). They were
read while measuring this and none of them is the complaint; `Date Parts` is *evidence* for AC2
(it already computes `dayName`), not a target.

Relative time ("3 days ago") is listed in §1 as a gap and is **out of scope for AC2**: it is a
different job — it depends on "now", so it re-renders on a clock rather than on an input, which is a
node with a timer in it, not a token.

🔴 **AND IT IS ALREADY BUILT. It has been on the shelf the whole time.** Found while building
CMP-004 AC2 later the same day: `library/modules/intl-format` ships a **`Relative Time`** node —
*"turns a date into '3 hours ago' with an optional auto-refresh interval"* — beside `Format
Number`, `Format List` and `Pluralize`, every one of them with a Locale input.

⚠️ **This task walked past it twice in one day**: §1 records relative time as an unreachable gap,
and §4 rules it out of scope as *"a node with a timer in it"* — which is exactly right, and exactly
the node that exists. The reason nobody found it is the reason CMP-004 AC2 existed: those node
names are written in **one place, the entry's description**, and the shelf had no query that read
descriptions. `list_library({query: "relative time"})` answers it now.

✅ **This is the phase's own thesis landing on the phase.** Two sessions measured a product gap, one
of them wrote a fix, and the part was on the shelf beside them — which is the CMP-004 §1 sentence
(*"before an agent builds a part, it looks to see whether the community already built it"*) with
this phase cast as the agent. It also **does not invalidate AC2's decision**: `{ordinal}` and
`{dayName}` belong on the node whatever the shelf carries, and an installed module is a different
trade from a token. It changes what CMP-005 should SAY — see AC5.

## 5. What session 4 built, 2026-09-10

| AC | state | where it is graded |
|---|---|---|
| **AC1** the decision | ✅ §2.1 — the node, additively; the part comes after, and by export | this file |
| **AC2** the tokens | ✅ **13 new tokens**, asserted as rendered strings | `noodl-runtime/test/nodes/cmp-005-date-to-string-tokens.test.ts` (19 specs) |
| **AC3** byte-identical | ✅ golden table captured off the PRE-CHANGE node, both branches | same suite, `describe('AC3 …')` |
| **AC4** the locale | ✅ a `Locale` port; `''` → `en-US`, which is what was hardcoded | same suite, `describe('AC4 …')` |
| **AC5** reachable | ✅ **CLOSED s5** — the catalog example (s4) and the exported shelf entry `format-date` | `library/prefabs/format-date`, graded in this suite's `AC5` describe |

**The token set, for Thursday 10 September 2026 at 15:05:07:**

| | padded | unpadded | named |
|---|---|---|---|
| day of month | `{date}` 09 | `{d}` 9 | `{ordinal}` 9th |
| month | `{month}` 09 | `{m}` 9 | `{monthShort}` Sep, `{monthName}` September |
| year | `{year}` 2026 | | `{yearShort}` 26 |
| weekday | | | `{dayName}` Thursday, `{dayShort}` Thu |
| hour, 24 | `{hours}` 15 | `{h}` 15 | |
| hour, 12 | `{hours12}` 03 | `{h12}` 3 | `{ampm}` pm, `{AMPM}` PM |
| minute | `{minutes}` 05 | `{min}` 5 | |
| second | `{seconds}` 07 | `{s}` 7 | |

**Everything but `{date} {month} {monthShort} {year} {yearShort} {hours} {minutes} {seconds}` is
new** — thirteen tokens where there were eight. `{dayName} {dayShort} {monthName} {monthShort}`
follow **Locale**; everything else is language-independent, `{ordinal}` deliberately so (§2.1 and
`ordinalSuffix`'s own comment).

### 5.1 🔴 THE FORMATTER SHIPS TWICE, AND THE SECOND COPY IS A STRING LITERAL

`packages/nodegx-export/src/emit/dateLib.ts` **re-implements `_format` as emitted source** — the
same eight replacements, written out as an array of quoted lines that becomes `src/lib/date.ts` in
every exported app. A change to the runtime node alone would have made an exported app render a
different date from the one the editor previewed, silently, and nothing in this task's ACs would
have noticed. Both copies now carry the tokens and the locale, and
`packages/nodegx-export/src/analyze/plan.ts` passes the fourth argument.

✅ **What makes that trustworthy is not that both were edited.** `tests/date-family.test.ts` loads
the **emitted** library and drives the **runtime node's own `_format`** over the same formats and
asserts the two strings are equal — a real cross-implementation grade, and CMP-005 added its
tokens and a five-locale case to it. See [[a-second-copy-of-a-palette-drifts-silently]].

⚠️ **A byte-identity gate went red, correctly, and was regenerated by its own documented rule.**
`tests/hls001-corpus-identity.test.ts` hashes 840 emitted files across 44 corpus projects. The
count was **predicted before the golden was touched** — `grep -rl '"Date To String"'` over the
fixtures returns exactly `deadline-desk` and `due-desk` — and came back **4 of 840**: those two
projects' `src/lib/date.ts` and `src/pages/Home.tsx`, nothing else. Written into that file's
header, where its two previous regenerations are recorded.

### 5.2 ✅ AC5 CLOSED, 2026-09-10 (session 5) — the shelf entry, and the two answers now name each other

The catalog example shipped in session 4 (`68/68`, strict). The shelf entry is
**`library/prefabs/format-date`**, built in a real project (`parts-source/`, beside CMP-004) and
written to the shelf by `export_to_library` — **not hand-authored**, so it exercises the round trip
AC4 exists for. One component, four nodes.

**What the part is.** `Component Inputs (Date, Style, Format, Locale)` → a `Function` node mapping
a named style to a token string → `Date To String` → `Component Outputs (Text)`. An app asks for
`"long"` instead of remembering twenty-one tokens, and `Format` overrides it with anything this
node can read, which is what keeps the presets honest rather than a second vocabulary.

| style | renders, for Thursday 10 September 2026 15:05:07 |
|---|---|
| `short` | `10/09/26` |
| `date` (default) | `September 10th, 2026` |
| `long` | `Thursday 10th September 2026` |
| `time` | `3:05 pm` |
| `datetime` | `Thu 10th Sep 2026, 3:05 pm` |
| `iso` | `2026-09-10` — the node's own default, which is what makes it the safe fallback |

**Every preset is written in the thirteen tokens AC2 added**, which is the demonstration AC5 asked
for: without `{dayName} {ordinal} {monthName} {h12} {ampm}` there are no presets, only `iso`.

#### 🔴 The library card is a corpus example with a wider audience, so it is graded

The row above is quoted on the entry's card. **This phase has already shipped one format string
that was a lie** — the corpus example that set `"HH:mm:ss"`, moment syntax this node cannot read,
which validated clean because the gate checked the PORT and never the VALUE.

So the presets are not read out of a test file. `noodl-runtime`'s
`cmp-005-date-to-string-tokens.test.ts` lifts the script **out of the entry on the shelf** —
`library/prefabs/format-date/project/project.json`, the bytes `install_prefab` copies into
somebody's project — and renders every style through this node. Three specs: the table above
verbatim, no `{}` or token letters surviving into any output, and the locale following through
(`fr-FR` → `jeudi 10th septembre 2026`, `{ordinal}` staying English on purpose).
✅ **Control run**: changing one shipped preset to `"HH:mm:ss"` reddens it with
`Received: "HH:mm:ss"` — the historical failure, caught.

#### ✅ "Make the two answers tell the truth about each other"

Both descriptions now carry the other's slug and say which job is **not** theirs — `format-date`'s
opens *"NOT the same thing as the intl-format module"*, `intl-format`'s gained *"NOT the part for
formatting a date you already hold"*. Graded in `cmp004LibraryQuery.test.ts`.

🔴 **And the phase's own worked example changed its answer.** `list_library({query: "is there a
date formatter"})` returned `intl-format` first when session 4 built the query — the honest answer
when the shelf had no date formatter. It now returns **`format-date`** first, with `intl-format`
still in the answer. Session 4's assertion went red on the day the phase closed the gap it was
measuring; the literal was not bumped, both facts are asserted, and the cross-reference is what
makes the ranking not the decision.

⚠️ `intl-format`'s `Utilities` tag was **deliberately left alone**. Fixing that one character would
make `list_library({tag: "Utility"})` correct — and it would also delete the evidence AC2's whole
decision rests on, which `cmp004LibraryQuery.test.ts` pins against the real library. Available as a
follow-up, owner NONE, and it needs that suite rewritten in the same commit.

### 5.3 Regenerated artefacts, and the merge each one needed

- `packages/noodl-types/src/node-catalog.json` + `.d.ts` — `catalog:generate`. ✅ It was **up to
  date at HEAD** (measured by restoring HEAD's `datetostring.ts` and re-running the check before
  regenerating), so the whole diff is this node.
- `packages/noodl-types/src/node-catalog-enriched.json` + `.d.ts` — `catalog:merge`, from the
  authored `docs/node-catalog/enrichment/date-to-string.json`.
- 🔴 `docs-site/docs/nodes/utilities/date-to-string.md` — `docs:nodes` **wipes and rewrites the
  whole directory**, and **28 pages were already stale at HEAD** plus one untracked new page
  (`noodl-cloud-listusersinrole.md`) belonging to somebody's uncommitted catalog work. Snapshot,
  regenerate, restore all but your own page — done twice, because adding the example changed the
  enriched catalog and made the page stale again. See
  [[regenerating-a-shared-artefact-is-an-unperformed-merge]].
