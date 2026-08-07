import classNames from 'classnames';
import React from 'react';

import { ActivityIndicator, ActivityIndicatorColor } from '@noodl-core-ui/components/common/ActivityIndicator';

import css from './ToastCard.module.scss';

export enum ToastType {
  Neutral = 'is-neutral',
  Info = 'is-info',
  Success = 'is-success',
  Warning = 'is-warning',
  Danger = 'is-danger',
  Pending = 'is-pending'
}

export interface ToastAction {
  label: string;
  onClick: () => void;
  /** Renders as a muted/secondary action instead of the accent primary. */
  quiet?: boolean;
}

export interface ToastProps {
  /** Bold heading. Falls back to `message` when omitted. */
  title?: string;
  /** Body text. Supports React nodes so callers can pass <code> spans. */
  message?: React.ReactNode;
  type?: ToastType;
  progress?: number;
  hasActivity?: boolean;
  actions?: ToastAction[];
  onClose?: () => void;
}

function SeverityIcon({ type }: { type: ToastType }) {
  // Danger + warning share the alert triangle; success = check; info/neutral = info.
  if (type === ToastType.Success) {
    return (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 8.5 6.5 12 13 4.5" />
      </svg>
    );
  }
  if (type === ToastType.Danger || type === ToastType.Warning) {
    return (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1.6 15 14H1L8 1.6Zm0 4.1c-.5 0-.8.3-.8.8l.2 3h1.2l.2-3c0-.5-.3-.8-.8-.8Zm0 6.6a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Z" />
      </svg>
    );
  }
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0 2.6a.95.95 0 1 1 0 1.9.95.95 0 0 1 0-1.9Zm1 7.9H7v-4h2v4Z" />
    </svg>
  );
}

export function ToastCard({
  title,
  message,
  type = ToastType.Neutral,
  progress,
  hasActivity,
  actions,
  onClose
}: ToastProps) {
  const heading = title ?? (typeof message === 'string' ? message : undefined);
  const body = title ? message : typeof message === 'string' ? undefined : message;

  return (
    <div className={classNames(css['Root'], css[type])} role={type === ToastType.Danger ? 'alert' : 'status'}>
      {type !== ToastType.Pending && (
        <div className={css['IconChip']}>
          <SeverityIcon type={type} />
        </div>
      )}

      {hasActivity && (
        <div className={css['IconChip']}>
          <ActivityIndicator color={ActivityIndicatorColor.Dark} />
        </div>
      )}

      <div className={css['Body']}>
        {heading && <div className={css['Title']}>{heading}</div>}
        {body && <div className={css['Message']}>{body}</div>}

        {actions && actions.length > 0 && (
          <div className={css['Actions']}>
            {actions.map((action, i) => (
              <button
                key={i}
                type="button"
                className={classNames(css['ActionButton'], action.quiet && css['is-quiet'])}
                onClick={action.onClick}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {typeof progress !== 'undefined' && <div className={css['ProgressBar']} style={{ width: `${progress}%` }} />}

      {onClose && (
        <button type="button" className={css['Close']} aria-label="Dismiss" onClick={onClose}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <path d="m4 4 8 8M12 4l-8 8" />
          </svg>
        </button>
      )}
    </div>
  );
}
