// Display-layer units. Everything is stored in metres; only formatting and
// input parsing change when the document unit switches.
export type Unit = 'm' | 'mm' | 'in';
export const UNITS: Unit[] = ['m', 'mm', 'in'];
const FACTOR: Record<Unit, number> = { m: 1, mm: 1000, in: 39.37007874015748 };
const DP: Record<Unit, number> = { m: 2, mm: 0, in: 2 };

export const toUnit = (metres: number, u: Unit) => metres * FACTOR[u];
export const fromUnit = (v: number, u: Unit) => v / FACTOR[u];
export const unitDp = (u: Unit, fine = false) => (fine ? DP[u] + 1 : DP[u]);
/** "3.40 m", "3400 mm", "133.86 in" */
export const fmtLen = (metres: number, u: Unit, fine = false) => toUnit(metres, u).toFixed(unitDp(u, fine)) + ' ' + u;
export const fmtNum = (metres: number, u: Unit, fine = false) => toUnit(metres, u).toFixed(unitDp(u, fine));
export const unitStep = (u: Unit) => (u === 'm' ? 0.01 : u === 'mm' ? 1 : 0.05);
