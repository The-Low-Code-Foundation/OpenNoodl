/**
 * VFN-009 — every sentence the saved-blocks library says, in one file.
 *
 * Same rule `saveIntent.ts` holds for the save dialog, applied to the manager: the words are a
 * decision and the `<div>` is not, so the words live where a plain-Node runner can read them and
 * the React section renders whatever this returns. A sentence written inline in a `.tsx` is a
 * sentence that can only be checked by driving an editor.
 *
 * A separate file from `saveIntent.ts` rather than an addition to it, because the two answer
 * different questions at different moments — *what am I about to save?* against *what will change
 * if I edit this?* — and the second one has a boundary the first does not:
 *
 * ## 🔴 What this warning may and may not claim
 *
 * **It may claim, because these are facts it can compute:**
 *
 * - where the definition is used, by node and by component (`usage.ts`);
 * - that the **shape** changed, `value` ⇄ `statement` — `expandWorkspace` already refuses that
 *   combination by name (`MyBlocksShapeError`), so the warning is reporting a refusal that is real
 *   and about to happen, not predicting one;
 * - that the **parameters** changed — a removed parameter leaves a socket with nowhere to go, an
 *   added one leaves an empty socket. Both come from `inferSignature`, which runs on every save.
 *
 * **It may not claim that a flow is broken.** Nothing in this system knows what a program is
 * *for*. A warning that guesses at behavioural breakage will be believed, and being believed
 * wrongly is worse than being silent — this register has already filed a guard that was decoration
 * and a cost model that argued against its own best feature. Semantic breakage waits for the
 * unit-testing phase, where a saved block can carry expectations and a change can be graded
 * against them.
 *
 * {@link UNPROVABLE_CLAIM} is that boundary as a machine can check it, and every sentence in this
 * file is run through it by `tests-unit/vfn-009`. A detector that only ever sees compliant input
 * proves nothing, so the spec convicts a hand-written sentence with the same instrument.
 *
 * @module BlocklyEditor/myblocks
 */

import type { MyBlocksScope } from './store';
import type { DefinitionChange } from './definitionChange';
import { distinctSites, type DefinitionUsage, type UsageSite } from './usage';
import { wasChecked, type CrossProjectUsage } from './crossProjectUsage';

/** The glyph the call block wears, reused wherever a definition is named in prose. */
export const MY_BLOCKS_GLYPH = '▣';

/**
 * Language that claims something this system cannot know.
 *
 * 🔴 Not a style rule. Each of these is a claim about what a program *does* rather than about what
 * the editor is about to *refuse*, and the difference is the whole of the ruling above. "3 call
 * sites will stop generating" is a fact — `MyBlocksShapeError` is thrown on the next generate.
 * "3 flows will break" is a guess dressed as a fact, and it will be believed.
 *
 * ⚠️ The list is deliberately about *vocabulary*, because vocabulary is what a later contributor
 * reaches for when they want the warning to sound more urgent. Anything matching it is either a
 * mistake or a decision that has to be argued for and taken out of this list on purpose.
 */
export const UNPROVABLE_CLAIM =
  /\bflows?\b|\bbroken\b|\bbreaks?\b|\bbroke\b|\bstops? working\b|\bno longer works?\b|\bbehaviou?rs?\b|\bcorrectly\b|\bwrong (answer|result|value)s?\b|\bbugs?\b/i;

/** The offending phrase, or `null`. Returns the match so a failure names what it caught. */
export function unprovableClaimIn(sentence: string): string | null {
  const match = UNPROVABLE_CLAIM.exec(sentence ?? '');
  return match ? match[0] : null;
}

/** What each shelf is called, in the one place both surfaces read it from. */
export const SHELF_LABEL: Record<MyBlocksScope, string> = {
  project: 'This project',
  user: 'My backpack'
};

/** What each shelf *means*, for the row that has room to say it. */
export const SHELF_NOTE: Record<MyBlocksScope, string> = {
  project: 'Saved in this project, so it travels with it and a collaborator gets it.',
  user: 'Saved in your backpack, so it follows you between projects and does not travel with this one.'
};

