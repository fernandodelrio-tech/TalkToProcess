import { MODELS, getModel, type ModelId, type EngineKind } from '../engine/models';
import { EngineBadge } from './EngineBadge';

interface Props {
  selected: ModelId;
  rationale: string;
  engine: EngineKind;
  onOverride: (model: ModelId) => void;
  hasResult: boolean;
}

/**
 * Shows the chosen model + rationale prominently (FR-5), the engine badge
 * (FR-7), and lets the user override to any other model (FR-6).
 */
export function ModelSelector({ selected, rationale, engine, onOverride, hasResult }: Props) {
  if (!hasResult) return null;
  const model = getModel(selected);

  return (
    <section className="model-choice" aria-labelledby="model-h">
      <div className="model-choice__head">
        <span className="label" id="model-h">
          Best-fit model
        </span>
        <EngineBadge engine={engine} />
      </div>
      <div className="model-choice__name">{model.label}</div>
      <p className="rationale">{rationale}</p>

      <div className="label" style={{ marginTop: 10 }}>
        Override
      </div>
      <div className="model-grid" role="group" aria-label="Choose a different model">
        {MODELS.map((m) => (
          <button
            key={m.id}
            aria-pressed={m.id === selected}
            onClick={() => onOverride(m.id)}
            title={m.whenItFits}
          >
            {m.label}
          </button>
        ))}
      </div>
    </section>
  );
}
