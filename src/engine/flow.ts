/**
 * Flow IR — an editable, model-agnostic representation of a process.
 *
 * Every model is expressed as an ordered list of `Step`s plus a few model-level
 * fields. This single structure is:
 *   - built from a description        (`parseFlow`)
 *   - serialized to best-practice Mermaid (`flowToMermaid`)
 *   - edited structurally             (add/remove/move/update ops)
 *
 * Because editing happens on the IR and the Mermaid is regenerated from it, the
 * rendered diagram and the source stay in sync (FR-11/12/14). Serializers are
 * written so that ANY IR — including a model the text doesn't naturally fit —
 * always produces parseable Mermaid.
 */

import type { ModelId } from './models';
import { sanitizeLabel } from './sanitize';
import {
  toOwnedSteps,
  distinctActors as ownersOf,
  deriveTitle,
} from './builders/shared';

export type StepKind = 'step' | 'decision' | 'start' | 'end';

export interface Step {
  id: string;
  label: string;
  /** Flowchart shape. Decisions render as diamonds with Yes/No branches. */
  kind: StepKind;
  /** Swimlane lane (owning role). */
  lane?: string;
  /** Sequence message sender / recipient. */
  from?: string;
  to?: string;
  /** Timeline period label (e.g. "Q1", "2026"). */
  period?: string;
  /** Journey sentiment score 1 (worst) – 5 (best). */
  score?: number;
}

export interface Flow {
  model: ModelId;
  title: string;
  steps: Step[];
}

// --- id helpers -----------------------------------------------------------

let idSeq = 0;
export function newStepId(): string {
  idSeq += 1;
  return `s${idSeq}_${idSeq.toString(36)}`;
}

// --- parsing: description → Flow ------------------------------------------

const SENTIMENT_POS = /\b(delight|happy|satisfied|excited|smooth|easy|clear|confident|glad|love)\w*/i;
const SENTIMENT_NEG = /\b(frustrat|confus|anxious|painful|difficult|hard|unhappy|dissatisf|slow|stuck|blocked|worried|angry)\w*/i;
const DECISION_RE = /\b(if|whether|approve|approv|deny|denies|denied|fail|fails|failed|else|otherwise|reject|check|valid|eligible|\?)\b/i;
const PERIOD_RE =
  /\b(q[1-4](?:\s*[–-]\s*q?[1-4])?|(?:19|20)\d{2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec[a-z]*|week\s*\d+|phase\s*\d+|wave\s*\d+)\b/i;

const ACTOR_SCAN: { re: RegExp; name: string }[] = [
  { re: /hiring manager/i, name: 'Hiring Manager' },
  { re: /tier two/i, name: 'Tier Two' },
  { re: /recruiter/i, name: 'Recruiter' },
  { re: /candidate/i, name: 'Candidate' },
  { re: /applicant/i, name: 'Applicant' },
  { re: /employee/i, name: 'Employee' },
  { re: /manager/i, name: 'Manager' },
  { re: /system/i, name: 'System' },
  { re: /hrbp/i, name: 'HRBP' },
  { re: /payroll/i, name: 'Payroll' },
  { re: /customer/i, name: 'Customer' },
  { re: /client/i, name: 'Client' },
  { re: /vendor/i, name: 'Vendor' },
  { re: /\bHR\b/, name: 'HR' },
  { re: /\bIT\b/, name: 'IT' },
];

function actorsInClause(clause: string): string[] {
  const hits: { name: string; index: number }[] = [];
  for (const { re, name } of ACTOR_SCAN) {
    const m = re.exec(clause);
    if (m) hits.push({ name, index: m.index });
  }
  hits.sort((a, b) => a.index - b.index);
  const out: string[] = [];
  for (const h of hits) if (!out.includes(h.name)) out.push(h.name);
  return out;
}

function splitClauses(description: string): string[] {
  return (description || '')
    .split(/[;\n.]|,|\bthen\b|→|->/gi)
    .map((s) => s.trim())
    .filter(Boolean);
}

function shortLabel(raw: string, words = 8): string {
  return sanitizeLabel(raw).split(/\s+/).slice(0, words).join(' ');
}

/** Build a Flow IR from a description for the given model. */
export function parseFlow(description: string, model: ModelId): Flow {
  const title = deriveTitle(description, 'Process');
  switch (model) {
    case 'swimlane':
      return { model, title, steps: parseSwimlaneSteps(description) };
    case 'sequence':
      return { model, title, steps: parseSequenceSteps(description) };
    case 'state':
      return { model, title, steps: parseStateSteps(description) };
    case 'timeline':
      return { model, title, steps: parseTimelineSteps(description) };
    case 'journey':
      return { model, title, steps: parseJourneySteps(description) };
    case 'flowchart':
    default:
      return { model, title, steps: parseFlowchartSteps(description) };
  }
}

function parseFlowchartSteps(description: string): Step[] {
  const clauses = splitClauses(description);
  const steps = clauses.map((c) => ({
    id: newStepId(),
    label: shortLabel(c),
    kind: (DECISION_RE.test(c) ? 'decision' : 'step') as StepKind,
  }));
  return steps.length ? steps : [{ id: newStepId(), label: 'Step 1', kind: 'step' }];
}

function parseSwimlaneSteps(description: string): Step[] {
  const owned = toOwnedSteps(description);
  const steps = owned.map((o) => ({
    id: newStepId(),
    label: shortLabel(o.action),
    kind: (DECISION_RE.test(o.action) ? 'decision' : 'step') as StepKind,
    lane: o.actor,
  }));
  return steps.length
    ? steps
    : [{ id: newStepId(), label: 'Step 1', kind: 'step', lane: 'Lane 1' }];
}

function parseSequenceSteps(description: string): Step[] {
  const clauses = splitClauses(description);
  const steps: Step[] = [];
  let lastActor: string | null = null;
  for (const clause of clauses) {
    const found = actorsInClause(clause);
    let from: string;
    let to: string;
    if (found.length >= 2) {
      [from, to] = found;
    } else if (found.length === 1) {
      from = lastActor && lastActor !== found[0] ? lastActor : found[0];
      to = found[0];
    } else {
      from = lastActor ?? 'Actor A';
      to = found[0] ?? 'Actor B';
    }
    steps.push({ id: newStepId(), label: shortLabel(clause, 10), kind: 'step', from, to });
    lastActor = to;
  }
  return steps.length
    ? steps
    : [{ id: newStepId(), label: 'Message', kind: 'step', from: 'Actor A', to: 'Actor B' }];
}

function parseStateSteps(description: string): Step[] {
  const raw = (description || '')
    .split(/[;\n.]|,|→|->|\bthen\b/gi)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^[^:]{0,40}:\s*/, '')); // drop "Entity:" prefix
  const steps = raw.map((s) => ({
    id: newStepId(),
    label: shortLabel(s, 3),
    kind: 'step' as StepKind,
  }));
  return steps.length ? steps : [{ id: newStepId(), label: 'Initial', kind: 'step' }];
}

