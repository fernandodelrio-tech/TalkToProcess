/**
 * Reference Azure Function proxy for the model-backed engine (§8).
 *
 * SECURITY (NFR-7): the API key lives ONLY in server-side app settings
 * (process.env), never in client code. This file is a template — it is not
 * built or deployed by the default (on-device) app. See ../README.md.
 *
 * Contract: receives { description }, returns the §6 delimited text response.
 */

// These types come from @azure/functions when this proxy is actually deployed.
// They are declared loosely here so the reference compiles without adding the
// dependency to the frontend build.
interface HttpRequest {
  body?: unknown;
}
interface Context {
  res?: { status?: number; headers?: Record<string, string>; body?: string };
}

const SYSTEM_PROMPT = `You select the best-fit visualization model for a described business process and return editable Mermaid.

Choose exactly one MODEL from: flowchart, swimlane, sequence, state, journey, timeline.
- swimlane: multiple named roles/systems own steps and hand off.
- sequence: time-ordered messages between actors (X requests from Y, sends to Z).
- state: one entity moving through statuses, with loops/terminal states.
- timeline: chronology of events/phases/waves in time order.
- journey: one person's experience across stages, with sentiment.
- flowchart: linear/branching steps with decisions, no distinct role ownership.

Respond ONLY in this delimited format (no JSON, no code fences):
MODEL: <one of the above>
TITLE: <short title>
RATIONALE: <1-2 sentences grounded in the description>
MERMAID:
<raw mermaid source>

Rules: htmlLabels off — plain vector text. Keep it under ~25 nodes. Sanitize labels: no # & < > | { } or unbalanced quotes.`;

export default async function composeProxy(context: Context, req: HttpRequest): Promise<void> {
  const description =
    req.body && typeof req.body === 'object'
      ? String((req.body as { description?: unknown }).description ?? '')
      : '';

  if (!description.trim()) {
    context.res = { status: 400, body: 'Missing "description".' };
    return;
  }

  try {
    const text = await callModel(description);
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: text,
    };
  } catch (err) {
    // Return a non-2xx WITHOUT the description or key — frontend falls back.
    context.res = { status: 502, body: `Upstream error: ${(err as Error).message}` };
  }
}

/**
 * Provider (b): Anthropic API. For provider (c) — Cummins Azure OpenAI —
 * replace this with an Azure OpenAI call authenticated via managed identity.
 */
async function callModel(description: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: description }],
    }),
  });

  if (!response.ok) throw new Error(`provider returned ${response.status}`);
  const data = (await response.json()) as { content?: { text?: string }[] };
  const text = data.content?.map((c) => c.text ?? '').join('') ?? '';
  if (!text.trim()) throw new Error('empty completion');
  return text;
}
