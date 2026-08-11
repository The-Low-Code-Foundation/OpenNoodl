/**
 * AIX-006 — Style vocabulary tools for external agents (SUB-010's path).
 *
 * `get_style_vocabulary` is the style twin of the catalog tools: it enumerates
 * the project's design tokens (by category) and the legal variants/sizes per
 * element, so an external agent styles on-system exactly like the in-editor
 * loop. `set_project_tokens` and `set_style_preset` are write tools (gated on
 * --allow-writes) that persist token overrides into
 * `nodegx.project.json → metadata.designTokens`, which the editor reads back
 * verbatim.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import {
  buildEffectiveTokens,
  buildStyleVocabulary,
  getPreset,
  listVocabularyPresets,
  readStoredTokens,
  renderStyleVocabulary,
  type StyleTokenRecord,
  type StyleTokensData,
  type TokenCategory
} from '../editor-deps';
import { ToolError } from '../errors';
import type { ProjectStore } from '../project/ProjectStore';
import { guarded, jsonResult } from './util';

const TOKEN_METADATA_KEY = 'designTokens';
const TOKEN_VERSION = 1;

/** Infer a token category from its name prefix — only affects panel grouping. */
function inferCategory(name: string): TokenCategory {
  if (name.startsWith('--space')) return 'spacing';
  if (name.startsWith('--text')) return 'typography-size';
  if (name.startsWith('--font')) return 'typography-weight';
  if (name.startsWith('--radius')) return 'border-radius';
  if (name.startsWith('--border')) return 'border-width';
  if (name.startsWith('--shadow')) return 'shadow';
  return 'color-semantic';
}

/** Merge token overrides into the stored custom-token block and persist. */
function upsertTokens(store: ProjectStore, entries: Array<{ name: string; value: string }>): StyleTokenRecord[] {
  for (const e of entries) {
    if (!e.name.startsWith('--')) {
      throw new ToolError(
        'invalid-argument',
        `Token name "${e.name}" must be a CSS custom property beginning with "--" (e.g. "--primary"). ` +
          'Reference it in a node parameter as "var(--primary)".'
      );
    }
    if (!e.value || !e.value.trim()) {
      throw new ToolError('invalid-argument', `Token "${e.name}" has an empty value.`);
    }
  }

  const source = store.designTokenMetaSource();
  const effective = buildEffectiveTokens(readStoredTokens(source));
  const stored = readStoredTokens(source);
  const byName = new Map<string, StyleTokenRecord>((stored?.customTokens ?? []).map((t) => [t.name, t]));

  for (const e of entries) {
    const base = effective.get(e.name);
    byName.set(e.name, {
      name: e.name,
      value: e.value,
      category: base?.category ?? inferCategory(e.name),
      isCustom: true,
      ...(base?.description ? { description: base.description } : {})
    });
  }

  const customTokens = [...byName.values()];
  const data: StyleTokensData = { version: TOKEN_VERSION, customTokens };
  store.writeDesignTokens(TOKEN_METADATA_KEY, data);
  return customTokens;
}

/** Always-registered read tool. */
export function registerStyleReadTools(server: McpServer, store: ProjectStore): void {
  server.registerTool(
    'get_style_vocabulary',
    {
      title: 'Get style vocabulary',
      description:
        "This project's design system: design tokens by category (semantic colours, spacing, typography, " +
        'radius, borders, shadows), the legal variants/sizes per element type, and the named COMPOSITIONS — ' +
        'ready-made parameter sets for a card, a shell, a section head, the buttons and the type ramp, each ' +
        'naming the recipe that shows it assembled. Reference a token in a node ' +
        'parameter as "var(--token-name)" (never a raw hex or px). Set detail: "prompt" for the compact ' +
        'prompt-shaped block, or "full" (default) for the structured JSON. Built-in presets are listed too.',
      inputSchema: {
        detail: z.enum(['full', 'prompt']).optional().describe('full = structured JSON (default); prompt = compact text block')
      }
    },
    guarded((args: { detail?: 'full' | 'prompt' }) => {
      const vocab = buildStyleVocabulary(store.designTokenMetaSource());
      if (args.detail === 'prompt') {
        return jsonResult({ vocabulary: renderStyleVocabulary(vocab) });
      }
      return jsonResult(vocab);
    })
  );
}

/** Write tools — only when --allow-writes. */
export function registerStyleWriteTools(server: McpServer, store: ProjectStore): void {
  server.registerTool(
    'set_project_tokens',
    {
      title: 'Set project design tokens',
      description:
        'Override design token values for this project (e.g. change --primary to a brand colour). Only the ' +
        'overrides are stored; unlisted tokens keep their defaults. Token names must be CSS custom properties ' +
        '("--primary"). A value may be a literal ("#7c3aed", "12px") or a reference to another token ' +
        '("var(--blue-600)"). Nodes reference the token by name as "var(--primary)".',
      inputSchema: {
        tokens: z
          .array(z.object({ name: z.string(), value: z.string() }))
          .min(1)
          .describe('Token overrides, e.g. [{ "name": "--primary", "value": "#7c3aed" }]')
      }
    },
    guarded((args: { tokens: Array<{ name: string; value: string }> }) => {
      const customTokens = upsertTokens(store, args.tokens);
      return jsonResult({
        ok: true,
        updated: args.tokens.map((t) => t.name),
        customTokenCount: customTokens.length
      });
    })
  );

  server.registerTool(
    'set_style_preset',
    {
      title: 'Apply a style preset',
      description:
        'Adopt a built-in style preset for this project — a curated set of token overrides that gives a ' +
        'coherent look from the start. Applied as token overrides on top of the defaults (like ' +
        'set_project_tokens). List available presets via get_style_vocabulary (presets field).',
      inputSchema: {
        preset_id: z
          .string()
          .describe(`One of: ${listVocabularyPresets().map((p) => p.id).join(', ')}`)
      }
    },
    guarded((args: { preset_id: string }) => {
      const preset = getPreset(args.preset_id);
      if (!preset) {
        throw new ToolError('not-found', `No style preset "${args.preset_id}".`, {
          availablePresets: listVocabularyPresets().map((p) => p.id)
        });
      }
      const entries = Object.entries(preset.tokens).map(([name, value]) => ({ name, value }));
      // Modern = the defaults, so its override map is empty; clear overrides to
      // return to defaults rather than write an empty block.
      if (entries.length === 0) {
        store.writeDesignTokens(TOKEN_METADATA_KEY, null);
        return jsonResult({ ok: true, preset: preset.id, customTokenCount: 0 });
      }
      const customTokens = upsertTokens(store, entries);
      return jsonResult({ ok: true, preset: preset.id, updated: entries.map((e) => e.name), customTokenCount: customTokens.length });
    })
  );
}
