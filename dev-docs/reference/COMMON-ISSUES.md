# Common Issues & Troubleshooting

Solutions to frequently encountered problems when developing OpenNoodl.

## Build Issues

### "Module not found" Errors

**Symptom**: Build fails with `Cannot find module '@noodl-xxx/...'`

**Solutions**:

1. Run `npm install` from root directory
2. Check if package exists in `packages/`
3. Verify tsconfig paths are correct
4. Try: `rm -rf node_modules && npm install`

### "Peer dependency" Warnings

**Symptom**: npm install shows peer dependency warnings

**Solutions**:

1. Check if versions are compatible
2. Update the conflicting package
3. Last resort: `npm install --legacy-peer-deps`
4. Document why in CHANGELOG.md

### TypeScript Errors After Update

**Symptom**: Types that worked before now fail

**Solutions**:

1. Run `npx tsc --noEmit` to see all errors
2. Check if `@types/*` packages need updating
3. Look for breaking changes in updated packages
4. Check `tsconfig.json` for configuration issues

### Webpack Build Hangs

**Symptom**: Build starts but never completes

**Solutions**:

1. Check for circular imports: `npx madge --circular packages/`
2. Increase Node memory: `NODE_OPTIONS=--max_old_space_size=4096`
3. Check for infinite loops in build scripts
4. Try building individual packages

## Runtime Issues

### Hot Reload Not Working

**Symptom**: Changes don't appear without full restart

**Solutions**:

1. Check webpack dev server is running
2. Verify file is being watched (check webpack config)
3. Clear browser cache
4. Check for syntax errors preventing reload
5. Restart dev server: `npm run dev`

### Node Not Appearing in Picker

**Symptom**: Created a node but it doesn't show up

**Solutions**:

1. Verify node is exported in `nodelibraryexport.js`
2. Check `category` is valid
3. Verify no JavaScript errors in node definition
4. Restart the editor

### "Cannot read property of undefined"

**Symptom**: Runtime error accessing object properties

**Solutions**:

1. Add null checks: `obj?.property`
2. Verify data is loaded before access
3. Check async timing issues
4. Add defensive initialization

### State Not Updating

**Symptom**: Changed input but output doesn't update

**Solutions**:

1. Verify `flagOutputDirty()` is called
2. Check if batching is interfering
3. Verify connection exists in graph
4. Check for conditional logic preventing update

### React Component Not Receiving Events

**Symptom**: ProjectModel/NodeLibrary events fire but React components don't update

**Solutions**:

1. **Check if using `useEventListener` hook** (most common issue):

   ```typescript
   // ✅ RIGHT - Always use useEventListener
   import { useEventListener } from '@noodl-hooks/useEventListener';

   // ❌ WRONG - Direct .on() silently fails in React
   useEffect(() => {
     ProjectModel.instance.on('event', handler, {});
   }, []);

   useEventListener(ProjectModel.instance, 'event', handler);
   ```

2. **Check singleton dependency in useEffect**:

   ```typescript
   // ❌ WRONG - Runs once before instance exists
   useEffect(() => {
     if (!ProjectModel.instance) return;
     ProjectModel.instance.on('event', handler, group);
   }, []); // Empty deps!

   // ✅ RIGHT - Re-runs when instance loads
   useEffect(() => {
     if (!ProjectModel.instance) return;
     ProjectModel.instance.on('event', handler, group);
   }, [ProjectModel.instance]); // Include singleton!
   ```

3. **Verify code is loading**:

   - Add `console.log('🔥 Module loaded')` at top of file
   - If log doesn't appear, clear caches (see Webpack issues below)

4. **Check event name matches exactly**:
   - ProjectModel events: `componentRenamed`, `componentAdded`, `componentRemoved`
   - Case-sensitive, no typos

**See also**:

