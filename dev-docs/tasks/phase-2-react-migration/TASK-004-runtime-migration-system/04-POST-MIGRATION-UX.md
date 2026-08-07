# 04 - Post-Migration Editor Experience

## Overview

After migration, the editor needs to clearly communicate which components were successfully migrated, which need review, and provide easy access to migration notes and AI suggestions.

## Component Panel Indicators

### Visual Status Badges

```tsx
// packages/noodl-editor/src/editor/src/views/panels/ComponentsPanel/ComponentItem.tsx

interface ComponentItemProps {
  component: ComponentModel;
  migrationNote?: ComponentMigrationNote;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function ComponentItem({ 
  component, 
  migrationNote, 
  onClick, 
  onContextMenu 
}: ComponentItemProps) {
  const status = migrationNote?.status;
  
  const statusConfig = {
    'auto': null, // No badge for auto-migrated
    'ai-migrated': {
      icon: <SparklesIcon size={12} />,
      tooltip: 'AI migrated - click to see changes',
      className: 'status-ai'
    },
    'needs-review': {
      icon: <WarningIcon size={12} />,
      tooltip: 'Needs manual review',
      className: 'status-warning'
    },
    'manually-fixed': {
      icon: <CheckIcon size={12} />,
      tooltip: 'Manually fixed',
      className: 'status-success'
    }
  };
  
  const badge = status ? statusConfig[status] : null;
  
  return (
    <div 
      className={css['component-item', badge?.className]}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <ComponentIcon type={getComponentIconType(component)} />
      
      <span className={css['component-item__name']}>
        {component.localName}
      </span>
      
      {badge && (
        <Tooltip content={badge.tooltip}>
          <span className={css['component-item__badge']}>
            {badge.icon}
          </span>
        </Tooltip>
      )}
    </div>
  );
}
```

### CSS for Status Indicators

```scss
// packages/noodl-editor/src/editor/src/styles/components-panel.scss

.component-item {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  cursor: pointer;
  border-radius: 4px;
  gap: 8px;
  
  &:hover {
    background: var(--color-bg-hover);
  }
  
  &.status-warning {
    .component-item__badge {
      color: var(--color-warning);
    }
    
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      background: var(--color-warning);
      border-radius: 2px 0 0 2px;
    }
  }
  
  &.status-ai {
    .component-item__badge {
      color: var(--color-info);
    }
  }
  
  &.status-success {
    .component-item__badge {
      color: var(--color-success);
    }
  }
}

.component-item__badge {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  
  svg {
    width: 12px;
    height: 12px;
  }
}
```

## Migration Notes Panel

### Accessing Migration Notes

When a user clicks on a component with a migration status, show a panel with details:

```tsx
// packages/noodl-editor/src/editor/src/views/panels/MigrationNotesPanel.tsx

interface MigrationNotesPanelProps {
  component: ComponentModel;
  note: ComponentMigrationNote;
  onDismiss: () => void;
  onViewOriginal: () => void;
  onViewMigrated: () => void;
}

function MigrationNotesPanel({ 
  component, 
  note, 
  onDismiss,
  onViewOriginal,
  onViewMigrated 
}: MigrationNotesPanelProps) {
  const statusLabels = {
    'auto': 'Automatically Migrated',
    'ai-migrated': 'AI Migrated',
    'needs-review': 'Needs Manual Review',
    'manually-fixed': 'Manually Fixed'
  };
  
  const statusIcons = {
    'auto': <CheckCircleIcon />,
    'ai-migrated': <SparklesIcon />,
    'needs-review': <WarningIcon />,
    'manually-fixed': <CheckIcon />
  };
  
  return (
    <Panel 
      title="Migration Notes"
      icon={statusIcons[note.status]}
      onClose={onDismiss}
    >
      <div className={css['migration-notes']}>
        {/* Status Header */}
        <div className={css['notes-status', `notes-status--${note.status}`]}>
          {statusIcons[note.status]}
          <span>{statusLabels[note.status]}</span>
        </div>
        
        {/* Component Name */}
        <div className={css['notes-component']}>
          <ComponentIcon type={getComponentIconType(component)} />
          <span>{component.name}</span>
        </div>
        
        {/* Issues List */}
        {note.issues && note.issues.length > 0 && (
          <div className={css['notes-section']}>
            <h4>Issues Detected</h4>
            <ul className={css['notes-issues']}>
              {note.issues.map((issue, i) => (
                <li key={i}>
                  <code>{issue.type || 'Issue'}</code>
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* AI Suggestion */}
        {note.aiSuggestion && (
          <div className={css['notes-section']}>
            <h4>
              <RobotIcon size={14} />
              Claude's Suggestion
            </h4>
            <div className={css['notes-suggestion']}>
              <ReactMarkdown>
                {note.aiSuggestion}
              </ReactMarkdown>
            </div>
          </div>
        )}
        
        {/* Actions */}
        <div className={css['notes-actions']}>
          {note.status === 'needs-review' && (
            <>
              <Button 
                variant="secondary" 
                size="small"
                onClick={onViewOriginal}
              >
                View Original Code
              </Button>
              <Button
                variant="secondary"
                size="small"
                onClick={onViewMigrated}
              >
                View Migrated Code
              </Button>
            </>
          )}
          
          <Button
            variant="ghost"
            size="small"
            onClick={onDismiss}
          >
            Dismiss Warning
          </Button>
        </div>
        
        {/* Help Link */}
        <div className={css['notes-help']}>
          <a 
            href="https://docs.opennoodl.com/migration/react19"
            target="_blank"
          >
            Learn more about React 19 migration →
          </a>
        </div>
      </div>
    </Panel>
  );
}
```