function plural(count: number, one: string, many = one + 's'): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** `Pages/Checkout · Order total` — the component, then the node. Never assembled from a path. */
export function siteLine(site: UsageSite): string {
  const where = (site.componentPath ?? site.componentName ?? '').trim();
  return where ? `${where} · ${site.nodeName}` : site.nodeName;
}

/**
 * Every place, named. Nodes first, then the other saved blocks.
 *
 * 🔴 Naming them, not counting them. A count is a number to dismiss; a list is a thing to check —
 * and the list is what makes the difference between a builder who clicks through the warning and
 * one who opens the two components it named first.
 */
export function usageLines(usage: DefinitionUsage): string[] {
  const lines = distinctSites(usage).map(siteLine);
  for (const definition of usage.definitions) {
    lines.push(`${MY_BLOCKS_GLYPH} ${definition.name} (saved block)`);
  }
  return lines;
}

/**
 * The usage column in the section's row. Short, because it sits in a table.
 *
 * "Not used yet" rather than "0 places": zero is the answer a builder most wants to be sure of
 * before pressing Delete, and it deserves a word rather than a digit.
 */
export function describeUsageShort(usage: DefinitionUsage): string {
  if (usage.total === 0) return 'Not used yet';

  const parts: string[] = [];
  if (usage.nodes.length > 0) {
    const nodes = distinctSites(usage).length;
    parts.push(usage.componentCount > 1 ? `${plural(nodes, 'node')} in ${plural(usage.componentCount, 'component')}` : plural(nodes, 'node'));
  }
  if (usage.definitions.length > 0) parts.push(plural(usage.definitions.length, 'saved block'));

  return parts.join(' · ');
}

/**
 * The sentence the warning leads with.
 *
 * The report asked for *"a big warning that 'this block has already been used 5 times in your
 * project, and your changes will propagate everywhere, are you sure?'"* — this is that, with the
 * places broken out, because "5 times" alone does not tell you whether to worry.
 */
export function describeUsage(name: string, usage: DefinitionUsage): string {
  if (usage.total === 0) {
    return `"${name}" is not used anywhere in this project yet.`;
  }

  const clauses: string[] = [];
  if (usage.nodes.length > 0) {
    const nodes = distinctSites(usage).length;
    clauses.push(
      usage.componentCount > 1
        ? `${plural(nodes, 'Visual Function node')} across ${plural(usage.componentCount, 'component')}`
        : plural(nodes, 'Visual Function node')
    );
  }
  if (usage.definitions.length > 0) {
    clauses.push(`${plural(usage.definitions.length, 'other saved block')}`);
  }

  return `"${name}" is used in ${plural(usage.total, 'place')} — ${clauses.join(', and ')}.`;
}

/** The whole propagation warning, shown before a definition tab opens. */
export function describePropagation(name: string, usage: DefinitionUsage): string {
  if (usage.total === 0) {
    return `${describeUsage(name, usage)} You can edit it freely.`;
  }
  return `${describeUsage(name, usage)} Editing it changes all of them.`;
}

/**
 * 🔴 The one thing the section must **not** claim, said out loud so nobody has to infer it.
 *
 * Measured behaviour from LGC-007 §6: a node's `generatedCode` is regenerated by that node's own
 * next edit and by nothing else, so editing a definition changes what every call site *will*
 * generate without changing a byte of what any of them has already generated. A section that
 * implied otherwise would send a builder away believing their app had already changed.
 */
export function describeRegeneration(usage: DefinitionUsage): string {
  if (usage.nodes.length === 0) return '';
  return (
    'Each Visual Function that uses it picks the change up the next time its own blocks are ' +
    'edited — nothing here rewrites their generated code for them.'
  );
}

/**
 * The shape change, with the call sites that are about to be refused.
 *
 * Returns `''` when the shape did not change, so a caller can concatenate without asking.
 */
export function describeShapeChange(name: string, change: DefinitionChange, usage: DefinitionUsage): string {
  if (!change.shapeChanged) return '';

  const sites = usage.total;
  const head =
    `"${name}" is becoming a ${change.shapeAfter} block; it was a ${change.shapeBefore} block. ` +
    `A ${change.shapeBefore} block and a ${change.shapeAfter} block do not plug into the same hole.`;

  if (sites === 0) return head;

  return (
    `${head} ${plural(sites, 'call site')} will stop generating until you replace the block ` +
    `${sites === 1 ? 'there' : 'at each of them'}.`
  );
}

