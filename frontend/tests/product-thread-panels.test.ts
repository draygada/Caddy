import { describe, expect, it } from 'vitest';
import sourcingSource from '../src/panels/Sourcing.tsx?raw';
import sourcesSource from '../src/panels/Sources.tsx?raw';
import classificationSource from '../src/panels/ClassificationWorkspace.tsx?raw';
import coreSource from '../src/panels/CoreAssemblyWorkspace.tsx?raw';
import recordSource from '../src/panels/Record.tsx?raw';

describe('product-thread panel wiring', () => {
  it('records successful source and classification outcomes', () => {
    expect(sourcesSource).toContain("eventType: 'sources.change_accepted_for_local_review'");
    expect(sourcesSource).toContain("kind: 'source-verification-receipt'");
    expect(sourcesSource).toContain('UNAUTHENTICATED_BROWSER_SESSION');
    expect(sourcesSource).toContain('NOT HUMAN REVIEW');
    expect(sourcesSource).not.toContain('human checked against selected fixture text');
    expect(sourcesSource).not.toContain('human checked · L2');
    expect(classificationSource).toContain("eventType: 'classification.determination_recorded'");
    expect(classificationSource).toContain("kind: 'classification-reference-pack'");
    expect(classificationSource).toContain('requireClassificationProductContext');
    expect(classificationSource).toContain('...recordingContext.artifacts');
  });

  it('blocks package/order progression without exact CAD and BOM CSV artifact identities and records each bounded lifecycle', () => {
    expect(sourcingSource).toContain('BLOCKED_MISSING_CAD_ARTIFACTS');
    expect(sourcingSource).toContain("eventType: 'sourcing.package_bound'");
    expect(sourcingSource).toContain("kind: 'cad-artifact-manifest'");
    expect(sourcingSource).toContain("kind: 'BOM_CSV_ARTIFACT_SHA256'");
    expect(sourcingSource).toContain('disabled={orderBusy !== null || !packageBinding}');
    expect(sourcingSource).toContain('eventType: `order.${label}`');
  });

  it('makes device-local unsigned replay, workflow identity, untracked legacy state, and tamper detection visible', () => {
    expect(recordSource).toContain('DEVICE-LOCAL · UNSIGNED · NOT SHARED');
    expect(recordSource).toContain('PRODUCT_THREAD_DURABILITY_NOTICE');
    expect(recordSource).toContain('active CAD revision');
    expect(recordSource).not.toContain('no revision supplied');
    expect(coreSource).toContain('QX-0 workflow context');
    expect(coreSource).toContain('Product Thread revision');
    expect(recordSource).toContain('rederiveProductThread(untrackedCount)');
    expect(recordSource).toContain('tamperProductThread(latest.sequence)');
    expect(recordSource).toContain('legacy event(s)');
    expect(recordSource).not.toContain('Ed25519-signed');
  });
});
