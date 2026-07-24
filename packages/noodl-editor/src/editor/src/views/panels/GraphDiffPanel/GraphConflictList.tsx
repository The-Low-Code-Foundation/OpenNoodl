/**
 * SUB-007 step 5: conflict resolution in graph terms.
 *
 * Each conflict is one sentence plus the two candidate values side by side,
 * with an explicit choice. The point of the task is that resolving "we both
 * edited the Login page" never requires hand-editing JSON, so nothing here
 * exposes raw project structure — values are rendered through `describeSide`
 * and the sentence comes from the engine's own formatter.
 *
 * Presentational: it reports the chosen side and renders whatever conflicts it
 * is given. Applying the choice to a merge is the caller's job (see
 * `resolveProjectConflict` / `resolveAllProjectConflicts`).
 */

import React, { useMemo } from 'react';

import { FeedbackType } from '@noodl-constants/FeedbackType';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { VStack } from '@noodl-core-ui/components/layout/Stack';
import { Section, SectionVariant } from '@noodl-core-ui/components/sidebar/Section';
import { Label } from '@noodl-core-ui/components/typography/Label';
import { Text, TextSize, TextType } from '@noodl-core-ui/components/typography/Text';

import type { ConflictSide, GraphConflict } from '@noodl-versioning';

import css from './GraphConflictList.module.scss';
import { createDisplayNameProvider, describeSide, presentConflicts } from './graphChangePresentation';

/** A conflict carrying the component it came from, as ProjectMerge reports it. */
type ScopedConflict = GraphConflict & { component?: string };

export interface GraphConflictListProps {
  conflicts: ScopedConflict[];
  onResolve: (conflictId: string, side: ConflictSide) => void;
  /** Take one side for every unresolved conflict. */
  onResolveAll?: (side: ConflictSide) => void;
  /** Label for the local side. "You" reads better than "ours" in a sentence. */
  oursLabel?: string;
  theirsLabel?: string;
}

export function GraphConflictList({
  conflicts,
  onResolve,
  onResolveAll,
  oursLabel = 'Yours',
  theirsLabel = 'Theirs'
}: GraphConflictListProps) {
  const displayName = useMemo(() => createDisplayNameProvider(), []);
  const presented = useMemo(() => presentConflicts(conflicts, displayName), [conflicts, displayName]);

  const unresolved = conflicts.filter((conflict) => !conflict.resolution).length;

  if (conflicts.length === 0) {
    return (
      <Section hasGutter variant={SectionVariant.PanelShy}>
        <Text size={TextSize.Small} textType={TextType.Shy}>
          No conflicts — everything merged automatically
        </Text>
      </Section>
    );
  }

  // Conflicts group by component so the reader resolves one page at a time.
  const byComponent = new Map<string, typeof presented>();
  presented.forEach((entry) => {
    const key = (entry.conflict as ScopedConflict).component ?? 'Project';
    const list = byComponent.get(key) ?? [];
    list.push(entry);
    byComponent.set(key, list);
  });

  return (
    <VStack>
      <Section hasGutter variant={SectionVariant.PanelShy} hasBottomSpacing>
        <Text size={TextSize.Small} hasBottomSpacing>
          {unresolved === 0
            ? `All ${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'} resolved`
            : `${unresolved} of ${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'} still need a choice`}
        </Text>
        {Boolean(onResolveAll) && unresolved > 0 && (
          <div className={css.Actions}>
            <div className={css.Action}>
              <PrimaryButton
                label={`Take all ${oursLabel.toLowerCase()}`}
                size={PrimaryButtonSize.Small}
                variant={PrimaryButtonVariant.MutedOnLowBg}
                isGrowing
                onClick={() => onResolveAll('ours')}
              />
            </div>
            <div className={css.Action}>
              <PrimaryButton
                label={`Take all ${theirsLabel.toLowerCase()}`}
                size={PrimaryButtonSize.Small}
                variant={PrimaryButtonVariant.MutedOnLowBg}
                isGrowing
                onClick={() => onResolveAll('theirs')}
              />
            </div>
          </div>
        )}
      </Section>

      {[...byComponent.entries()].map(([component, entries]) => (
        <Section
          key={component}
          title={component}
          variant={SectionVariant.PanelShy}
          hasGutter
          hasBottomSpacing
          hasVisibleOverflow
        >
          {entries.map(({ key, text, conflict }) => {
            const resolution = conflict.resolution;
            return (
              <div key={key} className={css.Conflict}>
                <div className={css.Header}>
                  <span className={css.HeaderIcon}>
                    <Icon
                      icon={resolution ? IconName.Check : IconName.WarningTriangle}
                      size={IconSize.Tiny}
                      variant={resolution ? FeedbackType.Success : FeedbackType.Notice}
                    />
                  </span>
                  <Text size={TextSize.Small}>{text}</Text>
                </div>

                {conflict.ours !== undefined && (
                  <div className={css.Side}>
                    <Label variant={TextType.Shy} UNSAFE_className={css.SideLabel}>
                      {oursLabel}
                    </Label>
                    <Text size={TextSize.Small} className={css.SideValue}>
                      {describeSide(conflict.ours)}
                    </Text>
                  </div>
                )}
                {conflict.theirs !== undefined && (
                  <div className={css.Side}>
                    <Label variant={TextType.Shy} UNSAFE_className={css.SideLabel}>
                      {theirsLabel}
                    </Label>
                    <Text size={TextSize.Small} className={css.SideValue}>
                      {describeSide(conflict.theirs)}
                    </Text>
                  </div>
                )}

                {resolution ? (
                  <div className={css.Resolved}>
                    <Text size={TextSize.Small} textType={TextType.Shy}>
                      Resolved — kept {resolution === 'ours' ? oursLabel.toLowerCase() : theirsLabel.toLowerCase()}
                    </Text>
                  </div>
                ) : (
                  <div className={css.Actions}>
                    <div className={css.Action}>
                      <PrimaryButton
                        label={`Keep ${oursLabel.toLowerCase()}`}
                        size={PrimaryButtonSize.Small}
                        variant={PrimaryButtonVariant.MutedOnLowBg}
                        isGrowing
                        onClick={() => onResolve(conflict.id, 'ours')}
                      />
                    </div>
                    <div className={css.Action}>
                      <PrimaryButton
                        label={`Use ${theirsLabel.toLowerCase()}`}
                        size={PrimaryButtonSize.Small}
                        variant={PrimaryButtonVariant.MutedOnLowBg}
                        isGrowing
                        onClick={() => onResolve(conflict.id, 'theirs')}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </Section>
      ))}
    </VStack>
  );
}
