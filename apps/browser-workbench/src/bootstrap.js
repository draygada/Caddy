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

loadWorkbench().catch((error) => {
  const root = document.querySelector("#workbench");
  const loading = document.querySelector("#viewport-loading");
  if (root) root.dataset.ready = "error";
  if (loading) {
    const message = error instanceof Error ? error.message : "The browser modules could not be loaded.";
    loading.innerHTML = `<span class="loading-cube" aria-hidden="true"></span><strong>Workbench unavailable</strong><span>${escapeHtml(message)}</span>`;
  }
  console.error("Forge workbench failed to initialize", error);
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
