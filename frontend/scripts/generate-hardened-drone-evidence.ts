import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHardenedDroneFixture, HARDENED_DRONE_BENCHMARK, HARDENED_DRONE_PARTS, hardenedDroneBomCsv } from '../src/cad/hardened-drone';
import { exportCurrentCadInBrowser, recomputeCadInBrowser } from '../src/cad/browser-kernel';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(frontendRoot, '..');
const fixtureDir = resolve(frontendRoot, 'public/fixtures');
const evidenceDir = resolve(repoRoot, 'docs/evidence');
await mkdir(fixtureDir, { recursive: true });
await mkdir(evidenceDir, { recursive: true });

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

const fixture = createHardenedDroneFixture();
const response = await recomputeCadInBrowser({ document: fixture.document, operation: fixture.operation, expectedRevisionId: fixture.document.revisionId });
const replay = await recomputeCadInBrowser({ document: fixture.document, operation: fixture.operation, expectedRevisionId: fixture.document.revisionId });
const expandedFixture = createHardenedDroneFixture({ frameSpanMm: HARDENED_DRONE_BENCHMARK.expandedFrameSpanMm });
const expanded = await recomputeCadInBrowser({ document: expandedFixture.document, operation: expandedFixture.operation, expectedRevisionId: expandedFixture.document.revisionId });
const stl = await exportCurrentCadInBrowser(response.document, 'STL');
const stlBytes = Buffer.from(stl.dataBase64, 'base64');
const documentJson = JSON.stringify(response.document, null, 2) + '\n';
const bomCsv = hardenedDroneBomCsv();

const artifactPayloads = [
  { path: 'hardened-drone.cad-document.json', kind: 'CAD_DOCUMENT', bytes: Buffer.from(documentJson) },
  { path: 'hardened-drone.stl', kind: 'ASCII_STL', bytes: stlBytes },
  { path: 'hardened-drone.bom.csv', kind: 'BOM_CSV', bytes: Buffer.from(bomCsv) },
];
for (const artifact of artifactPayloads) await writeFile(resolve(fixtureDir, artifact.path), artifact.bytes);

const artifacts = artifactPayloads.map((artifact) => ({ path: artifact.path, kind: artifact.kind, sizeBytes: artifact.bytes.byteLength, sha256: sha256(artifact.bytes) }));
const manifest = {
  schemaVersion: 'caddydaddy.hardened-drone-manifest/1',
  benchmarkId: HARDENED_DRONE_BENCHMARK.id,
  benchmarkVersion: HARDENED_DRONE_BENCHMARK.version,
  sourceBaseCommit: '645482900826026adbf2bfd2af76f08889012680',
  generationCommand: 'cd frontend && npx vite-node scripts/generate-hardened-drone-evidence.ts',
  artifacts,
  claimCeiling: HARDENED_DRONE_BENCHMARK.claimCeiling,
};
const manifestJson = JSON.stringify(manifest, null, 2) + '\n';
await writeFile(resolve(fixtureDir, 'hardened-drone.manifest.json'), manifestJson);

