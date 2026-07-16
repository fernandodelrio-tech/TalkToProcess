import { useCallback, useEffect, useRef, useState } from 'react';
import type { ModelId, EngineKind } from './engine/models';
import { compose, recomposeAs } from './engine/compose';
import { validate } from './render/mermaidRender';
import { copyText, downloadSvg, downloadPng, copyImage } from './render/export';
import {
  makeEntry,
  loadHistory,
  saveHistory,
  type HistoryEntry,
} from './state/history';
import { InputPanel } from './ui/InputPanel';
import { ModelSelector } from './ui/ModelSelector';
import { DiagramCanvas, type CanvasHandle } from './ui/DiagramCanvas';
import { Toolbar } from './ui/Toolbar';
import { SourcePanel } from './ui/SourcePanel';
import { HistoryList } from './ui/HistoryList';

const DEBOUNCE_MS = 250; // FR-11 live-but-debounced re-render.

export default function App() {
  const [description, setDescription] = useState('');
  const [composing, setComposing] = useState(false);
  const [hasResult, setHasResult] = useState(false);

  const [model, setModel] = useState<ModelId>('flowchart');
  const [rationale, setRationale] = useState('');
  const [engine, setEngine] = useState<EngineKind>('on-device');

  // `source` is the live edit buffer; `renderSource` only updates when valid,
  // so an invalid edit keeps the last good render (FR-10).
  const [source, setSource] = useState('');
  const [renderSource, setRenderSource] = useState('');
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [lastComposedSource, setLastComposedSource] = useState('');

  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [scale, setScale] = useState(1);
  const [status, setStatus] = useState<string | null>(null);

  const canvasRef = useRef<CanvasHandle>(null);
  const clock = useRef(0);

  // Debounced validation of the live source buffer.
  useEffect(() => {
    if (!source) return;
    const t = setTimeout(async () => {
      const res = await validate(source);
      if (res.ok) {
        setSourceError(null);
        setRenderSource(source);
      } else {
        setSourceError(res.error);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [source]);

  const flashStatus = useCallback((msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(null), 1800);
  }, []);

  const applyResult = useCallback(
    (nextSource: string, nextModel: ModelId, nextRationale: string, nextEngine: EngineKind) => {
      setModel(nextModel);
      setRationale(nextRationale);
      setEngine(nextEngine);
      setSource(nextSource);
      setRenderSource(nextSource);
      setLastComposedSource(nextSource);
      setSourceError(null);
      setHasResult(true);
    },
    [],
  );

  const doCompose = useCallback(async () => {
    if (!description.trim() || composing) return;
    setComposing(true);
    try {
      const out = await compose(description);
      applyResult(out.result.mermaid, out.result.model, out.result.rationale, out.engine);
      clock.current += 1;
      const entry = makeEntry(description, out.result, out.engine, clock.current);
      setHistory((prev) => {
        const next = [entry, ...prev].slice(0, 50);
        saveHistory(next, false); // in-memory by default (privacy — NFR-10).
        return next;
      });
      requestAnimationFrame(() => canvasRef.current?.fit());
    } finally {
      setComposing(false);
    }
  }, [description, composing, applyResult]);

  const overrideModel = useCallback(
    (m: ModelId) => {
      const result = recomposeAs(description || sourceToDescription(source), m);
      applyResult(result.mermaid, result.model, result.rationale, 'on-device');
      requestAnimationFrame(() => canvasRef.current?.fit());
    },
    [description, source, applyResult],
  );

  const revert = useCallback(() => {
    if (!lastComposedSource) return;
    setSource(lastComposedSource);
    setRenderSource(lastComposedSource);
    setSourceError(null);
    flashStatus('Reverted to generated');
  }, [lastComposedSource, flashStatus]);

  const restore = useCallback(
    (entry: HistoryEntry) => {
      setDescription(entry.description);
      applyResult(entry.result.mermaid, entry.result.model, entry.result.rationale, entry.engine);
      requestAnimationFrame(() => canvasRef.current?.fit());
    },
    [applyResult],
  );

  // Export handlers.
  const onCopyMermaid = useCallback(async () => {
    await copyText(source);
    flashStatus('Source copied');
  }, [source, flashStatus]);

  const withSvg = useCallback(
    async (fn: (svg: SVGSVGElement) => Promise<void> | void, ok: string) => {
      const svg = canvasRef.current?.getSvg();
      if (!svg) return;
      try {
        await fn(svg);
        flashStatus(ok);
      } catch (err) {
        flashStatus(`Failed: ${(err as Error).message}`);
      }
    },
    [flashStatus],
  );

  return (
    <div className="app">
      <header className="app__header">
        <h1>Process Compositor</h1>
        <span className="subtitle">
          Describe a process — it picks the best-fit diagram and explains why.
        </span>
      </header>

      <div className="app__main">
        <aside className="panel">
          <InputPanel
            value={description}
            onChange={setDescription}
            onCompose={doCompose}
            composing={composing}
          />
          <ModelSelector
            selected={model}
            rationale={rationale}
            engine={engine}
            onOverride={overrideModel}
            hasResult={hasResult}
          />
          <HistoryList entries={history} onRestore={restore} />
        </aside>

        <main className="workspace">
          <Toolbar
            scale={scale}
            onZoomIn={() => canvasRef.current?.zoomIn()}
            onZoomOut={() => canvasRef.current?.zoomOut()}
            onFit={() => canvasRef.current?.fit()}
            onCopyMermaid={onCopyMermaid}
            onDownloadSvg={() => withSvg((svg) => downloadSvg(svg), 'SVG downloaded')}
            onDownloadPng={() => withSvg((svg) => downloadPng(svg), 'PNG downloaded')}
            onCopyImage={() => withSvg((svg) => copyImage(svg), 'Image copied')}
            onRevert={revert}
            canRevert={hasResult && source !== lastComposedSource}
            status={status}
          />
          <DiagramCanvas
            ref={canvasRef}
            source={renderSource}
            onSourceChange={setSource}
            onZoom={setScale}
            error={sourceError}
          />
          {hasResult && (
            <SourcePanel source={source} onChange={setSource} error={sourceError} />
          )}
        </main>
      </div>
    </div>
  );
}

/** When overriding after manual source edits with no description, fall back to
 *  a rough description reconstructed from the source's text (best-effort). */
function sourceToDescription(source: string): string {
  return source.replace(/[\n]+/g, '; ');
}
