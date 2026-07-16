import { describe, it, expect, beforeAll } from 'vitest';
import mermaid from 'mermaid';
import { buildMermaid } from '../../src/engine/builders';
import type { ModelId } from '../../src/engine/models';

/**
 * Every builder's output must be valid Mermaid. We validate with Mermaid's own
 * parser so a syntax regression in any builder fails the suite (supports FR-10:
 * we only render sources that parse).
 */
beforeAll(() => {
  mermaid.initialize({ startOnLoad: false, htmlLabels: false, securityLevel: 'loose' });
});

const CASES: Record<ModelId, string> = {
  flowchart: 'Fill form, review details, if incomplete return it else submit request',
  swimlane:
    'Employee submits LOA; HRBP reviews; manager approves/denies; payroll adjusts; employee notified',
  sequence:
    'Recruiter requests availability from hiring manager; system offers slots to candidate; candidate picks; system books and sends invites',
  state:
    'Support ticket: opens → in-progress → pending → resolved; reopen; escalate to tier two; close after 5 days',
  journey: 'Applies excited; waits frustrated; interviews confident; offer delighted',
  timeline: 'HRIS roadmap over 2026: discovery Q1, build Q2–Q3, pilot Q4',
};

describe('builders emit parseable Mermaid', () => {
  for (const [model, desc] of Object.entries(CASES)) {
    it(`${model} parses`, async () => {
      const src = buildMermaid(model as ModelId, desc);
      await expect(mermaid.parse(src)).resolves.toBeTruthy();
    });
  }
});
