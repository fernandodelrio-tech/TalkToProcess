# Process Compositor — Requirements & Build Specification

**Version:** 1.0
**Purpose of this document:** A build-ready specification for rebuilding the Process Compositor as a maintainable, testable, deployable project in Claude Code. It captures the current behavior (validated across several artifact iterations), the architecture decisions and the constraints behind them, and the open decisions to confirm before the first build.

---

## 1. Overview

The Process Compositor is a single-purpose tool: a person describes a business process in plain language, and the tool selects the **best-fit visualization model** for that process, then renders it as an editable diagram. The differentiating behavior is not "draw a flowchart" — it is choosing *whether* the process reads best as a flowchart, a swimlane, a sequence, a state machine, a journey, or a timeline, and explaining why.

The primary user context is HR process and technology design (cross-functional workflows, service lifecycles, system interactions, implementation roadmaps), but the tool is domain-agnostic.

---

## 2. Goals and non-goals

**Goals**
- Turn a plain-language process description into the correct *type* of diagram with minimal user effort.
- Make the model-selection reasoning visible and overridable, so the user stays in control.
- Let the user refine output both by editing code and by editing the visual directly, kept in sync.
- Produce output that drops cleanly into decks and other tools (Mermaid source, SVG, PNG).
- Run in locked-down and offline environments without failing.

**Non-goals (v1)**
- Not a general drawing canvas or freeform diagram editor.
- Not a persistence/collaboration platform (no accounts, no shared server-side storage in v1).
- Not a BPMN-conformant modeler.
- Does not need to handle diagrams beyond ~20–25 nodes; large processes are expected to be composed in segments.

---

## 3. Users and access

- **Primary users:** HR process/technology practitioners and leaders composing process flows.
- **Access model (to confirm — see D4):** internal-only, likely behind Cummins SSO if hosted.
- **Skill level:** non-technical to semi-technical; the tool must be usable without knowing Mermaid, while exposing Mermaid for power users.

---

## 4. Functional requirements

Requirements are identified (FR-n) for traceability. "Must" = v1 blocking; "Should" = v1 target; "May" = backlog.

### 4.1 Input
- **FR-1 (Must):** Accept a free-text process description via a multi-line input.
- **FR-2 (Should):** Provide seed examples that each resolve to a *different* best-fit model, doubling as a demonstration of the selection behavior.
- **FR-3 (Should):** Support a keyboard shortcut to compose (e.g., Cmd/Ctrl+Enter).

### 4.2 Model selection (the core behavior)
- **FR-4 (Must):** From a single description, select exactly one visualization model from the supported set (§5).
- **FR-5 (Must):** Display the chosen model prominently and a one-to-two sentence rationale grounded in the specific description.
- **FR-6 (Must):** Let the user override the selection by choosing any other supported model, which redraws the *same* description in that model.
- **FR-7 (Must):** Indicate which engine produced the result — model-backed vs on-device (see §6).

### 4.3 Rendering
- **FR-8 (Must):** Render the selected diagram inline.
- **FR-9 (Must):** Node/edge/actor labels must render as vector text (not HTML-in-SVG) so they rasterize cleanly for PNG export and are directly selectable for editing.
- **FR-10 (Must):** Invalid diagram source must not blank the view; keep the last good render and surface the error.

### 4.4 Editing (two-way)
- **FR-11 (Must):** Provide an editable Mermaid source panel that re-renders **live** as the user types (debounced), with syntax errors flagged non-destructively.
- **FR-12 (Must):** Let the user click a label in the rendered diagram to rename it inline; the change writes back into the Mermaid source and both stay in sync.
- **FR-13 (Should):** Provide a "revert to generated" action that restores the last composed version.
- **FR-14 (May):** Direct visual editing beyond labels (adding/removing nodes, re-routing edges).

