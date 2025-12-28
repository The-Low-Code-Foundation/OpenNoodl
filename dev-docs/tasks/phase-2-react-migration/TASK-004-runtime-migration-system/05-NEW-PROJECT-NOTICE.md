# 05 - New Project Notice

## Overview

When creating new projects, inform users that OpenNoodl 1.2+ uses React 19 and is not backwards compatible with older Noodl versions. Keep the messaging positive and focused on the benefits.

## Create Project Dialog

### Updated UI

```tsx
// packages/noodl-editor/src/editor/src/views/dialogs/CreateProjectDialog.tsx

interface CreateProjectDialogProps {
  onClose: () => void;
  onCreateProject: (config: ProjectConfig) => void;
}

interface ProjectConfig {
  name: string;
  location: string;
  template?: string;
}

function CreateProjectDialog({ onClose, onCreateProject }: CreateProjectDialogProps) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState(getDefaultProjectLocation());
  const [template, setTemplate] = useState<string | undefined>();
  const [showInfo, setShowInfo] = useState(true);
  
  const handleCreate = () => {
    onCreateProject({ name, location, template });
  };
  
  const projectPath = path.join(location, slugify(name));
  
  return (
    <Dialog 
      title="Create New Project" 
      icon={<SparklesIcon />}
      onClose={onClose}
    >
      <div className={css['create-project']}>
        {/* Project Name */}
        <FormField label="Project Name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Awesome App"
            autoFocus
          />
        </FormField>
        
        {/* Location */}
        <FormField label="Location">
          <div className={css['location-field']}>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={css['location-input']}
            />
            <Button 
              variant="secondary"
              onClick={async () => {
                const selected = await selectFolder();
                if (selected) setLocation(selected);
              }}
            >
              Browse
            </Button>
          </div>
          <span className={css['location-preview']}>
            Project will be created at: <code>{projectPath}</code>
          </span>
        </FormField>
        
        {/* Template Selection (Optional) */}
        <FormField label="Start From" optional>
          <TemplateSelector
            value={template}
            onChange={setTemplate}
            templates={[
              { id: undefined, name: 'Blank Project', description: 'Start from scratch' },
              { id: 'hello-world', name: 'Hello World', description: 'Simple starter' },
              { id: 'dashboard', name: 'Dashboard', description: 'Data visualization template' }
            ]}
          />
        </FormField>
        
        {/* React 19 Info Box */}
        {showInfo && (
          <InfoBox 
            type="info"
            dismissible
            onDismiss={() => setShowInfo(false)}
          >
            <div className={css['react-info']}>
              <div className={css['react-info__header']}>
                <ReactIcon size={16} />
                <strong>OpenNoodl 1.2+ uses React 19</strong>
              </div>
              <p>
                Projects created with this version are not compatible with the 
                original Noodl app or older forks. This ensures you get the latest 
                React features and performance improvements.
              </p>
              <a 
                href="https://docs.opennoodl.com/react-19"
                target="_blank"
                className={css['react-info__link']}
              >
                Learn about React 19 benefits →
              </a>
            </div>
          </InfoBox>
        )}
      </div>
      
      <DialogActions>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button 
          variant="primary" 
          onClick={handleCreate}
          disabled={!name.trim()}
        >
          Create Project
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

### CSS Styles

```scss
// packages/noodl-editor/src/editor/src/styles/create-project.scss

.create-project {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 500px;
}

.location-field {
  display: flex;
  gap: 8px;
}

.location-input {
  flex: 1;
}

.location-preview {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
  
  code {
    background: var(--color-bg-tertiary);
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
  }
}

.react-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.react-info__header {
  display: flex;
  align-items: center;
  gap: 8px;
  
  svg {
    color: var(--color-react);
  }
}

.react-info__link {
  align-self: flex-start;
  font-size: 13px;
  color: var(--color-link);
  
  &:hover {
    text-decoration: underline;
  }
}
```

## First Launch Welcome

### First-Time User Experience

For users launching OpenNoodl for the first time after the React 19 update:

```tsx
// packages/noodl-editor/src/editor/src/views/dialogs/WelcomeDialog.tsx

interface WelcomeDialogProps {
  isUpdate: boolean; // true if upgrading from older version
  onClose: () => void;
  onCreateProject: () => void;
  onOpenProject: () => void;
}

