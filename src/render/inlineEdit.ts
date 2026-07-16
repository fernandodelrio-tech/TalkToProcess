/**
 * Click-to-rename inline editing (FR-12, AC-3).
 *
 * After a render, every SVG text label is made clickable. Clicking one opens a
 * small input positioned over the label; committing patches the Mermaid source
 * so the diagram and source stay in sync. Because labels render as vector text
 * (htmlLabels:false, FR-9), `textContent` gives us the exact visible string.
 */

import { sanitizeLabel } from '../engine/sanitize';

export interface InlineEditHandlers {
  getSource: () => string;
  setSource: (next: string) => void;
}

/**
 * Wire up inline editing on the rendered SVG inside `contentEl`. Returns a
 * cleanup function. Safe to call after every render.
 */
export function enableInlineEdit(
  contentEl: HTMLElement,
  handlers: InlineEditHandlers,
): () => void {
  const svg = contentEl.querySelector('svg');
  if (!svg) return () => {};

  const texts = Array.from(svg.querySelectorAll('text')) as SVGTextElement[];
  const cleanups: (() => void)[] = [];

  for (const text of texts) {
    if (!text.textContent || !text.textContent.trim()) continue;
    text.setAttribute('data-pc-editable', '');
    (text as unknown as SVGElement).style.cursor = 'text';
    const onClick = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      beginEdit(text, handlers);
    };
    text.addEventListener('click', onClick);
    cleanups.push(() => text.removeEventListener('click', onClick));
  }

  return () => cleanups.forEach((fn) => fn());
}

function beginEdit(text: SVGTextElement, handlers: InlineEditHandlers): void {
  const oldLabel = (text.textContent || '').trim();
  const rect = text.getBoundingClientRect();

  const input = document.createElement('input');
  input.type = 'text';
  input.value = oldLabel;
  input.className = 'pc-inline-input';
  input.setAttribute('aria-label', 'Rename label');
  Object.assign(input.style, {
    position: 'fixed',
    left: `${Math.max(4, rect.left - 4)}px`,
    top: `${Math.max(4, rect.top - 4)}px`,
    minWidth: `${Math.max(80, rect.width + 16)}px`,
    zIndex: '1000',
  });

  const commit = () => {
    const next = sanitizeLabel(input.value, oldLabel);
    cleanup();
    if (next && next !== oldLabel) {
      const patched = patchSource(handlers.getSource(), oldLabel, next);
      handlers.setSource(patched);
    }
  };
  const cancel = () => cleanup();

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  };
  const onBlur = () => commit();

  function cleanup() {
    input.removeEventListener('keydown', onKey);
    input.removeEventListener('blur', onBlur);
    input.remove();
  }

  input.addEventListener('keydown', onKey);
  input.addEventListener('blur', onBlur);
  document.body.appendChild(input);
  input.focus();
  input.select();
}

/**
 * Replace the first occurrence of `oldText` with `newText` in the Mermaid
 * source, preferring the most specific context (quoted label, then a
 * post-colon event/message, then a word-bounded occurrence). Exported for tests.
 */
export function patchSource(source: string, oldText: string, newText: string): string {
  const o = oldText.trim();
  const n = sanitizeLabel(newText, o);
  if (!o || o === n) return source;

  // 1. Quoted labels: flowchart/swimlane nodes and subgraph titles.
  const quoted = `"${o}"`;
  if (source.includes(quoted)) return source.replace(quoted, `"${n}"`);

  // 2. Event/message text following a colon (timeline / journey / sequence).
  const afterColon = new RegExp(`(:\\s*)${escapeRe(o)}(?=\\s*(?::|$|\\n))`, 'm');
  if (afterColon.test(source)) return source.replace(afterColon, `$1${n}`);

  // 3. Word-bounded standalone occurrence.
  const bounded = new RegExp(`(?<![\\w"])${escapeRe(o)}(?![\\w"])`);
  if (bounded.test(source)) return source.replace(bounded, n);

  // 4. Last resort: raw first occurrence.
  return source.replace(o, n);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
