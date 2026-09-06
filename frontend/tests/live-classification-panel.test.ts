import { describe, expect, it } from 'vitest';
import { classificationExecutionEnabled } from '../src/panels/LiveClassificationPanel';

describe('live classification authorization gate', () => {
  it('keeps the deterministic route available without credentials', () => {
    expect(classificationExecutionEnabled('scripted', false, '', false)).toBe(true);
  });

  it('requires both the deployment token and the public-or-synthetic attestation', () => {
    expect(classificationExecutionEnabled('live-claude', false, '', true)).toBe(false);
    expect(classificationExecutionEnabled('live-claude', false, 'demo-token', false)).toBe(false);
    expect(classificationExecutionEnabled('live-claude', false, 'demo-token', true)).toBe(true);
  });

  it('prevents duplicate execution while a request is running', () => {
    expect(classificationExecutionEnabled('live-claude', true, 'demo-token', true)).toBe(false);
  });
});
