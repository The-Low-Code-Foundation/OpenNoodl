/**
 * PLAT-005: the dashboard-routing bug.
 *
 * Symptom, recorded in the phase-0 notes as a complete-with-caveat and open in
 * two phase-3 issue docs ever since:
 *
 *   Editor: electron: Failed to load URL: file:///dashboard/projects
 *           with error: ERR_FILE_NOT_FOUND
 *
 * Every note blamed phase-3 TASK-001B's Electron store migration and pointed at
 * ProjectOrganizationService / LocalProjectsModel. None of that is involved.
 * The editor renderer is loaded off disk (`win.loadURL('file:///' + appPath +
 * '/src/editor/index.html')`), so `window.location` is a `file:` URL with an
 * empty host; the Launcher's deep-link effect assigned
 * `url.pathname = '/dashboard/<tab>'` to it, which for a `file:` URL yields
 * literally `file:///dashboard/projects`, and pushed that into session history
 * with `replaceState`. The next reload then asked the filesystem root for it.
 *
 * noodl-core-ui has no test runner, so the guard is covered from here.
 */

import { shouldWriteDeepLinkUrl } from '@noodl-core-ui/preview/launcher/Launcher/Launcher';

describe('PLAT-005 launcher deep-link URL guard', () => {
  it('refuses to rewrite a file: URL — this is the bug', () => {
    expect(shouldWriteDeepLinkUrl('file:///Applications/NodeGX.app/src/editor/index.html')).toBe(false);
  });

  it('reproduces what the unguarded write produced, so the regression is legible', () => {
    // Kept as executable documentation: this is why the guard exists.
    const url = new URL('file:///Applications/NodeGX.app/src/editor/index.html');
    url.pathname = '/dashboard/projects';
    expect(url.toString()).toBe('file:///dashboard/projects');
  });

  it('still allows a real web origin — Storybook and the hosted preview', () => {
    expect(shouldWriteDeepLinkUrl('http://localhost:6006/?path=/story/launcher')).toBe(true);
    expect(shouldWriteDeepLinkUrl('https://example.com/dashboard/projects')).toBe(true);
  });

  it('refuses every other scheme rather than allow-listing by exclusion', () => {
    expect(shouldWriteDeepLinkUrl('noodl://dashboard/learn')).toBe(false);
    expect(shouldWriteDeepLinkUrl('about:blank')).toBe(false);
  });

  it('does not throw on an unparseable href', () => {
    expect(shouldWriteDeepLinkUrl('not a url')).toBe(false);
    expect(shouldWriteDeepLinkUrl('')).toBe(false);
  });
});
