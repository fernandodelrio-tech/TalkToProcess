/** Journey builder — `journey`. One person's experience across stages. */

import { parseFlow, flowToMermaid } from '../flow';

export function buildJourney(description: string): string {
  return flowToMermaid(parseFlow(description, 'journey'));
}
