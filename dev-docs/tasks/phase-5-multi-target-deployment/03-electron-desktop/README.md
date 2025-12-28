# Electron Desktop Target

**Phase ID:** PHASE-C  
**Priority:** 🟡 Medium (Second Priority)  
**Estimated Duration:** 3-4 weeks  
**Status:** Planning  
**Dependencies:** Phase A (BYOB Backend), Phase E (Target System Core)  
**Last Updated:** 2025-12-28

## Executive Summary

Enable Noodl users to build native desktop applications for Windows, macOS, and Linux using Electron. Desktop apps unlock capabilities impossible in web browsers: file system access, system processes, native dialogs, and offline-first operation.

## Strategic Advantage

Noodl's editor is already built on Electron (`packages/noodl-platform-electron/`), providing deep institutional knowledge of Electron patterns, IPC communication, and native integration.

## Value Proposition

| Capability | Web | Electron Desktop |
|------------|-----|------------------|
| File System Access | ❌ Limited (File API) | ✅ Full read/write/watch |
| Run System Processes | ❌ No | ✅ Spawn any executable (FFmpeg, Ollama, Python) |
| Native Dialogs | ❌ Browser dialogs | ✅ OS-native file pickers, alerts |
| System Tray | ❌ No | ✅ Tray icon with menu |
| Desktop Notifications | ⚠️ Limited | ✅ Native OS notifications |
| Offline Operation | ⚠️ PWA only | ✅ Full offline support |
| No CORS Restrictions | ❌ Blocked | ✅ Direct API access |
| Auto-Updates | ❌ No | ✅ Built-in updater |

## Use Cases

1. **Local AI Applications** - Run Ollama, LM Studio, or other local LLMs
2. **File Processing Tools** - Batch rename, image conversion, video encoding
3. **Developer Tools** - Code generators, project scaffolders, CLI wrappers
4. **Data Analysis** - Process local CSV/Excel files, generate reports
5. **Automation Tools** - File watchers, backup utilities, sync tools
6. **Kiosk Applications** - Point of sale, digital signage, information displays

## Technical Architecture

### Electron Process Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ELECTRON APP                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                      MAIN PROCESS                              │ │
│  │  (Node.js - full system access)                               │ │
│  │                                                                │ │
│  │  • File system operations (fs)                                │ │
│  │  • Spawn child processes (child_process)                      │ │
│  │  • System dialogs (dialog)                                    │ │
│  │  • System tray (Tray)                                         │ │
│  │  • Auto-updates (autoUpdater)                                 │ │
│  │  • Native menus (Menu)                                        │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                              │ IPC                                  │
│                              ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                     RENDERER PROCESS                           │ │
│  │  (Chromium - your Noodl app)                                  │ │
│  │                                                                │ │
│  │  ┌─────────────────────────────────────────────────────────┐  │ │
│  │  │                    NOODL APP                             │  │ │
│  │  │  [File Read Node] ──▶ IPC ──▶ [Main Process] ──▶ fs.read │  │ │
│  │  │  [Run Process]    ──▶ IPC ──▶ [Main Process] ──▶ spawn   │  │ │
│  │  └─────────────────────────────────────────────────────────┘  │ │
│  │                                                                │ │
│  │  Preload Script (Bridge between renderer and main)            │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Security Model

Electron's security is critical. We use **context isolation** and **preload scripts**:

```typescript
// main.ts - Main process
const win = new BrowserWindow({
  webPreferences: {
    // Security settings
    nodeIntegration: false,        // Don't expose Node in renderer
    contextIsolation: true,        // Isolate preload from renderer
    sandbox: true,                 // Sandbox renderer process
    preload: path.join(__dirname, 'preload.js'),
  }
});

// preload.ts - Secure bridge
const { contextBridge, ipcRenderer } = require('electron');

// Expose ONLY specific, validated APIs
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations (validated paths only)
  readFile: (filePath: string) => {
    // Validate path is within allowed directories
    if (!isPathAllowed(filePath)) {
      throw new Error('Access denied: path outside allowed directories');
    }
    return ipcRenderer.invoke('fs:readFile', filePath);
  },
  
  writeFile: (filePath: string, content: string) => {
    if (!isPathAllowed(filePath)) {
      throw new Error('Access denied');
    }
    return ipcRenderer.invoke('fs:writeFile', filePath, content);
  },
  
  // Dialog operations (safe - user-initiated)
  showOpenDialog: (options) => ipcRenderer.invoke('dialog:open', options),
  showSaveDialog: (options) => ipcRenderer.invoke('dialog:save', options),
  
  // Process operations (controlled)
  runProcess: (command: string, args: string[]) => {
    // Only allow whitelisted commands
    if (!isCommandAllowed(command)) {
      throw new Error('Command not allowed');
    }
    return ipcRenderer.invoke('process:run', command, args);
  },
});
```

