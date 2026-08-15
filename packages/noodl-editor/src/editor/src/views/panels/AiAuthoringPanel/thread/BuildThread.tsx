/**
 * BLD-001 — the Build panel is one thread.
 *
 * Header, scrolling turn list, composer — in every state. **Nothing at this
 * level is conditional**, which is the whole point: the panel used to switch
 * whole subtrees on a segmented control, so each of the three had its own start
 * button, its own stop button and its own idea of what "empty" looks like. Here
 * there is one of each, and a state is a difference in what the turn list
 * contains, never a difference in what the panel is.
 *
 * ## `width` exists so BLD-009 has nothing to reimplement
 *
 * The expanded document renders this same component with `width="expanded"`.
 * One implementation, two hosts, per the phase's standing constraint — a second
 * implementation is a thing that drifts, and the acceptance pass (BLD-010)
 * measures both widths against the same mocked states.
 *
 * ## What is deliberately not here
 *
 * The pinned run header is BLD-005. Decisions attached to outcome cards are
 * BLD-003, and live in the host through `renderOutcome`.
 *
 * ## BLD-002 — the five treatments, and where they are
 *
 * Message treatment landed here: five kinds, five sizes. The *sizes* are in the
 * stylesheet (see its header for why they are local rather than on `Text`), and
 * the decision about **what may be collapsed** is in
 * `models/AiAssistant/thread/messages.ts` — pure, because a run that silently
 * swallowed a failed submission would look exactly like one with nothing to
 * hide. `ActivityRun` below renders that answer and does not second-guess it.
 *
 * Only one colour moved: the user's own message. Everything else keeps its
 * token, because measured on the real surfaces nothing here failed AA — the
 * legibility problem was type scale, not contrast (README correction 1, now
 * confirmed live rather than inferred).
 *
 * @module noodl-editor/views/panels/AiAuthoringPanel/thread/BuildThread
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { AuthoringActivity } from '@noodl-models/AiAssistant/authoring';
import {
  collapseActivities,
  formatDuration,
  outcomeSentence,
  stagedComponentCard
} from '@noodl-models/AiAssistant/thread';
import type { Turn, TurnActivity, TurnOutcome } from '@noodl-models/AiAssistant/thread';

import { FeedbackType } from '@noodl-constants/FeedbackType';
import { AiMarkdown } from '@noodl-core-ui/components/ai/AiMarkdown';
import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextArea } from '@noodl-core-ui/components/inputs/TextArea';
import { ScrollArea } from '@noodl-core-ui/components/layout/ScrollArea';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { ReasoningStrip } from './ReasoningStrip';
import { TurnReferences } from './ReferenceChips';
import css from './BuildThread.module.scss';

export type ThreadWidth = 'panel' | 'expanded';

/**
 * One entry in a turn's feed.
 *
 * Lifted from `AiAuthoringPanel` unchanged — `ProjectAuthoringView` renders it
 * too, and a second copy would be the drift the phase's "one implementation"
 * constraint exists to prevent.
 */
export function ActivityRow({ activity }: { activity: AuthoringActivity }) {
  switch (activity.kind) {
    case 'user':
      return (
        <div className={css['User']}>
          <Text textType={TextType.Default}>{activity.text}</Text>
        </div>
      );
    case 'assistant':
      // FIX-003: what the model wrote, rendered as it wrote it — bold, lists,
      // code, links (selectable, and routed through the shared link policy).
      // This is the phase-38 AIB-006 behaviour the plain `<Text>` regressed.
      return (
        <div className={css['Assistant']}>
          <AiMarkdown content={activity.text + (activity.streaming ? '…' : '')} />
        </div>
      );
    case 'reasoning':
      // BLD-004. Its own component and its own channel — never merged into the
      // prose above, which is the string the authoring XML templates parse.
      return (
        <ReasoningStrip
          text={activity.text}
          streaming={activity.streaming}
          at={activity.at}
          lastAt={activity.lastAt}
        />
      );
    case 'tool':
      return (
        <div className={css['Event']}>
          <Icon icon={IconName.File} size={IconSize.Small} />
          <Text textType={TextType.Shy}>{activity.label}</Text>
        </div>
      );
    case 'question':
      // BLD-008 produces these; the treatment is decided here so that task adds
      // an author rather than a fifth opinion about how a question should look.
      // Model-authored, so it gets the same markdown treatment as 'assistant'.
      return (
        <div className={css['Question']}>
          <AiMarkdown content={activity.text} />
        </div>
      );
    case 'submit':
      return activity.ok ? (
        <div className={css['Event']}>
          <Icon icon={IconName.Check} variant={FeedbackType.Success} size={IconSize.Small} />
          <Text textType={TextType.Default}>Submitted — passed validation.</Text>
        </div>
      ) : (
        <VStack UNSAFE_style={{ gap: 2 }}>
          <div className={css['Event']}>
            <Icon icon={IconName.WarningTriangle} variant={FeedbackType.Notice} size={IconSize.Small} />
            <Text textType={TextType.Default}>
              Submitted — rejected with {activity.errorLines.length} problem
              {activity.errorLines.length === 1 ? '' : 's'}. Repairing…
            </Text>
          </div>
          {activity.errorLines.slice(0, 3).map((line, index) => (
            <Text key={index} textType={TextType.Shy}>
              {line}
            </Text>
          ))}
          {activity.errorLines.length > 3 && (
            <Text textType={TextType.Shy}>… {activity.errorLines.length - 3} more</Text>
          )}
        </VStack>
      );
  }
}