### 4.5 Navigation
- **FR-15 (Must):** Zoom via on-screen controls and scroll wheel, zooming toward the cursor.
- **FR-16 (Must):** Pan by dragging the canvas.
- **FR-17 (Must):** "Fit" action that scales the whole diagram to the frame (true fit, not reset-to-100%).
- **FR-18:** Zoom range at least 0.2×–6×.

### 4.6 Export and reuse
- **FR-19 (Must):** Copy Mermaid source to clipboard.
- **FR-20 (Must):** Download as SVG.
- **FR-21 (Should):** Download as PNG (white background, ≥2× pixel density for deck use).
- **FR-22 (May):** Copy rendered image directly to clipboard.

### 4.7 Session
- **FR-23 (Should):** Keep an in-session history of composed diagrams, restorable by click.
- **FR-24 (May):** Optional local persistence of history/preferences (see privacy note, §9 — must be local-only).

---

## 5. Supported visualization models

The selector must support these six, each mapped to a Mermaid diagram type:

| Model | When it fits | Mermaid type |
|---|---|---|
| Flowchart | Linear/branching steps with decision points, no distinct role ownership | `flowchart TD` |
| Swimlane | Multiple named roles/systems own different steps and hand off | `flowchart LR` with one subgraph per lane |
| Sequence | Time-ordered exchange of messages between actors/systems | `sequenceDiagram` |
| State | One entity moving through statuses, with transitions/loops/terminal states | `stateDiagram-v2` |
| Journey | One person's experience across ordered stages, with per-step sentiment | `journey` |
| Timeline | A chronology of events, phases, or waves in time order | `timeline` |

- **FR-25 (Must):** The model set is defined in one place and is easy to extend.
- **FR-26 (May — see D5):** Candidate additions for later: Gantt (scheduled roadmaps with durations), ER diagram (data relationships), mindmap (decomposition).

---

## 6. Architecture: the two-engine ("best-fit") design

The selection can be produced two ways. The tool must support a **primary → fallback** pattern.

- **Model-backed engine (primary):** a language model reads the description and returns the chosen model, rationale, and Mermaid. This handles messy or unusual phrasing best.
- **On-device engine (fallback):** a deterministic, rules-based analyzer scores the description on structural signals (distinct role count and handoff verbs → swimlane; directional "requests X from / sends Y to" → sequence; status vocabulary → state; time/phase vocabulary → timeline; stage-and-sentiment language → journey; else flowchart), then builds the Mermaid itself.

Requirements:
- **FR-27 (Must):** Attempt the model-backed engine first when available; on any failure (network, auth, parse, invalid diagram), automatically fall back to the on-device engine. The tool must never hard-fail the way an unproxied API call does.
- **FR-28 (Must):** The on-device engine must be fully functional with no network access.
- **FR-29 (Must):** Both engines return the same result shape ({ model, title, rationale, mermaid }) so downstream rendering/editing is engine-agnostic.
- **FR-30 (Must):** Surface to the user which engine produced the current diagram.

**Contract for the model-backed engine's output** (delimited, not JSON, to avoid newline-escaping fragility with multi-line Mermaid):

```
MODEL: <flowchart|swimlane|sequence|state|journey|timeline>
TITLE: <short title>
RATIONALE: <1–2 sentences>
MERMAID:
<raw mermaid>
```

---

## 7. Non-functional requirements

- **NFR-1 Offline / locked-down:** The app must run with no external network calls in on-device mode. **The diagram-rendering library must be bundled, not loaded from a CDN.** (A CDN dependency was a real failure mode in the prototype.)
- **NFR-2 Accessibility & readability:** Meet WCAG 2.1 AA contrast for all text, including secondary labels, chips, and status tags (no low-contrast gray-on-gray). Interactive controls keyboard-reachable with visible focus and aria labels. Respect `prefers-reduced-motion`.
- **NFR-3 Performance:** On-device composition and render should feel instant (< ~300 ms for typical inputs). Model-backed composition may take a few seconds; show a loading state.
- **NFR-4 Robustness:** Sanitize labels so reserved characters (`# & < > | { }` and unbalanced quotes) cannot break rendering, regardless of engine.
- **NFR-5 Portability:** A production build must be a self-contained static bundle that can be opened or hosted without a runtime, except for the optional backend in §8.
- **NFR-6 Maintainability:** Model definitions, the selection scorer, and each diagram builder must be independently unit-testable modules.

