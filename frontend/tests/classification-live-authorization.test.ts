import { describe, expect, it } from 'vitest';
import classificationSource from '../src/panels/ClassificationWorkspace.tsx?raw';
import { classificationRunEnabled } from '../src/panels/ClassificationWorkspace';

describe('live Claude authorization UX', () => {
  it('keeps ScriptedModel available by default and gates live execution on both controls', () => {
    expect(classificationRunEnabled('scripted', false, '', false)).toBe(true);
    expect(classificationRunEnabled('live-claude', false, '', false)).toBe(false);
    expect(classificationRunEnabled('live-claude', false, 'demo-token', false)).toBe(false);
    expect(classificationRunEnabled('live-claude', false, '', true)).toBe(false);
    expect(classificationRunEnabled('live-claude', false, 'demo-token', true)).toBe(true);
    expect(classificationRunEnabled('live-claude', true, 'demo-token', true)).toBe(false);
  });

  it('uses a memory-only password control and contains no persistence, URL, or logging sink', () => {
    expect(classificationSource).toContain("useState<ClassificationRunMode>('scripted')");
    expect(classificationSource).toContain('type="password"');
    expect(classificationSource).toContain('autoComplete="off"');
    expect(classificationSource).not.toMatch(/localStorage|sessionStorage|URLSearchParams|location\.|console\./);
    expect(classificationSource).not.toMatch(/>\s*\{liveAccessToken\}\s*</);
  });

  it('states the outbound-data boundary and labels provenance without legal validity', () => {
    expect(classificationSource).toContain('This request sends the product description and facts to Anthropic.');
    expect(classificationSource).toContain('not approved for CUI, export-controlled technical data, customer data, secrets');
    expect(classificationSource).toContain('Service-reported provider / model');
    expect(classificationSource).toContain('not a legal determination');
  });
});