/** Which sockets a caller gains or loses. `''` when the parameters are unchanged. */
export function describeParameterChange(name: string, change: DefinitionChange): string {
  const parts: string[] = [];

  if (change.removed.length > 0) {
    parts.push(
      `${plural(change.removed.length, 'socket')} (${change.removed.join(', ')}) ` +
        `${change.removed.length === 1 ? 'is' : 'are'} gone, so whatever is plugged in there has nowhere to go.`
    );
  }
  if (change.added.length > 0) {
    parts.push(
      `${plural(change.added.length, 'new socket')} (${change.added.join(', ')}) ` +
        `${change.added.length === 1 ? 'appears' : 'appear'} on every call block, empty.`
    );
  }

  if (parts.length === 0) return '';
  return `"${name}" changed shape at its edges. ${parts.join(' ')}`;
}

/**
 * The delete refusal, with every call site named.
 *
 * §4: *"Deleting a definition that is still referenced must be refused or must offer to
 * inline-and-detach. Silently breaking three other nodes is the worst available outcome."* The
 * store throws `MyBlocksInUseError` carrying both id lists; this is the same refusal with the
 * *names* in it, because an id list is not something a builder can go and look at.
 */
export function describeDeleteRefusal(name: string, usage: DefinitionUsage): string {
  return (
    `"${name}" is still used in ${plural(usage.total, 'place')}. Deleting it would leave ` +
    `${usage.total === 1 ? 'that call block' : 'those call blocks'} pointing at nothing.`
  );
}

/** The alternative that §4 says must be offered, and whose code is already written. */
export function describeDetachOffer(name: string, usage: DefinitionUsage): string {
  return (
    `You can paste the blocks in instead: every call to "${name}" is replaced by a copy of its ` +
    `blocks, and then "${name}" is removed from the shelf. The ${plural(usage.total, 'program')} ` +
    `above generate exactly what they generate now — they just stop sharing.`
  );
}

/** What the detach did, once it has been done. Reported rather than assumed. */
export function describeDetachResult(name: string, rewritten: number): string {
  if (rewritten === 0) return `"${name}" was removed. Nothing was using it.`;
  return `"${name}" was pasted into ${plural(rewritten, 'program')} and removed from the shelf.`;
}

/*
 * ⚠️ **The definition tab's own empty-strip sentence is deliberately NOT here.** It lives in
 * `BlockValueTrace.ts`'s `STATUS_COPY`, beside the six sentences it has to be chosen *between* —
 * that module's own rule is that the copy and the function that picks it are graded against each
 * other, and a seventh reason whose words lived one directory away could not be.
 */

/* ────────────────────────────────────────────────────────────────────────────────────────────
 * VFN-010 — the backpack, in the launcher.
 *
 * Same file rather than a sibling, because the launcher section is the **same component** against
 * a different shelf, and a second vocabulary file would be the first step towards it becoming a
 * second implementation. What is genuinely new here is one thing: the launcher's count is a
 * **sample** and the project's is a census, and every sentence below exists to make that difference
 * visible rather than to hide it.
 * ──────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * 🔴 The caveat that must travel with every cross-project number.
 *
 * The launcher knows the projects in its recent list. That is a record of where it has been, not
 * an inventory of where a block is — the builder may have projects it has never opened, projects on
 * another machine, and projects a collaborator holds. A count that did not say so would be read as
 * a total, and *"used in 0 places"* read as a total is a licence to delete.
 *
 * A separate constant so that no sentence can accidentally be written without it and so that a spec
 * can assert its presence in each one rather than matching prose.
 */
export const CROSS_PROJECT_CAVEAT =
  'It may be used in projects not listed here, and in projects on other machines.';

/** What the report asked the warning to end with. Independent of the number, deliberately. */
export const CROSS_PROJECT_PROPAGATION = 'Changes apply everywhere this block is used.';

/** `Alpha · Pages/Checkout · Order total` — the project, then VFN-009's own site line. */
export function crossProjectSiteLine(projectName: string, site: UsageSite): string {
  return `${projectName} · ${siteLine(site)}`;
}

