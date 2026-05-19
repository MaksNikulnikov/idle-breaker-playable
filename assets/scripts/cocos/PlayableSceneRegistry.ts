import { Collider, director, Node } from 'cc';

import type { PlayableConfig, ResourceDefinition } from '../domain';
import { BreakableResource, ResourceKind as CocosResourceKind } from './BreakableResource';
import { ExitGate } from './ExitGate';
import { PlayerController } from './PlayerController';
import { WeaponMount } from './WeaponMount';

type SceneReferenceOverrides = {
  exitGate: ExitGate | null;
  upgradeStationTrigger: Collider | null;
};

export class PlayableSceneRegistry {
  private readonly resources: BreakableResource[] = [];
  private readonly resourcesById = new Map<string, BreakableResource>();
  private exitGate: ExitGate | null = null;
  private upgradeStationTrigger: Collider | null = null;
  private weaponMount: WeaponMount | null = null;
  private playerController: PlayerController | null = null;

  public refreshConfig(
    baseConfig: PlayableConfig,
    references: SceneReferenceOverrides,
  ): PlayableConfig {
    this.scanScene(references);

    const definitions = this.resources.map((resource) =>
      this.createResourceDefinition(resource, resource.getRuntimeId()),
    );

    return {
      ...baseConfig,
      resources: definitions.length > 0 ? definitions : baseConfig.resources,
    };
  }

  public resolveResources(): BreakableResource[] {
    if (this.resources.length === 0) {
      this.scanScene();
    }

    return this.resources.filter((resource) => resource.isValid);
  }

  public findResource(resourceId: string): BreakableResource | null {
    const resource = this.resourcesById.get(resourceId) ?? null;

    if (resource !== null && resource.isValid) {
      return resource;
    }

    this.scanScene();
    return this.resourcesById.get(resourceId) ?? null;
  }

  public resolveExitGate(inspectorReference: ExitGate | null): ExitGate | null {
    if (this.isValid(inspectorReference)) {
      return inspectorReference;
    }

    if (this.isValid(this.exitGate)) {
      return this.exitGate;
    }

    this.scanScene({ exitGate: inspectorReference, upgradeStationTrigger: null });
    return this.exitGate;
  }

  public resolveUpgradeStationTrigger(inspectorReference: Collider | null): Collider | null {
    if (this.isValid(inspectorReference)) {
      return inspectorReference;
    }

    if (this.isValid(this.upgradeStationTrigger)) {
      return this.upgradeStationTrigger;
    }

    this.scanScene({ exitGate: null, upgradeStationTrigger: inspectorReference });
    return this.upgradeStationTrigger;
  }

  public resolveWeaponMount(): WeaponMount | null {
    if (this.isValid(this.weaponMount)) {
      return this.weaponMount;
    }

    this.scanScene();
    return this.weaponMount;
  }

  public resolvePlayerController(): PlayerController | null {
    if (this.isValid(this.playerController)) {
      return this.playerController;
    }

    this.scanScene();
    return this.playerController;
  }

  public findPlayerInParents(node: Node): PlayerController | null {
    let current: Node | null = node;

    while (current !== null) {
      const player = current.getComponent(PlayerController);

      if (player !== null) {
        return player;
      }

      current = current.parent;
    }

    return null;
  }

  private scanScene(references?: Partial<SceneReferenceOverrides>): void {
    this.resources.length = 0;
    this.resourcesById.clear();

    const inspectorExitGate = references?.exitGate ?? null;
    const inspectorUpgradeStationTrigger = references?.upgradeStationTrigger ?? null;

    this.exitGate = this.isValid(inspectorExitGate) ? inspectorExitGate : null;
    this.upgradeStationTrigger = this.isValid(inspectorUpgradeStationTrigger)
      ? inspectorUpgradeStationTrigger
      : null;
    this.weaponMount = null;
    this.playerController = null;

    const scene = director.getScene();

    if (scene === null) {
      return;
    }

    const usedResourceIds = new Map<string, number>();
    this.visitNode(scene, usedResourceIds);
  }

  private visitNode(node: Node, usedResourceIds: Map<string, number>): void {
    const resource = node.getComponent(BreakableResource);

    if (resource !== null) {
      const id = this.createUniqueResourceId(resource, usedResourceIds);
      resource.assignRuntimeId(id);
      this.resources.push(resource);
      this.resourcesById.set(id, resource);
    }

    this.exitGate ??= node.getComponent(ExitGate);
    this.weaponMount ??= node.getComponent(WeaponMount);
    this.playerController ??= node.getComponent(PlayerController);

    if (this.upgradeStationTrigger === null && node.name === 'UpgradeStationTrigger') {
      this.upgradeStationTrigger = node.getComponent(Collider);
    }

    for (const child of node.children) {
      this.visitNode(child, usedResourceIds);
    }
  }

  private createUniqueResourceId(
    resource: BreakableResource,
    usedIds: Map<string, number>,
  ): string {
    const baseId = resource.resourceId.trim() || resource.node.name || 'Resource';
    const count = usedIds.get(baseId) ?? 0;
    usedIds.set(baseId, count + 1);

    return count === 0 ? baseId : `${baseId}_${count + 1}`;
  }

  private createResourceDefinition(resource: BreakableResource, id: string): ResourceDefinition {
    return {
      id,
      kind: resource.resourceKind === CocosResourceKind.Metal ? 'metal' : 'wood',
      requiredWeaponLevel: resource.requiredWeaponLevel >= 2 ? 2 : 1,
      rewardAmount: Math.max(1, Math.floor(resource.rewardAmount)),
      maxHits: Math.max(1, Math.floor(resource.maxHits)),
    };
  }

  private isValid<T extends { isValid: boolean }>(value: T | null): value is T {
    return value !== null && value.isValid;
  }
}
