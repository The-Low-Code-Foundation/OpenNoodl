import path from 'node:path';
import { AiConfigStore } from '@noodl-store/AiAssistantStore';
import { filesystem } from '@noodl/platform';

import { AiClient } from '@noodl-models/AiAssistant/client/AiClient';
import { AiMessage, AiNotConfiguredError } from '@noodl-models/AiAssistant/client/types';
import { ProjectModel } from '@noodl-models/projectmodel';
import FileSystem from '@noodl-utils/filesystem';
import { guid } from '@noodl-utils/utils';

/**
 * Image generation is still OpenAI-only: it is not a chat completion, so it
 * does not go through the provider-agnostic client. It requires an OpenAI key
 * regardless of which provider is selected for chat, and says so rather than
 * failing with an opaque 401.
 */
export async function makeImageGenerationRequest(prompt: string): Promise<{ type: string; data: Buffer }> {
  const OPENAI_API_KEY = await AiConfigStore.getApiKey('openai');
  if (!OPENAI_API_KEY) {
    throw new AiNotConfiguredError(
      'Image generation needs an OpenAI API key. Add one under the OpenAI provider in Editor Settings.'
    );
  }

  const response = await fetch(`https://api.openai.com/v1/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + OPENAI_API_KEY
    },
    body: JSON.stringify({
      prompt,
      n: 1,
      size: '512x512',
      response_format: 'b64_json'
    })
  });

  const json = await response.json();

  if (json.error) {
    console.error(json.error);
    throw new Error(json.error);
  }

  const b64_json = json.data[0].b64_json;

  return { data: Buffer.from(b64_json, 'base64'), type: 'png' };
}

export async function saveImageDataToDisk(imageData: { type: string; data: Buffer }): Promise<string> {
  const projectFolder = ProjectModel.instance._retainedProjectDirectory;
  if (!projectFolder) throw new Error('Project has no folder');

  const filename = `image-${guid()}.${imageData.type}`;
  const folder = 'generated-images';
  const relativeFilePath = path.join(folder, filename);
  const absolutePath = path.join(projectFolder, relativeFilePath);

  await filesystem.makeDirectory(path.join(projectFolder, folder));
  await filesystem.writeFile(absolutePath, imageData.data);

  return relativeFilePath;
}

/**
 * Single-shot chat through the configured provider. Cost accounting and model
 * selection now live in the client, so callers pass messages and nothing else.
 */
export async function makeChatRequest(messages: AiMessage[]) {
  try {
    const response = await AiClient.chat({
      messages,
      temperature: 0.5,
      maxTokens: 2048
    });

    return {
      content: response.text,
      usage: response.usage
    };
  } catch (error) {
    console.error(error);
    return null;
  }
}
