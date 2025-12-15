/**
 * ReportStep
 *
 * Step 3 of the migration wizard: Shows scan results by category.
 *
 * @module noodl-editor/views/migration/steps
 * @since 1.2.0
 */

import React, { useState } from 'react';

import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Collapsible } from '@noodl-core-ui/components/layout/Collapsible';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextSize, TextType } from '@noodl-core-ui/components/typography/Text';
import { Title, TitleSize } from '@noodl-core-ui/components/typography/Title';

import { MigrationScan, ComponentMigrationInfo } from '../../../models/migration/types';

import css from './ReportStep.module.scss';

export interface ReportStepProps {
  /** Scan results */
  scan: MigrationScan;
  /** Called when user chooses to migrate without AI */
  onMigrateWithoutAi: () => void;
  /** Called when user chooses to migrate with AI */
  onMigrateWithAi: () => void;
  /** Called when user cancels */
  onCancel: () => void;
}

export function ReportStep({
  scan,
  onMigrateWithoutAi,
  onMigrateWithAi,
  onCancel
}: ReportStepProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const { automatic, simpleFixes, needsReview } = scan.categories;

  const totalIssues = simpleFixes.length + needsReview.length;
  const allAutomatic = totalIssues === 0;

  // Calculate estimated cost (placeholder - AI not yet implemented)
  const estimatedCost = needsReview.length * 0.05 + simpleFixes.length * 0.02;

  return (
    <div className={css['Root']}>
      <VStack hasSpacing>
        <Text>
          Analyzed {scan.totalComponents} components and {scan.totalNodes} nodes.
          {scan.customJsFiles > 0 && ` Found ${scan.customJsFiles} custom JavaScript files.`}
        </Text>

        {/* Summary Stats */}
        <div className={css['SummaryStats']}>
          <StatCard
            icon={<CheckCircleIcon />}
            value={automatic.length}
            label="Automatic"
            variant="success"
          />
          <StatCard
            icon={<ZapIcon />}
            value={simpleFixes.length}
            label="Simple Fixes"
            variant="info"
          />
          <StatCard
            icon={<ToolIcon />}
            value={needsReview.length}
            label="Needs Review"
            variant="warning"
          />
        </div>

        {/* Category Sections */}
        <div className={css['Categories']}>
          {/* Automatic */}
          <CategorySection
            title="Automatic"
            description="These components will migrate without any changes"
            icon={<CheckCircleIcon />}
            items={automatic}
            variant="success"
            expanded={expandedCategory === 'automatic'}
            onToggle={() =>
              setExpandedCategory(expandedCategory === 'automatic' ? null : 'automatic')
            }
          />

          {/* Simple Fixes */}
          {simpleFixes.length > 0 && (
            <CategorySection
              title="Simple Fixes"
              description="Minor syntax updates needed"
              icon={<ZapIcon />}
              items={simpleFixes}
              variant="info"
              expanded={expandedCategory === 'simpleFixes'}
              onToggle={() =>
                setExpandedCategory(expandedCategory === 'simpleFixes' ? null : 'simpleFixes')
              }
              showIssueDetails
            />
          )}

          {/* Needs Review */}
          {needsReview.length > 0 && (
            <CategorySection
              title="Needs Review"
              description="May require manual adjustment after migration"
              icon={<ToolIcon />}
              items={needsReview}
              variant="warning"
              expanded={expandedCategory === 'needsReview'}
              onToggle={() =>
                setExpandedCategory(expandedCategory === 'needsReview' ? null : 'needsReview')
              }
              showIssueDetails
            />
          )}
        </div>

        {/* AI Prompt (if there are issues) */}
        {!allAutomatic && (
          <div className={css['AiPrompt']}>
            <div className={css['AiPromptIcon']}>
              <RobotIcon />
            </div>
            <div className={css['AiPromptContent']}>
              <Title size={TitleSize.Small}>AI-Assisted Migration (Coming Soon)</Title>
              <Text textType={TextType.Secondary} size={TextSize.Small}>
                Claude can help automatically fix the {totalIssues} components that need
                code changes. Estimated cost: ~${estimatedCost.toFixed(2)}
              </Text>
            </div>
          </div>
        )}
      </VStack>

      {/* Actions */}
      <div className={css['Actions']}>
        <HStack hasSpacing>
          <PrimaryButton
            label="Cancel"
            variant={PrimaryButtonVariant.Muted}
            onClick={onCancel}
          />
          <PrimaryButton
            label={allAutomatic ? 'Migrate Project' : 'Migrate (Auto Only)'}
            onClick={onMigrateWithoutAi}
          />
          {!allAutomatic && (
            <PrimaryButton
              label="Migrate with AI"
              onClick={onMigrateWithAi}
              isDisabled // AI not yet implemented
            />
          )}
        </HStack>
      </div>
    </div>
  );
}

// =============================================================================
// Sub-Components
// =============================================================================

interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  variant: 'success' | 'info' | 'warning';
}

function StatCard({ icon, value, label, variant }: StatCardProps) {
  return (
    <div className={`${css['StatCard']} ${css[`is-${variant}`]}`}>
      <div className={css['StatCardIcon']}>{icon}</div>
      <div className={css['StatCardValue']}>{value}</div>
      <div className={css['StatCardLabel']}>{label}</div>
    </div>
  );
}

interface CategorySectionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  items: ComponentMigrationInfo[];
  variant: 'success' | 'info' | 'warning';
  expanded: boolean;
  onToggle: () => void;
  showIssueDetails?: boolean;
}

