/** Swimlane builder — `flowchart LR` with one subgraph per lane (owning role). */

import { sanitizeLabel } from '../sanitize';
import { toOwnedSteps, distinctActors } from './shared';

export function buildSwimlane(description: string): string {
  const steps = toOwnedSteps(description);
  if (steps.length === 0) return 'flowchart LR\n  n0["No steps provided"]';

  const lanes = distinctActors(steps);
  const lines: string[] = ['flowchart LR'];

  // Node ids in overall step order so edges follow the real sequence.
  const nodeIds = steps.map((_, i) => `n${i}`);

  // One subgraph per lane; nodes placed in the lane of their owning actor.
  lanes.forEach((lane, laneIdx) => {
    lines.push(`  subgraph lane${laneIdx}["${sanitizeLabel(lane)}"]`);
    lines.push('    direction TB');
    steps.forEach((step, i) => {
      if (step.actor === lane) {
        lines.push(`    ${nodeIds[i]}["${sanitizeLabel(step.action)}"]`);
      }
    });
    lines.push('  end');
  });

  // Sequential edges across lanes = the handoffs.
  for (let i = 0; i < steps.length - 1; i++) {
    lines.push(`  ${nodeIds[i]} --> ${nodeIds[i + 1]}`);
  }

  return lines.join('\n');
}
