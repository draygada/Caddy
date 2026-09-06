import { describe, expect, it } from 'vitest';
// This repository intentionally omits Node ambient types; Vitest still executes in Node.
// @ts-expect-error -- test-only builtin used to assert the shipped stylesheet source.
import { readFileSync } from 'node:fs';
import appSource from '../src/App.tsx?raw';
import authoringSource from '../src/panels/AuthoringWorkspace.tsx?raw';
import missionNavSource from '../src/panels/MissionNav.tsx?raw';

const cssSource = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

describe('Candidate 0.2 compact responsive layout', () => {
  it('keeps the primary workspace rail bounded and its active item visible', () => {
    expect(missionNavSource).toContain('flex max-w-full flex-none min-w-0 overflow-hidden');
    expect(missionNavSource).toContain('data-primary-workspace-rail');
    expect(missionNavSource).toContain('min-w-0 max-w-full flex-1');
    expect(missionNavSource).toContain("inline: 'nearest'");
    expect(missionNavSource).toContain('w-14 flex-none');
    expect(missionNavSource).toContain('whitespace-nowrap');
    expect(missionNavSource).toContain("'MORE >'");
  });

  it('stacks all three CAD authoring columns without changing the desktop grid', () => {
    expect(authoringSource).toContain('data-cad-authoring-workspace');
    expect(authoringSource).toContain('className="cad-authoring-layout"');
    expect(authoringSource.match(/className="cad-authoring-column"/g)).toHaveLength(3);
    expect(authoringSource).toContain("gridTemplateColumns: 'minmax(220px, .72fr) minmax(360px, 1.45fr) minmax(280px, .95fr)'");
    expect(cssSource).toContain('@media (max-width: 639px)');
    expect(cssSource).toMatch(/\.cad-authoring-layout\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important;/);
    expect(cssSource).toMatch(/\.cad-authoring-column\s*\{[\s\S]*?min-width: 0;/);
    expect(cssSource).toMatch(/\.cad-authoring-workspace\s*\{[\s\S]*?overflow-x: hidden !important;/);
  });

  it('contains long CAD controls and keeps Commands mounted', () => {
    expect(authoringSource).toContain('className="cad-output-download"');
    expect(cssSource).toMatch(/\.cad-authoring-workspace button[\s\S]*?max-width: 100%;/);
    expect(cssSource).toMatch(/\.cad-output-download > span\s*\{[\s\S]*?overflow-wrap: anywhere;/);
    expect(appSource).toContain('<CommandBox />');
  });
});
