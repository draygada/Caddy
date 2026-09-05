import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(appRoot, "dist");
const host = process.env.FORGE_WORKBENCH_HOST || "127.0.0.1";
const port = Number.parseInt(process.env.FORGE_WORKBENCH_PORT || "4173", 10);

if (!existsSync(path.join(distRoot, "index.html"))) {
  throw new Error("Missing dist/index.html. Run `npm run build` first.");
}

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
]);

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://${host}:${port}`);
    const requestPath = decodeURIComponent(requestUrl.pathname);
    const relativePath = requestPath === "/" ? "index.html" : requestPath.slice(1);
    const candidate = path.resolve(distRoot, relativePath);

    if (candidate !== distRoot && !candidate.startsWith(`${distRoot}${path.sep}`)) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    const candidateStat = await stat(candidate).catch(() => null);
    const acceptsHtml = (request.headers.accept || "").includes("text/html");
    if (!candidateStat?.isFile() && path.extname(relativePath) && !acceptsHtml) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" });
      response.end("Not found");
      return;
    }
    const filePath = candidateStat?.isFile() ? candidate : path.join(distRoot, "index.html");
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Security-Policy": [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "connect-src 'self'",
        "worker-src 'self'",
      ].join("; "),
      "Content-Type": mimeTypes.get(path.extname(filePath)) || "application/octet-stream",
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Content-Type-Options": "nosniff",
    });
    createReadStream(filePath).pipe(response);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(error instanceof Error ? error.message : "Internal server error");
  }
});

server.listen(port, host, () => {
  console.log(`Forge browser workbench listening at http://${host}:${port}`);
});
