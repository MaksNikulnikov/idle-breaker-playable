import type { PlayableSnapshot, WeaponLevel } from '../domain';

export type PlayablePresentationConfig = {
  weaponDisplayNames: Record<WeaponLevel, string>;
  weaponUnlockText: Record<WeaponLevel, string>;
  weaponPowerBonus: Record<WeaponLevel, number>;
  damageTextByWeaponLevel: Record<WeaponLevel, string>;
};

export const DEFAULT_PLAYABLE_PRESENTATION_CONFIG: PlayablePresentationConfig = {
  weaponDisplayNames: {
    1: 'WOODEN PLANK',
    2: 'METAL PIPE',
    3: 'HAMMER',
  },
  weaponUnlockText: {
    1: 'BOXES LOCKED',
    2: 'BOXES UNLOCKED',
    3: 'GATE UNLOCKED',
  },
  weaponPowerBonus: {
    1: 0,
    2: 150,
    3: 250,
  },
  damageTextByWeaponLevel: {
    1: '45',
    2: '75',
    3: '110',
  },
};

export function getWeaponDisplayName(
  level: WeaponLevel,
  config: PlayablePresentationConfig = DEFAULT_PLAYABLE_PRESENTATION_CONFIG,
): string {
  return config.weaponDisplayNames[level];
}

export function getWeaponUnlockText(
  level: WeaponLevel,
  config: PlayablePresentationConfig = DEFAULT_PLAYABLE_PRESENTATION_CONFIG,
): string {
  return config.weaponUnlockText[level];
}

export function getWeaponPowerBonus(
  level: WeaponLevel,
  config: PlayablePresentationConfig = DEFAULT_PLAYABLE_PRESENTATION_CONFIG,
): number {
  return config.weaponPowerBonus[level];
}

export function getDamageText(
  snapshot: PlayableSnapshot,
  config: PlayablePresentationConfig = DEFAULT_PLAYABLE_PRESENTATION_CONFIG,
): string {
  return config.damageTextByWeaponLevel[snapshot.weaponLevel];
}