---

## 8. LLM connectivity, security, and deployment

This is where the prototype hit its hardest constraints. They are recorded here as binding requirements.

- **NFR-7 (Must):** **The LLM API key must never be present in client-side code.** A key shipped in the browser is readable by anyone with the file and is a security-review failure. If model-backed mode is enabled in a deployed build, the call must go through a **backend proxy** that holds the credential server-side (or uses a keyless federated identity).
- **Constraint C-1:** A Claude.ai (consumer) subscription is not API access; the two are separately billed. The "no-key call handled by the Claude.ai runtime" path only works while the tool runs live inside Claude.ai and is **not** a portable deployment option. It must not be assumed in the deployed build.
- **Decision D-1 (LLM provider):** choose one:
  - **(a) None** — ship on-device only. Simplest; no backend; all text stays local.
  - **(b) Anthropic API via backend proxy** — richest selection; requires a proxy holding the key.
  - **(c) Cummins-controlled Azure OpenAI via backend proxy** — richest selection with data staying inside Cummins-governed infrastructure. Preferred if model-backed mode is wanted, given the enterprise/privacy context.
- **Decision D-2 (hosting):** if a backend is used, recommended shape is **Azure Static Web Apps (static frontend) + Azure Functions (proxy)**, aligning with existing Cummins Azure/OpenAI estate. Static-only hosting suffices for on-device mode.

---

## 9. Data handling and privacy

- **NFR-8:** In on-device mode, no process-description text leaves the browser.
- **NFR-9:** In model-backed mode, the description text is transmitted to the chosen provider. The deployment must document this and route through a provider consistent with data-residency obligations (relevant given prior PIPL/GDPR-type reviews). Prefer the Cummins-governed Azure OpenAI path (D-1c) if enabled.
- **NFR-10:** No telemetry or third-party analytics in v1. Any future local persistence (FR-24) stays in the user's browser only.

---

## 10. Recommended technology stack

Recommended, to confirm as **Decision D-3**:

- **Frontend:** React + TypeScript + Vite. Clean, well-supported, and a strong fit for Claude Code's workflow. (Keeping the current vanilla single-file approach is viable but harder to test and extend; not recommended for a maintained project.)
- **Diagramming:** Mermaid as an **npm dependency, bundled** (removes the CDN dependency — satisfies NFR-1/NFR-5).
- **Styling:** Tailwind or CSS modules; either is fine. Preserve the current design tokens (deep teal / warm neutrals / amber accents) but with the corrected AA contrast values.
- **Backend (only if D-1 b/c):** Azure Functions (TypeScript/Node) as a thin proxy: receives the description, calls the provider server-side with the credential, returns the delimited response.
- **Testing:** Vitest for unit tests (selection scorer + each builder); Playwright for end-to-end (render, click-to-edit, zoom/pan, export).

---

## 11. Suggested project structure

```
process-compositor/
  CLAUDE.md                 # project context for Claude Code (see §13)
  README.md
  index.html
  src/
    main.tsx
    ui/                     # components: input, model selector, canvas, source panel, toolbar
    engine/
      models.ts             # the model catalog (single source of truth)
      selector.ts           # on-device scoring / model choice
      builders/             # one file per model: flowchart, swimlane, sequence, state, journey, timeline
      sanitize.ts           # label cleaning
      llm.ts                # model-backed client + delimited-response parser
    render/
      mermaidRender.ts      # init (htmlLabels:false, useMaxWidth:false), parse+render
      panzoom.ts            # zoom-to-cursor, drag-pan, fit
      inlineEdit.ts         # click-to-rename → source patch
      export.ts             # SVG / PNG / copy
  api/                      # optional Azure Functions proxy (only if D-1 b/c)
  tests/
    selector.test.ts        # the acceptance cases in §12
    builders/*.test.ts
    e2e/*.spec.ts
```

