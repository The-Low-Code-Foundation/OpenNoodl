# TASK-009 Testing Guide: JavaScriptEditor

## ✅ Integration Complete!

The JavaScriptEditor is now integrated with a feature flag. You can test it immediately!

---

## How to Enable the New Editor

**Option 1: Browser DevTools Console**

1. Run the editor: `npm run dev`
2. Open DevTools (Cmd+Option+I)
3. In the console, type:
   ```javascript
   localStorage.setItem('use-javascript-editor', 'true');
   ```
4. Refresh the editor (Cmd+R)

**Option 2: Electron DevTools**

1. Start the editor
2. View → Toggle Developer Tools
3. Console tab
4. Same command as above

---

## Testing Checklist

### Test 1: Expression Node

1. ✅ **Create/Open Expression node** (e.g., in a Number node property)
2. ✅ **Check console** - Should see: `🔥 Using NEW JavaScriptEditor for: javascript`
3. ✅ **Code loads** - Your expression appears correctly (e.g., `a + b`)
4. ✅ **Edit code** - Type a valid expression
5. ✅ **See validation** - Status shows "✓ Valid"
6. ✅ **Try invalid code** - Type `a + + b`
7. ✅ **See error** - Error panel appears with helpful message
8. ✅ **Save** - Click Save button or Cmd+S
9. ✅ **Close editor** - Close the popout
10. ✅ **Reopen** - Code is still there!
11. ✅ **Check connections** - Input/output connections intact

### Test 2: Function Node

1. ✅ **Create/Open Function node**
2. ✅ **Console shows**: `🔥 Using NEW JavaScriptEditor for: javascript`
3. ✅ **Code loads** - Function body appears
4. ✅ **Edit** - Modify the function code
5. ✅ **Validation** - Try valid/invalid syntax
6. ✅ **Format** - Click Format button
7. ✅ **Save and reopen** - Code persists
8. ✅ **Connections intact**

### Test 3: Script Node

1. ✅ **Create/Open Script node**
2. ✅ **Console shows**: `🔥 Using NEW JavaScriptEditor for: typescript`
3. ✅ **Code loads**
4. ✅ **Edit and save**
5. ✅ **Code persists**
6. ✅ **Connections intact**

---

## What to Look For

### ✅ Good Signs

- Editor opens instantly (no Monaco lag)
- Code appears correctly
- You can type smoothly
- Format button works
- Save button works
- Cmd+S saves
- Error messages are helpful
- No console errors (except the 🔥 message)

### ⚠️ Warning Signs

- Code doesn't load
- Code gets corrupted
- Connections disappear
- Can't save
- Console errors
- Editor won't open

---

## If Something Goes Wrong

### Instant Rollback

**In DevTools Console:**

```javascript
localStorage.setItem('use-javascript-editor', 'false');
```

**Then refresh** - Back to Monaco!

Your code is NEVER at risk because:

- Same storage format (string)
- Same parameter name ('code')
- No data transformation
- Instant rollback available

---

## Debugging

### Check What's Enabled

```javascript
localStorage.getItem('use-javascript-editor');
// Returns: 'true' or 'false' or null
```

### Check Current Code Value

When a node is selected:

```javascript
// In console
NodeGraphEditor.instance.getSelectedNode().getParameter('code');
```

### Clear Flag

```javascript
localStorage.removeItem('use-javascript-editor');
```

---

## Known Differences from Monaco

### What's Missing (By Design)

- ❌ Syntax highlighting (just monospace font)
- ❌ Autocomplete (type manually)
- ❌ Live error checking (validates on blur/save)

### What's Better

- ✅ Actually works in Electron!
- ✅ No web worker errors
- ✅ Opens instantly
- ✅ Simple and reliable
- ✅ Clear error messages

---

## Reporting Issues

### If You Find a Bug

**Document:**

1. What node type? (Expression/Function/Script)
2. What happened?
3. What did you expect?
4. Can you reproduce it?
5. Console errors?

**Then:**

- Toggle flag back to `false`
- Note the issue
- We'll fix it!

---

## Next Steps After Testing

### If It Works Well

1. Keep using it!
2. Test with more complex code
3. Test with multiple projects
4. Report any issues you find

### When Ready to Make Default

1. Remove feature flag check
2. Make JavaScriptEditor the default
3. Remove Monaco code (if unused elsewhere)
4. Update documentation

---

## Current Status

- [x] JavaScriptEditor component built
- [x] Integration with CodeEditorType complete
- [x] Feature flag enabled
- [ ] **← YOU ARE HERE: Testing phase**
- [ ] Fix any issues found
- [ ] Make default after testing
- [ ] Remove Monaco dependencies

---

## Quick Command Reference

```javascript
// Enable new editor
localStorage.setItem('use-javascript-editor', 'true');

// Disable new editor (rollback)
localStorage.setItem('use-javascript-editor', 'false');

// Check status
localStorage.getItem('use-javascript-editor');

// Clear (uses default = Monaco)
localStorage.removeItem('use-javascript-editor');
```

---

**Ready to test!** Enable the flag and open an Expression node. You should see the new editor! 🎉
