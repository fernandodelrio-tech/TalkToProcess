/**
 * Label sanitization (NFR-4).
 *
 * Reserved characters (`# & < > | { }`) and unbalanced quotes can break Mermaid
 * rendering regardless of which engine produced the label. Every builder routes
 * its user-derived text through `sanitizeLabel` before emitting Mermaid.
 */

/**
 * Characters that have structural meaning in Mermaid and must be neutralized.
 * Includes `:` (separates timeline periods, journey scores, and sequence
 * messages) and backtick, which otherwise break rendering when they appear
 * inside a label — e.g. a sequence message containing "2026: discovery".
 */
const RESERVED = /[#&<>|{}[\]()"';:`]/g;

/**
 * Clean a single label for safe embedding inside a Mermaid node/edge/actor.
 *
 * - Strips reserved characters that would terminate or reshape the diagram.
 * - Collapses whitespace/newlines to single spaces.
 * - Trims and guards against an empty result.
 */
export function sanitizeLabel(raw: string, fallback = 'Step'): string {
  if (raw == null) return fallback;
  const cleaned = String(raw)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(RESERVED, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > 0 ? cleaned : fallback;
}

/**
 * Sanitize a label AND wrap it in double quotes for Mermaid contexts that
 * accept quoted strings (flowchart node text, subgraph titles). Because
 * `sanitizeLabel` already removes quotes, the result can never contain an
 * unbalanced quote.
 */
export function quoted(raw: string, fallback = 'Step'): string {
  return `"${sanitizeLabel(raw, fallback)}"`;
}

/**
 * Produce a safe Mermaid identifier (node/state id) from arbitrary text.
 * Ids must be alphanumeric-ish; we prefix to guarantee a valid leading char.
 */
export function safeId(prefix: string, index: number): string {
  return `${prefix}${index}`;
}
