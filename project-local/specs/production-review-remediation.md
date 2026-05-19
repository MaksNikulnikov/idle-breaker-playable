# Production Review Remediation Plan

## Context

External review highlighted several issues that reduce the perceived production quality of the playable:

- `PlayableGameController` is too large and acts as a God Object.
- `PlayerController` mixes input, movement, animation, attack, and browser safety.
- TypeScript strictness is disabled.
- ESLint allows explicit `any`.
- MRAID completion action must be guaranteed.
- After the exit gate is destroyed, player control must stop.
- The scene lacks visible shadows, making objects feel detached from the ground.

This plan keeps the project shippable while moving it toward a cleaner Cocos-style architecture.

## SOLID Direction

The refactor should intentionally apply SOLID rather than only reduce file size:

- Single Responsibility: scene components should own one reason to change.
- Open/Closed: new feedback effects, objectives, or ad actions should be added through focused components/configuration rather than editing the central controller.
- Liskov Substitution: small scene-facing contracts should make interchangeable feedback/ad/input implementations possible.
- Interface Segregation: consumers should depend on narrow capabilities, not whole controllers.
- Dependency Inversion: high-level gameplay orchestration should depend on explicit contracts and inspector-assigned collaborators, while domain/application logic stays independent from Cocos APIs.

The target shape is a Cocos composition root plus small collaborators, not a single gameplay script that knows every scene detail.

## Priorities

### P0: Submission-Critical Fixes

- Lock player movement/input after playable completion.
- Make completion ad action explicit and enabled by default.
- Verify final continue button still triggers the store fallback.
- Add visible shadows or a lightweight shadow-like presentation suitable for the current scene.

### P1: Type Safety

- Turn `strict` on in `tsconfig.json`.
- Replace broad `any` usage with narrow types, especially for MRAID/browser bridge boundaries.
- Change `@typescript-eslint/no-explicit-any` from `off` to at least `warn`, then to `error` once the codebase is clean.

### P2: Controller Decomposition

Keep `PlayableGameController` as the scene composition root only:

- Inspector references.
- Wiring scene-facing components together.
- Starting/resetting the playable.

Move responsibilities into smaller components/services:

- `PlayableSceneRegistry`: resolve and cache scene components.
- `PlayableProgressionController`: dispatch domain commands and apply state snapshots.
- `PlayableCompletionController`: completion lock and ad/store action.
- `TargetHintController`: idle timer and nearest target selection.
- Feedback views:
  - `HealthBarFeedbackView`
  - `PickupFeedbackView`
  - `StarBurstFeedbackView`
  - `CompletionOverlayView`

Split `PlayerController` into smaller scene components:

- `PlayerInputController`: keyboard/mouse/touch/joystick input.
- `PlayerMovementController`: rigid body movement and facing direction.
- `PlayerAnimator`: idle/run/attack animation playback.
- `PlayerAttackController`: attack lock and attack events.

### Refined Refactor Findings

The current domain layer already owns the core progression rules: resources, inventory, weapon
level, upgrade availability, gate lock/destruction, and completion. The next refactor should not
create a separate engine-agnostic simulation layer. Cocos should continue to own scene hierarchy,
colliders, triggers, animation playback, prefabs, and UI tracking.

What should move out of `PlayableGameController`:

- Scene discovery and cache: resource components, gate, player, weapon mount, upgrade trigger.
- Scene-to-domain config mapping: converting `BreakableResource` inspector settings into
  `ResourceDefinition` values.
- Presentation metadata currently hardcoded in controller methods: weapon display names, unlock
  text, power bonuses, and damage labels.
- Snapshot application to scene actors: resource damage states, gate state, weapon level,
  upgrade trigger state, completion player lock.
- Event-to-feedback orchestration: mapping domain events to floating labels, pickups, stars,
  slash effects, popup data, and impact bursts.
- Completion/ad flow: scheduling automatic store open and binding final CTA fallback.

What should remain in `PlayableGameController`:

- Public inspector fields that define scene wiring.
- Startup/reset lifecycle.
- Domain command dispatch.
- Coordinating small collaborators.
- Emitting state/events for debugging or future tools.

Important Cocos authoring constraint:

- Do not remove an inspector field just because a helper class now uses it. Important fields should
  remain visible and editable unless there is a clear reason and a scene migration path.
- Prefer moving logic behind those fields into non-component services first. Add new Cocos
  components only in a separate step, after Cocos has indexed scripts and the scene can be wired
  through the Inspector.

Generated-code cleanup rules:

- Avoid broad fallback chains and repeated tree searches spread across gameplay code.
- Keep fallbacks only where they serve real editor/runtime resilience, such as optional textures,
  missing prefab references during authoring, or dynamic resource lists.
- Prefer one named collaborator with one traversal/cache over many small recursive `find*` methods.
- Prefer explicit data tables/configs over repeated `if level === ...` methods for presentation
  values.

## Cocos Style Rules

- Prefer inspector-assigned references and prefab contracts over runtime component generation.
- Runtime discovery is allowed only as a fallback or for intentionally dynamic scene lists such as breakable resources.
- Keep Cocos APIs inside `assets/scripts/cocos/**`.
- Keep domain/application code independent from `cc`.
- Keep reusable visuals as prefabs.

## Implementation Order

1. Fix completion behavior and MRAID defaults.
2. Add/enable shadows or scene lighting settings.
3. Enable stricter linting without breaking the project.
4. Turn on TypeScript strictness and fix resulting errors.
5. Extract completion/ad flow from `PlayableGameController`.
6. Extract target hint flow from `PlayableGameController`.
7. Split player input from movement/animation/attack.
8. Rebuild and republish `build/web-mobile`.

