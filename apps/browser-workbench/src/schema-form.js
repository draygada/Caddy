/** Generic JSON-schema presentation helpers. No operation type is special-cased here. */

export function schemaDefault(schema) {
  if (!schema || typeof schema !== "object") return null;
  if (Object.hasOwn(schema, "const")) return structuredClone(schema.const);
  if (Object.hasOwn(schema, "default")) return structuredClone(schema.default);
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return structuredClone(schema.enum[0]);
  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    const option = schema.oneOf.find((candidate) => Object.hasOwn(candidate, "const")) ?? schema.oneOf[0];
    return Object.hasOwn(option, "const") ? structuredClone(option.const) : schemaDefault(option);
  }
  if (schema.type === "object" || schema.properties) {
    return Object.fromEntries(
      Object.entries(schema.properties ?? {}).map(([key, child]) => [key, schemaDefault(child)]),
    );
  }
  if (schema.type === "array") return [];
  if (schema.type === "boolean") return false;
  if (schema.type === "integer" || schema.type === "number") return "0";
  if (schema.type === "string") return "";
  return null;
}

export function flattenSchema(schema, value = schemaDefault(schema), path = []) {
  if (!schema || typeof schema !== "object") return [];
  if (schema.type === "object" || schema.properties) {
    const required = new Set(schema.required ?? []);
    return Object.entries(schema.properties ?? {}).flatMap(([key, child]) => {
      const nextPath = [...path, key];
      if (child.type === "object" || child.properties) {
        return [
          {
            kind: "group",
            path: nextPath,
            title: child.title ?? humanize(key),
            description: child.description ?? "",
          },
          ...flattenSchema(child, value?.[key] ?? schemaDefault(child), nextPath),
        ];
      }
      return [fieldModel(child, value?.[key], nextPath, required.has(key), key)];
    });
  }
  return [fieldModel(schema, value, path, false, path.at(-1) ?? "value")];
}

function fieldModel(schema, value, path, required, key) {
  const choices = enumChoices(schema);
  let control = "text";
  if (choices.length > 0) control = "select";
  else if (schema.type === "boolean") control = "boolean";
  else if (schema.type === "array" || schema.type === "object") control = "json";
  else if (schema.format === "multiline" || schema["x-ui"] === "textarea") control = "textarea";
  return {
    kind: "field",
    key,
    path,
    pathToken: encodePath(path),
    title: schema.title ?? humanize(key),
    description: schema.description ?? "",
    required,
    control,
    type: schema.type ?? inferType(value),
    format: schema.format ?? null,
    unit: schema["x-unit"] ?? schema.unit ?? null,
    choices,
    minimum: schema.minimum ?? null,
    maximum: schema.maximum ?? null,
    step: schema.multipleOf ?? null,
    value: value ?? schemaDefault(schema),
    schema,
  };
}

export function renderSchemaForm(schema, value, { disabled = false, draftPaths = new Set(), idPrefix = "schema" } = {}) {
  const fields = flattenSchema(schema, value);
  if (fields.length === 0) {
    return '<div class="notice-card"><strong>No configurable fields</strong><span>This registered operation exposes an empty payload schema.</span></div>';
  }
  return `<div class="property-grid">${fields.map((field, index) => {
    if (field.kind === "group") {
      return `<div class="property-section-heading schema-group-heading"><h4>${escapeHtml(field.title)}</h4></div>`;
    }
    const inputId = `${idPrefix}-${index}-${slug(field.path.join("-"))}`;
    const drafted = draftPaths.has(field.pathToken) ? " has-draft" : "";
    const description = field.description ? `<p class="field-description" id="${inputId}-description">${escapeHtml(field.description)}</p>` : "";
    const describedBy = field.description ? ` aria-describedby="${inputId}-description"` : "";
    return `<div class="property-field${drafted}" data-schema-field="${field.pathToken}">
      <label for="${inputId}"><span>${escapeHtml(field.title)}${field.required ? ' <span class="field-required" aria-label="required">*</span>' : ""}</span>${field.unit ? `<span>${escapeHtml(field.unit)}</span>` : ""}</label>
      ${description}
      ${renderControl(field, inputId, disabled, describedBy)}
    </div>`;
  }).join("")}</div>`;
}

