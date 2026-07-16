import { describe, it, expect } from 'vitest';
import { selectModel } from '../src/engine/selector';

/**
 * §12 acceptance criteria — the on-device selector must produce these choices.
 * These are the primary regression suite (see CLAUDE.md).
 */
describe('selector — §12 acceptance cases', () => {
  it('LOA approval across roles → swimlane', () => {
    const desc =
      'Employee submits LOA; HRBP reviews; manager approves/denies; payroll adjusts; employee notified';
    expect(selectModel(desc).model).toBe('swimlane');
  });

  it('onboarding with roles + conditional → swimlane (flowchart acceptable)', () => {
    const desc =
      'Onboarding: bg check clears, IT provisions, HR paperwork, first-day access; if bg check fails, offer rescinded';
    expect(['swimlane', 'flowchart']).toContain(selectModel(desc).model);
  });

  it('support ticket lifecycle → state', () => {
    const desc =
      'Support ticket: opens → in-progress → pending → resolved; reopen; escalate to tier two; close after 5 days';
    expect(selectModel(desc).model).toBe('state');
  });

  it('interview scheduling messages → sequence', () => {
    const desc =
      'Recruiter requests availability from hiring manager; system offers slots to candidate; candidate picks; system books and sends invites';
    expect(selectModel(desc).model).toBe('sequence');
  });

  it('HRIS roadmap in waves → timeline', () => {
    const desc =
      'HRIS roadmap in three waves over 2026: discovery Q1, build Q2–Q3, pilot/cutover/hypercare Q4';
    expect(selectModel(desc).model).toBe('timeline');
  });
});

describe('selector — additional behavior', () => {
  it('produces a rationale grounded in the description (FR-5)', () => {
    const desc =
      'Employee submits LOA; HRBP reviews; manager approves; payroll adjusts';
    const sel = selectModel(desc);
    expect(sel.rationale.length).toBeGreaterThan(0);
    expect(sel.rationale.toLowerCase()).toContain('swimlane');
  });

  it('defaults to flowchart for a plain linear process', () => {
    const desc = 'Fill out the form, review the details, then submit the request';
    expect(selectModel(desc).model).toBe('flowchart');
  });

  it('detects sentiment language → journey', () => {
    const desc =
      'Candidate applies feeling excited; waits and grows frustrated; interviews and feels confident; gets offer and is delighted';
    expect(selectModel(desc).model).toBe('journey');
  });

  it('is deterministic (same input → same output)', () => {
    const desc = 'Support ticket opens, moves to pending, then resolved and closed';
    expect(selectModel(desc).model).toBe(selectModel(desc).model);
  });

  it('handles empty input without throwing', () => {
    expect(() => selectModel('')).not.toThrow();
  });
});
