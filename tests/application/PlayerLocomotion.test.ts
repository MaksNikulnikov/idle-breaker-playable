import { describe, expect, it } from 'vitest';

import { createPlayerLocomotionPlan } from '../../assets/scripts/application/PlayerLocomotion';

describe('createPlayerLocomotionPlan', () => {
  it('keeps the player idle below the input dead zone', () => {
    const plan = createPlayerLocomotionPlan({
      inputX: 0.02,
      inputY: 0.01,
      moveSpeed: 4.2,
      minInputLength: 0.05,
    });

    expect(plan.hasMovement).toBe(false);
    expect(plan.velocityX).toBe(0);
    expect(plan.velocityZ).toBe(0);
  });

  it('normalizes diagonal input before applying move speed', () => {
    const plan = createPlayerLocomotionPlan({
      inputX: 1,
      inputY: 1,
      moveSpeed: 4,
      minInputLength: 0.05,
    });

    expect(plan.hasMovement).toBe(true);
    expect(plan.normalizedInputX).toBeCloseTo(Math.SQRT1_2);
    expect(plan.normalizedInputY).toBeCloseTo(Math.SQRT1_2);
    expect(Math.hypot(plan.velocityX, plan.velocityZ)).toBeCloseTo(4);
  });

  it('maps screen input to Cocos world velocity and visual facing direction', () => {
    const plan = createPlayerLocomotionPlan({
      inputX: 0,
      inputY: 2,
      moveSpeed: 3,
      minInputLength: 0.05,
    });

    expect(plan.velocityX).toBeCloseTo(0);
    expect(plan.velocityZ).toBeCloseTo(-3);
    expect(plan.facingX).toBeCloseTo(0);
    expect(plan.facingZ).toBeCloseTo(1);
  });
});