## Electron-Specific Nodes

### File System Nodes

#### Read File

```
┌─────────────────────────────────────────────────────────────────────┐
│ 📄 Read File                                               [🖥️]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ INPUTS                                                              │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                     │
│ Read                      ○────  (Signal)                          │
│                                                                     │
│ File Path:                [                              ] [📁]    │
│                           Or connect from File Picker output       │
│                                                                     │
│ Encoding:                 [UTF-8 ▾]                                │
│                           ├─ UTF-8                                  │
│                           ├─ ASCII                                  │
│                           ├─ Base64                                 │
│                           └─ Binary (Buffer)                        │
│                                                                     │
│ OUTPUTS                                                             │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                     │
│ Content                   ────○  (String or Buffer)                 │
│ File Name                 ────○  (String)                           │
│ File Size                 ────○  (Number - bytes)                   │
│ Last Modified             ────○  (Date)                             │
│                                                                     │
│ Success                   ────○  (Signal)                           │
│ Error                     ────○  (Signal)                           │
│ Error Message             ────○  (String)                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Write File

```
┌─────────────────────────────────────────────────────────────────────┐
│ 💾 Write File                                              [🖥️]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ INPUTS                                                              │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                     │
│ Write                     ○────  (Signal)                          │
│                                                                     │
│ File Path:                [                              ] [📁]    │
│ Content:                  ○────  (String or Buffer)                │
│                                                                     │
│ Encoding:                 [UTF-8 ▾]                                │
│ Create Directories:       [✓]    (Create parent dirs if missing)   │
│ Overwrite:                [✓]    (Overwrite if exists)             │
│                                                                     │
│ OUTPUTS                                                             │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                     │
│ Written Path              ────○  (String - full path)               │
│ Success                   ────○  (Signal)                           │
│ Error                     ────○  (Signal)                           │
│ Error Message             ────○  (String)                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Watch Directory

```
┌─────────────────────────────────────────────────────────────────────┐
│ 👁️ Watch Directory                                         [🖥️]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ INPUTS                                                              │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                     │
│ Start Watching           ○────  (Signal)                           │
│ Stop Watching            ○────  (Signal)                           │
│                                                                     │
│ Directory Path:          [                              ] [📁]     │
│                                                                     │
│ Watch Subdirectories:    [✓]                                       │
│ File Filter:             [*.*   ] (glob pattern)                   │
│ Debounce (ms):           [100   ]                                  │
│                                                                     │
│ OUTPUTS                                                             │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                     │
│ File Path                ────○  (String - changed file)             │
│ Event Type               ────○  (String - add/change/unlink)        │
│                                                                     │
│ File Added               ────○  (Signal)                            │
│ File Changed             ────○  (Signal)                            │
│ File Removed             ────○  (Signal)                            │
│                                                                     │
│ Is Watching              ────○  (Boolean)                           │
│ Error                    ────○  (Signal)                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Native File Picker

```
┌─────────────────────────────────────────────────────────────────────┐
│ 📂 File Picker                                             [🖥️]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ INPUTS                                                              │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                     │
│ Open Picker              ○────  (Signal)                           │
│                                                                     │
│ Mode:                    [Open File ▾]                              │
│                          ├─ Open File                               │
│                          ├─ Open Multiple Files                     │
│                          ├─ Open Directory                          │
│                          └─ Save File                               │
│                                                                     │
│ Title:                   [Select a file                    ]       │
│                                                                     │
│ File Types:              [Images ▾] [+ Add]                        │
│                          ┌─────────────────────────────────────┐   │
│                          │ Name: Images                        │   │
│                          │ Extensions: jpg, jpeg, png, gif     │   │
│                          └─────────────────────────────────────┘   │
│                                                                     │
│ Default Path:            [/Users/richard/Documents   ] [📁]        │
│                                                                     │
│ OUTPUTS                                                             │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                     │
│ Selected Path            ────○  (String)                            │
│ Selected Paths           ────○  (Array - for multi-select)          │
│ File Name                ────○  (String - just filename)            │
│                                                                     │
│ Selected                 ────○  (Signal - user made selection)      │
│ Cancelled                ────○  (Signal - user cancelled)           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Process Nodes

