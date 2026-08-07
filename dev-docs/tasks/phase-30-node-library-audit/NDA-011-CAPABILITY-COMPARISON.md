# NDA-011 §1 — REST vs HTTP Request, capability by capability

**Produced:** 2026-07-30 · **Verdict:** HTTP Request is a superset of everything REST does
declaratively, and **not** a superset of REST as a whole. The gap is one thing, and it is not a DSL.

## The finding that reframes the task

The task asked whether HTTP Request can express what "the REST node's resource DSL" expresses, and
listed the things a DSL is good at and a port list is not:

| The task expected REST to do | Does it? |
|---|---|
| Multiple related endpoints declared once | **No.** One REST node is one `resource` string. |
| Path templating and parameter substitution | Yes — `{name}` in `resource`, substituted from `in-*` inputs. |
| Shared auth/headers across a resource | **No.** There is no resource object and nothing is shared; headers are set per node, in script. |
| Response shaping | Yes — but by running arbitrary JavaScript, not by declaring anything. |

**There is no resource DSL.** REST is one path template plus two `new Function` scripts, and the
things a DSL would justify — declaring a family of endpoints once, sharing auth across them — it
does not do. So "invest in the DSL or replace it" was never the real choice. The real choice is
narrower and easier: HTTP Request already does the declarative half better, and the remaining
difference is *scripting*, which is a Function node's job.

## The comparison

`restnode.ts` (671 lines) against `httpnode.ts` (1,078).

| Capability | REST | HTTP Request | Verdict |
|---|---|---|---|
| **Path templating** | `{name}` in `resource`, replaced from any `in-*` input (`restnode.ts:415-421`) | `{name}` in `url`, replaced from declared `path-*` ports | **HTTP** — REST substitutes from the *whole* input bag, so an input named `id` silently rewrites any `{id}` in the path whether that was meant or not |
| **Method** | GET/POST/PUT/PATCH/DELETE | + HEAD, OPTIONS | **HTTP** |
| **Query parameters** | script only (`Request.parameters`) | `queryParams` list → one typed port each | **HTTP** |
| **Headers** | script only (`Request.headers`) | `headers` list → one typed port each | **HTTP** |
| **Request body** | script only (`Request.content`) | `bodyType` json / form / url-encoded / raw, with a port per field | **HTTP** for the four common shapes; REST for anything else |
| **Authentication** | script only | Bearer / Basic / API Key presets | **HTTP** |
| **Response → output ports** | Response script assigns `Outputs.x`; ports discovered by regex over the script text (`restnode.ts:486-530`) | `responseMapping` list + a JSONPath per output | **HTTP** for extraction |
| **Status code** | script only (`Response.status`) | `statusCode` output port | **HTTP** |
| **Response headers** | not exposed | `responseHeaders` output | **HTTP** |
| **Success / Failure / Canceled** | all three | all three, plus `error` | **HTTP** |
| **Cancel in flight** | `cancel` signal | `cancel` signal | equal |
| **Arbitrary request mutation** | **Request script** | nothing | **REST — the only gap** |
| **Arbitrary response transformation** | **Response script** | JSONPath extraction only | **REST — the only gap** |

Two capabilities, both the same capability: *run some JavaScript*.

## What the scripts can do that JSONPath cannot

Worth being precise, because it decides deletion:

- **Compute**, not just extract: sum a list, format a date, branch on a status code.
- **Carry state between the two scripts** — both are applied with the same `this`
  (`_internal.self`), so a request script can stash something a response script reads.
- **Register output ports from computed names.** The Response script's ports come from a regex over
  its own source (`/Outputs\.[A-Za-z0-9]+/g`), so the port list is whatever the code mentions.

None of this is unreachable in a graph — an HTTP Request feeding a Function node does all of it —
but none of it converts *mechanically*, which is the point that matters for §2.

## §2 — the disposition, and its reason

**Deprecated, not deleted.** `deprecated: true` on `REST2` (`restnode.ts`), so it is out of the
picker and non-creatable, while existing graphs keep loading and running.

The task's stated preference is deletion, on the argument that a true subset is a permanently
maintained duplicate. **REST is not a true subset**, so that argument does not reach it. Deleting it
today would remove the one capability with no mechanical conversion, and would do so before anything
exists to convert the graphs that use it. The maintenance cost of keeping a hidden, uncreatable node
is low and bounded; the cost of deleting a capability with no replacement path is not.

**The conversion path is [LIB-006](../phase-21-library-and-import/LIB-006-LEGACY-IMPORT-ASSIST.md)'s,
as §2 step 3 says.** The declarative half converts cleanly — resource → url, method → method, and
the `{name}` templates map straight onto `path-*` ports. The scripts do not, and should be reported
rather than shimmed. **Revisit deletion once that report exists**: if the conversion finds that real
projects only ever used the scripts for extraction, the gap closes and deletion becomes correct.

Two defects were read in `restnode.ts` on the way past and **deliberately left**, both already
recorded verbatim in the source from PLAT-003 NOTES §27.3 — the `_xhr` handlers that `delete` a
property from the `XMLHttpRequest` instead of the node (so a later Cancel can abort a finished
request), and the default Request script's truncated help text. Fixing a node on its way out of the
picker is work with no user.

## §3 — the state of `httpnode.ts`

**Criterion 4 was already met, by NDA-003.** The six inline empty-value guards are one helper,
`hasHttpParamValue` (`httpnode.ts:80-82`), with the single deliberate exception documented at the
call site: `buildBody`'s `json` branch checks only `undefined`, because JSON has a native `null` and
that is the one place where "clear it" and "omit it" are different outcomes. No further work.

**`responseHeaders` is usable.** It is still declared `type: 'object'`, which was NDA-014's class E,
but NDA-014 §2 added `object → string` to the typecast table and a JSON mirror in `setInputValue`, so
the port now reaches string inputs instead of nothing. Left as `object`, which is the honest type.

## Criterion 3 — the deprecated nodes still in the picker

The task said four. **It is six, and the consequence is worse than "clutter".**

`button`, `checkbox`, `options`, `radiobutton`, `range` and `text-input` all live in
`nodes-deprecated/controls/`, are all registered in `register-nodes.js`, and none of them carried a
`deprecated` flag. `deprecated: true` is what makes a node non-creatable
(`componentmodel.ts:292-295`), so all six were fully available.

The sting is in the naming. The deprecated ones take the plain names — `name: 'Button'`,
`'Checkbox'`, `'Options'`, `'Radio Button'`, `'Range'`, `'Text Input'` — while their modern
replacements are `net.noodl.controls.*` with the same words supplied via `displayName`. So the
picker showed **two entries reading "Button"**, and the one an author reached for was as likely to
be the deprecated one as not. All six are now marked.

Only two editor *test* fixtures reference these types, and `deprecated` blocks creation rather than
loading, so nothing that exists stops working.
