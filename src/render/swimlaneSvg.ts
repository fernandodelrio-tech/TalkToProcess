/**
 * Native gridded-swimlane renderer (alternative to Mermaid).
 *
 * Mermaid's flowchart auto-layout cannot produce true, equal-height parallel
 * swimlanes. This module draws them deterministically from the Flow IR: each
 * role is a horizontal lane (row) with a header column; steps are placed on a
 * grid (column = process order, row = owning lane) as UML activity nodes; and
 * consecutive steps are joined by orthogonal connectors that cross lanes.
 *
 * Output is a self-contained SVG string with vector <text> (FR-9) that pans,
 * zooms, exports, and supports click-to-rename exactly like the Mermaid render.
 * No dependencies — fully offline (NFR-1).
 */

import type { Flow, Step } from '../engine/flow';
import { sanitizeLabel } from '../engine/sanitize';

// Layout metrics (px).
const HEADER_W = 132;
const GUTTER = 92; // room for initial/final terminals
const COL_W = 196;
const ROW_H = 116;
const PAD = 20;
const NODE_W = 152;
const NODE_H = 56;
const DIAMOND_W = 128;
const DIAMOND_H = 80;

// Palette — explicit (not CSS vars) so exported SVG renders standalone. Tuned
// to read on a white export background and both light/dark canvases.
const C = {
  laneA: '#eef2fb',
  laneB: '#e6ecf8',
  laneEdge: '#c4c6d0',
  laneText: '#334',
  node: '#dbe6fd',
  nodeEdge: '#0b57d0',
  decision: '#fbeccb',
  decisionEdge: '#7c5800',
  text: '#1a1c1e',
  edge: '#5f6368',
  terminalFill: '#1a1c1e',
  terminalRing: '#1a1c1e',
};

interface Placed {
  step: Step;
  col: number;
  row: number;
  cx: number;
  cy: number;
}

export function renderSwimlaneSvg(flow: Flow): string {
  const steps = flow.steps.length
    ? flow.steps
    : [{ id: 'x', label: 'No steps', kind: 'step' as const, lane: 'Lane' }];

  const lanes = [...new Set(steps.map((s) => s.lane || 'Lane'))];
  const laneRow = new Map(lanes.map((l, i) => [l, i]));

  const placed: Placed[] = steps.map((step, col) => {
    const row = laneRow.get(step.lane || 'Lane') ?? 0;
    return {
      step,
      col,
      row,
      cx: HEADER_W + GUTTER + col * COL_W + COL_W / 2,
      cy: PAD + row * ROW_H + ROW_H / 2,
    };
  });

  const width = HEADER_W + GUTTER * 2 + steps.length * COL_W + PAD;
  const height = PAD * 2 + lanes.length * ROW_H;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
      `viewBox="0 0 ${width} ${height}" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">`,
  );
  parts.push(defs());

  // Lanes (bands + header).
  lanes.forEach((lane, i) => {
    const y = PAD + i * ROW_H;
    const fill = i % 2 === 0 ? C.laneA : C.laneB;
    parts.push(
      `<rect x="${PAD}" y="${y}" width="${width - PAD * 2}" height="${ROW_H}" fill="${fill}" stroke="${C.laneEdge}" />`,
    );
    // Header cell.
    parts.push(
      `<rect x="${PAD}" y="${y}" width="${HEADER_W}" height="${ROW_H}" fill="${fill}" stroke="${C.laneEdge}" />`,
    );
    parts.push(
      verticalText(PAD + HEADER_W / 2, y + ROW_H / 2, sanitizeLabel(lane, 'Lane')),
    );
  });

  // Terminals.
  const firstRow = placed[0].row;
  const lastRow = placed[placed.length - 1].row;
  const initX = HEADER_W + GUTTER / 2;
  const initY = PAD + firstRow * ROW_H + ROW_H / 2;
  const finalX = HEADER_W + GUTTER + steps.length * COL_W + GUTTER / 2;
  const finalY = PAD + lastRow * ROW_H + ROW_H / 2;

  // Connectors first (under nodes).
  parts.push(connector(initX, initY, leftEdge(placed[0]), placed[0].cy));
  for (let i = 0; i < placed.length - 1; i++) {
    parts.push(connector(rightEdge(placed[i]), placed[i].cy, leftEdge(placed[i + 1]), placed[i + 1].cy));
  }
  const last = placed[placed.length - 1];
  parts.push(connector(rightEdge(last), last.cy, finalX - 14, finalY));

  // Terminals (initial ● / final ◉).
  parts.push(`<circle cx="${initX}" cy="${initY}" r="9" fill="${C.terminalFill}" />`);
  parts.push(
    `<circle cx="${finalX}" cy="${finalY}" r="13" fill="none" stroke="${C.terminalRing}" stroke-width="2.5" />` +
      `<circle cx="${finalX}" cy="${finalY}" r="7" fill="${C.terminalFill}" />`,
  );

  // Nodes.
  for (const p of placed) {
    parts.push(p.step.kind === 'decision' ? diamond(p) : rounded(p));
  }

  parts.push('</svg>');
  return parts.join('\n');
}

