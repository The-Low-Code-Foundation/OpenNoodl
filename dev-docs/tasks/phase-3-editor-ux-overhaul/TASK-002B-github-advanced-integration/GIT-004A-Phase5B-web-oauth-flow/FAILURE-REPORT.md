# FAILURE REPORT: GIT-004A Phase 5B - Web OAuth Flow

**Task:** Enable GitHub organization/repository selection during OAuth authentication  
**Status:** ❌ FAILED  
**Date:** January 9-10, 2026  
**Tokens Used:** ~155,000  
**Time Spent:** ~4 hours

---

## Goal

Replace GitHub Device Flow with Web OAuth Flow to enable users to select which organizations and repositories to grant access to during authentication.

---

## What Was Attempted

### Phase 1: Custom Protocol Handler (Initial Approach)

**Files Created/Modified:**

- `packages/noodl-editor/src/main/github-oauth-handler.js` (created)
- `packages/noodl-editor/src/main/main.js` (modified)
- `packages/noodl-editor/src/editor/src/services/github/GitHubAuth.ts` (modified)
- `packages/noodl-editor/src/editor/src/services/github/GitHubTypes.ts` (modified)
- `packages/noodl-editor/src/editor/src/services/github/GitHubTokenStore.ts` (modified)

**Approach:**

1. Created custom protocol handler (`noodl://github-callback`)
2. Built OAuth handler in main process to:

   - Register protocol handler
   - Generate OAuth state/CSRF tokens
   - Handle protocol callbacks from GitHub
   - Exchange authorization code for access token
   - Fetch user info and installations
   - Send results to renderer via IPC

3. Updated `GitHubAuth.ts` to:

   - Use `startWebOAuthFlow()` instead of Device Flow
   - Communicate with main process via IPC
   - Wait for `github-oauth-complete` event

4. Removed old `GitHubOAuthService` from `ProjectsPage.tsx`

### Phase 2: Debug Logging

**Added comprehensive logging:**

- 🔐 Protocol callback received (main process)
- 📤 IPC event sent to renderer (main process)
- 🎉 IPC event received (renderer)

---

## What Failed

### The Critical Issue

**When user clicks "Connect GitHub Account":**

✅ **GitHub OAuth works:**

- Browser opens to GitHub
- User authorizes the app
- GitHub redirects to `noodl://github-callback?code=XXX&state=YYY`

❌ **But the callback never completes:**

- Protocol handler receives the callback (presumably - can't confirm)
- **NONE of our debug logs appear in console**
- No `🔐 PROTOCOL CALLBACK RECEIVED` log
- No `📤 SENDING IPC EVENT` log
- No `🎉 IPC EVENT RECEIVED` log
- Button stays in "Connecting..." state forever
- No errors in console
- No exceptions thrown

### Root Cause (Unknown)

The debug logs we added don't appear, which means one of:

1. **Protocol handler isn't receiving the callback**

   - The `noodl://` protocol isn't registered properly
   - macOS/Windows isn't calling our handler
   - The callback URL is malformed

2. **Code isn't being loaded/executed**

   - Webpack isn't bundling our changes
   - Import paths are wrong
   - Module isn't being initialized

3. **IPC communication is broken**

   - Main process can't send to renderer
   - Channel names don't match
   - Renderer isn't listening

4. **The button isn't calling our code**
   - `CredentialsSection.tsx` calls something else
   - `GitHubAuth.startWebOAuthFlow()` isn't reached
   - Silent compilation error preventing execution

---

## Why This Is Hard To Debug

### No Error Messages

- No console errors
- No exceptions
- No webpack warnings
- Silent failure

### No Visibility

- Can't confirm if protocol handler fires
- Can't confirm if IPC events are sent
- Can't confirm which code path is executed
- Can't add breakpoints in main process easily

### Multiple Possible Failure Points

1. Protocol registration
2. GitHub redirect
3. Protocol callback reception
4. State validation
5. Token exchange
6. IPC send
7. IPC receive
8. Token storage
9. UI update

Any of these could fail silently.

---

## What We Know

### Confirmed Working

✅ Button click happens (UI responds)  
✅ GitHub OAuth completes (user authorizes)  
✅ Redirect happens (browser closes)

### Confirmed NOT Working

❌ Protocol callback handling (no logs)  
❌ IPC communication (no logs)  
❌ Token storage (button stuck)  
❌ UI state update (stays "Connecting...")

### Unknown

❓ Is `noodl://` protocol registered?  
❓ Is callback URL received by Electron?  
❓ Is our OAuth handler initialized?  
❓ Are IPC channels set up correctly?

---

## Files Modified (May Need Reverting)

```
packages/noodl-editor/src/main/github-oauth-handler.js (NEW - delete this)
packages/noodl-editor/src/main/main.js (MODIFIED - revert IPC setup)
packages/noodl-editor/src/editor/src/services/github/GitHubAuth.ts (MODIFIED - revert)
packages/noodl-editor/src/editor/src/pages/ProjectsPage/ProjectsPage.tsx (MODIFIED - revert)
```

---

## What Should Have Been Done Differently

### 1. Verify Button Connection First

Before building infrastructure, should have confirmed:

- Which component renders the button user clicks
- What method it calls
- That our new code is reachable

### 2. Test Incrementally

Should have tested each piece:

- ✅ Protocol registration works?
- ✅ Main process handler fires?
- ✅ IPC channels work?
- ✅ Renderer receives events?

### 3. Understand Existing Flow

Should have understood why Device Flow wasn't working before replacing it entirely.

### 4. Check for Existing Solutions

May be an existing OAuth implementation we missed that already works.

---

## Next Steps (If Resuming)

### Option 1: Debug Why Logs Don't Appear

1. Add `console.log` at module initialization to confirm code loads
2. Check webpack output to verify files are bundled
3. Check Electron main process console (not just renderer)
4. Verify protocol handler is actually registered (`app.isDefaultProtocolClient('noodl')`)

### Option 2: Different Approach Entirely

1. Use localhost HTTP server (original plan Phase 1)
2. Skip org/repo selection entirely (document limitation)
3. Use Personal Access Tokens only (no OAuth)

### Option 3: Revert Everything

1. `git checkout` all modified files
2. Delete `github-oauth-handler.js`
3. Restore original behavior
4. Document that org selection isn't supported

---

## Lessons Learned

1. **Always verify code is reachable** before building on top of it
2. **Debug logs that never appear** mean code isn't running, not that it's working silently
3. **Test each layer** independently (protocol → main → IPC → renderer)
4. **Electron has two processes** - check both consoles
5. **Silent failures** are the hardest to debug - add breadcrumb logs early

---

## Conclusion

This task failed because the OAuth callback completion mechanism never executes. The protocol handler may not be receiving callbacks, or our code may not be loaded/initialized properly. Without visibility into why the debug logs don't appear, further progress is impossible without dedicated debugging time with access to both Electron main and renderer process consoles simultaneously.

**Recommendation:** Revert all changes and either:

- Use a different authentication method (PAT only)
- Investigate why existing OAuth doesn't show org selection
- Hire someone familiar with Electron IPC debugging

---

**Generated:** January 10, 2026 00:00 UTC