#### Run Process

```
┌─────────────────────────────────────────────────────────────────────┐
│ ⚙️ Run Process                                              [🖥️]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ INPUTS                                                              │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                     │
│ Run                      ○────  (Signal)                           │
│ Kill                     ○────  (Signal - terminate process)       │
│                                                                     │
│ Command:                 [ffmpeg                         ]          │
│                                                                     │
│ Arguments:               (Array of strings)                         │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ [-i, input.mp4, -c:v, libx264, output.mp4]                     │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                          Or connect from Array node                 │
│                                                                     │
│ Working Directory:       [/Users/richard/projects] [📁]            │
│                                                                     │
│ Environment Variables:   (Object)                                   │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ { "PATH": "/usr/local/bin", "NODE_ENV": "production" }         │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ Shell:                   [✓]    (Run in shell - enables pipes)     │
│ Timeout (ms):            [0     ] (0 = no timeout)                 │
│                                                                     │
│ OUTPUTS                                                             │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                     │
│ stdout                   ────○  (String - standard output)          │
│ stderr                   ────○  (String - standard error)           │
│ Exit Code                ────○  (Number)                            │
│                                                                     │
│ On Output                ────○  (Signal - fires on each line)       │
│ Output Line              ────○  (String - current output line)      │
│                                                                     │
│ Started                  ────○  (Signal)                            │
│ Completed                ────○  (Signal - exit code 0)              │
│ Failed                   ────○  (Signal - non-zero exit)            │
│ Is Running               ────○  (Boolean)                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Implementation:**

```typescript
// packages/noodl-runtime/src/nodes/electron/RunProcessNode.ts

import { spawn, ChildProcess } from 'child_process';
import { createNodeDefinition } from '../../nodeDefinition';

