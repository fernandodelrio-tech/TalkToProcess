/**
 * The model catalog — single source of truth (FR-25).
 *
 * To add a new visualization model (see D-5 / FR-26 for candidates):
 *   1. Add its id to `ModelId` and an entry to `MODELS` below.
 *   2. Add a builder in `builders/` and register it in `builders/index.ts`.
 *   3. Add scoring signals in `selector.ts`.
 *   4. Add acceptance cases in `tests/`.
 */

export type ModelId =
  | 'flowchart'
  | 'swimlane'
  | 'sequence'
  | 'state'
  | 'journey'
  | 'timeline';

export interface ModelDefinition {
  /** Stable identifier used across engine, UI, and tests. */
  id: ModelId;
  /** Human-facing name. */
  label: string;
  /** The underlying Mermaid diagram type this model renders to. */
  mermaidType: string;
  /** One-line description of when this model fits (shown in the selector UI). */
  whenItFits: string;
}

export const MODELS: readonly ModelDefinition[] = [
  {
    id: 'flowchart',
    label: 'Flowchart',
    mermaidType: 'flowchart TD',
    whenItFits:
      'Linear or branching steps with decision points, no distinct role ownership.',
  },
  {
    id: 'swimlane',
    label: 'Swimlane',
    mermaidType: 'flowchart LR (one subgraph per lane)',
    whenItFits:
      'Multiple named roles or systems own different steps and hand off between them.',
  },
  {
    id: 'sequence',
    label: 'Sequence',
    mermaidType: 'sequenceDiagram',
    whenItFits:
      'Time-ordered exchange of messages between actors or systems.',
  },
  {
    id: 'state',
    label: 'State',
    mermaidType: 'stateDiagram-v2',
    whenItFits:
      'One entity moving through statuses, with transitions, loops, and terminal states.',
  },
  {
    id: 'journey',
    label: 'Journey',
    mermaidType: 'journey',
    whenItFits:
      "One person's experience across ordered stages, with per-step sentiment.",
  },
  {
    id: 'timeline',
    label: 'Timeline',
    mermaidType: 'timeline',
    whenItFits: 'A chronology of events, phases, or waves in time order.',
  },
] as const;

export const MODEL_IDS: readonly ModelId[] = MODELS.map((m) => m.id);

const MODEL_BY_ID: Record<ModelId, ModelDefinition> = Object.fromEntries(
  MODELS.map((m) => [m.id, m]),
) as Record<ModelId, ModelDefinition>;

export function getModel(id: ModelId): ModelDefinition {
  return MODEL_BY_ID[id];
}

export function isModelId(value: string): value is ModelId {
  return value in MODEL_BY_ID;
}

/**
 * The shared result shape returned by BOTH engines (FR-29), so downstream
 * rendering and editing is engine-agnostic.
 */
export interface CompositionResult {
  model: ModelId;
  title: string;
  rationale: string;
  mermaid: string;
}

/** Which engine produced a given result (FR-7 / FR-30). */
export type EngineKind = 'model-backed' | 'on-device';
