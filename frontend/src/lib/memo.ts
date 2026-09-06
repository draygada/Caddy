// The intent memo (F-18): drafted in the W8 spine, citations restricted to the
// rules that fired, edited and signed by the engineer. Draft for counsel review.
import type { Outcome, Rule } from './rules';
import { hashOf } from './hash';

export interface Memo { id: string; seq: number; text: string; citations: string[]; signedBy: string | null; hash: string | null; at: string }

export function draftMemo(o: Outcome, intent: string, changed: string, seq: number): Memo {
  const fired: Rule[] = o.rules;
  const citations = [...new Set(fired.map((r) => r.entry))];
  const releases = fired.filter((r) => /\(b\)\(3\)|see-through|VIII\(h\)/.test(r.entry + r.fr));
  const text = [
    'Product. Kestrel, a fixed-wing survey drone, as designed at log state #' + seq + '.',
    'What changed. ' + (changed || 'no change recorded') + (intent ? ' Intent recorded at the click: “' + intent + '”.' : ' No intent line was typed.'),
    'Order of review. USML rows were read first, then the CCL rows, then propagation through the assembly. ' + (fired.some((r) => r.kind === 'USML') ? 'A defense article is in the tree (' + fired.filter((r) => r.kind === 'USML').map((r) => r.entry).join(', ') + '); 22 CFR 120.11(c) see-through applies.' : 'No USML row fired.') + (fired.filter((r) => r.kind === 'CCL').length ? ' CCL rows met as designed: ' + fired.filter((r) => r.kind === 'CCL').map((r) => r.entry).join(', ') + '.' : ' No CCL row fired.'),
    'The release relied on. ' + (releases.length ? releases.map((r) => r.entry).join(', ') + ' as printed on the card; a production, non-USML equivalent releases only if named.' : 'None; no documentary release is in play.'),
    'The open fact. Whether the swapped part was “specially designed” is a question the engineer owns. It is printed as open, never decided by the tool.',
    'Draft for counsel review; citations limited to rules that fired; signed by the engineer.',
  ].join('\n\n');
  return { id: 'memo-' + seq, seq, text, citations, signedBy: null, hash: null, at: new Date().toISOString().slice(0, 16).replace('T', ' ') };
}

export const memoHash = (m: Memo) => hashOf(m.text.length * 131 + m.citations.length);
/** citations ⊆ fired, enforced before signing */
export const citationsWithin = (m: Memo, o: Outcome) => m.citations.every((c) => o.keys.includes(c));
