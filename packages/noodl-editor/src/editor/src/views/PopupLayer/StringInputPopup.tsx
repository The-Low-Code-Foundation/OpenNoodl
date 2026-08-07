import React, { useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, Root } from 'react-dom/client';

/** The placeholder the comment editor has always shown. */
const COMMENT_PLACEHOLDER = '// Add your comment here...';

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
  /**
   * F26. Render the eight-row code editor — line-number gutter, monospace,
   * fixed 200px box — instead of a single-line field.
   *
   * **Defaults to false**, because this component is a *name prompt* at every
   * call site but one. It was a faithful port of a legacy node-comment template
   * and the treatment came with it, so "New component name" — the first thing a
   * user meets when creating a cloud function — was an eight-line code box with
   * a `// Add your comment here...` placeholder.
   *
   * The one true multiline caller is `NodeGraphEditorNode.showCommentEditPopup`.
   * A caller that wants the gutter must now ask for it.
   */
  multiline?: boolean;
  /**
   * What the empty field suggests. Each name prompt is asking for a different
   * kind of name, so the hint belongs to the caller rather than the component —
   * one shared placeholder is how the comment hint reached the name prompts in
   * the first place. Multiline defaults to the comment hint.
   */
  placeholder?: string;
  onOk: (value: string) => void;
  onCancel?: () => void;
}

interface StringInputPopupViewProps extends Pick<StringInputPopupOptions, 'label' | 'okLabel' | 'cancelLabel'> {
  value: string;
  multiline: boolean;
  placeholder: string;
  inputRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement>;
  onValueChanged: (value: string) => void;
  onOk: () => void;
  onCancel: () => void;
}

/** Ok/Cancel, shared by both variants. */
function Buttons({ okLabel, cancelLabel, onOk, onCancel }: Pick<StringInputPopupViewProps, 'okLabel' | 'cancelLabel' | 'onOk' | 'onCancel'>) {
  return (
    <div className="string-input-popup-buttons">
      {/* Legacy bindView blurred every button on focus; kept for visual parity. */}
      <button className="string-input-popup-button-ok" onFocus={(e) => e.currentTarget.blur()} onClick={onOk}>
        {okLabel}
      </button>
      <button className="string-input-popup-button-cancel" onFocus={(e) => e.currentTarget.blur()} onClick={onCancel}>
        {cancelLabel}
      </button>
    </div>
  );
}

/** The single-line name prompt — the default, and what four of the five callers want. */
function SingleLineView({
  label,
  okLabel,
  cancelLabel,
  value,
  placeholder,
  inputRef,
  onValueChanged,
  onOk,
  onCancel
}: StringInputPopupViewProps) {
  const [text, setText] = useState(value || '');

  return (
    <div className="string-input-popup string-input-popup--single">
      <label className="string-input-popup-label">{label}</label>
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        className="string-input-popup-input string-input-popup-singleline sidebar-input"
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onValueChanged(e.target.value);
        }}
        // A one-line prompt that cannot be answered with the key already under
        // the user's hand is the other half of this defect.
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onOk();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      <Buttons okLabel={okLabel} cancelLabel={cancelLabel} onOk={onOk} onCancel={onCancel} />
    </div>
  );
}

/** Line numbers gutter + textarea + Ok/Cancel, matching the legacy template. */
function MultilineView({
  label,
  okLabel,
  cancelLabel,
  value,
  placeholder,
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
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          className="string-input-popup-input string-input-popup-textarea sidebar-input"
          rows={8}
          placeholder={placeholder}
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
      <Buttons okLabel={okLabel} cancelLabel={cancelLabel} onOk={onOk} onCancel={onCancel} />
    </div>
  );
}

function StringInputPopupView(props: StringInputPopupViewProps) {
  return props.multiline ? <MultilineView {...props} /> : <SingleLineView {...props} />;
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
  private readonly inputRef = React.createRef<HTMLTextAreaElement | HTMLInputElement>();
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
          multiline: this.options.multiline === true,
          placeholder:
            this.options.placeholder !== undefined
              ? this.options.placeholder
              : this.options.multiline === true
                ? COMMENT_PLACEHOLDER
                : '',
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
