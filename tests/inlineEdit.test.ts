import { describe, it, expect } from 'vitest';
import { patchSource } from '../src/render/inlineEdit';

describe('patchSource — two-way sync write-back (FR-12, AC-3)', () => {
  it('renames a quoted flowchart/swimlane label', () => {
    const src = 'flowchart TD\n  n0["Submit LOA"]\n  n1["Review"]';
    const out = patchSource(src, 'Submit LOA', 'File LOA');
    expect(out).toContain('"File LOA"');
    expect(out).not.toContain('Submit LOA');
    expect(out).toContain('"Review"'); // other labels untouched
  });

  it('renames a subgraph lane title', () => {
    const src = 'flowchart LR\n  subgraph lane0["Employee"]\n  end';
    expect(patchSource(src, 'Employee', 'Team Member')).toContain('"Team Member"');
  });

  it('renames a sequence message after the colon', () => {
    const src = 'sequenceDiagram\n  Recruiter->>Manager: requests availability';
    const out = patchSource(src, 'requests availability', 'asks for slots');
    expect(out).toContain(': asks for slots');
    expect(out).not.toContain('requests availability');
  });

  it('sanitizes the new label so it cannot break the source (NFR-4)', () => {
    const src = 'flowchart TD\n  n0["Open"]';
    const out = patchSource(src, 'Open', 'Open {now} #urgent');
    expect(out).not.toContain('{');
    expect(out).not.toContain('#');
  });

  it('is a no-op when text is unchanged', () => {
    const src = 'flowchart TD\n  n0["Open"]';
    expect(patchSource(src, 'Open', 'Open')).toBe(src);
  });
});
