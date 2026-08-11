import React from 'react';

import { LauncherButton, LauncherButtonVariant } from '@noodl-core-ui/preview/launcher/Launcher/components/LauncherButton';

import css from './ConnectAgentCard.module.scss';

/**
 * BST-003 — the on-ramp, before there is a project.
 *
 * ## Why this is on the launcher and not in Settings
 *
 * Everything phase 62 built is worth nothing if nobody is ever told it exists, and until now the
 * only surface that mentioned MCP was a **collapsed section inside Editor Settings** that withheld
 * its own command unless a project was already open. TALK-004 put it there for a reason that has
 * since expired — *"the authoring command needs a project path"* — and BST-001 expired it by making
 * the server start with no project at all.
 *
 * ⚠️ **The card does not disappear once projects exist.** The user with one project who has never
 * connected an agent is the same user, just further along; what changes is prominence, not presence.
 * Hence `variant`.
 *
 * ## The states are the deliverable
 *
 * 🔴 **A silent success is the uninstall problem arriving by a different door.** The registration is
 * made at `--scope user`, which means *every folder on the machine*, and a button in an app that
 * quietly does that to someone's global tool configuration is not acceptable however convenient it
 * is. So `connected` names the server, says where it went, and shows how to remove it — always, not
 * behind a disclosure.
 *
 * And `failed` is a real state with a real route out of it, never a dead end: whatever went wrong,
 * the correct command is right there to copy.
 */
export enum ConnectAgentVariant {
  /** First launch, no projects — the whole point of the card. */
  Prominent = 'is-prominent',
  /** They have projects but no agent. Same offer, quieter. */
  Row = 'is-row'
}

export type ConnectAgentState = 'idle' | 'connecting' | 'connected' | 'failed';

/** What the main process reported. Mirrors `connectBootstrapServer`'s return. */
export interface ConnectAgentResult {
  ok: boolean;
  method: 'cli' | 'config-file' | null;
  serverName: string;
  configPath: string;
  removeCommand: string;
  message: string;
  detail: string | null;
  /** The `claude mcp add …` line, so a failure is never a dead end. */
  command: string | null;
}

export interface ConnectAgentCardProps {
  variant?: ConnectAgentVariant;
  state: ConnectAgentState;
  result?: ConnectAgentResult | null;
  /** True for the few seconds after a copy, so the button can confirm it happened. */
  isCopied?: boolean;
  onConnect: () => void;
  onCopyCommand: () => void;
}

export function ConnectAgentCard({
  variant = ConnectAgentVariant.Prominent,
  state,
  result,
  isCopied,
  onConnect,
  onCopyCommand
}: ConnectAgentCardProps) {
  const isBusy = state === 'connecting';

  return (
    <div className={`${css['Root']} ${css[variant]}`} data-test="connect-agent-card">
      <div className={css['Body']}>
        <h3 className={css['Title']}>Build it by describing it</h3>
        <p className={css['Text']}>
          Connect Claude Code and it can create a NodeGX project for you, then build the pages and
          logic while you watch. You don’t need to make a project first.
        </p>
      </div>

      {state === 'connected' && result ? (
        <div className={css['Success']} data-test="connect-agent-success">
          <p className={css['SuccessMessage']}>{result.message}</p>
          {/* ⚠️ Never behind a disclosure: we changed a global configuration on their behalf. */}
          <p className={css['Aside']}>
            Registered as <code className={css['Code']}>{result.serverName}</code> in{' '}
            <code className={css['Code']}>{result.configPath}</code>. To remove it, run{' '}
            <code className={css['Code']}>{result.removeCommand}</code>.
          </p>
        </div>
      ) : (
        <div className={css['Actions']}>
          <LauncherButton
            label={isBusy ? 'Connecting…' : 'Connect Claude Code'}
            isDisabled={isBusy}
            onClick={onConnect}
            testId="connect-agent-connect"
          />
          {result?.command && (
            <LauncherButton
              label={isCopied ? 'Copied' : 'Copy the command instead'}
              variant={LauncherButtonVariant.Ghost}
              onClick={onCopyCommand}
              testId="connect-agent-copy"
            />
          )}
        </div>
      )}

      {state === 'failed' && result && (
        <div className={css['Failure']} data-test="connect-agent-failure">
          <p className={css['FailureMessage']}>{result.message}</p>
          {result.detail && <p className={css['Aside']}>{result.detail}</p>}
          {/* The route out. A failure that leaves the user nowhere to go is the failure we set out
              to fix, one layer down. */}
          {result.command && <pre className={css['Command']}>{result.command}</pre>}
        </div>
      )}
    </div>
  );
}
