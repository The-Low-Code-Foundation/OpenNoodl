# Subtask A: Add Legacy Indicators to LauncherProjectCard

## Goal

Add visual indicators to project cards in the new launcher showing when a project is using the legacy React 17 runtime, with expandable details and action buttons.

## Files to Modify

### 1. `LauncherProjectCard.tsx`

**Location**: `packages/noodl-core-ui/src/preview/launcher/Launcher/components/LauncherProjectCard/LauncherProjectCard.tsx`

**Changes**:

1. Add `runtimeInfo` to the props interface
2. Detect if project is legacy based on runtime info
3. Add legacy warning badge
4. Add expandable legacy warning section with actions

**Implementation**:

```typescript
import { RuntimeVersionInfo } from '@noodl-types/migration';

// Add this import

export interface LauncherProjectCardProps extends LauncherProjectData {
  contextMenuItems: ContextMenuProps[];
  onClick?: () => void;
  runtimeInfo?: RuntimeVersionInfo; // NEW: Add runtime detection info
  onMigrateProject?: () => void; // NEW: Callback for migration
  onOpenReadOnly?: () => void; // NEW: Callback for read-only mode
}

export function LauncherProjectCard({
  id,
  title,
  cloudSyncMeta,
  localPath,
  lastOpened,
  pullAmount,
  pushAmount,
  uncommittedChangesAmount,
  imageSrc,
  contextMenuItems,
  contributors,
  onClick,
  runtimeInfo, // NEW
  onMigrateProject, // NEW
  onOpenReadOnly // NEW
}: LauncherProjectCardProps) {
  const { tags, getProjectMeta } = useProjectOrganization();
  const [showLegacyDetails, setShowLegacyDetails] = useState(false);

  // Get project tags
  const projectMeta = getProjectMeta(localPath);
  const projectTags = projectMeta ? tags.filter((tag) => projectMeta.tagIds.includes(tag.id)) : [];

  // Determine if this is a legacy project
  const isLegacy = runtimeInfo?.version === 'react17';
  const isDetecting = runtimeInfo === undefined;

  return (
    <Card
      background={CardBackground.Bg2}
      hoverBackground={CardBackground.Bg3}
      onClick={isLegacy ? undefined : onClick} // Disable normal click for legacy projects
      UNSAFE_className={isLegacy ? css.LegacyCard : undefined}
    >
      <Stack direction="row">
        <div className={css.Image} style={{ backgroundImage: `url(${imageSrc})` }} />

        <div className={css.Details}>
          <Columns layoutString="1 1 1" hasXGap={4}>
            <div>
              <HStack hasSpacing={2}>
                <Title hasBottomSpacing size={TitleSize.Medium}>
                  {title}
                </Title>

                {/* NEW: Legacy warning icon */}
                {isLegacy && (
                  <Tooltip content="This project uses React 17 and needs migration">
                    <Icon icon={IconName.WarningCircle} variant={FeedbackType.Danger} size={IconSize.Default} />
                  </Tooltip>
                )}

                {/* NEW: Detection in progress */}
                {isDetecting && (
                  <Tooltip content="Detecting runtime version...">
                    <Icon icon={IconName.Spinner} variant={TextType.Shy} size={IconSize.Small} />
                  </Tooltip>
                )}
              </HStack>

              {/* Tags */}
              {projectTags.length > 0 && (
                <HStack hasSpacing={2} UNSAFE_style={{ marginBottom: 'var(--spacing-2)', flexWrap: 'wrap' }}>
                  {projectTags.map((tag) => (
                    <TagPill key={tag.id} tag={tag} size={TagPillSize.Small} />
                  ))}
                </HStack>
              )}

              <Label variant={TextType.Shy}>Last opened {timeSince(new Date(lastOpened))} ago</Label>
            </div>

            {/* Cloud sync column - unchanged */}
            <div>{/* ... existing cloud sync code ... */}</div>

            {/* Contributors column - unchanged */}
            <HStack UNSAFE_style={{ justifyContent: 'space-between', alignItems: 'center' }} hasSpacing={4}>
              {/* ... existing contributors code ... */}
            </HStack>
          </Columns>

          {/* NEW: Legacy warning banner */}
          {isLegacy && (
            <div className={css.LegacyBanner}>
              <HStack hasSpacing={2} UNSAFE_style={{ alignItems: 'center', flex: 1 }}>
                <Icon icon={IconName.WarningCircle} variant={FeedbackType.Danger} size={IconSize.Small} />
                <Text size={TextSize.Small}>React 17 (Legacy Runtime)</Text>
              </HStack>

              <TextButton
                label={showLegacyDetails ? 'Less' : 'More'}
                size={TextButtonSize.Small}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLegacyDetails(!showLegacyDetails);
                }}
              />
            </div>
          )}

          {/* NEW: Expanded legacy details */}
          {isLegacy && showLegacyDetails && (
            <div className={css.LegacyDetails}>
              <Text size={TextSize.Small} variant={TextType.Shy}>
                This project needs migration to work with OpenNoodl 1.2+. Your original project will remain untouched.
              </Text>

              <HStack hasSpacing={2} UNSAFE_style={{ marginTop: 'var(--spacing-3)' }}>
                <PrimaryButton
                  label="Migrate Project"
                  size={PrimaryButtonSize.Small}
                  variant={PrimaryButtonVariant.Default}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMigrateProject?.();
                  }}
                />

                <PrimaryButton
                  label="View Read-Only"
                  size={PrimaryButtonSize.Small}
                  variant={PrimaryButtonVariant.Transparent}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenReadOnly?.();
                  }}
                />

                <TextButton
                  label="Learn More"
                  size={TextButtonSize.Small}
                  icon={IconName.ExternalLink}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Open documentation
                    window.open('https://docs.opennoodl.com/migration', '_blank');
                  }}
                />
              </HStack>
            </div>
          )}
        </div>
      </Stack>
    </Card>
  );
}
```

