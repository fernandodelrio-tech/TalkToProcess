/** Builder registry — maps each model id to its Mermaid builder. */

import type { ModelId } from '../models';
import { buildFlowchart } from './flowchart';
import { buildSwimlane } from './swimlane';
import { buildSequence } from './sequence';
import { buildState } from './state';
import { buildJourney } from './journey';
import { buildTimeline } from './timeline';

export type Builder = (description: string) => string;

export const BUILDERS: Record<ModelId, Builder> = {
  flowchart: buildFlowchart,
  swimlane: buildSwimlane,
  sequence: buildSequence,
  state: buildState,
  journey: buildJourney,
  timeline: buildTimeline,
};

export function buildMermaid(model: ModelId, description: string): string {
  return BUILDERS[model](description);
}

export {
  buildFlowchart,
  buildSwimlane,
  buildSequence,
  buildState,
  buildJourney,
  buildTimeline,
};
