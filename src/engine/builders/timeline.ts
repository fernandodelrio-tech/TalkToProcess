/** Timeline builder — `timeline`. Chronology of events/phases/waves. */

import { sanitizeLabel } from '../sanitize';
import { deriveTitle } from './shared';

const PERIOD_RE =
  /\b(q[1-4](?:\s*[–-]\s*q?[1-4])?|(?:19|20)\d{2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec[a-z]*|week\s*\d+|phase\s*\d+|wave\s*\d+)\b/i;

interface Entry {
  period: string;
  events: string[];
}

export function buildTimeline(description: string): string {
  const clauses = (description || '')
    .split(/[;\n.]|,/g)
    .map((c) => c.trim())
    .filter(Boolean)
    // Drop a leading "Roadmap:" style prefix from the first clause.
    .map((c) => c.replace(/^[^:]{0,60}:\s*/, ''))
    .filter(Boolean);

  const title = deriveTitle(description, 'Timeline');
  const lines: string[] = ['timeline', `  title ${title}`];

  const entries: Entry[] = [];
  let fallbackIdx = 0;
  for (const clause of clauses) {
    const m = clause.match(PERIOD_RE);
    const period = m ? normalizePeriod(m[0]) : `Phase ${++fallbackIdx}`;
    const event = sanitizeLabel(m ? clause.replace(m[0], '').trim() : clause) || 'Event';
    entries.push({ period, events: [event] });
  }

  if (entries.length === 0) {
    lines.push('  Phase 1 : No events provided');
    return lines.join('\n');
  }

  for (const entry of entries) {
    lines.push(`  ${sanitizeLabel(entry.period)} : ${entry.events.join(' : ')}`);
  }

  return lines.join('\n');
}

function normalizePeriod(raw: string): string {
  return raw.replace(/\s*[–-]\s*/g, '-').toUpperCase();
}
