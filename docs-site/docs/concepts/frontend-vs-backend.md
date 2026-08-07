---
title: What runs in the browser, and what runs on the backend
sidebar_position: 7
---

*Describes NodeGX 0.1.0.*

NodeGX is one of the few tools in this space that draws this line explicitly, and it is
worth understanding early: **most of what you build runs in the browser, on the visitor's
own machine — not on a server you control.** A user who doesn't understand this will, sooner
or later, put a secret API key on a node that ships to every visitor's browser, where anyone
can read it out of the network tab or the bundled JavaScript.

## The default: everything runs client-side

An ordinary NodeGX component — the ones you build with Buttons, Text, Groups, Variables,
Objects, Arrays, Functions, HTTP Request nodes — compiles into a client-rendered app (CSR by
default; NodeGX also supports opting a project into server-side rendering or static
pre-rendering, which change *when* the HTML is produced but not where your node graph's
logic executes). All of that graph's logic runs **in the visitor's browser**. That includes
any Function node's JavaScript, any Variable, any HTTP request your graph makes — the
visitor's browser makes it, from the visitor's machine, and anything that code can read
(including a hardcoded string on a node's input), the visitor can read too.

This is fine, and normal, for anything that is meant to be public: public API endpoints that
don't need a secret, UI logic, calling *your own* backend where the credential lives
server-side instead.

## The exception: a cloud function

A **cloud function** is a special kind of component in your project — you'll see it in its
own sheet in the Components panel — that does not run in the browser at all. It runs on the
backend, in a server process, invoked over HTTP. It's built with nodes and wires exactly like
any other component, but it is a genuinely separate execution context: its own graph, its own
request/response shape, and — critically — access to a **Secret** node that a browser-side
graph has no way to reach.

Rule of thumb:

- Need to call an API from a Button click, with no credential involved? A regular component,
  running in the browser, is fine.
- Need to call an API **with a credential** — a paid API, an email provider, anything with a
  key that must not leak? That call belongs in a cloud function, reached through a **Cloud
  Function** node on the calling side. The key lives in the backend's secret store, is read
  by the Secret node inside the cloud function's own graph, and never reaches the browser at
  all.

## A second server-side concept: workflows

Beyond individual cloud functions, NodeGX also has **workflows** — automations that live
entirely in the backend (schedules, triggers on record changes, webhook handlers) and can
call your cloud functions as steps. You won't need these for your first app, but the same
rule applies to them even more strictly: a workflow can route and reshape data, but any real
computation — anything touching a credential, an API call, or arbitrary code — is delegated
to a cloud function, never done in the workflow itself.

## The one thing to remember

**If a node's input needs a secret, that node must live in a cloud function, not in a page or
a regular component.** Everything else on your canvas — until you explicitly add a cloud
function component and wire into it — is running on whatever device is looking at your app.
