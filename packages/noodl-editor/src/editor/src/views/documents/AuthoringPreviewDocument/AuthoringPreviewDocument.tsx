/**
 * AIX-002 — Live authoring preview
 *
 * The graph appearing while the agent writes it — the one thing this product
 * can show that a code-generating AI cannot. A detached, read-only canvas is
 * bound once to an empty preview component; as `submit_component` streams,
 * the session publishes each completed node and this document applies them
 * one at a time through a paced reveal queue, so the canvas renders
 * architecture forming instead of a spinner (or a flash, when a provider
 * hands the whole submission over at once).
 *
 * The preview component is never added to the project — reject remains the
 * absence of an accept call. A repair round resets the canvas and rebuilds:
 * attempt two *is* a different graph, and showing it as one reads truer than
 * morphing the failed attempt in place. Decisions stay where they live: the
 * Build panel owns the session; accept/reject/review here are callbacks into
 * it.
 *
 * @module noodl-editor/views/documents/AuthoringPreviewDocument
 */

import React, { useEffect, useState } from 'react';

import { type AuthoringSession, type AuthoringSessionState } from '@noodl-models/AiAssistant/authoring';
import { AppRegistry, IDocumentProvider } from '@noodl-models/app_registry';
import { acceptLabel, DISCARD_LABEL, REVIEW_LABEL } from '@noodl-models/AiAssistant/thread';

import { FeedbackType } from '@noodl-constants/FeedbackType';
import { ActivityIndicator } from '@noodl-core-ui/components/common/ActivityIndicator';
import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Label } from '@noodl-core-ui/components/typography/Label';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { EditorDocumentProvider } from '../EditorDocument';
// BLD-009 — the two panes, so the expanded workspace shows the same candidate
// rather than a second rendering of it.
import { AuthoringCandidatePane } from './AuthoringCandidatePane';
import css from './AuthoringPreviewDocument.module.scss';

export interface AuthoringPreviewDocumentProps {
  session: AuthoringSession;
  onAccept: () => void;
  /**
   * BLD-003 D3 — `onDiscard`, not `onReject`.
   *
   * The rename is not cosmetic. The two surfaces offering this decision had
   * drifted to different words for it — the thread said "Discard", this bar
   * still said "Reject" — and one of the two places that drift lives is the
   * name the code uses for the callback. The labels now come from
   * `AiAssistant/thread/decisions`; this makes the prop agree with them.
   */
  onDiscard: () => void;
  onOpenReview: () => void;
}

function statusLine(state: AuthoringSessionState): { text: string; type: FeedbackType | null } {
  switch (state.phase) {
    case 'working':
      return {
        text: state.building
          ? `${state.mode === 'update' ? 'Revising' : 'Building'} — ${state.building.nodes.length} node${
              state.building.nodes.length === 1 ? '' : 's'
            } so far…`
          : 'The agent is reading context…',
        type: null
      };
    case 'staged':
      return {
        text: state.staged
          ? `Staged — ${state.staged.nodeCount} nodes, ${state.staged.connectionCount} connections. ${
              state.mode === 'update' ? 'Your component is untouched until you accept.' : 'Nothing is in your project yet.'
            }`
          : 'Staged.',
        type: null
      };
    case 'exhausted':
      return { text: 'The agent ran out of attempts. The last valid candidate (if any) is still staged.', type: FeedbackType.Notice };
    case 'cancelled':
      return { text: 'Stopped. A previously staged candidate survives in the Build panel.', type: FeedbackType.Notice };
    case 'error':
      return { text: state.error ?? 'Something went wrong.', type: FeedbackType.Danger };
    default:
      return { text: '', type: null };
  }
}

function AuthoringPreviewDocument({ session, onAccept, onDiscard, onOpenReview }: AuthoringPreviewDocumentProps) {
  const [state, setState] = useState<AuthoringSessionState>(session.state);

  // This document owns the bar; the pane below owns the two canvases. One
  // subscription, read by both — see `AuthoringCandidatePane.state` for why that
  // is a requirement rather than a convenience.
  useEffect(() => session.onChange(setState), [session]);

  const exit = () => AppRegistry.instance.openDocument(EditorDocumentProvider.ID);
  const status = statusLine(state);
  const canDecide = !state.busy && Boolean(state.staged);

  return (
    <div className={css.Root}>
      <div className={css.Topbar}>
        <Label hasLeftSpacing>
          {state.mode === 'update' ? 'Revising' : 'Building'} {state.legacyName}
        </Label>
        <div className={css.Status}>
          {state.busy && <ActivityIndicator />}
          {status.type && <Icon icon={IconName.WarningTriangle} variant={status.type} size={IconSize.Small} />}
          <Text textType={TextType.Secondary}>{status.text}</Text>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {state.busy && (
            <PrimaryButton label="Stop" variant={PrimaryButtonVariant.Ghost} onClick={() => session.cancel()} />
          )}
          {/*
            * BLD-003 — the same three decisions the thread's card offers, in the
            * same words, from the same module. This bar renders them because the
            * document is open, and `decisionOwner` is what tells the card to
            * stand down while it is; the two are one rule read from one fact,
            * not two components agreeing by luck.
            *
            * D3: Discard is `Ghost`, not `Danger`. Discarding is the absence of
            * an accept call — nothing has been written — and per phase 23 red
            * means danger.
            */}
          {canDecide && (
            <>
              <PrimaryButton label={REVIEW_LABEL} variant={PrimaryButtonVariant.Ghost} onClick={onOpenReview} />
              <PrimaryButton label={acceptLabel(state.mode)} onClick={onAccept} />
              <PrimaryButton label={DISCARD_LABEL} variant={PrimaryButtonVariant.Ghost} onClick={onDiscard} />
            </>
          )}
          <PrimaryButton label="Close" variant={PrimaryButtonVariant.MutedOnLowBg} onClick={exit} />
        </div>
      </div>

      <AuthoringCandidatePane session={session} state={state} />
    </div>
  );
}

export class AuthoringPreviewDocumentProvider implements IDocumentProvider {
  public static ID = 'AuthoringPreviewDocumentProvider';

  getComponent() {
    return AuthoringPreviewDocument;
  }
}
