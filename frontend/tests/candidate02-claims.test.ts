import { describe, expect, it } from 'vitest';
import authoringSource from '../src/panels/AuthoringWorkspace.tsx?raw';
import classificationSource from '../src/panels/ClassificationWorkspace.tsx?raw';
import commandBoxSource from '../src/panels/CommandBox.tsx?raw';
import sourcingSource from '../src/panels/Sourcing.tsx?raw';

describe('Candidate 0.2 pre-preview claims', () => {
  it('names the connected classification route and its exact evidence ceiling', () => {
    expect(classificationSource).toContain('CONNECTED CANDIDATE 0.2 SERVICE · POST /api/classification');
    expect(classificationSource).toContain('SCHEMA- AND BYTE-SPAN VALIDATED');
    expect(classificationSource).toContain('Source authority, currency, completeness, and legal relevance are not verified.');
    expect(classificationSource).not.toContain('/api/classification/evaluate');
    expect(classificationSource).not.toContain('ENGINE-VERIFIED SPAN');
    expect(classificationSource).not.toContain('verified citation span');
  });

  it('qualifies modeled cost and client-carried order evidence', () => {
    expect(sourcingSource).toContain('modeled estimate from declared/fixture inputs; not a supplier quote or tariff determination');
    expect(sourcingSource).toContain('hash-linked, client-carried demo records');
    expect(sourcingSource).toContain('not durable, externally authenticated, or globally replay-protected');
    expect(sourcingSource).not.toContain('immutable order records');
    expect(sourcingSource).not.toContain('Create live bounded round');
    expect(sourcingSource).not.toContain('Live offer + screening evidence');
  });

  it('labels proprietary snapshots without obscuring STEP, IGES, or STL exchange', () => {
    expect(authoringSource).toContain('Connected Candidate 0.2 service · stateless kernel adapter');
    expect(authoringSource).toContain('CADdyDaddy snapshot (.caddy.json) & manufacturing outputs');
    expect(authoringSource).toContain('Retained STEP / IGES / STL exchange');
    expect(authoringSource).not.toContain('>Save native<');
    expect(authoringSource).not.toContain('>Load native<');
    expect(authoringSource).not.toContain('Native & manufacturing outputs');
  });

  it('keeps the launcher while removing the stale Atlas /now action', () => {
    expect(commandBoxSource).toContain("c.id !== 'doc.now'");
    expect(commandBoxSource).toContain('Open command palette');
    expect(commandBoxSource).toContain('Commands');
  });
});
