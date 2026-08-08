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
 * Pure and importing nothing, the `decomposition.ts` containment rule: the block
 * an external agent reads out of `get_project_info` and the one the in-editor
 * prompts carry are literally the same bytes.
 *
 * @module AiAssistant/authoring/prompts/traps
 */

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
   evidence. An image URL that returns 200 can still be a picture of the wrong thing.`;