/**
 * A span of context reads and passing validations, as one line.
 *
 * This is where D4's twenty-minute build stops being unreadable: a seven-
 * operation run pushes hundreds of "Read node documentation" lines through the
 * feed at the same size as the sentences that matter. What may and may not be
 * inside one is decided by `collapseActivities` — a failed submission never is
 * — and this component only renders the answer.
 *
 * Collapsed by default and expandable, never the reverse: the default has to be
 * the state that is right after twenty minutes, not the one that is tolerable
 * after ten seconds.
 */
function ActivityRun({
  activities,
  summary,
  counts,
  durationMs
}: {
  activities: readonly TurnActivity[];
  summary: string;
  counts: string;
  durationMs?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <VStack UNSAFE_style={{ gap: 4 }}>
      <button
        type="button"
        className={css['Run']}
        aria-expanded={expanded}
        /*
         * BLD-017 F1 splits the strip into two boxes so the duration can sit at
         * the right edge, and two boxes announce as a list — *"3 steps ·
         * validated once, 14s"*. `summary` is the same facts composed as one
         * sentence by `messages.ts`, so the accessible name is unchanged by a
         * decision that was purely about where the number is drawn.
         */
        aria-label={summary}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className={`${css['RunCaret']} ${expanded ? css['is-expanded'] : ''}`}>
          <Icon icon={IconName.CaretRight} size={IconSize.Small} />
        </span>
        <Text textType={TextType.Shy}>{counts}</Text>
        {durationMs !== undefined && (
          <Text textType={TextType.Shy} className={css['RunDuration']}>
            {formatDuration(durationMs)}
          </Text>
        )}
      </button>
      {expanded && (
        <div className={css['RunItems']}>
          {activities.map((activity, index) => (
            <ActivityRow key={index} activity={activity} />
          ))}
        </div>
      )}
    </VStack>
  );
}

/**
 * The fallback rendering of an outcome — what a turn says once it is history.
 *
 * The live turn's outcome is rendered by the host through `renderOutcome`,
 * because the decisions on it need the session objects. This is what the same
 * outcome looks like after the session is gone, and it is the half D5 deleted:
 * scrolling up past an accept used to find nothing, because accepting called
 * `setState(null)`.
 */
