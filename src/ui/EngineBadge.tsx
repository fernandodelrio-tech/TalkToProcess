import type { EngineKind } from '../engine/models';

/** Surfaces which engine produced the current diagram (FR-7, FR-30). */
export function EngineBadge({ engine }: { engine: EngineKind }) {
  const modelBacked = engine === 'model-backed';
  return (
    <span
      className={`chip ${modelBacked ? 'chip--amber' : 'chip--teal'}`}
      title={
        modelBacked
          ? 'Produced by the model-backed engine (via backend proxy)'
          : 'Produced by the on-device engine (fully offline)'
      }
    >
      <span className="chip__dot" aria-hidden="true" />
      {modelBacked ? 'Model-backed' : 'On-device'}
    </span>
  );
}
