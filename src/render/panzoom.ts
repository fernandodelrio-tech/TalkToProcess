/**
 * Pan/zoom controller (FR-15, FR-16, FR-17, FR-18).
 *
 * Operates on a viewport element (the clipping frame) and a content element
 * (holding the rendered SVG). Applies a CSS transform `translate(x,y) scale(k)`.
 * - Scroll wheel zooms toward the cursor.
 * - Dragging the canvas pans.
 * - `fit` scales the whole diagram to the frame (true fit, not reset-to-100%).
 */

export const MIN_SCALE = 0.2; // FR-18
export const MAX_SCALE = 6; // FR-18

export interface PanZoomState {
  x: number;
  y: number;
  scale: number;
}

export type OnChange = (state: PanZoomState) => void;

export class PanZoom {
  private viewport: HTMLElement;
  private content: HTMLElement;
  private state: PanZoomState = { x: 0, y: 0, scale: 1 };
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private onChange?: OnChange;
  private detachFns: (() => void)[] = [];

  constructor(viewport: HTMLElement, content: HTMLElement, onChange?: OnChange) {
    this.viewport = viewport;
    this.content = content;
    this.onChange = onChange;
    this.attach();
  }

  private attach(): void {
    const wheel = (e: WheelEvent) => this.onWheel(e);
    const down = (e: PointerEvent) => this.onPointerDown(e);
    const move = (e: PointerEvent) => this.onPointerMove(e);
    const up = () => this.onPointerUp();

    this.viewport.addEventListener('wheel', wheel, { passive: false });
    this.viewport.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);

    this.detachFns.push(
      () => this.viewport.removeEventListener('wheel', wheel),
      () => this.viewport.removeEventListener('pointerdown', down),
      () => window.removeEventListener('pointermove', move),
      () => window.removeEventListener('pointerup', up),
    );
  }

  destroy(): void {
    this.detachFns.forEach((fn) => fn());
    this.detachFns = [];
  }

  getState(): PanZoomState {
    return { ...this.state };
  }

  private apply(): void {
    const { x, y, scale } = this.state;
    this.content.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    this.content.style.transformOrigin = '0 0';
    this.onChange?.(this.getState());
  }

  private clampScale(s: number): number {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const rect = this.viewport.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    // Zoom factor from wheel delta; ctrlKey (pinch) uses a finer step.
    const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.02 : 0.0015));
    this.zoomAt(px, py, factor);
  }

  /** Zoom by `factor` keeping the point (px,py) in viewport space fixed. */
  zoomAt(px: number, py: number, factor: number): void {
    const prev = this.state.scale;
    const next = this.clampScale(prev * factor);
    const ratio = next / prev;
    // Keep the cursor anchored: new_offset = point - ratio*(point - old_offset)
    this.state.x = px - ratio * (px - this.state.x);
    this.state.y = py - ratio * (py - this.state.y);
    this.state.scale = next;
    this.apply();
  }

  /** Zoom around the viewport center (button controls). */
  zoomBy(factor: number): void {
    const rect = this.viewport.getBoundingClientRect();
    this.zoomAt(rect.width / 2, rect.height / 2, factor);
  }

  zoomIn(): void {
    this.zoomBy(1.2);
  }
  zoomOut(): void {
    this.zoomBy(1 / 1.2);
  }

  private onPointerDown(e: PointerEvent): void {
    // Let clicks on interactive labels through (handled by inlineEdit).
    if ((e.target as HTMLElement)?.closest('[data-pc-editable]')) return;
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.viewport.classList.add('is-panning');
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.dragging) return;
    this.state.x += e.clientX - this.lastX;
    this.state.y += e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.apply();
  }

  private onPointerUp(): void {
    this.dragging = false;
    this.viewport.classList.remove('is-panning');
  }

  reset(): void {
    this.state = { x: 0, y: 0, scale: 1 };
    this.apply();
  }

  /**
   * FR-17 — scale the whole diagram to fit the frame with padding, centered.
   * Reads the intrinsic size of the SVG inside the content element.
   */
  fit(padding = 24): void {
    const svg = this.content.querySelector('svg');
    if (!svg) return;
    const vw = this.viewport.clientWidth;
    const vh = this.viewport.clientHeight;
    const { width, height } = intrinsicSize(svg);
    if (!width || !height || !vw || !vh) return;

    const scale = this.clampScale(
      Math.min((vw - padding * 2) / width, (vh - padding * 2) / height),
    );
    this.state.scale = scale;
    this.state.x = (vw - width * scale) / 2;
    this.state.y = (vh - height * scale) / 2;
    this.apply();
  }
}

/** Best-effort intrinsic size of a rendered Mermaid SVG. */
function intrinsicSize(svg: SVGSVGElement): { width: number; height: number } {
  const vb = svg.viewBox?.baseVal;
  if (vb && vb.width && vb.height) return { width: vb.width, height: vb.height };
  const bbox = typeof svg.getBBox === 'function' ? safeBBox(svg) : null;
  if (bbox && bbox.width && bbox.height) return { width: bbox.width, height: bbox.height };
  return {
    width: parseFloat(svg.getAttribute('width') || '0'),
    height: parseFloat(svg.getAttribute('height') || '0'),
  };
}

function safeBBox(svg: SVGSVGElement): DOMRect | null {
  try {
    return svg.getBBox();
  } catch {
    return null;
  }
}
