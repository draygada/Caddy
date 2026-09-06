import { describe, expect, it } from 'vitest';
import {
  isOverlayWorkspace,
  WORKSPACES,
  workspaceFromSearch,
  workspaceLocation,
} from '../src/panels/MissionNav';

describe('mission workspace routing', () => {
  it('keeps only the coherent primary product destinations', () => {
    expect(WORKSPACES.map(({ id }) => id)).toEqual([
      'design',
      'core',
      'classification',
      'source',
      'sources',
      'record',
      'collaboration',
    ]);
  });

  it('restores valid workspace identities and fails unknown routes to Design', () => {
    expect(workspaceFromSearch('?workspace=core')).toBe('core');
    expect(workspaceFromSearch('?workspace=sources')).toBe('sources');
    expect(workspaceFromSearch('?workspace=tripwire')).toBe('design');
    expect(workspaceFromSearch('?now=1')).toBe('design');
  });

  it('creates shareable locations while preserving unrelated query state', () => {
    expect(workspaceLocation('https://example.test/?demo=1&now=1#proof', 'record'))
      .toBe('/?demo=1&workspace=record#proof');
  });

  it('distinguishes governed overlays from base workspaces', () => {
    expect(isOverlayWorkspace('source')).toBe(true);
    expect(isOverlayWorkspace('record')).toBe(true);
    expect(isOverlayWorkspace('design')).toBe(false);
  });
});
