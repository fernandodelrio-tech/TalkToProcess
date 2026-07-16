import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { render } from '../render/mermaidRender';
import { PanZoom } from '../render/panzoom';
import { enableInlineEdit } from '../render/inlineEdit';

export interface CanvasHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  reset: () => void;
  getSvg: () => SVGSVGElement | null;
}

interface Props {
  /** Already-validated Mermaid source (App only passes sources that parse). */
  source: string;
  /** When set, this SVG is rendered instead of the Mermaid source (native
   *  swimlane renderer). It is regenerated from the Flow IR by App. */
  customSvg?: string | null;
  /** Called when inline label editing patches the source (FR-12). */
  onSourceChange: (next: string) => void;
  /** Structured rename via the Flow IR; returns true if it handled the rename. */
  onRenameLabel?: (oldLabel: string, newLabel: string) => boolean;
  /** Reports live zoom for the toolbar readout. */
  onZoom?: (scale: number) => void;
  /** Non-destructive error to surface over the last good render (FR-10). */
  error: string | null;
}

/**
 * Renders the Mermaid diagram and owns pan/zoom + click-to-rename. App feeds it
 * only valid sources, so an invalid edit leaves the last good render untouched
 * (FR-10); App surfaces the error, echoed here as a banner.
 */
export const DiagramCanvas = forwardRef<CanvasHandle, Props>(function DiagramCanvas(
  { source, customSvg, onSourceChange, onRenameLabel, onZoom, error },
  ref,
) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const panzoomRef = useRef<PanZoom | null>(null);
  const cleanupEditRef = useRef<() => void>(() => {});
  const hasRenderedRef = useRef(false);
  const onSourceChangeRef = useRef(onSourceChange);
  onSourceChangeRef.current = onSourceChange;
  const onRenameLabelRef = useRef(onRenameLabel);
  onRenameLabelRef.current = onRenameLabel;

  useEffect(() => {
    if (!viewportRef.current || !contentRef.current) return;
    const pz = new PanZoom(viewportRef.current, contentRef.current, (s) => onZoom?.(s.scale));
    panzoomRef.current = pz;
    return () => pz.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    zoomIn: () => panzoomRef.current?.zoomIn(),
    zoomOut: () => panzoomRef.current?.zoomOut(),
    fit: () => panzoomRef.current?.fit(),
    reset: () => panzoomRef.current?.reset(),
    getSvg: () => contentRef.current?.querySelector('svg') ?? null,
  }));

  useEffect(() => {
    let cancelled = false;

    const paint = (svgMarkup: string) => {
      if (cancelled || !contentRef.current) return;
      contentRef.current.innerHTML = svgMarkup;
      const svg = contentRef.current.querySelector('svg');
      if (svg) svg.style.maxWidth = 'none'; // FR-9: our pan/zoom owns sizing.
      cleanupEditRef.current();
      cleanupEditRef.current = enableInlineEdit(contentRef.current, {
        getSource: () => source,
        setSource: (next) => onSourceChangeRef.current(next),
        renameInFlow: (oldL, newL) => onRenameLabelRef.current?.(oldL, newL) ?? false,
      });
      if (!hasRenderedRef.current) {
        hasRenderedRef.current = true;
        requestAnimationFrame(() => panzoomRef.current?.fit());
      }
    };

    // Native renderer takes precedence over Mermaid when provided.
    if (customSvg) {
      paint(customSvg);
      return () => {
        cancelled = true;
      };
    }

    if (!source) return;
    (async () => {
      const result = await render(source);
      if (result.ok) paint(result.svg);
    })();
    return () => {
      cancelled = true;
    };
  }, [source, customSvg]);

  return (
    <div className="canvas-viewport" ref={viewportRef} aria-label="Diagram canvas">
      <div className="canvas-content" ref={contentRef} />
      {error && (
        <div className="error-banner" role="status">
          Diagram error (showing last good render): {error}
        </div>
      )}
    </div>
  );
});
