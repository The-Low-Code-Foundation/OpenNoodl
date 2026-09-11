import classNames from 'classnames';
import React, {
  ChangeEventHandler,
  FocusEventHandler,
  MouseEventHandler,
  useCallback,
  useLayoutEffect,
  useRef
} from 'react';

import { InputNotification } from '@noodl-types/globalInputTypes';

import { Text } from '@noodl-core-ui/components//typography/Text';
import { InputLabelSection } from '@noodl-core-ui/components/inputs/InputLabelSection';
import { NotificationFeedbackDisplay } from '@noodl-core-ui/components/inputs/NotificationFeedbackDisplay';
import { useNotificationFeedbackDisplay } from '@noodl-core-ui/components/inputs/NotificationFeedbackDisplay/NotificationFeedbackDisplay.hooks';
import { UnsafeStyleProps } from '@noodl-core-ui/types/global';

import { autoGrowHeight } from './TextArea.autogrow';
import { shouldSubmitOnKey } from './TextArea.keys';
import css from './TextArea.module.scss';

export interface TextAreaProps extends UnsafeStyleProps {
  value?: string;
  placeholder?: string;
  label?: string;

  minLength?: number;
  maxLength?: number;

  notification?: InputNotification;

  isDisabled?: boolean;
  hasBottomSpacing?: boolean;
  isResizeDisabled?: boolean;
  isAutoFocus?: boolean;

