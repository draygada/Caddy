import assert from "node:assert/strict";
import test from "node:test";

import {
  decodePath,
  encodePath,
  flattenSchema,
  normalizeDecimalString,
  renderSchemaForm,
  schemaDefault,
  updateSchemaValue,
} from "../../apps/browser-workbench/src/schema-form.js";

const arbitraryDescriptorSchema = {
  type: "object",
  required: ["strategy", "cellSize"],
  properties: {
    strategy: {
      type: "string",
      title: "Strategy <unsafe>",
      oneOf: [
        { const: "OCTET", title: "Octet" },
        { const: "GYROID", title: "Gyroid" },
      ],
      default: "GYROID",
    },
    cellSize: { type: "number", title: "Cell size", minimum: 0.1, maximum: 100, default: "4.5", "x-unit": "mm" },
    options: {
      type: "object",
      title: "Advanced options",
      properties: {
        adaptive: { type: "boolean", default: true },
        seedCount: { type: "integer", minimum: 1, default: "3" },
        notes: { type: "string", default: "<script>alert(1)</script>" },
      },
    },
  },
};

test("an arbitrary registered schema produces defaults and generic controls", () => {
  const value = schemaDefault(arbitraryDescriptorSchema);
  assert.deepEqual(value, {
    strategy: "GYROID",
    cellSize: "4.5",
    options: { adaptive: true, seedCount: "3", notes: "<script>alert(1)</script>" },
  });

  const fields = flattenSchema(arbitraryDescriptorSchema, value);
  assert.equal(fields.filter((field) => field.kind === "field").length, 5);
  assert.ok(fields.some((field) => field.kind === "group" && field.title === "Advanced options"));

  const html = renderSchemaForm(arbitraryDescriptorSchema, value, { idPrefix: "arbitrary" });
  assert.match(html, /data-schema-path="strategy"/);
  assert.match(html, /data-schema-path="options\/adaptive"/);
  assert.match(html, /Strategy &lt;unsafe&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test("schema updates are immutable, typed, bounded, and path-safe", () => {
  const before = schemaDefault(arbitraryDescriptorSchema);
  const afterNumber = updateSchemaValue(before, arbitraryDescriptorSchema, "cellSize", "05.250");
  assert.equal(afterNumber.cellSize, "5.250");
  assert.equal(before.cellSize, "4.5");

  const afterBoolean = updateSchemaValue(afterNumber, arbitraryDescriptorSchema, "options/adaptive", "", { checked: false });
  assert.equal(afterBoolean.options.adaptive, false);
  assert.equal(afterNumber.options.adaptive, true);

  const afterEnum = updateSchemaValue(afterBoolean, arbitraryDescriptorSchema, "strategy", "OCTET");
  assert.equal(afterEnum.strategy, "OCTET");
  assert.throws(() => updateSchemaValue(before, arbitraryDescriptorSchema, "strategy", "HEXAGONAL"), /declared choices/);
  assert.throws(() => updateSchemaValue(before, arbitraryDescriptorSchema, "cellSize", "0.01"), /at least 0.1/);
  assert.throws(() => updateSchemaValue(before, arbitraryDescriptorSchema, "options/seedCount", "2.5"), /integer/);
  assert.throws(() => updateSchemaValue(before, arbitraryDescriptorSchema, "undeclared", "x"), /not declared/);
});

test("direct const is the authoritative default and rejects any other value", () => {
  const schema = { type: "string", title: "Direction", const: "NORMAL", default: "TANGENT" };
  assert.equal(schemaDefault(schema), "NORMAL");
  const [field] = flattenSchema(schema);
  assert.equal(field.control, "select");
  assert.deepEqual(field.choices.map((choice) => choice.value), ["NORMAL"]);
  assert.equal(updateSchemaValue(undefined, schema, "", "NORMAL"), "NORMAL");
  assert.throws(() => updateSchemaValue(undefined, schema, "", "TANGENT"), /declared choices/);
});

test("numeric multipleOf uses exact decimal arithmetic", () => {
  const schema = {
    type: "object",
    properties: {
      pitch: { type: "number", multipleOf: 0.1, default: "0.2" },
    },
  };
  const initial = schemaDefault(schema);
  assert.equal(updateSchemaValue(initial, schema, "pitch", "0.3").pitch, "0.3");
  assert.equal(updateSchemaValue(initial, schema, "pitch", "3e-1").pitch, "3e-1");
  assert.throws(() => updateSchemaValue(initial, schema, "pitch", "0.31"), /multiple of 0.1/);
  assert.throws(() => updateSchemaValue(initial, schema, "pitch", "0.30000000000000004"), /multiple of 0.1/);
});

test("encoded schema paths and decimal canonicalization handle edge cases", () => {
  const path = ["tool/path", "angle %", "µm"];
  assert.deepEqual(decodePath(encodePath(path)), path);
  assert.equal(normalizeDecimalString("-0.000"), "0");
  assert.equal(normalizeDecimalString("00012.50"), "12.50");
  assert.equal(normalizeDecimalString("-00012"), "-12");
});

test("disabled schema rendering locks every generated control", () => {
  const html = renderSchemaForm(arbitraryDescriptorSchema, schemaDefault(arbitraryDescriptorSchema), { disabled: true });
  const controlCount = [...html.matchAll(/<(?:input|select|textarea)\b/g)].length;
  const disabledCount = [...html.matchAll(/\bdisabled\b/g)].length;
  assert.equal(disabledCount, controlCount);
});
