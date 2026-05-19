export type PlayerLocomotionInput = {
  inputX: number;
  inputY: number;
  moveSpeed: number;
  minInputLength: number;
};

export type PlayerLocomotionPlan = {
  hasMovement: boolean;
  normalizedInputX: number;
  normalizedInputY: number;
  velocityX: number;
  velocityZ: number;
  facingX: number;
  facingZ: number;
};

export function createPlayerLocomotionPlan(input: PlayerLocomotionInput): PlayerLocomotionPlan {
  const lengthSquared = input.inputX * input.inputX + input.inputY * input.inputY;
  const minLengthSquared = input.minInputLength * input.minInputLength;

  if (lengthSquared <= minLengthSquared) {
    return IDLE_PLAYER_LOCOMOTION_PLAN;
  }

  const length = Math.sqrt(lengthSquared);
  const normalizedInputX = input.inputX / length;
  const normalizedInputY = input.inputY / length;

  return {
    hasMovement: true,
    normalizedInputX,
    normalizedInputY,
    velocityX: normalizedInputX * input.moveSpeed,
    velocityZ: -normalizedInputY * input.moveSpeed,
    facingX: -normalizedInputX,
    facingZ: normalizedInputY,
  };
}

const IDLE_PLAYER_LOCOMOTION_PLAN: PlayerLocomotionPlan = {
  hasMovement: false,
  normalizedInputX: 0,
  normalizedInputY: 0,
  velocityX: 0,
  velocityZ: 0,
  facingX: 0,
  facingZ: 0,
};
