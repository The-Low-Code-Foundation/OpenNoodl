/**
 * LAS-007 §3 — the traps, pushed ahead of the doctrine.
 *
 * The audit's cleanest finding about a mid-tier model: it acts on what arrives
 * unasked and retrieves nothing optional. Haiku read the doctrine that came back
 * inside `get_project_info` and decomposed correctly on its first try; across the
 * same 42 turns it called `list_examples`, `get_example` and the project docs
 * **zero** times. So the pushed channel works and the pull channel does not, and
 * the cheapest thing to put in the pushed channel is the short list of things
 * that silently do nothing.
 *
 * Every line here is a defect this project measured, not a style preference:
 *
 *  - the interface trap is F2, which shipped four identical "Text" cards under a
 *    clean `validate:project`;
 *  - the plug inversion is F8/F9, which made the reference build's ProductCard
 *    render only under a harness that rewrote it, and which was ALSO wrong in
 *    three of this repo's own recipes until LAS-007 corrected them;
 *  - `Static Data` and `Columns` are the two primitives neither measured model
 *    found (haiku found neither; sonnet needed 75 exploration calls);
 *  - the unsized absolute box is F7, the badge pill that renders parent-sized;
 *  - "verify by looking" is F5 — a graph is a claim and a render is evidence,
 *    and an image URL that returns 200 can still be the wrong photograph.
 *
 * Deliberately short and deliberately imperative. This is the block a model reads
 * before it knows what any of the words mean, so every line states the mechanism
 * and the consequence and stops. The long-form reasoning is the doctrine's job.
 *
 * The `decomposition.ts` containment rule: the block an external agent reads out
 * of `get_project_info` and the one the in-editor prompts carry are literally the
 * same bytes.
 *
 * ⚠️ **FIX-006 gave this module its one import**, `NodePicker.chooser.ts`, which
 * is itself import-free by design and for this reason — the picker's comparative
 * copy and the prompt's must not be two hand-maintained descriptions of the same
 * three nodes. Nothing else may be imported here: this module is reached from
 * `noodl-mcp`'s `editor-deps`, so anything touching React, Electron or an editor
 * singleton fails the server to *start*.
 *
 * @module AiAssistant/authoring/prompts/traps
 */

import { chooserNotes } from '../../../../views/NodePicker/NodePicker.chooser';

/**
 * FIX-006 §1 — the three-way choice, pushed rather than left to be pulled.
 *
 * The report's node-choice half: the AI reached for a **Script** node for a one-node string
 * transformation, and then wrote Function-shaped code into it. Both halves were prompt
 * *absences*. Nothing in any prompt compared Function / Script / Expression — the only
 * comparative copy in the product is the picker's chooser, which the model never sees — and
 * the enriched catalog's `Javascript2.whenToUse` is correct but **pull, not push**: it arrives
 * only after the model has already decided to fetch that type.
 *
 * ⚠️ **Sourced from the picker's own copy, not retyped.** `NodePicker.chooser.ts` is
 * import-free precisely so it can be read from here, and a second hand-maintained description
 * of the same three nodes is the drift this repo has been bitten by before. What is added
 * below is the one thing the chooser deliberately does **not** carry: the Script node, which
 * it excludes entirely — so nothing anywhere told the model when *not* to reach for it.
 */
function threeWaysToCompute(): string {
  // ⚠️ The type name leads every line. The picker can omit it because its card carries the
  // node's title beside the copy; a prompt has no such frame, and a comparison whose options
  // are unnamed is not a comparison. It is also the id the agent must actually write.
  const lines = chooserNotes().map(
    (note) => `   - \`${note.typeName}\` — ${note.headline} ${note.detail} ${note.signals}`
  );

  return [
    'THREE WAYS TO COMPUTE, and reaching past them costs the user a node that cannot run.',
    ...lines,
    // Measured, not asserted: `javascriptnodeparser.js:19-38` wraps the body in `new Function`
    // and invokes it once. A Script node has no `run` signal and no static outputs, so
    // Function-shaped code in one runs at import and never again — while still minting ports,
    // which is what makes the graph look correctly wired.
    '   Reach for the Script node LAST. It has no run signal and no static outputs: its body',
    '   executes once, when the project loads, and only signals declared inside define({…}) or',
    '   script({…}) ever run again. Function-shaped code in a Script node runs once and can',
    '   never be triggered — and it still mints ports, so the graph looks wired and is not.'
  ].join('\n');
}

