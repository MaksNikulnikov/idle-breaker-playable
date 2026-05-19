import { describe, expect, it } from 'vitest';

import { PlayerAttackState } from '../../assets/scripts/application/PlayerAttackState';

describe('PlayerAttackState', () => {
  it('starts an attack for the longer of animation runtime and lock duration', () => {
    const state = new PlayerAttackState();

    const result = state.start({
      animationDuration: 2.4,
      attackSpeed: 2.4,
      lockDuration: 0.5,
    });

    expect(result.started).toBe(true);
    expect(result.playbackSpeed).toBe(2.4);
    expect(result.lockTime).toBeCloseTo(1);
    expect(state.isAttacking).toBe(true);
    expect(state.timeRemaining).toBeCloseTo(1);
  });

  it('does not restart while an attack is already active', () => {
    const state = new PlayerAttackState();

    state.start({
      animationDuration: 2,
      attackSpeed: 1,
      lockDuration: 0,
    });

    const result = state.start({
      animationDuration: 1,
      attackSpeed: 1,
      lockDuration: 0,
    });

    expect(result.started).toBe(false);
    expect(result.lockTime).toBeCloseTo(2);
    expect(state.timeRemaining).toBeCloseTo(2);
  });

  it('reports exactly when the attack lock ends', () => {
    const state = new PlayerAttackState();

    state.start({
      animationDuration: 1,
      attackSpeed: 1,
      lockDuration: 0,
    });

    expect(state.tick(0.4)).toBe(false);
    expect(state.isAttacking).toBe(true);
    expect(state.tick(0.6)).toBe(true);
    expect(state.isAttacking).toBe(false);
  });

  it('clamps invalid speed and supports cancellation', () => {
    const state = new PlayerAttackState();

    const result = state.start({
      animationDuration: 0.1,
      attackSpeed: 0,
      lockDuration: 0,
    });

    expect(result.started).toBe(true);
    expect(result.playbackSpeed).toBe(0.01);
    expect(state.cancel()).toBe(true);
    expect(state.cancel()).toBe(false);
    expect(state.isAttacking).toBe(false);
  });
});
