import React, { useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, Root } from 'react-dom/client';

export interface StringInputPopupOptions {
  label: string;
  okLabel: string;
  cancelLabel: string;
  /** Initial content of the input. */
  value?: string;
  /**
   * Legacy behaviour: the input holds a comma separated list, so the value is
   * split on commas and each entry trimmed before it is handed to `onOk`.
   * Defaults to true (every original call site is a port/name list).
   */
  splitCommaSeparated?: boolean;
  onOk: (value: string) => void;
  onCancel?: () => void;
}

interface StringInputPopupViewProps extends Pick<StringInputPopupOptions, 'label' | 'okLabel' | 'cancelLabel'> {
  value: string;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  onValueChanged: (value: string) => void;
  onOk: () => void;
  onCancel: () => void;
}

/** Line numbers gutter + textarea + Ok/Cancel, matching the legacy template. */
function StringInputPopupView({
  label,
  okLabel,
  cancelLabel,
  value,
  inputRef,
  onValueChanged,
  onOk,
  onCancel
}: StringInputPopupViewProps) {
  const [text, setText] = useState(value || '');
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Always show at least 8 lines (matching the legacy rows="8")
  const lineNumbers = useMemo(() => {
    const lines = text ? text.split('\n').length : 1;
    let out = '';
    for (let i = 1; i <= Math.max(8, lines); i++) out += i + '\n';
    return out;
  }, [text]);

  return (
    <div className="string-input-popup">
      <label className="string-input-popup-label">{label}</label>
      <div className="string-input-popup-editor-wrapper">
        <div className="string-input-popup-line-numbers" aria-hidden="true" ref={lineNumbersRef}>
          {lineNumbers}
        </div>
        <textarea
          ref={inputRef}
          className="string-input-popup-input string-input-popup-textarea sidebar-input"
          rows={8}
          placeholder="// Add your comment here..."
          spellCheck={false}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onValueChanged(e.target.value);
          }}
          onScroll={(e) => {
            if (lineNumbersRef.current) {
              lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
            }
          }}
        />
      </div>
      <div className="string-input-popup-buttons">
        {/* Legacy bindView blurred every button on focus; kept for visual parity. */}
        <button className="string-input-popup-button-ok" onFocus={(e) => e.currentTarget.blur()} onClick={onOk}>
          {okLabel}
        </button>
        <button className="string-input-popup-button-cancel" onFocus={(e) => e.currentTarget.blur()} onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}

/**
 * A single-input popup hosted by PopupLayer. Kept as a class because call sites
 * do `new StringInputPopup(...)`, `render()`, then hand the instance to
 * `PopupLayer.showPopup({ content })` which assigns `owner` afterwards.
 */
export class StringInputPopup {
  public el: HTMLElement;
  /** Assigned by PopupLayer when the popup is shown. */
  public owner: TSFixme;

  private readonly options: StringInputPopupOptions;
  private readonly inputRef = React.createRef<HTMLTextAreaElement>();
  private root: Root | null = null;
  private value: string;

  constructor(options: StringInputPopupOptions) {
    this.options = options;
    this.value = options.value || '';
  }

  public render(): HTMLElement {
    if (!this.el) {
      this.el = document.createElement('div');
    }

    if (!this.root) {
      this.root = createRoot(this.el);
    }

    // Synchronous: the caller hands `el` straight to PopupLayer.showPopup, which
    // measures the content to size and position the popup.
    flushSync(() =>
      this.root.render(
        React.createElement(StringInputPopupView, {
          label: this.options.label,
          okLabel: this.options.okLabel,
          cancelLabel: this.options.cancelLabel,
          value: this.value,
          inputRef: this.inputRef,
          onValueChanged: (value: string) => (this.value = value),
          onOk: () => this.onOkClicked(),
          onCancel: () => this.onCancelClicked()
        })
      )
    );

    return this.el;
  }

  public onOkClicked() {
    const val =
      this.options.splitCommaSeparated === false
        ? this.value
        : this.value
            .split(',')
            .map((x) => x.trim())
            .join();

    this.owner && this.owner.hidePopup();

    this.options.onOk && this.options.onOk(val);
  }

  public onCancelClicked() {
    this.options.onCancel && this.options.onCancel();

    this.owner && this.owner.hidePopup();
  }

  /** Called by PopupLayer once the popup is attached to the document. */
  public onOpen() {
    this.inputRef.current && this.inputRef.current.focus();
  }

  public onClose() {
    const root = this.root;
    this.root = null;
    // Deferred: onClose runs inside the React event that triggered the close.
    root && setTimeout(() => root.unmount(), 0);
  }
}
