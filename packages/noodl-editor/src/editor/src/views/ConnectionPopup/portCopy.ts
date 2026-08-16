/**
 * SIG-001/002/004 — every sentence the connection popup says about what a wire
 * *is*, in one place.
 *
 * ## Why a module and not three inline strings
 *
 * Phase 60 says the same fact on three surfaces: the refusal a builder hits when
 * they drag a value at a signal (SIG-001), the affirmation they need when they
 * go looking for a `Set` that does not exist (SIG-002), and the type sentence on
 * every port's hover explainer (SIG-004). SIG-004's acceptance is explicit that
 * the three must match *word for word where they overlap* — which they cannot be
 * made to do if they are typed out at three call sites, in two components, one
 * of which is a `.scss`-adjacent render seam nobody greps.
 *
 * It imports nothing, so `tests-unit/connection-popup/portCopy.test.ts` grades
 * the wording itself — including the one clause this phase is not allowed to
 * write (below) — in the plain-Node runner, without Electron.
 *
 * ## ⚠️ The sentence this file may not contain
 *
 * "A signal never carries a value" is **false**. `nodelibraryexport.ts:207`
 * allows `boolean -> signal`, so a builder who reads that and then successfully
 * wires a Boolean output into a signal input has caught the editor teaching them
 * something untrue — and this popup would be the only place the behaviour is
 * written down at all.
 *
 * The honest framing, and the one used throughout: a signal is a **moment**, a
 * value is a **standing state**. Only a boolean has an unambiguous moment in it
 * (the flip to true), which is why it is the one value type that may cross.
 *
 * ⚠️ SIG-001 §2's own worked example — *"4 signal inputs · signals carry no
 * value"* — is the forbidden clause. It is not used; `refusedGroupSummary`
 * says "a moment, not a value" instead. See the task's Register.
 *
 * ## The `<strong>` in these strings
 *
 * The popup already renders port help as HTML (`docsBody`,
 * `dangerouslySetInnerHTML`) and `getConnectionStatus` already returns
 * `<strong>`-marked prose, so these follow. Everything interpolated into them
 * is a port name, a type name or an integer that came from the node library —
 * never anything a user typed. `escapeHtml` is applied anyway, because
 * "the library is trusted" is exactly the assumption a custom module breaks.
 */

/** The direction of the port being described, from the builder's point of view. */
export type PortDirection = 'input' | 'output';

/** Why a target port refused the wire being dragged at it. */
export type RefusalReason =
  /** The popup's own rule: a signal output only reaches a signal input. */
  | 'signal-rule'
  /** `canCastPortTypes` said no. */
  | 'type-mismatch'
  /** This exact wire already exists. */
  | 'duplicate'
  /** Refused, with no reason the popup recognises. */
  | 'other';

/** A sentence about a port type: a bolded lead, then the explanation. */
export interface PortTypeSentence {
  /** The three or four words that are the same wherever this type is explained. */
  lead: string;
  /** The rest of it. Plain text with `<strong>`/`<em>` markup allowed. */
  body: string;
}

