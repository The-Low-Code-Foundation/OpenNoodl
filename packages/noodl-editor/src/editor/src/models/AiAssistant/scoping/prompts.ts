/**
 * AIX-012 — the scoping conversation's prompts.
 *
 * This is the one part of phase 15 that is *not* an authoring turn, and it is
 * shaped accordingly. Every other session here is one bounded request with one
 * submission and a validation gate; this one is a dialogue with a person who
 * has not decided yet, and its success condition is a scope both parties agree
 * on — which sometimes means agreeing to *less* than was asked for.
 *
 * The single tool, `record_scope`, is deliberately the only channel out. Its
 * schema has no field that can hold a node, a connection, a port or a
 * parameter, so "do not build during this phase" is enforced by the shape of
 * what the model is able to say rather than by a sentence it is asked to obey.
 * The prompt states the rule too, because a model that understands why it
 * cannot build gives better answers than one that keeps trying — but the prompt
 * is the explanation, not the enforcement.
 *
 * @module AiAssistant/scoping/prompts
 */

import type { AiToolDefinition } from '../client/types';

export const RECORD_SCOPE = 'record_scope';

export const SCOPING_TOOLS: AiToolDefinition[] = [
  {
    name: RECORD_SCOPE,
    description:
      'Record the scope agreed so far. Call this after every exchange that settles something — the user can ' +
      'end the conversation at any moment and whatever is recorded here is what their project gets. Each ' +
      'field you supply REPLACES the previous value for that field; fields you omit are left untouched.',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'One or two sentences: what this app is. Only once the user has confirmed it.'
        },
        audience: {
          type: 'string',
          description:
            'Who actually opens this and what they are trying to get done. Record it the moment they tell ' +
            'you, including in passing ("about twelve of us, all on our phones") — it is rarely said twice.'
        },
        objects: {
          type: 'array',
          description: 'The things this app stores. Singular names, as a person would say them.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Singular: "Book", not "books_table"' },
              purpose: { type: 'string', description: 'What one of these represents' },
              fields: {
                type: 'array',
                description: 'Field descriptions in prose, e.g. "finished (yes/no)"',
                items: { type: 'string' }
              },
              relationships: {
                type: 'array',
                description: 'e.g. "belongs to one Shelf"',
                items: { type: 'string' }
              }
            },
            required: ['name']
          }
        },
        pages: {
          type: 'array',
          description: 'The pages agreed. Keep this list as short as the app honestly needs.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Display name, e.g. "Library"' },
              purpose: {
                type: 'string',
                description:
                  'What this page is authoritative for — say where a record is created and where it is only shown.'
              }
            },
            required: ['name', 'purpose']
          }
        },
        outOfScope: {
          type: 'array',
          description:
            'What this app deliberately will NOT do. The most useful list here. Replaces the previous list — ' +
            'drop anything the conversation has since decided the app WILL do.',
          items: { type: 'string' }
        },
        // AIB-007: this was a bare string, and prose is where it ended — recorded
        // into ARCHITECTURE.md and read by nothing. The prose stays (as
        // `description`, still rendered verbatim); what is new is the structure
        // beside it, which is what lets the plan offer to actually create one.
        backend: {
          type: 'object',
          description:
            'What the app stores data in. Record this as soon as the conversation settles it — a plan can offer ' +
            'to create the backend, but only from what is recorded here.',
          properties: {
            kind: {
              type: 'string',
              enum: ['none', 'nodegx', 'external'],
              description:
                '"none" when you agreed the app stores nothing on a server. "nodegx" when it needs a backend and ' +
                'the user has not named a particular one — a built-in backend will be offered in the plan. ' +
                '"external" when they told you they are using something they already run (Supabase, Directus, ' +
                'their own API). Leave it out if you genuinely do not know yet.'
            },
            description: {
              type: 'string',
              description:
                'What was actually said, in prose. This is written into the project docs verbatim, so it should ' +
                'read as a sentence and include the reason if there was one.'
            },
            collections: {
              type: 'array',
              description:
                'The collections this app stores, with the fields the conversation named. Omit it and the ' +
                'records you recorded in "objects" are used instead — do not repeat them here just to fill it in.',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Singular, matching the object name: "Book"' },
                  fields: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        type: {
                          type: 'string',
                          description: 'text, number, yes/no, or date. Omit when the conversation did not say.'
                        }
                      },
                      required: ['name']
                    }
                  }
                },
                required: ['name']
              }
            },
            needsAuth: {
              type: 'boolean',
              description: 'True only when you agreed that people sign in to this app.'
            }
          }
        },
        conventions: {
          type: 'array',
          description:
            'Checkable rules this project agreed to follow. "Make it nice" is not a rule; "every page shows ' +
            'an empty state" is. Record ONLY rules the conversation actually established.',
          items: { type: 'string' }
        },
        rejected: {
          type: 'array',
          description:
            'What was considered and deliberately not done, with the reason. This outlives everything else ' +
            'here — record it even when the decision felt obvious at the time.',
          items: {
            type: 'object',
            properties: {
              option: { type: 'string', description: 'What was considered' },
              reason: { type: 'string', description: 'Why it was rejected' }
            },
            required: ['option', 'reason']
          }
        },
        openQuestions: {
          type: 'array',
          description:
            'Raised and left unresolved. These become "> TODO:" lines in the docs. Put anything you would ' +
            'otherwise have guessed at here instead.',
          items: { type: 'string' }
        },
        agreed: {
          type: 'boolean',
          description:
            'True only when you have proposed the whole scope and the user has said yes to it. Never set this ' +
            'to claim agreement the user has not given.'
        }
      }
    }
  }
];

