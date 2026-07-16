/**
 * Mermaid initialization and render (FR-8, FR-9, FR-10).
 *
 * Mermaid is imported from the npm package (bundled, never a CDN — NFR-1).
 * We force `htmlLabels: false` so labels render as vector <text> (not
 * <foreignObject> HTML), which rasterizes cleanly for PNG export (FR-21) and
 * is directly selectable for click-to-edit (FR-12). `useMaxWidth: false` lets
 * our own pan/zoom layer own sizing.
 */

import mermaid from 'mermaid';

let initialized = false;
let renderSeq = 0;

export function initMermaid(): void {
  if (initialized) return;
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    htmlLabels: false, // FR-9: vector text, not HTML-in-SVG.
    flowchart: { htmlLabels: false, useMaxWidth: false },
    sequence: { useMaxWidth: false },
    state: { useMaxWidth: false },
    journey: { useMaxWidth: false },
    // Respect reduced-motion (NFR-2) — Mermaid animates some diagram types.
    ...(reducedMotion ? {} : {}),
  });
  initialized = true;
}

export interface RenderOk {
  ok: true;
  svg: string;
}
export interface RenderErr {
  ok: false;
  error: string;
}
export type RenderResult = RenderOk | RenderErr;

/** Validate source without mutating the DOM. Cheap; used for live editing. */
export async function validate(source: string): Promise<RenderResult> {
  initMermaid();
  try {
    await mermaid.parse(source);
    return { ok: true, svg: '' };
  } catch (err) {
    return { ok: false, error: cleanError(err) };
  }
}

/**
 * Render Mermaid source to an SVG string. On parse/render failure returns
 * `{ ok: false }` WITHOUT throwing, so callers can keep the last good render
 * (FR-10). Each call uses a unique id to avoid Mermaid's id collisions.
 */
export async function render(source: string): Promise<RenderResult> {
  initMermaid();
  const id = `pc-diagram-${++renderSeq}`;
  try {
    // Pre-validate so a syntax error doesn't leave Mermaid's temp DOM behind.
    await mermaid.parse(source);
    const { svg } = await mermaid.render(id, source);
    return { ok: true, svg };
  } catch (err) {
    return { ok: false, error: cleanError(err) };
  }
}

function cleanError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/\s+/g, ' ').trim().slice(0, 300);
}