---

## 12. Acceptance criteria (regression cases)

The on-device selector must produce these model choices. These become the first unit tests.

| Input (abridged) | Expected model |
|---|---|
| Employee submits LOA; HRBP reviews; manager approves/denies; payroll adjusts; employee notified | Swimlane |
| Onboarding: bg check clears, IT provisions, HR paperwork, first-day access; if bg check fails, offer rescinded | Swimlane (Flowchart acceptable) |
| Support ticket: opens → in-progress → pending → resolved; reopen; escalate to tier two; close after 5 days | State |
| Recruiter requests availability from hiring manager; system offers slots to candidate; candidate picks; system books and sends invites | Sequence |
| HRIS roadmap in three waves over 2026: discovery Q1, build Q2–Q3, pilot/cutover/hypercare Q4 | Timeline |

Additional acceptance checks:
- **AC-1:** Model-backed failure silently falls back to on-device (simulate by blocking the proxy).
- **AC-2:** Editing the source live re-renders; a syntax error keeps the last good diagram and flags the error.
- **AC-3:** Clicking a node label and renaming it updates both the diagram and the source.
- **AC-4:** Fit, scroll-zoom-to-cursor, and drag-pan behave on a large (~20-node) swimlane.
- **AC-5:** PNG export produces a white-background raster with legible labels.
- **AC-6:** All text passes AA contrast in an automated a11y check.
- **AC-7:** With network disabled, the app loads and composes on-device with no console errors.

---

## 13. Using this with Claude Code

- Keep a **`CLAUDE.md`** at the repo root summarizing: what the tool is, the six models and where they're defined, the two-engine pattern and the fallback rule (FR-27), the "never ship a key client-side" rule (NFR-7), the bundled-Mermaid rule (NFR-1), and a pointer to the acceptance cases (§12) as the regression suite.
- **Suggested first prompt to Claude Code:** "Scaffold a Vite + React + TypeScript app per process-compositor-requirements.md §10–11. Implement the on-device engine first (models, selector, all six builders, sanitize) with Vitest tests covering the §12 acceptance cases. Bundle Mermaid as a dependency. Do not add any LLM/network calls yet — that's a later phase gated on Decision D-1."
- Build in phases so each is testable:
  1. On-device engine + tests (no UI).
  2. Render + pan/zoom + source panel (on-device only, fully offline).
  3. Two-way editing (live source + click-to-rename).
  4. Export (SVG/PNG/copy) + session history.
  5. Model-backed engine + fallback (only after D-1 is chosen; backend proxy if b/c).
  6. Deployment (per D-2) + a11y pass + E2E.

---

## 14. Open decisions to confirm

- **D-1 — LLM provider:** none (on-device only) / Anthropic API via proxy / Cummins Azure OpenAI via proxy. *Recommendation: start on-device-only (phases 1–4), add Azure OpenAI via proxy later if wanted.*
- **D-2 — Hosting:** static-only vs static + Azure Functions. *Follows from D-1.*
- **D-3 — Stack:** React + TS + Vite (recommended) vs keep vanilla.
- **D-4 — Access control:** open internal vs SSO-gated.
- **D-5 — Model set:** keep the six, or add Gantt / ER / mindmap.
- **D-6 — Design system:** reuse the current tokens as-is, or align to the Cummins 2025 brand for internal distribution.

---

*Prepared as the build spec for migrating the Process Compositor prototype into a maintained Claude Code project. Sections 6, 8, and 9 encode constraints discovered during prototyping — treat them as binding rather than advisory.*
