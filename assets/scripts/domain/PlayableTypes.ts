export type ResourceKind = 'wood' | 'metal';

export type WeaponLevel = 1 | 2 | 3;

export type UpgradeTargetLevel = 2 | 3;

export type PlayablePhase = 'intro' | 'playing' | 'completed';

export interface Inventory {
  wood: number;
  metal: number;
}

export interface ResourceDefinition {
  id: string;
  kind: ResourceKind;
  requiredWeaponLevel: Exclude<WeaponLevel, 3>;
  rewardAmount: number;
  maxHits: number;
}

export interface ResourceState extends ResourceDefinition {
  hitsRemaining: number;
  collected: boolean;
}

export interface GateDefinition {
  id: string;
  requiredWeaponLevel: 3;
  maxHits: number;
}

export interface GateState extends GateDefinition {
  hitsRemaining: number;
  destroyed: boolean;
}

export interface PlayableConfig {
  resources: ResourceDefinition[];
  gate: GateDefinition;
  upgradeCosts: Record<UpgradeTargetLevel, Partial<Inventory>>;
}

export interface PlayableState {
  phase: PlayablePhase;
  inventory: Inventory;
  weaponLevel: WeaponLevel;
  resources: Record<string, ResourceState>;
  gate: GateState;
}

export interface PlayableSnapshot {
  phase: PlayablePhase;
  inventory: Inventory;
  weaponLevel: WeaponLevel;
  resources: ResourceState[];
  gate: GateState;
  nextWeaponLevel: UpgradeTargetLevel | null;
  canUpgrade: boolean;
  gateUnlocked: boolean;
  completed: boolean;
}

export type GameCommand =
  | { type: 'start' }
  | { type: 'reset' }
  | { type: 'hitResource'; resourceId: string }
  | { type: 'tryUpgrade' }
  | { type: 'hitGate' };

export type UpgradeBlockReason = 'not_playing' | 'max_level' | 'missing_resources';

export type GameEvent =
  | { type: 'game_started' }
  | { type: 'game_reset' }
  | { type: 'resource_hit'; resourceId: string; hitsRemaining: number }
  | { type: 'resource_collected'; resourceId: string; kind: ResourceKind; rewardAmount: number }
  | { type: 'resource_locked'; resourceId: string; requiredWeaponLevel: WeaponLevel }
  | { type: 'upgrade_available'; targetLevel: UpgradeTargetLevel }
  | { type: 'upgrade_blocked'; reason: UpgradeBlockReason; targetLevel: UpgradeTargetLevel | null }
  | { type: 'weapon_upgraded'; level: WeaponLevel }
  | { type: 'gate_locked'; gateId: string; requiredWeaponLevel: WeaponLevel }
  | { type: 'gate_unlocked'; gateId: string }
  | { type: 'gate_hit'; gateId: string; hitsRemaining: number }
  | { type: 'gate_destroyed'; gateId: string }
  | { type: 'playable_completed' };

export interface StepResult {
  state: PlayableState;
  events: GameEvent[];
}
