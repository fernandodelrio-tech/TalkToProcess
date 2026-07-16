/**
 * Seed examples (FR-2). Each is chosen to resolve to a *different* best-fit
 * model, so the set doubles as a demonstration of the selection behavior.
 */

import type { ModelId } from '../engine/models';

export interface Seed {
  label: string;
  expected: ModelId;
  text: string;
}

export const SEEDS: Seed[] = [
  {
    label: 'Leave-of-absence approval',
    expected: 'swimlane',
    text: 'Employee submits LOA; HRBP reviews; manager approves or denies; payroll adjusts; employee notified',
  },
  {
    label: 'Support ticket lifecycle',
    expected: 'state',
    text: 'Support ticket: opens → in-progress → pending → resolved; can reopen; escalate to tier two; close after 5 days',
  },
  {
    label: 'Interview scheduling',
    expected: 'sequence',
    text: 'Recruiter requests availability from hiring manager; system offers slots to candidate; candidate picks; system books and sends invites',
  },
  {
    label: 'HRIS roadmap',
    expected: 'timeline',
    text: 'HRIS roadmap in three waves over 2026: discovery Q1, build Q2–Q3, pilot, cutover and hypercare Q4',
  },
  {
    label: 'Candidate experience',
    expected: 'journey',
    text: 'Candidate applies feeling excited; waits and grows frustrated; interviews and feels confident; receives offer and is delighted',
  },
  {
    label: 'Expense approval',
    expected: 'flowchart',
    text: 'Fill out the expense form; attach receipts; if over the limit route for approval, otherwise auto-approve; then reimburse',
  },
];