## Migration Summary in Project Info

### Project Info Panel Addition

```tsx
// packages/noodl-editor/src/editor/src/views/panels/ProjectInfoPanel.tsx

function ProjectInfoPanel({ project }: { project: ProjectModel }) {
  const migrationInfo = project.migratedFrom;
  const migrationNotes = project.migrationNotes;
  
  const notesCounts = migrationNotes ? {
    total: Object.keys(migrationNotes).length,
    needsReview: Object.values(migrationNotes)
      .filter(n => n.status === 'needs-review').length,
    aiMigrated: Object.values(migrationNotes)
      .filter(n => n.status === 'ai-migrated').length
  } : null;
  
  return (
    <Panel title="Project Info">
      {/* Existing project info... */}
      
      {migrationInfo && (
        <div className={css['project-migration-info']}>
          <h4>
            <MigrationIcon size={14} />
            Migration Info
          </h4>
          
          <div className={css['migration-details']}>
            <div className={css['detail-row']}>
              <span>Migrated from:</span>
              <code>React 17</code>
            </div>
            <div className={css['detail-row']}>
              <span>Migration date:</span>
              <span>{formatDate(migrationInfo.date)}</span>
            </div>
            <div className={css['detail-row']}>
              <span>Original location:</span>
              <code className={css['path-truncate']}>
                {migrationInfo.originalPath}
              </code>
            </div>
            {migrationInfo.aiAssisted && (
              <div className={css['detail-row']}>
                <span>AI assisted:</span>
                <span>Yes</span>
              </div>
            )}
          </div>
          
          {notesCounts && notesCounts.needsReview > 0 && (
            <div className={css['migration-warnings']}>
              <WarningIcon size={14} />
              <span>
                {notesCounts.needsReview} component{notesCounts.needsReview > 1 ? 's' : ''} need review
              </span>
              <Button 
                variant="ghost" 
                size="small"
                onClick={() => filterComponentsByStatus('needs-review')}
              >
                Show
              </Button>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
```

## Component Filter for Migration Status

### Filter in Components Panel

```tsx
// packages/noodl-editor/src/editor/src/views/panels/ComponentsPanel/ComponentFilter.tsx

interface ComponentFilterProps {
  activeFilter: ComponentFilter;
  onFilterChange: (filter: ComponentFilter) => void;
  migrationCounts?: {
    needsReview: number;
    aiMigrated: number;
  };
}

type ComponentFilter = 'all' | 'needs-review' | 'ai-migrated' | 'pages' | 'components';

function ComponentFilterBar({ 
  activeFilter, 
  onFilterChange,
  migrationCounts 
}: ComponentFilterProps) {
  const hasMigrationFilters = migrationCounts && 
    (migrationCounts.needsReview > 0 || migrationCounts.aiMigrated > 0);
  
  return (
    <div className={css['component-filter-bar']}>
      <FilterButton
        active={activeFilter === 'all'}
        onClick={() => onFilterChange('all')}
      >
        All
      </FilterButton>
      
      <FilterButton
        active={activeFilter === 'pages'}
        onClick={() => onFilterChange('pages')}
      >
        Pages
      </FilterButton>
      
      <FilterButton
        active={activeFilter === 'components'}
        onClick={() => onFilterChange('components')}
      >
        Components
      </FilterButton>
      
      {hasMigrationFilters && (
        <>
          <div className={css['filter-divider']} />
          
          {migrationCounts.needsReview > 0 && (
            <FilterButton
              active={activeFilter === 'needs-review'}
              onClick={() => onFilterChange('needs-review')}
              badge={migrationCounts.needsReview}
              variant="warning"
            >
              <WarningIcon size={12} />
              Needs Review
            </FilterButton>
          )}
          
          {migrationCounts.aiMigrated > 0 && (
            <FilterButton
              active={activeFilter === 'ai-migrated'}
              onClick={() => onFilterChange('ai-migrated')}
              badge={migrationCounts.aiMigrated}
              variant="info"
            >
              <SparklesIcon size={12} />
              AI Migrated
            </FilterButton>
          )}
        </>
      )}
    </div>
  );
}
```

