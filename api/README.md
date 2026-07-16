# Backend proxy (optional — only for Decision D-1 b/c)

This directory is a **reference implementation** of the backend proxy described
in §8 of the requirements. It is **not required** and **not wired in** by
default: the app ships on-device-only (Decision **D-1a**), and the frontend only
attempts the model-backed engine when a proxy URL is configured (see
`src/engine/llm.ts` → `getLlmConfig`).

## Why a proxy exists at all

**NFR-7 (binding):** the LLM API key must **never** be present in client-side
code. A key shipped in the browser is readable by anyone with the file. If
model-backed mode is enabled in a deployed build, the call must go through a
backend proxy that holds the credential **server-side** (or uses a keyless
federated identity).

- **Constraint C-1:** a Claude.ai (consumer) subscription is not API access. The
  "no-key call handled by the Claude.ai runtime" path only works while the tool
  runs live inside Claude.ai and is **not** a portable deployment option. Do not
  assume it in a deployed build.

## The contract

The proxy receives `{ "description": "<text>" }` and must return the **delimited**
(not JSON) response from §6, so multi-line Mermaid needs no newline escaping:

```
MODEL: <flowchart|swimlane|sequence|state|journey|timeline>
TITLE: <short title>
RATIONALE: <1–2 sentences>
MERMAID:
<raw mermaid>
```

The frontend parses this with `parseDelimitedResponse`. On **any** failure
(network, auth, non-2xx, parse, invalid model) the frontend silently falls back
to the on-device engine (FR-27) — the tool never hard-fails.

## Recommended hosting (D-2)

Azure Static Web Apps (static frontend) + Azure Functions (this proxy), aligning
with the existing Cummins Azure/OpenAI estate.

## Provider options (D-1)

- **(b) Anthropic API** — set `ANTHROPIC_API_KEY` (server-side app setting).
- **(c) Cummins-governed Azure OpenAI** — set `AZURE_OPENAI_ENDPOINT`,
  `AZURE_OPENAI_DEPLOYMENT`, and prefer a **managed identity** over a key.
  Preferred for the enterprise/privacy context (NFR-9): the description text
  stays inside Cummins-governed infrastructure.

`compose/index.ts` shows the shape for provider (b). Swap the `callModel`
implementation for (c). **Never** log or echo the description or the key.

## Enabling it in the frontend

Set a non-secret proxy URL at deploy time, either:

- `VITE_LLM_PROXY_URL=/api/compose` at build time, or
- inject `window.__PROCESS_COMPOSITOR_PROXY_URL__ = '/api/compose'` via a small
  env-substituted script tag.

Both are non-secret by design — the secret stays in the Function's app settings.
