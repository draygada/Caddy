// Pure view-model derivations from an Outcome plus shell state. No React here.
import {
  AIRFRAME, CATALOG, ECFR_DATE, FIELDS, SLOT_LABEL,
  type FieldSpec, type Node, type PartAttrs, type PartId, type Slot, type TimelineEvent,
} from './catalog';
import type { Outcome, Parts, Rule } from './rules';

export interface StatusWord { word: string; color: string }
export type Unconfirmed = Partial<Record<Slot, number>>;

export const col = (t: string) => 'var(--' + t + ')';

export function slotStatus(o: Outcome, unconfirmed: Unconfirmed, slot: Node): StatusWord {
  if (slot !== 'airframe' && unconfirmed[slot]) return { word: '? unconfirmed', color: col('amber') };
  const rs = o.rules.filter((r) => r.node === slot);
  if (rs.some((r) => r.kind === 'USML')) return { word: 'USML · DDTC', color: col('black') };
  if (rs.length) return { word: rs[0].entry + (rs.length > 1 ? ' +' + (rs.length - 1) : ''), color: col('red') };
  const cannot = o.cannot.filter((c) => c.node === slot).length;
  if (cannot) return { word: 'review · missing evidence ×' + cannot, color: col('amber') };
  return { word: 'no match · limited scan', color: col('amber') };
}

export interface PartInfo { name: string; vendor: string; origin: string; real: boolean }
export function partOf(slot: Node, parts: Parts, span: number): PartInfo | null {
  if (slot === 'airframe') return { ...AIRFRAME, name: AIRFRAME.name + ' · span ' + span.toFixed(1) + ' m' };
  const pid = parts[slot];
  return pid ? CATALOG[pid] : null;
}

export interface Overall { glyph: string; word: string; color: string; bg: string; sub: string; entries: string }
export function overallOf(o: Outcome): Overall {
  const af = o.cols.airframe;
  const productEntries = o.rules.filter((r) => r.node === 'airframe').map((r) => r.entry);
  const partEntries = o.rules.filter((r) => r.node !== 'airframe').map((r) => r.entry + ' (' + SLOT_LABEL[r.node] + ')');
  const licDest = af.filter((d) => d.word === 'LIC').map((d) => d.code), staDest = af.filter((d) => d.word === 'STA').map((d) => d.code);
  let overall: Omit<Overall, 'entries'>;
  if (o.rules.some((r) => r.kind === 'USML')) overall = { glyph: '■', word: 'USML · DDTC', color: 'var(--blackfg)', bg: 'var(--black)', sub: 'a defense article is in the tree; every destination needs DDTC authorization; CN is a 126.1 denial' };
  else if (licDest.length) overall = { glyph: '●', word: 'LIC · licence required', color: col('red'), bg: 'transparent', sub: 'at ' + licDest.join(' · ') + (staDest.length ? ' · exception path at ' + staDest.join(' · ') : '') };
  else if (staDest.length) overall = { glyph: '?', word: 'STA · exception path', color: col('amber'), bg: 'transparent', sub: 'at ' + staDest.join(' · ') + ' · conditions apply' };
  else overall = { glyph: '?', word: 'Limited scan · review required', color: col('amber'), bg: 'transparent', sub: 'no match in the modeled rows · Parts 744 / 746 and other controls were not evaluated' };
  const entries = productEntries.length
    ? 'as designed, meets the parameters of ' + productEntries.join(' · ') + (partEntries.length ? ' · parts: ' + partEntries.join(' · ') : '')
    : partEntries.length ? 'no product match in the modeled rows · parts with modeled matches: ' + partEntries.join(' · ') : 'no match among 14 modeled rows · not an NLR or export authorization';
  return { ...overall, entries };
}