// --- node geometry --------------------------------------------------------

function leftEdge(p: Placed): number {
  return p.cx - (p.step.kind === 'decision' ? DIAMOND_W : NODE_W) / 2;
}
function rightEdge(p: Placed): number {
  return p.cx + (p.step.kind === 'decision' ? DIAMOND_W : NODE_W) / 2;
}

function rounded(p: Placed): string {
  const x = p.cx - NODE_W / 2;
  const y = p.cy - NODE_H / 2;
  return (
    `<rect x="${x}" y="${y}" width="${NODE_W}" height="${NODE_H}" rx="12" ` +
    `fill="${C.node}" stroke="${C.nodeEdge}" stroke-width="1.5" />` +
    wrappedText(p.cx, p.cy, p.step.label, NODE_W - 20)
  );
}

function diamond(p: Placed): string {
  const w = DIAMOND_W / 2;
  const h = DIAMOND_H / 2;
  const pts = `${p.cx},${p.cy - h} ${p.cx + w},${p.cy} ${p.cx},${p.cy + h} ${p.cx - w},${p.cy}`;
  return (
    `<polygon points="${pts}" fill="${C.decision}" stroke="${C.decisionEdge}" stroke-width="1.5" />` +
    wrappedText(p.cx, p.cy, p.step.label, DIAMOND_W - 8)
  );
}

// --- connectors -----------------------------------------------------------

/** Orthogonal connector from (x1,y1) to (x2,y2) with an arrowhead at the end. */
function connector(x1: number, y1: number, x2: number, y2: number): string {
  let d: string;
  if (Math.abs(y1 - y2) < 1) {
    d = `M ${x1} ${y1} L ${x2} ${y2}`;
  } else {
    const midX = x1 + (x2 - x1) / 2;
    d = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
  }
  return `<path d="${d}" fill="none" stroke="${C.edge}" stroke-width="1.6" marker-end="url(#pc-arrow)" />`;
}

// --- text -----------------------------------------------------------------

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Center label, wrapped to at most 3 lines to fit `maxW`. */
function wrappedText(cx: number, cy: number, label: string, maxW: number): string {
  const text = sanitizeLabel(label, 'Step');
  const lines = wrap(text, maxW);
  const lh = 15;
  const startY = cy - ((lines.length - 1) * lh) / 2;
  const spans = lines
    .map(
      (line, i) =>
        `<text x="${cx}" y="${startY + i * lh}" text-anchor="middle" dominant-baseline="central" ` +
        `font-size="12.5" fill="${C.text}" data-pc-editable>${esc(line)}</text>`,
    )
    .join('');
  return spans;
}

function verticalText(cx: number, cy: number, label: string): string {
  return (
    `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" ` +
    `font-size="12.5" font-weight="600" fill="${C.laneText}" ` +
    `transform="rotate(-90 ${cx} ${cy})">${esc(label)}</text>`
  );
}

/** Greedy word-wrap using an average glyph width estimate. */
function wrap(text: string, maxW: number): string[] {
  const charW = 6.6;
  const maxChars = Math.max(6, Math.floor(maxW / charW));
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = w;
    } else {
      line = candidate;
    }
    if (lines.length === 2 && line.length > maxChars) break; // cap at 3 lines
  }
  if (line) lines.push(line);
  if (lines.length > 3) {
    lines.length = 3;
    lines[2] = lines[2].replace(/.{1}$/, '…');
  }
  return lines;
}

function defs(): string {
  return (
    '<defs>' +
    `<marker id="pc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">` +
    `<path d="M 0 0 L 10 5 L 0 10 z" fill="${C.edge}" />` +
    '</marker>' +
    '</defs>'
  );
}