function parseTimelineSteps(description: string): Step[] {
  const clauses = (description || '')
    .split(/[;\n.]|,/g)
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => c.replace(/^[^:]{0,60}:\s*/, ''))
    .filter(Boolean);
  let fallback = 0;
  const steps = clauses.map((c) => {
    const m = c.match(PERIOD_RE);
    const period = m ? m[0].replace(/\s*[–-]\s*/g, '-').toUpperCase() : `Phase ${++fallback}`;
    const label = shortLabel(m ? c.replace(m[0], '').trim() : c) || 'Event';
    return { id: newStepId(), label, kind: 'step' as StepKind, period };
  });
  return steps.length
    ? steps
    : [{ id: newStepId(), label: 'Event', kind: 'step', period: 'Phase 1' }];
}

function parseJourneySteps(description: string): Step[] {
  const clauses = splitClauses(description);
  const steps = clauses.map((c) => ({
    id: newStepId(),
    label: shortLabel(c, 6),
    kind: 'step' as StepKind,
    score: SENTIMENT_POS.test(c) ? 5 : SENTIMENT_NEG.test(c) ? 2 : 3,
  }));
  return steps.length ? steps : [{ id: newStepId(), label: 'Stage', kind: 'step', score: 3 }];
}

// --- serialization: Flow → Mermaid ---------------------------------------

/** A safe Mermaid identifier from an actor/lane name. */
function alias(name: string): string {
  return name.replace(/[^A-Za-z0-9]/g, '') || 'X';
}

export function flowToMermaid(flow: Flow): string {
  switch (flow.model) {
    case 'swimlane':
      return swimlaneMermaid(flow);
    case 'sequence':
      return sequenceMermaid(flow);
    case 'state':
      return stateMermaid(flow);
    case 'timeline':
      return timelineMermaid(flow);
    case 'journey':
      return journeyMermaid(flow);
    case 'flowchart':
    default:
      return flowchartMermaid(flow);
  }
}

/** A UML activity node in Mermaid's expanded `@{ shape }` notation. */
function activityNode(id: string, kind: StepKind, label: string, indent = '  '): string {
  const text = sanitizeLabel(label);
  const shape = kind === 'decision' ? 'diam' : 'rounded';
  return `${indent}${id}@{ shape: ${shape}, label: "${text}" }`;
}

