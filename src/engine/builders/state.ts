/** State builder — `stateDiagram-v2`. One entity through statuses. */

import { sanitizeLabel } from '../sanitize';

/** Split into ordered status phrases, honoring arrow chains. */
function toStatuses(description: string): string[] {
  return (description || '')
    .split(/[;\n.]|,|→|->|\bthen\b/gi)
    .map((s) => s.trim())
    .filter(Boolean)
    // Drop a leading "Entity:" label like "Support ticket: opens".
    .map((s) => s.replace(/^[^:]{0,40}:\s*/, ''))
    .map((s) => shortStatus(s))
    .filter(Boolean);
}

/** Reduce a phrase to a compact status label. */
function shortStatus(phrase: string): string {
  const cleaned = sanitizeLabel(phrase);
  // Keep it short: first 3 words is plenty for a status label.
  return cleaned.split(/\s+/).slice(0, 3).join(' ');
}

export function buildState(description: string): string {
  const statuses = toStatuses(description);
  if (statuses.length === 0) return 'stateDiagram-v2\n  [*] --> Unknown';

  const lines: string[] = ['stateDiagram-v2'];
  const ids = statuses.map((_, i) => `s${i}`);

  statuses.forEach((label, i) => {
    lines.push(`  state "${label}" as ${ids[i]}`);
  });

  lines.push(`  [*] --> ${ids[0]}`);
  for (let i = 0; i < statuses.length - 1; i++) {
    lines.push(`  ${ids[i]} --> ${ids[i + 1]}`);
  }

  // Terminal + loop heuristics: a "reopen"/"close"/"resolved" gets special edges.
  const lastIdx = statuses.length - 1;
  const reopenIdx = statuses.findIndex((s) => /reopen/i.test(s));
  const closeIdx = statuses.findIndex((s) => /close|resolved|complete|done/i.test(s));

  if (closeIdx >= 0) {
    lines.push(`  ${ids[closeIdx]} --> [*]`);
  } else {
    lines.push(`  ${ids[lastIdx]} --> [*]`);
  }
  if (reopenIdx >= 0 && closeIdx >= 0 && reopenIdx !== closeIdx) {
    // Reopen loops back into the active flow.
    lines.push(`  ${ids[reopenIdx]} --> ${ids[0]}`);
  }

  return lines.join('\n');
}
