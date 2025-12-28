# 01 - Project Detection and Visual Indicators

## Overview

Detect legacy React 17 projects and display clear visual indicators throughout the UI so users understand which projects need migration.

## Detection Logic

### When to Check

1. **On app startup** - Scan recent projects list
2. **On "Open Project"** - Check selected folder
3. **On project list refresh** - Re-scan visible projects

### How to Detect Runtime Version

```typescript
// packages/noodl-editor/src/editor/src/models/migration/ProjectScanner.ts

interface RuntimeVersionInfo {
  version: 'react17' | 'react19' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  indicators: string[];
}

async function detectRuntimeVersion(projectPath: string): Promise<RuntimeVersionInfo> {
  const indicators: string[] = [];
  
  // Check 1: Explicit version in project.json (most reliable)
  const projectJson = await readProjectJson(projectPath);
  if (projectJson.runtimeVersion) {
    return {
      version: projectJson.runtimeVersion,
      confidence: 'high',
      indicators: ['Explicit runtimeVersion field in project.json']
    };
  }
  
  // Check 2: Look for migratedFrom field (indicates already migrated)
  if (projectJson.migratedFrom) {
    return {
      version: 'react19',
      confidence: 'high',
      indicators: ['Project has migratedFrom metadata']
    };
  }
  
  // Check 3: Check project version number
  // OpenNoodl 1.2+ = React 19, earlier = React 17
  const editorVersion = projectJson.editorVersion || projectJson.version;
  if (editorVersion) {
    const [major, minor] = editorVersion.split('.').map(Number);
    if (major >= 1 && minor >= 2) {
      indicators.push(`Editor version ${editorVersion} >= 1.2`);
      return { version: 'react19', confidence: 'high', indicators };
    } else {
      indicators.push(`Editor version ${editorVersion} < 1.2`);
      return { version: 'react17', confidence: 'high', indicators };
    }
  }
  
  // Check 4: Heuristic - scan for React 17 specific patterns in custom code
  const customCodePatterns = await scanForLegacyPatterns(projectPath);
  if (customCodePatterns.found) {
    indicators.push(...customCodePatterns.patterns);
    return { version: 'react17', confidence: 'medium', indicators };
  }
  
  // Check 5: If project was created before OpenNoodl fork, assume React 17
  const projectCreated = projectJson.createdAt || await getProjectCreationDate(projectPath);
  if (projectCreated && new Date(projectCreated) < new Date('2024-01-01')) {
    indicators.push('Project created before OpenNoodl fork');
    return { version: 'react17', confidence: 'medium', indicators };
  }
  
  // Default: Assume React 19 for truly unknown projects
  return {
    version: 'unknown',
    confidence: 'low',
    indicators: ['No version indicators found']
  };
}
```

### Legacy Pattern Scanner

```typescript
// Quick scan for legacy React patterns in JavaScript files

interface LegacyPatternScan {
  found: boolean;
  patterns: string[];
  files: Array<{ path: string; line: number; pattern: string; }>;
}

async function scanForLegacyPatterns(projectPath: string): Promise<LegacyPatternScan> {
  const jsFiles = await glob(`${projectPath}/**/*.{js,jsx,ts,tsx}`, {
    ignore: ['**/node_modules/**']
  });
  
  const legacyPatterns = [
    { regex: /componentWillMount\s*\(/, name: 'componentWillMount' },
    { regex: /componentWillReceiveProps\s*\(/, name: 'componentWillReceiveProps' },
    { regex: /componentWillUpdate\s*\(/, name: 'componentWillUpdate' },
    { regex: /UNSAFE_componentWillMount/, name: 'UNSAFE_componentWillMount' },
    { regex: /UNSAFE_componentWillReceiveProps/, name: 'UNSAFE_componentWillReceiveProps' },
    { regex: /UNSAFE_componentWillUpdate/, name: 'UNSAFE_componentWillUpdate' },
    { regex: /ref\s*=\s*["'][^"']+["']/, name: 'String ref' },
    { regex: /contextTypes\s*=/, name: 'Legacy contextTypes' },
    { regex: /childContextTypes\s*=/, name: 'Legacy childContextTypes' },
    { regex: /getChildContext\s*\(/, name: 'getChildContext' },
    { regex: /React\.createFactory/, name: 'createFactory' },
  ];
  
  const results: LegacyPatternScan = {
    found: false,
    patterns: [],
    files: []
  };
  
  for (const file of jsFiles) {
    const content = await fs.readFile(file, 'utf-8');
    const lines = content.split('\n');
    
    for (const pattern of legacyPatterns) {
      lines.forEach((line, index) => {
        if (pattern.regex.test(line)) {
          results.found = true;
          if (!results.patterns.includes(pattern.name)) {
            results.patterns.push(pattern.name);
          }
          results.files.push({
            path: file,
            line: index + 1,
            pattern: pattern.name
          });
        }
      });
    }
  }
  
  return results;
}
```