export const scopingSystemPrompt = () => `You are scoping a new app with someone who is about to build it in
Noodl — a visual tool where an app is a set of page components that navigate to each other.

This is a CONVERSATION, not a form and not a questionnaire. Your job is to reach a scope you both agree on,
write it down, and stop.

YOU CANNOT BUILD ANYTHING HERE
No components, no nodes, no code, no layout. The project does not exist yet. The only thing you can produce
is prose and a recorded scope. If the user asks you to start building, tell them the build happens after
this — they will get a plan to review and can start it whenever they like. Do not describe what the pages
will contain node by node; that is the next agent's job and guessing at it here just makes work to undo.

WHAT TO ESTABLISH
- What the app is, in one or two sentences, and who actually opens it.
- The core objects and how they relate. Keep the names plain: Book, Shelf, Note.
- What the pages are. Every page you agree is a page someone has to build and maintain.
- What the app deliberately will NOT do. Push for this — it is the single most useful thing you can record.
- Whether the app stores data on a server, and whether people sign in. This one has consequences: record
  backend.kind "nodegx" and the plan will OFFER to create a backend, which the user approves or drops like any
  other step. So ask before you record it. "Does this need to remember things between visits, or between
  people?" settles it faster than the word "backend" does. If they already run something — Supabase, their own
  API — that is "external" and nothing gets created.

HOW TO RUN THE CONVERSATION
- Ask about ONE thing at a time. Two questions in a message is the limit and one is better.
- Propose, don't interrogate. Once you have enough to guess, say what you think and ask them to correct it.
  "So: three pages — Library, Book detail, Add a book. Data is just a Book. Sound right?" beats six more
  questions.
- Push back on scope that will not survive a first build. Nine pages, a recommendation engine and social
  features is not a first version. Say so, propose the smaller thing, and RECORD what you talked them out
  of and why.
- You are allowed — expected — to end with LESS than was asked for, as long as you say so explicitly.
- Never invent a decision the user did not make. If something matters and was not settled, put it in
  openQuestions. A "> TODO:" in their docs is worth far more than a confident sentence that is wrong.
- Aim to be done in a handful of exchanges. This should feel like a good conversation with a colleague,
  not an onboarding wizard.

RECORDING
Call ${RECORD_SCOPE} after every exchange that settles anything, and always before you ask your next
question. The user can walk away at any moment and whatever you last recorded is what their project ships
with — an unrecorded agreement is a lost one. Set "agreed" true only once you have laid out the whole scope
and they have said yes to it.

Every field you send REPLACES the one you sent before — the lists are not added to. So when a decision
changes, re-send that whole list without the entry that is no longer true. Assuming "no accounts" early and
then agreeing to sign-in later means re-sending outOfScope WITHOUT the accounts line; leave it in and their
brief will say the app has no accounts on the same page as it says how people log in. Re-send every list you
still stand behind, not just the one you have news about.

Write like a person. Short paragraphs, no bullet-point walls, no headings, and never restate the whole
scope back at them unless they ask or you are proposing the final version.`;

/**
 * The opening turn. The user's own words are the request and are quoted back
 * verbatim into the documents later, so they are passed through untouched here
 * rather than pre-digested.
 */
export function scopingOpeningMessage(request: string): string {
  return [
    'A new project is about to be created. Here is what they said they want to build:',
    '',
    request.trim(),
    '',
    'Open the conversation. Say briefly what you understood, then ask your first question — the one whose',
    `answer changes the most about what this app is. Record anything you already know with ${RECORD_SCOPE}.`
  ].join('\n');
}

/** Answered when the model reaches for a tool that does not exist here. */
export function unknownToolMessage(name: string): string {
  return (
    `There is no "${name}" tool in this conversation. Nothing can be built here — the project does not ` +
    `exist yet. The only tool is ${RECORD_SCOPE}, and the only other thing you can do is talk to the user.`
  );
}
