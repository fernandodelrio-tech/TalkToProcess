import { useCallback, useEffect, useRef, useState } from 'react';
import type { ModelId, EngineKind } from './engine/models';
import { compose } from './engine/compose';
import {
  type Flow,
  parseFlow,
  flowToMermaid,
  renameStepByLabel,
} from './engine/flow';
import { validate } from './render/mermaidRender';
import { copyText, downloadSvg, downloadPng, copyImage } from './render/export';
import { makeEntry, loadHistory, saveHistory, type HistoryEntry } from './state/history';
import { InputPanel } from './ui/InputPanel';
import { ModelSelector } from './ui/ModelSelector';
import { ElementsEditor } from './ui/ElementsEditor';
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

  // The Flow IR is canonical: structural edits mutate it and regenerate source.
  const [flow, setFlow] = useState<Flow | null>(null);

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

  /** Adopt a Flow as the source of truth and render it. */
  const applyFlow = useCallback(
    (nextFlow: Flow, nextRationale: string, nextEngine: EngineKind, fit = true) => {
      const src = flowToMermaid(nextFlow);
      setFlow(nextFlow);
      setModel(nextFlow.model);
      setRationale(nextRationale);
      setEngine(nextEngine);
      setSource(src);
      setRenderSource(src);
      setLastComposedSource(src);
      setSourceError(null);
      setHasResult(true);
      if (fit) requestAnimationFrame(() => canvasRef.current?.fit());
    },
    [],
  );

  const doCompose = useCallback(async () => {
    if (!description.trim() || composing) return;
    setComposing(true);
    try {
      const out = await compose(description);
      const f = parseFlow(description, out.result.model);
      applyFlow(f, out.result.rationale, out.engine);
      clock.current += 1;
      const entry = makeEntry(description, out.result, out.engine, clock.current);
      setHistory((prev) => {
        const next = [entry, ...prev].slice(0, 50);
        saveHistory(next, false); // in-memory by default (privacy — NFR-10).
        return next;
      });
    } finally {
      setComposing(false);
    }
  }, [description, composing, applyFlow]);

  const overrideModel = useCallback(
    (m: ModelId) => {
      const src = description || sourceToDescription(source);
      applyFlow(parseFlow(src, m), `Rendered as ${m} (user-selected).`, 'on-device');
    },
    [description, source, applyFlow],
  );

  // Structural edit from the Elements editor: regenerate + re-render live.
  const editFlow = useCallback(
    (next: Flow) => {
      setFlow(next);
      const src = flowToMermaid(next);
      setSource(src);
      setRenderSource(src);
      setSourceError(null);
    },
    [],
  );

  // Inline rename routed through the IR (returns true if handled).
  const renameLabel = useCallback(
    (oldLabel: string, newLabel: string): boolean => {
      if (!flow || source !== flowToMermaid(flow)) return false; // source hand-edited
      const next = renameStepByLabel(flow, oldLabel, newLabel);
      if (!next) return false;
      editFlow(next);
      return true;
    },
    [flow, source, editFlow],
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
      applyFlow(parseFlow(entry.description, entry.result.model), entry.result.rationale, entry.engine);
    },
    [applyFlow],
  );

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

  const outOfSync = !!flow && source !== flowToMermaid(flow);

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__logo" aria-hidden="true" />
          <div>
            <h1>Process Compositor</h1>
            <span className="subtitle">
              Describe a process — it picks the best-fit diagram and explains why.
            </span>
          </div>
        </div>
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
          {flow && <ElementsEditor flow={flow} onChange={editFlow} outOfSync={outOfSync} />}
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
            onRenameLabel={renameLabel}
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

/** When overriding after manual source edits with no description, reconstruct a
 *  rough description from the source text (best-effort). */
function sourceToDescription(source: string): string {
  return source.replace(/[\n]+/g, '; ');
}
