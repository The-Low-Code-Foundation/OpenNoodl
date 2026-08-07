/**
 * ScopingStep — AIX-012's conversation, as a launcher step.
 *
 * Deliberately presentational: it holds the draft in the input box and nothing
 * else. The conversation itself (the session, the model, the recorded scope)
 * lives in the editor package, because core-ui cannot import editor models and
 * because a chat transcript rendered from props is testable in the preview
 * harness while a chat transcript that owns an AI client is not.
 *
 * The one piece of product judgement encoded here is the standing line under
 * the composer: the user is told, before they invest anything, that they can
 * stop whenever they like and keep what they have. A conversation people are
 * afraid to leave becomes an interrogation, which is the named risk this step
 * is built against.
 */
import React, { useEffect, useRef, useState } from 'react';

import { Markdown } from '@noodl-core-ui/components/common/Markdown';

import css from './ScopingStep.module.scss';

export interface ScopingMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface ScopingStepProps {
  messages: readonly ScopingMessage[];
  /** A turn is in flight — the composer is disabled and the thinking row shows. */
  isBusy: boolean;
  /**
   * AIB-009 F7 — the reply as it arrives. Rendered in place of the thinking row
   * the moment there is a first word, so the wait is legible rather than blank.
   */
  streamingReply?: string;
  /** Short lines describing what has been agreed so far. Empty until something is. */
  outline: readonly string[];
  /** True once the assistant and the user have agreed the whole scope. */
  isAgreed: boolean;
  /** Set when the last turn failed. Shown in place of a reply, never swallowed. */
  error?: string;
  onSend: (text: string) => void;
}

const PLACEHOLDER_OPENING = 'Describe the app you want to build…';
const PLACEHOLDER_REPLY = 'Reply…';

export function ScopingStep({
  messages,
  isBusy,
  streamingReply,
  outline,
  isAgreed,
  error,
  onSend
}: ScopingStepProps) {
  const [draft, setDraft] = useState('');
  const feedRef = useRef<HTMLDivElement>(null);
  const streaming = isBusy ? streamingReply?.trim() ?? '' : '';

  // Keep the newest message in view. A transcript that silently grows off the
  // bottom reads as an unresponsive app — and a reply that streams in below the
  // fold is the same thing wearing a nicer hat, so the growing text is a
  // dependency here too.
  useEffect(() => {
    const feed = feedRef.current;
    if (feed) feed.scrollTop = feed.scrollHeight;
  }, [messages.length, isBusy, error, streaming.length]);

  const submit = () => {
    const text = draft.trim();
    if (!text || isBusy) return;
    setDraft('');
    onSend(text);
  };

  return (
    <div className={css['ScopingStep']}>
      <div className={css['Feed']} ref={feedRef} role="log" aria-live="polite">
        {messages.length === 0 && !isBusy && (
          <p className={css['Intro']}>
            Say what you want to build, in your own words. We&apos;ll talk the scope through, write it down,
            and end with a plan you can review — nothing gets built during this conversation.
          </p>
        )}

        {messages.map((message, index) =>
          // AIB-006: the assistant writes markdown — `## Pages`, `- **Login**` —
          // and this rendered it as a raw text node, so the first thing a new
          // user ever saw of the product was its own formatting syntax. The
          // editor's own AI chat has always rendered through `Markdown`; only
          // the launcher's wizard did not.
          //
          // A user's message stays plain text: someone who types an asterisk
          // means an asterisk, and re-interpreting what they wrote back at them
          // is a worse error than showing it verbatim.
          message.role === 'assistant' ? (
            <Markdown
              key={index}
              content={message.text}
              UNSAFE_className={`${css['Message']} ${css['Message--assistant']} ${css['Message--markdown']}`}
            />
          ) : (
            <div key={index} className={`${css['Message']} ${css['Message--user']}`}>
              {message.text}
            </div>
          )
        )}

        {/*
          AIB-009 F7: this was `Thinking…` for the whole turn, however long the
          turn was — the first AI interaction anyone has with the product, and
          the only one in the app with no feedback at all. The session already
          took stream callbacks and the launcher simply passed none.

          The row stays for the part of a turn that genuinely has nothing to
          show: a model that is still thinking, or one that is calling
          `record_scope` before it answers, has produced no prose to render.
        */}
        {isBusy &&
          (streaming ? (
            <Markdown
              content={streaming}
              UNSAFE_className={`${css['Message']} ${css['Message--assistant']} ${css['Message--markdown']}`}
            />
          ) : (
            <div className={`${css['Message']} ${css['Message--pending']}`}>Thinking…</div>
          ))}

        {error && <div className={css['Error']}>{error}</div>}
      </div>

      {outline.length > 0 && (
        <div className={css['Outline']}>
          <span className={css['Outline-title']}>{isAgreed ? 'Agreed scope' : 'So far'}</span>
          <ul className={css['Outline-list']}>
            {outline.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      <div className={css['Composer']}>
        <textarea
          className={css['Composer-input']}
          value={draft}
          rows={3}
          disabled={isBusy}
          placeholder={messages.length === 0 ? PLACEHOLDER_OPENING : PLACEHOLDER_REPLY}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter breaks the line — the convention every
            // chat surface in this editor already uses.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button className={css['Composer-send']} type="button" onClick={submit} disabled={isBusy || !draft.trim()}>
          Send
        </button>
      </div>

      <p className={css['Exit']}>
        You can stop whenever you like — <strong>Continue</strong> takes what has been agreed so far to a final
        review, then creates the project and writes it down. If you leave before agreeing on any pages, your notes
        are still saved, but there will be no build plan waiting for you.
      </p>
    </div>
  );
}
