/** Sequence builder — `sequenceDiagram`. Time-ordered messages between actors. */

import { sanitizeLabel } from '../sanitize';

const ACTOR_SCAN: { re: RegExp; name: string }[] = [
  { re: /hiring manager/gi, name: 'Hiring Manager' },
  { re: /tier two/gi, name: 'Tier Two' },
  { re: /recruiter/gi, name: 'Recruiter' },
  { re: /candidate/gi, name: 'Candidate' },
  { re: /employee/gi, name: 'Employee' },
  { re: /manager/gi, name: 'Manager' },
  { re: /system/gi, name: 'System' },
  { re: /hrbp/gi, name: 'HRBP' },
  { re: /payroll/gi, name: 'Payroll' },
  { re: /customer/gi, name: 'Customer' },
  { re: /client/gi, name: 'Client' },
  { re: /vendor/gi, name: 'Vendor' },
  { re: /\bHR\b/g, name: 'HR' },
  { re: /\bIT\b/g, name: 'IT' },
];

/** All actors mentioned in a clause, in order of first appearance. */
function actorsInOrder(clause: string): string[] {
  const hits: { name: string; index: number }[] = [];
  for (const { re, name } of ACTOR_SCAN) {
    const m = re.exec(clause);
    if (m) hits.push({ name, index: m.index });
    re.lastIndex = 0;
  }
  hits.sort((a, b) => a.index - b.index);
  const ordered: string[] = [];
  for (const h of hits) if (!ordered.includes(h.name)) ordered.push(h.name);
  return ordered;
}

export function buildSequence(description: string): string {
  const clauses = (description || '')
    .split(/[;\n.]|\bthen\b/gi)
    .map((c) => c.trim())
    .filter(Boolean);

  const participants: string[] = [];
  const messages: { from: string; to: string; text: string }[] = [];
  let lastActor: string | null = null;

  for (const clause of clauses) {
    const found = actorsInOrder(clause);
    for (const a of found) if (!participants.includes(a)) participants.push(a);

    let from: string;
    let to: string;
    if (found.length >= 2) {
      from = found[0];
      to = found[1];
    } else if (found.length === 1) {
      from = lastActor && lastActor !== found[0] ? lastActor : found[0];
      to = found[0];
      if (from === to) {
        // Self-message; still valid Mermaid.
      }
    } else {
      from = lastActor ?? 'Actor';
      to = lastActor ?? 'Actor';
    }
    if (!participants.includes(from)) participants.push(from);
    if (!participants.includes(to)) participants.push(to);

    const text = sanitizeLabel(clause, 'message');
    messages.push({ from, to, text });
    lastActor = to;
  }

  const lines: string[] = ['sequenceDiagram'];
  for (const p of participants) {
    lines.push(`  participant ${aliasFor(p)} as ${sanitizeLabel(p)}`);
  }
  for (const msg of messages) {
    lines.push(`  ${aliasFor(msg.from)}->>${aliasFor(msg.to)}: ${msg.text}`);
  }

  if (messages.length === 0) {
    return 'sequenceDiagram\n  participant A as Actor\n  A->>A: No messages provided';
  }
  return lines.join('\n');
}

/** A safe participant alias (Mermaid ids cannot contain spaces). */
function aliasFor(name: string): string {
  return name.replace(/[^A-Za-z0-9]/g, '') || 'Actor';
}
