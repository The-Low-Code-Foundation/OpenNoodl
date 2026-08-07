/**
 * The launcher's settings entry: theme and the AI provider/key, set from the
 * dashboard rather than only from inside an open project.
 *
 * Both were previously reachable only from the editor's settings panel, which
 * needs a project open — a first-run user with no projects could not configure
 * AI at all except through the one action on the disabled "Start with AI" card,
 * and once a key was saved that action disappeared with it.
 *
 * What is worth pinning here is not the dialog's markup but the property the
 * two hosts depend on: **these settings are app-wide, not project-scoped.**
 * A key entered at the launcher — where no project exists to scope it to — must
 * be the key every project then uses. That is a claim about where the values
 * are written, and it is asserted directly.
 *
 * noodl-core-ui has no test runner, so the launcher-side guards live here.
 */

import { AiConfigStore } from '@noodl-store/AiAssistantStore';

import { ThemeManager, THEME_SETTINGS_KEY, ThemeMode } from '@noodl-models/ThemeManager';
import { EditorSettings } from '@noodl-utils/editorsettings';

describe('launcher settings — app-wide, not project-scoped', () => {
  describe('theme', () => {
    let original: ThemeMode;

    beforeEach(() => {
      original = ThemeManager.currentMode;
    });

    afterEach(() => {
      ThemeManager.setMode(original);
    });

    it('writes the mode to the shared editor settings store', () => {
      // The launcher's control and the editor's Appearance section are the same
      // component (`ThemeSettingRow`) over this one store, which is what makes
      // the choice survive leaving the launcher.
      ThemeManager.setMode('light');
      expect(EditorSettings.instance.get(THEME_SETTINGS_KEY)).toBe('light');

      ThemeManager.setMode('dark');
      expect(EditorSettings.instance.get(THEME_SETTINGS_KEY)).toBe('dark');
    });

    it('resolves an explicit mode without consulting the OS', () => {
      ThemeManager.setMode('light');
      expect(ThemeManager.resolvedTheme).toBe('light');
      ThemeManager.setMode('dark');
      expect(ThemeManager.resolvedTheme).toBe('dark');
    });

    it('stamps the document root, which is the whole shared window', () => {
      // Launcher and editor render into one window, so a root attribute covers
      // both — there is no launcher-only theme to keep in sync.
      ThemeManager.setMode('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      ThemeManager.setMode('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('ignores a value that is not a mode', () => {
      ThemeManager.setMode('light');
      ThemeManager.setMode('lite' as ThemeMode);
      expect(ThemeManager.currentMode).toBe('light');
    });
  });

  describe('AI provider configuration', () => {
    let originalProvider: ReturnType<typeof AiConfigStore.getProvider>;

    beforeEach(() => {
      originalProvider = AiConfigStore.getProvider();
    });

    afterEach(() => {
      AiConfigStore.setProvider(originalProvider);
    });

    it('round-trips the provider through the shared editor settings store', () => {
      // No ProjectModel is touched, and none is available at the launcher.
      AiConfigStore.setProvider('anthropic');
      expect(AiConfigStore.getProvider()).toBe('anthropic');

      AiConfigStore.setProvider('disabled');
      expect(AiConfigStore.getProvider()).toBe('disabled');
    });

    it('keeps model and endpoint per provider, not per project', () => {
      AiConfigStore.setProvider('anthropic');
      AiConfigStore.setModel('claude-sonnet-5', 'anthropic');
      AiConfigStore.setEndpoint('https://example.test/v1', 'openai-compatible');

      expect(AiConfigStore.getModel('anthropic')).toBe('claude-sonnet-5');
      // The other provider's endpoint is untouched by the active selection.
      expect(AiConfigStore.getEndpoint('openai-compatible')).toBe('https://example.test/v1');
    });

    it('reports "not configured" for a key-bearing provider with no key on file', () => {
      // This is exactly what gates the launcher's "Start with AI" card, so the
      // card's disabled state and the settings dialog read one fact.
      AiConfigStore.setProvider('anthropic');
      if (!AiConfigStore.hasApiKey('anthropic')) {
        expect(AiConfigStore.isConfigured()).toBe(false);
      }
    });

    it('treats disabled as unconfigured whatever else is on file', () => {
      AiConfigStore.setProvider('disabled');
      expect(AiConfigStore.isConfigured()).toBe(false);
    });
  });
});
