import React from 'react';

export interface ConfirmModalProps {
  title?: string;
  /** Rendered as HTML, matching the legacy `data-html` binding. */
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title = 'Confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  return (
    <div className="popup confirm-modal">
      <label>{title}</label>

      <p dangerouslySetInnerHTML={{ __html: message }} />

      <div className="confirm-buttons">
        <button
          className="confirm-button"
          data-test="confirm-button"
          onFocus={(e) => e.currentTarget.blur()}
          onClick={(e) => {
            onConfirm();
            e.stopPropagation();
          }}
        >
          {confirmLabel}
        </button>
        <button
          className="cancel-button"
          onFocus={(e) => e.currentTarget.blur()}
          onClick={(e) => {
            onCancel();
            e.stopPropagation();
          }}
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}

export interface ErrorModalProps {
  title?: string;
  /** Rendered as HTML, matching the legacy `data-html` binding. */
  message: string;
  onOk: () => void;
}

export function ErrorModal({ title = 'Error', message, onOk }: ErrorModalProps) {
  return (
    <div className="popup confirm-modal">
      <label>{title}</label>

      <p dangerouslySetInnerHTML={{ __html: message }} />

      <div className="confirm-buttons">
        <button
          className="cancel-button"
          onFocus={(e) => e.currentTarget.blur()}
          onClick={(e) => {
            onOk();
            e.stopPropagation();
          }}
        >
          OK
        </button>
      </div>
    </div>
  );
}