/**
 * Every place, named, across every project that was read.
 *
 * The same rule as `usageLines`: naming them, not counting them. A count is a number to dismiss;
 * a list is a thing to check — and here the project name is the first thing on the line, because
 * "which project" is the question a backpack block raises that a project block does not.
 */
export function crossProjectLines(usage: CrossProjectUsage): string[] {
  const lines: string[] = [];
  for (const project of usage.projects) {
    for (const site of project.sites) lines.push(crossProjectSiteLine(project.projectName, site));
  }
  return lines;
}

/** `4 recent projects were checked: Alpha, Beta, Gamma, Delta.` — criterion 3, in one sentence. */
export function describeScannedProjects(usage: CrossProjectUsage): string {
  const names = usage.scanned.map((project) => project.name).filter((name) => (name ?? '').trim() !== '');
  if (names.length === 0) return 'No projects were checked.';
  return `${plural(names.length, 'recent project')} ${names.length === 1 ? 'was' : 'were'} checked: ${names.join(', ')}.`;
}

/**
 * Projects in the list that could not be read, reported rather than folded into the absence.
 *
 * 🔴 A project that was skipped is not a project where the block is missing. Counting the two the
 * same way is how a sample starts presenting itself as a census, and it is the failure this whole
 * section is arranged to avoid.
 */
export function describeUnreadableProjects(usage: CrossProjectUsage): string {
  if (usage.unreadable.length === 0) return '';
  const names = usage.unreadable.map((project) => project.name).join(', ');
  return (
    `${plural(usage.unreadable.length, 'project')} in your list could not be read and ${usage.unreadable.length === 1 ? 'was' : 'were'} ` +
    `not counted: ${names}.`
  );
}

/**
 * The whole cross-project answer.
 *
 * > *"Used in **8 places across 2 of your 4 recent projects**. It may be used in projects not
 * > listed here, and in projects on other machines. Changes apply everywhere this block is used."*
 *
 * Three properties, all deliberate: the number is real, its scope is stated, and the warning does
 * not depend on the number being complete — which is why {@link CROSS_PROJECT_PROPAGATION} is
 * present whether the count is eight or zero.
 */
export function describeCrossProjectUsage(name: string, usage: CrossProjectUsage): string {
  if (!wasChecked(usage)) return describeUncheckedUsage(name);

  const scope = describeScannedProjects(usage);
  const unreadable = describeUnreadableProjects(usage);
  const tail = [CROSS_PROJECT_CAVEAT, CROSS_PROJECT_PROPAGATION].join(' ');

  const head =
    usage.siteCount === 0
      ? `"${name}" was not found in any of the projects checked.`
      : `"${name}" is used in ${plural(usage.siteCount, 'place')} across ${plural(usage.projectCount, 'project')}.`;

  return [head, scope, unreadable, tail].filter((part) => part !== '').join(' ');
}

/**
 * What the launcher says **before** a check has run.
 *
 * ⚠️ Scanning N projects off disk is I/O in a dialog, so the check is an explicit action rather
 * than something that happens on render. That makes "not checked" a state the project section does
 * not have, and it must not be rendered as "not used" — `wasChecked` is the distinction and this is
 * the sentence on the other side of it.
 */
export function describeUncheckedUsage(name: string): string {
  return (
    `Where "${name}" is used has not been checked. The launcher reads your recent projects on ` +
    `demand rather than every time this list is shown.`
  );
}

/** How long ago the answer was true. Shown beside it, because a scan goes stale immediately. */
export function describeCheckedAt(usage: CrossProjectUsage, now: Date = new Date()): string {
  if (!usage.checkedAt) return '';

  const at = new Date(usage.checkedAt).getTime();
  if (!Number.isFinite(at)) return '';

  const minutes = Math.floor(Math.max(0, now.getTime() - at) / 60000);
  if (minutes < 1) return 'Checked just now.';
  return `Checked ${plural(minutes, 'minute')} ago.`;
}