export const RunProcessNode = createNodeDefinition({
  name: 'Run Process',
  category: 'System',
  color: 'red',
  
  inputs: {
    run: { type: 'signal', displayName: 'Run' },
    kill: { type: 'signal', displayName: 'Kill' },
    command: { type: 'string', displayName: 'Command' },
    args: { type: 'array', displayName: 'Arguments', default: [] },
    cwd: { type: 'string', displayName: 'Working Directory' },
    env: { type: 'object', displayName: 'Environment Variables' },
    shell: { type: 'boolean', displayName: 'Shell', default: false },
    timeout: { type: 'number', displayName: 'Timeout (ms)', default: 0 },
  },
  
  outputs: {
    stdout: { type: 'string', displayName: 'stdout' },
    stderr: { type: 'string', displayName: 'stderr' },
    exitCode: { type: 'number', displayName: 'Exit Code' },
    onOutput: { type: 'signal', displayName: 'On Output' },
    outputLine: { type: 'string', displayName: 'Output Line' },
    started: { type: 'signal', displayName: 'Started' },
    completed: { type: 'signal', displayName: 'Completed' },
    failed: { type: 'signal', displayName: 'Failed' },
    isRunning: { type: 'boolean', displayName: 'Is Running' },
  },
  
  targetCompatibility: ['electron'],
  
  state: {
    process: null as ChildProcess | null,
    stdoutBuffer: '',
    stderrBuffer: '',
  },
  
  signalHandlers: {
    run: async function(inputs, outputs, state) {
      // Validate command against whitelist (security)
      if (!await this.validateCommand(inputs.command)) {
        outputs.stderr = 'Command not allowed by security policy';
        outputs.failed.trigger();
        return;
      }
      
      const options = {
        cwd: inputs.cwd || process.cwd(),
        env: { ...process.env, ...inputs.env },
        shell: inputs.shell,
        timeout: inputs.timeout || undefined,
      };
      
      state.stdoutBuffer = '';
      state.stderrBuffer = '';
      outputs.isRunning = true;
      
      state.process = spawn(inputs.command, inputs.args, options);
      outputs.started.trigger();
      
      state.process.stdout?.on('data', (data) => {
        const text = data.toString();
        state.stdoutBuffer += text;
        outputs.stdout = state.stdoutBuffer;
        
        // Emit line-by-line
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.trim()) {
            outputs.outputLine = line;
            outputs.onOutput.trigger();
          }
        }
      });
      
      state.process.stderr?.on('data', (data) => {
        state.stderrBuffer += data.toString();
        outputs.stderr = state.stderrBuffer;
      });
      
      state.process.on('close', (code) => {
        outputs.exitCode = code ?? -1;
        outputs.isRunning = false;
        state.process = null;
        
        if (code === 0) {
          outputs.completed.trigger();
        } else {
          outputs.failed.trigger();
        }
      });
      
      state.process.on('error', (err) => {
        outputs.stderr = err.message;
        outputs.isRunning = false;
        outputs.failed.trigger();
      });
    },
    
    kill: function(inputs, outputs, state) {
      if (state.process) {
        state.process.kill();
        outputs.isRunning = false;
      }
    },
  },
});
```

### Window Nodes

#### Window Control

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🪟 Window Control                                           [🖥️]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ INPUTS                                                              │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                     │
│ Minimize                 ○────  (Signal)                           │
│ Maximize                 ○────  (Signal)                           │
│ Restore                  ○────  (Signal)                           │
│ Close                    ○────  (Signal)                           │
│ Toggle Fullscreen        ○────  (Signal)                           │
│                                                                     │
│ Set Size                 ○────  (Signal)                           │
│ Width:                   [800   ]                                  │
│ Height:                  [600   ]                                  │
│                                                                     │
│ Set Position             ○────  (Signal)                           │
│ X:                       [100   ]                                  │
│ Y:                       [100   ]                                  │
│                                                                     │
│ Always On Top:           [○]                                       │
│ Resizable:               [✓]                                       │
│                                                                     │
│ OUTPUTS                                                             │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                     │
│ Current Width            ────○  (Number)                            │
│ Current Height           ────○  (Number)                            │
│ Is Maximized             ────○  (Boolean)                           │
│ Is Fullscreen            ────○  (Boolean)                           │
│ Is Focused               ────○  (Boolean)                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### System Tray

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🔔 System Tray                                              [🖥️]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ INPUTS                                                              │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                     │
│ Show                     ○────  (Signal)                           │
│ Hide                     ○────  (Signal)                           │
│                                                                     │
│ Icon:                    [         ] [📁 Select Image]             │
│ Tooltip:                 [My App                        ]          │
│                                                                     │
│ Menu Items:              (Array of menu items)                      │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ [                                                               │ │
│ │   { "label": "Show Window", "action": "show" },                │ │
│ │   { "type": "separator" },                                     │ │
│ │   { "label": "Settings", "action": "settings" },               │ │
│ │   { "type": "separator" },                                     │ │
│ │   { "label": "Quit", "action": "quit" }                        │ │
│ │ ]                                                               │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ OUTPUTS                                                             │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                     │
│ Menu Action              ────○  (String - action from clicked item) │
│ Clicked                  ────○  (Signal - tray icon clicked)        │
│ Double Clicked           ────○  (Signal)                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Additional Electron Nodes

| Node | Category | Description |
|------|----------|-------------|
| **Native Notification** | System | OS-native notifications with actions |
| **Clipboard** | Utility | Read/write clipboard (text, images) |
| **Screen Info** | System | Get display info, cursor position |
| **Power Monitor** | System | Battery status, suspend/resume events |
| **App Info** | System | Get app version, paths, locale |
| **Protocol Handler** | System | Register custom URL protocols |
| **Auto Launch** | System | Start app on system boot |
| **Global Shortcut** | Input | Register system-wide hotkeys |

## Preview Mode

### Electron Preview in Editor

When Electron target is selected, preview can run with Node.js integration enabled:

```
┌─────────────────────────────────────────────────────────────────────┐
│ Preview Mode: [Electron (Desktop) ▾]                                │
│               ├─ Web (Browser)                                      │
│               └─ Electron (Desktop) ◀                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ⚠️ ELECTRON PREVIEW MODE                                           │
│                                                                     │
│  Preview is running with full desktop capabilities enabled.        │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ✓ File system access enabled                                │   │
│  │ ✓ Process execution enabled                                 │   │
│  │ ✓ Native dialogs enabled                                    │   │
│  │ ✓ System tray available                                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Security: Operations are sandboxed to your project directory      │
│                                                                     │
│                              [Switch to Web Preview]               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

Since Noodl editor already runs in Electron, enabling desktop features in preview is straightforward:

```typescript
// In viewer.js when Electron preview mode is enabled
if (previewMode === 'electron') {
  // Enable IPC bridge to main process
  window.noodlElectronBridge = {
    readFile: async (path) => ipcRenderer.invoke('fs:readFile', path),
    writeFile: async (path, content) => ipcRenderer.invoke('fs:writeFile', path, content),
    // ... other APIs
  };
}
```