/** Minimal, HTML-entity-escaping. Port names come from the library, not a user. */
export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Richard's three clauses, which are the right three: what a signal *is*, what
 * it does, and when you actually need one.
 *
 * Deliberately **not** direction-aware. "The node it points at" is true of a
 * signal output (it points at the input it is wired to) and of a signal input
 * (it points at its own node's action), and a second wording would be a second
 * vocabulary — the thing SIG-004 exists to prevent.
 *
 * 🔴 **Exported for UNI-007, and the export is the mechanism behind a written
 * obligation.** Phase 17's curriculum glossary
 * (`CURRICULUM-DESIGN.md` §6) records D7 as *"this glossary cites phase 60's
 * sentence — it does not paraphrase it"*, and adds *"if `portCopy.ts` changes,
 * this line changes with it"*. That was a promise a human had to keep by
 * remembering. The AI tutor's glossary now **derives** its Signal line from this
 * constant ({@link ../models/AiAssistant/explain/tutor}), so phase 60 rewording
 * the sentence rewords the tutor in the same commit rather than leaving the two
 * to drift — which is the failure this repo has already found three times in a
 * day, in this exact document.
 */
export const SIGNAL_SENTENCE: PortTypeSentence = {
  lead: 'Signal — a moment, not a value.',
  body:
    'It runs something on the node it points at. Value connections carry their data on their own, ' +
    "so you usually don't need a signal to set a value — reach for one when you want to control " +
    '<em>when</em> something happens.'
};

/**
 * The mirror line (SIG-002). This one *is* direction-aware: "updates whenever
 * the source changes" is the fact a builder needs while hovering an **input**
 * and is simply wrong read off an output, which has no source.
 */
const VALUE_SENTENCE: Record<PortDirection, PortTypeSentence> = {
  input: {
    lead: 'Value — live.',
    body: 'Updates whenever the source changes. No trigger needed.'
  },
  output: {
    lead: 'Value — live.',
    body: 'Whatever you connect this to updates whenever it changes. No trigger needed.'
  }
};

/**
 * The type sentence for a port, or `undefined` when this phase has nothing
 * type-level to say about it.
 *
 * `*` (the wildcard type) returns `undefined` on purpose: a port that takes
 * anything is neither a moment nor a standing state, and inventing a third
 * sentence for it is how a vocabulary starts to sprawl.
 */
export function portTypeSentence(typeName: string | undefined, direction: PortDirection): PortTypeSentence | undefined {
  if (!typeName) return undefined;
  if (typeName === 'signal') return SIGNAL_SENTENCE;
  if (typeName === '*') return undefined;
  return VALUE_SENTENCE[direction];
}

/** The type sentence as one HTML string, lead bolded. */
export function portTypeSentenceHtml(typeName: string | undefined, direction: PortDirection): string | undefined {
  const sentence = portTypeSentence(typeName, direction);
  if (!sentence) return undefined;
  return '<strong>' + sentence.lead + '</strong> ' + sentence.body;
}

/**
 * The headline on a refused row, in the builder's terms rather than the type
 * checker's.
 *
 * The string `getConnectionStatus` produces — *"Type mismatch a source port of
 * type <strong>string</strong> cannot be connected to a target port with type
 * <strong>signal</strong>"* — is a correct sentence for somebody who already
 * knows the answer. It stays, as the second line, because it is what makes the
 * row useful to someone debugging a custom module's port types (SIG-001 §4's
 * warning). This is what goes above it.
 */
export function refusalHeadline(reason: RefusalReason, sourceTypeName: string, targetTypeName: string): string {
  if (reason === 'duplicate') return 'Already connected.';
  if (targetTypeName === 'signal') return 'Signal inputs are moments, not values.';
  return (
    'A <strong>' +
    escapeHtml(sourceTypeName) +
    '</strong> output cannot drive a <strong>' +
    escapeHtml(targetTypeName) +
    '</strong> input.'
  );
}

/**
 * The one-line summary that stands in for a group of refused ports.
 *
 * This is the row a beginner reads instead of forty grey lines: it exists to
 * show that the category *is there* and was ruled out, which is the whole
 * difference between "the editor is protecting me" and "this tool can't do
 * that".
 */
export function refusedGroupSummary(count: number, reason: RefusalReason, targetTypeName?: string): string {
  const plural = count === 1 ? '' : 's';

  if (reason === 'duplicate') {
    return count + ' already connected';
  }

  if (targetTypeName === 'signal') {
    // Dragging a value at a signal — the first of the two questions this phase
    // is named for. ⚠️ NOT "signals carry no value": see this file's header.
    return count + ' signal input' + plural + ' · a moment, not a value';
  }

  if (reason === 'signal-rule') {
    // The same fact from the other end: a signal output dragged at value inputs.
    // Every port `isBlockedBySignalRule` refuses is a value port by
    // construction — it excludes `signal` and `*` — so naming them that is safe
    // even when they do not share a type.
    return count + ' value input' + plural + ' · a signal is a moment, not a value';
  }

  return count + ' port' + plural + " this wire can't reach";
}

/**
 * The offer that turns the dead end into the lesson: name the wire they meant.
 *
 * ## Both edges of the sword, in one function
 *
 * The phase is named for two opposite questions asked by the same person in one
 * sitting, and this sentence is said in both. Dragging a **value** at a signal,
 * the missing fact is that the wire they already have is live. Dragging a
 * **signal** at a value, it is that the signal is a moment and wants an action
 * to run. "Is already live" read off a `Done` output would be the wrong lesson
 * delivered confidently, which is worse than none.
 *
 * ⚠️ With no alternative it says so plainly and offers nothing. A redirect that
 * connects something arbitrary is worse than the silence this task is replacing
 * (SIG-001 §5).
 */
export function redirectOffer(
  sourcePortName: string,
  sourceTypeName: string,
  alternatives: readonly { displayName: string }[],
  confident: boolean
): { text: string; actionable: boolean } {
  const source = '<strong>' + escapeHtml(sourcePortName) + '</strong>';

  if (alternatives.length === 0) {
    return {
      text: 'Nothing on this node takes a <strong>' + escapeHtml(sourceTypeName) + '</strong>.',
      actionable: false
    };
  }

  /*
   * ⚠️ `confident` decides the *verb*, and it must, because it decides the
   * behaviour. When the best candidate is only "first among ties" the click does
   * not connect (SIG-001 §5 forbids guessing), so the sentence may not say
   * "connect it to X" — the first build did, and clicking it drew nothing.
   */
  if (!confident) {
    return {
      text:
        sourceTypeName === 'signal'
          ? source + ' is a moment — pick a signal input below to run something when it fires.'
          : source + ' is already live — pick a value input below and it updates by itself.',
      actionable: false
    };
  }

  const target = '<strong>' + escapeHtml(alternatives[0].displayName) + '</strong>';

  if (sourceTypeName === 'signal') {
    return {
      text: source + ' is a moment — connect it to ' + target + ' to run something when it fires.',
      actionable: true
    };
  }

  return {
    text: source + ' is already live — connect it to ' + target + ' instead, and it updates by itself.',
    actionable: true
  };
}

/**
 * SIG-002 §2 — the answer to the question at the keystroke where it is asked.
 *
 * A builder who types "set" into this search and gets an empty list has just
 * performed the exact complaint this task is named for. It names `Variable`'s
 * `Set` and `Run On Value Change` because those are the real mechanisms for
 * controlling *when* a value lands, and the point of the sentence is to stop the
 * search, not merely to end it.
 *
 * ⚠️ The names here have to match what the editor shows. Re-check after SIG-003,
 * which may rename the group.
 */
export const TIMING_INTENT_ANSWER =
  'No <strong>Set</strong> on this node — value inputs update on their own. ' +
  'To control <em>when</em> a value lands, use a <strong>Variable</strong> and its <strong>Set</strong>, ' +
  'or untick the port under <strong>Run On Value Change</strong>.';