## Acceptance Criteria

- Player cannot move or attack after playable completion.
- Completion triggers MRAID/store flow automatically, with the final button still clickable as a fallback.
- No missing scene references in preview console.
- `npm run lint`, `npm run test`, and `npx tsc --noEmit` pass.
- `strict` is enabled, or remaining strict blockers are explicitly documented.
- `PlayableGameController` is meaningfully smaller and no longer owns feedback implementation details.
- `PlayerController` is reduced or delegated to focused components.
- GitHub Pages build runs without missing asset 404 errors.

## Progress Log

- Added README architecture notes that explicitly call out SOLID expectations.
- Enabled completion player lock and automatic store/MRAID flow by default.
- Enabled standard Cocos shadow settings for the scene, 3D prefabs, weapons, and player.
- Enabled `strict` TypeScript mode and made `@typescript-eslint/no-explicit-any` an error.
- Extracted target hint timing/selection/display orchestration into `PlayableTargetHintController`.
- Extracted browser pointer safety wiring from `PlayerController` into `BrowserInputSafety`.
- Documented the refined controller decomposition plan, including inspector-preservation rules and
  generated-code cleanup rules.
- Extracted scene discovery/cache and scene-to-domain resource config mapping into
  `PlayableSceneRegistry` without changing inspector wiring.
- Extracted weapon names, unlock text, power bonuses, and damage labels into
  `PlayablePresentationConfig`.
- Extracted snapshot-to-scene application into `PlayableSnapshotApplier`: resource/gate damage
  states, weapon switching, HUD snapshot updates, upgrade trigger state, health bar syncing, and
  completion player lock.
- Extracted domain-event-to-visual-feedback mapping into `PlayableEventFeedbackPresenter`, keeping
  `PlayableGameController` focused on lifecycle, command dispatch, and completion flow.
- Extracted completion/store-button flow into `PlayableCompletionController` while preserving the
  existing `PlayableGameController.openStore()` inspector ClickEvent entry point.
- Verified ESLint keeps `cc` imports out of engine-independent layers (`domain` and `application`);
  Cocos APIs remain allowed only in scene-facing presentation/adapters.
- Extracted keyboard/mouse/touch transient state from `PlayerController` into `PlayerInputState`
  and added focused tests for input-state behavior.
- Added application-layer tests for presentation config and MRAID/window store bridge behavior.
- Extracted Cocos-free player locomotion calculation into `PlayerLocomotion`, preserving
  inspector-owned movement settings while covering diagonal speed normalization with tests.
- Extracted Cocos-free player attack lock/timer state into `PlayerAttackState`, preserving
  inspector-owned attack clip and timing fields while testing restart, tick, speed clamp, and cancel behavior.
- Extracted virtual joystick presentation into `PlayerJoystickView`, keeping touch/mobile behavior in
  the Cocos layer while reducing `PlayerController` to input decisions rather than UI node manipulation.
- Extracted animation playback/cross-fade state into `PlayerAnimationView`, keeping clip names and
  timing settings on `PlayerController` while moving `SkeletalAnimation` state handling behind a focused helper.
- Extracted Cocos physics velocity application and visual rotation into `PlayerMovementView`,
  preserving inspector-owned speed/rotation settings while keeping `PlayerController` focused on orchestration.
- Started decomposing `PlayableFeedbackView` by extracting `RuntimeHealthBar` and shared node layer
  propagation into focused Cocos-facing helpers without changing health bar prefab/Inspector contracts.
- Extracted transient effect pool ownership/recycling into `TransientEffectPools`, keeping pooled
  prefab effects warm and reusable while reducing feedback view infrastructure code.
- Extracted dashed rounded zone rendering into `DashedZoneRenderer`, keeping upgrade-station and
  target-hint visual settings inspector-owned while removing low-level polyline drawing from the feedback view.
- Extracted HUD canvas, fullscreen layer, popup, and victory overlay layout behavior into
  `PlayableFeedbackLayout`, preserving inspector-owned sizing knobs on `PlayableFeedbackView`.
- Extracted cached UI pop tween behavior into `UiPopAnimator`, keeping reward and weapon counter
  feedback reusable without storing animation cache directly on the feedback view.
- Extracted resource pickup badge spawning, warmup, icon binding, scatter arc, landing callback,
  and HUD fly-in behavior into `PickupRewardFeedback` while keeping distance/arc settings on the inspector-owned feedback component.
- Extracted hit and landing star burst spawning into `StarBurstFeedback`, leaving only the
  inspector-owned count presets and public effect entry points on `PlayableFeedbackView`.
- Extracted floating label spawning and renderer warmup into `FloatingLabelFeedback`, keeping
  label prefab internals outside the main feedback view.
- Extracted impact burst spawning into `ImpactBurstFeedback`, leaving `PlayableFeedbackView` to
  translate world positions and delegate effect playback.
- Replaced runtime-generated upgrade station UI zone with an inspector-assigned
  `UpgradeStationZone` prefab and `WorldTrackedZoneView`, keeping sizing/dash settings on
  `PlayableFeedbackView` while removing ad-hoc `addComponent` UI construction from that path.
- Extracted weapon upgrade popup creation, content binding, icon animation, show/hide tweens, and
  cleanup into `WeaponUpgradePopupPresenter`, leaving `PlayableFeedbackView` to delegate the
  upgrade feedback event while preserving the popup prefab/view contract.
- Extracted attack slash pooling, renderer warmup, layer propagation, lifetime, and recycle logic
  into `AttackSlashFeedback`, leaving `WeaponMount` focused on weapon prefab attachment, socket
  registration, and equip transforms.
