import React, { useCallback, useEffect, useState } from 'react';

import { ProjectModel } from '@noodl-models/projectmodel';
import getDocsEndpoint from '@noodl-utils/getDocsEndpoint';
import { ipcInvoke } from '@noodl-utils/ipc';
import { platform } from '@noodl/platform';

import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { CollapsableSection } from '@noodl-core-ui/components/sidebar/CollapsableSection';
import { Text, TextSize } from '@noodl-core-ui/components/typography/Text';
import { Title, TitleSize } from '@noodl-core-ui/components/typography/Title';

import css from './McpSettingsSection.module.scss';
import { buildMcpCommands, McpCommandRow, McpFrontDoor } from './mcpCommands';

/**
 * MCP-001 — "Connect an AI agent": the front door.
 *
 * Reported as *"I don't see where to start the MCP server, get its URL and copy paste the terminal
 * command"*. The answer to the first two thirds of that is that **there is nothing to start and
 * there is no URL** — both servers are stdio processes the MCP client spawns itself — so this
 * section's whole job is the third: two commands with the absolute paths already substituted, and
 * an honest reason whenever one of them cannot be built.
 *
 * The strings are built by `mcpCommands.ts`, which is React-free and unit-tested, for the reason
 * `ExecutionDetail/fixRequest.ts` gives: what the copied text says is the deliverable.
 *
 * ⚠️ **Everything here can go stale, and the panel does not remount.** Sidebar panels are
 * hidden-not-unmounted, so a user who runs `npm run build:sidecars` or opens a different project
 * with Settings already open would otherwise keep looking at an answer from an earlier moment.
 * Two things stop that being silent: the path each command was built from is printed under it, and
 * **Check again** re-asks the main process.
 */
export function McpSettingsSection() {
  const [frontDoor, setFrontDoor] = useState<McpFrontDoor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [docsUrl, setDocsUrl] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setError(null);
    // Read the directory at ask-time, never at mount-time: this is what makes "Check again"
    // answer for the project that is open now.
    const projectDir = ProjectModel.instance?._retainedProjectDirectory ?? null;
    ipcInvoke<McpFrontDoor>('mcp:front-door', projectDir)
      .then(setFrontDoor)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(refresh, [refresh]);

  useEffect(() => {
    let cancelled = false;
    probeDocsPage().then((url) => {
      if (!cancelled) setDocsUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!copiedId) return;
    const timer = setTimeout(() => setCopiedId(null), 3000);
    return () => clearTimeout(timer);
  }, [copiedId]);

  const rows = frontDoor ? buildMcpCommands(frontDoor) : [];

  return (
    <CollapsableSection title="Connect an AI agent">
      <Box hasXSpacing hasBottomSpacing={4}>
        <Text size={TextSize.Medium} hasBottomSpacing>
          There is no server to start and no URL to copy. Both of these are programs your AI agent
          runs by itself — you only have to tell it where they are, which is what these commands do.
        </Text>
        <Text size={TextSize.Medium} hasBottomSpacing>
          Create the project here in NodeGX first, then point the agent at it. The authoring server
          works inside a project that already exists; it will not make you one.
        </Text>

        {error && (
          <div className={css.Unavailable}>
            Could not ask the app where the servers are: {error}
          </div>
        )}

        {rows.map((row) => (
          <McpServerRow
            key={row.id}
            row={row}
            isCopied={copiedId === row.id}
            onCopy={() => {
              if (!row.command) return;
              // A real click handler, deliberately: `navigator.clipboard.writeText` needs a user
              // gesture and a focused document, which is why the ExecutionDetail button works.
              navigator.clipboard.writeText(row.command).then(() => setCopiedId(row.id));
            }}
          />
        ))}

        {frontDoor?.project && (
          <p className={css.Provenance}>
            Built for the project at <strong>{frontDoor.project.dir}</strong>. Open a different
            project, or build the servers, and this section will be out of date until you check
            again.
          </p>
        )}

        <PrimaryButton
          variant={PrimaryButtonVariant.Ghost}
          size={PrimaryButtonSize.Small}
          label="Check again"
          onClick={refresh}
        />

        {docsUrl && (
          <Box hasTopSpacing={2}>
            <PrimaryButton
              variant={PrimaryButtonVariant.Ghost}
              size={PrimaryButtonSize.Small}
              label="How this works"
              onClick={() => platform.openExternal(docsUrl)}
            />
          </Box>
        )}
      </Box>
    </CollapsableSection>
  );
}

function McpServerRow({
  row,
  isCopied,
  onCopy
}: {
  row: McpCommandRow;
  isCopied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className={css.Server}>
      <Title size={TitleSize.Small} hasBottomSpacing>
        {row.title}
      </Title>
      <Text size={TextSize.Small} hasBottomSpacing>
        {row.caption}
      </Text>

      {row.command ? (
        <>
          <pre className={css.Command}>{row.command}</pre>
          <PrimaryButton
            size={PrimaryButtonSize.Small}
            isGrowing
            label={isCopied ? 'Copied — paste it in a terminal' : 'Copy the command'}
            onClick={onCopy}
          />
          <p className={css.Provenance}>
            Registers it as <strong>{row.serverName}</strong> for your user account, so it works
            from any directory.
          </p>
        </>
      ) : (
        <div className={css.Unavailable}>
          {row.unavailable}
          {row.probed && (
            <ul className={css.ProbedList}>
              {row.probed.map((path) => (
                <li key={path}>{path}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The docs page, **only if it is actually there**.
 *
 * MCP-004's page is a change to a different repository (the docs origin is a GitHub Pages CDN this
 * repo does not control), so at the moment this shipped the URL 404s. A link that 404s is worse
 * than no link — and hard-coding one that we then have to remember to switch on is exactly the
 * kind of promise that goes stale. So the link is rendered only when the page answers, which means
 * it turns itself on the day the docs are published, with no editor release.
 *
 * One probe per editor session (GitHub Pages caches for ten minutes anyway), and a network failure
 * is indistinguishable from "not published" on purpose: both mean "do not offer a link".
 */
const MCP_DOCS_PATH = 'docs/getting-started/ai-assisted-dev/mcp/';

let docsProbe: Promise<string | null> | null = null;

function probeDocsPage(): Promise<string | null> {
  if (!docsProbe) {
    const url = `${getDocsEndpoint()}/${MCP_DOCS_PATH}`;
    docsProbe = fetch(url, { method: 'HEAD' })
      .then((response) => (response.ok ? url : null))
      .catch(() => null);
  }
  return docsProbe;
}