function OutcomeSummary({ outcome }: { outcome: TurnOutcome }) {
  switch (outcome.kind) {
    case 'staged-component':
      /*
       * ⚠️ One author, shared with the live card. This sentence and
       * `renderOutcome`'s were character-for-character duplicates until BLD-017
       * needed to split it into the mockup's title and sub — see
       * `outcomeCard.ts` for why that made a pure module unavoidable rather than
       * optional.
       */
      // FIX-003: `AiMarkdown` throughout this component — the sentences are
      // code-built, but they quote model-chosen names, and every outcome row
      // should be selectable and render the same way the turn above it did.
      return <AiMarkdown content={outcomeSentence(stagedComponentCard(outcome))} />;
    case 'accepted-component':
      // BLD-017 F3 — the receipt: this one reached the project.
      return (
        <div className={css['Receipt']}>
          <Icon icon={IconName.Check} variant={FeedbackType.Success} size={IconSize.Small} />
          <AiMarkdown
            content={
              outcome.mode === 'update'
                ? `Updated ${outcome.legacyName} — one undo restores the previous version.`
                : `Added ${outcome.legacyName} to your project — undo removes it.`
            }
          />
        </div>
      );
    case 'plan':
      return (
        <AiMarkdown
          content={
            `A plan of ${outcome.plan.operationCount} operation${outcome.plan.operationCount === 1 ? '' : 's'}: ` +
            `${outcome.plan.targets.join(', ')}.`
          }
        />
      );
    case 'plan-applied':
      // The other outcome that reached the project, so the same receipt.
      return (
        <div className={css['Receipt']}>
          <Icon icon={IconName.Check} variant={FeedbackType.Success} size={IconSize.Small} />
          <AiMarkdown
            content={
              `Applied — ${outcome.componentCount} component${outcome.componentCount === 1 ? '' : 's'} changed` +
              `${outcome.docs.length > 0 ? `, ${outcome.docs.join(' and ')} written` : ''}` +
              `${outcome.backendName ? `, backend "${outcome.backendName}" running` : ''}.`
            }
          />
        </div>
      );
    case 'docs-drafts':
      return (
        <AiMarkdown
          content={
            `Drafted ${outcome.authored} document${outcome.authored === 1 ? '' : 's'}` +
            `${outcome.declined > 0 ? `, left ${outcome.declined} alone` : ''}` +
            `${outcome.errors > 0 ? `, ${outcome.errors} failed` : ''}.`
          }
        />
      );
    case 'note':
      return (
        <div className={css['Event']}>
          <Icon
            icon={outcome.tone === 'danger' ? IconName.WarningCircleFilled : IconName.WarningTriangle}
            variant={outcome.tone === 'danger' ? FeedbackType.Danger : FeedbackType.Notice}
            size={IconSize.Small}
          />
          <AiMarkdown content={outcome.text} />
        </div>
      );
  }
}

export interface BuildThreadProps {
  /** One implementation, two hosts. `panel` is the 400px sidebar. */
  width?: ThreadWidth;
  turns: readonly Turn[];

  /**
   * The rich card for a turn's outcome, when the host has one.
   *
   * Returning `undefined` falls back to {@link OutcomeSummary} — which is what
   * every turn but the live one gets, because the decisions on an outcome need
   * a session that no longer exists once the turn is history.
   */
  renderOutcome?: (turn: Turn) => React.ReactNode | undefined;

  /** Shown above the turn list, in the header. The experimental flag lives here. */
  header?: React.ReactNode;
  /**
   * BLD-005 — pinned between the header and the scroll area, for as long as a
   * run is live.
   *
   * A separate slot rather than more `header`, because the two have opposite
   * lifetimes: `header` is chrome that is always there (and BLD-006's thread
   * switcher will want it), while this exists only while something is running.
   * Folding them together would mean the caller re-deciding, on every render,
   * which half of one node is currently allowed to exist.
   */
  runHeader?: React.ReactNode;
  /**
   * BLD-004 — what a busy turn shows instead of the bare "Working…".
   *
   * A node rather than a `lastActivityAt` prop, because the liveness belongs to
   * whichever producer is running and this component knows about none of them.
   * Absent, the turn falls back to the sentence below, which is what a producer
   * with no heartbeat wired should show: the only claim it can evidence is that
   * a turn is open.
   */
  heartbeat?: React.ReactNode;
  /** Shown in place of the turn list when there are no turns. */
  emptyState?: React.ReactNode;
  /**
   * BLD-009 — a one-time offer, between the conversation and the composer.
   *
   * Its own slot rather than a turn, because it is not something anybody said:
   * BLD-002 defined five message kinds and an offer about the *workspace* is
   * none of them. Below the scroll area so it cannot be scrolled past — an offer
   * the user never sees is an offer that was not made — and above the composer
   * so it reads as chrome attached to the thread rather than as the agent's last
   * word.
   */
  notice?: React.ReactNode;
  /**
   * BLD-009 — where this thread was scrolled to, across a change of host.
   *
   * ⚠️ A ref owned by the *caller*, and that is the whole mechanism. Moving
   * between hosts moves the portal's container, which React implements as a
   * delete and a recreate — the panel component and all its state survive, but
   * every DOM node under it is new, and `scrollTop` is a property of a DOM node.
   * A `useRef` declared in this file would be recreated with them. The caller's
   * ref outlives the remount because the caller does.
   *
   * Acceptance criterion 2 is "the thread keeps its scroll position", and this
   * is the only part of "nothing restarts" that is not free.
   */
  scrollMemory?: React.MutableRefObject<number>;

