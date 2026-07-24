/**
 * Secure storage for AI provider credentials.
 *
 * Keys are encrypted with Electron's `safeStorage` (OS keychain-backed) and
 * held in a dedicated electron-store file. They are never written to the
 * editor settings JSON, and never anywhere inside a Noodl project directory —
 * a key that lands in a project gets committed and published.
 *
 * `safeStorage` is unavailable on some Linux desktops without a keyring. There
 * the electron-store encryption key is the only protection, which is
 * obfuscation rather than security; `isOsEncryptionAvailable()` lets the UI
 * say so plainly instead of implying a guarantee we cannot make.
 *
 * @module store/AiCredentials
 */

import { AiProviderId } from '@noodl-models/AiAssistant/client/types';

const STORE_NAME = 'ai-credentials';

type ElectronStoreLike = {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  delete(key: string): void;
};

type SafeStorageLike = {
  isEncryptionAvailable(): boolean;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
};

let _store: ElectronStoreLike | null | undefined;
let _safeStorage: SafeStorageLike | null | undefined;

/**
 * Both dependencies are resolved lazily and tolerate absence: this module is
 * imported by the AI client, which is imported by unit tests that have neither
 * an Electron remote nor a writable store.
 */
function getStore(): ElectronStoreLike | null {
  if (_store !== undefined) return _store;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Store = require('electron-store');
    const Ctor = Store.default || Store;
    _store = new Ctor({ name: STORE_NAME, encryptionKey: 'nodegx-ai-credentials' }) as ElectronStoreLike;
  } catch (error) {
    console.warn('[ai] Secure credential store unavailable:', error);
    _store = null;
  }
  return _store;
}

function getSafeStorage(): SafeStorageLike | null {
  if (_safeStorage !== undefined) return _safeStorage;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const remote = require('@electron/remote');
    _safeStorage = remote.safeStorage as SafeStorageLike;
  } catch {
    _safeStorage = null;
  }
  return _safeStorage;
}

function keyFor(provider: AiProviderId): string {
  return `apiKey.${provider}`;
}

export const AiCredentials = {
  /** Whether keys get OS-level encryption, or only the store's own obfuscation. */
  isOsEncryptionAvailable(): boolean {
    const safeStorage = getSafeStorage();
    try {
      return Boolean(safeStorage?.isEncryptionAvailable());
    } catch {
      return false;
    }
  },

  async set(provider: AiProviderId, apiKey: string): Promise<void> {
    const store = getStore();
    if (!store) throw new Error('Cannot store the API key: secure storage is unavailable.');

    if (!apiKey) {
      store.delete(keyFor(provider));
      return;
    }

    const safeStorage = getSafeStorage();
    if (safeStorage && this.isOsEncryptionAvailable()) {
      store.set(keyFor(provider), {
        encrypted: true,
        value: safeStorage.encryptString(apiKey).toString('base64')
      });
    } else {
      store.set(keyFor(provider), { encrypted: false, value: apiKey });
    }
  },

  async get(provider: AiProviderId): Promise<string | null> {
    const store = getStore();
    if (!store) return null;

    const stored = store.get(keyFor(provider)) as { encrypted?: boolean; value?: string } | string | undefined;
    if (!stored) return null;

    // Plain strings are what the pre-AIX-001 migration helper wrote.
    if (typeof stored === 'string') return stored;
    if (!stored.value) return null;
    if (!stored.encrypted) return stored.value;

    const safeStorage = getSafeStorage();
    if (!safeStorage) return null;

    try {
      return safeStorage.decryptString(Buffer.from(stored.value, 'base64'));
    } catch (error) {
      // Happens when the OS keychain entry is gone (restored machine, new
      // user). Nothing to recover — the user re-enters the key.
      console.warn('[ai] Stored credential could not be decrypted.', error);
      return null;
    }
  },

  async clear(provider: AiProviderId): Promise<void> {
    getStore()?.delete(keyFor(provider));
  },

  /** Redact a key for logs and error messages. */
  redact(apiKey: string | null | undefined): string {
    if (!apiKey) return '(none)';
    if (apiKey.length <= 8) return '••••';
    return `${apiKey.slice(0, 4)}••••${apiKey.slice(-4)}`;
  }
};