## Visual Indicators

### Projects Panel - Recent Projects List

```tsx
// packages/noodl-editor/src/editor/src/views/ProjectsPanel/ProjectCard.tsx

interface ProjectCardProps {
  project: RecentProject;
  runtimeInfo: RuntimeVersionInfo;
}

function ProjectCard({ project, runtimeInfo }: ProjectCardProps) {
  const isLegacy = runtimeInfo.version === 'react17';
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className={css['project-card', isLegacy && 'project-card--legacy']}>
      <div className={css['project-card__header']}>
        <FolderIcon />
        <div className={css['project-card__info']}>
          <h3 className={css['project-card__name']}>
            {project.name}
            {isLegacy && (
              <Tooltip content="This project uses React 17 and needs migration">
                <WarningIcon className={css['project-card__warning-icon']} />
              </Tooltip>
            )}
          </h3>
          <span className={css['project-card__date']}>
            Last opened: {formatDate(project.lastOpened)}
          </span>
        </div>
      </div>
      
      {isLegacy && (
        <div className={css['project-card__legacy-banner']}>
          <div className={css['legacy-banner__content']}>
            <WarningIcon size={16} />
            <span>Legacy Runtime (React 17)</span>
          </div>
          <button 
            className={css['legacy-banner__expand']}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Less' : 'More'}
          </button>
        </div>
      )}
      
      {isLegacy && expanded && (
        <div className={css['project-card__legacy-details']}>
          <p>
            This project needs migration to work with OpenNoodl 1.2+.
            Your original project will remain untouched.
          </p>
          <div className={css['legacy-details__actions']}>
            <Button 
              variant="primary" 
              onClick={() => openMigrationWizard(project)}
            >
              Migrate Project
            </Button>
            <Button 
              variant="secondary"
              onClick={() => openProjectReadOnly(project)}
            >
              Open Read-Only
            </Button>
            <Button 
              variant="ghost"
              onClick={() => openDocs('migration-guide')}
            >
              Learn More
            </Button>
          </div>
        </div>
      )}
      
      {!isLegacy && (
        <div className={css['project-card__actions']}>
          <Button onClick={() => openProject(project)}>Open</Button>
        </div>
      )}
    </div>
  );
}
```

### CSS Styles

```scss
// packages/noodl-editor/src/editor/src/styles/projects-panel.scss

.project-card {
  background: var(--color-bg-secondary);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid var(--color-border);
  transition: border-color 0.2s;
  
  &:hover {
    border-color: var(--color-border-hover);
  }
  
  &--legacy {
    border-color: var(--color-warning-border);
    
    &:hover {
      border-color: var(--color-warning-border-hover);
    }
  }
}

.project-card__warning-icon {
  color: var(--color-warning);
  margin-left: 8px;
  width: 16px;
  height: 16px;
}

.project-card__legacy-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--color-warning-bg);
  border-radius: 4px;
  padding: 8px 12px;
  margin-top: 12px;
}

.legacy-banner__content {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-warning-text);
  font-size: 13px;
  font-weight: 500;
}

.project-card__legacy-details {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
  
  p {
    color: var(--color-text-secondary);
    font-size: 13px;
    margin-bottom: 12px;
  }
}

.legacy-details__actions {
  display: flex;
  gap: 8px;
}
```

### Open Project Dialog - Legacy Detection