function CategorySection({
  title,
  description,
  icon,
  items,
  variant,
  expanded,
  onToggle,
  showIssueDetails = false
}: CategorySectionProps) {
  if (items.length === 0) return null;

  return (
    <div className={`${css['CategorySection']} ${css[`is-${variant}`]}`}>
      <button className={css['CategoryHeader']} onClick={onToggle}>
        <div className={css['CategoryHeaderLeft']}>
          {icon}
          <div>
            <Text textType={TextType.Proud}>
              {title} ({items.length})
            </Text>
            <Text textType={TextType.Secondary} size={TextSize.Small}>
              {description}
            </Text>
          </div>
        </div>
        <ChevronIcon direction={expanded ? 'up' : 'down'} />
      </button>

      <Collapsible isCollapsed={!expanded}>
        <div className={css['CategoryItems']}>
          {items.map((item) => (
            <div key={item.id} className={css['CategoryItem']}>
              <ComponentIcon />
              <div className={css['CategoryItemInfo']}>
                <Text size={TextSize.Small}>{item.name}</Text>
                {showIssueDetails && item.issues.length > 0 && (
                  <ul className={css['IssuesList']}>
                    {item.issues.map((issue) => (
                      <li key={issue.id}>
                        <code>{issue.type}</code>
                        <Text size={TextSize.Small} isSpan textType={TextType.Secondary}>
                          {' '}{issue.description}
                        </Text>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {item.estimatedCost !== undefined && (
                <Text size={TextSize.Small} textType={TextType.Shy}>
                  ~${item.estimatedCost.toFixed(2)}
                </Text>
              )}
            </div>
          ))}
        </div>
      </Collapsible>
    </div>
  );
}

// =============================================================================
// Icons
// =============================================================================

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16}>
      <path
        d="M8 16A8 8 0 108 0a8 8 0 000 16zm3.78-9.72a.75.75 0 00-1.06-1.06L6.75 9.19 5.28 7.72a.75.75 0 00-1.06 1.06l2 2a.75.75 0 001.06 0l4.5-4.5z"
        fill="currentColor"
      />
    </svg>
  );
}

function ZapIcon() {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16}>
      <path
        d="M9.504.43a.75.75 0 01.397.696L9.223 5h4.027a.75.75 0 01.577 1.22l-5.25 6.25a.75.75 0 01-1.327-.55l.678-4.42H3.902a.75.75 0 01-.577-1.22l5.25-6.25a.75.75 0 01.93-.18z"
        fill="currentColor"
      />
    </svg>
  );
}

function ToolIcon() {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16}>
      <path
        d="M5.433 2.304A4.492 4.492 0 003.5 6c0 1.598.832 3.002 2.09 3.802.518.328.929.923.902 1.64l-.086 2.27a.75.75 0 01-.75.72h-1.3a.75.75 0 01-.75-.72l-.086-2.27c-.027-.717.384-1.312.902-1.64A4.495 4.495 0 003.5 6a5.99 5.99 0 012.433-4.864.75.75 0 011.134.64v3.046l.5.865.5-.865V1.776a.75.75 0 011.134-.64A5.99 5.99 0 0111.5 6a4.495 4.495 0 01-.922 3.802c-.518.328-.929.923-.902 1.64l.086 2.27a.75.75 0 01-.75.72h-1.3a.75.75 0 01-.75-.72l-.086-2.27c-.027-.717.384-1.312.902-1.64A4.495 4.495 0 007.5 6c0-.54-.185-1.061-.433-1.548"
        fill="currentColor"
      />
    </svg>
  );
}

function RobotIcon() {
  return (
    <svg viewBox="0 0 16 16" width={24} height={24}>
      <path
        d="M8 0a1 1 0 011 1v1.5h2A2.5 2.5 0 0113.5 5v6a2.5 2.5 0 01-2.5 2.5h-6A2.5 2.5 0 012.5 11V5A2.5 2.5 0 015 2.5h2V1a1 1 0 011-1zM5 4a1 1 0 00-1 1v6a1 1 0 001 1h6a1 1 0 001-1V5a1 1 0 00-1-1H5zm1.5 2a1 1 0 110 2 1 1 0 010-2zm3 0a1 1 0 110 2 1 1 0 010-2zM6 8.5a.5.5 0 000 1h4a.5.5 0 000-1H6z"
        fill="currentColor"
      />
    </svg>
  );
}

function ComponentIcon() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14}>
      <path
        d="M8.186 1.113a.5.5 0 00-.372 0L1.814 3.5l-.372.149v8.702l.372.149 6 2.387a.5.5 0 00.372 0l6-2.387.372-.149V3.649l-.372-.149-6-2.387zM8 2.123l4.586 1.828L8 5.778 3.414 3.95 8 2.123zm-5.5 2.89l5 1.992v6.372l-5-1.992V5.013zm6.5 8.364V7.005l5-1.992v6.372l-5 1.992z"
        fill="currentColor"
      />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: 'up' | 'down' }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={16}
      height={16}
      style={{ transform: direction === 'up' ? 'rotate(180deg)' : undefined }}
    >
      <path
        d="M12.78 6.22a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06 0L3.22 7.28a.75.75 0 011.06-1.06L8 9.94l3.72-3.72a.75.75 0 011.06 0z"
        fill="currentColor"
      />
    </svg>
  );
}

export default ReportStep;
