# Idle Breaker Playable

Playable ad prototype built with Cocos Creator 3.8.6 and TypeScript.

The goal is to implement a short, polished gameplay loop: the player starts with a level 1 melee weapon, breaks resource objects, upgrades the weapon, destroys the exit gate at level 3, and triggers the final ad action.

## Playable Scenario Contract

The test task scenario is intentionally narrow. The playable should implement this exact loop:

1. The player starts inside a closed zone with a level 1 melee weapon.
2. The level 1 weapon can collect only the first resource type.
3. When enough first-tier resources are collected, the workbench upgrade zone becomes active.
4. Entering the active workbench zone consumes the required resources and upgrades the weapon to level 2.
5. The level 2 weapon can collect the second resource type.
6. When enough second-tier resources are collected, the workbench upgrade zone becomes active again.
7. Entering the active workbench zone consumes the required resources and upgrades the weapon to level 3.
8. The level 3 weapon can break the exit gate so the character can escape.
9. Completion triggers the final playable ad action, such as MRAID/store redirect.

Current production constraints:

- Weapon levels: exactly 3 melee weapon prefabs: `Weapon_Plank`, `Weapon_Pipe`, and `Weapon_Hammer`.
- Resource kinds: exactly 2 domain resource kinds: `wood` and `metal`.
- Upgrade costs: level 2 requires 6 wood, level 3 requires 6 metal.
- Scene breakables are discovered from `BreakableResource` components at runtime, so designers can add more authored breakable prefab instances without code changes.
- Required upgrade amounts are intentionally independent from the total resources placed in the scene. For example, the scene can contain 4 wood-producing fences while the level-2 upgrade still requires only 6 wood.
- Current production resource mapping: wood comes from fence breakables at weapon level 1, metal comes from box breakables at weapon level 2.
- Destructible prefab variants are allowed to add visual variety, but they must map back to one of the 2 resource kinds.
- Gate: exactly 1 exit gate, `ExitGate`, unlocked only after weapon level 3.
- Unused gameplay prefabs and assets should be removed or left unreferenced before production builds to keep the bundle as small as possible.

## Architecture Direction

This project intentionally uses Cocos Creator as the gameplay runtime, not only as a rendering layer.

For a playable ad, the best tradeoff is a lightweight component architecture:

- Cocos scene, prefabs, colliders, triggers, animation components, and layers define spatial gameplay.
- TypeScript gameplay state defines progression rules: resources, weapon level, upgrade availability, win condition, and final MRAID/store flow.
- Components bridge scene objects with gameplay state through small, explicit responsibilities.

The project does not use a separate engine-agnostic simulation layer. That approach would add complexity and duplicate features already provided by Cocos, such as collision detection, trigger zones, scene hierarchy, prefab contracts, and animation playback. For this scope, the priority is playability, responsiveness, production speed, and a small build.

## Gameplay Implementation Principles

- Use colliders and triggers for spatial interactions instead of manually checking distances or overlap rectangles in game code.
- Use simple collider shapes whenever possible: box, capsule, or sphere. Avoid mesh colliders unless there is a clear gameplay need.
- Use static colliders for decorative blockers such as fences, trees, bushes, and environment props.
- Use trigger colliders for interaction zones: crafting/upgrading, pickups, exit checks, and weapon hit windows.
- Keep breakable gameplay objects as prefabs with clear contracts: visual model, collider, health/config, required weapon level, reward, and optional feedback.
- Keep decorative objects free of gameplay scripts unless they need interaction.
- Keep UI, player control, resource logic, and ad flow in separate TypeScript components/services.

## Planned Component Boundaries

- `GameState`: current resources, weapon level, upgrade costs, and completion state.
- `PlayerController`: movement and input handling.
- `PlayerAnimator`: animation transitions such as idle, run, and hit.
- `WeaponMount`: visual weapon prefab mounted to the character hand socket for current weapon level.
- `WeaponHitbox`: short-lived trigger or physics query for melee attacks.
- `BreakableResource`: destructible resource object with required weapon level and reward.
- `UpgradeStation`: consumes resources and upgrades the weapon.
- `ExitGate`: destructible gate unlocked by weapon level 3.
- `UIController`: resource counter, weapon level, start/reset, and completion UI.
- `AdBridge`: final playable action such as MRAID/store redirect.

## Code Quality Tooling

The project uses a minimal ESLint and Prettier setup. The goal is to keep TypeScript consistent without adding process overhead.

Commands:

- `npm run lint`: checks TypeScript files under `assets/scripts`.
- `npm run lint:fix`: applies safe ESLint fixes.
- `npm run format`: formats supported project text files.
- `npm run format:check`: verifies formatting.

The ESLint configuration also enforces one architecture boundary:

- `assets/scripts/domain/**` must not import from `cc`.
- `assets/scripts/application/**` must not import from `cc`.

Scene-facing Cocos APIs should stay in components/adapters, for example under `assets/scripts/cocos/**`. Domain and application code should stay focused on gameplay progression and rules, which makes it easier to test and reason about without duplicating Cocos physics or rendering.

## Production Build

The shared Cocos build configuration is stored at `buildConfig_web-mobile.json`.

Build from the command line with Cocos Creator 3.8.6:

```powershell
& 'C:\ProgramData\cocos\editors\Creator\3.8.6\CocosCreator.exe' --project . --build 'configPath=./buildConfig_web-mobile.json'
```

In the Cocos Build panel, use this file via the import/export build config controls. The editor stores its last local Build panel state under `profiles/`, which is intentionally ignored; `buildConfig_web-mobile.json` is the project-owned source of truth.

## Optimization Notes

Playable ads are size-sensitive, so implementation should stay practical:

- Prefer prefab reuse over duplicated scene objects.
- Remove unused imported assets before production builds.
- Keep physics simple and avoid unnecessary rigid body simulation.
- Prefer low-cost visual feedback over heavy effects.
- Compress textures and keep only the assets needed for the playable flow.
- After a production build, verify whether `weapons_5.fbx` pulls unused weapon submeshes into the bundle. If it does, re-export a trimmed weapons source with only the 3 used weapon levels.

This structure keeps the codebase understandable while matching the test task criteria: Cocos Creator usage, TypeScript quality, responsive interactions, animation-driven feel, visual polish, and a production-minded playable scope.
