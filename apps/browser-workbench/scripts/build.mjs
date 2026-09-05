import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(appRoot, "dist");
const dependencyRoot = path.join(appRoot, "node_modules", "three");

if (!distRoot.startsWith(`${appRoot}${path.sep}`)) {
  throw new Error("Refusing to build outside the browser-workbench application root.");
}

await rm(distRoot, { recursive: true, force: true });
await mkdir(path.join(distRoot, "vendor", "three", "addons", "controls"), {
  recursive: true,
});

await Promise.all([
  cp(path.join(appRoot, "src"), path.join(distRoot, "src"), { recursive: true }),
  cp(path.join(appRoot, "index.html"), path.join(distRoot, "index.html")),
  cp(
    path.join(dependencyRoot, "build", "three.module.js"),
    path.join(distRoot, "vendor", "three", "three.module.js"),
  ),
  cp(
    path.join(dependencyRoot, "build", "three.core.js"),
    path.join(distRoot, "vendor", "three", "three.core.js"),
  ),
  cp(
    path.join(dependencyRoot, "examples", "jsm", "controls", "OrbitControls.js"),
    path.join(distRoot, "vendor", "three", "addons", "controls", "OrbitControls.js"),
  ),
  cp(
    path.join(dependencyRoot, "LICENSE"),
    path.join(distRoot, "vendor", "three", "LICENSE"),
  ),
]);

const packageJson = JSON.parse(
  await readFile(path.join(appRoot, "package.json"), "utf8"),
);
const manifest = {
  application: packageJson.name,
  application_version: packageJson.version,
  generated: false,
  geometry_authority: false,
  runtime_dependencies: packageJson.dependencies,
};
await writeFile(
  path.join(distRoot, "build-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log(`Built ${packageJson.name} into ${path.relative(appRoot, distRoot)}/`);
