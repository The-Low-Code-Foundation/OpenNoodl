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

## 4. What this does not own

The other four date nodes (`Date Add`, `Date Compare`, `Date Difference`, `Date Parts`). They were
read while measuring this and none of them is the complaint; `Date Parts` is *evidence* for AC2
(it already computes `dayName`), not a target.

Relative time ("3 days ago") is listed in §1 as a gap and is **out of scope for AC2** unless the AC1
decision pulls it in: it is a different job — it depends on "now", so it re-renders on a clock rather
than on an input, which is a node with a timer in it, not a token.
