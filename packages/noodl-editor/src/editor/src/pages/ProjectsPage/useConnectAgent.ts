import { useCallback, useEffect, useState } from 'react';

import { ipcInvoke } from '@noodl-utils/ipc';

import type {
  ConnectAgentResult,
  ConnectAgentState
} from '@noodl-core-ui/preview/launcher/Launcher/components/ConnectAgentCard';
import type { ConnectAgentHostState } from '@noodl-core-ui/preview/launcher/Launcher/LauncherContext';

import { buildBootstrapCommand, McpFrontDoor } from '../../views/panels/SettingsPanel/sections/mcpCommands';

/**
 * BST-003 — the launcher card's half of "connect Claude Code".
 *
 * ## Where the work happens, and why not here
 *
 * The renderer composes the registration and nothing else. Probing for the CLI, spawning it and —
 * when there isn't one — writing `~/.claude.json` all live in the main process, behind
 * `mcp:connect-bootstrap`, because every one of them needs the machine and a renderer that guesses
 * about the machine guesses wrong on exactly the installs that matter (F79/F85).
 *
 * ⚠️ **Main does not trust what this sends.** It re-resolves the bundle path itself and refuses a
 * registration that does not match. That is deliberate and this hook should not try to work around
 * it: "spawn this binary with these arguments" is the most useful thing an attacker could ask the
 * main process for, so the renderer proposes and main disposes.
 *
 * ## The states
 *
 * `idle → connecting → connected | failed`, and **failed is not terminal** — the button stays live
 * and the correct command is on screen to copy, because the whole failure this card exists to fix
 * is a user with nowhere to go.
 */
export function useConnectAgent(): ConnectAgentHostState | undefined {
  const [frontDoor, setFrontDoor] = useState<McpFrontDoor | null>(null);
  const [state, setState] = useState<ConnectAgentState>('idle');
  const [result, setResult] = useState<ConnectAgentResult | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // No project directory: that is the entire point of this registration.
  useEffect(() => {
    let cancelled = false;
    ipcInvoke<McpFrontDoor>('mcp:front-door', null)
      .then((answer) => {
        if (!cancelled) setFrontDoor(answer);
      })
      .catch(() => {
        // A front door we cannot reach means no card, rather than a card whose button cannot work.
        if (!cancelled) setFrontDoor(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isCopied) return;
    const timer = setTimeout(() => setIsCopied(false), 3000);
    return () => clearTimeout(timer);
  }, [isCopied]);

  const connection = frontDoor ? buildBootstrapCommand(frontDoor) : null;

  const onConnect = useCallback(() => {
    if (!connection?.registration) return;
    setState('connecting');

    ipcInvoke<ConnectAgentResult>('mcp:connect-bootstrap', {
      registration: connection.registration,
      command: connection.command
    })
      .then((answer) => {
        setResult(answer);
        setState(answer.ok ? 'connected' : 'failed');
      })
      .catch((e: Error) => {
        // Even the unexpected failure keeps the command on screen: `connection.command` is what
        // the user can still run by hand, and it is correct whatever went wrong in here.
        setResult({
          ok: false,
          method: null,
          serverName: 'nodegx',
          configPath: '',
          removeCommand: 'claude mcp remove --scope user nodegx',
          message: 'NodeGX could not reach the part of itself that does this.',
          detail: e.message,
          command: connection.command
        });
        setState('failed');
      });
  }, [connection?.registration, connection?.command]);

  const onCopyCommand = useCallback(() => {
    const command = result?.command ?? connection?.command;
    if (!command) return;
    // A real click handler: `navigator.clipboard.writeText` needs a user gesture and a focused
    // document.
    navigator.clipboard.writeText(command).then(() => setIsCopied(true));
  }, [result?.command, connection?.command]);

  // No front door, or no bundle to point at, means no card at all — never a button that cannot work.
  if (!connection?.registration) return undefined;

  return {
    state,
    // Before the first attempt there is no result, but the copy fallback still needs the command.
    result: result ?? {
      ok: false,
      method: null,
      serverName: 'nodegx',
      configPath: '',
      removeCommand: 'claude mcp remove --scope user nodegx',
      message: '',
      detail: null,
      command: connection.command
    },
    isCopied,
    onConnect,
    onCopyCommand
  };
}