function renderControl(field, inputId, disabled, describedBy) {
  const common = `id="${inputId}" data-schema-path="${field.pathToken}" data-schema-type="${escapeAttribute(field.type)}"${describedBy}${disabled ? " disabled" : ""}`;
  if (field.control === "select") {
    const options = field.choices.map(({ value, label }) => `<option value="${escapeAttribute(serializeScalar(value))}"${sameValue(value, field.value) ? " selected" : ""}>${escapeHtml(label)}</option>`).join("");
    return `<select ${common}>${options}</select>`;
  }
  if (field.control === "boolean") {
    return `<div class="switch-field"><span>${field.value ? "Enabled" : "Disabled"}</span><label class="switch"><input type="checkbox" ${common}${field.value ? " checked" : ""}/><span class="switch-track" aria-hidden="true"></span></label></div>`;
  }
  if (field.control === "json" || field.control === "textarea") {
    const content = field.control === "json" ? JSON.stringify(field.value, null, 2) : String(field.value ?? "");
    return `<textarea ${common} spellcheck="false">${escapeHtml(content)}</textarea>`;
  }
  const inputMode = field.type === "number" || field.type === "integer" ? "decimal" : "text";
  const pattern = field.type === "integer" ? "-?[0-9]+" : field.type === "number" ? "-?(?:[0-9]+(?:\\.[0-9]+)?|\\.[0-9]+)(?:[eE][+-]?[0-9]+)?" : null;
  const input = `<input type="text" ${common} inputmode="${inputMode}" value="${escapeAttribute(serializeScalar(field.value))}"${pattern ? ` pattern="${escapeAttribute(pattern)}"` : ""}${field.minimum !== null ? ` data-minimum="${escapeAttribute(field.minimum)}"` : ""}${field.maximum !== null ? ` data-maximum="${escapeAttribute(field.maximum)}"` : ""}/>`;
  return field.unit ? `<div class="input-with-unit">${input}<span class="input-unit">${escapeHtml(field.unit)}</span></div>` : input;
}

export function updateSchemaValue(currentValue, schema, pathToken, rawValue, { checked = false } = {}) {
  const path = decodePath(pathToken);
  const fieldSchema = schemaAtPath(schema, path);
  const next = structuredClone(currentValue ?? schemaDefault(schema));
  const parsed = parseControlValue(fieldSchema, rawValue, checked);
  if (path.length === 0) return parsed;
  let cursor = next;
  for (const segment of path.slice(0, -1)) {
    if (!cursor[segment] || typeof cursor[segment] !== "object") cursor[segment] = {};
    cursor = cursor[segment];
  }
  cursor[path.at(-1)] = parsed;
  return next;
}

export function schemaAtPath(schema, path) {
  let cursor = schema;
  for (const segment of path) {
    if (!cursor?.properties || !Object.hasOwn(cursor.properties, segment)) {
      throw new Error(`Schema path is not declared: ${path.join(".")}`);
    }
    cursor = cursor.properties[segment];
  }
  return cursor;
}

