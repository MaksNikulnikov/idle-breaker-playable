import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PLAYABLE_PRESENTATION_CONFIG,
  getDamageText,
  getWeaponDisplayName,
  getWeaponPowerBonus,
  getWeaponUnlockText,
} from '../../assets/scripts/application';
import type { PlayableSnapshot } from '../../assets/scripts/domain';

function createSnapshot(weaponLevel: 1 | 2 | 3): PlayableSnapshot {
  return {
    phase: 'playing',
    inventory: { wood: 0, metal: 0 },
    collectedTotals: { wood: 0, metal: 0 },
    totalRewards: { wood: 6, metal: 6 },
    weaponLevel,
    resources: [],
    gate: {
      id: 'ExitGate',
      requiredWeaponLevel: 3,
      maxHits: 3,
      hitsRemaining: 3,
      destroyed: false,
    },
    nextWeaponLevel: weaponLevel < 3 ? ((weaponLevel + 1) as 2 | 3) : null,
    canUpgrade: false,
    gateUnlocked: weaponLevel >= 3,
    completed: false,
  };
}

describe('PlayablePresentationConfig', () => {
  it('keeps weapon upgrade labels and power bonuses in a data table', () => {
    expect(getWeaponDisplayName(1)).toBe('WOODEN PLANK');
    expect(getWeaponDisplayName(2)).toBe('METAL PIPE');
    expect(getWeaponDisplayName(3)).toBe('HAMMER');

    expect(getWeaponUnlockText(2)).toBe('BOXES UNLOCKED');
    expect(getWeaponUnlockText(3)).toBe('GATE UNLOCKED');

    expect(getWeaponPowerBonus(1)).toBe(0);
    expect(getWeaponPowerBonus(2)).toBe(150);
    expect(getWeaponPowerBonus(3)).toBe(250);
  });

  it('maps damage labels by current weapon level', () => {
    expect(getDamageText(createSnapshot(1))).toBe('45');
    expect(getDamageText(createSnapshot(2))).toBe('75');
    expect(getDamageText(createSnapshot(3))).toBe('110');
  });

  it('supports replacing presentation values without changing gameplay rules', () => {
    expect(
      getWeaponDisplayName(2, {
        ...DEFAULT_PLAYABLE_PRESENTATION_CONFIG,
        weaponDisplayNames: {
          ...DEFAULT_PLAYABLE_PRESENTATION_CONFIG.weaponDisplayNames,
          2: 'PIPE',
        },
      }),
    ).toBe('PIPE');
  });
});