  // ── Composer ───────────────────────────────────────────────────────────────
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  /** False disables Send and Enter alike — one rule, not two that can disagree. */
  canSend: boolean;
  placeholder?: string;
  sendLabel?: string;
  /** A run is in flight. The composer stays; Send becomes Stop. */
  busy?: boolean;
  onStop?: () => void;
  /**
   * BLD-011 — rendered above the text area, inside the composer's border.
   *
   * A slot rather than a `references` prop, for the reason `heartbeat` and
   * `runHeader` are slots: this component renders a thread and knows about no
   * producer, and a `Reference` is something the *panel* resolves out of a
   * `ProjectModel` this file must never reach. It also keeps the chip row and
   * the attach control one decision made in one place, rather than two props
   * that can disagree about whether there is anything attached.
   *
   * Inside the composer's border on purpose: what a message carries is part of
   * the message, and putting it above the border would read as thread content —
   * a fifth message kind BLD-002 never defined.
   */
  composerAccessory?: React.ReactNode;
  /**
   * BLD-013 — files dropped on the composer or pasted into it.
   *
   * The handler lives here rather than in the panel because both events are DOM
   * plumbing on *this* element: a paste has to be caught where the caret is
   * (inside the `TextArea`, and it bubbles to the composer), and a drop needs
   * its `dragover` default prevented on the same box or the OS opens the file
   * instead. The panel is handed a plain `File[]` and never sees a
   * `DataTransfer`.
   */
  onComposerFiles?: (files: File[]) => void;
  /**
   * BLD-016 — the three handles a completion menu over this text area needs.
   *
   * ⚠️ Deliberately the **opposite** shape from `onComposerFiles`, which takes a
   * `DataTransfer` apart here and hands the panel a plain `File[]`. That works
   * because a drop is an event with a payload and nothing more. A mention menu
   * is not: it has to read the caret at the instant a key lands, decide whether
   * that key belongs to it, stop the text area acting on the ones that do, and
   * then put the caret after the token it inserted. Reducing that to events
   * would mean inventing a vocabulary here for a mechanism that lives entirely
   * next door — so this hands over the element instead and keeps the knowledge
   * in one file (`thread/mentions.ts` and its host).
   *
   * A grouped object rather than three props so the set arrives together: a
   * `ref` without the key handler is a menu that cannot be driven, and having
   * one without the other compile is not worth the tidier signature.
   */
  composer?: ComposerBindings;
}

/** BLD-016 — see {@link BuildThreadProps.composer}. */
export interface ComposerBindings {
  /** The text area itself: caret in, caret out, focus. */
  ref?: React.Ref<HTMLTextAreaElement>;
  /** Every keystroke. Call `preventDefault()` to consume one — that also
   *  suppresses Enter's send (FIX-002), so picking a menu row cannot submit. */
  onKeyDown?: (ev: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /** The caret moved — a click, an arrow key, a selection. */
  onSelect?: React.ReactEventHandler<HTMLTextAreaElement>;
}

export function BuildThread({
  width = 'panel',
  turns,
  renderOutcome,
  header,
  runHeader,
  heartbeat,
  emptyState,
  notice,
  scrollMemory,
  value,
  onChange,
  onSend,
  canSend,
  placeholder,
  sendLabel = 'Send',
  busy,
  onStop,
  composerAccessory,
  onComposerFiles,
  composer
}: BuildThreadProps) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  /** BLD-013 — whether a drag is currently over the composer. Paint only. */
  const [dragging, setDragging] = useState(false);