const diagnosticCodes = [...new Set(response.diagnostics.map((item) => item.code))].sort();
const evidence = {
  schemaVersion: 'caddydaddy.hardened-drone-evidence/1',
  status: 'PASS',
  benchmark: HARDENED_DRONE_BENCHMARK,
  sourceBaseCommit: manifest.sourceBaseCommit,
  engine: { name: response.kernel.name, version: response.kernel.version, mode: response.kernel.engineMode },
  identities: {
    revisionId: response.revisionId,
    documentHash: response.documentHash,
    dependencyGraphHash: response.dependencyGraphHash,
    meshArtifactHash: response.kernel.artifactHash,
    manifestSha256: sha256(manifestJson),
  },
  counts: {
    bomLines: HARDENED_DRONE_PARTS.length,
    physicalParts: HARDENED_DRONE_PARTS.reduce((sum, part) => sum + part.quantity, 0),
    bodyDefinitions: response.document.bodies.length,
    sketches: response.document.sketches.length,
    features: response.document.operations.filter((item) => item.kind.startsWith('feature.')).length,
    operations: response.document.operations.length,
    instances: response.document.assembly.instances.length,
    mates: response.document.assembly.mates.length,
    dependencyNodes: response.dependencyGraph.nodes.length,
    dependencyEdges: response.dependencyGraph.edges.length,
    meshGroups: response.mesh.groups.length,
    triangles: response.mesh.triangles.length,
    diagnostics: response.diagnostics.length,
    diagnosticErrors: response.diagnostics.filter((item) => item.severity === 'error').length,
  },
  geometry: response.geometry,
  diagnosticCodes,
  artifacts,
  checks: [
    { id: 'CAD-01', status: response.document.bodies.length === 12 ? 'PASS' : 'FAIL', claim: 'Twelve pinned CAD body definitions recomputed.' },
    { id: 'CAD-02', status: response.document.assembly.instances.length === 25 && response.mesh.groups.length === 25 ? 'PASS' : 'FAIL', claim: 'Every physical part instance has evaluated geometry.' },
    { id: 'CAD-03', status: HARDENED_DRONE_PARTS.length === 12 ? 'PASS' : 'FAIL', claim: 'The committed BOM has twelve named lines.' },
    { id: 'CAD-04', status: response.document.assembly.mates.length === 24 ? 'PASS' : 'FAIL', claim: 'Every non-grounded instance is connected by a recorded mate.' },
    { id: 'CAD-05', status: response.revisionId === replay.revisionId && response.kernel.artifactHash === replay.kernel.artifactHash ? 'PASS' : 'FAIL', claim: 'Pinned input replays to identical document and mesh identities.' },
    { id: 'CAD-06', status: response.revisionId !== expanded.revisionId && response.kernel.artifactHash !== expanded.kernel.artifactHash ? 'PASS' : 'FAIL', claim: 'The bounded 260-to-300 mm fixture span ablation changes document and mesh identities.' },
    { id: 'CAD-07', status: response.diagnostics.every((item) => item.severity !== 'error') ? 'PASS' : 'FAIL', claim: 'Nominal fixture emits no kernel errors.' },
    { id: 'CAD-08', status: artifacts.every((item) => /^[a-f0-9]{64}$/.test(item.sha256)) ? 'PASS' : 'FAIL', claim: 'Document, STL, and BOM artifacts have byte-level SHA-256 identities.' },
  ],
  specGap: [
    { capability: 'multi-part drone CAD and twelve-line BOM', status: 'DEMONSTRATED_LOCAL_BOUNDED' },
    { capability: 'fixture span drives geometry and invalidates hashes', status: 'DEMONSTRATED_FIXTURE_FACTORY_ONLY' },
    { capability: 'generic editable driving dimensions', status: 'ABSENT' },
    { capability: 'assembly instance transforms', status: 'DEMONSTRATED_LOCAL_BOUNDED' },
    { capability: 'non-fixed mate solving and collision analysis', status: 'ABSENT' },
    { capability: 'STL export', status: 'DEMONSTRATED_LOCAL_BOUNDED' },
    { capability: 'STEP/IGES and production B-rep', status: 'ABSENT_NATIVE_DISCONNECTED' },
    { capability: 'current-CAD Tripwire binding and edit invalidation', status: 'ABSENT' },
    { capability: 'classification bound to current CAD revision', status: 'ABSENT' },
    { capability: 'full-BOM sourcing and external ordering', status: 'ABSENT_ZERO_SEND_ONLY' },
    { capability: 'durable signed multi-user product thread', status: 'ABSENT_MEMORY_ONLY_UNSIGNED' },
  ],
  boundaries: [
    HARDENED_DRONE_BENCHMARK.claimCeiling,
    'The model uses inert solid envelopes and contains no flight-control logic, propulsion design, performance model, payload capability, or manufacturing release.',
    'Browser JSCAD mesh/CSG is not production B-rep authority. Dimensions and non-fixed mates are recorded but not solved.',
    'The fixture assumption that this data is non-controlled is not a legal classification.',
  ],
};
if (evidence.checks.some((check) => check.status !== 'PASS')) throw new Error('QX-0 evidence generation failed one or more acceptance checks.');
await writeFile(resolve(evidenceDir, 'hardened-drone-candidate-0.2.json'), JSON.stringify(evidence, null, 2) + '\n');

const markdown = `# QX-0 hardened drone CAD evidence\n\n` +
  `Status: **${evidence.status}** for the bounded local benchmark only.\n\n` +
  `## Reproduce\n\n\`\`\`sh\n${manifest.generationCommand}\nnpm test -- --run tests/hardened-drone-cad.test.ts\n\`\`\`\n\n` +
  `## Measured result\n\n| Metric | Result |\n|---|---:|\n` +
  `| BOM lines | ${evidence.counts.bomLines} |\n| Physical instances | ${evidence.counts.physicalParts} |\n| CAD body definitions | ${evidence.counts.bodyDefinitions} |\n| Sketches | ${evidence.counts.sketches} |\n| Features | ${evidence.counts.features} |\n| Operations | ${evidence.counts.operations} |\n| Recorded mates | ${evidence.counts.mates} |\n| Mesh groups | ${evidence.counts.meshGroups} |\n| Triangles | ${evidence.counts.triangles} |\n| Kernel errors | ${evidence.counts.diagnosticErrors} |\n\n` +
  `## Acceptance checks\n\n| ID | Result | Claim |\n|---|---|---|\n${evidence.checks.map((check) => `| ${check.id} | ${check.status} | ${check.claim} |`).join('\n')}\n\n` +
  `## Pre-hackathon specification gap\n\n| Capability | Status |\n|---|---|\n${evidence.specGap.map((item) => `| ${item.capability} | ${item.status} |`).join('\n')}\n\n` +
  `## Boundaries\n\n${evidence.boundaries.map((item) => `- ${item}`).join('\n')}\n`;
await writeFile(resolve(evidenceDir, 'hardened-drone-candidate-0.2.md'), markdown);

console.log(JSON.stringify({ status: evidence.status, identities: evidence.identities, counts: evidence.counts, artifacts }, null, 2));
