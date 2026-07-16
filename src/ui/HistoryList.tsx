import type { HistoryEntry } from '../state/history';
import { getModel } from '../engine/models';

interface Props {
  entries: HistoryEntry[];
  onRestore: (entry: HistoryEntry) => void;
}

/** In-session history, restorable by click (FR-23). */
export function HistoryList({ entries, onRestore }: Props) {
  if (entries.length === 0) return null;
  return (
    <section aria-labelledby="history-h">
      <div className="label" id="history-h" style={{ marginBottom: 6 }}>
        Session history
      </div>
      <div className="history">
        {entries.map((entry) => (
          <button
            key={entry.id}
            className="history__item"
            onClick={() => onRestore(entry)}
            title={entry.description}
          >
            <strong style={{ color: 'var(--teal-strong)' }}>
              {getModel(entry.result.model).label}
            </strong>{' '}
            — {truncate(entry.description, 60)}
          </button>
        ))}
      </div>
    </section>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