  /*
   * BLD-009 — save and restore the scroll offset across a change of host.
   *
   * ⚠️ The scroller is `ScrollArea`'s root, which carries `css['Body']`, and it
   * is found by walking this element's own children rather than with a
   * selector: a CSS-module class name is a generated string, and building a
   * selector out of one means escaping whatever the hasher produced. Matching on
   * `classList` asks the DOM the same question with nothing to quote.
   *
   * `useLayoutEffect`, not `useEffect`: restoring after paint shows one frame of
   * the thread at the top before it jumps, which reads as the conversation
   * having reset — the exact thing this task promises does not happen.
   *
   * The offset is restored as a pixel count, and the two hosts wrap text at
   * different measures, so the same turn does not sit at exactly the same
   * `scrollTop` in both. It is deliberately not converted to a fraction: a
   * fraction is *also* wrong, and it is wrong in a way that moves the further
   * you are from the top. What the user needs is to land in the same part of the
   * conversation, and the browser clamps whatever overshoots.
   */
  useLayoutEffect(() => {
    if (!scrollMemory) return;
    const scroller = Array.from(rootRef.current?.children ?? []).find((child) =>
      child.classList.contains(css['Body'])
    ) as HTMLElement | undefined;
    if (!scroller) return;
    if (scrollMemory.current > 0) scroller.scrollTop = scrollMemory.current;
    return () => {
      scrollMemory.current = scroller.scrollTop;
    };
  }, [scrollMemory]);

