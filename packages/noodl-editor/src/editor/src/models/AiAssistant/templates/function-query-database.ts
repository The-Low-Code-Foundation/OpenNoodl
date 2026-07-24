import { AiClient } from '@noodl-models/AiAssistant/client/AiClient';
import { extractDatabaseSchema } from '@noodl-models/AiAssistant/DatabaseSchemaExtractor';
import { AiNodeTemplate } from '@noodl-models/AiAssistant/interfaces';
// AIX-001: both aliases used to import the gpt-4 module, so picking the
// simpler prompt silently ran the richer one. They are now distinct, and the
// choice is made on model capability rather than a hardcoded model id.
import * as QueryAgentVersion from '@noodl-models/AiAssistant/templates/function-query-database/gpt-4-version';
import * as QuerySimpleVersion from '@noodl-models/AiAssistant/templates/function-query-database/gpt-3-version';

export const template: AiNodeTemplate = {
  type: 'green',
  name: 'JavaScriptFunction',
  nodeDisplayName: 'Read Database',
  onMessage: async (context) => {
    const useAgentFlow = AiClient.supportsAgentFlow();

    const activityId = 'processing';
    const activityCodeGenId = 'code-generation';

    context.chatHistory.addActivity({
      id: activityId,
      name: 'Processing'
    });

    context.chatHistory.addActivity({
      id: activityCodeGenId,
      name: 'Generating code...'
    });

    // ---
    // Database
    const dbCollectionsSource = await extractDatabaseSchema();
    console.log('database schema', dbCollectionsSource);

    // ---
    console.log('[ai] query template, agent flow:', useAgentFlow);

    if (useAgentFlow) {
      await QueryAgentVersion.execute(context, dbCollectionsSource);
    } else {
      await QuerySimpleVersion.execute(context, dbCollectionsSource);
    }

    context.chatHistory.removeActivity(activityCodeGenId);
    context.chatHistory.removeActivity(activityId);
  }
};
