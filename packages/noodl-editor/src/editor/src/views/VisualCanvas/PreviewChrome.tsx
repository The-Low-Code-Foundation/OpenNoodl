/**
 * BEN-004 — The preview surface's own chrome: what am I looking at, and how big.
 *
 * Two controls, both in the strip that sits above the stage in **both** modes.
 * That is R1 and R4 in one decision: the thing that switches to the bench is
 * also the thing that switches back, it is the leftmost control in the strip,
 * and it never moves. A second "exit" affordance would be a second answer to
 * "how do I get out of this", which is how a user ends up not trusting either.
 *
 * ## Why the picker is not a `MenuDialog`
 *
 * It needs a search field, which `MenuDialog` has no room for, and it is opened
 * from a button rather than from a right-click. It is therefore an ordinary
 * absolutely-positioned panel inside the preview surface — no portal, no
 * `PopupLayer`. That is also the form a driver can actually assert on: a
 * portalled select opened by a synthesised `.click()` never closes, which has
 * cost this repo a live-QA session before.
 *
 * @module noodl-editor/views/VisualCanvas/PreviewChrome
 */

import classNames from 'classnames';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { revealBenchTarget } from './benchRequest';
import {
  APP_SCOPE,
  BENCH_FRAME_PRESETS,
  benchTargetLabel,
  benchTargets,
  clampBenchHeight,
  clampBenchWidth,
  isMounted,
  matchingPreset,
  type BenchFrame,
  type PreviewScope
} from './previewScope';
import css from './PreviewChrome.module.scss';

export interface PreviewScopeControlProps {
  scope: PreviewScope;
  onScopeChange: (scope: PreviewScope) => void;
  /**
   * The project's components, by legacy name. A getter rather than an array
   * because the surface re-renders on every throttled bounds change and this
   * list is only wanted when the menu opens — and it must be *fresh* then, not
   * a snapshot from whenever the preview last laid out.
   */
  getComponents: () => Array<{ name: string }>;
}

