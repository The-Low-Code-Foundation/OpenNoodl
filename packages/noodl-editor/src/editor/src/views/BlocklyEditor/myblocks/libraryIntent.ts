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
