/**
 * MigrationNotesPanel
 *
 * Displays detailed migration information for a component.
 * Shows issues detected, AI suggestions, and actions.
 */

import React from 'react';

import { ComponentModel } from '@noodl-models/componentmodel';

import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';
import { Title } from '@noodl-core-ui/components/typography/Title';

import {
  dismissMigrationNote,
  getIssueTypeLabel,
  getStatusIcon,
  getStatusLabel
} from '../../../models/migration/MigrationNotesManager';
import { ComponentMigrationNote } from '../../../models/migration/types';
import css from './MigrationNotesPanel.module.scss';

interface MigrationNotesPanelProps {
  component: ComponentModel;
  note: ComponentMigrationNote;
  onClose: () => void;
}

export function MigrationNotesPanel({ component, note, onClose }: MigrationNotesPanelProps) {
  const statusLabel = getStatusLabel(note.status);
  const statusIcon = getStatusIcon(note.status);

  const handleDismiss = () => {
    dismissMigrationNote(component.fullName);
    onClose();
  };

  const renderStatusIcon = () => {
    const icons = {
      'check-circle': (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      ),
      sparkles: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
        </svg>
      ),
      warning: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      ),
      check: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      )
    };

    return icons[statusIcon] || icons.check;
  };

  return (
    <div className={css['MigrationNotesPanel']}>
      {/* Status Header */}
      <div className={css['StatusHeader']} data-status={note.status}>
        <div className={css['StatusIcon']}>{renderStatusIcon()}</div>
        <div className={css['StatusText']}>
          <Title hasBottomSpacing={false}>{statusLabel}</Title>
          <Text textType={TextType.Shy}>Component: {component.localName}</Text>
        </div>
      </div>

      {/* Content */}
      <VStack hasSpacing>
        {/* Issues List */}
        {note.issues && note.issues.length > 0 && (
          <div className={css['Section']}>
            <h4>Issues Detected</h4>
            <ul className={css['IssuesList']}>
              {note.issues.map((issue, i) => (
                <li key={i} className={css['IssueItem']}>
                  <span className={css['IssueType']}>{getIssueTypeLabel(issue as any)}</span>
                  <span className={css['IssueDescription']}>{issue}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* AI Suggestion */}
        {note.aiSuggestion && (
          <div className={css['Section']}>
            <h4 className={css['SectionTitleAI']}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
              </svg>
              Claude&apos;s Suggestion
            </h4>
            <div className={css['AISuggestion']}>
              <pre>{note.aiSuggestion}</pre>
            </div>
          </div>
        )}

        {/* Help Link */}
        <div className={css['HelpSection']}>
          <Text textType={TextType.Shy}>
            Need more help?{' '}
            <a
              href="https://docs.opennoodl.com/migration/react19"
              target="_blank"
              rel="noopener noreferrer"
              className={css['HelpLink']}
            >
              View React 19 migration guide →
            </a>
          </Text>
        </div>
      </VStack>

      {/* Actions */}
      <div className={css['Actions']}>
        <HStack hasSpacing>
          {note.status === 'needs-review' && (
            <PrimaryButton variant={PrimaryButtonVariant.Ghost} label="Dismiss Warning" onClick={handleDismiss} />
          )}
          <PrimaryButton variant={PrimaryButtonVariant.Cta} label="Close" onClick={onClose} />
        </HStack>
      </div>
    </div>
  );
}
