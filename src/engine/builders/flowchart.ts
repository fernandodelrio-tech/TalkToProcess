/** Flowchart builder — `flowchart TD`. Linear/branching steps with decisions. */

import { sanitizeLabel } from '../sanitize';
import { toSteps } from './shared';

export function buildFlowchart(description: string): string {
  const steps = toSteps(description);
  if (steps.length === 0) return 'flowchart TD\n  n0["No steps provided"]';

  const lines: string[] = ['flowchart TD'];
  const ids = steps.map((_, i) => `n${i}`);

  steps.forEach((step, i) => {
    const isDecision = /\b(if|whether|approve|deny|denies|fail|fails|else|otherwise|\?)\b/i.test(
      step,
    );
    const label = `"${sanitizeLabel(step)}"`;
    // Decisions render as diamonds, everything else as rounded rectangles.
    lines.push(isDecision ? `  ${ids[i]}{${label}}` : `  ${ids[i]}(${label})`);
  });

  for (let i = 0; i < steps.length - 1; i++) {
    lines.push(`  ${ids[i]} --> ${ids[i + 1]}`);
  }

  return lines.join('\n');
}
