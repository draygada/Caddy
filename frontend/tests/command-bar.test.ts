import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  COMMANDS,
  commandAvailable,
  commandById,
  registerWorkspaceNavigation,
  runCommand,
  searchCommands,
} from '../src/commands';
import { handleCommandPaletteKeydown } from '../src/panels/CommandBox';
import { useStore } from '../src/store';
import type { WorkspaceId } from '../src/store';

afterEach(() => {
  vi.unstubAllGlobals();
  useStore.getState().patch({ cmdOpen: false, recent: [] });
});

describe('global command palette', () => {
  it('opens from Command+K and Control+K while preventing browser handling', () => {
    for (const modifier of ['metaKey', 'ctrlKey'] as const) {
      useStore.getState().patch({ cmdOpen: false });
      const preventDefault = vi.fn();
      expect(handleCommandPaletteKeydown({ metaKey: false, ctrlKey: false, [modifier]: true, key: 'K', preventDefault })).toBe(true);
      expect(preventDefault).toHaveBeenCalledOnce();
      expect(useStore.getState().cmdOpen).toBe(true);
    }
  });

  it('finds every primary surface through user-facing labels and aliases off Design', () => {
    const globalCommands = COMMANDS.filter((command) => commandAvailable(command, false));
    const expected: Array<[string, string]> = [
      ['model viewport', 'navigate.design'],
      ['classify', 'navigate.classification'],
      ['supplier', 'navigate.sourcing'],
      ['customs', 'navigate.sourcing'],
      ['tripwire', 'review.tripwire'],
      ['help', 'panels.help'],
      ['appearance', 'panels.theme'],
    ];
    for (const [query, id] of expected) {
      expect(searchCommands(globalCommands, query).map((command) => command.id)).toContain(id);
    }
  });

  it('executes the three tab navigation commands through the registered app action', () => {
    const visited: WorkspaceId[] = [];
    const unregister = registerWorkspaceNavigation((workspace) => visited.push(workspace));
    const expected: WorkspaceId[] = ['design', 'classification', 'sourcing'];
    try {
      for (const workspace of expected) expect(runCommand(`navigate.${workspace}`)).toBe(true);
      expect(visited).toEqual(expected);
    } finally {
      unregister();
    }
  });

  it('keeps CAD authoring commands blocked when the Design workspace is unmounted', () => {
    vi.stubGlobal('document', { querySelector: vi.fn(() => null) });
    for (const id of ['create.sketch', 'create.extrude', 'create.hole', 'modify.fillet', 'modify.chamfer', 'modify.move']) {
      expect(commandAvailable(commandById(id)!, false)).toBe(false);
      expect(runCommand(id, 'plate')).toBe(false);
    }
    expect(runCommand('navigate.design')).toBe(true);
  });
});
