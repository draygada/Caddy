// Door 3 (a prompt becomes a slot list) and design-to-target, both bounded:
// the proposal can name only catalog parts or typed placeholders; the human is
// on the accept button; the same rules, walk and cost function score every result.
import { CATALOG, GENERIC_NAME, PALETTE, PART_IDS, SLOTS, type PartId, type Slot } from './catalog';
import { outcome, type Design, type Outcome } from './rules';

export interface SlotProposal { slot: Slot; role: string; mpn: string | null; pid: PartId | null; placeholder: boolean; rejected?: string }
export interface SlotListProposal { text: string; slots: SlotProposal[]; rejected: number; accepted: number }

/** Deterministic stand-in for the cached model response: keyword routing over the catalog; one off-catalog MPN is proposed on purpose so the verifier's rejection is visible. */
export function proposeSlotList(text: string): SlotListProposal {
  const t = text.toLowerCase();
  const pick = (slot: Slot, pid: PartId | null): SlotProposal => ({ slot, role: GENERIC_NAME[slot], mpn: pid ? CATALOG[pid].mpn : null, pid, placeholder: !pid });
  const slots: SlotProposal[] = [
    pick('battery', /long|endurance|range|hour/.test(t) ? 'amprius' : /battery|pack|power/.test(t) ? 'p45b' : null),
    pick('thermal', /thermal|infrared|ir\b|night/.test(t) ? (/high.?res|640|60 ?hz/.test(t) ? 'boson' : 'lepton') : null),
    pick('imu', /nav|inertial|tactical|imu|precision/.test(t) ? 'hg5700' : /survey|mapping|drone|uav/.test(t) ? 'icm' : null),
    pick('fc', /controller|pixhawk|autopilot|fc\b|flight/.test(t) ? 'h743' : null),
    pick('gnss', /gnss|gps|position|nav|survey|mapping/.test(t) ? (/anti.?jam|adaptive|crpa/.test(t) ? 'crpa' : 'neom9n') : null),
    pick('datalink', /link|radio|telemetry|video|datalink/.test(t) ? 'pmddl' : null),
    pick('pod', /pod|gimbal|payload|camera/.test(t) ? 'podeo' : null),
  ];
  // the model also proposed an MPN not in the catalog; the verifier rejects it and the slot becomes a placeholder
  if (/laser|lidar|rangefinder/.test(t)) slots.push({ slot: 'pod', role: 'Laser rangefinder', mpn: 'LRF-4000X', pid: null, placeholder: true, rejected: 'MPN LRF-4000X is not in the catalog · rejected by the verifier · placeholder' });
  const accepted = slots.filter((s) => s.pid).length;
  return { text, slots, rejected: slots.filter((s) => s.rejected).length, accepted };
}

export interface TargetConstraints { nlrTo: 'DE' | 'TW' | 'CA' | 'none'; maxDutyPct: 25 | 100 | 1000; noUsml: boolean }
export interface Ranked { parts: Record<Slot, PartId | null>; cost: number; outcome: Outcome; passes: boolean; deltas: string[] }

/** Brute force over the catalog's slot alternatives, scored by the same rules and the declared values. Status first; never ranked on price alone. */
export function searchTarget(base: Design, c: TargetConstraints, pack: Outcome['pack']): Ranked[] {
  // the thermal core is optional in a target search (an empty slot is a legitimate configuration); the pod stays as designed
  const options: Record<Slot, (PartId | null)[]> = Object.fromEntries(SLOTS.map((s) => [s, s === 'pod' ? [base.parts.pod] : s === 'thermal' ? [...PALETTE[s], null] : PALETTE[s]])) as Record<Slot, (PartId | null)[]>;
  const combos: Record<Slot, PartId | null>[] = [];
  const rec = (i: number, cur: Partial<Record<Slot, PartId | null>>) => {
    if (i === SLOTS.length) { combos.push(cur as Record<Slot, PartId | null>); return; }
    for (const pid of options[SLOTS[i]]) rec(i + 1, { ...cur, [SLOTS[i]]: pid });
  };
  rec(0, {});
  const out: Ranked[] = combos.map((parts) => {
    const attrs = Object.fromEntries(SLOTS.map((s) => [s, parts[s] ? { ...CATALOG[parts[s] as PartId].attrs } : {}])) as Design['attrs'];
    const o = outcome({ ...base, parts, attrs }, pack);
    const cost = SLOTS.reduce((sum, s) => sum + (parts[s] ? CATALOG[parts[s] as PartId].value_usd : 0), 0);
    const deltas: string[] = [];
    let passes = true;
    if (c.nlrTo !== 'none') { const cell = o.cols.airframe.find((x) => x.code === c.nlrTo); const ok = cell?.word === 'NLR'; if (!ok) passes = false; deltas.push(c.nlrTo + ' ' + (cell?.word ?? '?') + (ok ? ' ✓' : ' ✗')); }
    if (c.noUsml) { const ok = !o.rules.some((r) => r.kind === 'USML'); if (!ok) passes = false; deltas.push(ok ? 'no defense article ✓' : 'defense article in the tree ✗'); }
    const thermal = !!parts.thermal;
    const dutyPct = thermal ? 100 : 25;
    if (dutyPct > c.maxDutyPct) { passes = false; deltas.push('enters the US at +' + dutyPct + ' % (232) ✗'); } else deltas.push('enters the US at +' + dutyPct + ' % ✓');
    return { parts, cost, outcome: o, passes, deltas };
  });
  out.sort((a, b) => Number(b.passes) - Number(a.passes) || a.outcome.rules.length - b.outcome.rules.length || a.cost - b.cost);
  return out.slice(0, 8);
}

export const partName = (pid: PartId | null) => (pid ? CATALOG[pid].name : 'empty');
export const knownMpn = (mpn: string) => PART_IDS.some((p) => CATALOG[p].mpn === mpn);
