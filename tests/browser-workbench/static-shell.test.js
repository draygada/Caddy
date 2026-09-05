import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const appRoot = path.join(repoRoot, "apps", "browser-workbench");

test("shell exposes the authoring center, review surfaces, and accessibility landmarks", async () => {
  const html = await readFile(path.join(appRoot, "index.html"), "utf8");
  for (const required of [
    'id="model-panel"',
    'id="viewport-region"',
    'id="properties-panel"',
    'id="bottom-panel"',
    'id="command-palette"',
    'id="exchange-modal"',
    'id="review-path"',
    'class="mobile-nav"',
    "DERIVED PREVIEW · NOT GEOMETRY AUTHORITY",
  ]) assert.match(html, new RegExp(required));
  assert.match(html, /href="#viewport-canvas">Skip to viewport/);
  assert.match(html, /tabindex="0" role="application"/);
  assert.match(html, /Review readiness with Tripwire/);
  assert.match(html, /data-mobile-panel="properties"[^>]*>[\s\S]*?<span>Review<\/span>/);
  assert.doesNotMatch(html, /https?:\/\//);
  assert.doesNotMatch(html, /AssemblyDocument|Product thread/);
});

test("candidate review path is honest, recoverable, and revision-pinned", async () => {
  const [main, runtime, bootstrap, client, fixture, readme, candidateStyles] = await Promise.all([
    readFile(path.join(appRoot, "src", "main.js"), "utf8"),
    readFile(path.join(appRoot, "src", "runtime-candidate.js"), "utf8"),
    readFile(path.join(appRoot, "src", "bootstrap.js"), "utf8"),
    readFile(path.join(appRoot, "src", "compliance-client.js"), "utf8"),
    readFile(path.join(appRoot, "src", "internal-fixture.js"), "utf8"),
    readFile(path.join(appRoot, "README.md"), "utf8"),
    readFile(path.join(appRoot, "src", "candidate.css"), "utf8"),
  ]);
  const surface = `${main}\n${runtime}\n${bootstrap}\n${client}\n${readme}`;
  assert.match(runtime, /CADdyDaddy binds a selected CAD entity to its immutable product revision and runs a review-readiness guardrail through Tripwire; Candidate 0\.1 returns insufficient evidence and requires human review, not a compliance determination\./);
  assert.match(surface, /insufficient evidence/i);
  assert.match(surface, /not a compliance determination|no compliance determination was made/i);
  assert.doesNotMatch(surface, /dated, review-only compliance|dated review support/i);
  assert.match(main, /button\.hidden = !recomputeAvailable/);
  assert.match(main, /Revision-pinned review build/);
  assert.match(bootstrap, /Retry loading Candidate 0\.1/);
  assert.match(bootstrap, /skipLink[\s\S]*?viewport-canvas[\s\S]*?focus\(\{ preventScroll: false \}\)/);
  assert.match(bootstrap, /addEventListener\("keydown"[\s\S]*?event\.key === "Enter"/);
  assert.match(client, /REVIEW_RESPONSE_UNREADABLE/);
  assert.doesNotMatch(`${main}\n${fixture}\n${readme}`, /WORKER_CRASHED|worker-crashed|scenario=/i);
  assert.match(candidateStyles, /@media \(max-width: 680px\)[\s\S]*?\.review-path/);
  assert.match(candidateStyles, /width: auto/);
  assert.match(candidateStyles, /\.primary-action\[hidden\][\s\S]*?display: none !important/);
});

test("runtime dependency is exact, minimal, and acknowledged", async () => {
  const packageJson = JSON.parse(await readFile(path.join(appRoot, "package.json"), "utf8"));
  assert.deepEqual(packageJson.dependencies, { three: "0.180.0" });
  assert.equal(packageJson.private, true);
  const notices = await readFile(path.join(appRoot, "THIRD_PARTY_NOTICES.md"), "utf8");
  assert.match(notices, /Three\.js 0\.180\.0/);
  assert.match(notices, /MIT License/);
});

test("source labels the fixture and internal render model without claiming shared compatibility", async () => {
  const fixture = await readFile(path.join(appRoot, "src", "internal-fixture.js"), "utf8");
  const scene = await readFile(path.join(appRoot, "src", "internal-scene.js"), "utf8");
  assert.match(fixture, /Synthetic public-data fixture/);
  assert.match(fixture, /evidenceCeiling: "TARGET"/);
  assert.match(scene, /not a shared wire contract/);
  assert.match(scene, /private PartDocument presentation/);
  assert.doesNotMatch(fixture, /documentKind:\s*"ASSEMBLY"|productThread|componentId|bomItemId/);
  assert.doesNotMatch(scene, /documentKind:\s*"ASSEMBLY"|kind:\s*"COMPONENT"|createCylinderMesh/);
  assert.doesNotMatch(`${fixture}\n${scene}`, /compatible with e7d9737/i);
});

test("viewer keeps source scene identity immutable and honors reduced motion", async () => {
  const viewer = await readFile(path.join(appRoot, "src", "viewer.js"), "utf8");
  const styles = await readFile(path.join(appRoot, "src", "styles.css"), "utf8");
  assert.doesNotMatch(viewer, /record\.node\.(?:transform|visible)\s*=/);
  assert.match(viewer, /displayTransform: structuredClone\(node\.transform\)/);
  assert.match(viewer, /prefers-reduced-motion: reduce/);
  assert.match(viewer, /enableDamping = !this\.reducedMotion/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /animation-duration: 0\.001ms/);
});

test("development server fails missing assets closed instead of serving HTML as JavaScript", async () => {
  const server = await readFile(path.join(appRoot, "scripts", "serve.mjs"), "utf8");
  assert.match(server, /path\.extname\(relativePath\).*?!acceptsHtml/s);
  assert.match(server, /response\.writeHead\(404/);
  assert.match(server, /X-Content-Type-Options/);
  assert.match(server, /Content-Security-Policy/);
});