export interface Attention { glyph: string; word: string; color: string; bg: string; text: string; action: string; target: { kind: 'go'; slot: Node } | { kind: 'reopen'; slot: Slot } | null }
export function attentionOf(o: Outcome, unconfirmed: Unconfirmed): Attention[] {
  const af = o.cols.airframe;
  const licDest = af.filter((d) => d.word === 'LIC').map((d) => d.code), staDest = af.filter((d) => d.word === 'STA').map((d) => d.code);
  const mt = o.rules.some((r) => r.cols === 'MT');
  const a: Attention[] = [];
  if (o.rules.some((r) => r.kind === 'USML')) a.push({ glyph: '■', word: 'DDTC', color: 'var(--blackfg)', bg: 'var(--black)', text: 'defense article incorporated (see-through)', action: 'DDTC authorization before any export or foreign-person disclosure', target: { kind: 'go', slot: 'imu' } });
  if (mt) a.push({ glyph: '●', word: 'MT', color: col('red'), bg: 'transparent', text: 'MT column fired · STA barred', action: 'licence at DE · TW · VN · CN', target: { kind: 'go', slot: 'airframe' } });
  else if (licDest.length) a.push({ glyph: '●', word: 'LIC', color: col('red'), bg: 'transparent', text: 'licence required at ' + licDest.join(' · '), action: 'apply before shipping, or change the design', target: { kind: 'go', slot: 'airframe' } });
  if (staDest.length && !mt) a.push({ glyph: '?', word: 'STA', color: col('amber'), bg: 'transparent', text: 'exception path at ' + staDest.join(' · '), action: '740.20 conditions and consignee statement', target: { kind: 'go', slot: 'airframe' } });
  (Object.keys(unconfirmed) as Slot[]).forEach((slot) => a.push({ glyph: '?', word: 'attest', color: col('amber'), bg: 'transparent', text: 'swap on ' + SLOT_LABEL[slot] + ' unconfirmed', action: 'Confirm with an attestor, or leave amber', target: { kind: 'reopen', slot } }));
  o.advisories.filter((x) => x.entry.startsWith('§848')).forEach((x) => a.push({ glyph: '$', word: 'buyer', color: col('amber'), bg: 'transparent', text: 'PRC-origin part on ' + SLOT_LABEL[x.node], action: 'federal-buyer flags · amber, never red', target: { kind: 'go', slot: x.node } }));
  o.cannot.forEach((c) => a.push({ glyph: '○', word: 'data', color: col('grey'), bg: 'transparent', text: c.entry + ' cannot fire on ' + SLOT_LABEL[c.node], action: 'a datasheet with the field is needed', target: { kind: 'go', slot: c.node } }));
  a.push({ glyph: '?', word: 'coverage', color: col('amber'), bg: 'transparent', text: 'limited regulatory coverage', action: 'human review required before any export decision · Parts 744 / 746 and other controls are not modeled', target: null });
  return a;
}

export interface DestCellVM { code: string; word: string; para: string; color: string; bg: string }
export function destCellsOf(o: Outcome, node: Node): DestCellVM[] {
  return o.cols[node].map((d) => d.word === 'NLR'
    ? { code: d.code, word: 'REVIEW', para: 'no match in modeled columns · incomplete coverage', color: col('amber'), bg: 'transparent' }
    : { code: d.code, word: d.word, para: d.para, color: d.tone === 'black' ? 'var(--blackfg)' : col(d.tone), bg: d.tone === 'black' ? 'var(--black)' : 'transparent' });
}

export interface SpecAttr {
  field: FieldSpec;
  /** current instance value; null = not published; undefined = slot empty */
  value: number | null | undefined;
  /** datasheet value this part shipped with, for the "edited" comparison */
  template: number | null | undefined;
  level: string;
  levelColor: string;
  source: string;
}

