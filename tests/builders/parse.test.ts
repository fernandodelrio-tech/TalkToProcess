import { describe, it, expect, beforeAll } from 'vitest';
import mermaid from 'mermaid';
import { buildMermaid } from '../../src/engine/builders';
import { MODEL_IDS, type ModelId } from '../../src/engine/models';
import { SEEDS } from '../../src/ui/seeds';

/**
 * Every builder's output must be valid Mermaid. We validate with Mermaid's own
 * parser so a syntax regression fails the suite (supports FR-10).
 *
 * The CROSS-PRODUCT test is the important one: a user can override ANY input to
 * ANY model (FR-6), so every seed rendered as every model must parse. This is
 * the regression guard for the "override → Sequence" parse error.
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

describe('builders emit parseable Mermaid (natural fit)', () => {
  for (const [model, desc] of Object.entries(CASES)) {
    it(`${model} parses`, async () => {
      await expect(mermaid.parse(buildMermaid(model as ModelId, desc))).resolves.toBeTruthy();
    });
  }
});

describe('every input renders as every model without breaking (FR-6, override safety)', () => {
  const inputs = [
    ...SEEDS.map((s) => s.text),
    'HRIS roadmap in three waves over 2026: discovery Q1, build Q2–Q3, pilot, cutover and hypercare Q4',
    'Do #this {now} <fast> | "really" & carefully: at 9:00',
    '',
    'a',
  ];
  for (const model of MODEL_IDS) {
    for (const input of inputs) {
      it(`${model} ⟵ "${input.slice(0, 32) || '(empty)'}"`, async () => {
        await expect(
          mermaid.parse(buildMermaid(model, input)),
        ).resolves.toBeTruthy();
      });
    }
  }
});
