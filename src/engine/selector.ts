/**
 * On-device model selector (FR-4, FR-5, NFR-6).
 *
 * A deterministic, rules-based analyzer that scores a plain-language process
 * description on structural signals and picks exactly one visualization model.
 * It is the fallback engine (§6) and is fully functional with no network.
 *
 * The scoring weights are tuned against the §12 acceptance cases, which are
 * encoded as unit tests in `tests/selector.test.ts`.
 */

import type { ModelId } from './models';

/** Structural signals extracted from a description. Exposed for testability. */
export interface Signals {
  clauses: string[];
  actors: string[];
  handoffVerbs: number;
  /** Communication verb + directional preposition (to/from) → message passing. */
  directionalMessages: number;
  /** Communication verbs regardless of direction. */
  commVerbs: number;
  statusWords: number;
  transitionArrows: number;
  loopWords: number;
  timeWords: number;
  sentimentWords: number;
  decisionWords: number;
}

export interface Scored {
  model: ModelId;
  score: number;
  /** Human-readable reasons grounded in the description (feeds the rationale). */
  reasons: string[];
}

export interface Selection {
  model: ModelId;
  rationale: string;
  scores: Scored[];
  signals: Signals;
}

// --- Lexicons -------------------------------------------------------------

/** Common role/system nouns. Detecting actors generically is hard; a lexicon
 *  plus multi-word phrases covers the HR/tech domain well. */
const ACTOR_LEXICON = [
  'hiring manager',
  'tier two',
  'tier one',
  'help desk',
  'helpdesk',
  'service desk',
  'employee',
  'manager',
  'hrbp',
  'payroll',
  'recruiter',
  'candidate',
  'applicant',
  'system',
  'administrator',
  'admin',
  'customer',
  'client',
  'vendor',
  'approver',
  'reviewer',
  'requester',
  'supervisor',
  'director',
  'analyst',
  'specialist',
  'coordinator',
  'stakeholder',
  'operator',
  'technician',
  'agent',
];

/** Single-token actors that also need word-boundary matching (HR, IT). */
const ACRONYM_ACTORS = ['hr', 'it'];

const HANDOFF_VERBS = [
  'submit',
  'submits',
  'review',
  'reviews',
  'approve',
  'approves',
  'deny',
  'denies',
  'reject',
  'rejects',
  'adjust',
  'adjusts',
  'notify',
  'notifies',
  'notified',
  'provision',
  'provisions',
  'process',
  'processes',
  'complete',
  'completes',
  'hand',
  'hands',
  'pick',
  'picks',
  'book',
  'books',
  'clear',
  'clears',
  'request',
  'requests',
  'offer',
  'offers',
  'send',
  'sends',
  'assign',
  'assigns',
  'prepare',
  'prepares',
];

/** Communication verbs — the core sequence signal. */
const COMM_VERBS = [
  'request',
  'requests',
  'requested',
  'ask',
  'asks',
  'asked',
  'send',
  'sends',
  'sent',
  'offer',
  'offers',
  'offered',
  'return',
  'returns',
  'reply',
  'replies',
  'respond',
  'responds',
  'notify',
  'notifies',
  'notified',
  'forward',
  'forwards',
  'deliver',
  'delivers',
  'provide',
  'provides',
  'confirm',
  'confirms',
  'acknowledge',
  'acknowledges',
  'invite',
  'invites',
  'message',
  'messages',
  'call',
  'calls',
];

/** Lifecycle-status vocabulary — the core state signal. Deliberately excludes
 *  generic process verbs (submit/approve/review) that also appear in swimlanes. */
const STATUS_WORDS = [
  'open',
  'opens',
  'opened',
  'in-progress',
  'in progress',
  'pending',
  'resolved',
  'resolve',
  'closed',
  'close',
  'closes',
  'reopen',
  'reopened',
  'reopens',
  'escalate',
  'escalated',
  'escalates',
  'on hold',
  'on-hold',
  'blocked',
  'cancelled',
  'canceled',
  'active',
  'inactive',
  'draft',
  'terminal',
  'status',
  'state',
];