function WelcomeDialog({ 
  isUpdate, 
  onClose, 
  onCreateProject, 
  onOpenProject 
}: WelcomeDialogProps) {
  return (
    <Dialog 
      title={isUpdate ? "Welcome to OpenNoodl 1.2" : "Welcome to OpenNoodl"}
      size="medium"
      onClose={onClose}
    >
      <div className={css['welcome-dialog']}>
        {/* Header */}
        <div className={css['welcome-header']}>
          <OpenNoodlLogo size={48} />
          <div>
            <h2>OpenNoodl 1.2</h2>
            <span className={css['version-badge']}>React 19</span>
          </div>
        </div>
        
        {/* Update Message (if upgrading) */}
        {isUpdate && (
          <div className={css['update-notice']}>
            <SparklesIcon size={20} />
            <div>
              <h3>What's New</h3>
              <ul>
                <li>
                  <strong>React 19 Runtime</strong> - Modern React with 
                  improved performance and new features
                </li>
                <li>
                  <strong>Migration Assistant</strong> - AI-powered tool to 
                  upgrade legacy projects
                </li>
                <li>
                  <strong>New Nodes</strong> - HTTP Request, improved data 
                  handling, and more
                </li>
              </ul>
            </div>
          </div>
        )}
        
        {/* Migration Note for Update */}
        {isUpdate && (
          <InfoBox type="info">
            <p>
              <strong>Have existing projects?</strong> When you open them, 
              OpenNoodl will guide you through migrating to React 19. Your 
              original projects are never modified.
            </p>
          </InfoBox>
        )}
        
        {/* Getting Started */}
        <div className={css['welcome-actions']}>
          <ActionCard
            icon={<PlusIcon />}
            title="Create New Project"
            description="Start fresh with React 19"
            onClick={onCreateProject}
            primary
          />
          
          <ActionCard
            icon={<FolderOpenIcon />}
            title="Open Existing Project"
            description={isUpdate 
              ? "Opens with migration assistant if needed" 
              : "Continue where you left off"
            }
            onClick={onOpenProject}
          />
        </div>
        
        {/* Resources */}
        <div className={css['welcome-resources']}>
          <a href="https://docs.opennoodl.com/getting-started" target="_blank">
            <BookIcon size={14} />
            Documentation
          </a>
          <a href="https://discord.opennoodl.com" target="_blank">
            <DiscordIcon size={14} />
            Community
          </a>
          <a href="https://github.com/opennoodl" target="_blank">
            <GithubIcon size={14} />
            GitHub
          </a>
        </div>
      </div>
    </Dialog>
  );
}
```

## Compatibility Check for Templates

### Template Metadata

```typescript
// packages/noodl-editor/src/editor/src/models/templates.ts

interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  runtimeVersion: 'react17' | 'react19';
  minEditorVersion?: string;
  tags: string[];
}

async function getAvailableTemplates(): Promise<ProjectTemplate[]> {
  const templates = await fetchTemplates();
  
  // Filter to only React 19 compatible templates
  return templates.filter(t => t.runtimeVersion === 'react19');
}

async function fetchTemplates(): Promise<ProjectTemplate[]> {
  // Fetch from community repository or local
  return [
    {
      id: 'blank',
      name: 'Blank Project',
      description: 'Start from scratch',
      runtimeVersion: 'react19',
      tags: ['starter']
    },
    {
      id: 'hello-world',
      name: 'Hello World',
      description: 'Simple starter with basic components',
      runtimeVersion: 'react19',
      tags: ['starter', 'beginner']
    },
    {
      id: 'dashboard',
      name: 'Dashboard',
      description: 'Data visualization with charts and tables',
      runtimeVersion: 'react19',
      tags: ['data', 'charts']
    },
    {
      id: 'form-app',
      name: 'Form Application',
      description: 'Multi-step form with validation',
      runtimeVersion: 'react19',
      tags: ['forms', 'business']
    }
  ];
}
```

## Settings for Info Box Dismissal

### User Preferences

```typescript
// packages/noodl-editor/src/editor/src/models/UserPreferences.ts

interface UserPreferences {
  // Existing preferences...
  
  // Migration related
  dismissedReactInfoInCreateDialog: boolean;
  dismissedWelcomeDialog: boolean;
  lastSeenVersion: string;
}

export function shouldShowWelcomeDialog(): boolean {
  const prefs = getUserPreferences();
  const currentVersion = getAppVersion();
  
  // Show if never seen or version changed significantly
  if (!prefs.lastSeenVersion) {
    return true;
  }
  
  const [lastMajor, lastMinor] = prefs.lastSeenVersion.split('.').map(Number);
  const [currentMajor, currentMinor] = currentVersion.split('.').map(Number);
  
  // Show on major or minor version bump
  return currentMajor > lastMajor || currentMinor > lastMinor;
}

export function markWelcomeDialogSeen(): void {
  updateUserPreferences({
    dismissedWelcomeDialog: true,
    lastSeenVersion: getAppVersion()
  });
}
```

## Documentation Link Content

### React 19 Benefits Page (External)

Create content for `https://docs.opennoodl.com/react-19`:

```markdown
# React 19 in OpenNoodl

OpenNoodl 1.2 uses React 19, bringing significant improvements to your projects.

## Benefits

### Better Performance
- Automatic batching of state updates
- Improved rendering efficiency
- Smaller bundle sizes

### Modern React Features
- Use modern hooks in custom code
- Better error boundaries
- Improved Suspense support

### Future-Proof
- Stay current with React ecosystem
- Better library compatibility
- Long-term support

## What This Means for You

### New Projects
New projects automatically use React 19. No extra configuration needed.

### Existing Projects
Legacy projects (React 17) can be migrated using our built-in migration 
assistant. The process is straightforward and preserves your original 
project.

## Compatibility Notes

- Projects created in OpenNoodl 1.2+ won't open in older Noodl versions
- Most built-in nodes work identically in both versions
- Custom JavaScript code may need minor updates (the migration assistant 
  can help with this)

## Learn More

- [Migration Guide](/migration/react19)
- [What's New in React 19](https://react.dev/blog/2024/04/25/react-19)
- [OpenNoodl Release Notes](/releases/1.2)
```

## Testing Checklist

- [ ] Create project dialog shows React 19 info
- [ ] Info box can be dismissed
- [ ] Dismissal preference is persisted
- [ ] Project path preview updates correctly
- [ ] Welcome dialog shows on first launch
- [ ] Welcome dialog shows after version update
- [ ] Welcome dialog shows migration note for updates
- [ ] Action cards navigate correctly
- [ ] Resource links open in browser
- [ ] Templates are filtered to React 19 only