  // Follow the stream, but only while the user is already near the bottom —
  // same rule as the Explain panel, same reason: scrolling up to read something
  // must not be undone by the next token.
  //
  // ⚠️ `busy` is the whole scope of this rule, and it therefore does **not**
  // cover the one state in this panel that blocks: BLD-008's open question,
  // which `docsTurns` marks neither busy nor finished because it is waiting on
  // a person (pinned in `tests-unit/bld-008/docsTurns.test.ts`). Driving it
  // showed the thread parked at `scrollTop: 26` of `547` with the question
  // below the fold. That is fixed in `InterviewCard`, not here, because only it
  // knows which element the question is — and it wants `block: 'start'`, the
  // opposite end from this rule's, since a question card is taller than the
  // viewport and anchoring its bottom hides the question itself.
  const lastTurn = turns.length > 0 ? turns[turns.length - 1] : undefined;
  const tailLength = lastTurn ? lastTurn.activities.length : 0;
  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor || !busy) return;

    let scroller: HTMLElement | null = anchor.parentElement;
    while (scroller && scroller.scrollHeight <= scroller.clientHeight) {
      scroller = scroller.parentElement;
    }
    if (!scroller) return;

    const distanceFromBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    if (distanceFromBottom < 80) anchor.scrollIntoView({ block: 'end' });
  }, [tailLength, turns.length, busy]);

  return (
    <div ref={rootRef} className={`${css['Thread']} ${css[width === 'expanded' ? 'is-expanded' : 'is-panel']}`}>
      {header && <div className={css['Header']}>{header}</div>}
      {/*
        BLD-005. Outside the `ScrollArea` on purpose — that placement IS the fix,
        and putting it one element lower would restore the defect exactly.

        Rendered bare, with no wrapper of its own: the node passed here is a
        component that renders `null` when no run is live, so a wrapper would be
        truthy whenever the *element* existed rather than whenever it drew
        anything, and would leave an empty box above every idle thread.
      */}
      {runHeader}

      <ScrollArea UNSAFE_className={css['Body']}>
        <div className={css['Turns']}>
          {turns.length === 0 && emptyState}
          {turns.map((turn) => {
            const rich = renderOutcome?.(turn);
            return (
              <div key={turn.id} className={css['Turn']}>
                {turn.request !== undefined && (
                  <div className={css['User']}>
                    <Text textType={TextType.Default}>{turn.request}</Text>
                  </div>
                )}
                {/* BLD-011 — what this turn carried, under the words it carried
                    them with. Read-only by construction: `TurnReferences` has no
                    controls to mount, so a historical turn cannot grow one. */}
                {turn.references && turn.references.length > 0 && (
                  <div className={css['TurnRefs']}>
                    <TurnReferences references={turn.references} />
                  </div>
                )}
                {/*
                 * Once per turn, not once per paragraph. The alignment already
                 * says who is speaking — the request is a bubble on the right —
                 * so a repeated label would cost a line per message to restate
                 * what the layout has said, at the width where lines are
                 * scarcest.
                 */}
                {turn.activities.length > 0 && <div className={css['Speaker']}>Assistant</div>}
                {collapseActivities(turn.activities).map((item) =>
                  item.kind === 'run' ? (
                    <ActivityRun
                      key={`run-${item.startIndex}`}
                      activities={item.activities}
                      summary={item.summary}
                      counts={item.counts}
                      {...(item.durationMs === undefined ? {} : { durationMs: item.durationMs })}
                    />
                  ) : (
                    <ActivityRow key={item.index} activity={item.activity} />
                  )
                )}
                {turn.busy &&
                  (heartbeat ?? (
                    <div className={css['Event']}>
                      {/* The fallback for a producer with no heartbeat wired: it
                          says only what is certainly true, that a turn is open.
                          Rule 5 — never claim progress you cannot evidence. */}
                      <Text textType={TextType.Shy}>Working…</Text>
                    </div>
                  ))}
                {rich !== undefined ? rich : turn.outcome && <OutcomeSummary outcome={turn.outcome} />}
              </div>
            );
          })}
          <div ref={anchorRef} />
        </div>
      </ScrollArea>

      {/* BLD-009's offer. Outside the scroll area, like the run header and for
          the same reason — its whole job is to be seen. */}
      {notice}

      <div
        className={`${css['Composer']}${dragging ? ` ${css['is-dragging']}` : ''}`}
        /*
         * ⚠️ `onDragOver` must call `preventDefault()` on **every** dragover,
         * not just once — the browser re-asks on each event, and a handler that
         * only prevents the first one lets the drop fall through to Electron,
         * which navigates the whole window to the dropped file. That failure
         * replaces the editor with a PDF viewer and looks like a crash.
         */
        onDragOver={(event) => {
          if (!onComposerFiles) return;
          event.preventDefault();
          if (!dragging) setDragging(true);
        }}
        /*
         * `dragleave` fires when the pointer crosses onto a *child*, so a naive
         * handler flickers the highlight off every time the cursor passes over
         * the textarea. `relatedTarget` still inside this box means we never
         * actually left it.
         */
        onDragLeave={(event) => {
          const next = event.relatedTarget as Node | null;
          if (next && event.currentTarget.contains(next)) return;
          setDragging(false);
        }}
        onDrop={(event) => {
          if (!onComposerFiles) return;
          event.preventDefault();
          setDragging(false);
          const files = Array.from(event.dataTransfer?.files ?? []);
          if (files.length > 0) onComposerFiles(files);
        }}
        /*
         * A pasted screenshot arrives as a clipboard *file* with an empty name,
         * which is why `classifyAttachment` falls back to the MIME type.
         *
         * ⚠️ The paste is only intercepted when it actually carries files.
         * Reading `clipboardData.files` unconditionally and preventing the
         * default would break ordinary text paste into the composer — the most
         * common thing anyone does here.
         */
        onPaste={(event) => {
          if (!onComposerFiles) return;
          const files = Array.from(event.clipboardData?.files ?? []);
          if (files.length === 0) return;
          event.preventDefault();
          onComposerFiles(files);
        }}
      >
        <VStack UNSAFE_style={{ gap: 8 }}>
          {composerAccessory}
          <TextArea
            value={value}
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
            inputRef={composer?.ref}
            onKeyDown={composer?.onKeyDown}
            onSelect={composer?.onSelect}
            /*
             * FIX-002 (ruled 2026-08-14): `TextArea.onEnter` now fires on
             * **plain Enter**, and Shift+Enter inserts a newline — the same
             * keys as `TextInput.onEnter` and the Explain composer. Before the
             * ruling the two composers answered to opposite keystrokes behind
             * one prop name. A four-component request is still a paragraph;
             * it just takes Shift+Enter to break the line, like every other
             * chat composer the user owns.
             *
             * Guarded by exactly the condition that disables the button, so the
             * two cannot disagree. A dropped or mismatched binding here is
             * invisible to `tsc` (`onEnter` is optional) and to every spec in
             * this task — they grade the pure model, which has no keyboard.
             * ⚠️ BLD-010's driven acceptance recorded Shift+Enter as the send
             * key; the ruling changed the key, so BLD-010 must be RE-DRIVEN.
             */
            onEnter={() => {
              if (busy || !canSend) return;
              onSend();
            }}
          />
          <HStack UNSAFE_style={{ gap: 8 }}>
            {busy ? (
              <PrimaryButton label="Stop" variant={PrimaryButtonVariant.Ghost} isGrowing onClick={onStop} />
            ) : (
              <PrimaryButton
                label={sendLabel}
                icon={IconName.MagicWand}
                isDisabled={!canSend}
                isGrowing
                onClick={onSend}
              />
            )}
          </HStack>
        </VStack>
      </div>
    </div>
  );
}
