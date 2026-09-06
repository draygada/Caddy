const icons = {
  "panel-left": '<path d="M4 4h16v16H4zM9 4v16"/>',
  "panel-right": '<path d="M4 4h16v16H4zM15 4v16"/>',
  "chevron-down": '<path d="m7 9 5 5 5-5"/>',
  "chevron-right": '<path d="m9 7 5 5-5 5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  upload: '<path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v5h14v-5"/>',
  download: '<path d="M12 4v12m0 0 4.5-4.5M12 16l-4.5-4.5M5 19h14"/>',
  play: '<path d="m8 5 11 7-11 7Z"/>',
  refresh: '<path d="M19 7V3m0 0h-4m4 0-3.2 3.2A8 8 0 1 0 20 13"/>',
  collapse: '<path d="M7 9h10M7 15h10"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  "view-front": '<rect x="5" y="5" width="14" height="14" rx="1"/><path d="M8 8h8v8H8z"/>',
  "view-top": '<path d="m12 4 8 4-8 4-8-4Zm-8 4v8l8 4 8-4V8"/>',
  "view-right": '<path d="m7 5 10 3v11L7 16Z"/><path d="m7 5 4 4v8"/>',
  fit: '<path d="M9 4H4v5m11-5h5v5M9 20H4v-5m11 5h5v-5"/>',
  wireframe: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Zm0 0v9m8-4.5-8 4.5m-8-4.5 8 4.5m0 9v-9"/>',
  sliders: '<path d="M4 7h5m4 0h7M4 17h9m4 0h3"/><circle cx="11" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
  history: '<path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6M4 4v4.6h4.6M12 8v4l3 2"/>',
  diagnostic: '<path d="M12 3 2.8 20h18.4Zm0 6v5m0 3v.1"/>',
  cursor: '<path d="m6 3 12 8-6 1.5L9.5 18Z"/>',
  pin: '<path d="m8 4 8 8m-6-6 5-2 5 5-2 5m-8-8-2 5-4 1 8 8 1-4 5-2M4 20l5-5"/>',
  keyboard: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M6 10h1m3 0h1m3 0h1m3 0h.1M6 14h9m3 0h.1"/>',
  tree: '<path d="M7 4v16M7 8h5m-5 8h5"/><rect x="12" y="5" width="7" height="6" rx="1"/><rect x="12" y="13" width="7" height="6" rx="1"/>',
  cube: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Zm0 9 8-4.5M12 12 4 7.5m8 4.5v9"/>',
  package: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Zm0 9 8-4.5M12 12 4 7.5m8 4.5v9M8 5.2l8 4.5v4"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  warning: '<path d="M12 3 2.8 20h18.4Zm0 6v5m0 3v.1"/>',
  error: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>',
  "eye-off": '<path d="m3 3 18 18M10.6 6.1A10.5 10.5 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.1 2.8M7.5 7.5C4.3 9.2 2.5 12 2.5 12s3.5 6 9.5 6a10 10 0 0 0 3.1-.5M10 10a2.8 2.8 0 0 0 4 4"/>',
  isolate: '<path d="M8 3H3v5m13-5h5v5M8 21H3v-5m13 5h5v-5"/><circle cx="12" cy="12" r="3"/>',
  body: '<path d="m12 4 7 4v8l-7 4-7-4V8Zm0 8 7-4m-7 4L5 8m7 4v8"/>',
  parameter: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2.5"/><circle cx="15" cy="17" r="2.5"/>',
  origin: '<circle cx="12" cy="12" r="3"/><path d="M12 2v7m0 6v7M2 12h7m6 0h7"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  chevrons: '<path d="m8 7 5 5-5 5m5-10 5 5-5 5"/>',
};

export function icon(name, label = "") {
  const body = icons[name] ?? icons.info;
  const accessibility = label
    ? ` role="img" aria-label="${escapeAttribute(label)}"`
    : " aria-hidden=\"true\"";
  return `<svg class="ui-icon" viewBox="0 0 24 24"${accessibility}>${body}</svg>`;
}

export function hydrateIcons(root = document) {
  for (const element of root.querySelectorAll("[data-icon]")) {
    const name = element.getAttribute("data-icon");
    element.innerHTML = icon(name);
  }
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
