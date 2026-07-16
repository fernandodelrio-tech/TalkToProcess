# Process Compositor

Describe a business process in plain language — Process Compositor selects the
**best-fit visualization model** (flowchart, swimlane, sequence, state, journey,
or timeline), renders it as an editable [Mermaid](https://mermaid.js.org)
diagram, and explains why that model fits.

The point isn't "draw a flowchart" — it's choosing *whether* a process reads best
as a flowchart vs. a swimlane vs. a sequence, and keeping you in control of that
choice.

## Highlights

- **Model selection with a visible, overridable rationale** — one best-fit model
  per description, with a one-line reason; override to any other model to redraw
  the same process (FR-4/5/6). Any input renders safely as any model.
- **Structured flow editing** — an Elements panel to **add, remove, reorder, and
  relabel** steps and edit per-model attributes (lane, actor, period,
  sentiment); every change regenerates the Mermaid source live (FR-14).
- **UML-standard notation** — flowcharts render as UML **activity diagrams**
  (initial ● / final ◉ nodes, rounded actions, decision diamonds with guards);
  swimlanes as UML **activity partitions** (true lanes the flow crosses);
  sequences as UML **sequence diagrams** (lifelines, autonumbered calls, dashed
  returns); state as UML **state machines** (initial/terminal, reopen loops).
- **Two-way editing** — edit the Mermaid source live (debounced), or click a
  label in the diagram to rename it; diagram, source, and elements stay in sync
  (FR-11/12).
- **Material 3 (Google I/O) design** — Material You color, shape, elevation, and
  type scale, with a light/dark theme that follows the OS.
- **Runs offline** — the on-device engine needs no network; Mermaid is bundled,
  not loaded from a CDN (NFR-1). This is the default (Decision D-1a).
- **Two-engine architecture** — an optional model-backed engine (via a backend
  proxy that holds the credential server-side) with automatic fallback to the
  on-device engine on any failure. **No API key ever ships in the browser**
  (NFR-7).
- **Export** — copy Mermaid, download SVG, download PNG (white background, 2×),
  copy image (FR-19–22).
- **Navigation** — scroll-zoom toward the cursor, drag to pan, true fit-to-frame
  (FR-15–18).
- **Accessible** — WCAG 2.1 AA contrast, keyboard-reachable controls, respects
  `prefers-reduced-motion` (NFR-2).

## No-install: just open the file

**[`process-compositor.html`](./process-compositor.html)** is a fully
self-contained build — all JavaScript, CSS, and Mermaid are inlined into a
single HTML file. **Download it and double-click it**; it runs from `file://`
in any modern browser with **no install, no server, and no network** (on-device
mode). Nothing you type leaves the browser (NFR-8).

Rebuild it any time with:

```bash
npm install
npm run build:standalone   # → dist-standalone/index.html
```

## Developer quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # Vitest — includes the §12 acceptance cases
npm run build    # normal static bundle in dist/ (code-split)
```

Open the app, pick one of the seed examples (each resolves to a *different*
model), and press **Compose** (or ⌘/Ctrl+Enter).

## How selection works

The on-device engine (`src/engine/selector.ts`) scores the description on
structural signals:

- distinct roles + handoff verbs → **swimlane**
- directional "requests X from / sends Y to" → **sequence**
- lifecycle-status vocabulary + transitions/loops → **state**
- time/phase/wave vocabulary → **timeline**
- stage-and-sentiment language → **journey**
- otherwise → **flowchart**

The optional model-backed engine returns the same `{ model, title, rationale,
mermaid }` shape via the delimited contract in `api/README.md`.

## Architecture

```
Description ──► compose() ──► [model-backed via proxy?] ──► fallback ──► on-device
                                   │                                        │
                                   └──────── { model, title, rationale, mermaid } ◄──┘
                                                       │
                                          render (vector text) + pan/zoom + inline edit
```

- `src/engine/` — model catalog, selector, builders, sanitize, LLM client,
  orchestrator.
- `src/render/` — Mermaid init/render, pan/zoom, click-to-rename, export.
- `src/ui/` — React components.
- `api/` — optional Azure Functions proxy (reference only; needed for the
  model-backed engine — Decision D-1 b/c).

See [`CLAUDE.md`](./CLAUDE.md) for the binding constraints and where things live,
and `processcompositorrequirements.md` for the full spec.

## Enabling the model-backed engine (optional)

The app is on-device-only by default. To enable model-backed selection, deploy
the proxy in `api/` (which holds the provider credential server-side) and point
the frontend at it with a non-secret URL:

```bash
VITE_LLM_PROXY_URL=/api/compose npm run build
```

Recommended hosting (Decision D-2): Azure Static Web Apps + Azure Functions. See
`api/README.md` for provider options (Anthropic API, or Cummins-governed Azure
OpenAI — preferred for the enterprise/privacy context).

## Status vs. the spec's phases

Implemented: on-device engine + tests (1), render + pan/zoom + source panel (2),
two-way editing (3), export + session history (4), and the model-backed
engine + fallback *structure* (5, disabled by default pending Decision D-1).
Remaining: a deployed backend, a Playwright E2E suite, and the deployment pass
(6).
