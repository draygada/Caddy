// The customs filing draft the sourcing tab shows after a package: one pre-entry line per picked part,
// export references on an export leg, retention, warnings and the checklist. Computed in the browser from the
// round's own ladders so the shape mirrors the sourcing lane's package.py (pre_entry_lines, export_references,
// retention, warnings); when the product service exposes that package the view reads it instead of this.
import type { Round } from '../store';
import type { Outcome } from './rules';
import { CHECKLIST, CLAIM_COST, CLAIM_PACKAGE, WARNINGS, gateFor, type LadderRow, type PartyNode, type ResolvedOffer } from './sourcing';

export interface FilingOverlay { program: string; citation: string; rate: string; amount: number }
export interface FilingLine {
  lineId: string;
  description: string;
  partClass: string;
  qty: number;
  unitValue: number;
  declaredValue: number;
  valuationBasis: string;
  hts: string;
  htsBy: string;
  origin: string;
  originBasis: string;
  manufacturer: string;
  seller: string;
  shipFrom: string;
  /** the entry is modelled: an import into the US from abroad */
  importModelled: boolean;
  /** why the entry is not modelled: domestic purchase, or an export leg */
  note: string | null;
  base: LadderRow | null;
  overlays: FilingOverlay[];
  adcvd: string;
  mpf: LadderRow | null;
  hmf: LadderRow | null;
  duties: number;
  fees: number;
  landed: number | null;
  perUnit: number | null;
  unverified: boolean;
  estimateHash: string;
  flags: string[];
}
export interface ExportReference { lineId: string; description: string; eccn: string; gate: string; para: string; eeiRequired: boolean; why: string }
export interface FilingDraft {
  roundId: string;
  designSeq: number;
  designHash: string;
  shipTo: string;
  qty: number;
  mode: string;
  entryDate: string;
  lines: FilingLine[];
  /** picked lines with no resolved offer, or lines never picked: the draft covers picked lines only */
  open: string[];
  totals: { declared: number; duties: number; fees: number; landed: number; unverified: number };
  exportRefs: ExportReference[];
  retention: { years: number; until: string; basis: string[] };
  warnings: string[];
  checklist: string[];
  disclaimer: string[];
}

const OVERLAY_LAYERS = ['Section 232', 'Section 301', 'country action'];
const DISCLAIMER = [
  CLAIM_PACKAGE,
  CLAIM_COST,
  'Draft prepared for review by a licensed customs broker. Not a customs entry (CBP Form 7501), not a broker engagement or power of attorney, not legal, customs or tax advice. The importer of record remains responsible under 19 CFR 141.1.',
];

function manufacturerOf(tree: PartyNode): string | null {
  const walk = (n: PartyNode): string | null => {
    if (/manufacturer|maker|oem/i.test(n.role)) return n.name;
    for (const c of n.children) { const m = walk(c); if (m) return m; }
    return null;
  };
  return walk(tree);
}

function partnerAgencyFlags(partClass: string): string[] {
  const flags: string[] = [];
  if (partClass === 'radio') flags.push('FCC: two states, authorized already or barred from new authorization under the Covered List (DA 25-1086); check by model number (47 CFR 2); status: to be checked');
  if (partClass === 'cell' || partClass === 'pack') flags.push('lithium: carriage documentation (UN3480 cells alone, UN 38.3 test summary, shipper declaration by air), not an entry flag (49 CFR 173.185)');
  flags.push('9802.00.80: not applicable to a part import; the assembler declaration (19 CFR 10.24) applies at the product level');
  return flags;
}

const plusYears = (iso: string, years: number) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCFullYear(d.getUTCFullYear() + years); return d.toISOString().slice(0, 10); };