## Dismissing Migration Warnings

### Dismiss Functionality

```typescript
// packages/noodl-editor/src/editor/src/models/migration/MigrationNotes.ts

export function dismissMigrationNote(
  project: ProjectModel,
  componentId: string
): void {
  if (!project.migrationNotes?.[componentId]) {
    return;
  }
  
  // Mark as dismissed with timestamp
  project.migrationNotes[componentId] = {
    ...project.migrationNotes[componentId],
    dismissedAt: new Date().toISOString()
  };
  
  // Save project
  project.save();
}

export function getMigrationNotesForDisplay(
  project: ProjectModel,
  showDismissed: boolean = false
): Record<string, ComponentMigrationNote> {
  if (!project.migrationNotes) {
    return {};
  }
  
  if (showDismissed) {
    return project.migrationNotes;
  }
  
  // Filter out dismissed notes
  return Object.fromEntries(
    Object.entries(project.migrationNotes)
      .filter(([_, note]) => !note.dismissedAt)
  );
}
```

### Restore Dismissed Warnings

```tsx
// packages/noodl-editor/src/editor/src/views/panels/ComponentsPanel/DismissedWarnings.tsx

function DismissedWarningsSection({ project }: { project: ProjectModel }) {
  const [showDismissed, setShowDismissed] = useState(false);
  
  const dismissedNotes = Object.entries(project.migrationNotes || {})
    .filter(([_, note]) => note.dismissedAt);
  
  if (dismissedNotes.length === 0) {
    return null;
  }
  
  return (
    <div className={css['dismissed-warnings']}>
      <button 
        className={css['dismissed-toggle']}
        onClick={() => setShowDismissed(!showDismissed)}
      >
        <ChevronIcon direction={showDismissed ? 'up' : 'down'} />
        <span>
          {dismissedNotes.length} dismissed warning{dismissedNotes.length > 1 ? 's' : ''}
        </span>
      </button>
      
      {showDismissed && (
        <div className={css['dismissed-list']}>
          {dismissedNotes.map(([componentId, note]) => (
            <div key={componentId} className={css['dismissed-item']}>
              <span>{getComponentName(project, componentId)}</span>
              <Button
                variant="ghost"
                size="small"
                onClick={() => restoreMigrationNote(project, componentId)}
              >
                Restore
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## Migration Log Viewer

### Full Log Dialog

```tsx
// packages/noodl-editor/src/editor/src/views/migration/MigrationLogViewer.tsx

interface MigrationLogViewerProps {
  session: MigrationSession;
  onClose: () => void;
}

