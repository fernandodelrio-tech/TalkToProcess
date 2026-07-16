/** Swimlane builder — `flowchart LR` with one subgraph per lane (owning role). */

import { parseFlow, flowToMermaid } from '../flow';

export function buildSwimlane(description: string): string {
  return flowToMermaid(parseFlow(description, 'swimlane'));
}
