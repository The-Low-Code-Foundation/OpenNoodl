/**
 * BLD-014 — `Render…`, the CDP producer's door.
 *
 * The task names **two producers behind one control**: *"what's on screen"* and
 * *"render it properly"*. `Look at it` beside this is the first — one click, no
 * options, because the question it answers has no parameters. This is the
 * second, and it has two that cannot be guessed: **which page**, and **at what
 * size**.
 *
 * ⚠️ It is a second button rather than a dropdown on the first, and that is a
 * measurement. A split control would put "render at 390×844, eight seconds,
 * possibly a third-party page" one accidental click away from "grab the pane,
 * instantly, free" — two operations with different costs and different
 * disclosures behind one affordance. The row already wraps (`.ComposerControls`
 * is `flex-wrap: wrap` since BLD-013's overflow), so a fourth control costs
 * layout nothing.
 *
 * @module AiAuthoringPanel/thread/RenderCaptureControl
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { IconName } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextInput } from '@noodl-core-ui/components/inputs/TextInput';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { egressNotice } from '../../../../models/AiAssistant/authoring/captureReferences';
import { appViewerUrl, isExternalUrl, parseViewports } from '../../../SandboxSurface/renderCaptureModel';

import css from './RenderCaptureControl.module.scss';

export interface RenderCaptureControlProps {
  /**
   * Run one render. Resolves when the pictures are on the chip row, or rejects
   * with something worth showing — the control owns the spinner, not the work.
   */
  onRender: (url: string, viewportSpec: string) => Promise<void>;
  isDisabled?: boolean;
}

/** What the viewport field offers before anyone types in it. */
const DEFAULT_VIEWPORT_SPEC = 'desktop,phone';

export function RenderCaptureControl({ onRender, isDisabled }: RenderCaptureControlProps) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<'app' | 'url'>('app');
  const [url, setUrl] = useState('');
  const [viewportSpec, setViewportSpec] = useState(DEFAULT_VIEWPORT_SPEC);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Both, not either — the same rule `ReferencePicker` documents: a popup that
  // closes only on Escape traps the mouse, one that closes only on an outside
  // click traps the keyboard.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const effectiveUrl = target === 'app' ? appViewerUrl() : url.trim();
  const external = target === 'url' && effectiveUrl.length > 0 && isExternalUrl(effectiveUrl);
  const parsed = useMemo(() => parseViewports(viewportSpec), [viewportSpec]);
  const viewportError = 'error' in parsed ? parsed.error : null;

  const canRender = !busy && effectiveUrl.length > 0 && !viewportError;

  const run = useCallback(async () => {
    if (!canRender) return;
    setBusy(true);
    setError(null);
    try {
      await onRender(effectiveUrl, viewportSpec);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [canRender, effectiveUrl, onRender, viewportSpec]);

  return (
    <div className={css['Control']} ref={rootRef} data-test="render-capture">
      {/* `MutedOnLowBg` for the third time in this row, for the reason
          `ReferencePicker` records: `Ghost`'s accent label measures 4.33:1 in
          light on this ground, and a per-call-site override would be a fourth
          copy of one token defect. */}
      <PrimaryButton
        label="Render…"
        icon={IconName.DeviceDesktop}
        variant={PrimaryButtonVariant.MutedOnLowBg}
        size={PrimaryButtonSize.Small}
        isDisabled={isDisabled}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        testId="render-capture-toggle"
      />

      {open && (
        <div className={css['Panel']} data-test="render-capture-panel">
          <div className={css['Row']}>
            <button
              type="button"
              className={`${css['Choice']} ${target === 'app' ? css['is-chosen'] : ''}`}
              onClick={() => setTarget('app')}
              data-test="render-capture-target-app"
            >
              Your app
            </button>
            <button
              type="button"
              className={`${css['Choice']} ${target === 'url' ? css['is-chosen'] : ''}`}
              onClick={() => setTarget('url')}
              data-test="render-capture-target-url"
            >
              A URL
            </button>
          </div>

          {target === 'url' && (
            <div className={css['Field']} data-test="render-capture-url-field">
              <TextInput
                value={url}
                placeholder="https://example.com"
                onChange={(event) => setUrl(event.target.value)}
              />
            </div>
          )}

          <div className={css['Field']}>
            <Text textType={TextType.Shy} className={css['Label']}>
              Viewports
            </Text>
            <TextInput
              value={viewportSpec}
              placeholder={DEFAULT_VIEWPORT_SPEC}
              onChange={(event) => setViewportSpec(event.target.value)}
            />
          </div>

          {/*
           * 🔴 Build item 7 — said **before** the first capture, not in a
           * settings footnote, and only when it is true. An egress warning that
           * appeared for the user's own localhost app would be the warning
           * nobody reads by the time it matters.
           */}
          {external && (
            <div className={css['Egress']} data-test="render-capture-egress">
              <Text textType={TextType.Default}>{egressNotice(effectiveUrl)}</Text>
            </div>
          )}

          {viewportError && (
            <div className={css['Error']} data-test="render-capture-viewport-error">
              <Text textType={TextType.Default}>{viewportError}</Text>
            </div>
          )}

          {error && (
            <div className={css['Error']} data-test="render-capture-error">
              <Text textType={TextType.Default}>{error}</Text>
            </div>
          )}

          <div className={css['Actions']}>
            <PrimaryButton
              label={busy ? 'Rendering…' : 'Render'}
              variant={PrimaryButtonVariant.MutedOnLowBg}
              size={PrimaryButtonSize.Small}
              isDisabled={!canRender}
              onClick={() => void run()}
              testId="render-capture-run"
            />
          </div>
        </div>
      )}
    </div>
  );
}