/**
 * UML Activity Diagram (FR: proper notation).
 * - initial node: filled circle (`sm-circ`)
 * - actions: rounded rectangles
 * - decisions: diamonds with guard-labelled outgoing edges
 * - activity final: framed circle (`framed-circle`)
 */
function flowchartMermaid(flow: Flow): string {
  const steps = flow.steps;
  const lines = ['flowchart TD'];
  lines.push('  init@{ shape: sm-circ }');
  steps.forEach((s, i) => lines.push(activityNode(`n${i}`, s.kind, s.label)));
  lines.push('  final@{ shape: framed-circle }');

  const ref = (i: number) => (i < 0 ? 'init' : i >= steps.length ? 'final' : `n${i}`);
  if (steps.length === 0) {
    lines.push('  init --> final');
    return lines.join('\n');
  }
  lines.push('  init --> n0');
  steps.forEach((s, i) => {
    const next = ref(i + 1);
    if (s.kind === 'decision') {
      lines.push(`  n${i} -->|Yes| ${next}`);
      lines.push(`  n${i} -->|No| final`);
    } else {
      lines.push(`  n${i} --> ${next}`);
    }
  });
  return lines.join('\n');
}

/**
 * True swimlanes = UML Activity Diagram with partitions.
 * `flowchart TB` stacks each lane as a horizontal band; each lane's subgraph
 * uses `direction LR` so the flow reads left→right across the lanes, with
 * handoffs crossing lane boundaries vertically. Initial/final nodes live in the
 * first/last lanes.
 */
function swimlaneMermaid(flow: Flow): string {
  const steps = flow.steps;
  if (steps.length === 0) {
    return 'flowchart TB\n  subgraph lane0["Lane"]\n    init@{ shape: sm-circ }\n    final@{ shape: framed-circle }\n  end\n  init --> final';
  }
  const lanes = [...new Set(steps.map((s) => s.lane || 'Lane'))];
  const lines = ['flowchart TB'];
  lanes.forEach((lane, li) => {
    lines.push(`  subgraph lane${li}["${sanitizeLabel(lane)}"]`);
    lines.push('    direction LR');
    if (li === 0) lines.push('    init@{ shape: sm-circ }');
    steps.forEach((s, i) => {
      if ((s.lane || 'Lane') === lane) lines.push(activityNode(`n${i}`, s.kind, s.label, '    '));
    });
    if (li === lanes.length - 1) lines.push('    final@{ shape: framed-circle }');
    lines.push('  end');
  });
  lines.push('  init --> n0');
  for (let i = 0; i < steps.length - 1; i++) lines.push(`  n${i} --> n${i + 1}`);
  lines.push(`  n${steps.length - 1} --> final`);
  return lines.join('\n');
}

/** True/false a message reads as a UML reply (dashed) rather than a call. */
const RETURN_RE =
  /\b(returns?|response|responds?|repl(?:y|ies|ied)|confirms?|confirmation|acknowledges?|result|answer|approv\w*|denies|denied|notif\w*)\b/i;

/**
 * UML Sequence Diagram: synchronous calls use a solid arrow (`->>`), replies use
 * a dashed return arrow (`-->>`). Messages are autonumbered.
 */
function sequenceMermaid(flow: Flow): string {
  const steps = flow.steps;
  const participants: string[] = [];
  for (const s of steps) {
    for (const a of [s.from, s.to]) {
      const name = a || 'Actor';
      if (!participants.includes(name)) participants.push(name);
    }
  }
  if (participants.length === 0) participants.push('Actor A', 'Actor B');

  const lines = ['sequenceDiagram', '  autonumber'];
  for (const p of participants) lines.push(`  participant ${alias(p)} as ${sanitizeLabel(p)}`);
  for (const s of steps) {
    const from = alias(s.from || participants[0]);
    const to = alias(s.to || s.from || participants[0]);
    const arrow = RETURN_RE.test(s.label) ? '-->>' : '->>';
    lines.push(`  ${from}${arrow}${to}: ${sanitizeLabel(s.label, 'message')}`);
  }
  if (steps.length === 0) {
    lines.push(`  ${alias(participants[0])}->>${alias(participants[1] || participants[0])}: message`);
  }
  return lines.join('\n');
}

