# Idle Breaker Playable

Playable ad prototype built with Cocos Creator 3.8.6 and TypeScript.

The goal is to implement a short, polished gameplay loop: the player starts with a level 1 melee weapon, breaks resource objects, upgrades the weapon, destroys the exit gate at level 3, and triggers the final ad action.

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

## Optimization Notes

Playable ads are size-sensitive, so implementation should stay practical:

- Prefer prefab reuse over duplicated scene objects.
- Remove unused imported assets before production builds.
- Keep physics simple and avoid unnecessary rigid body simulation.
- Prefer low-cost visual feedback over heavy effects.
- Compress textures and keep only the assets needed for the playable flow.

This structure keeps the codebase understandable while matching the test task criteria: Cocos Creator usage, TypeScript quality, responsive interactions, animation-driven feel, visual polish, and a production-minded playable scope.
