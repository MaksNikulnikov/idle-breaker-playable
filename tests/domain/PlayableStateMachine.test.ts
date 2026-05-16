import { describe, expect, it } from 'vitest';

import { DEFAULT_PLAYABLE_CONFIG } from '../../assets/scripts/application';
import {
  createInitialPlayableState,
  createPlayableSnapshot,
  stepPlayableState,
  type GameCommand,
  type GameEvent,
  type PlayableState,
} from '../../assets/scripts/domain';

function step(state: PlayableState, command: GameCommand): [PlayableState, GameEvent[]] {
  const result = stepPlayableState(state, command, DEFAULT_PLAYABLE_CONFIG);
  return [result.state, result.events];
}

function runCommands(state: PlayableState, commands: GameCommand[]): [PlayableState, GameEvent[]] {
  const events: GameEvent[] = [];
  let currentState = state;

  for (const command of commands) {
    const result = stepPlayableState(currentState, command, DEFAULT_PLAYABLE_CONFIG);
    currentState = result.state;
    events.push(...result.events);
  }

  return [currentState, events];
}

function hitResource(resourceId: string, times = 3): GameCommand[] {
  return Array.from({ length: times }, () => ({ type: 'hitResource', resourceId }));
}

function hitGate(times = 3): GameCommand[] {
  return Array.from({ length: times }, () => ({ type: 'hitGate' }));
}

describe('PlayableStateMachine', () => {
  it('creates the initial playable state from config', () => {
    const state = createInitialPlayableState(DEFAULT_PLAYABLE_CONFIG);
    const snapshot = createPlayableSnapshot(state, DEFAULT_PLAYABLE_CONFIG);

    expect(snapshot.phase).toBe('intro');
    expect(snapshot.weaponLevel).toBe(1);
    expect(snapshot.inventory).toEqual({ wood: 0, metal: 0 });
    expect(snapshot.resources).toHaveLength(6);
    expect(snapshot.gate).toMatchObject({
      id: 'ExitGate',
      requiredWeaponLevel: 3,
      hitsRemaining: 3,
      destroyed: false,
    });
    expect(snapshot.canUpgrade).toBe(false);
    expect(snapshot.gateUnlocked).toBe(false);
  });

  it('blocks second resource type before weapon level 2', () => {
    let state = createInitialPlayableState(DEFAULT_PLAYABLE_CONFIG);
    [state] = step(state, { type: 'start' });

    const [nextState, events] = step(state, { type: 'hitResource', resourceId: 'Metal_01' });

    expect(events).toEqual([
      {
        type: 'resource_locked',
        resourceId: 'Metal_01',
        requiredWeaponLevel: 2,
      },
    ]);
    expect(nextState.inventory).toEqual({ wood: 0, metal: 0 });
    expect(nextState.resources.Metal_01.hitsRemaining).toBe(3);
    expect(nextState.resources.Metal_01.collected).toBe(false);
  });

  it('collects wood, upgrades to level 2, collects metal, and upgrades to level 3', () => {
    const [state, events] = runCommands(createInitialPlayableState(DEFAULT_PLAYABLE_CONFIG), [
      { type: 'start' },
      ...hitResource('Wood_01'),
      ...hitResource('Wood_02'),
      ...hitResource('Wood_03'),
      { type: 'tryUpgrade' },
      ...hitResource('Metal_01'),
      ...hitResource('Metal_02'),
      ...hitResource('Metal_03'),
      { type: 'tryUpgrade' },
    ]);

    expect(events).toContainEqual({ type: 'upgrade_available', targetLevel: 2 });
    expect(events).toContainEqual({ type: 'weapon_upgraded', level: 2 });
    expect(events).toContainEqual({ type: 'upgrade_available', targetLevel: 3 });
    expect(events).toContainEqual({ type: 'weapon_upgraded', level: 3 });
    expect(events).toContainEqual({ type: 'gate_unlocked', gateId: 'ExitGate' });
    expect(state.weaponLevel).toBe(3);
    expect(state.inventory).toEqual({ wood: 0, metal: 0 });
    expect(state.resources.Wood_01.collected).toBe(true);
    expect(state.resources.Metal_01.collected).toBe(true);
  });

  it('blocks gate before level 3 and completes playable after destroying it', () => {
    let state = createInitialPlayableState(DEFAULT_PLAYABLE_CONFIG);
    [state] = step(state, { type: 'start' });

    const [lockedState, lockedEvents] = step(state, { type: 'hitGate' });

    expect(lockedEvents).toEqual([
      {
        type: 'gate_locked',
        gateId: 'ExitGate',
        requiredWeaponLevel: 3,
      },
    ]);
    expect(lockedState.gate.hitsRemaining).toBe(3);

    const [completedState, completionEvents] = runCommands(lockedState, [
      ...hitResource('Wood_01'),
      ...hitResource('Wood_02'),
      ...hitResource('Wood_03'),
      { type: 'tryUpgrade' },
      ...hitResource('Metal_01'),
      ...hitResource('Metal_02'),
      ...hitResource('Metal_03'),
      { type: 'tryUpgrade' },
      ...hitGate(),
    ]);

    expect(completionEvents).toContainEqual({
      type: 'gate_destroyed',
      gateId: 'ExitGate',
    });
    expect(completionEvents).toContainEqual({ type: 'playable_completed' });
    expect(completedState.phase).toBe('completed');
    expect(completedState.gate.destroyed).toBe(true);
    expect(completedState.gate.hitsRemaining).toBe(0);
  });

  it('returns new state objects without mutating previous states', () => {
    const initialState = createInitialPlayableState(DEFAULT_PLAYABLE_CONFIG);
    const [playingState] = step(initialState, { type: 'start' });
    const [hitState] = step(playingState, { type: 'hitResource', resourceId: 'Wood_01' });

    expect(initialState.phase).toBe('intro');
    expect(initialState.resources.Wood_01.hitsRemaining).toBe(3);
    expect(playingState.phase).toBe('playing');
    expect(playingState.resources.Wood_01.hitsRemaining).toBe(3);
    expect(hitState.resources.Wood_01.hitsRemaining).toBe(2);
  });

  it('resets progression back to the initial state', () => {
    const [progressState] = runCommands(createInitialPlayableState(DEFAULT_PLAYABLE_CONFIG), [
      { type: 'start' },
      ...hitResource('Wood_01'),
    ]);

    const [resetState, events] = step(progressState, { type: 'reset' });

    expect(events).toEqual([{ type: 'game_reset' }]);
    expect(resetState.phase).toBe('intro');
    expect(resetState.inventory).toEqual({ wood: 0, metal: 0 });
    expect(resetState.resources.Wood_01).toMatchObject({
      hitsRemaining: 3,
      collected: false,
    });
  });
});