/** State diagram with start/terminal and reopen loops. */
function stateMermaid(flow: Flow): string {
  const steps = flow.steps;
  if (steps.length === 0) return 'stateDiagram-v2\n  [*] --> Initial';
  const lines = ['stateDiagram-v2'];
  steps.forEach((s, i) => lines.push(`  state "${sanitizeLabel(s.label)}" as st${i}`));
  lines.push('  [*] --> st0');
  for (let i = 0; i < steps.length - 1; i++) lines.push(`  st${i} --> st${i + 1}`);

  const reopenIdx = steps.findIndex((s) => /reopen/i.test(s.label));
  const closeIdx = steps.findIndex((s) => /close|resolved|complete|done|cancel/i.test(s.label));
  lines.push(`  st${closeIdx >= 0 ? closeIdx : steps.length - 1} --> [*]`);
  if (reopenIdx >= 0 && closeIdx >= 0 && reopenIdx !== closeIdx) {
    lines.push(`  st${reopenIdx} --> st0`);
  }
  return lines.join('\n');
}

function timelineMermaid(flow: Flow): string {
  const lines = ['timeline', `  title ${sanitizeLabel(flow.title, 'Timeline')}`];
  if (flow.steps.length === 0) {
    lines.push('  Phase 1 : Event');
    return lines.join('\n');
  }
  for (const s of flow.steps) {
    lines.push(`  ${sanitizeLabel(s.period || 'Phase')} : ${sanitizeLabel(s.label, 'Event')}`);
  }
  return lines.join('\n');
}

function journeyMermaid(flow: Flow): string {
  const lines = ['journey', `  title ${sanitizeLabel(flow.title, 'Journey')}`, '  section Experience'];
  if (flow.steps.length === 0) {
    lines.push('    Stage: 3: User');
    return lines.join('\n');
  }
  for (const s of flow.steps) {
    const score = Math.min(5, Math.max(1, Math.round(s.score ?? 3)));
    lines.push(`    ${sanitizeLabel(s.label, 'Stage')}: ${score}: User`);
  }
  return lines.join('\n');
}

// --- structural edit operations (pure) -----------------------------------

function clone(flow: Flow, steps: Step[]): Flow {
  return { ...flow, steps };
}

/** Default attributes for a new step, matched to the model. */
export function blankStep(flow: Flow, afterId?: string): Step {
  const idx = afterId ? flow.steps.findIndex((s) => s.id === afterId) : flow.steps.length - 1;
  const neighbor = flow.steps[idx];
  const base: Step = { id: newStepId(), label: 'New step', kind: 'step' };
  switch (flow.model) {
    case 'swimlane':
      base.lane = neighbor?.lane || 'Lane 1';
      break;
    case 'sequence':
      base.from = neighbor?.to || neighbor?.from || 'Actor A';
      base.to = neighbor?.from || neighbor?.to || 'Actor B';
      base.label = 'New message';
      break;
    case 'timeline':
      base.period = neighbor?.period || 'Phase';
      base.label = 'New event';
      break;
    case 'journey':
      base.score = 3;
      base.label = 'New stage';
      break;
    case 'state':
      base.label = 'New state';
      break;
  }
  return base;
}

export function addStep(flow: Flow, afterId?: string, step?: Step): Flow {
  const s = step ?? blankStep(flow, afterId);
  const steps = [...flow.steps];
  const idx = afterId ? steps.findIndex((x) => x.id === afterId) : steps.length - 1;
  steps.splice(idx + 1, 0, s);
  return clone(flow, steps);
}

export function removeStep(flow: Flow, id: string): Flow {
  return clone(flow, flow.steps.filter((s) => s.id !== id));
}

export function moveStep(flow: Flow, id: string, dir: -1 | 1): Flow {
  const steps = [...flow.steps];
  const i = steps.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= steps.length) return flow;
  [steps[i], steps[j]] = [steps[j], steps[i]];
  return clone(flow, steps);
}

export function updateStep(flow: Flow, id: string, patch: Partial<Step>): Flow {
  return clone(
    flow,
    flow.steps.map((s) => (s.id === id ? { ...s, ...patch, id: s.id } : s)),
  );
}

/** Rename the first step whose label matches `oldLabel` (used by inline edit). */
export function renameStepByLabel(flow: Flow, oldLabel: string, newLabel: string): Flow | null {
  const target = flow.steps.find((s) => s.label === oldLabel);
  if (!target) return null;
  return updateStep(flow, target.id, { label: sanitizeLabel(newLabel, oldLabel) });
}

/** Distinct lanes / actors currently in use (for editor dropdowns). */
export function lanesOf(flow: Flow): string[] {
  return [...new Set(flow.steps.map((s) => s.lane).filter(Boolean) as string[])];
}
export function actorsOfFlow(flow: Flow): string[] {
  const set = new Set<string>();
  for (const s of flow.steps) {
    if (s.from) set.add(s.from);
    if (s.to) set.add(s.to);
  }
  return [...set];
}

// Re-export for callers that want the owner list utility.
export { ownersOf };
