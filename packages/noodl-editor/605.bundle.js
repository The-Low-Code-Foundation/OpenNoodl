"use strict";
(global["webpackChunknoodl_editor"] = global["webpackChunknoodl_editor"] || []).push([[605],{

/***/ 61605:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  AIMigrationOrchestrator: () => (/* binding */ AIMigrationOrchestrator)
});

;// ./src/editor/src/utils/migration/claudePrompts.ts
/**
 * Claude AI Prompts for React 19 Migration
 *
 * System prompts and templates for guiding Claude to migrate
 * React components from React 17 patterns to React 19.
 *
 * @module migration/claudePrompts
 */
const MIGRATION_SYSTEM_PROMPT = `You are a React migration assistant for OpenNoodl, a visual programming platform. Your job is to migrate React class components from React 17 patterns to React 19.

## Your Task
Convert the provided React code to be compatible with React 19. The code may contain:
- componentWillMount (removed in React 19)
- componentWillReceiveProps (removed in React 19)
- componentWillUpdate (removed in React 19)
- UNSAFE_ prefixed lifecycle methods (removed in React 19)
- String refs (removed in React 19)
- Legacy context API (removed in React 19)
- React.createFactory (removed in React 19)

## Migration Rules

### Lifecycle Methods
1. componentWillMount → Move logic to componentDidMount or constructor
2. componentWillReceiveProps → Use getDerivedStateFromProps (static) or componentDidUpdate
3. componentWillUpdate → Use getSnapshotBeforeUpdate + componentDidUpdate

### String Refs
Convert: ref="myRef" → ref={this.myRef = React.createRef()} or useRef()

### Legacy Context
Convert contextTypes/childContextTypes/getChildContext → React.createContext

### Functional Preference
If the component doesn't use complex state or many lifecycle methods, prefer converting to a functional component with hooks.

## Output Format
You MUST respond with a JSON object in this exact format:
{
  "success": true,
  "code": "// The migrated code here",
  "changes": [
    "Converted componentWillMount to useEffect",
    "Replaced string ref with useRef"
  ],
  "warnings": [
    "Verify the useEffect dependency array is correct"
  ],
  "confidence": 0.85
}

If you cannot migrate the code:
{
  "success": false,
  "code": null,
  "reason": "Explanation of why migration failed",
  "suggestion": "What the user could do manually",
  "confidence": 0
}

## Rules
1. PRESERVE all existing functionality exactly
2. PRESERVE all comments unless they reference removed APIs
3. ADD comments explaining non-obvious changes
4. DO NOT change prop names or component interfaces
5. DO NOT add new dependencies
6. If confidence < 0.7, explain why in warnings
7. Test the code mentally - would it work?

## Context
This code is from an OpenNoodl project. OpenNoodl uses a custom node system where React components are wrapped. The component may reference:
- this.props.noodlNode - Reference to the Noodl node instance
- this.forceUpdate() - Triggers re-render (still valid in React 19)
- this.setStyle() - Noodl method for styling
- this.getRef() - Noodl method for DOM access`;
const RETRY_PROMPT_TEMPLATE = (/* unused pure expression or super */ null && (`The previous migration attempt failed verification.

Previous attempt result:
{previousError}

Previous code:
\`\`\`javascript
{previousCode}
\`\`\`

Please try a different approach. Consider:
1. Maybe the conversion should stay as a class component instead of functional
2. Check if state management is correct
3. Verify event handlers are bound correctly
4. Ensure refs are used correctly

Provide a new migration with the same JSON format.`));
const HELP_PROMPT_TEMPLATE = `I attempted to migrate this React component {attempts} times but couldn't produce working code.

Original code:
\`\`\`javascript
{originalCode}
\`\`\`

Attempts and errors:
{attemptHistory}

Please analyze this component and provide:
1. Why it's difficult to migrate automatically
2. Step-by-step manual migration instructions
3. Any gotchas or things to watch out for
4. Example code snippets for the tricky parts

Format your response as helpful documentation, not JSON.`;

;// ./src/editor/src/utils/migration/claudeClient.ts
/**
 * Claude API Client for Component Migration
 *
 * Handles communication with Anthropic's Claude API for
 * AI-assisted React component migration.
 *
 * @module migration/claudeClient
 */

class ClaudeClient {
    constructor(apiKey) {
        this.model = 'claude-sonnet-4-20250514';
        // Pricing per 1M tokens (as of Dec 2024)
        this.pricing = {
            input: 3.0, // $3 per 1M input tokens
            output: 15.0 // $15 per 1M output tokens
        };
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Anthropic = __webpack_require__(63065);
        this.client = new Anthropic({
            apiKey,
            dangerouslyAllowBrowser: true // Safe in Electron - code runs locally, not in public browser
        });
    }
    async migrateComponent(request) {
        const userPrompt = this.buildUserPrompt(request);
        const response = await this.client.messages.create({
            model: this.model,
            max_tokens: 4096,
            system: MIGRATION_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userPrompt }]
        });
        const tokensUsed = {
            input: response.usage.input_tokens,
            output: response.usage.output_tokens
        };
        const cost = this.calculateCost(tokensUsed);
        // Parse the response
        const content = response.content[0];
        if (content.type !== 'text') {
            throw new Error('Unexpected response type');
        }
        try {
            const parsed = this.parseResponse(content.text);
            return {
                ...parsed,
                tokensUsed,
                cost
            };
        }
        catch (parseError) {
            return {
                success: false,
                code: null,
                changes: [],
                warnings: [],
                confidence: 0,
                reason: 'Failed to parse AI response',
                suggestion: content.text.slice(0, 500), // Include raw response for debugging
                tokensUsed,
                cost
            };
        }
    }
    async getHelp(request) {
        const prompt = HELP_PROMPT_TEMPLATE.replace('{attempts}', String(request.attempts))
            .replace('{originalCode}', request.originalCode)
            .replace('{attemptHistory}', request.attemptHistory.map((a, i) => `Attempt ${i + 1}: ${a.error}`).join('\n'));
        const response = await this.client.messages.create({
            model: this.model,
            max_tokens: 2048,
            messages: [{ role: 'user', content: prompt }]
        });
        const content = response.content[0];
        if (content.type !== 'text') {
            throw new Error('Unexpected response type');
        }
        return content.text;
    }
    buildUserPrompt(request) {
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
    parseResponse(text) {
        var _a, _b, _c, _d, _e;
        // Try to extract JSON from the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON found in response');
        }
        const parsed = JSON.parse(jsonMatch[0]);
        return {
            success: (_a = parsed.success) !== null && _a !== void 0 ? _a : false,
            code: (_b = parsed.code) !== null && _b !== void 0 ? _b : null,
            changes: (_c = parsed.changes) !== null && _c !== void 0 ? _c : [],
            warnings: (_d = parsed.warnings) !== null && _d !== void 0 ? _d : [],
            confidence: (_e = parsed.confidence) !== null && _e !== void 0 ? _e : 0,
            reason: parsed.reason,
            suggestion: parsed.suggestion
        };
    }
    calculateCost(tokens) {
        const inputCost = (tokens.input / 1000000) * this.pricing.input;
        const outputCost = (tokens.output / 1000000) * this.pricing.output;
        return inputCost + outputCost;
    }
    estimateCost(codeLength) {
        // Rough estimation: ~4 chars per token
        const estimatedInputTokens = codeLength / 4 + 1000; // +1000 for system prompt
        const estimatedOutputTokens = (codeLength / 4) * 1.5; // Output usually larger
        return this.calculateCost({
            input: estimatedInputTokens,
            output: estimatedOutputTokens
        });
    }
}