- [LEARNINGS.md - React + EventDispatcher](./LEARNINGS.md#-critical-react--eventdispatcher-incompatibility-phase-0-dec-2025)
- [LEARNINGS.md - Singleton Timing](./LEARNINGS.md#-critical-singleton-dependency-timing-in-useeffect-dec-2025)

### Undo Action Doesn't Execute

**Symptom**: Action returns success and appears in undo history, but nothing happens

**Solutions**:

1. **Check if using broken pattern**:

   ```typescript
   // ❌ WRONG - Silent failure due to ptr bug
   const undoGroup = new UndoActionGroup({ label: 'Action' });
   UndoQueue.instance.push(undoGroup);
   undoGroup.push({ do: () => {...}, undo: () => {...} });
   undoGroup.do(); // NEVER EXECUTES

   // ✅ RIGHT - Use pushAndDo
   UndoQueue.instance.pushAndDo(
     new UndoActionGroup({
       label: 'Action',
       do: () => {...},
       undo: () => {...}
     })
   );
   ```

2. **Add debug logging**:

   ```typescript
   do: () => {
     console.log('🔥 ACTION EXECUTING'); // Should print immediately
     // Your action here
   }
   ```

   If log doesn't print, you have the ptr bug.

3. **Search codebase for broken pattern**:
   ```bash
   grep -r "undoGroup.push" packages/
   grep -r "undoGroup.do()" packages/
   ```
   If these appear together, fix them.

**See also**:

- [UNDO-QUEUE-PATTERNS.md](./UNDO-QUEUE-PATTERNS.md) - Complete guide
- [LEARNINGS.md - UndoActionGroup](./LEARNINGS.md#-critical-undoactiongroupdo-silent-failure-dec-2025)

### Webpack Cache Preventing Code Changes

**Symptom**: Code changes not appearing despite save/restart

**Solutions**:

1. **Verify code is loading** (add module marker):

   ```typescript
   // At top of file
   console.log('🔥 MyFile.ts LOADED - Version 2.0');
   ```

   If this doesn't appear in console, it's a cache issue.

2. **Nuclear cache clear** (when standard restart fails):

   ```bash
   # Kill processes
   killall node
   killall Electron

   # Clear ALL caches
   rm -rf packages/noodl-editor/node_modules/.cache
   rm -rf ~/Library/Application\ Support/Electron
   rm -rf ~/Library/Application\ Support/OpenNoodl  # macOS

   # Restart
   npm run dev
   ```

3. **Check build timestamp**:

   - Look for `🔥 BUILD TIMESTAMP:` in console
   - If timestamp is old, caching is active

4. **Verify in Sources tab**:
   - Open Chrome DevTools
   - Go to Sources tab
   - Find your file
   - Check if changes are there

**See also**: [LEARNINGS.md - Webpack Caching](./LEARNINGS.md#webpack-5-persistent-caching-issues-dec-2025)

## Editor Issues

### Preview Not Loading

**Symptom**: Preview panel is blank or shows error

**Solutions**:

1. Check browser console for errors
2. Verify viewer runtime is built
3. Check for JavaScript errors in project
4. Try creating a new empty project

### Property Panel Empty

**Symptom**: Selected node but no properties shown

**Solutions**:

1. Verify node has `inputs` defined
2. Check `group` values are set
3. Look for errors in property panel code
4. Verify node type is registered

### Canvas Performance Issues

**Symptom**: Node graph is slow/laggy

**Solutions**:

1. Reduce number of visible nodes
2. Check for expensive render operations
3. Verify no infinite update loops
4. Profile with Chrome DevTools

## Git Issues

### Merge Conflicts in package-lock.json

**Symptom**: Complex conflicts in lock file

**Solutions**:

1. Accept either version
2. Run `npm install` to regenerate
3. Commit the regenerated lock file

### Large File Warnings

**Symptom**: Git warns about large files

**Solutions**:

1. Check `.gitignore` includes build outputs
2. Verify `node_modules` not committed
3. Use Git LFS for large assets if needed

## Testing Issues

### Tests Timeout

**Symptom**: Tests hang or timeout

**Solutions**:

1. Check for unresolved promises
2. Verify mocks are set up correctly
3. Increase timeout if legitimately slow
4. Check for infinite loops

### Snapshot Tests Failing

**Symptom**: Snapshot doesn't match

**Solutions**:

1. Review the diff carefully
2. If change is intentional: `npm test -- -u`
3. If unexpected, investigate component changes

## Debugging Tips

### Enable Verbose Logging

```javascript
// Add to see more info
console.log('[DEBUG]', variable);

// For node execution
this.context.debugLog('Message', data);
```

### Use Chrome DevTools

1. Open editor
2. Press `Cmd+Option+I` (Mac) or `Ctrl+Shift+I` (Windows)
3. Check Console for errors
4. Use Sources for breakpoints
5. Use Network for API issues

### Inspect Node State

```javascript
// In browser console
const node = NoodlRuntime.instance.getNodeById('node-id');
console.log(node._internal);
```

### Check Event Flow

```javascript
// Add listener to see all events
model.on('*', (event, data) => {
  console.log('Event:', event, data);
});
```

## Error Messages

### "Maximum call stack size exceeded"

**Cause**: Infinite recursion or circular dependency

**Fix**:

1. Check for circular imports
2. Add base case to recursive functions
3. Break dependency cycles

### "Cannot access before initialization"

**Cause**: Temporal dead zone with `let`/`const`

**Fix**:

1. Check import order
2. Move declaration before usage
3. Check for circular imports

### "Unexpected token"

**Cause**: Syntax error or wrong file type

**Fix**:

1. Check file extension matches content
2. Verify JSON is valid
3. Check for missing brackets/quotes

### "ENOENT: no such file or directory"

**Cause**: Missing file or wrong path

**Fix**:

1. Verify file exists
2. Check path is correct (case-sensitive)
3. Ensure build step completed

## Getting Help

1. Search this document first
2. Check existing task documentation
3. Search codebase for similar patterns
4. Check GitHub issues
5. Ask in community channels

## Contributing Solutions

Found a solution not listed here? Add it!

1. Edit this file
2. Follow the format: Symptom → Solutions
3. Include specific commands when helpful
4. Submit PR with your addition

---

## Jest / Test Runner Hangs on Webpack Build

**Symptom**: `npm run test:editor -- --testPathPattern=Foo` hangs indefinitely.

**Root cause**: `scripts/test-editor.ts` runs a full webpack compile before Jest. Can appear hung but is just slow (30-90s).

**Rules**:
- Always put test files in `tests/models/` not `tests/services/` (transform config only covers models/ path)
- Never use `npx jest` directly - Babel cannot parse TypeScript `type` keyword without the full transform setup
- Use `npm run test:editor` from root — it will eventually complete
- Never use heredoc (`cat << EOF`) in terminal commands — use printf or write_to_file instead