```tsx
// packages/noodl-editor/src/editor/src/views/dialogs/OpenProjectDialog.tsx

function OpenProjectDialog({ onClose }: { onClose: () => void }) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeVersionInfo | null>(null);
  const [checking, setChecking] = useState(false);
  
  const handleFolderSelect = async (path: string) => {
    setSelectedPath(path);
    setChecking(true);
    
    try {
      const info = await detectRuntimeVersion(path);
      setRuntimeInfo(info);
    } finally {
      setChecking(false);
    }
  };
  
  const isLegacy = runtimeInfo?.version === 'react17';
  
  return (
    <Dialog title="Open Project" onClose={onClose}>
      <FolderPicker 
        value={selectedPath}
        onChange={handleFolderSelect}
      />
      
      {checking && (
        <div className={css['checking-indicator']}>
          <Spinner size={16} />
          <span>Checking project version...</span>
        </div>
      )}
      
      {runtimeInfo && isLegacy && (
        <LegacyProjectNotice 
          projectPath={selectedPath}
          runtimeInfo={runtimeInfo}
        />
      )}
      
      <DialogActions>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        
        {isLegacy ? (
          <>
            <Button 
              variant="secondary"
              onClick={() => openProjectReadOnly(selectedPath)}
            >
              Open Read-Only
            </Button>
            <Button 
              variant="primary"
              onClick={() => openMigrationWizard(selectedPath)}
            >
              Migrate & Open
            </Button>
          </>
        ) : (
          <Button 
            variant="primary"
            disabled={!selectedPath || checking}
            onClick={() => openProject(selectedPath)}
          >
            Open
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function LegacyProjectNotice({ 
  projectPath, 
  runtimeInfo 
}: { 
  projectPath: string; 
  runtimeInfo: RuntimeVersionInfo;
}) {
  const projectName = path.basename(projectPath);
  const defaultTargetPath = `${projectPath}-r19`;
  const [targetPath, setTargetPath] = useState(defaultTargetPath);
  
  return (
    <div className={css['legacy-notice']}>
      <div className={css['legacy-notice__header']}>
        <WarningIcon size={20} />
        <h3>Legacy Project Detected</h3>
      </div>
      
      <p>
        <strong>"{projectName}"</strong> was created with an older version of 
        Noodl using React 17. OpenNoodl 1.2+ uses React 19.
      </p>
      
      <p>
        To open this project, we'll create a migrated copy. 
        Your original project will remain untouched.
      </p>
      
      <div className={css['legacy-notice__paths']}>
        <div className={css['path-row']}>
          <label>Original:</label>
          <code>{projectPath}</code>
        </div>
        <div className={css['path-row']}>
          <label>Copy:</label>
          <input 
            type="text" 
            value={targetPath}
            onChange={(e) => setTargetPath(e.target.value)}
          />
          <Button 
            variant="ghost" 
            size="small"
            onClick={() => selectFolder().then(setTargetPath)}
          >
            Change...
          </Button>
        </div>
      </div>
      
      {runtimeInfo.confidence !== 'high' && (
        <div className={css['legacy-notice__confidence']}>
          <InfoIcon size={14} />
          <span>
            Detection confidence: {runtimeInfo.confidence}. 
            Indicators: {runtimeInfo.indicators.join(', ')}
          </span>
        </div>
      )}
    </div>
  );
}
```

## Read-Only Mode

When opening a legacy project in read-only mode:

```typescript
// packages/noodl-editor/src/editor/src/models/projectmodel.ts

interface ProjectOpenOptions {
  readOnly?: boolean;
  legacyMode?: boolean;
}

async function openProject(path: string, options: ProjectOpenOptions = {}) {
  const project = await ProjectModel.fromDirectory(path);
  
  if (options.readOnly || options.legacyMode) {
    project.setReadOnly(true);
    
    // Show banner in editor
    EditorBanner.show({
      type: 'warning',
      message: 'This project is open in read-only mode. Migrate to make changes.',
      actions: [
        { label: 'Migrate Now', onClick: () => openMigrationWizard(path) },
        { label: 'Dismiss', onClick: () => EditorBanner.hide() }
      ]
    });
  }
  
  return project;
}
```

### Read-Only Banner Component

```tsx
// packages/noodl-editor/src/editor/src/views/EditorBanner.tsx

interface EditorBannerProps {
  type: 'info' | 'warning' | 'error';
  message: string;
  actions?: Array<{
    label: string;
    onClick: () => void;
  }>;
}

function EditorBanner({ type, message, actions }: EditorBannerProps) {
  return (
    <div className={css['editor-banner', `editor-banner--${type}`]}>
      <div className={css['editor-banner__content']}>
        {type === 'warning' && <WarningIcon size={16} />}
        {type === 'info' && <InfoIcon size={16} />}
        {type === 'error' && <ErrorIcon size={16} />}
        <span>{message}</span>
      </div>
      
      {actions && (
        <div className={css['editor-banner__actions']}>
          {actions.map((action, i) => (
            <Button 
              key={i}
              variant={i === 0 ? 'primary' : 'ghost'}
              size="small"
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
```

## Testing Checklist

- [ ] Legacy project shows warning icon in recent projects
- [ ] Clicking legacy project shows expanded details
- [ ] "Migrate Project" button opens migration wizard
- [ ] "Open Read-Only" opens project without changes
- [ ] Opening folder with legacy project shows detection dialog
- [ ] Target path can be customized
- [ ] Read-only mode shows banner
- [ ] Banner "Migrate Now" opens wizard
- [ ] New/modern projects open normally without warnings
