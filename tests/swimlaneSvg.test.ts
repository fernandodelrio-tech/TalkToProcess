import { describe, it, expect } from 'vitest';
import { parseFlow } from '../src/engine/flow';
import { renderSwimlaneSvg } from '../src/render/swimlaneSvg';

describe('native gridded-swimlane renderer', () => {
  const flow = parseFlow(
    'Employee submits LOA; HRBP reviews; manager approves or denies; payroll adjusts; employee notified',
    'swimlane',
  );

  it('emits a well-formed SVG with a lane per role', () => {
    const svg = renderSwimlaneSvg(flow);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    // One header label per distinct lane (rendered as rotated text).
    for (const lane of ['Employee', 'HRBP', 'Manager', 'Payroll']) {
      expect(svg).toContain(lane);
    }
  });

  it('includes UML initial and final terminals and an arrow marker', () => {
    const svg = renderSwimlaneSvg(flow);
    expect(svg).toContain('marker id="pc-arrow"');
    expect(svg).toContain('<circle'); // initial ● / final ◉
    expect(svg).toContain('<path'); // connectors
  });

  it('renders decisions as diamonds (polygons)', () => {
    const svg = renderSwimlaneSvg(flow);
    // "approves or denies" is detected as a decision.
    expect(svg).toContain('<polygon');
  });

  it('keeps reserved XML characters out of labels', () => {
    const nasty = parseFlow('Team does <this> & that', 'swimlane');
    const svg = renderSwimlaneSvg(nasty);
    // sanitize strips < > & from labels, so no raw markup can leak into <text>.
    expect(svg).not.toContain('<this>');
    expect(svg).not.toContain('& that');
  });

  it('never throws on empty input', () => {
    expect(() => renderSwimlaneSvg(parseFlow('', 'swimlane'))).not.toThrow();
  });
});
