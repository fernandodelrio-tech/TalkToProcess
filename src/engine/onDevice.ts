/**
 * The on-device engine (§6 fallback): selector + builder, fully offline.
 * Returns the shared `CompositionResult` shape (FR-29).
 */

import type { CompositionResult, ModelId } from './models';
import { selectModel } from './selector';
import { buildMermaid } from './builders';
import { deriveTitle } from './builders/shared';

/** Compose using the on-device engine, auto-selecting the best-fit model. */
export function composeOnDevice(description: string): CompositionResult {
  const selection = selectModel(description);
  return composeOnDeviceAs(description, selection.model, selection.rationale);
}

/** Re-render the SAME description in an explicitly chosen model (FR-6). */
export function composeOnDeviceAs(
  description: string,
  model: ModelId,
  rationale?: string,
): CompositionResult {
  const mermaid = buildMermaid(model, description);
  const title = deriveTitle(description, 'Process');
  return {
    model,
    title,
    rationale: rationale ?? `Rendered as ${model} (user-selected).`,
    mermaid,
  };
}
