import { NOTATION_RULES } from '@noodl-core-ui/components/code-editor';

import { AiClient } from '@noodl-models/AiAssistant/client/AiClient';
import { AiNodeTemplate } from '@noodl-models/AiAssistant/interfaces';
// The historical gpt-3/gpt-4 filenames are kept so the prompt history stays
// diffable; what they mean now is "single-shot" and "multi-step agent", which
// is what the capability flag selects between.
import * as SimpleVersion from '@noodl-models/AiAssistant/templates/function/gpt-3-version';
import * as AgentVersion from '@noodl-models/AiAssistant/templates/function/gpt-4-version';

import { ToastLayer } from '../../../views/ToastLayer/ToastLayer';

export const template: AiNodeTemplate = {
  type: 'pink',
  name: 'JavaScriptFunction',
  onMessage: async (context) => {
    const useAgentFlow = AiClient.supportsAgentFlow();

    const activityId = 'processing';

    context.chatHistory.addActivity({
      id: activityId,
      name: 'Processing'
    });

    // ---
    console.log('[ai] function template, agent flow:', useAgentFlow);

    try {
      if (useAgentFlow) {
        await AgentVersion.execute(context);
      } else {
        await SimpleVersion.execute(context);
      }

      context.chatHistory.removeActivity(activityId);
    } catch (error) {
      ToastLayer.showError(error);
      context.chatHistory.clearActivities();
    }
  }
};

/**
 * The notation rules every function prompt states, in the notation the runtime
 * actually mines.
 *
 * ⚠️ FUN-001 F4, measured 2026-08-12. Every one of these prompts used to open
 * with *"Inputs follow `Inputs[InputName]` format"* — unquoted brackets, which
 * match **none** of `JavascriptNodeParser`'s six patterns
 * (`javascriptnodeparser.js:294-387`). A model that obeyed the rule literally
 * wrote a function whose ports never came into existence, and the prompt's own
 * worked example contradicted it by using `Inputs.City`. The bracket form the
 * runtime does mine is quoted: `Inputs["Input Name"]`.
 *
 * The one-line rule comes from `notation.ts`, so the sentence the AI reads and
 * the sentence the editor shows a beginner cannot drift apart.
 */
const FUNCTION_NOTATION_RULES = `${NOTATION_RULES.function}

Inputs are read-only. Use Inputs.Name where the name is a plain identifier, and Inputs["My Name"] — with quotes — where it is not.

Outputs are written as "Outputs.Name = value", and variables don't store outputs.

Signals are sent by calling "Outputs.SignalName()" without passing values. A signal name containing an underscore must be called as Outputs["Signal_Name"](), or it becomes a value port instead of a signal.

Never write "Noodl.Inputs" or "Noodl.Outputs". They are a legacy alias that still works, and we do not write new code with them.

Mentioning a name is what creates the port, so only name ports you mean to exist — including in comments, which are read the same way.

For a default, read the input with an OR: const city = Inputs.City || 'Malmö'.`;

export const FUNCTION_CODE_CONTEXT = `###Instructions###
You are writing Noodl Javascript functions with the following rules:
${FUNCTION_NOTATION_RULES}

Call "Success" or "Failure" output signals accordingly.

Inputs and outputs can have human-readable string names. 

Do not explain each input and output outside the code block.

Functions can use resources from a CDN and access APIs with "fetch." For API handling, make API keys inputs, throw an error for invalid keys, add queries as inputs, and send primitive values to outputs.

Write helpful comments in the code block, so anyone can understand the code.

###Example###
\`\`\`javascript
const city = Inputs.City || 'Malmö';
if (!city) return;

const apiKey = Inputs.ApiKey || '';
if (!apiKey) throw new Error('Invalid API key');
const url = \`https://api.openweathermap.org/data/2.5/weather?q=\${city}&appid=\${apiKey}\`;

try {
  const response = await fetch(url);
  const data = await response.json();
  Outputs.Temperature = data.main.temp;
  Outputs.Success();
} catch (error) {
  Outputs.error = error;
  Outputs.Failure();
}
\`\`\`

###Task###
ONLY respond with javascript code following the instructions and starting and ending with \`\`\`
`;

export const FUNCTION_CODE_CONTEXT_EDIT = `###Instructions###
You are writing Noodl Javascript functions with the following rules:
${FUNCTION_NOTATION_RULES}

Call "Success" or "Failure" output signals accordingly.

Inputs and outputs can have human-readable string names. 

Do not explain each input and output outside the code block.

Functions can use resources from a CDN and access APIs with "fetch." For API handling, make API keys inputs, throw an error for invalid keys, add queries as inputs, and send primitive values to outputs.

Write helpful comments in the code block, so anyone can understand the code.

We are starting from this code and will only modify it:
\`\`\`
%{code}%
\`\`\`

###Task###
ONLY respond with javascript code following the instructions and starting and ending with \`\`\`
`;

export const FUNCTION_CODE_EXPLAIN = (enableSuggestions: boolean) => {
  return `###Context###
- This function is a Function node in Noodl.
- We are currently inside a Component with this node created, the node have the function inside.
- All the variables from the Inputs object is defined on the node as inputs which can be set via the properties on input connection.
- All the variables on the Outputs object is defined on the node as outputs which can be connected to another node.
- Do not show code blocks.

###Instructions###
Analyse the function and create an explanation${
    enableSuggestions ? ' and a maximum of 3 follow-up questions related to the code' : ''
  }.

###Explanation###
Explain with 2-5 sentences what the function does.
- Always include the property names of the Inputs and Outputs objects.
- Always format the property names of the Inputs like this: <Input>input name</Input>
- Always format the property names of the Outputs like this: <Output>output name</Output>

###Label###
Create a label that summarises what the function does.

###Example###
<label>Data To Excel</label>
<explain>
This function converts a JSON data array to an Excel file and initiates a download.

It takes <Input>Data</Input> and <Input>FileName</Input> as inputs, creates a new workbook and worksheet using the XLSX library, converts the JSON data to a sheet, and appends the sheet to the workbook.

It then converts the workbook to a binary string, creates a Blob, and generates a download link. Finally, it triggers the <Output>Success</Output> output signal after the download is initiated.

If the request is successful, it triggers the Outputs.Success output signal.

If there's an error, it sets the Outputs.error output and triggers the Outputs.Failure output signal.
</explain>
${
  enableSuggestions
    ? `<question>What is the format of the required JSON data array?</question>
<question>How do I connect this node to other nodes in my Noodl project?</question>
<question>Are there any limitations or required libraries for this function to work properly?</question>`
    : ''
}

###Task###
Respond only with this specific format, and nothing else:
<label>The label</label>
<explain>
Markdown text.
</explain>
${enableSuggestions ? '<question>Maximum of 3 follow-up questions</question>' : ''}`;
};

export const FUNCTION_CODE_EXPLAIN_PROMPT = (question: string, answer: string, code: string) => {
  return `I got this information with the code, is there something important here that I should think about? Include this in the <explain> element, starting with a new paragraph.

user: ""${question}""
assistant: ""
${answer}
""

###Current code###
\`\`\`
${code}
\`\`\`
`;
};

export const FUNCTION_CODE_QUESTION = () => {
  return `###Context###
- This function is a Function node in Noodl.
- We are currently inside a Component with this node created, the node have the function inside.
- All the variables from the Inputs object is defined on the node as inputs which can be set via the properties on input connection.
- All the variables on the Outputs object is defined on the node as outputs which can be connected to another node.

###Current code###
\`\`\`
%{code}%
\`\`\`
`;
};