/** One row per editable regulated field: current value, evidence level, and where the value came from. */
export function specAttrsOf(sel: Slot, pid: PartId | null, attrs: PartAttrs, extracted: Record<string, { by: string; verified: boolean }> = {}): SpecAttr[] {
  const tpl = pid ? CATALOG[pid] : null;
  return FIELDS[sel].map((field) => {
    const value = attrs[field.key] as number | null | undefined;
    const template = tpl ? (tpl.attrs[field.key] as number | null | undefined) : undefined;
    if (!tpl) return { field, value, template, level: 'missing', levelColor: 'var(--amber)', source: 'no part in this slot' };
    if (value == null) {
      const inrun = sel === 'imu' && field.key === 'bias' && attrs.inrun != null ? 'not published · vendor quotes in-run bias instability ' + attrs.inrun + ' °/h instead' : 'not published by the vendor';
      return { field, value, template, level: 'missing', levelColor: 'var(--amber)', source: inrun };
    }
    const ex = extracted[sel + '.' + field.key];
    if (ex && !ex.verified) return { field, value, template, level: 'L1 ' + ex.by, levelColor: 'var(--amber)', source: 'extracted by the ' + ex.by + ' · verified bytes · not yet ticked “verified against datasheet” by a human' };
    if (ex && ex.verified) return { field, value, template, level: 'L2 datasheet', levelColor: 'var(--muted)', source: 'extracted by the ' + ex.by + ' · verified against the datasheet by a human' };
    if (value !== template) return { field, value, template, level: 'L1 edited', levelColor: 'var(--amber)', source: 'typed in the spec · datasheet said ' + (template == null ? 'not published' : template.toFixed(field.dp) + (field.unit ? ' ' + field.unit : '')) };
    return { field, value, template, level: tpl.real === false ? 'synthetic' : 'L2 datasheet', levelColor: 'var(--muted)', source: tpl.real === false ? 'SYNTHETIC fixture row' : 'vendor datasheet' };
  });
}

export interface Card {
  id: string; entry: string; node: string; reason: string; word: string; glyph: string; color: string; bg: string;
  expandable: boolean; sentence: string; number: string; ecfr: string; eff: string; fr: string; url: string; atoms: string[];
}
export interface CardGroup { name: string; count: number; cards: Card[] }

const GLYPH: Record<Rule['kind'], string> = { USML: '■', CCL: '●' };

export function cardGroupsOf(o: Outcome, unconfirmed: Unconfirmed, events: TimelineEvent[]): CardGroup[] {
  const cardOf = (r: Rule): Card => ({
    id: r.id, entry: r.entry, node: SLOT_LABEL[r.node], reason: r.reason, word: r.kind === 'USML' ? 'USML' : 'fired', glyph: GLYPH[r.kind],
    color: r.kind === 'USML' ? 'var(--blackfg)' : col('red'), bg: r.kind === 'USML' ? 'var(--black)' : 'transparent', expandable: true,
    sentence: r.sentence, number: r.number, ecfr: r.ecfr, eff: r.eff, fr: r.fr, url: r.url, atoms: r.atoms,
  });
  const groups: CardGroup[] = [];
  const usml = o.rules.filter((r) => r.kind === 'USML').map(cardOf), ccl = o.rules.filter((r) => r.kind === 'CCL').map(cardOf);
  if (usml.length) groups.push({ name: 'USML · order of review first', count: usml.length, cards: usml });
  if (ccl.length) groups.push({ name: 'CCL', count: ccl.length, cards: ccl });
  const openFacts = (Object.keys(unconfirmed) as Slot[]).map((slot): Card => {
    const seq = unconfirmed[slot];
    const ev = events.find((e) => e.seq === seq);
    return {
      id: 'of-' + seq, entry: '(b)(3) open fact', node: SLOT_LABEL[slot], reason: 'comparator changed on swap · “specially designed” is a question the engineer owns · unconfirmed',
      word: 'open fact', glyph: '?', color: col('amber'), bg: 'transparent', expandable: true,
      sentence: '(b)(3) … a production, non-USML equivalent with the same function, performance, and the same or “equivalent” form and fit.',
      number: ev ? ev.entry : '', ecfr: ECFR_DATE, eff: '2022-09-06', fr: '22 CFR 120.41(b)(3) · 15 CFR 772.1 Note 3 · printed as open, never decided', url: 'ecfr.gov/…/title-22/part-120 · 120.41',
      atoms: ['confirmed_by: null · Confirm in the comparison card'],
    };
  });
  if (openFacts.length) groups.push({ name: 'open facts', count: openFacts.length, cards: openFacts });
  const cannot = o.cannot.map((c): Card => ({ id: c.id, entry: c.entry, node: SLOT_LABEL[c.node], reason: c.text, word: 'cannot fire', glyph: '○', color: col('grey'), bg: 'transparent', expandable: false, sentence: '', number: '', ecfr: '', eff: '', fr: '', url: '', atoms: [] }));
  if (cannot.length) groups.push({ name: 'cannot fire · silence is not green', count: cannot.length, cards: cannot });
  return groups;
}