/**
 * The delete refusal for a backpack block, naming the **projects** as well as the places.
 *
 * Criterion 5. `MyBlocksStore.remove` throws `MyBlocksInUseError` carrying node ids, which is
 * everything it can know — a node id in another project is not something a builder can go and look
 * at, and the project name is.
 */
export function describeCrossProjectRefusal(name: string, usage: CrossProjectUsage): string {
  const names = usage.projects.map((project) => project.projectName).join(', ');
  return (
    `"${name}" is still used in ${plural(usage.siteCount, 'place')} across ${plural(usage.projectCount, 'project')} ` +
    `— ${names}. Deleting it from your backpack would leave ${usage.siteCount === 1 ? 'that call block' : 'those call blocks'} ` +
    `pointing at nothing. ${CROSS_PROJECT_CAVEAT}`
  );
}

/**
 * 🔴 The launcher's one honest limitation, stated in the UI rather than worked around.
 *
 * The launcher has no node graph and no Blockly window, and VFN-010 names the two options in
 * preference order. This is the second: the launcher manages a block's *metadata* and its blocks
 * are opened from a project. The alternative that is explicitly **not acceptable** is a second
 * Blockly host in the launcher with its own save path — two writers to one shelf, which is the
 * one-fact-two-stores shape, and this shelf has a 1000 ms debounce in front of it.
 */
export const BACKPACK_EDIT_NOTE =
  'The launcher has no canvas, so a block’s own blocks are opened from inside a project — ' +
  'open a project, then Project settings → Saved blocks. Everything else about a block can be ' +
  'changed here.';

/** What the backpack is, on the surface that owns it. */
export const BACKPACK_INTRO =
  'Blocks saved to your backpack. They follow you between projects and are not part of any one of ' +
  'them, so a collaborator opening a project does not get them.';

/** The empty state. Names the gesture that fills it, on the surface where that gesture is not. */
export const BACKPACK_EMPTY =
  'Nothing in your backpack yet. In a project, right-click a block in a Visual Function, choose ' +
  '“Save as a block…”, and pick My backpack.';

/**
 * 🔴 What an export **actually copied** — a defect found in VFN-009's merged section, fixed here.
 *
 * The section said `Copied "X" and its ${library.definitions.length - 1} dependencies` inline, as a
 * *success* toast. `exportDefinitions` returns an **empty** library for a definition that is no
 * longer on either shelf — deleted from a block editor, or from the other instance of this manager,
 * between the row being rendered and the button being pressed — so that arithmetic produced:
 *
 * > *Copied "Discount" and its **-1** dependencies to the clipboard.*
 *
 * announcing a success for a copy of nothing. Reproduced against the real store before fixing.
 *
 * Two things were wrong and both are addressed. The count went negative; and the reason it could is
 * that the sentence was written in the `.tsx`, where neither runner can read it — this file exists
 * precisely so that a sentence with arithmetic in it is gradeable. {@link exportSucceeded} is what
 * the section branches on, so an empty export reports as a failure rather than as a quieter success.
 */
export function describeExportResult(name: string, definitionCount: number): string {
  if (definitionCount <= 0) {
    return `"${name}" is not on either shelf any more, so there was nothing to copy.`;
  }
  if (definitionCount === 1) return `Copied "${name}" to the clipboard.`;
  return `Copied "${name}" and the ${plural(definitionCount - 1, 'saved block')} it depends on to the clipboard.`;
}

/** Whether an export produced anything at all. The branch a toast's severity is chosen by. */
export function exportSucceeded(definitionCount: number): boolean {
  return definitionCount > 0;
}

/** What an import did. Reported from the store's own result, never assumed from the input. */
export function describeImportResult(count: number, rejected: number, scope: MyBlocksScope): string {
  const where = scope === 'user' ? 'your backpack' : 'this project';
  if (count === 0 && rejected === 0) return 'That file contained no saved blocks.';

  const head = count === 0 ? `Nothing was imported into ${where}.` : `Imported ${plural(count, 'saved block')} into ${where}.`;
  if (rejected === 0) return head;

  // Reported, and in the same breath: a partial import that only announced its successes is an
  // import the builder believes was complete.
  return `${head} ${plural(rejected, 'entry', 'entries')} in the file could not be read and ${rejected === 1 ? 'was' : 'were'} skipped.`;
}
