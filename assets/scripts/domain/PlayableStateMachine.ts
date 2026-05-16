import type {
  GameCommand,
  GameEvent,
  GateState,
  Inventory,
  PlayableConfig,
  PlayableSnapshot,
  PlayableState,
  ResourceState,
  StepResult,
  UpgradeTargetLevel,
  WeaponLevel,
} from './PlayableTypes';

const STARTING_WEAPON_LEVEL: WeaponLevel = 1;

const EMPTY_INVENTORY: Inventory = {
  wood: 0,
  metal: 0,
};

export function createInitialPlayableState(config: PlayableConfig): PlayableState {
  const resources: Record<string, ResourceState> = {};

  for (const resource of config.resources) {
    resources[resource.id] = {
      ...resource,
      hitsRemaining: resource.maxHits,
      collected: false,
    };
  }

  return {
    phase: 'intro',
    inventory: { ...EMPTY_INVENTORY },
    weaponLevel: STARTING_WEAPON_LEVEL,
    resources,
    gate: {
      ...config.gate,
      hitsRemaining: config.gate.maxHits,
      destroyed: false,
    },
  };
}

export function stepPlayableState(
  state: PlayableState,
  command: GameCommand,
  config: PlayableConfig,
): StepResult {
  if (command.type === 'reset') {
    return {
      state: createInitialPlayableState(config),
      events: [{ type: 'game_reset' }],
    };
  }

  const next = cloneState(state);
  const events: GameEvent[] = [];

  switch (command.type) {
    case 'start':
      startGame(next, events);
      break;
    case 'hitResource':
      hitResource(next, events, config, command.resourceId);
      break;
    case 'tryUpgrade':
      tryUpgradeWeapon(next, events, config);
      break;
    case 'hitGate':
      hitGate(next, events);
      break;
  }

  return { state: next, events };
}

export function createPlayableSnapshot(
  state: PlayableState,
  config: PlayableConfig,
): PlayableSnapshot {
  const nextWeaponLevel = getNextWeaponLevel(state.weaponLevel);

  return {
    phase: state.phase,
    inventory: { ...state.inventory },
    weaponLevel: state.weaponLevel,
    resources: config.resources.map((resource) => cloneResource(state.resources[resource.id])),
    gate: cloneGate(state.gate),
    nextWeaponLevel,
    canUpgrade:
      nextWeaponLevel !== null && canAffordUpgrade(state.inventory, nextWeaponLevel, config),
    gateUnlocked: state.weaponLevel >= state.gate.requiredWeaponLevel,
    completed: state.phase === 'completed',
  };
}

export function getNextWeaponLevel(currentLevel: WeaponLevel): UpgradeTargetLevel | null {
  if (currentLevel === 1) {
    return 2;
  }

  if (currentLevel === 2) {
    return 3;
  }

  return null;
}

export function canAffordUpgrade(
  inventory: Inventory,
  targetLevel: UpgradeTargetLevel,
  config: PlayableConfig,
): boolean {
  const cost = config.upgradeCosts[targetLevel];

  return (cost.wood ?? 0) <= inventory.wood && (cost.metal ?? 0) <= inventory.metal;
}

function startGame(state: PlayableState, events: GameEvent[]): void {
  if (state.phase !== 'intro') {
    return;
  }

  state.phase = 'playing';
  events.push({ type: 'game_started' });
}

function hitResource(
  state: PlayableState,
  events: GameEvent[],
  config: PlayableConfig,
  resourceId: string,
): void {
  if (state.phase !== 'playing') {
    return;
  }

  const resource = state.resources[resourceId];

  if (resource === undefined || resource.collected) {
    return;
  }

  if (state.weaponLevel < resource.requiredWeaponLevel) {
    events.push({
      type: 'resource_locked',
      resourceId,
      requiredWeaponLevel: resource.requiredWeaponLevel,
    });
    return;
  }

  resource.hitsRemaining = Math.max(0, resource.hitsRemaining - 1);
  events.push({
    type: 'resource_hit',
    resourceId,
    hitsRemaining: resource.hitsRemaining,
  });

  if (resource.hitsRemaining > 0) {
    return;
  }

  resource.collected = true;
  state.inventory[resource.kind] += resource.rewardAmount;
  events.push({
    type: 'resource_collected',
    resourceId,
    kind: resource.kind,
    rewardAmount: resource.rewardAmount,
  });

  const nextWeaponLevel = getNextWeaponLevel(state.weaponLevel);

  if (nextWeaponLevel !== null && canAffordUpgrade(state.inventory, nextWeaponLevel, config)) {
    events.push({ type: 'upgrade_available', targetLevel: nextWeaponLevel });
  }
}

function tryUpgradeWeapon(state: PlayableState, events: GameEvent[], config: PlayableConfig): void {
  const targetLevel = getNextWeaponLevel(state.weaponLevel);

  if (state.phase !== 'playing') {
    events.push({ type: 'upgrade_blocked', reason: 'not_playing', targetLevel });
    return;
  }

  if (targetLevel === null) {
    events.push({ type: 'upgrade_blocked', reason: 'max_level', targetLevel: null });
    return;
  }

  if (!canAffordUpgrade(state.inventory, targetLevel, config)) {
    events.push({ type: 'upgrade_blocked', reason: 'missing_resources', targetLevel });
    return;
  }

  const cost = config.upgradeCosts[targetLevel];
  state.inventory.wood -= cost.wood ?? 0;
  state.inventory.metal -= cost.metal ?? 0;
  state.weaponLevel = targetLevel;
  events.push({ type: 'weapon_upgraded', level: state.weaponLevel });

  if (state.weaponLevel >= state.gate.requiredWeaponLevel) {
    events.push({ type: 'gate_unlocked', gateId: state.gate.id });
  }
}

function hitGate(state: PlayableState, events: GameEvent[]): void {
  if (state.phase !== 'playing' || state.gate.destroyed) {
    return;
  }

  if (state.weaponLevel < state.gate.requiredWeaponLevel) {
    events.push({
      type: 'gate_locked',
      gateId: state.gate.id,
      requiredWeaponLevel: state.gate.requiredWeaponLevel,
    });
    return;
  }

  state.gate.hitsRemaining = Math.max(0, state.gate.hitsRemaining - 1);
  events.push({
    type: 'gate_hit',
    gateId: state.gate.id,
    hitsRemaining: state.gate.hitsRemaining,
  });

  if (state.gate.hitsRemaining > 0) {
    return;
  }

  state.gate.destroyed = true;
  state.phase = 'completed';
  events.push({ type: 'gate_destroyed', gateId: state.gate.id });
  events.push({ type: 'playable_completed' });
}

function cloneState(state: PlayableState): PlayableState {
  const resources: Record<string, ResourceState> = {};

  for (const id in state.resources) {
    resources[id] = cloneResource(state.resources[id]);
  }

  return {
    phase: state.phase,
    inventory: { ...state.inventory },
    weaponLevel: state.weaponLevel,
    resources,
    gate: cloneGate(state.gate),
  };
}

function cloneResource(resource: ResourceState): ResourceState {
  return { ...resource };
}

function cloneGate(gate: GateState): GateState {
  return { ...gate };
}
