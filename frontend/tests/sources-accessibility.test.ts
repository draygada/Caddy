import { describe, expect, it } from 'vitest';
import sourcesSource from '../src/panels/Sources.tsx?raw';

describe('Sources workspace accessibility contract', () => {
  it('explicitly labels and describes the source-lane and target-part selectors', () => {
    expect(sourcesSource).toContain('htmlFor="source-provenance-lane"');
    expect(sourcesSource).toContain('id="source-provenance-lane" aria-describedby="source-provenance-lane-description"');
    expect(sourcesSource).toContain('htmlFor="source-offline-document"');
    expect(sourcesSource).toContain('id="source-offline-document" aria-describedby="source-provenance-lane-description"');
    expect(sourcesSource).toContain('htmlFor="source-target-part"');
    expect(sourcesSource).toContain('id="source-target-part" aria-describedby="source-target-part-description"');
  });

  it('gives every operator-provided source input an explicit programmatic label', () => {
    for (const id of ['source-document-id', 'source-document-title', 'source-document-locator', 'source-document-text', 'source-exact-quote', 'source-target-field', 'source-numeric-value', 'source-unit']) {
      expect(sourcesSource).toContain(`htmlFor="${id}"`);
      expect(sourcesSource).toContain(`id="${id}"`);
    }
  });

  it('names repeated actions with their source or candidate context', () => {
    expect(sourcesSource).toContain('aria-label={`Load offline source fixture: ${DOCS[id].title}`}');
    expect(sourcesSource).toContain('aria-label={`Apply verified ${p.claim.field} span from ${p.label} to ${SLOT_LABEL[src.slot]}`}');
    expect(sourcesSource).toContain('aria-label={`Accept ${c.name} candidate; record human part swap before attestation`}');
  });

  it('labels the explicit acceptance control and focuses a deterministic confirmation without upgrading provenance', () => {
    expect(sourcesSource).toContain('<label htmlFor={controlId}>Acknowledge source acceptance for');
    expect(sourcesSource).toContain('aria-describedby={`${controlId}-description`}');
    expect(sourcesSource).toContain('acceptanceConfirmationRef.current?.focus()');
    expect(sourcesSource).toContain('role="status" aria-live="polite" aria-atomic="true"');
    expect(sourcesSource).toContain('UNAUTHENTICATED_BROWSER_SESSION, MEMORY_ONLY, NOT_HUMAN_REVIEWED');
    expect(sourcesSource).toContain('No identity or attestor is captured.');
    expect(sourcesSource).not.toContain('reviewStatus: \'HUMAN_REVIEWED\'');
  });
});
