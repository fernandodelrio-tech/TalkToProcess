/** State builder — `stateDiagram-v2`. One entity through statuses. */

import { parseFlow, flowToMermaid } from '../flow';

export function buildState(description: string): string {
  return flowToMermaid(parseFlow(description, 'state'));
}
