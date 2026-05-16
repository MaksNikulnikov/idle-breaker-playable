import type { PlayableConfig } from '../domain';

export const DEFAULT_PLAYABLE_CONFIG: PlayableConfig = {
  resources: [
    {
      id: 'Wood_01',
      kind: 'wood',
      requiredWeaponLevel: 1,
      rewardAmount: 1,
      maxHits: 3,
    },
    {
      id: 'Wood_02',
      kind: 'wood',
      requiredWeaponLevel: 1,
      rewardAmount: 1,
      maxHits: 3,
    },
    {
      id: 'Wood_03',
      kind: 'wood',
      requiredWeaponLevel: 1,
      rewardAmount: 1,
      maxHits: 3,
    },
    {
      id: 'Metal_01',
      kind: 'metal',
      requiredWeaponLevel: 2,
      rewardAmount: 1,
      maxHits: 3,
    },
    {
      id: 'Metal_02',
      kind: 'metal',
      requiredWeaponLevel: 2,
      rewardAmount: 1,
      maxHits: 3,
    },
    {
      id: 'Metal_03',
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
    2: { wood: 3 },
    3: { metal: 3 },
  },
};
