import type { PlayableConfig } from '../domain';

export const DEFAULT_PLAYABLE_CONFIG: PlayableConfig = {
  resources: [
    {
      id: 'WoodenBoxLarge',
      kind: 'wood',
      requiredWeaponLevel: 1,
      rewardAmount: 1,
      maxHits: 3,
    },
    {
      id: 'WoodenBoxSmall',
      kind: 'wood',
      requiredWeaponLevel: 1,
      rewardAmount: 1,
      maxHits: 3,
    },
    {
      id: 'WoodenFence_01',
      kind: 'metal',
      requiredWeaponLevel: 2,
      rewardAmount: 1,
      maxHits: 3,
    },
    {
      id: 'WoodenFence_02',
      kind: 'metal',
      requiredWeaponLevel: 2,
      rewardAmount: 1,
      maxHits: 3,
    },
  ],
  gate: {
    id: 'ExitGate',
    requiredWeaponLevel: 3,
    maxHits: 3,
  },
  upgradeCosts: {
    2: { wood: 2 },
    3: { metal: 2 },
  },
};