function parseControlValue(schema, rawValue, checked) {
  if (schema.type === "boolean") return Boolean(checked);
  if (schema.type === "array" || schema.type === "object") {
    const parsed = JSON.parse(rawValue);
    if (schema.type === "array" && !Array.isArray(parsed)) throw new Error("Expected a JSON array.");
    if (schema.type === "object" && (!parsed || Array.isArray(parsed) || typeof parsed !== "object")) throw new Error("Expected a JSON object.");
    return parsed;
  }
  const choices = enumChoices(schema);
  const choice = choices.find(({ value }) => serializeScalar(value) === rawValue);
  if (choice) return structuredClone(choice.value);
  if (choices.length > 0) throw new Error("Value must be one of the declared choices.");
  if (schema.type === "integer") {
    if (!/^-?[0-9]+$/.test(rawValue)) throw new Error("Enter an integer without a unit suffix.");
    validateNumericBounds(schema, rawValue);
    return rawValue;
  }
  if (schema.type === "number") {
    if (!/^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(rawValue)) throw new Error("Enter a finite decimal value without a unit suffix.");
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) throw new Error("Enter a finite decimal value.");
    validateNumericBounds(schema, rawValue);
    return normalizeDecimalString(rawValue);
  }
  return String(rawValue);
}

function validateNumericBounds(schema, rawValue) {
  const numeric = Number(rawValue);
  if (schema.minimum !== undefined && numeric < Number(schema.minimum)) throw new Error(`Value must be at least ${schema.minimum}.`);
  if (schema.maximum !== undefined && numeric > Number(schema.maximum)) throw new Error(`Value must be at most ${schema.maximum}.`);
  if (schema.multipleOf !== undefined) {
    const multiple = decimalParts(schema.multipleOf);
    if (!multiple || multiple.coefficient <= 0n) throw new Error("Schema multipleOf must be a positive finite decimal.");
    if (!isExactDecimalMultiple(rawValue, multiple)) throw new Error(`Value must be a multiple of ${schema.multipleOf}.`);
  }
}

function isExactDecimalMultiple(value, multiple) {
  const candidate = decimalParts(value);
  if (!candidate) return false;
  if (candidate.coefficient === 0n) return true;
  const exponentDelta = candidate.exponent - multiple.exponent;
  if (exponentDelta >= 0) {
    return (candidate.coefficient * (10n ** BigInt(exponentDelta))) % multiple.coefficient === 0n;
  }
  return candidate.coefficient % (multiple.coefficient * (10n ** BigInt(-exponentDelta))) === 0n;
}

function decimalParts(value) {
  const text = String(value).trim();
  if (text.length === 0 || text.length > 1_000) return null;
  const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(text);
  if (!match) return null;
  const explicitExponent = Number(match[5] ?? 0);
  if (!Number.isSafeInteger(explicitExponent) || Math.abs(explicitExponent) > 1_000) return null;
  const whole = match[2] ?? "0";
  const fraction = match[3] ?? match[4] ?? "";
  let coefficient = BigInt(`${whole}${fraction}`);
  if (match[1] === "-") coefficient = -coefficient;
  let exponent = explicitExponent - fraction.length;
  while (coefficient !== 0n && coefficient % 10n === 0n) {
    coefficient /= 10n;
    exponent += 1;
  }
  return { coefficient, exponent };
}

export function normalizeDecimalString(value) {
  const text = String(value).trim();
  if (Object.is(Number(text), -0)) return "0";
  if (/^-?0+(?:\.0+)?$/.test(text)) return "0";
  return text.replace(/^(-?)0+(?=\d)/, "$1");
}

export function encodePath(path) {
  return path.map((segment) => encodeURIComponent(segment)).join("/");
}

export function decodePath(token) {
  if (!token) return [];
  return token.split("/").map((segment) => decodeURIComponent(segment));
}

function enumChoices(schema) {
  if (Object.hasOwn(schema, "const")) return [{ value: schema.const, label: String(schema.const) }];
  if (Array.isArray(schema.enum)) return schema.enum.map((value) => ({ value, label: String(value) }));
  if (Array.isArray(schema.oneOf)) {
    return schema.oneOf.filter((option) => Object.hasOwn(option, "const")).map((option) => ({ value: option.const, label: option.title ?? String(option.const) }));
  }
  return [];
}

function inferType(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function sameValue(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function serializeScalar(value) {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function humanize(value) {
  return String(value).replaceAll(/[_:-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "field";
}

export function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
