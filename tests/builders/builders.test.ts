import { describe, it, expect } from 'vitest';
import {
  buildFlowchart,
  buildSwimlane,
  buildSequence,
  buildState,
  buildJourney,
  buildTimeline,
} from '../../src/engine/builders';

describe('flowchart builder', () => {
  it('emits a flowchart TD with sequential edges', () => {
    const m = buildFlowchart('Fill form, review details, submit request');
    expect(m.startsWith('flowchart TD')).toBe(true);
    expect(m).toContain('-->');
    expect(m).toContain('n0');
  });

  it('renders decisions as diamonds', () => {
    const m = buildFlowchart('Review the request; if incomplete, return it; else approve');
    expect(m).toMatch(/n\d\{/);
  });
});

describe('swimlane builder', () => {
  it('emits flowchart LR with one subgraph per lane', () => {
    const m = buildSwimlane(
      'Employee submits LOA; HRBP reviews; manager approves; payroll adjusts',
    );
    expect(m.startsWith('flowchart LR')).toBe(true);
    expect(m).toContain('subgraph');
    expect(m).toContain('Employee');
    expect(m).toContain('HRBP');
    expect(m).toContain('Payroll');
  });
});

describe('sequence builder', () => {
  it('emits participants and messages', () => {
    const m = buildSequence(
      'Recruiter requests availability from hiring manager; system offers slots to candidate',
    );
    expect(m.startsWith('sequenceDiagram')).toBe(true);
    expect(m).toContain('participant');
    expect(m).toContain('->>');
  });
});

describe('state builder', () => {
  it('emits stateDiagram-v2 with start and transitions', () => {
    const m = buildState(
      'Support ticket: opens → in-progress → pending → resolved; reopen; close',
    );
    expect(m.startsWith('stateDiagram-v2')).toBe(true);
    expect(m).toContain('[*] -->');
    expect(m).toContain('--> [*]');
  });
});

describe('journey builder', () => {
  it('emits a journey with scored steps', () => {
    const m = buildJourney('Applies excited; waits frustrated; interviews confident');
    expect(m.startsWith('journey')).toBe(true);
    expect(m).toContain('title');
    expect(m).toMatch(/: \d: User/);
  });
});

describe('timeline builder', () => {
  it('emits a timeline with periods and events', () => {
    const m = buildTimeline(
      'HRIS roadmap over 2026: discovery Q1, build Q2–Q3, pilot Q4',
    );
    expect(m.startsWith('timeline')).toBe(true);
    expect(m).toContain('title');
    expect(m).toContain('Q1');
    expect(m).toContain('Q4');
  });
});

describe('builders sanitize reserved characters (NFR-4)', () => {
  it('never leaks unbalanced quotes or reserved chars into node text', () => {
    const nasty = 'Do #this {now} <fast> | "really" & carefully';
    const m = buildFlowchart(nasty);
    // The only quotes present are the balanced wrappers we add.
    const quoteCount = (m.match(/"/g) || []).length;
    expect(quoteCount % 2).toBe(0);
    expect(m).not.toContain('#');
    expect(m).not.toContain('{"');
  });
});
