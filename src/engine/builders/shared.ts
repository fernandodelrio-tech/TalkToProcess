/**
 * Shared parsing utilities for the diagram builders.
 *
 * Builders turn a plain-language description into Mermaid source. They all
 * sanitize their labels (NFR-4) via `sanitizeLabel`.
 */

import { sanitizeLabel } from '../sanitize';

/** Split a description into ordered step phrases. */
export function toSteps(description: string): string[] {
  return (description || '')
    .split(/[;\n.]|,|\bthen\b|→|->/gi)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => sanitizeLabel(s));
}

/** A step split into its leading actor (subject) and the rest (action). */
export interface OwnedStep {
  actor: string;
  action: string;
  raw: string;
}

const ACTOR_PATTERNS: { re: RegExp; name: string }[] = [
  { re: /\bhiring manager\b/i, name: 'Hiring Manager' },
  { re: /\btier two\b/i, name: 'Tier Two' },
  { re: /\btier one\b/i, name: 'Tier One' },
  { re: /\bhelp ?desk\b/i, name: 'Help Desk' },
  { re: /\bemployee\b/i, name: 'Employee' },
  { re: /\bmanager\b/i, name: 'Manager' },
  { re: /\bhrbp\b/i, name: 'HRBP' },
  { re: /\bpayroll\b/i, name: 'Payroll' },
  { re: /\brecruiter\b/i, name: 'Recruiter' },
  { re: /\bcandidate\b/i, name: 'Candidate' },
  { re: /\bapplicant\b/i, name: 'Applicant' },
  { re: /\bsystem\b/i, name: 'System' },
  { re: /\bcustomer\b/i, name: 'Customer' },
  { re: /\bclient\b/i, name: 'Client' },
  { re: /\bvendor\b/i, name: 'Vendor' },
  { re: /\bHR\b/, name: 'HR' },
  { re: /\bIT\b/, name: 'IT' },
];

/** Best-effort: find the owning actor named in a clause. */
export function findActor(clause: string): string | null {
  for (const { re, name } of ACTOR_PATTERNS) {
    if (re.test(clause)) return name;
  }
  return null;
}

/** Assign each step to an owning actor, carrying forward the previous owner
 *  when a clause names none. */
export function toOwnedSteps(description: string): OwnedStep[] {
  const raws = (description || '')
    .split(/[;\n.]|\bthen\b/gi)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const steps: OwnedStep[] = [];
  let lastActor = 'Process';
  for (const raw of raws) {
    // A clause may itself contain comma-separated sub-steps.
    const parts = raw.split(/,/).map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      const actor = findActor(part) ?? lastActor;
      lastActor = actor;
      const action = sanitizeLabel(part);
      steps.push({ actor, action, raw: part });
    }
  }
  return steps;
}

/** Distinct ordered actor list from owned steps. */
export function distinctActors(steps: OwnedStep[]): string[] {
  const seen: string[] = [];
  for (const s of steps) if (!seen.includes(s.actor)) seen.push(s.actor);
  return seen;
}

/** Derive a short title from the description. */
export function deriveTitle(description: string, fallback: string): string {
  const first = (description || '').split(/[;\n.:]/)[0]?.trim() ?? '';
  const words = first.split(/\s+/).slice(0, 6).join(' ');
  return sanitizeLabel(words || fallback, fallback);
}
