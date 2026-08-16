/**
 * UNI-010 slice 2 — the how-to-author brief `create_lesson` hands a model.
 *
 * 🔴 THE EXAMPLES ARE TYPED VALUES, NOT PROSE
 * -------------------------------------------
 * Every condition shown in this brief is a real {@link LessonConditionDef}
 * declared in {@link CONDITION_EXAMPLES} and rendered into the text, so the
 * compiler checks the shapes and `authoringBrief.test.ts` compiles every one of
 * them through the real `compileConditions`. That is deliberate and it is aimed
 * at a specific failure this repo has met more than once: **a doc that lies has
 * examples that lie too**, and a lesson brief is a doc whose only reader is a
 * machine that will copy the examples exactly.
 *
 * The vocabulary is genuinely not guessable — it is `hasParams` (an array, not a
 * string), `paramsEqual` (not `paramsEq`), a bare `connection` key with no
 * `hasConnection` wrapper, and `previewRouteEquals` / `activeComponentEquals`,
 * which compile down to internal names (`viewerpatheq`, `activecomponentnameeq`)
 * that appear in no authored document. A previous session wrote a fixture
 * against the internal names and paid a round trip for it.
 *
 * ⚠️ **What this brief cannot do is make a lesson good.** F5 (variant-blind) and
 * F6 (text–graph divergence) are human classes by definition and no gate scores
 * them. The pedagogy section below is mitigation, and it is written as such.
 *
 * @module noodl-mcp/lessons/authoringBrief
 */

import { SOLUTION_DIR } from '../editor-deps';
import type { LessonConditionDef, LessonManifest } from '../editor-deps';

/**
 * One example per verb in the closed vocabulary, in the order the brief lists
 * them. The test compiles all of them; a verb renamed in `lessonformat.ts` fails
 * here before it can mislead a model.
 */
export const CONDITION_EXAMPLES: ReadonlyArray<{ readonly def: LessonConditionDef; readonly note: string }> = [
  { def: { node: '/#__page__/Home:%Page:#Greeting', exists: true }, note: 'the node is there at all' },
  { def: { node: '/#__page__/Home:%Page:#Greeting', hasType: 'Text' }, note: 'and it is a Text' },
  { def: { node: '/#__page__/Home:%Page:#Greeting', hasLabel: 'Greeting' }, note: 'labelled exactly so' },
  { def: { node: '/#__page__/Home:%Page:#Greeting', hasPort: 'text' }, note: 'the port exists on it' },
  {
    def: { node: '/#__page__/Home:%Page:#Greeting', hasParams: ['text'] },
    note: '🔴 hasParams takes an ARRAY — the parameters are set to something, anything'
  },
  {
    def: { node: '/#__page__/Home:%Page:#Greeting', paramsEqual: { text: 'Hello' } },
    note: '🔴 paramsEqual, not paramsEq — set to these exact values'
  },
  { def: { node: '/#__page__/Home:%Page', isVisualRoot: true }, note: 'this is the page the app opens on' },
  {
    def: { connection: { from: '/#__page__/Home:#Button', to: '/#__page__/Home:#Counter', fromPort: 'click', toPort: 'increment' } },
    note: '🔴 a bare `connection` key — there is no `hasConnection` verb'
  },
  // ⚠️ A real value, not `undefined`: these examples are rendered with
  // JSON.stringify, which drops an undefined property silently — the brief would
  // then show `{"metadata":"styles"}` and teach a verb that does not exist.
  { def: { metadata: 'styles', equals: { theme: 'dark' } }, note: 'a project metadata key holds this value' },
  {
    def: { previewRouteEquals: '/home' },
    note: '⚠️ observes a RUNNING editor — the bundle gate cannot replay it, so a step relying on it alone is ungraded'
  },
  {
    def: { activeComponentEquals: '/#__page__/Home' },
    note: '⚠️ same — which component is open on the canvas is not a property of the files'
  },
  {
    def: { routerLists: '/#__page__/About' },
    note: '🔴 the page is REACHABLE — some Router lists it. A page component nobody routed to is unreachable'
  },
  {
    def: { node: '/#__page__/Home:%Page:%Router', routerLists: '/#__page__/About' },
    note: 'the same question aimed at one router, for a lesson that teaches nested routing or a Page Stack'
  }
];

/** A complete, minimal, sound manifest. Typed, so it cannot drift from the format. */
export const EXAMPLE_MANIFEST: LessonManifest = {
  format: 'noodl-lesson@1',
  title: 'Put some text on the page',
  description: 'Your first node: a Text on the home page.',
  authoredBy: 'ai',
  steps: [
    {
      kind: 'popup',
      body: 'In this lesson you will add a **Text** node to the home page and give it something to say.'
    },
    {
      title: 'Add a Text node',
      body: 'Drag a **Text** node onto the page and set its label to `Greeting`.',
      completeWhen: [{ node: '/#__page__/Home:%Page:#Greeting', hasType: 'Text' }]
    },
    {
      title: 'Give it something to say',
      body: 'Select the Text and type `Hello` into its **Text** property.',
      completeWhen: [{ node: '/#__page__/Home:%Page:#Greeting', paramsEqual: { text: 'Hello' } }]
    }
  ]
};

