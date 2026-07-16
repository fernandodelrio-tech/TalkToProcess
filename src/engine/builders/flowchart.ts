/** Flowchart builder — `flowchart TD` with Start/End terminals and decisions. */

import { parseFlow, flowToMermaid } from '../flow';

export function buildFlowchart(description: string): string {
  return flowToMermaid(parseFlow(description, 'flowchart'));
}