## Export Pipeline

### Export Dialog

```
┌─────────────────────────────────────────────────────────────────────┐
│ Export Desktop App                                             [×]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ PLATFORM                                                            │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                    │
│ │   [Apple]   │ │  [Windows]  │ │   [Linux]   │                    │
│ │    macOS    │ │   Windows   │ │    Linux    │                    │
│ │  ✓ Selected │ │  ✓ Selected │ │             │                    │
│ └─────────────┘ └─────────────┘ └─────────────┘                    │
│                                                                     │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                     │
│ APP CONFIGURATION                                                   │
│                                                                     │
│ App Name:                                                           │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ My Desktop App                                                  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ App ID:                                                             │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ com.mycompany.mydesktopapp                                      │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ Version:                    Build Number:                           │
│ ┌─────────────────────────┐ ┌─────────────────────────┐            │
│ │ 1.0.0                   │ │ 1                       │            │
│ └─────────────────────────┘ └─────────────────────────┘            │
│                                                                     │
│ ▶ macOS Settings                                                    │
│   Category:                [Productivity ▾]                        │
│   Code Signing:            [Developer ID ▾]                        │
│   Notarization:            [✓] (Required for distribution)         │
│                                                                     │
│ ▶ Windows Settings                                                  │
│   Code Signing:            [None ▾]                                │
│   Installer Type:          [NSIS ▾]                                │
│                                                                     │
│ ▶ App Icons                                                         │
│   ┌─────────────────┐                                              │
│   │   [App Icon]    │  [📁 Select Icon]                            │
│   │   512x512 PNG   │                                              │
│   └─────────────────┘                                              │
│   ⓘ Will be converted to .icns (macOS) and .ico (Windows)         │
│                                                                     │
│ ▶ Permissions                                                       │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │ ☑ File System Access         (Required by: Read File, ...)  │  │
│   │ ☑ Process Execution          (Required by: Run Process)     │  │
│   │ ☐ Camera Access                                             │  │
│   │ ☐ Microphone Access                                         │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│ OUTPUT                                                              │
│ ● Installable Package (.dmg, .exe, .deb)           RECOMMENDED    │
│ ○ Portable App (zip folder)                                        │
│ ○ Development Build (unpackaged, for testing)                      │
│                                                                     │
│                                    [Cancel]  [Build for macOS]      │
│                                              [Build for Windows]    │
│                                              [Build All]            │
└─────────────────────────────────────────────────────────────────────┘
```

### Generated Project Structure

```
my-app-electron/
├── package.json              # Electron app dependencies
├── electron-builder.yml      # Build configuration
├── src/
│   ├── main/
│   │   ├── main.ts          # Main process entry
│   │   ├── preload.ts       # Preload script (IPC bridge)
│   │   ├── ipc/
│   │   │   ├── fs.ts        # File system handlers
│   │   │   ├── dialog.ts    # Dialog handlers
│   │   │   ├── process.ts   # Process handlers
│   │   │   └── index.ts
│   │   └── menu.ts          # Application menu
│   └── renderer/
│       ├── index.html       # App entry point
│       ├── main.js          # Noodl runtime bundle
│       ├── styles.css
│       └── assets/
├── resources/
│   ├── icon.icns            # macOS icon
│   ├── icon.ico             # Windows icon
│   └── icon.png             # Linux icon
└── dist/                    # Build output
    ├── mac/
    │   └── My App.dmg
    └── win/
        └── My App Setup.exe
```

## Implementation Phases

### Phase C.1: Electron Runtime Package (1 week)

**Goal:** Create separate runtime package for Electron-specific functionality.

**Tasks:**
- [ ] Create `packages/noodl-runtime-electron/` package
- [ ] Implement secure IPC bridge (preload.ts)
- [ ] Implement main process handlers (fs, dialog, process)
- [ ] Create sandbox validation utilities
- [ ] Set up security policy configuration

**Files to Create:**
```
packages/noodl-runtime-electron/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── main/
│   │   ├── main.ts           # Main process entry
│   │   ├── preload.ts        # Preload script
│   │   └── handlers/
│   │       ├── fs.ts
│   │       ├── dialog.ts
│   │       ├── process.ts
│   │       ├── window.ts
│   │       └── system.ts
│   ├── security/
│   │   ├── pathValidator.ts  # Validate file paths
│   │   ├── commandWhitelist.ts # Allowed commands
│   │   └── permissions.ts
│   └── types.ts
└── test/
```

