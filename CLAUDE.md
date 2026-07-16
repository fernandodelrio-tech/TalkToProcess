# CLAUDE.md — Process Compositor

Project context for Claude Code. Read this before making changes.

## What this tool is

A person describes a business process in plain language; the tool selects the
**best-fit visualization model** for that process, renders it as an editable
Mermaid diagram, and explains *why* that model was chosen. The differentiator is
model **selection** — deciding whether the process reads best as a flowchart,
swimlane, sequence, state machine, journey, or timeline — not just "draw a
flowchart." Primary context: HR process/technology design; domain-agnostic.

Full spec: `processcompositorrequirements.md` (sections 6, 8, 9 are **binding**).

## The six models and where they live

The model set is defined in **one place** (FR-25): `src/engine/models.ts`
(`MODELS`). Each maps to a Mermaid type:

| Model | Fits when | Mermaid |
|---|---|---|
| Flowchart | linear/branching steps, no role ownership | `flowchart TD` |
| Swimlane | multiple roles own steps and hand off | `flowchart LR` + subgraph per lane |
| Sequence | time-ordered messages between actors | `sequenceDiagram` |
| State | one entity through statuses (loops/terminal) | `stateDiagram-v2` |
| Journey | one person's experience + sentiment | `journey` |
| Timeline | chronology of events/phases/waves | `timeline` |

To add a model: extend `models.ts`, add a builder in `src/engine/builders/`
(register in `builders/index.ts`), add scoring in `src/engine/selector.ts`, add
acceptance cases in `tests/`.

## The two-engine ("best-fit") pattern — FR-27

`src/engine/compose.ts` orchestrates **primary → fallback**:

1. **Model-backed engine** (`src/engine/llm.ts`) — used only when a backend
   proxy URL is configured. Parses the §6 **delimited** contract
   (`parseDelimitedResponse`).
2. **On-device engine** (`src/engine/onDevice.ts` = `selector.ts` + a builder) —
   deterministic, fully offline, always available.

**Fallback rule (FR-27):** attempt model-backed first when available; on **any**
failure (network, auth, parse, invalid diagram) fall back to on-device
automatically. The tool must **never** hard-fail. Both engines return the same
shape `{ model, title, rationale, mermaid }` (FR-29) and the UI surfaces which
engine produced the diagram (FR-7/FR-30).

**Default is on-device only (Decision D-1a).** No provider is wired in.

## Binding constraints (do not regress)

- **NFR-7 — never ship a key client-side.** No API key in `src/` or the bundle.
  Model-backed mode calls a **backend proxy** (`api/`, a reference impl) that
  holds the credential server-side. See `api/README.md`.
- **NFR-1 — bundled Mermaid, never a CDN.** Mermaid is an npm dependency
  (`package.json`); a CDN dependency was a real prototype failure mode.
- **NFR-4 — sanitize labels.** All user-derived text passes through
  `src/engine/sanitize.ts` so `# & < > | { }` and unbalanced quotes cannot break
  rendering, in either engine.
- **FR-9 — vector text.** Mermaid is initialized with `htmlLabels:false` and
  `useMaxWidth:false` (`src/render/mermaidRender.ts`) so labels rasterize for PNG
  and are selectable for click-to-edit.
- **FR-10 — never blank the view.** App only feeds *valid* source to the canvas;
  an invalid edit keeps the last good render and surfaces the error.
- **NFR-2 — AA contrast.** Design tokens in `src/styles.css` are tuned for WCAG
  2.1 AA; no low-contrast gray-on-gray.

## Regression suite

`tests/selector.test.ts` encodes the **§12 acceptance cases** — these are the
primary regression suite for selection. `tests/builders/parse.test.ts` validates
every builder emits parseable Mermaid. Run `npm test`.

## Commands

- `npm run dev` — dev server
- `npm test` — Vitest (selector, builders, sanitize, parser, patch)
- `npm run typecheck` — `tsc -b`
- `npm run build` — self-contained static bundle in `dist/` (NFR-5)

## Structure

```
src/engine/    models · selector · flow (IR) · builders/ · sanitize · llm · compose · onDevice
src/render/    mermaidRender · panzoom · inlineEdit · export
src/ui/        InputPanel · ModelSelector · ElementsEditor · DiagramCanvas · Toolbar · SourcePanel · HistoryList
src/state/     history (in-memory; optional local-only persistence)
api/           optional Azure Functions proxy (reference; only for D-1 b/c)
tests/         selector (§12) · flow · builders (incl. cross-product parse) · sanitize · inlineEdit · llm
```

## Flow IR — the editable model (`src/engine/flow.ts`)

Every model is one ordered list of `Step`s plus model-level fields. The IR is
built from a description (`parseFlow`), serialized to **best-practice** Mermaid
(`flowToMermaid`), and edited structurally (add/remove/move/update). Because
edits mutate the IR and the source is regenerated from it, the diagram, source,
and Elements editor stay in sync (FR-11/12/14). The builders in `builders/` are
thin delegates over the IR, so **every** model always emits parseable Mermaid
for **any** input (the cross-product test in `tests/builders/parse.test.ts` is
the guard — a user can override any input to any model, FR-6).
