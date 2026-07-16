interface Props {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onCopyMermaid: () => void;
  onDownloadSvg: () => void;
  onDownloadPng: () => void;
  onCopyImage: () => void;
  onRevert: () => void;
  canRevert: boolean;
  status: string | null;
}

/** Navigation + export controls (FR-15..22, FR-13). Keyboard-reachable (NFR-2). */
export function Toolbar({
  scale,
  onZoomIn,
  onZoomOut,
  onFit,
  onCopyMermaid,
  onDownloadSvg,
  onDownloadPng,
  onCopyImage,
  onRevert,
  canRevert,
  status,
}: Props) {
  return (
    <div className="toolbar" role="toolbar" aria-label="Diagram tools">
      <button onClick={onZoomOut} aria-label="Zoom out">
        −
      </button>
      <span className="zoom-readout" aria-live="off">
        {Math.round(scale * 100)}%
      </span>
      <button onClick={onZoomIn} aria-label="Zoom in">
        +
      </button>
      <button onClick={onFit} aria-label="Fit diagram to frame">
        Fit
      </button>

      <span className="spacer" />

      {status && (
        <span className="chip chip--teal" role="status">
          {status}
        </span>
      )}

      <button onClick={onRevert} disabled={!canRevert} title="Restore the last composed version">
        Revert
      </button>
      <button onClick={onCopyMermaid} aria-label="Copy Mermaid source">
        Copy source
      </button>
      <button onClick={onDownloadSvg} aria-label="Download SVG">
        SVG
      </button>
      <button onClick={onDownloadPng} aria-label="Download PNG">
        PNG
      </button>
      <button onClick={onCopyImage} aria-label="Copy image to clipboard">
        Copy image
      </button>
    </div>
  );
}
