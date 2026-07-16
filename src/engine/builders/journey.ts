/** Journey builder — `journey`. One person's experience across stages. */

import { sanitizeLabel } from '../sanitize';

const POSITIVE = /\b(delight|happy|satisfied|excited|smooth|easy|clear|confident|glad)\w*/i;
const NEGATIVE = /\b(frustrat|confus|anxious|painful|difficult|hard|unhappy|dissatisf|slow|stuck|blocked)\w*/i;

/** Journey step scores are 1 (worst) to 5 (best). */
function sentimentScore(phrase: string): number {
  if (POSITIVE.test(phrase)) return 5;
  if (NEGATIVE.test(phrase)) return 2;
  return 3;
}

export function buildJourney(description: string): string {
  const steps = (description || '')
    .split(/[;\n.]|,|\bthen\b|→|->/gi)
    .map((s) => s.trim())
    .filter(Boolean);

  const title = sanitizeLabel(
    (description || '').split(/[;\n.:]/)[0]?.trim() || 'Journey',
    'Journey',
  );

  const lines: string[] = ['journey', `  title ${title}`, '  section Experience'];

  if (steps.length === 0) {
    lines.push('    No steps provided: 3: User');
    return lines.join('\n');
  }

  for (const step of steps) {
    const label = sanitizeLabel(step).split(/\s+/).slice(0, 6).join(' ');
    // Journey task syntax: "Task: score: Actor"
    lines.push(`    ${label}: ${sentimentScore(step)}: User`);
  }

  return lines.join('\n');
}
