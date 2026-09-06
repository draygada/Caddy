export type ProgressStatus = 'usable_now' | 'fixture_backed' | 'local_memory' | 'unavailable';

export interface EvidencePointer {
  label: string;
  path: string;
  test?: string;
}

export interface ProgressCapability {
  id: string;
  name: string;
  lane: 'design' | 'assurance' | 'operations' | 'platform';
  status: ProgressStatus;
  summary: string;
  boundary: string;
  evidence: readonly EvidencePointer[];
}

export interface ProgressStep {
  id: string;
  order: number;
  name: string;
  finish: string;
  unlocks: string;
  prerequisites: readonly string[];
}

export interface ProgressAtlasManifest {
  version: 'candidate-0.1';
  metricLabel: string;
  capabilities: readonly ProgressCapability[];
  nextSteps: readonly ProgressStep[];
}

export const PROGRESS_ATLAS: ProgressAtlasManifest = {
  version: 'candidate-0.1',
  metricLabel: 'candidate surfaces available',
  capabilities: [
    {
      id: 'design-workbench',
      name: 'Design workbench',
      lane: 'design',
      status: 'usable_now',
      summary: 'Edit the bounded Kestrel design through slot, sketch, feature, and parameter controls; inspect outcomes and replay local history.',
      boundary: 'Browser-local candidate model, not a general CAD authoring kernel.',
      evidence: [
        { label: 'State engine', path: 'frontend/src/store.ts' },
        { label: 'Geometry controls', path: 'frontend/tests/store.test.ts', test: 'feature dialogs append geometry features; versions pin a seq' },
      ],
    },
    {
      id: 'core-assembly',
      name: 'Core / Assembly inspection',
      lane: 'design',
      status: 'fixture_backed',
      summary: 'Inspect an immutable two-body assembly, its entities, operations, parameters, diagnostics, provenance, and Tripwire binding.',
      boundary: 'Validated endpoint or packaged recovery fixture; live recompute and editing remain unavailable.',
      evidence: [
        { label: 'Candidate client', path: 'frontend/src/lib/core-client.ts' },
        { label: 'Contract', path: 'frontend/tests/core-client.test.ts', test: 'loads the real endpoint shape and preserves the immutable two-body graph' },
      ],
    },
    {
      id: 'classification-lab',
      name: 'Classification ordered-route lab',
      lane: 'assurance',
      status: 'fixture_backed',
      summary: 'Exercise synthetic advocate, judge, and reconciliation waves in order, including the intentional EAR99 residual fall-through.',
      boundary: 'Synthetic jurisdiction-only lab; draft output is not a legal determination or transaction clearance.',
      evidence: [
        { label: 'Workspace model', path: 'frontend/src/lib/classification-workspace.ts' },
        { label: 'Residual path', path: 'frontend/tests/classification-workspace.test.ts', test: 'intentionally falls through to EAR99 when no valid specific CCL candidate surfaces' },
      ],
    },
    {
      id: 'tripwire-atlas',
      name: 'Tripwire FB-03 Atlas',
      lane: 'assurance',
      status: 'fixture_backed',
      summary: 'Trace direct, propagated, and unresolved tripwires through five immutable revisions with evidence jumps and continuity rules.',
      boundary: 'Pinned FB-03 fixture projection; destination is not evaluated and legal effect is NONE.',
      evidence: [
        { label: 'Pinned fixture', path: 'frontend/src/data/tripwire-atlas.v1.json' },
        { label: 'Continuity contract', path: 'frontend/tests/tripwire-atlas.test.ts', test: 'retains last-confirmed state through pending and unavailable responses' },
      ],
    },
    {
      id: 'sourcing',
      name: 'Sourcing lane',
      lane: 'operations',
      status: 'fixture_backed',
      summary: 'Create a local sourcing round, compare fixture offers, preserve blocked options, estimate landed cost, and stage a simulated send-off.',
      boundary: 'Synthetic 2-key CSL slice with one active match; no full-list screening or production order execution.',
      evidence: [
        { label: 'Sourcing rules', path: 'frontend/src/lib/sourcing.ts' },
        { label: 'Screening boundary', path: 'frontend/tests/sourcing.test.ts', test: 'screening is exact or suffix-normalised only' },
      ],
    },
    {
      id: 'sources-provenance',
      name: 'Sources / provenance',
      lane: 'assurance',
      status: 'fixture_backed',
      summary: 'Inspect source documents, extracted candidates, network lines, and cached proposal provenance before accepting a bounded change.',
      boundary: 'Committed documents and cached agent fixtures only; fetches are allowlisted and no broad corpus is implied.',
      evidence: [
        { label: 'Source projection', path: 'frontend/src/lib/sources.ts' },
        { label: 'Verifier behavior', path: 'frontend/tests/agents.test.ts', test: 'the poisoned page: every outcome ends at 7A002.a.1.a or a REJECT' },
      ],
    },
    {
      id: 'record',
      name: 'Record',
      lane: 'operations',
      status: 'local_memory',
      summary: 'Inspect the append-only browser event record, hashes, attestations, and replayed design state for the current session.',
      boundary: 'Local in-memory event history; refresh, another browser, or another user is not a durable shared record.',
      evidence: [
        { label: 'Event record', path: 'frontend/src/store.ts' },
        { label: 'Replay behavior', path: 'frontend/tests/store.test.ts', test: 'viewAt shows the snapshot at seq N, live returns, restore appends instead of deleting' },
      ],
    },
    {
      id: 'collaboration',
      name: 'Collaboration ledger',
      lane: 'operations',
      status: 'local_memory',
      summary: 'Exercise branches, advisory reviews, human authorization, conflict rejection, atomic merge eligibility, and deterministic replay.',
      boundary: 'Demonstration ledger in local memory; it has no durable multi-user transport, identity service, or access control.',
      evidence: [
        { label: 'Event graph', path: 'frontend/src/lib/collaboration-workspace.ts' },
        { label: 'Atomic authorization', path: 'frontend/tests/collaboration-workspace.test.ts', test: 'requires explicit human authorization and atomically advances merge plus authorization receipts' },
      ],
    },
    {
      id: 'engineering-atlas',
      name: 'Now / Engineering Atlas',
      lane: 'platform',
      status: 'usable_now',
      summary: 'Compute and display candidate coverage, evidence, runtime pulse, explicit exclusions, and the next dependency chain from this manifest.',
      boundary: 'Read-only browser projection; Git SHA remains UNKNOWN unless release metadata is injected.',
      evidence: [
        { label: 'Typed manifest', path: 'frontend/src/data/progress-atlas.ts' },
        { label: 'Metric contract', path: 'frontend/tests/progress-atlas.test.ts', test: 'derives its numerator and denominator only from manifest rows' },
      ],
    },
    {
      id: 'live-cad-authoring',
      name: 'General live CAD authoring',
      lane: 'design',
      status: 'unavailable',
      summary: 'Create arbitrary sketches, constraints, features, bodies, and assemblies against a production geometry kernel.',
      boundary: 'Not implemented.',
      evidence: [{ label: 'Explicit exclusion', path: 'frontend/src/lib/core-client.ts', test: 'live recompute is unavailable' }],
    },
    {
      id: 'live-kernel-recompute',
      name: 'Live kernel recompute',
      lane: 'design',
      status: 'unavailable',
      summary: 'Regenerate B-rep geometry and dependency graphs after arbitrary feature or parameter edits.',
      boundary: 'Not implemented; current core geometry is immutable.',
      evidence: [{ label: 'Negative contract', path: 'frontend/tests/core-client.test.ts', test: 'rejects stale revision chains and false live-recompute claims' }],
    },
    {
      id: 'cad-import-export',
      name: 'CAD import / export',
      lane: 'design',
      status: 'unavailable',
      summary: 'Round-trip STEP, IGES, STL, native assemblies, drawings, and manufacturing outputs.',
      boundary: 'Not implemented.',
      evidence: [{ label: 'No adapter', path: 'frontend/src/panels/CoreAssemblyWorkspace.tsx' }],
    },
    {
      id: 'durable-sync-auth',
      name: 'Durable multi-user sync / auth',
      lane: 'platform',
      status: 'unavailable',
      summary: 'Persist shared records with authenticated identities, roles, concurrency control, and recoverable storage.',
      boundary: 'Not implemented; candidate collaboration and records are local memory.',
      evidence: [{ label: 'Local implementation', path: 'frontend/src/lib/collaboration-workspace.ts' }],
    },
    {
      id: 'production-order-execution',
      name: 'Production order execution',
      lane: 'operations',
      status: 'unavailable',
      summary: 'Transmit a governed order to a real supplier or ERP and reconcile external acknowledgements.',
      boundary: 'Not implemented; existing send-off is a local deterministic state-machine demonstration.',
      evidence: [{ label: 'Simulation test', path: 'frontend/tests/sourcing.test.ts', test: 'opens a round, refuses a blocked selection, records declined offers, refuses a partial package, dispatches exactly once' }],
    },
    {
      id: 'full-list-screening',
      name: 'Full-list screening',
      lane: 'assurance',
      status: 'unavailable',
      summary: 'Refresh, version, search, and audit complete authoritative screening lists with production-grade matching.',
      boundary: 'Not implemented; the candidate contains only two fixture keys and one active match.',
      evidence: [{ label: 'Fixture slice', path: 'frontend/src/lib/sourcing.ts' }],
    },
    {
      id: 'govcloud-cui',
      name: 'GovCloud / CUI handling',
      lane: 'platform',
      status: 'unavailable',
      summary: 'Enforce approved tenancy, data residency, encryption, audit, retention, incident response, and CUI operating controls.',
      boundary: 'Not implemented and not authorized for controlled data.',
      evidence: [{ label: 'Status source', path: 'frontend/src/data/progress-atlas.ts' }],
    },
    {
      id: 'legal-determination',
      name: 'Legal determination',
      lane: 'assurance',
      status: 'unavailable',
      summary: 'Issue authoritative jurisdiction, classification, licensing, eligibility, or transaction-clearance decisions.',
      boundary: 'Not implemented; every candidate assurance surface remains review-only.',
      evidence: [{ label: 'Claim ceiling', path: 'frontend/tests/classification-workspace.test.ts', test: 'keeps the legal and coverage ceiling explicit for every scenario' }],
    },
  ],
  nextSteps: [
    {
      id: 'kernel-adapter',
      order: 1,
      name: 'Wire a real geometry kernel adapter',
      finish: 'Define the feature graph contract, execute edits server-side, persist immutable revisions, and prove deterministic recompute plus rollback.',
      unlocks: 'General authoring, live recompute, real multi-body changes, and a stable seam for CAD import/export.',
      prerequisites: [],
    },
    {
      id: 'persistence-identity',
      order: 2,
      name: 'Add durable records, identity, and concurrency',
      finish: 'Move event graphs into transactional storage with tenant boundaries, roles, optimistic concurrency, backups, and recovery tests.',
      unlocks: 'Charlie and Diego can safely share designs, reviews, decisions, and progress across sessions.',
      prerequisites: ['kernel-adapter'],
    },
    {
      id: 'controlled-data-boundary',
      order: 3,
      name: 'Establish the controlled-data boundary',
      finish: 'Choose the authorized environment and implement data classification, encryption, logging, retention, access reviews, and incident procedures.',
      unlocks: 'A defensible path to GovCloud/CUI workloads after independent control validation; it does not itself authorize CUI.',
      prerequisites: ['persistence-identity'],
    },
    {
      id: 'authoritative-source-pipeline',
      order: 4,
      name: 'Build authoritative source and screening ingestion',
      finish: 'Version complete source snapshots, refresh them reproducibly, record provenance, add review queues, and validate matching behavior.',
      unlocks: 'Full-list screening evidence and reviewable source freshness instead of the two-key fixture slice.',
      prerequisites: ['controlled-data-boundary'],
    },
    {
      id: 'governed-execution',
      order: 5,
      name: 'Connect governed order execution',
      finish: 'Add approval policy, idempotent supplier or ERP adapters, signed receipts, exception recovery, and a synthetic-first production gate.',
      unlocks: 'Real order transmission after identity, source, and policy gates pass.',
      prerequisites: ['persistence-identity', 'authoritative-source-pipeline'],
    },
    {
      id: 'review-program',
      order: 6,
      name: 'Validate the assurance review program',
      finish: 'Have qualified counsel define scope, evidence requirements, escalation, policy ownership, and change-control tests for each supported workflow.',
      unlocks: 'Defensible human-reviewed outputs within an approved scope, never an automatic legal determination.',
      prerequisites: ['authoritative-source-pipeline'],
    },
  ],
};

export function countsAsCandidateComplete(capability: ProgressCapability): boolean {
  return capability.status !== 'unavailable';
}

export function calculateProgress(capabilities: readonly ProgressCapability[] = PROGRESS_ATLAS.capabilities) {
  const denominator = capabilities.length;
  const numerator = capabilities.filter(countsAsCandidateComplete).length;
  const byStatus = capabilities.reduce<Record<ProgressStatus, number>>((counts, capability) => {
    counts[capability.status] += 1;
    return counts;
  }, { usable_now: 0, fixture_backed: 0, local_memory: 0, unavailable: 0 });

  return {
    numerator,
    denominator,
    percent: denominator === 0 ? 0 : Math.round((numerator / denominator) * 100),
    byStatus,
  };
}

export function orderedNextSteps(steps: readonly ProgressStep[] = PROGRESS_ATLAS.nextSteps): ProgressStep[] {
  return [...steps].sort((left, right) => left.order - right.order);
}