/**
 * The comparison, as one block both channels can carry.
 *
 * 🔴 **Exported because `AUTHORING_TRAPS` does not reach the in-editor AI.** FIX-006 §1 reads
 * as though it does — *"already shared by both clients via `editor-deps.ts`"* — but that is a
 * statement about the module being *reachable* from the MCP bundle, not about it being *used*
 * by the editor's own authoring prompt. Measured: `AUTHORING_TRAPS` has exactly two consumers,
 * both in `noodl-mcp` (`editor-deps.ts`, `tools/read.ts`). No prompt under `prompts/` imports
 * it. So a trap added only here would have fixed the report for external agents and left the
 * in-editor AI — the likelier author of the reported node — exactly as it was.
 */
export const THREE_WAYS_TO_COMPUTE = threeWaysToCompute();

/**
 * FIX-006 §2 — the code-style clause.
 *
 * The report's second half: *"it used like `var foo = "bar"` type code instead of more modern
 * const / let, and used a complex regex function instead of a simple splice."* No prompt, tool
 * description, catalog field or convention template mentioned code style anywhere, so the model
 * fell back to its training-era Noodl bias — which is 2019 Noodl.
 *
 * ⚠️ **The last clause is the load-bearing one.** This code is read by the person whose project
 * it is, often as their first sight of JavaScript, so "works" is not the bar.
 */
export const CODE_STYLE = `CODE STYLE — the user reads this code, and often learns JavaScript from it.
   Use const and let, never var. Prefer a string or array method over a regular expression
   wherever either would do — split, slice, replace, includes. Keep bodies short enough to read
   in one go. Write \`Outputs.X = value\` for a value and \`Outputs.X()\` for a signal; a value
   port that is called throws on every run, and a signal port that is assigned never fires.`;

export const AUTHORING_TRAPS = `THE TRAPS — read these before anything else. Each one fails SILENTLY.

1. A component's interface is a \`Component Inputs\` node, and its ports must be plugged "output".
   That inversion is real: values flow OUT of that node into the graph, so "output" is what makes
   them component INPUTS. Plugged "input" the port joins no interface and every wire drawn from it
   is dropped. A component with no interface renders identically however many times you place it.
2. An instance parameter that names no input is discarded without a word. A component instance has
   ONLY the ports its Component Inputs declares — no layout, style or lifecycle ports of its own.
   Set the parameters on the instance; declare the matching inputs on the component.
3. Inline row data is a \`Static Data\` node: a JSON array in one parameter, fed to a \`For Each\`.
   Nobody finds this node. Reach for it before hand-writing three copies of a card.
4. \`Columns\` is the only node in the runtime that reflows. Its layout string is integers and
   spaces — "1 1 2", never "1fr 1fr". Its autoFit mode needs no layout string at all. A Group with
   flexWrap cannot collapse on a narrow screen, because no Group anywhere has a breakpoint.
5. An absolute-positioned Group with no width or height fills its parent: dimensions default to
   100%. That is the badge pill that renders as a page-sized block.
6. Colour and spacing take design tokens — "var(--space-4)", never "#3b82f6" or a bare pixel count.
   Call get_style_vocabulary for what this project actually has.
7. Verify by looking. Call \`render_report\` when you have written anything visual: it renders the
   project headless and returns the numbers and the screenshots. A graph is a claim; a render is
   evidence. An image URL that returns 200 can still be a picture of the wrong thing.
8. ${THREE_WAYS_TO_COMPUTE}
9. ${CODE_STYLE}`;
