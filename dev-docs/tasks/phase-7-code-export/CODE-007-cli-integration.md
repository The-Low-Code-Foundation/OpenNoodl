# CODE-007: CLI & Editor Integration

## Overview

The CLI & Editor Integration task provides the command-line interface for exporting Noodl projects to React code, and integrates the export functionality into the editor UI.

**Estimated Effort:** 1-2 weeks  
**Priority:** MEDIUM  
**Dependencies:** CODE-001 through CODE-006  
**Blocks:** None (final integration task)

---

## CLI Tool

### Package: @nodegx/cli

```bash
# Installation
npm install -g @nodegx/cli

# Usage
nodegx export ./my-project --output ./my-app
nodegx export ./my-project --output ./my-app --typescript
nodegx export ./my-project --output ./my-app --css-mode tailwind
```

### CLI Options

| Option          | Description                                   | Default    |
| --------------- | --------------------------------------------- | ---------- |
| `--output, -o`  | Output directory                              | `./export` |
| `--typescript`  | Generate TypeScript                           | `true`     |
| `--css-mode`    | CSS approach: `modules`, `tailwind`, `inline` | `modules`  |
| `--clean`       | Clean output directory first                  | `false`    |
| `--verbose, -v` | Verbose output                                | `false`    |
| `--dry-run`     | Preview without writing files                 | `false`    |

### CLI Implementation

```typescript
// packages/nodegx-cli/src/index.ts
import { Command } from 'commander';

import { exportProject } from './export';

const program = new Command();

program.name('nodegx').description('Export Noodl projects to React applications').version('0.1.0');

program
  .command('export <project-path>')
  .description('Export a Noodl project to React code')
  .option('-o, --output <dir>', 'Output directory', './export')
  .option('--typescript', 'Generate TypeScript', true)
  .option('--css-mode <mode>', 'CSS mode: modules, tailwind, inline', 'modules')
  .option('--clean', 'Clean output directory first', false)
  .option('-v, --verbose', 'Verbose output', false)
  .option('--dry-run', 'Preview without writing files', false)
  .action(async (projectPath, options) => {
    await exportProject(projectPath, options);
  });

program.parse();
```

---

## Editor Integration

### Export Menu Item

Add "Export to React" option in File menu:

```typescript
// In editor menu configuration
{
  label: 'Export to React...',
  click: () => {
    showExportDialog();
  }
}
```

### Export Dialog UI

```tsx
// components/ExportDialog.tsx
interface ExportDialogProps {
  projectPath: string;
  onExport: (options: ExportOptions) => void;
  onCancel: () => void;
}

function ExportDialog({ projectPath, onExport, onCancel }: ExportDialogProps) {
  const [outputDir, setOutputDir] = useState('./export');
  const [cssMode, setCssMode] = useState<'modules' | 'tailwind' | 'inline'>('modules');
  const [useTypeScript, setUseTypeScript] = useState(true);

  return (
    <Dialog title="Export to React">
      <FormField label="Output Directory">
        <DirectoryPicker value={outputDir} onChange={setOutputDir} />
      </FormField>

      <FormField label="CSS Mode">
        <Select value={cssMode} onChange={setCssMode}>
          <Option value="modules">CSS Modules</Option>
          <Option value="tailwind">Tailwind CSS</Option>
          <Option value="inline">Inline Styles</Option>
        </Select>
      </FormField>

      <FormField label="TypeScript">
        <Checkbox checked={useTypeScript} onChange={setUseTypeScript} />
      </FormField>

      <DialogFooter>
        <Button onClick={onCancel}>Cancel</Button>
        <Button primary onClick={() => onExport({ outputDir, cssMode, useTypeScript })}>
          Export
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
```

### Progress Indicator

Show export progress:

```tsx
function ExportProgress({ status, progress, currentFile }: ExportProgressProps) {
  return (
    <div className={styles.progress}>
      <ProgressBar value={progress} max={100} />
      <span className={styles.status}>{status}</span>
      {currentFile && <span className={styles.currentFile}>Processing: {currentFile}</span>}
    </div>
  );
}
```

---

## Export Workflow

### 1. Project Analysis

```typescript
async function analyzeProject(projectPath: string): Promise<ProjectAnalysis> {
  const project = await loadProject(projectPath);

  return {
    components: analyzeComponents(project),
    stores: analyzeStores(project),
    events: analyzeEvents(project),
    routes: analyzeRoutes(project),
    assets: analyzeAssets(project)
  };
}
```

### 2. Code Generation

```typescript
async function generateCode(analysis: ProjectAnalysis, options: ExportOptions): Promise<GeneratedFiles> {
  const files: GeneratedFiles = {};

  // Generate stores
  files['src/stores/variables.ts'] = generateVariables(analysis.stores);
  files['src/stores/objects.ts'] = generateObjects(analysis.stores);
  files['src/stores/arrays.ts'] = generateArrays(analysis.stores);

  // Generate components
  for (const component of analysis.components) {
    const code = generateComponent(component, options);
    files[`src/components/${component.name}.tsx`] = code;
  }

  // Generate events
  files['src/events/channels.ts'] = generateEventChannels(analysis.events);

  // Generate routing
  files['src/App.tsx'] = generateApp(analysis.routes);

  return files;
}
```

### 3. File Output

```typescript
async function writeFiles(files: GeneratedFiles, outputDir: string, options: ExportOptions): Promise<void> {
  if (options.clean) {
    await fs.rm(outputDir, { recursive: true, force: true });
  }

  await fs.mkdir(outputDir, { recursive: true });

  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(outputDir, path);
    await fs.mkdir(dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  }
}
```

---

## Testing Checklist

- [ ] CLI parses all options correctly
- [ ] Export creates valid project structure
- [ ] Editor dialog shows correct options
- [ ] Progress updates during export
- [ ] Error handling shows helpful messages
- [ ] Generated project builds without errors

---

## Success Criteria

1. **CLI works standalone** - Export works without editor
2. **Editor integration seamless** - One-click export from menu
3. **Clear feedback** - Progress and errors well-communicated
4. **Generated code runs** - `npm install && npm run dev` succeeds
