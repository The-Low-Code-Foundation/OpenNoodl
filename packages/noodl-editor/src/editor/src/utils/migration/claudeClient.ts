/**
 * Claude client for component migration.
 *
 * AIX-001: this now runs on the shared provider adapter rather than
 * constructing its own SDK client against a hardcoded model. The model id and
 * its pricing come from the central registry, so this feature stops rotting
 * independently of the rest of the editor's AI.
 *
 * @module migration/claudeClient
 */

import { createProvider } from '@noodl-models/AiAssistant/client/AiClient';
import { calculateCostUsd, getDefaultModel, resolveModel } from '@noodl-models/AiAssistant/client/models';
import { AiProvider } from '@noodl-models/AiAssistant/client/types';

import type { MigrationIssue } from '../../models/migration/types';
import { MIGRATION_SYSTEM_PROMPT, HELP_PROMPT_TEMPLATE } from './claudePrompts';

export interface AIPreferences {
  preferFunctional: boolean;
  preserveComments: boolean;
  verboseOutput: boolean;
}

export interface MigrationRequest {
  code: string;
  issues: MigrationIssue[];
  componentName: string;
  preferences: AIPreferences;
  previousAttempt?: {
    code: string | null;
    error: string;
  };
}

export interface MigrationResponse {
  success: boolean;
  code: string | null;
  changes: string[];
  warnings: string[];
  confidence: number;
  reason?: string;
  suggestion?: string;
  tokensUsed: {
    input: number;
    output: number;
  };
  cost: number;
}

export interface HelpRequest {
  originalCode: string;
  attempts: number;
  attemptHistory: Array<{
    code: string | null;
    error: string;
  }>;
}

export class ClaudeClient {
  private readonly provider: AiProvider;
  private readonly model: string;

  constructor(apiKey: string, model?: string) {
    this.provider = createProvider('anthropic', { apiKey });
    this.model = model || getDefaultModel('anthropic').id;
  }

  async migrateComponent(request: MigrationRequest): Promise<MigrationResponse> {
    const userPrompt = this.buildUserPrompt(request);

    const response = await this.provider.chat({
      model: this.model,
      maxTokens: 4096,
      messages: [
        { role: 'system', content: MIGRATION_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ]
    });

    const tokensUsed = {
      input: response.usage.promptTokens,
      output: response.usage.completionTokens
    };

    // The registry may not price a model the user pinned; report 0 rather than
    // letting a null propagate into the migration budget arithmetic.
    const cost = response.usage.costUsd ?? 0;

    try {
      const parsed = this.parseResponse(response.text);
      return {
        ...parsed,
        tokensUsed,
        cost
      };
    } catch (parseError) {
      return {
        success: false,
        code: null,
        changes: [],
        warnings: [],
        confidence: 0,
        reason: 'Failed to parse AI response',
        suggestion: response.text.slice(0, 500), // Include raw response for debugging
        tokensUsed,
        cost
      };
    }
  }

  async getHelp(request: HelpRequest): Promise<string> {
    const prompt = HELP_PROMPT_TEMPLATE.replace('{attempts}', String(request.attempts))
      .replace('{originalCode}', request.originalCode)
      .replace('{attemptHistory}', request.attemptHistory.map((a, i) => `Attempt ${i + 1}: ${a.error}`).join('\n'));

    const response = await this.provider.chat({
      model: this.model,
      maxTokens: 2048,
      messages: [{ role: 'user', content: prompt }]
    });

    return response.text;
  }

  private buildUserPrompt(request: MigrationRequest): string {
    let prompt = `Migrate this React component to React 19:\n\n`;
    prompt += `Component: ${request.componentName}\n\n`;
    prompt += `Issues detected:\n`;
    request.issues.forEach((issue) => {
      prompt += `- ${issue.type} at line ${issue.location.line}: ${issue.description}\n`;
    });
    prompt += `\nCode:\n\`\`\`javascript\n${request.code}\n\`\`\`\n`;

    if (request.preferences.preferFunctional) {
      prompt += `\nPreference: Convert to functional component with hooks if clean.\n`;
    }

    if (request.previousAttempt) {
      prompt += `\n--- RETRY ---\n`;
      prompt += `Previous attempt failed: ${request.previousAttempt.error}\n`;
      if (request.previousAttempt.code) {
        prompt += `Previous code:\n\`\`\`javascript\n${request.previousAttempt.code}\n\`\`\`\n`;
      }
      prompt += `Please try a different approach.\n`;
    }

    return prompt;
  }

  private parseResponse(text: string): Omit<MigrationResponse, 'tokensUsed' | 'cost'> {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      success: parsed.success ?? false,
      code: parsed.code ?? null,
      changes: parsed.changes ?? [],
      warnings: parsed.warnings ?? [],
      confidence: parsed.confidence ?? 0,
      reason: parsed.reason,
      suggestion: parsed.suggestion
    };
  }

  private calculateCost(tokens: { input: number; output: number }): number {
    return calculateCostUsd(resolveModel(this.model, 'anthropic'), tokens.input, tokens.output) ?? 0;
  }

  estimateCost(codeLength: number): number {
    // Rough estimation: ~4 chars per token
    const estimatedInputTokens = codeLength / 4 + 1000; // +1000 for system prompt
    const estimatedOutputTokens = (codeLength / 4) * 1.5; // Output usually larger

    return this.calculateCost({
      input: estimatedInputTokens,
      output: estimatedOutputTokens
    });
  }
}
