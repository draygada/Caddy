import { describe, expect, it } from 'vitest';
import { engineRunFingerprint, engineRunRecordIsCurrent, engineRunTone } from '../src/panels/EngineRun';

describe('context-bound engine runs', () => {
  it('invalidates retained evidence when facts or the design revision changes', () => {
    const fingerprint = engineRunFingerprint('flight controller', { origin: 'US' });
    const record = { requestFingerprint: fingerprint, revisionId: 'revision:4' };
    expect(engineRunRecordIsCurrent(record, fingerprint, 'revision:4')).toBe(true);
    expect(engineRunRecordIsCurrent(record, engineRunFingerprint('flight controller', { origin: 'DE' }), 'revision:4')).toBe(false);
    expect(engineRunRecordIsCurrent(record, fingerprint, 'revision:5')).toBe(false);
  });

  it('never presents EAR99 as a green clearance state', () => {
    expect(engineRunTone('EAR99')).toBe('var(--amber)');
    expect(engineRunTone('EAR99')).not.toBe('var(--green)');
  });
});
