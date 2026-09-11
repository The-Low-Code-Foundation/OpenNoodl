/**
 * The sandbox toolbar — summary, caveat, data source, session.
 *
 * BEN-004 §7: "The bench gets both by using the same component. Do not build a
 * second toolbar." This is that component, lifted out of `SandboxPreview`
 * unchanged in behaviour so the AI authoring preview and the component bench
 * cannot drift into two dialects of the same four controls.
 *
 * @module noodl-editor/views/SandboxSurface/SandboxToolbar
 */

import React from 'react';

import { FeedbackType } from '@noodl-constants/FeedbackType';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import css from './SandboxToolbar.module.scss';

export interface SandboxToolbarProps {
  /** What is mounted and what it is running against. */
  summary?: string;
  /**
   * A caveat the preview must say out loud — a class whose field shape could
   * not be inferred renders as blank rows under a heading that claims results,
   * which is indistinguishable from a component that does not work.
   */
  notice?: string;
  useSampleData: boolean;
  onUseSampleDataChange: (next: boolean) => void;
  signedIn: boolean;
  onSignedInChange: (next: boolean) => void;
  /**
   * BEN-006's Data panel. Omit `onDataOpenChange` (or pass `hasDataset` false)
   * and no button is offered — there is nothing to edit until an export has
   * been built.
   */
  hasDataset?: boolean;
  dataOpen?: boolean;
  onDataOpenChange?: (next: boolean) => void;
  /** Rendered at the left end, before the play glyph. The bench puts nothing here. */
  slotBeforeSummary?: React.ReactNode;
}

export function SandboxToolbar({
  summary,
  notice,
  useSampleData,
  onUseSampleDataChange,
  signedIn,
  onSignedInChange,
  hasDataset,
  dataOpen,
  onDataOpenChange,
  slotBeforeSummary
}: SandboxToolbarProps) {
  return (
    <div className={css.Bar}>
      {slotBeforeSummary}
      <Icon icon={IconName.Play} size={IconSize.Small} />
      <div className={css.Summary}>
        <Text textType={TextType.Secondary}>{summary ?? 'Preview'}</Text>
      </div>

      {notice ? (
        <div className={css.Notice} title={notice}>
          <Icon icon={IconName.WarningTriangle} size={IconSize.Small} />
          <Text textType={FeedbackType.Notice}>Fields unknown</Text>
        </div>
      ) : null}

      {/*
        POL-008: one button, not a second pair. It is a toggle between two
        states of the same thing, and it only exists while the sandbox is
        serving sample data — "signed out" against a real backend is whatever
        the real backend says, and offering to change it there would be a claim
        this preview cannot honour.
      */}
      {useSampleData && (
        <PrimaryButton
          label={signedIn ? 'Sign out' : 'Sign in'}
          size={PrimaryButtonSize.Small}
          variant={PrimaryButtonVariant.MutedOnLowBg}
          onClick={() => onSignedInChange(!signedIn)}
          testId="sandbox-auth-toggle"
        />
      )}

      {/* BEN-006 — the same gating `Sign out` uses, and for the same reason. */}
      {useSampleData && hasDataset && onDataOpenChange && (
        <PrimaryButton
          label="Data"
          size={PrimaryButtonSize.Small}
          variant={dataOpen ? undefined : PrimaryButtonVariant.MutedOnLowBg}
          onClick={() => onDataOpenChange(!dataOpen)}
          testId="sandbox-data-toggle"
        />
      )}

      <div className={css.Modes}>
        <PrimaryButton
          label="Sample data"
          size={PrimaryButtonSize.Small}
          variant={useSampleData ? undefined : PrimaryButtonVariant.MutedOnLowBg}
          onClick={() => onUseSampleDataChange(true)}
          testId="sandbox-sample-data"
        />
        <PrimaryButton
          label="Real backend"
          size={PrimaryButtonSize.Small}
          variant={useSampleData ? PrimaryButtonVariant.MutedOnLowBg : undefined}
          onClick={() => onUseSampleDataChange(false)}
          testId="sandbox-real-backend"
        />
      </div>
    </div>
  );
}
