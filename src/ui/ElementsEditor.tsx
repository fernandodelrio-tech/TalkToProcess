import {
  type Flow,
  type Step,
  addStep,
  removeStep,
  moveStep,
  updateStep,
  lanesOf,
  actorsOfFlow,
} from '../engine/flow';

interface Props {
  flow: Flow;
  onChange: (next: Flow) => void;
  /** True when the raw source has been hand-edited away from the IR. */
  outOfSync: boolean;
}

/**
 * Direct structural editing of the flow (FR-14): add, remove, reorder, relabel
 * elements and edit per-model attributes. Every change regenerates the Mermaid
 * source, so the diagram and code stay in sync.
 */
export function ElementsEditor({ flow, onChange, outOfSync }: Props) {
  const lanes = lanesOf(flow);
  const actors = actorsOfFlow(flow);

  const noun =
    flow.model === 'sequence'
      ? 'message'
      : flow.model === 'state'
        ? 'state'
        : flow.model === 'timeline'
          ? 'event'
          : flow.model === 'journey'
            ? 'stage'
            : 'step';

  return (
    <section className="elements" aria-labelledby="elements-h">
      <div className="elements__head">
        <span className="label" id="elements-h">
          Elements
        </span>
        <button
          className="btn btn--tonal btn--sm"
          onClick={() => onChange(addStep(flow))}
        >
          <span aria-hidden="true">＋</span> Add {noun}
        </button>
      </div>

      {outOfSync && (
        <p className="elements__note" role="status">
          The source was edited by hand — structural edits will regenerate it from these elements.
        </p>
      )}

      <ol className="elements__list">
        {flow.steps.map((step, i) => (
          <li className="el-row" key={step.id}>
            <div className="el-row__index" aria-hidden="true">
              {i + 1}
            </div>

            <div className="el-row__body">
              <input
                className="el-input el-input--label"
                value={step.label}
                aria-label={`${noun} ${i + 1} label`}
                onChange={(e) => onChange(updateStep(flow, step.id, { label: e.target.value }))}
              />

              <div className="el-attrs">{attrControls(flow, step, onChange, lanes, actors)}</div>
            </div>

            <div className="el-row__actions">
              <button
                className="icon-btn"
                aria-label="Move up"
                disabled={i === 0}
                onClick={() => onChange(moveStep(flow, step.id, -1))}
              >
                ↑
              </button>
              <button
                className="icon-btn"
                aria-label="Move down"
                disabled={i === flow.steps.length - 1}
                onClick={() => onChange(moveStep(flow, step.id, 1))}
              >
                ↓
              </button>
              <button
                className="icon-btn"
                aria-label="Add below"
                onClick={() => onChange(addStep(flow, step.id))}
              >
                ＋
              </button>
              <button
                className="icon-btn icon-btn--danger"
                aria-label={`Remove ${noun}`}
                disabled={flow.steps.length <= 1}
                onClick={() => onChange(removeStep(flow, step.id))}
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function attrControls(
  flow: Flow,
  step: Step,
  onChange: (f: Flow) => void,
  lanes: string[],
  actors: string[],
): React.ReactNode {
  switch (flow.model) {
    case 'flowchart':
      return (
        <label className="el-chip-toggle">
          <input
            type="checkbox"
            checked={step.kind === 'decision'}
            onChange={(e) =>
              onChange(updateStep(flow, step.id, { kind: e.target.checked ? 'decision' : 'step' }))
            }
          />
          Decision
        </label>
      );
    case 'swimlane':
      return (
        <>
          <label className="el-field">
            <span>Lane</span>
            <input
              className="el-input"
              list="lane-options"
              value={step.lane ?? ''}
              onChange={(e) => onChange(updateStep(flow, step.id, { lane: e.target.value }))}
            />
          </label>
          <label className="el-chip-toggle">
            <input
              type="checkbox"
              checked={step.kind === 'decision'}
              onChange={(e) =>
                onChange(updateStep(flow, step.id, { kind: e.target.checked ? 'decision' : 'step' }))
              }
            />
            Decision
          </label>
          <datalist id="lane-options">
            {lanes.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </>
      );
    case 'sequence':
      return (
        <>
          <label className="el-field">
            <span>From</span>
            <input
              className="el-input"
              list="actor-options"
              value={step.from ?? ''}
              onChange={(e) => onChange(updateStep(flow, step.id, { from: e.target.value }))}
            />
          </label>
          <span className="el-arrow" aria-hidden="true">
            →
          </span>
          <label className="el-field">
            <span>To</span>
            <input
              className="el-input"
              list="actor-options"
              value={step.to ?? ''}
              onChange={(e) => onChange(updateStep(flow, step.id, { to: e.target.value }))}
            />
          </label>
          <datalist id="actor-options">
            {actors.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </>
      );
    case 'timeline':
      return (
        <label className="el-field">
          <span>Period</span>
          <input
            className="el-input"
            value={step.period ?? ''}
            onChange={(e) => onChange(updateStep(flow, step.id, { period: e.target.value }))}
          />
        </label>
      );
    case 'journey':
      return (
        <label className="el-field">
          <span>Sentiment</span>
          <select
            className="el-input"
            value={String(step.score ?? 3)}
            onChange={(e) => onChange(updateStep(flow, step.id, { score: Number(e.target.value) }))}
          >
            <option value="1">1 · very negative</option>
            <option value="2">2 · negative</option>
            <option value="3">3 · neutral</option>
            <option value="4">4 · positive</option>
            <option value="5">5 · very positive</option>
          </select>
        </label>
      );
    default:
      return null;
  }
}
