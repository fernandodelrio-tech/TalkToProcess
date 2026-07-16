/**
 * Composition orchestrator — the two-engine "best-fit" pattern (§6).
 *
 * Attempts the model-backed engine first when available; on ANY failure
 * (network, auth, parse, invalid diagram) it automatically falls back to the
 * on-device engine (FR-27). Both paths return the same shape (FR-29) plus the
 * engine that produced it (FR-30).
 */

import type { CompositionResult, EngineKind, ModelId } from './models';
import { composeOnDevice, composeOnDeviceAs } from './onDevice';
import { composeWithModel, isModelBackedAvailable, getLlmConfig } from './llm';

export interface ComposeOutput {
  result: CompositionResult;
  engine: EngineKind;
  /** Populated when the model-backed engine was tried but failed. */
  fallbackReason?: string;
}

export interface ComposeOptions {
  /** Force on-device even if a proxy is configured. */
  forceOnDevice?: boolean;
  signal?: AbortSignal;
}

/** Compose from a description, auto-selecting the best-fit model. */
export async function compose(
  description: string,
  options: ComposeOptions = {},
): Promise<ComposeOutput> {
  const config = getLlmConfig();
  if (!options.forceOnDevice && isModelBackedAvailable(config)) {
    try {
      const result = await composeWithModel(description, config, options.signal);
      return { result, engine: 'model-backed' };
    } catch (err) {
      // FR-27: silently fall back; never hard-fail.
      return {
        result: composeOnDevice(description),
        engine: 'on-device',
        fallbackReason: (err as Error).message,
      };
    }
  }
  return { result: composeOnDevice(description), engine: 'on-device' };
}

/**
 * Re-render the SAME description in a user-chosen model (FR-6). This is always
 * on-device: the override is a deterministic re-draw, not a re-selection.
 */
export function recomposeAs(description: string, model: ModelId): CompositionResult {
  return composeOnDeviceAs(description, model);
}