const LOOP_WORDS = ['reopen', 'reopened', 'reopens', 'loop', 'retry', 'back to', 'revert'];

const TIME_WORDS = [
  'roadmap',
  'wave',
  'waves',
  'phase',
  'phases',
  'quarter',
  'quarters',
  'timeline',
  'chronology',
  'milestone',
  'milestones',
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
  'week',
  'weeks',
  'month',
  'months',
  'year',
  'years',
  'day',
  'days',
];

const SENTIMENT_WORDS = [
  'experience',
  'journey',
  'frustrated',
  'frustrating',
  'delighted',
  'delight',
  'happy',
  'unhappy',
  'satisfied',
  'satisfaction',
  'dissatisfied',
  'confused',
  'confusing',
  'excited',
  'anxious',
  'painful',
  'pain point',
  'sentiment',
  'feels',
  'feel',
  'emotion',
];

const DECISION_WORDS = ['if', 'else', 'otherwise', 'decision', 'approve/deny', 'either', 'branch', 'fails', 'fail'];

// --- Helpers --------------------------------------------------------------

function splitClauses(text: string): string[] {
  return text
    .split(/[;\n.]|,|\bthen\b|→|->/gi)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

function countMatches(haystack: string, needles: string[]): number {
  let n = 0;
  for (const needle of needles) {
    const re = new RegExp(`(?<![\\w-])${escapeRe(needle)}(?![\\w-])`, 'gi');
    const m = haystack.match(re);
    if (m) n += m.length;
  }
  return n;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function detectActors(text: string): string[] {
  const found = new Set<string>();
  const lower = text.toLowerCase();
  for (const actor of ACTOR_LEXICON) {
    const re = new RegExp(`(?<![\\w-])${escapeRe(actor)}(?![\\w-])`, 'i');
    if (re.test(lower)) found.add(actor);
  }
  for (const acr of ACRONYM_ACTORS) {
    // Match acronym actors case-sensitively (HR/IT) to avoid "it" the pronoun.
    const re = new RegExp(`\\b${acr.toUpperCase()}\\b`);
    if (re.test(text)) found.add(acr);
  }
  // Collapse overlapping matches (e.g. "hiring manager" also matches "manager").
  const result = [...found];
  return result.filter((a) => {
    if (a === 'manager' && found.has('hiring manager')) {
      // keep both only if "manager" appears outside "hiring manager"
      const withoutHiring = lower.replace(/hiring manager/g, '');
      return /(?<![\w-])manager(?![\w-])/.test(withoutHiring);
    }
    return true;
  });
}

function countDirectionalMessages(clauses: string[]): number {
  let n = 0;
  for (const clause of clauses) {
    const hasComm = COMM_VERBS.some((v) =>
      new RegExp(`(?<![\\w-])${escapeRe(v)}(?![\\w-])`, 'i').test(clause),
    );
    const hasDirection = /(?<![\w-])(to|from|for)(?![\w-])/i.test(clause);
    if (hasComm && hasDirection) n += 1;
  }
  return n;
}

// --- Analysis -------------------------------------------------------------

export function analyze(description: string): Signals {
  const text = description || '';
  const clauses = splitClauses(text);
  const actors = detectActors(text);

  return {
    clauses,
    actors,
    handoffVerbs: countMatches(text, HANDOFF_VERBS),
    directionalMessages: countDirectionalMessages(clauses),
    commVerbs: countMatches(text, COMM_VERBS),
    statusWords: countMatches(text, STATUS_WORDS),
    transitionArrows: (text.match(/→|->/g) || []).length,
    loopWords: countMatches(text, LOOP_WORDS),
    timeWords:
      countMatches(text, TIME_WORDS) +
      (text.match(/\bq[1-4]\b/gi)?.length || 0) * 2 +
      (text.match(/\b(19|20)\d{2}\b/g)?.length || 0) * 2,
    sentimentWords: countMatches(text, SENTIMENT_WORDS),
    decisionWords: countMatches(text, DECISION_WORDS),
  };
}

// --- Scoring --------------------------------------------------------------

/** Deterministic tie-break priority (higher index = lower priority). */
const PRIORITY: ModelId[] = ['sequence', 'state', 'timeline', 'journey', 'swimlane', 'flowchart'];

export function score(signals: Signals): Scored[] {
  const distinctActors = signals.actors.length;

  const scored: Scored[] = [];

  // SEQUENCE — directional message passing between actors. Comm verbs alone
  // (e.g. the noun "request") are NOT enough; there must be real direction.
  {
    const reasons: string[] = [];
    let s = signals.directionalMessages > 0
      ? signals.directionalMessages * 4 + signals.commVerbs
      : 0;
    if (signals.directionalMessages > 0)
      reasons.push(
        `${signals.directionalMessages} directional message${signals.directionalMessages > 1 ? 's' : ''} between parties (e.g. "requests … from", "sends … to")`,
      );
    if (signals.actors.includes('system')) {
      s += 1;
      reasons.push('a system participates in the exchange');
    }
    scored.push({ model: 'sequence', score: s, reasons });
  }

  // STATE — one entity moving through statuses.
  {
    const reasons: string[] = [];
    let s = signals.statusWords * 2 + signals.transitionArrows * 3 + signals.loopWords * 3;
    // A single-entity lifecycle, not a multi-actor handoff.
    if (distinctActors >= 3) s -= 3;
    if (signals.statusWords > 0)
      reasons.push(`${signals.statusWords} lifecycle-status terms (e.g. open, pending, resolved)`);
    if (signals.transitionArrows > 0)
      reasons.push(`${signals.transitionArrows} explicit status transitions`);
    if (signals.loopWords > 0) reasons.push('a loop back to an earlier status (e.g. reopen)');
    scored.push({ model: 'state', score: s, reasons });
  }

  // TIMELINE — chronology of events/phases/waves.
  {
    const reasons: string[] = [];
    const s = signals.timeWords * 3;
    if (signals.timeWords > 0) reasons.push('time/phase vocabulary (quarters, years, waves, phases)');
    scored.push({ model: 'timeline', score: s, reasons });
  }

  // JOURNEY — one person's experience across stages, with sentiment.
  {
    const reasons: string[] = [];
    const s = signals.sentimentWords * 3;
    if (signals.sentimentWords > 0) reasons.push('experience/sentiment language across stages');
    scored.push({ model: 'journey', score: s, reasons });
  }

  // SWIMLANE — multiple distinct roles each own steps and hand off.
  {
    const reasons: string[] = [];
    let s = 0;
    if (distinctActors >= 2) {
      s = distinctActors * 2 + signals.handoffVerbs - signals.directionalMessages * 3;
      reasons.push(
        `${distinctActors} distinct roles (${signals.actors.slice(0, 5).join(', ')}) owning different steps`,
      );
    }
    scored.push({ model: 'swimlane', score: s, reasons });
  }

  // FLOWCHART — default; branching with decision points.
  {
    const reasons: string[] = ['linear/branching steps with no distinct role ownership'];
    const s = 1 + signals.decisionWords * 2;
    if (signals.decisionWords > 0) reasons.unshift(`${signals.decisionWords} decision point(s)`);
    scored.push({ model: 'flowchart', score: s, reasons });
  }

  return scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return PRIORITY.indexOf(a.model) - PRIORITY.indexOf(b.model);
  });
}

// --- Public API -----------------------------------------------------------

export function selectModel(description: string): Selection {
  const signals = analyze(description);
  const scores = score(signals);
  const winner = scores[0];
  const rationale = buildRationale(winner);
  return { model: winner.model, rationale, scores, signals };
}

function buildRationale(winner: Scored): string {
  const modelName = winner.model.charAt(0).toUpperCase() + winner.model.slice(1);
  const reason = winner.reasons[0] ?? 'the overall structure of the description';
  return `${modelName} fits best: ${reason}.`;
}