;// ./src/editor/src/models/migration/BudgetController.ts
/**
 * Budget Controller for AI Migration
 *
 * Manages spending limits and approval flow for AI-assisted migrations.
 * Enforces hard limits and pause-and-approve at configurable increments.
 *
 * @module migration/BudgetController
 */
class BudgetController {
    constructor(config, onPauseRequired) {
        this.state = {
            maxPerSession: config.maxPerSession,
            spent: 0,
            pauseIncrement: config.pauseIncrement,
            nextPauseAt: config.pauseIncrement,
            paused: false
        };
        this.onPauseRequired = onPauseRequired;
    }
    checkBudget(estimatedCost) {
        const wouldExceedMax = this.state.spent + estimatedCost > this.state.maxPerSession;
        const wouldExceedPause = this.state.spent + estimatedCost > this.state.nextPauseAt;
        return {
            allowed: !wouldExceedMax,
            requiresApproval: wouldExceedPause && !this.state.paused,
            currentSpent: this.state.spent,
            estimatedNext: estimatedCost,
            wouldExceedMax
        };
    }
    async requestApproval(estimatedCost) {
        const check = this.checkBudget(estimatedCost);
        if (check.wouldExceedMax) {
            return false; // Hard limit, can't approve
        }
        if (check.requiresApproval) {
            const approved = await this.onPauseRequired(this.state);
            if (approved) {
                this.state.nextPauseAt += this.state.pauseIncrement;
            }
            return approved;
        }
        return true;
    }
    recordSpend(amount) {
        this.state.spent += amount;
    }
    getState() {
        return { ...this.state };
    }
    getRemainingBudget() {
        return Math.max(0, this.state.maxPerSession - this.state.spent);
    }
}

;// ./src/editor/src/models/migration/AIMigrationOrchestrator.ts
/**
 * AI Migration Orchestrator
 *
 * Coordinates AI-assisted migration of multiple components with
 * retry logic, verification, and user decision points.
 *
 * @module migration/AIMigrationOrchestrator
 */


