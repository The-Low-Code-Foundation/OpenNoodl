# OpenNoodl Dev Docs - Setup Instructions

## What's Included

This folder contains everything needed to set up AI-assisted development with Cline for the OpenNoodl project.

## Files to Add to Repository

Copy these to the **root** of your OpenNoodl repository:

```
OpenNoodl/
├── .clinerules           ← Copy from dev-docs/.clinerules
├── .clineignore          ← Copy from .clineignore (separate file)
└── dev-docs/             ← Copy entire folder
    ├── README.md
    ├── CLINE-INSTRUCTIONS.md
    ├── TASK-TEMPLATE.md
    ├── guidelines/
    │   ├── CODING-STANDARDS.md
    │   └── GIT-WORKFLOW.md
    ├── reference/
    │   ├── CODEBASE-MAP.md
    │   ├── NODE-PATTERNS.md
    │   └── COMMON-ISSUES.md
    └── tasks/
        └── phase-1/
            └── TASK-001-dependency-updates/
                ├── README.md
                ├── CHECKLIST.md
                ├── CHANGELOG.md
                └── NOTES.md
```

## Setup Steps

### 1. Create Branch

```bash
git checkout -b setup/dev-docs
```

### 2. Copy Files

```bash
# Copy .clinerules to repo root
cp path/to/downloads/.clinerules .

# Copy .clineignore to repo root  
cp path/to/downloads/.clineignore .

# Copy dev-docs folder to repo root
cp -r path/to/downloads/dev-docs .
```

### 3. Configure Cline

1. Open VSCode with the OpenNoodl project
2. Click Cline extension settings (gear icon)
3. Find "Custom Instructions" field
4. Copy contents of `dev-docs/CLINE-INSTRUCTIONS.md` and paste

### 4. Commit

```bash
git add .clinerules .clineignore dev-docs/
git commit -m "docs: add AI-assisted development documentation"
git push -u origin setup/dev-docs
```

### 5. Start Working

1. Open a task: `dev-docs/tasks/phase-1/TASK-001-dependency-updates/`
2. Read the README.md
3. Follow the CHECKLIST.md
4. Track changes in CHANGELOG.md
5. Keep notes in NOTES.md

## File Purposes

| File | Purpose |
|------|---------|
| `.clinerules` | Project-specific rules Cline follows automatically |
| `.clineignore` | Files/folders Cline should ignore (like .gitignore) |
| `CLINE-INSTRUCTIONS.md` | Custom instructions to paste into Cline settings |
| `TASK-TEMPLATE.md` | Template for creating new task documentation |
| `guidelines/` | Development standards (coding, git workflow) |
| `reference/` | Quick references (codebase map, patterns, troubleshooting) |
| `tasks/` | Task documentation organized by phase |

## Creating New Tasks

1. Copy `TASK-TEMPLATE.md` sections to new folder
2. Follow naming: `TASK-XXX-short-name/`
3. Fill in all sections of README.md
4. Create the checklist specific to the task
5. Initialize empty CHANGELOG.md and NOTES.md

## Questions?

See `dev-docs/reference/COMMON-ISSUES.md` for troubleshooting.