### 2. `LauncherProjectCard.module.scss`

**Location**: `packages/noodl-core-ui/src/preview/launcher/Launcher/components/LauncherProjectCard/LauncherProjectCard.module.scss`

**Add these styles**:

```scss
.LegacyCard {
  border-color: var(--theme-color-border-danger) !important;

  &:hover {
    border-color: var(--theme-color-border-danger-hover) !important;
  }
}

.LegacyBanner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-2);
  margin-top: var(--spacing-3);
  padding: var(--spacing-2) var(--spacing-3);
  background-color: var(--theme-color-bg-danger-subtle);
  border: 1px solid var(--theme-color-border-danger);
  border-radius: var(--border-radius-medium);
}

.LegacyDetails {
  margin-top: var(--spacing-2);
  padding: var(--spacing-3);
  background-color: var(--theme-color-bg-2);
  border-radius: var(--border-radius-medium);
  border: 1px solid var(--theme-color-border-default);
}
```

### 3. `Projects.tsx`

**Location**: `packages/noodl-core-ui/src/preview/launcher/Launcher/views/Projects.tsx`

**Changes**:

Pass runtime info and callbacks to each `LauncherProjectCard`:

```typescript
import { LocalProjectsModel } from '@noodl-utils/LocalProjectsModel';

// Add import

function Projects() {
  const {
    projects,
    selectedFolder,
    searchQuery,
    onMigrateProject, // NEW: From context
    onOpenProjectReadOnly // NEW: From context
  } = useLauncherContext();

  // Get projects with runtime info
  const projectsWithRuntime = LocalProjectsModel.instance.getProjectsWithRuntime();

  // Filter projects based on folder and search
  const filteredProjects = projectsWithRuntime
    .filter((project) => {
      if (selectedFolder && selectedFolder !== 'all') {
        const meta = getProjectMeta(project.localPath);
        return meta?.folderId === selectedFolder;
      }
      return true;
    })
    .filter((project) => {
      if (!searchQuery) return true;
      return project.title.toLowerCase().includes(searchQuery.toLowerCase());
    });

  return (
    <div className={css.Projects}>
      {filteredProjects.map((project) => (
        <LauncherProjectCard
          key={project.id}
          {...project}
          runtimeInfo={project.runtimeInfo} // NEW
          onMigrateProject={() => onMigrateProject(project)} // NEW
          onOpenReadOnly={() => onOpenProjectReadOnly(project)} // NEW
          contextMenuItems={
            [
              // ... existing context menu items ...
            ]
          }
        />
      ))}
    </div>
  );
}
```

## Types to Add

Create a new types file for migration if it doesn't exist:

**File**: `packages/noodl-types/src/migration.ts`

```typescript
export interface RuntimeVersionInfo {
  version: 'react17' | 'react19' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  indicators: string[];
}
```

## Testing Checklist

- [ ] Legacy projects show warning icon in title
- [ ] Legacy projects have orange/red border
- [ ] Legacy banner shows "React 17 (Legacy Runtime)"
- [ ] Clicking "More" expands details section
- [ ] Clicking "Less" collapses details section
- [ ] "Migrate Project" button is visible
- [ ] "View Read-Only" button is visible
- [ ] "Learn More" button is visible
- [ ] Normal projects don't show any legacy indicators
- [ ] Detection spinner shows while runtime is being detected
- [ ] Clicking card body for legacy projects doesn't trigger onClick

## Visual Design

```
┌────────────────────────────────────────────────────────────┐
│ [Thumbnail]  My Legacy Project ⚠️                          │
│              Last opened 2 days ago                        │
│                                                            │
│              ┌────────────────────────────────────────────┐│
│              │ ⚠️ React 17 (Legacy Runtime)      [More ▼]││
│              └────────────────────────────────────────────┘│
│                                                            │
│              ┌────────────────────────────────────────────┐│
│              │ This project needs migration to work with  ││
│              │ OpenNoodl 1.2+. Your original project will ││
│              │ remain untouched.                          ││
│              │                                            ││
│              │ [Migrate Project] [View Read-Only]  Learn More → ││
│              └────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────┘
```

## Notes

- **Non-blocking**: Normal click behavior is disabled for legacy projects to prevent accidental opening
- **Informative**: Clear warning with explanation
- **Actionable**: Three clear paths forward (migrate, view, learn)
- **Expandable**: Details hidden by default to avoid clutter
- **Color coding**: Use danger colors to indicate incompatibility without being alarming

## Next Steps

After completing this subtask:

1. Verify legacy badges appear correctly
2. Test expand/collapse behavior
3. Move to Subtask B to wire up the button callbacks