class AIMigrationOrchestrator {
    constructor(apiKey, budgetConfig, config, onBudgetPause) {
        this.aborted = false;
        this.client = new ClaudeClient(apiKey);
        this.budget = new BudgetController(budgetConfig, onBudgetPause);
        this.config = config;
    }
    async migrateComponent(component, code, preferences, onProgress, onDecisionRequired) {
        let attempts = 0;
        let totalCost = 0;
        let lastError = null;
        let lastCode = null;
        const attemptHistory = [];
        while (attempts < this.config.maxRetries && !this.aborted) {
            attempts++;
            // Check budget
            const estimatedCost = this.client.estimateCost(code.length);
            const budgetCheck = this.budget.checkBudget(estimatedCost);
            if (!budgetCheck.allowed) {
                return {
                    componentId: component.id,
                    componentName: component.name,
                    status: 'failed',
                    changes: [],
                    warnings: [],
                    attempts,
                    totalCost,
                    error: 'Budget exceeded'
                };
            }
            if (budgetCheck.requiresApproval) {
                const approved = await this.budget.requestApproval(estimatedCost);
                if (!approved) {
                    return {
                        componentId: component.id,
                        componentName: component.name,
                        status: 'skipped',
                        changes: [],
                        warnings: ['Migration paused by user'],
                        attempts,
                        totalCost
                    };
                }
            }
            // Attempt migration
            onProgress({
                phase: 'ai-migrating',
                component: component.name,
                attempt: attempts,
                message: attempts === 1 ? 'Analyzing code patterns...' : `Retry attempt ${attempts}...`
            });
            const response = await this.client.migrateComponent({
                code,
                issues: component.issues,
                componentName: component.name,
                preferences,
                previousAttempt: lastError ? { code: lastCode, error: lastError } : undefined
            });
            totalCost += response.cost;
            this.budget.recordSpend(response.cost);
            if (response.success && response.confidence >= this.config.minConfidence) {
                // Verify the migration if enabled
                if (this.config.verifyMigration && response.code) {
                    const verification = await this.verifyMigration(response.code, component);
                    if (!verification.valid) {
                        lastError = verification.error || 'Verification failed';
                        lastCode = response.code;
                        attemptHistory.push({
                            code: response.code,
                            error: lastError,
                            cost: response.cost
                        });
                        continue;
                    }
                }
                return {
                    componentId: component.id,
                    componentName: component.name,
                    status: 'success',
                    migratedCode: response.code,
                    changes: response.changes,
                    warnings: response.warnings,
                    attempts,
                    totalCost
                };
            }
            // Migration failed or low confidence
            lastError = response.reason || 'Low confidence migration';
            lastCode = response.code;
            attemptHistory.push({
                code: response.code,
                error: lastError,
                cost: response.cost
            });
        }
        // All retries exhausted - ask user what to do
        const decision = await onDecisionRequired({
            componentId: component.id,
            componentName: component.name,
            attempts,
            attemptHistory,
            costSpent: totalCost,
            retryCost: this.client.estimateCost(code.length)
        });
        switch (decision.action) {
            case 'retry':
                // Recursive retry with fresh attempts
                return this.migrateComponent(component, code, preferences, onProgress, onDecisionRequired);
            case 'skip':
                return {
                    componentId: component.id,
                    componentName: component.name,
                    status: 'skipped',
                    changes: [],
                    warnings: ['Skipped by user after failed attempts'],
                    attempts,
                    totalCost
                };
            case 'getHelp': {
                const help = await this.client.getHelp({
                    originalCode: code,
                    attempts,
                    attemptHistory
                });
                totalCost += 0.02; // Approximate cost for help request
                return {
                    componentId: component.id,
                    componentName: component.name,
                    status: 'failed',
                    changes: [],
                    warnings: attemptHistory.map((a) => a.error),
                    attempts,
                    totalCost,
                    aiSuggestion: help
                };
            }
            case 'manual':
                return {
                    componentId: component.id,
                    componentName: component.name,
                    status: 'partial',
                    migratedCode: lastCode || undefined,
                    changes: [],
                    warnings: ['Marked for manual review'],
                    attempts,
                    totalCost
                };
        }
    }
    async verifyMigration(code, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    component) {
        // Basic syntax check using Babel
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const babel = __webpack_require__(46773);
            babel.parse(code, {
                sourceType: 'module',
                plugins: ['jsx', 'typescript']
            });
        }
        catch (syntaxError) {
            const err = syntaxError;
            return {
                valid: false,
                error: `Syntax error: ${err.message || 'Unknown syntax error'}`
            };
        }
        // Check that no forbidden patterns remain
        const forbiddenPatterns = [
            { regex: /componentWillMount\s*\(/, name: 'componentWillMount' },
            { regex: /componentWillReceiveProps\s*\(/, name: 'componentWillReceiveProps' },
            { regex: /componentWillUpdate\s*\(/, name: 'componentWillUpdate' },
            { regex: /ref\s*=\s*["'][^"']+["']/, name: 'string ref' },
            { regex: /contextTypes\s*=/, name: 'legacy contextTypes' }
        ];
        for (const pattern of forbiddenPatterns) {
            if (pattern.regex.test(code)) {
                return {
                    valid: false,
                    error: `Code still contains ${pattern.name}`
                };
            }
        }
        return { valid: true };
    }
    abort() {
        this.aborted = true;
    }
    getBudgetState() {
        return this.budget.getState();
    }
}


/***/ })

}]);
//# sourceMappingURL=605.bundle.js.map