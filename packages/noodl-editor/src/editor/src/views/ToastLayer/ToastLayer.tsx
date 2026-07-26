import React from 'react';
import toast from 'react-hot-toast';

import { ToastAction, ToastCard, ToastType } from './components/ToastCard';

export interface ToastOptions {
  /** Bold heading; when set, `message` renders as the body beneath it. */
  title?: string;
  /** Action buttons (e.g. "Show details"). A quiet "Dismiss" is always added. */
  actions?: ToastAction[];
  /** Override auto-dismiss. Errors default to sticky (Infinity). */
  duration?: number;
  id?: string;
}

// Success/info notifications auto-dismiss; errors stay until dismissed.
const AUTO_DISMISS = 6000;

function normalize(durationOrOptions?: number | ToastOptions): ToastOptions {
  if (typeof durationOrOptions === 'number') return { duration: durationOrOptions };
  return durationOrOptions ?? {};
}

export const ToastLayer = {
  showInteraction(message: string) {
    toast.success((t) => (
      <ToastCard type={ToastType.Neutral} message={message} onClose={() => toast.dismiss(t.id)} />
    ));
  },

  showActivity(message: string, toastId = 'no-id') {
    toast.promise(
      new Promise(() => {
        // noop
      }),
      {
        loading: <ToastCard type={ToastType.Pending} message={message} hasActivity />,
        success: '',
        error: ''
      },
      { id: toastId, duration: 1000000 }
    );
  },

  hideActivity(toastId = 'no-id') {
    toast.dismiss(toastId);
  },

  hideAll() {
    toast.dismiss();
  },

  showSuccess(message: string, options?: ToastOptions) {
    const opts = normalize(options);
    toast.success(
      (t) => (
        <ToastCard
          type={ToastType.Success}
          title={opts.title}
          message={message}
          actions={withDismiss(opts.actions, t.id)}
          onClose={() => toast.dismiss(t.id)}
        />
      ),
      { duration: opts.duration ?? AUTO_DISMISS, id: opts.id }
    );
  },

  showInfo(message: string, options?: ToastOptions) {
    const opts = normalize(options);
    toast(
      (t) => (
        <ToastCard
          type={ToastType.Info}
          title={opts.title}
          message={message}
          actions={withDismiss(opts.actions, t.id)}
          onClose={() => toast.dismiss(t.id)}
        />
      ),
      { duration: opts.duration ?? AUTO_DISMISS, id: opts.id }
    );
  },

  showWarning(message: string, options?: ToastOptions) {
    const opts = normalize(options);
    toast(
      (t) => (
        <ToastCard
          type={ToastType.Warning}
          title={opts.title}
          message={message}
          actions={withDismiss(opts.actions, t.id)}
          onClose={() => toast.dismiss(t.id)}
        />
      ),
      { duration: opts.duration ?? AUTO_DISMISS, id: opts.id }
    );
  },

  /**
   * Error toast. Sticky by default (stays until the user dismisses) but always
   * dismissable via the close button — no more undismissable red slab.
   */
  showError(message: string, durationOrOptions?: number | ToastOptions) {
    const opts = normalize(durationOrOptions);
    toast.error(
      (t) => (
        <ToastCard
          type={ToastType.Danger}
          title={opts.title}
          message={message}
          actions={withDismiss(opts.actions, t.id)}
          onClose={() => toast.dismiss(t.id)}
        />
      ),
      { duration: opts.duration ?? Infinity, id: opts.id }
    );
  },

  showProgress(message: string, progress: number, toastId: string) {
    if (progress) {
      toast.loading(<ToastCard type={ToastType.Pending} message={message} progress={progress} hasActivity />, {
        id: toastId
      });
    }
  },

  hideProgress(toastId: string) {
    toast.dismiss(toastId);
  }
};

function withDismiss(actions: ToastAction[] | undefined, toastId: string): ToastAction[] | undefined {
  if (!actions || actions.length === 0) return undefined;
  return [...actions, { label: 'Dismiss', quiet: true, onClick: () => toast.dismiss(toastId) }];
}