function conditionLines(): string {
  return CONDITION_EXAMPLES.map((e) => `  ${JSON.stringify(e.def)}\n      // ${e.note}`).join('\n');
}

/**
 * The brief.
 *
 * Written for a model that has the project authoring tools in the same session,
 * so it names them rather than re-explaining what they do.
 */
export function lessonAuthoringBrief(): string {
  return `# Writing a NodeGX lesson

A lesson is a **bundle**: a directory holding a starter project, the lesson's own
answer, and a manifest describing the steps. A learner installs it into the
editor's Learning section, works through the steps in the real editor, and presses
"check my work" — which grades their graph against the manifest's conditions.

## The bundle

    my-lesson/
      lesson.json                 the manifest (below)
      components/ …               THE STARTER — what the learner opens
      nodegx.project.json
      ${SOLUTION_DIR}/
        components/ …             THE ANSWER — the graph after every step is done
        nodegx.project.json

🔴 **The solution is not optional for a generated lesson.** Without it the gate
cannot replay your conditions, cannot test them for ambiguity, and cannot render
them — three of the four machine-checkable failure classes go dark, and the editor
refuses to install a bundle whose author is a model and whose answer is missing.
Build both projects with the ordinary authoring tools, then call \`create_lesson\`
with the two directories.

## The manifest

${JSON.stringify(EXAMPLE_MANIFEST, null, 2)}

Step fields: \`title\` (the timeline card), \`body\` (Markdown, shown when the step
is active), \`kind\` ('card' by default, 'popup' for an intro or outro with no
card), \`completeWhen\`, \`actions\`, \`media\`, \`width\`.

A step with **no** \`completeWhen\` is a Next card the learner clicks through. It
is neither passed nor failed when graded — which is the right shape for
orientation ("find the Text node in the picker"), and the fix when a step keeps
tripping the ghostwriting check below.

## Addressing a node

    ComponentName:%Type:#Label

- The **first** segment is the component's **legacy name**, which is not its
  directory. A page at \`components/__page__/Home\` is named \`/#__page__/Home\`.
  Read it off the component rather than guessing.
- \`#Label\` matches a node's label. \`%Type\` matches a node's **type name**.
- 🔴 **A segment matches only at ITS level.** \`/#__page__/Home:%Text\` will not
  find a Text that sits inside the page's \`%Page\` root — you need
  \`/#__page__/Home:%Page:#Greeting\`. This is the single most common way a
  correct-looking lesson fails, and the gate will tell you about it by replaying
  your conditions against your own solution.
- 🔴 **Prefer \`#Label\` over \`%Type\`.** A path takes the **first** match at each
  segment, so type-only addressing is a lottery the moment a second node of that
  type exists — including one a later step asks the learner to add. Type-only is
  permitted only where the graph guarantees exactly one, and the gate checks that
  against your own solution rather than taking your word for it.

## 🔴 The two vocabularies — the trap that makes lessons silently unfinishable

**Prose uses a node's display name. Conditions use its type name. Many differ.**

A condition naming a display name matches nothing, and the learner is told they
have not done a step they have in fact done. Some of them are worse than that:
\`Variable\`, \`Button\`, \`Text Input\`, \`Checkbox\`, \`Radio Button\` and
\`Cloud Function\` **are** real type names — of the *deprecated* node — so an
"does this type exist?" check passes while the node the learner actually drags
out of the picker is \`Variable2\`, \`net.noodl.controls.button\`, and so on.

Write "drag a **Repeater** onto the page" in the body and \`%For Each\` in the
condition. \`list_node_types\` and \`get_node_type\` give you both names; use them
rather than remembering. The gate rejects display names outright and names the
type name to use — except for \`Array\` and \`Object\`, which map to *two* type
names each and are rejected with no suggestion, because choosing for you would be
choosing wrong half the time.

## The condition vocabulary — all of it

Every condition is an object with exactly one verb. All of a step's conditions
must hold at once.

${conditionLines()}

⚠️ **\`routerLists\` is the one verb whose value is not a node path.** It takes a
component's **legacy name** — the same string the router stores in \`routes\` and a
RouterNavigate aims at, e.g. \`/#__page__/About\` — never a URL like \`/about\` and
never a \`Component:%Type\` address. Its \`node\` is optional: leave it off and any
Router or Page Stack in the project may answer, which is the question a learner's
app actually cares about.

## 🔴 Check what your prose actually asked for

Read every step's \`body\` back beside its \`completeWhen\` and ask one question:
**if the learner does only what the conditions check, does the app work?**

This is the failure that gets shipped, and there is a reason it is *always* in the
same direction. **A condition that is too strong is a hard refusal** — it will not
hold against your own solution, and the gate names the step and stops. **A
condition that is too weak passes every class silently.** So the pressure on you
points one way, and nothing pushes back. Five steps in the last five lessons
written through this brief checked less than their prose asked; two of them left a
learner able to finish the lesson with an app that does not work.

The two shapes to look for, both real:

- **You told them a value; you checked only that something is set.** "Set Type to
  \`json\`" graded with \`hasParams: ["type"]\` passes with Type left on \`csv\` —
  and the list three steps later is empty. If the body names the value, the
  condition is \`paramsEqual\`. If it genuinely does not matter, \`hasParams\` is
  right — but say so on purpose.
- **You told them a route; you checked the destination.** "Create the page from
  the Router's Pages list, then add a Text" graded with the Text's contents passes
  for a component created any other way — which is unreachable, so the next step's
  navigation silently does nothing. That is what \`routerLists\` is for.

⚠️ A step whose prose asks for two things needs two conditions. They all have to
hold at once, so adding one costs nothing but the line.

## 🔴 The starter must NOT already satisfy any step

Whatever a step's \`completeWhen\` checks for has to be **absent from the starter**.
Otherwise the step ticks itself the moment the learner arrives and the lesson has
done the work for them — congratulating them for it. This is the easiest mistake
to make when authoring, because you have the solution in front of you while you
write the starter, and the gate checks for it explicitly.

### ✅ So do not write the starter. Derive it: \`derive_starter\`

Build the **solution** with the ordinary authoring tools, write your steps, then
call \`derive_starter\` with the solution directory and the manifest. It subtracts
each graded step from a copy of the solution and hands you the starter.

    derive_starter({ solution_dir, starter_dir, manifest })   ->  the starter
    create_lesson({ bundle_dir, starter_dir, solution_dir, manifest })

**The condition verb decides what comes out**, which is the part worth reading
before you write your steps rather than after:

| Your condition | The starter |
|---|---|
| \`hasType\` · \`exists\` · \`hasLabel\` · \`hasPort\` | has **no such node** — the learner creates it |
| \`hasParams\` · \`paramsEqual\` | **has the node**, with those parameters unset — the learner fills them in |
| \`connection\` | has both nodes, **not wired** |
| \`routerLists\` | has the page, **not listed by any router** |
| \`metadata\` | is **without that project setting** |

It then replays every graded step against what it produced and **writes nothing
if any step is still complete**, naming the step and why it could not be
subtracted. Two conditions it cannot undo: \`isVisualRoot\` (clearing the project's
root node leaves a starter that renders nothing at all) and the two verbs that
observe a running editor.

🔴 **Read the retractions it reports against your own prose.** The subtraction is
only ever as good as the conditions, so a step that checks less than its prose
asks for produces a starter that hands part of the answer over — and nothing
downstream will tell you, because to the gate that starter is correct.

## Prose, media and links

- Bodies are Markdown. ⚠️ **Auto-linking is off**: a bare URL is never a link.
  Write \`[the docs](https://example.com/page)\`.
- Only \`http\`, \`https\`, \`mailto\` and relative links are allowed; media may be a
  relative path or a \`data:image/\` URI. Anything else is refused — lesson HTML
  reaches a renderer with filesystem access, so this is a security boundary and
  not a style rule.
- \`suggestedNodes\` on a step is currently **not read by anything**. Do not rely
  on it to surface a node in the picker.

## Pedagogy — what no gate can check

The machine can tell you a lesson is *completable*. It cannot tell you it is
*worth completing*, so these are the constraints to hold yourself to:

- **One idea per lesson**, three to six steps. A step is one action the learner
  takes in the editor, and its title says which.
- **Say what to do, then why it works.** The body is read while the learner is
  looking at the canvas — lead with the instruction.
- **Never ask for something the editor does not do.** If you are unsure a control
  exists, check with \`get_node_type\` rather than describing it from memory.
- **The learner's project is the lesson.** Do not write steps that ask them to
  read documentation or leave the editor.
- **Sample data keys must match what the nodes are bound to.** A plausible object
  with the wrong field names renders an empty box, which looks like a broken
  lesson and is the defect this format's authors most often ship.

## What happens when you call \`create_lesson\`

It scores your bundle on four failure classes and **writes nothing unless every
one of them passes**:

- **F1** — a condition that can never match: a display name, a deprecated
  shadowed name, a malformed path, an unsafe URL.
- **F2** — a condition that does not hold against your own solution, or that
  already holds against your starter.
- **F3** — an address that would resolve to the wrong node if a second node of
  that type existed.
- **F4** — a solution that does not validate, draws nothing on screen, or draws
  something the render reports as broken: placeholder text where content should
  be, an empty list, a missing image. ⚠️ **It renders the router's start page.**
  A defect on any *other* page is not seen by F4, so a lesson that teaches a
  second page has its own subject unscored — check that one yourself.

🔴 **None of these four scores whether the lesson is any good.** They cannot see a
step whose condition is weaker than its prose, and they cannot see a step that
grades one correct answer and rejects another equally correct one. Those are
yours.

The refusal names the step, the class and what to change. Fix and call it again.
`;
}
