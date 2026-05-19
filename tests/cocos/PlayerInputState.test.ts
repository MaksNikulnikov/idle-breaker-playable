import { describe, expect, it } from 'vitest';

import { PlayerInputState } from '../../assets/scripts/cocos/PlayerInputState';

describe('PlayerInputState', () => {
  it('derives keyboard movement from pressed direction keys', () => {
    const state = new PlayerInputState();

    state.setMoveKey('right', true);
    state.setMoveKey('forward', true);
    state.syncKeyboardInput();

    expect(state.inputX).toBe(1);
    expect(state.inputY).toBe(1);

    state.setMoveKey('left', true);
    state.syncKeyboardInput();

    expect(state.inputX).toBe(0);
    expect(state.inputY).toBe(1);
  });

  it('keeps touch movement in control until touch input resets', () => {
    const state = new PlayerInputState();

    state.setMoveKey('right', true);
    state.beginTouch(42);
    state.setInputVector(12, -4);
    state.syncKeyboardInput();

    expect(state.inputX).toBe(12);
    expect(state.inputY).toBe(-4);
    expect(state.isActiveTouchEvent(41)).toBe(false);
    expect(state.isActiveTouchEvent(42)).toBe(true);

    state.resetPointerInput();
    state.syncKeyboardInput();

    expect(state.inputX).toBe(1);
    expect(state.inputY).toBe(0);
  });

  it('distinguishes tap attacks from dragged mouse or touch input', () => {
    const state = new PlayerInputState();

    state.beginMouse();
    expect(state.shouldAttackFromMouseRelease()).toBe(true);
    state.markMouseDragged();
    expect(state.shouldAttackFromMouseRelease()).toBe(false);

    state.beginTouch(7);
    expect(state.isTouchTap()).toBe(true);
    state.markTouchDragged();
    expect(state.isTouchTap()).toBe(false);
  });

  it('reports active gameplay input and resets all transient state', () => {
    const state = new PlayerInputState();

    expect(state.hasActiveGameplayInput(0.05)).toBe(false);

    state.setInputVector(0.1, 0);
    expect(state.hasActiveGameplayInput(0.05)).toBe(true);

    state.resetAll();
    expect(state.hasActiveGameplayInput(0.05)).toBe(false);
    expect(state.inputX).toBe(0);
    expect(state.inputY).toBe(0);
  });
});
