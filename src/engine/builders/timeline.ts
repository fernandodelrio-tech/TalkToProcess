/** Timeline builder — `timeline`. Chronology of events/phases/waves. */

import { parseFlow, flowToMermaid } from '../flow';

export function buildTimeline(description: string): string {
  return flowToMermaid(parseFlow(description, 'timeline'));
}