  onChange?: ChangeEventHandler<HTMLTextAreaElement>;
  onMouseEnter?: MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: MouseEventHandler<HTMLDivElement>;
  onFocus?: FocusEventHandler<HTMLTextAreaElement>;
  onBlur?: FocusEventHandler<HTMLTextAreaElement>;
  /**
   * Occurs when plain Enter is pressed; Shift+Enter inserts a newline.
   *
   * ⚠️ FIX-002 (ruled 2026-08-14): this is the industry default and a **flip**
   * of this prop's historical meaning — it used to fire on Shift+Enter, the
   * same prop name as `TextInput.onEnter` behind the opposite keystroke. Both
   * inputs now answer to plain Enter. The decision itself lives in
   * {@link shouldSubmitOnKey} so a node-env spec can grade it.
   */
  onEnter?: () => void;
  /**
   * BLD-016 — every keystroke, before {@link onEnter} decides anything.
   *
   * A completion menu over a text area needs Arrow/Enter/Escape *and* needs to
   * stop the text area acting on them, and it needs the caret at the moment the
   * key lands. Called first, and a handler that calls `preventDefault()` also
   * suppresses `onEnter` — otherwise a menu selection would submit the composer
   * on the same keystroke that picked a row.
   */
  onKeyDown?: (ev: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /**
   * BLD-016 — the element, for the two things no prop can express: reading
   * `selectionStart`, and putting the caret after an inserted token.
   */
  inputRef?: React.Ref<HTMLTextAreaElement>;
  /** Caret moved — by a click, an arrow key, or a selection. */
  onSelect?: React.ReactEventHandler<HTMLTextAreaElement>;
  /**
   * FIX-002 criterion 2 — grow with the content up to this many rows, then scroll.
   *
   * ✅ RULED 2026-08-15. **Opt-in on purpose.** `TextArea` is a `noodl-core-ui` component with
   * consumers well beyond the two AI composers, and the Build composer's send-key behaviour has
   * *driven* acceptance recorded against it (BLD-010) — a default-on grow would re-open that and
   * silently resize every other consumer besides. A consumer that does not pass this keeps
   * today's fixed `min-height` and manual resize exactly.
   *
   * ⚠️ A manual drag of the resize corner wins permanently from that point on: see
   * {@link autoGrowHeight} for the sizing rule and the `userHasResized` guard below for why the
   * two cannot both own the height.
   */
  autoGrowMaxRows?: number;
}

export function TextArea({
  value,
  placeholder,
  label,

  minLength,
  maxLength,

  notification,

  isDisabled,
  hasBottomSpacing,
  isResizeDisabled,
  isAutoFocus,

  onChange,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  onEnter,
  onKeyDown,
  inputRef,
  onSelect,
  autoGrowMaxRows,

  UNSAFE_className,
  UNSAFE_style
}: TextAreaProps) {
  const [newNotification, _updateNotification] = useNotificationFeedbackDisplay(notification);

  const isEmpty = !(typeof value === 'string' && value.length > 0);

  // FIX-002 — the element, for measuring. `inputRef` is a caller's ref (BLD-016 reads
  // `selectionStart` through it), so it is forwarded rather than replaced.
  const elementRef = useRef<HTMLTextAreaElement | null>(null);
  const lastAutoHeight = useRef<string | null>(null);
  const userHasResized = useRef(false);

  const setRefs = useCallback(
    (node: HTMLTextAreaElement | null) => {
      elementRef.current = node;
      if (typeof inputRef === 'function') inputRef(node);
      else if (inputRef) (inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
    },
    [inputRef]
  );

  // `useLayoutEffect`, not `useEffect`: the height is applied in the same frame as the new text,
  // so the composer never paints one line taller-or-shorter than its content.
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element || !autoGrowMaxRows || userHasResized.current) return;

    // Releasing the height first is what makes this *shrink* as well as grow — `scrollHeight`
    // never reports less than the height already set, so deleting a line would otherwise leave
    // the composer permanently at its high-water mark.
    element.style.height = 'auto';

    const styles = window.getComputedStyle(element);
    const px = (v: string) => parseFloat(v) || 0;
    const { height, overflowY } = autoGrowHeight({
      scrollHeight: element.scrollHeight,
      lineHeight: px(styles.lineHeight),
      verticalChrome:
        px(styles.paddingTop) + px(styles.paddingBottom) + px(styles.borderTopWidth) + px(styles.borderBottomWidth),
      maxRows: autoGrowMaxRows
    });

    element.style.height = `${height}px`;
    element.style.overflowY = overflowY;
    lastAutoHeight.current = element.style.height;
  }, [value, autoGrowMaxRows]);

  /**
   * ⚠️ Auto-grow and the resize corner both write `style.height`, so exactly one of them has to
   * own it. A drag that lands on a height we did not set is the user overriding the automatic
   * one, and from then on it stays overridden — the alternative is the composer snapping back to
   * its computed height on the very next keystroke, which reads as the drag having been ignored.
   */
  const onTextAreaMouseUp = () => {
    const element = elementRef.current;
    if (!element || !autoGrowMaxRows || userHasResized.current) return;
    if (lastAutoHeight.current !== null && element.style.height !== lastAutoHeight.current) {
      userHasResized.current = true;
      element.style.overflowY = '';
    }
  };

  return (
    <div className={classNames(css['Root'], hasBottomSpacing && css['has-bottom-spacing'])}>
      {label && <InputLabelSection label={label} />}

      <div
        className={classNames(
          css['InputArea'],
          isDisabled && css['is-disabled'],
          newNotification?.message && css['has-message']
        )}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <textarea
          className={classNames(
            css['Input'],
            isResizeDisabled && css['is-resize-disabled'],
            onChange && isEmpty && css['is-empty'],
            UNSAFE_className
          )}
          style={UNSAFE_style}
          minLength={minLength}
          maxLength={maxLength}
          disabled={isDisabled}
          placeholder={placeholder}
          ref={setRefs}
          onMouseUp={onTextAreaMouseUp}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          onSelect={onSelect}
          onKeyDown={(ev) => {
            onKeyDown?.(ev);
            // ⚠️ `defaultPrevented` is read inside `shouldSubmitOnKey`, not a
            // separate flag: a completion menu that consumed Enter to pick a
            // row must not also submit the composer, and the DOM already has
            // the word for "this key is spoken for".
            if (shouldSubmitOnKey(ev, Boolean(onEnter))) {
              onEnter();
              ev.preventDefault();
            }
          }}
          value={value}
          autoFocus={isAutoFocus}
        />

        {newNotification && <NotificationFeedbackDisplay notification={newNotification} />}
      </div>

      {newNotification?.message && (
        <Text className={css['NotificationMessage']} textType={newNotification.type}>
          {newNotification.message}
        </Text>
      )}
    </div>
  );
}