function MigrationLogViewer({ session, onClose }: MigrationLogViewerProps) {
  const [filter, setFilter] = useState<'all' | 'success' | 'warning' | 'error'>('all');
  const [search, setSearch] = useState('');
  
  const filteredLog = session.progress?.log.filter(entry => {
    if (filter !== 'all' && entry.level !== filter) {
      return false;
    }
    if (search && !entry.message.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  }) || [];
  
  const exportLog = () => {
    const content = session.progress?.log
      .map(e => `[${e.timestamp}] [${e.level.toUpperCase()}] ${e.component || ''}: ${e.message}`)
      .join('\n');
    
    downloadFile('migration-log.txt', content);
  };
  
  return (
    <Dialog 
      title="Migration Log" 
      size="large"
      onClose={onClose}
    >
      <div className={css['log-viewer']}>
        {/* Summary Stats */}
        <div className={css['log-summary']}>
          <StatPill 
            label="Total"
            value={session.progress?.log.length || 0}
          />
          <StatPill 
            label="Success"
            value={session.progress?.log.filter(e => e.level === 'success').length || 0}
            variant="success"
          />
          <StatPill 
            label="Warnings"
            value={session.progress?.log.filter(e => e.level === 'warning').length || 0}
            variant="warning"
          />
          <StatPill 
            label="Errors"
            value={session.progress?.log.filter(e => e.level === 'error').length || 0}
            variant="error"
          />
          
          {session.ai?.enabled && (
            <StatPill 
              label="AI Cost"
              value={`$${session.result?.totalCost.toFixed(2) || '0.00'}`}
              variant="info"
            />
          )}
        </div>
        
        {/* Filters */}
        <div className={css['log-filters']}>
          <input
            type="text"
            placeholder="Search log..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value as any)}
          >
            <option value="all">All Levels</option>
            <option value="success">Success</option>
            <option value="warning">Warnings</option>
            <option value="error">Errors</option>
          </select>
          
          <Button variant="secondary" size="small" onClick={exportLog}>
            Export Log
          </Button>
        </div>
        
        {/* Log Entries */}
        <div className={css['log-entries']}>
          {filteredLog.map((entry, i) => (
            <div 
              key={i} 
              className={css['log-entry', `log-entry--${entry.level}`]}
            >
              <span className={css['log-time']}>
                {formatTime(entry.timestamp)}
              </span>
              <span className={css['log-level']}>
                {entry.level.toUpperCase()}
              </span>
              {entry.component && (
                <span className={css['log-component']}>
                  {entry.component}
                </span>
              )}
              <span className={css['log-message']}>
                {entry.message}
              </span>
              {entry.cost && (
                <span className={css['log-cost']}>
                  ${entry.cost.toFixed(3)}
                </span>
              )}
              {entry.details && (
                <details className={css['log-details']}>
                  <summary>Details</summary>
                  <pre>{entry.details}</pre>
                </details>
              )}
            </div>
          ))}
          
          {filteredLog.length === 0 && (
            <div className={css['log-empty']}>
              No log entries match your filters
            </div>
          )}
        </div>
      </div>
      
      <DialogActions>
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

## Code Diff Viewer

### View Changes in Components

```tsx
// packages/noodl-editor/src/editor/src/views/migration/CodeDiffViewer.tsx

interface CodeDiffViewerProps {
  componentName: string;
  originalCode: string;
  migratedCode: string;
  changes: string[];
  onClose: () => void;
}

function CodeDiffViewer({ 
  componentName,
  originalCode, 
  migratedCode,
  changes,
  onClose 
}: CodeDiffViewerProps) {
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');
  
  return (
    <Dialog 
      title={`Code Changes: ${componentName}`}
      size="fullscreen"
      onClose={onClose}
    >
      <div className={css['diff-viewer']}>
        {/* Change Summary */}
        <div className={css['diff-changes']}>
          <h4>Changes Made</h4>
          <ul>
            {changes.map((change, i) => (
              <li key={i}>
                <CheckIcon size={12} />
                {change}
              </li>
            ))}
          </ul>
        </div>
        
        {/* View Mode Toggle */}
        <div className={css['diff-toolbar']}>
          <ToggleGroup 
            value={viewMode} 
            onChange={setViewMode}
            options={[
              { value: 'split', label: 'Side by Side' },
              { value: 'unified', label: 'Unified' }
            ]}
          />
          
          <Button
            variant="secondary"
            size="small"
            onClick={() => copyToClipboard(migratedCode)}
          >
            Copy Migrated Code
          </Button>
        </div>
        
        {/* Diff Display */}
        <div className={css['diff-content']}>
          {viewMode === 'split' ? (
            <SplitDiff 
              original={originalCode} 
              modified={migratedCode} 
            />
          ) : (
            <UnifiedDiff 
              original={originalCode} 
              modified={migratedCode} 
            />
          )}
        </div>
      </div>
      
      <DialogActions>
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Using Monaco Editor for diff view
function SplitDiff({ original, modified }: { original: string; modified: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    const editor = monaco.editor.createDiffEditor(containerRef.current, {
      renderSideBySide: true,
      readOnly: true,
      theme: 'vs-dark'
    });
    
    editor.setModel({
      original: monaco.editor.createModel(original, 'javascript'),
      modified: monaco.editor.createModel(modified, 'javascript')
    });
    
    return () => editor.dispose();
  }, [original, modified]);
  
  return <div ref={containerRef} className={css['monaco-diff']} />;
}
```

## Testing Checklist

- [ ] Status badges appear on components
- [ ] Clicking badge opens migration notes panel
- [ ] AI suggestions display with markdown formatting
- [ ] Dismiss functionality works
- [ ] Dismissed warnings can be restored
- [ ] Filter shows only matching components
- [ ] Migration info appears in project info
- [ ] Log viewer shows all entries
- [ ] Log can be filtered and searched
- [ ] Log can be exported
- [ ] Code diff viewer shows changes
- [ ] Diff supports split and unified modes
