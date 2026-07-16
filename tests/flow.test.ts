import { describe, it, expect } from 'vitest';
import {
  parseFlow,
  flowToMermaid,
  addStep,
  removeStep,
  moveStep,
  updateStep,
  renameStepByLabel,
} from '../src/engine/flow';

describe('Flow IR — structural editing (FR-14) keeps code in sync', () => {
  const base = () =>
    parseFlow('Fill form; review details; submit request', 'flowchart');

  it('parses a description into ordered steps', () => {
    const f = base();
    expect(f.steps.map((s) => s.label)).toEqual([
      'Fill form',
      'review details',
      'submit request',
    ]);
  });

  it('adds a step after a given step and the Mermaid reflects it', () => {
    const f = base();
    const next = addStep(f, f.steps[0].id);
    expect(next.steps).toHaveLength(4);
    expect(next.steps[1].label).toBe('New step');
    expect(flowToMermaid(next)).toContain('New step');
  });

  it('removes a step', () => {
    const f = base();
    const next = removeStep(f, f.steps[1].id);
    expect(next.steps.map((s) => s.label)).toEqual(['Fill form', 'submit request']);
    expect(flowToMermaid(next)).not.toContain('review details');
  });

  it('reorders steps up/down', () => {
    const f = base();
    const moved = moveStep(f, f.steps[2].id, -1);
    expect(moved.steps.map((s) => s.label)).toEqual([
      'Fill form',
      'submit request',
      'review details',
    ]);
  });

  it('updates a step label and kind', () => {
    const f = base();
    const next = updateStep(f, f.steps[0].id, { label: 'Open form', kind: 'decision' });
    expect(next.steps[0].label).toBe('Open form');
    // A decision renders as a Mermaid diamond with Yes/No branches.
    const m = flowToMermaid(next);
    expect(m).toMatch(/\{"Open form"\}/);
    expect(m).toContain('|Yes|');
    expect(m).toContain('|No|');
  });

  it('renames a step by its label (used by inline edit)', () => {
    const f = base();
    const next = renameStepByLabel(f, 'review details', 'check details');
    expect(next).not.toBeNull();
    expect(next!.steps[1].label).toBe('check details');
    expect(renameStepByLabel(f, 'nonexistent', 'x')).toBeNull();
  });

  it('flowchart output has Start and End terminals (best practice)', () => {
    const m = flowToMermaid(base());
    expect(m).toContain('start(["Start"])');
    expect(m).toContain('done(["End"])');
  });

  it('sequence editing preserves participants and message direction', () => {
    const f = parseFlow('Recruiter requests slots from manager', 'sequence');
    const next = updateStep(f, f.steps[0].id, { from: 'Manager', to: 'Recruiter' });
    const m = flowToMermaid(next);
    expect(m).toContain('sequenceDiagram');
    expect(m).toContain('Manager->>Recruiter');
  });
});
