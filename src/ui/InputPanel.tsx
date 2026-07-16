import { useRef } from 'react';
import { SEEDS } from './seeds';
import { getModel } from '../engine/models';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onCompose: () => void;
  composing: boolean;
}

/** Free-text input (FR-1), seed examples (FR-2), Cmd/Ctrl+Enter compose (FR-3). */
export function InputPanel({ value, onChange, onCompose, composing }: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onCompose();
    }
  };

  return (
    <section aria-labelledby="describe-h">
      <label className="label" id="describe-h" htmlFor="description">
        Describe your process
      </label>
      <textarea
        id="description"
        ref={taRef}
        className="description"
        placeholder="e.g. Employee submits a leave request; HRBP reviews; manager approves or denies; payroll adjusts; employee is notified."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button className="primary" onClick={onCompose} disabled={composing}>
          {composing ? 'Composing…' : 'Compose diagram'}
        </button>
        <span className="hint" style={{ alignSelf: 'center' }}>
          or press ⌘/Ctrl + Enter
        </span>
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="label" style={{ marginBottom: 6 }}>
          Try an example
        </div>
        <div className="seeds">
          {SEEDS.map((seed) => (
            <button
              key={seed.label}
              className="seed"
              onClick={() => onChange(seed.text)}
              title={`Resolves to: ${getModel(seed.expected).label}`}
            >
              <span>{seed.label}</span>
              <span className="seed__model">{getModel(seed.expected).label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
