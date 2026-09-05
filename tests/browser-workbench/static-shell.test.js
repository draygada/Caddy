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
    'class="mobile-nav"',
    "DERIVED PREVIEW · NOT GEOMETRY AUTHORITY",
  ]) assert.match(html, new RegExp(required));
  assert.match(html, /href="#viewport-region">Skip to viewport/);
  assert.match(html, /tabindex="0" role="application"/);
  assert.doesNotMatch(html, /https?:\/\//);
  assert.doesNotMatch(html, /AssemblyDocument|Product thread/);
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
