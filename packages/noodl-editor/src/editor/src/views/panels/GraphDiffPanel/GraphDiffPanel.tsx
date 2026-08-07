/**
 * SUB-007 step 3: the semantic diff review UI.
 *
 * Renders a `ComponentDiff` as sentences — "Connected Button.click →
 * Navigate.navigate", not a JSON delta — using catalog display names.
 * Position-only changes are folded away by default so a graph that was merely
 * tidied does not read as a graph that was edited.
 *
 * This component is the contract Phase 15's AI review (AIX-003) renders
 * through, so it takes plain `ComponentDiff` values and knows nothing about
 * git, the version-control panel, or where the two sides came from.
 */

import React, { useMemo, useState } from 'react';

import { FeedbackType } from '@noodl-constants/FeedbackType';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { Collapsible } from '@noodl-core-ui/components/layout/Collapsible';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Section, SectionVariant } from '@noodl-core-ui/components/sidebar/Section';
import { Label } from '@noodl-core-ui/components/typography/Label';
import { Text, TextSize, TextType } from '@noodl-core-ui/components/typography/Text';

import type { ComponentDiff } from '@noodl-versioning';

import css from './GraphDiffPanel.module.scss';
import {
  PresentedChange,
  TONE_FEEDBACK,
  TONE_ICON,
  countCosmetic,
  createDisplayNameProvider,
  presentChanges
} from './graphChangePresentation';

function ChangeRow({ change }: { change: PresentedChange }) {
  return (
    <div className={css.ChangeRow}>
      <span className={css.ChangeIcon}>
        <Icon icon={TONE_ICON[change.tone]} size={IconSize.Tiny} variant={TONE_FEEDBACK[change.tone]} />
      </span>
      <Text size={TextSize.Small} className={css.ChangeText}>
        {change.text}
      </Text>
    </div>
  );
}

export interface ComponentDiffViewProps {
  diff: ComponentDiff;
  /** Show canvas-position changes. Off by default; they are pure noise. */
  showCosmetic?: boolean;
}

/** The change list for a single component. */
export function ComponentDiffView({ diff, showCosmetic = false }: ComponentDiffViewProps) {
  const [includeCosmetic, setIncludeCosmetic] = useState(showCosmetic);
  const displayName = useMemo(() => createDisplayNameProvider(), []);

  const groups = useMemo(
    () => presentChanges(diff.changes, displayName, { includeCosmetic }),
    [diff, displayName, includeCosmetic]
  );
  const cosmeticCount = useMemo(() => countCosmetic(diff.changes), [diff]);

  if (groups.length === 0) {
    return (
      <Text size={TextSize.Small} textType={TextType.Shy}>
        {cosmeticCount > 0 ? 'Only canvas positions changed' : 'No changes'}
      </Text>
    );
  }

  return (
    <VStack UNSAFE_className={css.Root}>
      {groups.map(({ group, changes }) => (
        <Box key={group}>
          <Label variant={TextType.Shy} UNSAFE_className={css.GroupTitle}>
            {group}
          </Label>
          {changes.map((change) => (
            <ChangeRow key={change.key} change={change} />
          ))}
        </Box>
      ))}

      {cosmeticCount > 0 && (
        <div
          className={css.CosmeticToggle}
          onClick={() => setIncludeCosmetic(!includeCosmetic)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => event.key === 'Enter' && setIncludeCosmetic(!includeCosmetic)}
        >
          <Text size={TextSize.Small} textType={TextType.Shy}>
            {includeCosmetic
              ? `Hide ${cosmeticCount} position change${cosmeticCount === 1 ? '' : 's'}`
              : `Show ${cosmeticCount} position change${cosmeticCount === 1 ? '' : 's'}`}
          </Text>
        </div>
      )}
    </VStack>
  );
}

export interface GraphDiffPanelProps {
  /** Per-component semantic diffs, in the order they should be read. */
  diffs: ComponentDiff[];
  addedComponents?: string[];
  removedComponents?: string[];
  /** Component names to render expanded on first paint. */
  initiallyExpanded?: string[];
  emptyMessage?: string;
}

/**
 * The whole-project view: one collapsible section per changed component,
 * plus the components that were added or removed outright.
 */
export function GraphDiffPanel({
  diffs,
  addedComponents = [],
  removedComponents = [],
  initiallyExpanded = [],
  emptyMessage = 'No graph changes'
}: GraphDiffPanelProps) {
  const [expanded, setExpanded] = useState<string[]>(initiallyExpanded);

  const toggle = (name: string) =>
    setExpanded((current) => (current.includes(name) ? current.filter((n) => n !== name) : [...current, name]));

  const isEmpty = diffs.length === 0 && addedComponents.length === 0 && removedComponents.length === 0;
  if (isEmpty) {
    return (
      <Section hasGutter variant={SectionVariant.PanelShy}>
        <Text size={TextSize.Small} textType={TextType.Shy}>
          {emptyMessage}
        </Text>
      </Section>
    );
  }

  return (
    <VStack UNSAFE_className={css.Root}>
      {addedComponents.length > 0 && (
        <Section title="Added components" variant={SectionVariant.PanelShy} hasGutter hasBottomSpacing>
          {addedComponents.map((name) => (
            <div key={name} className={css.ChangeRow}>
              <span className={css.ChangeIcon}>
                <Icon icon={TONE_ICON.added} size={IconSize.Tiny} variant={FeedbackType.Success} />
              </span>
              <Text size={TextSize.Small}>{name}</Text>
            </div>
          ))}
        </Section>
      )}

      {removedComponents.length > 0 && (
        <Section title="Removed components" variant={SectionVariant.PanelShy} hasGutter hasBottomSpacing>
          {removedComponents.map((name) => (
            <div key={name} className={css.ChangeRow}>
              <span className={css.ChangeIcon}>
                <Icon icon={TONE_ICON.removed} size={IconSize.Tiny} variant={FeedbackType.Danger} />
              </span>
              <Text size={TextSize.Small}>{name}</Text>
            </div>
          ))}
        </Section>
      )}

      {diffs.map((diff) => {
        const isExpanded = expanded.includes(diff.component);
        const semanticCount = diff.changes.filter((change) => change.category !== 'cosmetic').length;

        return (
          <Section key={diff.component} variant={SectionVariant.PanelShy} hasGutter hasBottomSpacing hasVisibleOverflow>
            <div
              className={css.ComponentHeader}
              onClick={() => toggle(diff.component)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => event.key === 'Enter' && toggle(diff.component)}
            >
              <HStack>
                <Icon icon={isExpanded ? IconName.CaretDown : IconName.CaretRight} size={IconSize.Tiny} />
                <Box hasLeftSpacing>
                  <Label>{diff.component}</Label>
                </Box>
              </HStack>
              <Text size={TextSize.Small} textType={TextType.Shy} className={css.ChangeCount}>
                {semanticCount > 0 ? `${semanticCount} change${semanticCount === 1 ? '' : 's'}` : 'position only'}
              </Text>
            </div>

            <Collapsible isCollapsed={!isExpanded}>
              <ComponentDiffView diff={diff} />
            </Collapsible>
          </Section>
        );
      })}
    </VStack>
  );
}
