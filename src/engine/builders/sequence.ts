/** Sequence builder — `sequenceDiagram`. Time-ordered messages between actors. */

import { parseFlow, flowToMermaid } from '../flow';

export function buildSequence(description: string): string {
  return flowToMermaid(parseFlow(description, 'sequence'));
}
