/**
 * TagSelector Component
 *
 * Allows users to assign/remove tags from a project.
 * Displays all available tags with checkboxes and option to create new tags.
 */

import React, { useState } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextInput, TextInputVariant } from '@noodl-core-ui/components/inputs/TextInput';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Label, LabelSize } from '@noodl-core-ui/components/typography/Label';
import { TextType } from '@noodl-core-ui/components/typography/Text';

import { Tag, useProjectOrganization } from '../../hooks/useProjectOrganization';
import { TagPill, TagPillSize } from '../TagPill';
import css from './TagSelector.module.scss';

export interface TagSelectorProps {
  /** Project path to manage tags for */
  projectPath: string;
  /** Callback when tags are changed */
  onTagsChanged?: () => void;
}

/**
 * TagSelector - UI for assigning/removing tags from a project
 *
 * Shows all available tags with checkboxes, and allows creating new tags inline.
 */
export function TagSelector({ projectPath, onTagsChanged }: TagSelectorProps) {
  const { tags, getProjectMeta, addTagToProject, removeTagFromProject, createTag } = useProjectOrganization();

  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  // Get current project tags
  const projectMeta = getProjectMeta(projectPath);
  const assignedTagIds = projectMeta?.tagIds || [];

  const handleToggleTag = (tagId: string) => {
    if (assignedTagIds.includes(tagId)) {
      removeTagFromProject(projectPath, tagId);
    } else {
      addTagToProject(projectPath, tagId);
    }
    onTagsChanged?.();
  };

  const handleCreateTag = () => {
    if (!newTagName.trim()) return;

    const newTag = createTag(newTagName.trim());
    addTagToProject(projectPath, newTag.id);
    setNewTagName('');
    setIsCreatingTag(false);
    onTagsChanged?.();
  };

  const handleCancelCreate = () => {
    setNewTagName('');
    setIsCreatingTag(false);
  };

  return (
    <div className={css.Root}>
      {/* Tag list */}
      {tags.length > 0 ? (
        <VStack hasSpacing={2}>
          {tags.map((tag) => {
            const isAssigned = assignedTagIds.includes(tag.id);
            return (
              <label key={tag.id} className={css.TagItem}>
                <input
                  type="checkbox"
                  checked={isAssigned}
                  onChange={() => handleToggleTag(tag.id)}
                  className={css.Checkbox}
                />
                <TagPill tag={tag} size={TagPillSize.Small} />
              </label>
            );
          })}
        </VStack>
      ) : (
        <Label variant={TextType.Shy} size={LabelSize.Small}>
          No tags yet. Create one below.
        </Label>
      )}

      {/* Create new tag */}
      <Box hasTopSpacing={4}>
        {!isCreatingTag ? (
          <PrimaryButton
            label="Create new tag"
            icon={IconName.Plus}
            size={PrimaryButtonSize.Small}
            variant={PrimaryButtonVariant.Muted}
            onClick={() => setIsCreatingTag(true)}
            UNSAFE_style={{ width: '100%' }}
          />
        ) : (
          <VStack hasSpacing={2}>
            <TextInput
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Tag name..."
              variant={TextInputVariant.Default}
              isAutoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateTag();
                } else if (e.key === 'Escape') {
                  handleCancelCreate();
                }
              }}
            />
            <HStack hasSpacing={2}>
              <PrimaryButton
                label="Create"
                size={PrimaryButtonSize.Small}
                onClick={handleCreateTag}
                isDisabled={!newTagName.trim()}
                UNSAFE_style={{ flex: 1 }}
              />
              <PrimaryButton
                label="Cancel"
                size={PrimaryButtonSize.Small}
                variant={PrimaryButtonVariant.Muted}
                onClick={handleCancelCreate}
                UNSAFE_style={{ flex: 1 }}
              />
            </HStack>
          </VStack>
        )}
      </Box>
    </div>
  );
}
