# Migrating your project to the v2 format

NodeGX can store your project in two ways:

- **Legacy (v1)** — everything in a single `project.json` file.
- **Decomposed (v2)** — one small, readable file per component, under a
  `components/` folder, plus a top-level `nodegx.project.json`.

Both formats are fully supported. The editor reads and writes either, and it
detects which one a project uses automatically. Migration is **optional** and
**always your choice** — nothing converts your project without you asking.

## Why migrate?

The v2 format stores each component in its own small set of files:

```
your-project/
├─ nodegx.project.json         ← project metadata, settings, variants
├─ nodegx.routes.json          ← routing (if any)
├─ nodegx.styles.json          ← colors and text styles
└─ components/
   ├─ _registry.json           ← index of every component
   ├─ Home/
   │  ├─ component.json         ← the component's metadata
   │  ├─ nodes.json             ← its nodes
   │  └─ connections.json       ← its connections
   └─ Pages/
      └─ Login/
         ├─ component.json
         ├─ nodes.json
         └─ connections.json
```

That layout gives you:

- **Readable diffs.** A change to one component shows up as a change to that
  component's files — not one giant unreadable diff on a single 4&nbsp;MB file.
- **Cleaner merges.** Two people editing different components no longer collide
  on the same file.
- **Smaller, targeted saves.** Saving rewrites only the components you actually
  changed.
- **AI- and tool-friendliness.** External tools (and AI agents) can read or
  author a single component without loading your whole project.

Your app behaves identically either way — this only changes how the project is
stored on disk.

## How migration works — and why it's safe

Migration is the one operation that rewrites your existing project, so it is
built around a single promise: **your original project is never damaged.**

The migrator enforces that promise in a strict order:

1. **Backup first.** Before writing anything, it copies your entire project to a
   sibling backup folder (`your-project.nodegx-backup`). If the backup can't be
   made, migration stops immediately and nothing is changed.
2. **Write the new files alongside the old.** The v2 files are all *new* paths.
   Your original `project.json` is left completely untouched during this step, so
   at every moment your project still opens as a valid legacy project.
3. **Verify.** The freshly-written v2 files are read back, reconstructed in
   memory, and compared field-by-field against your original project. If
   *anything* differs, migration aborts and restores from the backup.
4. **Commit last.** Only after verification passes does the old `project.json`
   get removed — the single final step that switches the project to v2. Because
   your original is safely in the backup, even this is reversible.

If the process is interrupted at any point (a crash, a power loss, closing the
app), the old `project.json` is still on disk, so your project opens normally —
and the backup is there too.

## Rolling back

Migration always leaves a backup at `your-project.nodegx-backup` next to your
project folder. To go back to the legacy format, restore that folder — either
through the editor's rollback action, or manually by replacing your project
directory's contents with the backup's.

Once you're confident in the migrated project, you can delete the backup folder.

## Large projects

Very large projects (hundreds of components) migrate and verify in a few extra
seconds. Progress is reported per component, and the operation can be cancelled —
cancelling before it commits leaves your original untouched.

## Frequently asked

**Do I have to migrate?** No. Legacy projects are fully supported and always will
be. Migrate when the benefits above matter to you.

**Will migrating change how my app runs?** No. Only the on-disk storage changes.

**Can I share a project with someone on an older NodeGX?** Keep it in the legacy
format, or send them the backup folder.

**What if verification fails?** Then migration did *not* faithfully reproduce your
project, so it refuses to finish and restores your original from the backup. This
is the safety net working as intended — please report the project that triggered
it.
