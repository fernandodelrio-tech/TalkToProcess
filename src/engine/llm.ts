/**
 * Model-backed engine client (§6, §8).
 *
 * SECURITY (NFR-7): there is NO API key in this file or anywhere client-side.
 * This client only ever POSTs the description to a *backend proxy* URL that
 * holds the credential server-side (see `api/`). If no proxy URL is configured,
 * model-backed mode is simply unavailable and the app runs on-device only —
 * which is the default (Decision D-1a).
 *
 * The proxy returns the delimited (non-JSON) contract from §6 to avoid
 * newline-escaping fragility with multi-line Mermaid.
 */

import type { CompositionResult } from './models';
import { isModelId } from './models';

export interface LlmConfig {
  /** Backend proxy endpoint. When absent, model-backed mode is disabled. */
  proxyUrl?: string;
}

/**
 * Resolve runtime config without bundling any secret. The proxy URL may be
 * injected at deploy time via a global (e.g. an env-substituted script tag) or
 * a Vite public env var. Both are non-secret by design.
 */
export function getLlmConfig(): LlmConfig {
  const fromGlobal =
    typeof globalThis !== 'undefined'
      ? (globalThis as { __PROCESS_COMPOSITOR_PROXY_URL__?: string }).__PROCESS_COMPOSITOR_PROXY_URL__
      : undefined;
  const fromEnv =
    typeof import.meta !== 'undefined'
      ? (import.meta as unknown as { env?: Record<string, string> }).env
          ?.VITE_LLM_PROXY_URL
      : undefined;
  const proxyUrl = fromGlobal || fromEnv || undefined;
  return { proxyUrl };
}

export function isModelBackedAvailable(config: LlmConfig = getLlmConfig()): boolean {
  return typeof config.proxyUrl === 'string' && config.proxyUrl.length > 0;
}

export class LlmError extends Error {}

/**
 * Parse the delimited engine contract:
 *
 *   MODEL: <flowchart|swimlane|sequence|state|journey|timeline>
 *   TITLE: <short title>
 *   RATIONALE: <1–2 sentences>
 *   MERMAID:
 *   <raw mermaid>
 *
 * Throws `LlmError` on a malformed or invalid-model response so the caller can
 * fall back to on-device (FR-27).
 */
export function parseDelimitedResponse(raw: string): CompositionResult {
  const text = (raw ?? '').replace(/\r\n/g, '\n');

  const model = matchField(text, 'MODEL');
  const title = matchField(text, 'TITLE');
  const rationale = matchField(text, 'RATIONALE');

  const mermaidMatch = text.match(/^MERMAID:\s*\n?([\s\S]*)$/m);
  const mermaid = mermaidMatch ? mermaidMatch[1].trim() : '';

  if (!model || !isModelId(model)) {
    throw new LlmError(`Response has missing or unknown MODEL: "${model ?? ''}"`);
  }
  if (!mermaid) {
    throw new LlmError('Response has empty MERMAID body');
  }

  return {
    model,
    title: title || 'Process',
    rationale: rationale || `Selected ${model}.`,
    mermaid,
  };
}

function matchField(text: string, field: string): string | undefined {
  const re = new RegExp(`^${field}:\\s*(.+)$`, 'm');
  const m = text.match(re);
  return m ? m[1].trim() : undefined;
}

/**
 * Call the backend proxy and parse its delimited response. Any failure
 * (network, non-2xx, parse, invalid model) throws so the orchestrator falls
 * back to the on-device engine (FR-27). The tool must never hard-fail.
 */
export async function composeWithModel(
  description: string,
  config: LlmConfig = getLlmConfig(),
  signal?: AbortSignal,
): Promise<CompositionResult> {
  if (!isModelBackedAvailable(config)) {
    throw new LlmError('Model-backed mode is not configured (no proxy URL).');
  }
  let response: Response;
  try {
    response = await fetch(config.proxyUrl as string, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
      signal,
    });
  } catch (err) {
    throw new LlmError(`Proxy request failed: ${(err as Error).message}`);
  }
  if (!response.ok) {
    throw new LlmError(`Proxy returned ${response.status}`);
  }
  const body = await response.text();
  return parseDelimitedResponse(body);
}