export function PreviewScopeControl({ scope, onScopeChange, getComponents }: PreviewScopeControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [components, setComponents] = useState<Array<{ name: string }>>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const targets = useMemo(() => benchTargets(components, query), [components, query]);

  function open() {
    setComponents(getComponents());
    setIsOpen(true);
  }

  useEffect(() => {
    if (!isOpen) return;
    searchRef.current?.focus();

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  function choose(next: PreviewScope) {
    setIsOpen(false);
    setQuery('');
    onScopeChange(next);
    // Picking a component here means the same thing as "Preview in isolation"
    // does in the components panel, so it does the same thing to the canvas:
    // the graph you can edit is the graph you are looking at. Switching *back*
    // to the app preview navigates nowhere — there is no one component to show,
    // and a canvas that jumped somewhere arbitrary would be worse than one that
    // stayed put.
    if (next.mode === 'bench') revealBenchTarget(next.target);
  }

  const isBench = scope.mode === 'bench';

  return (
    <div className={css.ScopeRoot} ref={rootRef}>
      <button
        type="button"
        className={classNames(css.ScopeChip, isBench && css['is-bench'])}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        data-test="preview-scope-chip"
      >
        <Icon icon={isBench ? IconName.Component : IconName.Home} size={IconSize.Small} />
        <span className={css.ScopeLabel}>{isBench ? benchTargetLabel(scope.target) : 'App'}</span>
        <Icon icon={IconName.CaretDown} size={IconSize.Small} />
      </button>

      {isOpen && (
        <div className={css.ScopeMenu} role="listbox" data-test="preview-scope-menu">
          <input
            ref={searchRef}
            className={css.ScopeSearch}
            placeholder="Find a component…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            data-test="preview-scope-search"
          />
          <div className={css.ScopeList}>
            <button
              type="button"
              role="option"
              aria-selected={scope.mode === 'app'}
              className={classNames(css.ScopeItem, scope.mode === 'app' && css['is-current'])}
              onClick={() => choose(APP_SCOPE)}
              data-test="preview-scope-app"
            >
              <Icon icon={IconName.Home} size={IconSize.Small} />
              <span className={css.ScopeItemLabel}>App preview</span>
              <span className={css.ScopeItemHint}>the whole project, as it ships</span>
            </button>

            {targets.length === 0 && (
              <div className={css.ScopeEmpty}>
                <Text textType={TextType.Secondary}>No component matches “{query}”.</Text>
              </div>
            )}

            {targets.map((target) => (
              <button
                key={target.name}
                type="button"
                role="option"
                aria-selected={isMounted(scope, target.name)}
                className={classNames(css.ScopeItem, isMounted(scope, target.name) && css['is-current'])}
                onClick={() => choose({ mode: 'bench', target: target.name })}
                data-test={`preview-scope-target-${target.name}`}
              >
                <Icon icon={IconName.Component} size={IconSize.Small} />
                <span className={css.ScopeItemLabel}>{target.label}</span>
                {target.folder ? <span className={css.ScopeItemHint}>{target.folder}</span> : null}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export interface BenchFrameControlProps {
  frame: BenchFrame;
  onFrameChange: (frame: BenchFrame) => void;
  /**
   * FIX-011 — write this size onto the component as the size it opens at.
   *
   * Absent when there is nothing to write it to (no project, no resolvable
   * component), and the button is then not rendered at all rather than
   * rendered inert: an affordance that is present and does nothing is the
   * defect SPR-005 found in "Make Home".
   */
  onSetDefaultSize?: () => void;
  /** Whether the component already stores a default size. Changes the wording only. */
  hasDefaultSize?: boolean;
}

/**
 * BEN-004 §5 / FIX-011 — the size the component is given.
 *
 * A component in isolation has no page to inherit width from, so the bench asks
 * rather than guesses: an accidental width is exactly how the retired feature
 * used to show a component that would not survive contact with a page.
 *
 * Both fields commit on blur or Enter, never per keystroke — typing `3` on the
 * way to `320` would otherwise clamp to the minimum under the cursor.
 *
 * ## The strip's width budget, settled once (FIX-011 §5 / FIX-019)
 *
 * BEN-004's drive measured this 30px strip clipping at 640px, and FIX-011 and
 * FIX-019 both wanted room in it. The settlement is that **the caption is the
 * only thing that shrinks** (`VisualCanvas.module.scss`): every control here is
 * `flex-shrink: 0`, so what a narrow panel costs you is the explanatory
 * sentence and never a control. FIX-011 spends ~74px on the height field and
 * this button; FIX-019's chip spends nothing in the common case, because it is
 * assertive and appears only on divergence.
 */
export function BenchFrameControl({ frame, onFrameChange, onSetDefaultSize, hasDefaultSize }: BenchFrameControlProps) {
  const [draft, setDraft] = useState(String(frame.width));
  /** Empty *is* a value here — "fill the stage". See `clampBenchHeight`. */
  const [heightDraft, setHeightDraft] = useState(frame.height === null ? '' : String(frame.height));
  const preset = matchingPreset(frame.width);

  useEffect(() => setDraft(String(frame.width)), [frame.width]);
  useEffect(() => setHeightDraft(frame.height === null ? '' : String(frame.height)), [frame.height]);

  function commit() {
    const width = clampBenchWidth(draft, frame.width);
    setDraft(String(width));
    if (width !== frame.width) onFrameChange({ ...frame, width });
  }

  function commitHeight() {
    const height = clampBenchHeight(heightDraft, frame.height);
    setHeightDraft(height === null ? '' : String(height));
    if (height !== frame.height) onFrameChange({ ...frame, height });
  }

  return (
    <div className={css.FrameRoot}>
      {BENCH_FRAME_PRESETS.map((option) => (
        <button
          key={option.name}
          type="button"
          className={classNames(css.FrameChip, !frame.stretch && preset === option.name && css['is-active'])}
          disabled={frame.stretch}
          title={`${option.name} — ${option.width}px`}
          onClick={() => onFrameChange({ ...frame, width: option.width })}
          data-test={`bench-frame-${option.name.toLowerCase()}`}
        >
          {option.name}
        </button>
      ))}

      <input
        className={css.FrameWidth}
        value={draft}
        disabled={frame.stretch}
        aria-label="Bench frame width in pixels"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
        }}
        data-test="bench-frame-width"
      />

      {/* Says which number is which without a pair of labels the strip cannot
          afford, and reads as the size read-out on the far right does. */}
      <span className={css.FrameTimes} aria-hidden="true">
        ×
      </span>

      {/*
        FIX-011 — the height that did not exist. Empty means "fill the stage",
        which is the default and the way back from a pinned height: the strip
        had no room for a second Stretch toggle, and clearing a field is a
        gesture people already have. The placeholder is what says so, so the
        control is not a piece of folklore.
      */}
      <input
        className={css.FrameHeight}
        value={heightDraft}
        placeholder="Fill"
        aria-label="Bench frame height in pixels, empty to fill the stage"
        title="Frame height in pixels. Leave empty to fill the stage."
        onChange={(event) => setHeightDraft(event.target.value)}
        onBlur={commitHeight}
        onKeyDown={(event) => {
          if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
        }}
        data-test="bench-frame-height"
      />

      {/*
        The commonest isolation lie is "it only looked right because a flex
        parent stretched it". This is the control that asks. ⚠️ What stretching
        does to a *rendered* component is unmeasured — register B3 — so the
        label says exactly what this end of it does and no more.
      */}
      <button
        type="button"
        className={classNames(css.FrameChip, frame.stretch && css['is-active'])}
        aria-pressed={frame.stretch}
        title="Give the component the whole stage instead of a fixed frame"
        onClick={() => onFrameChange({ ...frame, stretch: !frame.stretch })}
        data-test="bench-frame-stretch"
      >
        Stretch
      </button>

      {/*
        FIX-011 — the one gesture on this control that writes to `project.json`,
        and the reason a drag can be as sloppy as it likes.

        ⚠️ It is a *button*, not an autosave on the frame changing, and that is
        the ruling rather than a preference: a default size is authored intent,
        a drag is not, and `setMetaData` arms the project autosave on the first
        write. Icon-only because the strip is 30px and already measured short.
      */}
      {onSetDefaultSize && (
        <button
          type="button"
          className={css.FrameDefault}
          title={
            hasDefaultSize
              ? 'Update the size this component opens at on the bench'
              : 'Set as the size this component opens at on the bench'
          }
          aria-label="Set as default size"
          onClick={onSetDefaultSize}
          data-test="bench-frame-set-default"
        >
          {/* Filled once there is something stored, so the button also answers
              "does this component have a default size?" — which is otherwise
              invisible until you close the bench and open it again. */}
          <Icon icon={hasDefaultSize ? IconName.PinFill : IconName.Pin} size={IconSize.Small} />
        </button>
      )}
    </div>
  );
}
