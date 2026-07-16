import { describe, it, expect } from 'vitest';
import { sanitizeLabel, quoted, safeId } from '../src/engine/sanitize';

describe('sanitize (NFR-4)', () => {
  it('strips reserved characters that break Mermaid', () => {
    const out = sanitizeLabel('Approve #1 {urgent} <manager> | payroll & HR');
    for (const ch of ['#', '{', '}', '<', '>', '|', '&']) {
      expect(out).not.toContain(ch);
    }
  });

  it('removes quotes so they can never be unbalanced', () => {
    expect(quoted('say "hello')).toBe('"say hello"');
    expect(quoted("it's fine")).not.toContain("'");
  });

  it('collapses whitespace and newlines', () => {
    expect(sanitizeLabel('a\n\n  b\t c')).toBe('a b c');
  });

  it('falls back when the result would be empty', () => {
    expect(sanitizeLabel('###', 'Step')).toBe('Step');
    expect(sanitizeLabel('', 'Fallback')).toBe('Fallback');
  });

  it('produces valid ids', () => {
    expect(safeId('n', 3)).toBe('n3');
  });
});
