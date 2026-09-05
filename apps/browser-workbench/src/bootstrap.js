const moduleGraph = [
  "./icons.js",
  "./scene-contract.js",
  "./compliance-client.js",
  "./runtime-candidate.js",
  "./schema-form.js",
  "./workbench-store.js",
  "three",
  "three/addons/controls/OrbitControls.js",
  "./viewer.js",
  "./main.js",
];

const skipLink = document.querySelector(".skip-link");
function focusViewport(event) {
  event.preventDefault();
  const viewport = document.querySelector("#viewport-canvas");
  viewport?.focus({ preventScroll: false });
  window.setTimeout(() => viewport?.focus({ preventScroll: false }), 0);
}
skipLink?.addEventListener("click", focusViewport);
skipLink?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") focusViewport(event);
});

loadWorkbench().catch((error) => {
  const root = document.querySelector("#workbench");
  const loading = document.querySelector("#viewport-loading");
  if (root) root.dataset.ready = "error";
  if (loading) {
    loading.innerHTML = '<div class="workbench-load-error" role="alert"><strong>Candidate 0.1 is temporarily unavailable</strong><span>No review data was accepted. Check the local service, then try again.</span><button class="review-path-action" type="button" id="workbench-retry">Retry loading Candidate 0.1</button></div>';
    loading.querySelector("#workbench-retry")?.addEventListener("click", () => window.location.reload());
  }
  console.error("Forge workbench failed to initialize safely.");
});

async function loadWorkbench() {
  for (const modulePath of moduleGraph) {
    try {
      await import(modulePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${modulePath}: ${message}`, { cause: error });
    }
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
