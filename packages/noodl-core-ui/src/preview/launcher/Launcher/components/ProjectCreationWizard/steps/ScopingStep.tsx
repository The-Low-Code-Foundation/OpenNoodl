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

import css from './ScopingStep.module.scss';

export interface ScopingMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface ScopingStepProps {
  messages: readonly ScopingMessage[];
  /** A turn is in flight — the composer is disabled and the thinking row shows. */
  isBusy: boolean;
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

export function ScopingStep({ messages, isBusy, outline, isAgreed, error, onSend }: ScopingStepProps) {
  const [draft, setDraft] = useState('');
  const feedRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view. A transcript that silently grows off the
  // bottom reads as an unresponsive app.
  useEffect(() => {
    const feed = feedRef.current;
    if (feed) feed.scrollTop = feed.scrollHeight;
  }, [messages.length, isBusy, error]);

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

        {messages.map((message, index) => (
          <div
            key={index}
            className={`${css['Message']} ${
              message.role === 'user' ? css['Message--user'] : css['Message--assistant']
            }`}
          >
            {message.text}
          </div>
        ))}

        {isBusy && <div className={`${css['Message']} ${css['Message--pending']}`}>Thinking…</div>}

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
        You can stop whenever you like — <strong>Continue</strong> creates the project with whatever has been
        agreed so far, and writes it down. Nothing is built until you choose to start the plan.
      </p>
    </div>
  );
}
