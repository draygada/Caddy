// @ts-nocheck -- The frontend build intentionally excludes Node ambient types; this test launches a real Node process.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import ts from 'typescript';

const scratchDirectories: string[] = [];

afterEach(() => {
  for (const directory of scratchDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('machine-contract production runtime entrypoints', () => {
  it('starts both Vercel-shaped ESM functions and preserves their fail-closed contracts', () => {
    const directory = mkdtempSync(join(tmpdir(), 'caddydaddy-now-runtime-'));
    scratchDirectories.push(directory);
    for (const name of ['_machine-contracts', 'now', 'candidate']) {
      const source = readFileSync(new URL(`../api/${name}.ts`, import.meta.url), 'utf8');
      const compiled = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
        fileName: `${name}.ts`,
        reportDiagnostics: true,
      });
      expect(compiled.diagnostics ?? []).toEqual([]);
      writeFileSync(join(directory, `${name}.js`), compiled.outputText, 'utf8');
    }
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ type: 'module' }), 'utf8');

    const probe = `
      const nowModule = await import(${JSON.stringify(pathToFileURL(join(directory, 'now.js')).href)});
      const candidateModule = await import(${JSON.stringify(pathToFileURL(join(directory, 'candidate.js')).href)});
      const invoke = async (handler, method) => {
        const capture = { body: null, headers: {}, statusCode: 0 };
        const response = {
          setHeader(name, value) { capture.headers[name] = value; },
          status(code) { capture.statusCode = code; return response; },
          json(value) { capture.body = value; },
        };
        await handler({ method }, response);
        return capture;
      };
      console.log(JSON.stringify({
        nowGet: await invoke(nowModule.default, 'GET'),
        nowPost: await invoke(nowModule.default, 'POST'),
        candidateGet: await invoke(candidateModule.default, 'GET'),
      }));
    `;
    const child = spawnSync(process.execPath, ['--input-type=module', '--eval', probe], {
      encoding: 'utf8',
      env: {
        ...process.env,
        CADDYDADDY_FRONTEND_COMMIT_SHA: 'A'.repeat(40),
        CADDYDADDY_BACKEND_COMMIT_SHA: '',
      },
    });

    expect(child.status, child.stderr).toBe(0);
    expect(child.stderr).toBe('');
    const result = JSON.parse(child.stdout) as {
      nowGet: { body: Record<string, unknown>; headers: Record<string, string>; statusCode: number };
      nowPost: { body: Record<string, unknown>; headers: Record<string, string>; statusCode: number };
      candidateGet: { body: Record<string, unknown>; headers: Record<string, string>; statusCode: number };
    };

    expect(result.nowGet.statusCode).toBe(200);
    expect(result.nowGet.headers).toMatchObject({
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    });
    expect(result.nowGet.body).toMatchObject({
      schemaVersion: 'forge.now-observation.v1',
      projectionRole: 'READ_ONLY_SOURCE_NEUTRAL',
      mutationAuthority: 'NONE',
      sourceHealth: 'PARTIAL',
      current: {
        objective: { state: 'UNKNOWN', value: null },
        status: { state: 'UNKNOWN', value: null },
        blockers: { state: 'UNKNOWN', items: [] },
      },
    });
    expect(result.nowPost.statusCode).toBe(405);
    expect(result.nowPost.headers.Allow).toBe('GET');
    expect(result.nowPost.body).toMatchObject({
      status: 'BLOCKED',
      diagnostic: { code: 'METHOD_NOT_ALLOWED' },
      mutationAuthority: 'NONE',
    });
    expect(result.candidateGet.statusCode).toBe(503);
    expect(result.candidateGet.body).toMatchObject({
      status: 'BLOCKED',
      diagnostic: { code: 'PRODUCT_SERVICE_BINDING_UNKNOWN' },
      mutationAuthority: 'NONE',
    });
  });
});
