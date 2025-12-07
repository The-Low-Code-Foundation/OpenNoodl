# OpenNoodl Development Documentation

Welcome to the OpenNoodl development docs. This folder contains everything needed for AI-assisted development with Cline and human contributors alike.

## 📁 Structure

```
dev-docs/
├── .clinerules              # Project rules (copy to repo root)
├── README.md                # This file
├── CLINE-INSTRUCTIONS.md    # Custom instructions for Cline
├── TASK-TEMPLATE.md         # Template for creating new tasks
│
├── guidelines/              # Development standards
│   ├── CODING-STANDARDS.md  # Code style and patterns
│   ├── TESTING-GUIDE.md     # How to write tests
│   └── GIT-WORKFLOW.md      # Branch and commit conventions
│
├── reference/               # Quick reference materials
│   ├── CODEBASE-MAP.md      # Navigate the codebase
│   ├── NODE-PATTERNS.md     # How to create nodes
│   └── COMMON-ISSUES.md     # Troubleshooting guide
│
└── tasks/                   # Task documentation
    ├── phase-1/             # Foundation tasks
    │   ├── TASK-001-dependency-updates/
    │   ├── TASK-002-typescript-cleanup/
    │   └── ...
    ├── phase-2/             # Navigation & data tasks
    └── phase-3/             # UX & integration tasks
```

## 🚀 Getting Started

### For Cline Users

1. **Copy `.clinerules` to repo root**
   ```bash
   cp dev-docs/.clinerules .clinerules
   ```

2. **Add custom instructions to Cline**
   - Open VSCode → Cline extension settings
   - Paste contents of `CLINE-INSTRUCTIONS.md` into Custom Instructions

3. **Pick a task**
   - Browse `tasks/` folders
   - Each task has its own folder with detailed instructions
   - Start with Phase 1 tasks (they're prerequisites for later phases)

### For Human Contributors

1. Read `guidelines/CODING-STANDARDS.md`
2. Check `reference/CODEBASE-MAP.md` to understand the project
3. Pick a task from `tasks/` and follow its documentation

## 📋 Task Workflow

### Starting a Task

1. **Read the task documentation completely**
   ```
   tasks/phase-X/TASK-XXX-name/
   ├── README.md           # Full task description
   ├── CHECKLIST.md        # Step-by-step checklist
   ├── CHANGELOG.md        # Track your changes here
   └── NOTES.md            # Your working notes
   ```

2. **Create a branch**
   ```bash
   git checkout -b task/XXX-short-name
   ```

3. **Follow the checklist**, checking off items as you go

4. **Document everything** in CHANGELOG.md

### Completing a Task

1. Ensure all checklist items are complete
2. Run tests: `npm run test:editor`
3. Run type check: `npx tsc --noEmit`
4. Update CHANGELOG.md with final summary
5. Create pull request with task ID in title

## 🎯 Current Priorities

### Phase 1: Foundation (Do First)
- [x] TASK-000: Dependency Analysis Report (Research/Documentation)
- [ ] TASK-001: Dependency Updates & Build Modernization
- [ ] TASK-002: Legacy Project Migration & Backward Compatibility

### Phase 2: Core Systems
- [ ] TASK-003: Navigation System Overhaul
- [ ] TASK-004: Data Nodes Modernization

### Phase 3: UX Polish
- [ ] TASK-005: Property Panel Overhaul
- [ ] TASK-006: Import/Export Redesign
- [ ] TASK-007: REST API Improvements

## 📚 Key Resources

| Resource | Description |
|----------|-------------|
| [Codebase Map](reference/CODEBASE-MAP.md) | Navigate the monorepo |
| [Coding Standards](guidelines/CODING-STANDARDS.md) | Style and patterns |
| [Node Patterns](reference/NODE-PATTERNS.md) | Creating new nodes |
| [Common Issues](reference/COMMON-ISSUES.md) | Troubleshooting |

## 🤝 Contributing

1. Pick an unassigned task or create a new one using `TASK-TEMPLATE.md`
2. Follow the task documentation precisely
3. Document all changes in the task's CHANGELOG.md
4. Submit PR with comprehensive description

## ❓ Questions?

- Check `reference/COMMON-ISSUES.md` first
- Search existing task documentation
- Open an issue on GitHub with the `question` label