/** The filing draft for a round: picked lines only, every number from the round's own ladder. */
export function filingDraftOf(round: Round, o: Outcome, entryDate = new Date().toISOString().slice(0, 10)): FilingDraft {
  const lines: FilingLine[] = [];
  const open: string[] = [];
  const exportRefs: ExportReference[] = [];
  let anyItar = false, anyImport = false;
  for (const line of round.lines) {
    const sel = round.selections[line.id];
    const ro: ResolvedOffer | undefined = sel ? (round.offers[line.id] || []).find((x) => x.offer.id === sel.offerId) : undefined;
    if (!ro) { open.push(line.description.split(' · ')[0]); continue; }
    const qty = line.qtyPerUnit * round.qty;
    const rows = ro.ladder.rows;
    const base = rows.find((r) => r.layer.startsWith('base rate')) ?? null;
    const overlays: FilingOverlay[] = rows.filter((r) => OVERLAY_LAYERS.includes(r.layer) && r.amount != null && r.amount > 0).map((r) => ({ program: r.layer, citation: r.citation, rate: r.rate, amount: r.amount as number }));
    const adcvd = rows.find((r) => r.layer === 'AD/CVD scope')?.note ?? 'not evaluated';
    const mpf = rows.find((r) => r.layer === 'MPF') ?? null, hmf = rows.find((r) => r.layer === 'HMF') ?? null;
    const domestic = ro.ladder.domestic;
    const exportLeg = round.shipTo !== 'US';
    const importModelled = !domestic && !exportLeg;
    if (importModelled) anyImport = true;
    const duties = (base?.amount ?? 0) + overlays.reduce((s, x) => s + x.amount, 0);
    const fees = (mpf?.amount ?? 0) + (hmf?.amount ?? 0);
    const gate = gateFor(line, o, round.shipTo);
    if (gate.word === 'DDTC') anyItar = true;
    lines.push({
      lineId: line.id, description: line.description, partClass: line.partClass, qty,
      unitValue: ro.offer.unitPrice, declaredValue: ro.offer.unitPrice * qty, valuationBasis: 'transaction value · seller list price · declared, not invoiced',
      hts: ro.offer.declaredHts, htsBy: 'declared by ' + ro.offer.seller + ' · heading level only',
      origin: ro.offer.declaredOrigin, originBasis: 'declared by ' + ro.offer.seller + (ro.offer.authorized ? ' · authorized distributor' : ' · not an authorized distributor'),
      manufacturer: manufacturerOf(ro.tree) ?? 'not declared', seller: ro.offer.seller, shipFrom: ro.offer.shipFrom,
      importModelled, note: domestic ? 'domestic purchase · no entry' : exportLeg ? 'export leg · the entry is the assembler’s, in ' + round.shipTo : null,
      base, overlays, adcvd, mpf, hmf, duties, fees, landed: ro.ladder.total, perUnit: ro.ladder.perUnit, unverified: ro.ladder.unverified, estimateHash: ro.ladder.hash,
      flags: importModelled ? partnerAgencyFlags(line.partClass) : [],
    });
    if (exportLeg) {
      const value = ro.offer.unitPrice * qty;
      const licensed = gate.word === 'LIC' || gate.word === 'DDTC';
      const eei = licensed || value > 2500;
      exportRefs.push({ lineId: line.id, description: line.description.split(' · ')[0], eccn: line.declaredEccn.split(' · ')[0], gate: gate.word, para: gate.para, eeiRequired: eei, why: licensed ? 'licensed or ITAR line: always files' : eei ? 'value over $2,500 per Schedule B line' : 'under $2,500 and no licence: NOEEI 30.37(a)' });
    }
  }
  const totals = lines.reduce((t, l) => ({ declared: t.declared + l.declaredValue, duties: t.duties + l.duties, fees: t.fees + l.fees, landed: t.landed + (l.landed ?? l.declaredValue), unverified: t.unverified + (l.unverified ? 1 : 0) }), { declared: 0, duties: 0, fees: 0, landed: 0, unverified: 0 });
  const basis = ['19 CFR 163.4 · entry records five years from the date of entry'];
  if (anyItar) basis.push('22 CFR 122.5 · ITAR records five years from expiry of the licence or the export');
  if (round.shipTo !== 'US') basis.push('15 CFR 762.6 · EAR records five years from the export');
  const warnings = [...WARNINGS.filter((w) => !w.startsWith('EEI')), round.shipTo === 'US' ? 'EEI filing is not evaluated for this import package; reassess any later export leg' : 'EEI filing review is required for this export leg; assess each Schedule B line and any licence or ITAR condition'];
  void anyImport;
  return {
    roundId: round.id, designSeq: round.designSeq, designHash: round.designHash, shipTo: round.shipTo, qty: round.qty, mode: round.mode, entryDate,
    lines, open, totals, exportRefs,
    retention: { years: 5, until: plusYears(entryDate, 5), basis },
    warnings, checklist: [...CHECKLIST], disclaimer: DISCLAIMER,
  };
}