### Phase C.2: Electron-Specific Nodes (1 week)

**Goal:** Implement desktop capability nodes.

**Tasks:**
- [ ] File System nodes (Read, Write, Watch, Picker)
- [ ] Process nodes (Run, Kill)
- [ ] Window nodes (Control, Tray)
- [ ] System nodes (Notification, Clipboard, App Info)
- [ ] Register nodes in Electron target only

**Files to Create:**
```
packages/noodl-runtime/src/nodes/electron/
├── index.ts
├── fs/
│   ├── ReadFileNode.ts
│   ├── WriteFileNode.ts
│   ├── WatchDirectoryNode.ts
│   └── FilePickerNode.ts
├── process/
│   ├── RunProcessNode.ts
│   └── ProcessInfoNode.ts
├── window/
│   ├── WindowControlNode.ts
│   └── SystemTrayNode.ts
└── system/
    ├── NotificationNode.ts
    ├── ClipboardNode.ts
    └── AppInfoNode.ts
```

### Phase C.3: Electron Preview Mode (3-4 days)

**Goal:** Enable desktop features in editor preview.

**Tasks:**
- [ ] Add Electron preview mode option
- [ ] Enable IPC bridge in preview window
- [ ] Create security sandbox for preview
- [ ] Add visual indicators for Electron mode
- [ ] Test all nodes in preview context

### Phase C.4: Electron Packaging (1 week)

**Goal:** Export production-ready desktop applications.

**Tasks:**
- [ ] Integrate electron-builder
- [ ] Generate main.ts from project configuration
- [ ] Generate preload.ts with used features
- [ ] Bundle Noodl app as renderer
- [ ] Configure code signing (macOS, Windows)
- [ ] Generate installer packages
- [ ] Create auto-update configuration

**Files to Create:**
```
packages/noodl-editor/src/editor/src/export/electron/
├── ElectronExporter.ts
├── mainGenerator.ts
├── preloadGenerator.ts
├── builderConfig.ts
├── iconConverter.ts
└── templates/
    ├── main.ts.template
    ├── preload.ts.template
    └── electron-builder.yml.template
```

## Security Considerations

### Path Validation

All file system operations must validate paths:

```typescript
class PathValidator {
  private allowedPaths: string[];
  
  constructor(projectPath: string) {
    this.allowedPaths = [
      projectPath,
      app.getPath('documents'),
      app.getPath('downloads'),
      app.getPath('temp'),
    ];
  }
  
  isPathAllowed(targetPath: string): boolean {
    const resolved = path.resolve(targetPath);
    
    // Check if path is within allowed directories
    return this.allowedPaths.some(allowed => 
      resolved.startsWith(path.resolve(allowed))
    );
  }
  
  // Prevent path traversal attacks
  sanitizePath(inputPath: string): string {
    // Remove .. and normalize
    return path.normalize(inputPath).replace(/\.\./g, '');
  }
}
```

### Command Whitelist

Only allow specific commands to be executed:

```typescript
const ALLOWED_COMMANDS = [
  // Media processing
  'ffmpeg',
  'ffprobe',
  'imagemagick',
  
  // AI/ML
  'ollama',
  'python',
  'python3',
  
  // Utilities
  'git',
  'npm',
  'npx',
  'node',
];

function isCommandAllowed(command: string): boolean {
  const base = path.basename(command);
  return ALLOWED_COMMANDS.includes(base);
}
```

### Permission System

```typescript
interface ElectronPermissions {
  fileSystem: {
    read: boolean;
    write: boolean;
    allowedPaths: string[];
  };
  process: {
    execute: boolean;
    allowedCommands: string[];
  };
  window: {
    control: boolean;
    tray: boolean;
  };
  system: {
    notifications: boolean;
    clipboard: boolean;
    autoLaunch: boolean;
  };
}
```

## Success Criteria

| Criteria | Target |
|----------|--------|
| Build time | < 2 minutes for production build |
| App size | < 150MB for minimal app |
| Startup time | < 3 seconds to first render |
| File operations | < 50ms overhead vs raw Node.js |
| All nodes tested | On macOS, Windows, Linux |

## Future Enhancements

1. **Native Node Modules** - Allow npm packages with native code
2. **Auto-Update System** - Built-in update mechanism
3. **Crash Reporting** - Integrate crash reporting service
4. **Hardware Access** - Serial ports, USB devices, Bluetooth
5. **Multiple Windows** - Open additional windows from nodes
