import { describe, it, expect } from 'vitest';
import { parseDelimitedResponse, LlmError, isModelBackedAvailable } from '../src/engine/llm';
import { compose } from '../src/engine/compose';

describe('delimited-response parser (§6 contract)', () => {
  it('parses a well-formed multi-line response', () => {
    const raw = [
      'MODEL: swimlane',
      'TITLE: LOA Approval',
      'RATIONALE: Multiple roles hand off steps.',
      'MERMAID:',
      'flowchart LR',
      '  subgraph Employee',
      '    n0["Submit LOA"]',
      '  end',
    ].join('\n');
    const r = parseDelimitedResponse(raw);
    expect(r.model).toBe('swimlane');
    expect(r.title).toBe('LOA Approval');
    expect(r.mermaid).toContain('flowchart LR');
    expect(r.mermaid).toContain('subgraph Employee');
  });

  it('throws on an unknown model', () => {
    const raw = 'MODEL: bogus\nTITLE: x\nRATIONALE: y\nMERMAID:\nflowchart TD';
    expect(() => parseDelimitedResponse(raw)).toThrow(LlmError);
  });

  it('throws on an empty mermaid body', () => {
    const raw = 'MODEL: flowchart\nTITLE: x\nRATIONALE: y\nMERMAID:\n   ';
    expect(() => parseDelimitedResponse(raw)).toThrow(LlmError);
  });
});

describe('two-engine fallback (FR-27, AC-1)', () => {
  it('is on-device by default (no proxy configured)', () => {
    expect(isModelBackedAvailable({})).toBe(false);
  });

  it('composes on-device when no proxy is available', async () => {
    const out = await compose('Support ticket opens, pending, resolved, closed');
    expect(out.engine).toBe('on-device');
    expect(out.result.mermaid.length).toBeGreaterThan(0);
  });
});
