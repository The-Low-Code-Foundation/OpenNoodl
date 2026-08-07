---
title: "Expression"
---
Evaluates a one-line JavaScript expression whose free variables become input ports; outputs the result as value, boolean, string and events.

Expression compiles the JavaScript expression in its `expression` parameter and re-evaluates it whenever any referenced input changes. The `run` signal is additive — it evaluates the expression now and reports `done`, or `failure` if the expression will not compile or throws; untick an input under Run On Value Change to stop that one triggering a run. Every free variable name in the expression text becomes an input port of that name — write `price * quantity` and the node grows `price` and `quantity` inputs. The result is exposed simultaneously as `result` (untyped), `asNumber`, `asString`, `asBoolean`, plus level booleans `isTrue`/`isFalse` and edge signals `isTrueEv`/`isFalseEv` that fire when the truthiness changes.

## When to use it

Small computations and predicates inline in a graph: arithmetic, comparisons, string interpolation via template syntax, ternaries. For multi-statement logic, side effects, or async work use the Function node; for combining two booleans And/Or are clearer.

## At a glance

| | |
|---|---|
| Category | CustomCode |
| Type name | `Expression` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `expression` | String | — | JavaScript expression whose value becomes Result; every identifier in it becomes an input port |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `run` | Signal | — | Evaluates the expression now. This is additional to the inputs that re-run it; untick an input under Run On Value Change to stop that one triggering a run |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `asBoolean` | Boolean | — | Whether Result is truthy, for wiring straight to a boolean input |
| `asNumber` | Number | — | Result read as a number, falling back to 0 when it is not one |
| `asString` | String | — | Result rendered as text, and blank when it is null or undefined |
| `isFalse` | Boolean | — | Whether Result is falsy; null until the expression has been evaluated at least once |
| `isTrue` | Boolean | — | Whether Result is truthy; null until the expression has been evaluated at least once |
| `result` | * | — | What the expression evaluated to; null until it has been evaluated at least once |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once a Run you triggered has evaluated the expression, after On True or On False |
| `isFalseEv` | Signal | — | Fires after an evaluation whose Result is falsy |
| `isTrueEv` | Signal | — | Fires after an evaluation whose Result is truthy |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | The compile or evaluation error, in JavaScript's own words |
| `failure` | Signal | — | Fires when the expression could not be compiled, or threw while being evaluated |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Input ports are created for each free variable referenced in the "expression" parameter (e.g. the expression "a + b" yields number inputs named "a" and "b"). The "result" output and its type follow the expression.

## Ports at runtime

Inputs are runtime-discovered by parsing the expression text: each identifier that is not a built-in becomes an input port registered on demand. The port set therefore changes whenever the expression is edited, and cannot be known without the expression. Reads of Noodl.Variables/Objects inside the expression additionally subscribe the node to those stores.

## Patterns

- Input validation: text ports feed an Expression predicate; its `result` drives a Condition's `condition`.
- Derived display values: `asString` → a Text's `text` for computed captions.

## Watch out for

- Chaining many Expression nodes to build a program — one Function node with readable JavaScript beats a lattice of expressions.
- Side effects in the expression; it may evaluate more often than you expect. Expressions must stay pure.

## Examples

**Validate an input before acting on a click**

The idiomatic gate shape: a Button click does not act directly — it evaluates a Condition. The Condition's boolean comes from an Expression that checks the text input's current value, so the same click either proceeds (ontrue) or reveals an error message (isfalse drives the error Text's visibility as a level, not a pulse). Note the two kinds of flow: text/booleans are values, onClick/eval/ontrue are momentary signals.

## Related nodes

[Function](./java-script-function.md), [Condition](../logic/condition.md), [And](../logic/and.md), [Or](../logic/or.md), [String Format](../string-manipulation/string-format.md), [Number Remapper](../math/number-remapper.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
