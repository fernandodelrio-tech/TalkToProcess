interface Props {
  source: string;
  onChange: (v: string) => void;
  error: string | null;
}

/** Editable Mermaid source that re-renders live (debounced in App), with
 *  syntax errors flagged non-destructively (FR-11). */
export function SourcePanel({ source, onChange, error }: Props) {
  return (
    <section className="source-panel" aria-labelledby="source-h">
      <div className="source-panel__head">
        <span className="label" id="source-h">
          Mermaid source
        </span>
        {error ? (
          <span className="chip chip--amber" role="status" title={error}>
            Syntax error — last good diagram kept
          </span>
        ) : (
          <span className="hint">Edits render live · click a label in the diagram to rename</span>
        )}
      </div>
      <textarea
        className={`source${error ? ' has-error' : ''}`}
        spellCheck={false}
        value={source}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Mermaid source"
        aria-invalid={!!error}
      />
    </section>
  );
}
